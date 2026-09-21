import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { APP_GUIDES } from '../lib/course-app-guides.ts';

// Execute the shipped worker, with no browser HTTP cache. Checking only its URL list
// missed the real first-visit failure: HTML was present but the app's scripts were not.
const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
const literal = source.slice(source.indexOf('const SW_SOURCE = ') + 18, source.indexOf('\nexport async function GET'));
function harness(failAsset = false) {
  const origin = 'https://field.test';
  const buckets = new Map<string, Map<string, Response>>();
  const listeners: Record<string, (event: any) => void> = {};
  let online = true, activated = false;
  const key = (value: any) => new URL(typeof value === 'string' ? value : value.url, origin).href;
  const html = '<html><script src="/_next/static/chunks/home.js"></script><link href="/_next/static/css/home.css" rel="stylesheet"></html>';
  const fetcher = async (value: any) => {
    if (!online) throw Error('No signal');
    const path = new URL(key(value)).pathname;
    if (failAsset && path.endsWith('home.js')) return new Response('missing', { status: 404 });
    if (path.endsWith('.js')) return new Response('window.booted = true');
    if (path.endsWith('.css')) return new Response('@font-face{src:url(../media/font.woff2)}');
    if (path.endsWith('.woff2')) return new Response('font');
    if (path.endsWith('.png') || path.endsWith('.json')) return new Response('asset');
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  };
  const caches = {
    open: async (name: string) => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const rows = buckets.get(name)!;
      return {
        match: async (request: any) => rows.get(key(request))?.clone(),
        put: async (request: any, response: Response) => { rows.set(key(request), response.clone()); },
        // Lesson migrations use the standard per-cache enumeration/deletion methods too.
        keys: async () => [...rows.keys()].map(url => new Request(url)),
        delete: async (request: any) => rows.delete(key(request)),
        add: async (request: any) => { const r = await fetcher(request); if (!r.ok) throw Error('bad'); rows.set(key(request), r); },
      };
    },
    keys: async () => [...buckets.keys()],
    delete: async (name: string) => buckets.delete(name),
    match: async (request: any) => {
      for (const rows of buckets.values()) { const r = rows.get(key(request)); if (r) return r.clone(); }
    },
  };
  const worker = vm.runInNewContext(literal, { BUILD_ID: 'new', APP_GUIDES });
  vm.runInNewContext(worker, { URL, Response, Map, Set, fetch: fetcher, caches,
    self: { location: { origin }, addEventListener: (name: string, cb: any) => { listeners[name] = cb; },
      skipWaiting: async () => { activated = true; }, clients: { claim: async () => {} } },
  });
  async function lifecycle(name: string) {
    const work: Promise<any>[] = [];
    listeners[name]({ waitUntil: (p: Promise<any>) => work.push(p) });
    await Promise.all(work);
  }
  async function request(path: string, navigate = false) {
    let response: Promise<Response> | undefined;
    const background: Promise<any>[] = [];
    listeners.fetch({ request: { url: key(path), method: 'GET', mode: navigate ? 'navigate' : 'cors' },
      respondWith: (p: Promise<Response>) => { response = p; }, waitUntil: (p: Promise<any>) => background.push(p) });
    const result = await response;
    await Promise.all(background);
    return result;
  }
  async function message(type: string, paths: string[]) {
    const work: Promise<any>[] = [], replies: any[] = [];
    listeners.message({ data: { type, paths }, ports: [{ postMessage: (value: any) => replies.push(value) }], waitUntil: (p: Promise<any>) => work.push(p) });
    await Promise.all(work);
    return replies;
  }
  return { lifecycle, request, message, caches, buckets, offline: () => { online = false; }, activated: () => activated };
}

test('a requested guide saves its page and dependencies and reopens with no network', async () => {
  const h = harness();
  await h.lifecycle('install');
  const path = APP_GUIDES[0].href;
  const result = await h.message('PREPARE_FIELD_PAGES', [path]);
  assert.ok(result.some(p => p.path === path && p.ready && !p.error));
  h.offline();
  assert.match(await (await h.request(path, true))!.text(), /home.js/);
  const shell = await h.caches.open('imbewufield-shell-new');
  await shell.delete('/_next/static/media/font.woff2');
  const incomplete = await h.message('FIELD_PAGE_STATUS', [path]);
  assert.equal(incomplete.find(p => p.path === path).ready, false, 'evicting a CSS dependency must remove readiness');
});

test('unknown guide paths are not downloaded or reported ready', async () => {
  const h = harness();
  const result = await h.message('PREPARE_FIELD_PAGES', ['/student/guides/not-a-guide']);
  assert.equal(result.filter(p => p.path).length, 0);
});

test('saved guide audio respects its revision and plays without background network work', async () => {
  const h = harness();
  const cache = await h.caches.open('imbewu-course-v1');
  await cache.put('/app-guide-audio/mapping/prepare.mp3?v=old', new Response('old recording'));
  await cache.put('/app-guide-audio/mapping/prepare.mp3?v=new', new Response('current recording'));
  await cache.put('/studies-guides/sketch-the-site.jpg', new Response('shared illustration'));
  h.offline();
  assert.equal(await (await h.request('/app-guide-audio/mapping/prepare.mp3?v=new'))!.text(), 'current recording');
  await assert.rejects(h.request('/app-guide-audio/mapping/prepare.mp3?v=unavailable'), /No signal/);
  assert.equal(await (await h.request('/studies-guides/sketch-the-site.jpg'))!.text(), 'shared illustration');
});

test('first installation can reopen home and fetch its JS, CSS and fonts without network', async () => {
  const h = harness();
  await h.lifecycle('install');
  assert.equal(h.activated(), true);
  await h.lifecycle('activate');
  h.offline();
  assert.match(await (await h.request('/home', true))!.text(), /home.js/);
  assert.match(await (await h.request('/_next/static/chunks/home.js'))!.text(), /booted/);
  assert.match(await (await h.request('/_next/static/css/home.css'))!.text(), /font-face/);
  assert.equal(await (await h.request('/_next/static/media/font.woff2'))!.text(), 'font');
});

test('a failed startup asset prevents activation and keeps the previous working shell', async () => {
  const h = harness(true);
  const old = await h.caches.open('imbewufield-shell-old');
  await old.put('/home', new Response('working previous version'));
  await assert.rejects(h.lifecycle('install'), /Startup asset unavailable/);
  assert.equal(h.activated(), false);
  assert.equal(await (await old.match('/home'))!.text(), 'working previous version');
  assert.equal(await (await h.caches.open('imbewufield-shell-new')).match('/home'), undefined);
});

test('updates preserve one old build and lesson downloads while preferring the new startup page', async () => {
  const h = harness();
  for (const name of ['imbewufield-shell-ancient', 'imbewufield-runtime-ancient', 'imbewufield-shell-old', 'imbewufield-runtime-old', 'imbewu-course-v1']) {
    const cache = await h.caches.open(name);
    await cache.put('/home', new Response(name));
  }
  await h.lifecycle('install'); await h.lifecycle('activate'); h.offline();
  assert.ok(!h.buckets.has('imbewufield-shell-ancient'));
  assert.ok(!h.buckets.has('imbewufield-runtime-ancient'));
  assert.ok(h.buckets.has('imbewufield-shell-old'));
  assert.ok(h.buckets.has('imbewufield-runtime-old'));
  assert.ok(h.buckets.has('imbewu-course-v1'));
  assert.match(await (await h.request('/unvisited', true))!.text(), /home.js/);
});
