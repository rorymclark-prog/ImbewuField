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
    return raw;
  }

  async match(value: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined> {
    const key = this.key(value);
    if (this.matchErrorFor.has(key)) throw new Error('cache read failed');
    // Cache Storage preserves search parameters unless the caller explicitly ignores them.
    // The old fake removed them even on put, hiding stale-revision bugs from these tests.
    if (options?.ignoreSearch) return [...this.rows].find(([k]) => k.split('?')[0] === key.split('?')[0])?.[1];
    return this.rows.get(key);
  }

  async put(value: RequestInfo | URL, response: Response): Promise<void> {
    const key = this.key(value);
    if (this.putErrorFor.has(key)) throw new Error('quota exceeded');
    this.puts.push(key);
    this.rows.set(key, response);
  }

  async delete(value: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean> {
    const key = this.key(value);
    if (this.deleteErrorFor.has(key)) throw new Error('cache delete failed');
    this.deletes.push(key);
    if (options?.ignoreSearch) {
      const matching = [...this.rows.keys()].filter(k => k.split('?')[0] === key.split('?')[0]);
      for (const k of matching) this.rows.delete(k);
      return matching.length > 0;
    }
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

test('a changed guide recording is downloaded instead of counting an older revision as ready', async () => {
  const cache = new MemoryCache();
  const old = '/app-guide-audio/mapping/prepare.mp3?v=old';
  const current = '/app-guide-audio/mapping/prepare.mp3?v=current';
  cache.rows.set(old, new Response('old'));
  const calls: string[] = [];
  installBrowser(cache, (async url => { calls.push(String(url)); return new Response('new'); }) as FetchFn);
  const p = pack([{ url: current, bytes: 3, kind: 'audio' }]);
  assert.equal((await packStatus(p)).done, 0);
  await downloadPack(p);
  assert.deepEqual(calls, [current]);
  assert.equal(await isPackComplete(p), true);
  await downloadPack(p);
  assert.equal(calls.length, 1, 'the matching revision must resume without spending data again');
  await removePack(p);
  assert.equal(await isPackComplete(p), false);
  assert.ok(cache.rows.has(old), 'removal is scoped to the requested version');
});

test('the paid-for course cache is stable across deploys and explicitly spared from the sweep', () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const workerCache = source.match(/const COURSE_CACHE = '([^']+)'/)?.[1];
  assert.equal(workerCache, COURSE_CACHE);
  assert.match(source, /key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== COURSE_CACHE/);
  assert.doesNotMatch(source, /COURSE_CACHE\s*=\s*['"][^'"]*['"]\s*\+\s*(?:CACHE_VERSION|BUILD_ID)/);
});

test('corrected landscape speech retires only stale saved recordings and never refetches them', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const functionSource = source.match(/async function migrateLandscapeSiteMapNarration\(\) \{[\s\S]*?\n\}/)?.[0];
  assert.ok(functionSource, 'the deployed worker must run the site-map narration migration');
  assert.match(source, /\.then\(migrateLandscapeSiteMapNarration\)/);

  const old = [
    '/course-audio/reading-landscape/en/slide-16.mp3',
    '/course-audio/reading-landscape/en/slide-18.mp3',
    '/course-audio/reading-landscape/en/full.mp3',
  ];
  const kept = [
    '/course-audio/reading-landscape/en/slide-17.mp3',
    '/course-decks/reading-landscape/en/slide-17.jpg',
    '/course-audio/soil-health/en/slide-16.mp3',
  ];
  const rows = new Map([...old, ...kept].map(path => [`https://example.test${path}`, new Response(path)]));
  const deleted: string[] = [];
  const cache = {
    match: async (path: string) => rows.get(`https://example.test${path}`),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deleted.push(new URL(request.url).pathname); return rows.delete(request.url); },
    put: async (path: string, response: Response) => { rows.set(`https://example.test${path}`, response); },
  };
  const migrate = new Function('caches', 'COURSE_CACHE', 'Response', `${functionSource}; return migrateLandscapeSiteMapNarration;`)(
    { open: async (name: string) => { assert.equal(name, COURSE_CACHE); return cache; } }, COURSE_CACHE, Response,
  ) as () => Promise<void>;

  await migrate();
  assert.deepEqual(deleted.sort(), old.sort());
  for (const path of old) assert.equal(rows.has(`https://example.test${path}`), false);
  for (const path of kept) assert.equal(rows.has(`https://example.test${path}`), true);
  await migrate();
  assert.equal(deleted.length, old.length, 'an old client must not repeatedly lose its other downloads');
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
    '/report-art/soil-layers.jpg',
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


test('the guild narration upgrade removes only obsolete guild speech, once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateGuildNarration\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'guild migration must exist before the new worker claims clients');
  assert.match(source, /then\(migrateGuildNarration\)\.then/);
  const rows = new Map<string, Response>([
    ['/course-audio/plant-guilds/en/slide-01.mp3', new Response('old guild')],
    ['/course-audio/seeds-sovereignty/en/slide-01.mp3', new Response('keep seeds')],
    ['/course-decks/plant-guilds/en/slide-01.jpg', new Response('keep image')],
  ]);
  const fakeCache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map((key) => new Request('https://example.com' + key)),
    delete: async (request: Request) => rows.delete(new URL(request.url).pathname),
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  const caches = { open: async () => fakeCache };
  await run(caches, COURSE_CACHE, Response);
  assert.equal(rows.has('/course-audio/plant-guilds/en/slide-01.mp3'), false);
  assert.equal(rows.has('/course-audio/seeds-sovereignty/en/slide-01.mp3'), true);
  assert.equal(rows.has('/course-decks/plant-guilds/en/slide-01.jpg'), true);
  rows.set('/course-audio/plant-guilds/en/slide-01.mp3', new Response('new guild'));
  await run(caches, COURSE_CACHE, Response);
  assert.equal(await rows.get('/course-audio/plant-guilds/en/slide-01.mp3')!.text(), 'new guild');
});

