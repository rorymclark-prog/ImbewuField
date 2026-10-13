import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// bug-08: on a stalled connection, app/sw.js/route.ts used to let a navigation's fetch() hang
// with no limit instead of falling back to the cached page. This test runs the navigate handler's
// actual IIFE body (extracted from the shipped source, same approach as the migration-function
// tests in tests/offline-cache.test.ts) with a fetch that never settles on its own, and a fake
// setTimeout the test fires by hand — so the test proves the timeout path is taken without
// waiting out a real 4.5s delay.

const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');

test('NAVIGATION_TIMEOUT_MS exists and the navigate handler races fetch against it', () => {
  assert.match(source, /const NAVIGATION_TIMEOUT_MS = \d+;/);
  const block = source.match(/if \(request\.mode === 'navigate'\) \{([\s\S]*?)\n {2}\}\n\n {2}\/\/ Stale-while-revalidate/)?.[1];
  assert.ok(block, 'navigate block must exist');
  assert.match(block, /setTimeout\(function \(\) \{ resolve\(null\); \}, NAVIGATION_TIMEOUT_MS\)/);
  assert.match(block, /Promise\.race\(\[network, timeout\]\)/);
});

function extractNavigateIife(): string {
  const match = source.match(
    /if \(request\.mode === 'navigate'\) \{[\s\S]*?event\.respondWith\(\s*\(function \(\) \{([\s\S]*?)\n {6}\}\)\(\)\n {4}\);/,
  );
  assert.ok(match, 'navigate IIFE body must be found in app/sw.js/route.ts');
  return match[1];
}

function run(body: string, opts: {
  fetch: (req: unknown) => Promise<Response>;
  cacheHit: Response | undefined;
}) {
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const background: Promise<unknown>[] = [];
  const puts: Array<{ url: string; body: string }> = [];
  let responded: Promise<unknown> | undefined;

  const cache = {
    match: async () => opts.cacheHit,
    put: async (url: string, r: Response) => { puts.push({ url, body: await r.clone().text() }); },
  };
  const caches = {
    open: async () => cache,
    match: async () => opts.cacheHit,
  };
  const event = {
    respondWith: (p: Promise<unknown>) => { responded = p; },
    waitUntil: (p: Promise<unknown>) => { background.push(p); },
  };
  const fakeSetTimeout = (fn: () => void, ms: number) => { timers.push({ fn, ms }); return timers.length; };
  const cachePage = async (c: { put: (url: string, r: Response) => Promise<void> }, url: string, response: Response) => {
    await c.put(url, response);
  };

  const timeoutMs = Number(source.match(/const NAVIGATION_TIMEOUT_MS = (\d+);/)?.[1]);
  assert.ok(timeoutMs > 0, 'NAVIGATION_TIMEOUT_MS must be found in the source');

  const fn = new Function(
    'request', 'fetch', 'caches', 'cachePage', 'RUNTIME_CACHE', 'SHELL_CACHE', 'event', 'setTimeout',
    'NAVIGATION_TIMEOUT_MS',
    'event.respondWith((function () {' + body + '})());',
  );
  fn({ url: '/home' }, opts.fetch, caches, cachePage, 'runtime', 'shell', event, fakeSetTimeout, timeoutMs);

  return { timers, background, puts, response: () => responded };
}

test('a stalled fetch loses the race once the timeout fires, and serves the cached page', async () => {
  const body = extractNavigateIife();
  let settleNetwork: ((r: Response) => void) | null = null;
  const networkResponse = new Promise<Response>((resolve) => { settleNetwork = resolve; });
  const cached = new Response('cached shell while offline-ish');

  const { timers, puts, response } = run(body, { fetch: () => networkResponse, cacheHit: cached });
  assert.equal(timers.length, 1, 'exactly one timer must be armed for the race');
  assert.equal(timers[0].ms, Number(source.match(/const NAVIGATION_TIMEOUT_MS = (\d+);/)?.[1]));

  // Fire the timeout by hand instead of waiting the real 4.5s — the network fetch is still
  // pending at this point, same as a genuinely stalled connection.
  timers[0].fn();
  const result = await response();
  assert.equal(await (result as Response).text(), 'cached shell while offline-ish');

  // The network attempt must not be abandoned just because it lost the race — a response that
  // arrives late still needs to update the cache for the next visit.
  settleNetwork!(new Response('<html>late but real</html>', { headers: { 'content-type': 'text/html' } }));
  await new Promise((resolve) => { setTimeout(resolve, 10); });
  assert.equal(puts.length, 1, 'the late response must still be written to the cache');
  assert.equal(puts[0].body, '<html>late but real</html>');
});

test('a fetch that resolves before the timeout wins the race normally', async () => {
  const body = extractNavigateIife();
  const fresh = new Response('fresh page', { headers: { 'content-type': 'text/html' } });
  const { response } = run(body, { fetch: () => Promise.resolve(fresh), cacheHit: new Response('stale') });
  const result = await response();
  assert.equal(await (result as Response).text(), 'fresh page');
});
