import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CACHE_CHANGED_EVENT,
  COURSE_CACHE,
  downloadPack,
  isPackComplete,
  offlineSupported,
  packStatus,
  removePack,
  storageEstimate,
} from '../lib/offline-cache.ts';
import type { OfflinePack, PackEntry } from '../lib/offline-pack.ts';

type FetchFn = typeof globalThis.fetch;

class MemoryCache {
  readonly rows = new Map<string, Response>();
  readonly puts: string[] = [];
  readonly deletes: string[] = [];
  matchErrorFor = new Set<string>();
  deleteErrorFor = new Set<string>();
  putErrorFor = new Set<string>();

  private key(value: RequestInfo | URL): string {
    const raw = typeof value === 'string' ? value : value instanceof URL ? value.href : value.url;
    return raw.split('?')[0];
  }

  async match(value: RequestInfo | URL): Promise<Response | undefined> {
    const key = this.key(value);
    if (this.matchErrorFor.has(key)) throw new Error('cache read failed');
    return this.rows.get(key);
  }

  async put(value: RequestInfo | URL, response: Response): Promise<void> {
    const key = this.key(value);
    if (this.putErrorFor.has(key)) throw new Error('quota exceeded');
    this.puts.push(key);
    this.rows.set(key, response);
  }

  async delete(value: RequestInfo | URL): Promise<boolean> {
    const key = this.key(value);
    if (this.deleteErrorFor.has(key)) throw new Error('cache delete failed');
    this.deletes.push(key);
    return this.rows.delete(key);
  }
}

function entry(url: string, bytes: number): PackEntry {
  return { url, bytes, kind: 'slide' };
}

function pack(entries: PackEntry[], bytes = entries.reduce((sum, item) => sum + item.bytes, 0)): OfflinePack {
  return {
    moduleId: 'module',
    lang: 'zu',
    quality: 'standard',
    entries,
    bytes,
    missing: [],
  };
}

function installBrowser(cache: MemoryCache, fetchImpl: FetchFn = globalThis.fetch) {
  const target = new EventTarget() as EventTarget & { caches: unknown };
  target.caches = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async (name: string) => {
      assert.equal(name, COURSE_CACHE);
      return cache;
    } },
  });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchImpl });
  return target;
}

test('the paid-for course cache is stable across deploys and explicitly spared from the sweep', () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const workerCache = source.match(/const COURSE_CACHE = '([^']+)'/)?.[1];
  assert.equal(workerCache, COURSE_CACHE);
  assert.match(source, /key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== COURSE_CACHE/);
  assert.doesNotMatch(source, /COURSE_CACHE\s*=\s*['"][^'"]*['"]\s*\+\s*(?:CACHE_VERSION|BUILD_ID)/);
});

test('the app shell a farmer opens with no signal is actually precached', () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const list = source.match(/const PRECACHE_URLS = \[([\s\S]*?)\];/)?.[1] ?? '';

  // The whole promise of this app is that it works at a homestead with no signal. That needs the
  // SHELL, not just a manifest and two icons — which is all this list held. A farmer who loaded a
  // new build on the last bar of signal and went home could not open the app at all, with their
  // downloaded lessons sitting on the phone.
  for (const route of ['/', '/home', '/farmer', '/student']) {
    assert.ok(
      new RegExp(`'${route}'`).test(list),
      `PRECACHE_URLS must contain ${route} or the app cannot open offline`,
    );
  }

  // addAll is ATOMIC: one 404 or redirect rejects the whole precache, and the catch that follows
  // swallows it — so the farmer gets no shell AND no error. Per-URL means one bad entry costs
  // only that entry.
  assert.doesNotMatch(source, /cache\.addAll\(PRECACHE_URLS\)/);
  assert.match(source, /PRECACHE_URLS\.map\(/);
});

test('offline navigation falls back through pages that are really cached', () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');

  // caches.match returns a PROMISE, which is always truthy, so `hit || caches.match(next)` in a
  // single expression stops at the first call whether or not it resolved to anything. The fallback
  // has to be chained through .then to actually try the next candidate.
  assert.doesNotMatch(source, /cached \|\| caches\.match\('\/'\)/);
  assert.match(source, /\.then\(function \(hit\) \{ return hit \|\| caches\.match\('\/home'\); \}\)/);
});