test('the soil-cover still upgrade removes only its replaced images, including cached query variants, once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilCoverStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'soil-cover migration must run before the new worker claims clients');
  assert.match(source, /then\(migrateSoilCoverStills\)\.then/);
  const marker = '/course-decks/soil-health/en/.soil-cover-stills-20260922';
  const rows = new Map<string, Response>([
    ['/course-decks/soil-health/en/slide-16.jpg', new Response('old 16')],
    ['/course-decks/soil-health/en/slide-16.jpg?revision=old', new Response('old 16 query')],
    ['/course-decks/soil-health/en/slide-18.jpg', new Response('old 18')],
    ['/course-decks/soil-health/en/slide-18.jpg?revision=old', new Response('old 18 query')],
    ['/course-decks/soil-health/en/slide-17.jpg', new Response('keep neighbouring still')],
    ['/course-decks/soil-health/zu/slide-16.jpg', new Response('keep isiZulu still')],
    ['/course-audio/soil-health/en/slide-16.mp3', new Response('keep narration')],
  ]);
  let deleteCalls = 0;
  const fakeCache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map((key) => new Request('https://example.com' + key)),
    delete: async (request: Request) => {
      deleteCalls += 1;
      const url = new URL(request.url);
      return rows.delete(url.pathname + url.search);
    },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  const caches = { open: async () => fakeCache };
  await run(caches, COURSE_CACHE, Response);
  for (const path of [
    '/course-decks/soil-health/en/slide-16.jpg',
    '/course-decks/soil-health/en/slide-16.jpg?revision=old',
    '/course-decks/soil-health/en/slide-18.jpg',
    '/course-decks/soil-health/en/slide-18.jpg?revision=old',
  ]) assert.equal(rows.has(path), false, `${path} needs the improved still when the learner next chooses a download`);
  assert.equal(rows.has('/course-decks/soil-health/en/slide-17.jpg'), true);
  assert.equal(rows.has('/course-decks/soil-health/zu/slide-16.jpg'), true);
  assert.equal(rows.has('/course-audio/soil-health/en/slide-16.mp3'), true);
  assert.equal(rows.has(marker), true);
  assert.equal(deleteCalls, 4);

  await run(caches, COURSE_CACHE, Response);
  assert.equal(deleteCalls, 4, 'the durable marker makes a later deploy leave a new chosen download alone');
});

test('the Soil L3 comparison still migration clears only its old English slide 14, once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilL3ComparisonStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'the comparison still migration must run before the new worker claims clients');
  assert.match(source, /then\(migrateSoilL3ComparisonStill\)\.then/);
  const marker = '/course-decks/soil-health/en/.l3-slide14-comparison-20260923';
  const old = [
    '/course-decks/soil-health/en/slide-14.jpg',
    '/course-decks/soil-health/en/slide-14.jpg?revision=old',
  ];
  const kept = [
    '/course-decks/soil-health/en/slide-13.jpg',
    '/course-decks/soil-health/en/slide-15.jpg',
    '/course-decks/soil-health/zu/slide-14.jpg',
    '/course-audio/soil-health/en/slide-14.mp3',
  ];
  const rows = new Map<string, Response>([...old, ...kept].map(path => [path, new Response(path)]));
  let deleteCalls = 0;
  const fakeCache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => {
      deleteCalls += 1;
      const url = new URL(request.url);
      return rows.delete(url.pathname + url.search);
    },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  const caches = { open: async (name: string) => { assert.equal(name, COURSE_CACHE); return fakeCache; } };
  await run(caches, COURSE_CACHE, Response);
  for (const path of old) assert.equal(rows.has(path), false, `${path} must be replaced only on a learner-chosen download`);
  for (const path of kept) assert.equal(rows.has(path), true, `${path} must remain saved offline`);
  assert.equal(rows.has(marker), true);
  assert.equal(deleteCalls, old.length);

  rows.set('/course-decks/soil-health/en/slide-14.jpg', new Response('new chosen still'));
  await run(caches, COURSE_CACHE, Response);
  assert.equal(await rows.get('/course-decks/soil-health/en/slide-14.jpg')!.text(), 'new chosen still');
  assert.equal(deleteCalls, old.length, 'the migration marker must protect a newly downloaded still on later deploys');
});
