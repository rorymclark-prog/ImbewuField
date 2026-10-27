import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { APP_GUIDES } from '../lib/course-app-guides.ts';
import { STUDIES_PATHWAY_PAGES } from '../lib/studies-pathway-pack.ts';
import { errorPageCopy, isOfflineError } from '../lib/error-page-copy.ts';

// w25-03: a precached route's HTML only names the chunks it loads up front. next/dynamic chunks are
// requested by number from the webpack runtime after hydration, so offline, opening Home from a page
// that never loaded it died with ChunkLoadError. Run the shipped worker against a runtime chunk in the
// real production shape and check the lazy JS + CSS chunks reach the shell cache.
const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
const literal = source.slice(source.indexOf('const SW_SOURCE = ') + 18, source.indexOf('\nexport async function GET'));

const RUNTIME = 'a.u=function(e){return 5665===e?"static/chunks/5665-aaaa.js":"static/chunks/"+(({5370:"253d1f49"})[e]||e)+"."+({7039:"b6a8a724",5370:"accb853a"})[e]+".js"},'
  + 'h.miniCssF=function(e){return"static/css/"+({7508:"ff71e99f"})[e]+".css"}';
const bodies: Record<string, string> = {
  '/_next/static/chunks/webpack-1.js': RUNTIME,
  '/_next/static/chunks/home.js': 'a.e(5370),a.e(7039),a.e(7508),a.e(5665),a.e(9999)',
  '/_next/static/chunks/7039.b6a8a724.js': 'a.e(5370)',
  '/_next/static/chunks/5665-aaaa.js': 'x',
  '/_next/static/chunks/253d1f49.accb853a.js': 'x',
  '/_next/static/css/ff71e99f.css': 'body{}',
};

function install(failPath = '') {
  const origin = 'https://field.test';
  const buckets = new Map<string, Map<string, Response>>();
  const fetched: string[] = [];
  const listeners: Record<string, (event: any) => void> = {};
  const key = (value: any) => new URL(typeof value === 'string' ? value : value.url, origin).href;
  const html = '<html><script src="/_next/static/chunks/webpack-1.js"></script><script src="/_next/static/chunks/home.js"></script></html>';
  const fetcher = async (value: any) => {
    const path = new URL(key(value)).pathname;
    fetched.push(path);
    if (path === failPath) return new Response('missing', { status: 404 });
    if (path in bodies) return new Response(bodies[path]);
    if (path.startsWith('/_next/')) return new Response('missing', { status: 404 });
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
        keys: async () => [...rows.keys()].map(url => new Request(url)),
        delete: async (request: any) => rows.delete(key(request)),
        add: async (request: any) => { const r = await fetcher(request); if (!r.ok) throw Error('bad'); rows.set(key(request), r); },
      };
    },
    keys: async () => [...buckets.keys()],
    delete: async (name: string) => buckets.delete(name),
    match: async () => undefined,
  };
  const worker = vm.runInNewContext(literal, { BUILD_ID: 'new', APP_GUIDES, STUDIES_PATHWAY_PAGES });
  vm.runInNewContext(worker, { URL, Response, Map, Set, fetch: fetcher, caches,
    self: { location: { origin }, addEventListener: (name: string, cb: any) => { listeners[name] = cb; },
      skipWaiting: async () => {}, clients: { claim: async () => {} } },
  });
  const run = async () => {
    const work: Promise<any>[] = [];
    listeners.install({ waitUntil: (p: Promise<any>) => work.push(p) });
    await Promise.all(work);
  };
  return { run, fetched, shell: () => [...(buckets.get('imbewufield-shell-new')?.keys() ?? [])].map(u => new URL(u).pathname) };
}

test('install caches the lazy JS and CSS chunks the precached pages request after hydration', async () => {
  const w = install();
  await w.run();
  const cached = w.shell();
  for (const path of [
    '/_next/static/chunks/253d1f49.accb853a.js', // names map + hash map
    '/_next/static/chunks/7039.b6a8a724.js',     // hash map only
    '/_next/static/chunks/5665-aaaa.js',         // explicit entry
    '/_next/static/css/ff71e99f.css',            // miniCssF map
  ]) assert.ok(cached.includes(path), `${path} should be precached`);
  assert.ok(!cached.some(p => p.includes('9999')), 'an id the runtime cannot resolve is skipped, not guessed');
  assert.ok(cached.includes('/offline'), 'the install still caches every route');
});

test('a lazy chunk that cannot be fetched does not fail the install, and nothing cross-origin or RSC is pulled', async () => {
  const w = install('/_next/static/chunks/7039.b6a8a724.js');
  await w.run();
  assert.ok(w.shell().includes('/home'), '/home is still cached');
  assert.ok(!w.shell().includes('/_next/static/chunks/7039.b6a8a724.js'));
  assert.ok(w.fetched.every(p => !p.includes('_rsc')), 'no RSC payloads are requested');
  assert.match(literal, /if \(withLazy\) await cacheLazyChunks/, 'ordinary navigations must not pull lazy chunks');
});

test('chunk-load failures and an offline phone get the offline copy; other errors keep the generic one', () => {
  assert.ok(isOfflineError({ name: 'ChunkLoadError', message: '' }));
  assert.ok(isOfflineError({ message: 'Loading chunk 7039 failed.\n(error: https://x/_next/static/chunks/7039.js)' }));
  assert.ok(isOfflineError({ message: 'Loading CSS chunk 7508 failed.' }));
  assert.ok(isOfflineError({ message: 'Failed to fetch dynamically imported module: https://x/a.js' }));
  assert.equal(isOfflineError({ name: 'TypeError', message: "Cannot read properties of undefined (reading 'x')" }), false);
  for (const lang of ['en', 'zu'] as const) {
    const copy = errorPageCopy(lang);
    assert.ok(copy.offlineTitle && copy.offlineBody && copy.offlineSaved);
    assert.notEqual(copy.offlineBody, copy.errorBody);
  }
  assert.match(errorPageCopy('en').offlineBody, /isn't saved on your phone/);
  assert.match(errorPageCopy('en').offlineBody, /opened before still work/);
  assert.ok(errorPageCopy('zu').zuluDraftNotice, 'the isiZulu offline copy is covered by the unreviewed-draft notice');
});

test('error.tsx links to /offline when offline and still never prints the raw error message', () => {
  const page = readFileSync(new URL('../app/error.tsx', import.meta.url), 'utf8');
  assert.match(page, /isOfflineError\(error\)/);
  assert.match(page, /href="\/offline"/);
  assert.match(page, /copy\.tryAgain/);
  assert.doesNotMatch(page, /\{\s*error\.message\s*\}/);
});

// w25-08: offline, /farmer's site load rejects with the browser's own "Failed to fetch", and the page
// used to put that text in its alert banner. Only the page's own mismatch message is shown as written.
test('/farmer shows its own words, not the browser\'s, when a site load cannot reach the network', () => {
  const page = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /throw Error\(SITE_MISMATCH\)/);
  assert.match(page, /err instanceof Error && err\.message === SITE_MISMATCH \? err\.message : networkFailureMessage\(t\)/);
  assert.doesNotMatch(page, /setError\(err instanceof Error \? err\.message/);
});
