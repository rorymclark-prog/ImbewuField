import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import { GET, buildThresholds } from '@/app/api/contours/route';
import { contourCacheKey } from '@/lib/contour-cache-key';
import { sharedLimiter } from '@/lib/api-rate-limit';

// app/api/contours/route.ts decodes a metered Mapbox terrain-RGB endpoint with no auth and no
// rate limit until this guard, and its cache keyed raw floats to 7 decimals — fine-grained enough
// that a debounced pan/zoom loop (or floating-point drift across animation frames) missed the
// cache on essentially every call. Two things pinned here: guardPaidApiRequest actually runs
// (anonymous callers are capped, not merely logged), and the cache key collapses near-duplicate
// bboxes without aliasing two different farms onto the same entry.

let originalWarn: typeof console.warn;

before(() => {
  originalWarn = console.warn;
  console.warn = () => {};
  sharedLimiter.reset();
});

after(() => {
  console.warn = originalWarn;
  sharedLimiter.reset();
});

function contoursRequest(ip: string, params = ''): NextRequest {
  return new NextRequest(`http://localhost/api/contours${params}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

test('anonymous callers are capped, not just logged', async () => {
  const ip = '203.0.113.9';
  // No bbox params: every allowed call fails fast with 400 (invalid bbox), never touching Mapbox.
  // The 'data' band gives anonymous callers 20 requests/hour — exhaust it, then the guard itself
  // must refuse the next one before the route ever re-validates params.
  for (let i = 0; i < 20; i++) {
    const res = await GET(contoursRequest(ip));
    assert.equal(res.status, 400, `request ${i + 1} should reach param validation, not be rate limited yet`);
  }
  const res = await GET(contoursRequest(ip));
  assert.equal(res.status, 429, 'the 21st request in the same hour must be refused by the rate limiter');
  const body = await res.json();
  assert.match(body.error, /wait/i);
});

test('a different address gets its own budget', async () => {
  const res = await GET(contoursRequest('203.0.113.250'));
  assert.equal(res.status, 400, 'a fresh address must not inherit another address\'s exhausted budget');
});

test('cache key collapses sub-pixel jitter but keeps distinct farms apart', () => {
  const base = contourCacheKey(30.1, -25.1, 30.1005, -25.0995, 5, 25);

  // A difference far below one DEM pixel (~9.5m at TILE_ZOOM) — the kind of floating-point drift
  // a continuous pan/zoom animation can produce between two debounce firings of "the same" view.
  const jittered = contourCacheKey(30.1 + 1e-8, -25.1 - 1e-8, 30.1005 + 1e-8, -25.0995, 5, 25);
  assert.equal(jittered, base, 'sub-pixel jitter must collapse onto the same cache entry');

  // A different, genuinely distant site (well over 11m away, the alias radius the old 4-decimal
  // key would have collapsed) must still be its own entry.
  const otherFarm = contourCacheKey(30.2, -25.1, 30.2005, -25.0995, 5, 25);
  assert.notEqual(otherFarm, base, 'two different smallholdings must not share a cache entry');

  // Different request parameters (interval/major) must not collide either.
  const otherInterval = contourCacheKey(30.1, -25.1, 30.1005, -25.0995, 10, 25);
  assert.notEqual(otherInterval, base, 'a different contour interval must not reuse another interval\'s cache entry');
});

// sec-01: a tiny, finite, positive interval (e.g. 1e-9) used to pass validation outright and let
// the threshold-building loop run (max - min) / interval times before anything capped it — an
// unauthenticated caller could run the server out of memory/CPU with one request.
test('a near-zero or absurdly large interval is rejected with 400, not accepted', async () => {
  const bbox = '?minLon=30&minLat=-25.01&maxLon=30.01&maxLat=-25';
  // '0' and non-numeric strings are not covered here: parseFloat(...) || 5 already replaces any
  // falsy parse result (0, NaN) with the default of 5 before validation ever sees it — a separate,
  // pre-existing behaviour this task does not change. Infinity survives that fallback (it's
  // truthy), which is exactly the case Number.isFinite() below exists to catch.
  for (const interval of ['1e-9', '0.0001', '-5', '150', 'Infinity', '-Infinity']) {
    const res = await GET(contoursRequest('203.0.113.50', `${bbox}&interval=${interval}`));
    assert.equal(res.status, 400, `interval=${interval} must be rejected`);
  }
});

test('an interval inside the allowed 0.5-100m range passes validation (fails later only on DEM fetch)', async () => {
  const bbox = '?minLon=30&minLat=-25.01&maxLon=30.01&maxLat=-25';
  const res = await GET(contoursRequest('203.0.113.51', `${bbox}&interval=5`));
  // No Mapbox token configured in this test environment, so the route must fail AFTER its own
  // validation (500 "Mapbox token not configured"), never with the 400 validation error.
  assert.notEqual(res.status, 400, 'a valid interval must pass this route\'s own validation');
});

test('buildThresholds stops at maxCount instead of building the full range first', () => {
  // A pathologically small interval over a normal elevation range would otherwise build millions
  // of entries before any cap was applied. The loop itself must bail out at maxCount.
  const thresholds = buildThresholds(0, 1000, 0.0001, 400);
  assert.equal(thresholds.length, 400, 'the loop must stop at maxCount, not slice afterwards');
});

test('buildThresholds returns every multiple of interval across the range when under the cap', () => {
  const thresholds = buildThresholds(10, 20, 5, 400);
  assert.deepEqual(thresholds, [10, 15, 20]);
});