test('status comes from real cache entries, not a persistent downloaded flag', async () => {
  const cache = new MemoryCache();
  cache.rows.set('/slide-a.png', new Response('a', { status: 200 }));
  installBrowser(cache);
  const lesson = pack([entry('/slide-a.png', 100), entry('/slide-b.png', 200)]);

  assert.equal(offlineSupported(), true);
  assert.deepEqual(await packStatus(lesson), { done: 1, total: 2, bytes: 100, totalBytes: 300 });
  assert.equal(await isPackComplete(lesson), false);
  cache.rows.set('/slide-b.png', new Response('b', { status: 200 }));
  assert.equal(await isPackComplete(lesson), true);
});

test('a resumed download fetches only the missing files and starts progress at the truth', async () => {
  const cache = new MemoryCache();
  cache.rows.set('/already.png', new Response('old', { status: 200 }));
  const fetched: string[] = [];
  installBrowser(cache, (async (input: RequestInfo | URL) => {
    fetched.push(String(input));
    return new Response('new', { status: 200 });
  }) as FetchFn);
  const lesson = pack([entry('/already.png', 10), entry('/missing.png', 20)]);
  const progress: Array<{ done: number; bytes: number }> = [];

  const result = await downloadPack(lesson, (value) => progress.push({ done: value.done, bytes: value.bytes }));

  assert.deepEqual(fetched, ['/missing.png']);
  assert.deepEqual(result, { bytes: 30, stored: 2, failed: [], cancelled: false });
  assert.deepEqual(progress[0], { done: 1, bytes: 10 });
  assert.deepEqual(progress.at(-1), { done: 2, bytes: 30 });
});

test('only an HTTP 200 is stored; empty and error responses remain resumable failures', async () => {
  const cache = new MemoryCache();
  installBrowser(cache, (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('empty')) return new Response(null, { status: 204 });
    if (url.includes('missing')) return new Response('not found', { status: 404 });
    return new Response('lesson', { status: 200 });
  }) as FetchFn);
  const lesson = pack([
    entry('/good.png', 10),
    entry('/empty.png', 20),
    entry('/missing.png', 30),
  ]);

  const result = await downloadPack(lesson);

  assert.equal(result.stored, 1);
  assert.deepEqual(result.failed.sort(), ['/empty.png', '/missing.png']);
  assert.deepEqual(cache.puts, ['/good.png']);
  assert.deepEqual(await packStatus(lesson), { done: 1, total: 3, bytes: 10, totalBytes: 60 });
});

test('Cache Storage refusal becomes an honest failed result instead of a stuck rejected promise', async () => {
  const target = new EventTarget() as EventTarget & { caches: unknown };
  target.caches = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: target });
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async () => { throw new Error('private mode'); } },
  });
  const lesson = pack([entry('/a.png', 10), entry('/b.png', 20)]);

  assert.deepEqual(await downloadPack(lesson), {
    bytes: 0,
    stored: 0,
    failed: ['/a.png', '/b.png'],
    cancelled: false,
  });
  assert.deepEqual(await packStatus(lesson), { done: 0, total: 2, bytes: 0, totalBytes: 30 });
  assert.equal(await removePack(lesson), 0);
});

test('a cache write failure reports that file and continues storing the rest', async () => {
  const cache = new MemoryCache();
  cache.putErrorFor.add('/full.png');
  installBrowser(cache, (async () => new Response('lesson', { status: 200 })) as FetchFn);
  const lesson = pack([entry('/full.png', 100), entry('/fits.png', 50)]);
  const progress: number[] = [];

  const result = await downloadPack(lesson, (value) => progress.push(value.bytes));

  assert.deepEqual(result.failed, ['/full.png']);
  assert.equal(result.stored, 1);
  assert.equal(result.bytes, 50);
  assert.equal(progress.at(-1), 50);
  assert.ok(progress.every(Number.isFinite));
});

test('whole-course progress carries forward confirmed bytes, never a failed pack total', () => {
  const source = readFileSync(new URL('../components/course/OfflineDownload.tsx', import.meta.url), 'utf8');
  assert.match(source, /base \+= r\.bytes/);
  assert.doesNotMatch(source, /base \+= p\.bytes/);
});

test('download concurrency never exceeds the weak-connection budget', async () => {
  const cache = new MemoryCache();
  let active = 0;
  let peak = 0;
  installBrowser(cache, (async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return new Response('lesson', { status: 200 });
  }) as FetchFn);
  const lesson = pack(Array.from({ length: 12 }, (_, index) => entry(`/slide-${index}.png`, 10)));

  const result = await downloadPack(lesson);

  assert.equal(result.stored, lesson.entries.length);
  assert.equal(result.failed.length, 0);
  assert.ok(peak > 1);
  assert.ok(peak <= 4);
});

