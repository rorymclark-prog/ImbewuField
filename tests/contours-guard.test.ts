import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/contours/route';
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