test('cancelling aborts in-flight fetches and does not call queued files failures', async () => {
  const cache = new MemoryCache();
  const controller = new AbortController();
  let started = 0;
  installBrowser(cache, ((_: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    started += 1;
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  })) as FetchFn);
  const lesson = pack(Array.from({ length: 10 }, (_, index) => entry(`/slide-${index}.png`, 10)));

  const pending = downloadPack(lesson, undefined, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 0));
  controller.abort();
  const result = await pending;

  assert.equal(result.cancelled, true);
  assert.deepEqual(result.failed, []);
  assert.equal(result.stored, 0);
  assert.ok(started > 0 && started <= 4);
});

test('removing a pack keeps going after one bad cache entry and announces the shared truth', async () => {
  const cache = new MemoryCache();
  for (const url of ['/a.png', '/b.png', '/other-module.png']) {
    cache.rows.set(url, new Response(url, { status: 200 }));
  }
  cache.deleteErrorFor.add('/a.png');
  const target = installBrowser(cache);
  let events = 0;
  target.addEventListener(CACHE_CHANGED_EVENT, () => { events += 1; });

  const removed = await removePack(pack([entry('/a.png', 10), entry('/b.png', 20)]));

  assert.equal(removed, 1);
  assert.equal(cache.rows.has('/a.png'), true);
  assert.equal(cache.rows.has('/b.png'), false);
  assert.equal(cache.rows.has('/other-module.png'), true);
  assert.equal(events, 1);
});

test('invalid byte metadata and storage estimates never surface NaN or Infinity', async () => {
  const cache = new MemoryCache();
  cache.rows.set('/bad.png', new Response('lesson', { status: 200 }));
  installBrowser(cache);
  const malformed = pack([entry('/bad.png', Number.NaN)], Number.POSITIVE_INFINITY);
  assert.deepEqual(await packStatus(malformed), { done: 1, total: 1, bytes: 0, totalBytes: 0 });

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { storage: { estimate: async () => ({ usage: Number.NaN, quota: Number.POSITIVE_INFINITY }) } },
  });
  assert.deepEqual(await storageEstimate(), { usage: 0, quota: 0 });
});

test('plant art survives a deploy: unversioned cache, spared sweep, no revalidation re-download', () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');

  // The art set is tens of MB and lived in the build-named RUNTIME_CACHE, so every deploy —
  // any deploy at all — re-downloaded the lot on the farmer's airtime. The cache name is
  // hand-versioned instead: bumped only in the commit that redraws existing files.
  const artCache = source.match(/const ART_CACHE = '([^']+)'/)?.[1];
  assert.ok(artCache, 'ART_CACHE must exist');
  assert.doesNotMatch(source, /ART_CACHE\s*=\s*['"][^'"]*['"]\s*\+\s*(?:CACHE_VERSION|BUILD_ID)/);

  // Spared from the activate sweep like COURSE_CACHE. A superseded name (v1 after a bump to
  // v2) stops matching the spare-list and is swept in the field like any stale cache.
  assert.match(source, /key !== COURSE_CACHE && key !== ART_CACHE/);

  // Run the actual path regex, don't just eyeball it: `element-art|element-art-2` is an
  // ordered alternation, and only the mandatory trailing slash keeps element-art-2 from
  // being half-matched by the shorter branch.
  const rawArt = source.match(/const ART_PATH = \/(.+)\/;/)?.[1] ?? '';
  assert.ok(rawArt, 'ART_PATH must exist');
  const artRe = new RegExp(rawArt.replace(/\\\\/g, '\\'));
  for (const p of [
    '/element-art/veg_bed.png',
    '/element-art-2/lawn.png',
    '/render-assets/reference-blueprint/apple-tree-v1.png',
  ]) {
    assert.ok(artRe.test(p), `${p} must be served from the art cache`);
  }
  assert.ok(!artRe.test('/course-decks/intro/slide-1.png'), 'course files keep their own cache');

  // Cache-first with a network fill and NO stale-while-revalidate: the generic handler below
  // it would serve the cached sprite and then re-fetch the full body anyway — right for a JS
  // chunk, wasted airtime for a canopy. Freshness is the version bump's job, not a re-download.
  const artBlock = source.match(/if \(ART_PATH\.test\(url\.pathname\)\) \{([\s\S]*?)\n  \}/)?.[1] ?? '';
  assert.ok(artBlock.includes('caches.open(ART_CACHE)'), 'art requests must be answered from ART_CACHE');
  assert.ok(artBlock.includes('if (hit) return hit;'), 'a cached sprite returns with no background re-fetch');
});
