import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/site-features/route';
import { sharedLimiter } from '@/lib/api-rate-limit';

// app/api/site-features/route.ts proxies OpenStreetMap Overpass with no rate limit until this
// guard. It costs this app nothing per call, but shares Overpass's upstream quota, so the band is
// generous ('poll': 200/hour anonymous) rather than the tighter 'ai'/'data' bands — a signed-out
// map user panning around must not notice it.

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

function siteFeaturesRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/site-features', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'Content-Type': 'application/json' },
    // Empty body: every allowed call fails fast with 400 (missing south/west/north/east), never
    // reaching Overpass.
    body: '{}',
  });
}

test('signed-out map users keep working within the generous anonymous budget', async () => {
  const ip = '203.0.113.10';
  for (let i = 0; i < 200; i++) {
    const res = await POST(siteFeaturesRequest(ip));
    assert.equal(res.status, 400, `request ${i + 1} should reach body validation, not be rate limited yet`);
  }
  const res = await POST(siteFeaturesRequest(ip));
  assert.equal(res.status, 429, 'the 201st request in the same hour must be refused by the rate limiter');
});

test('a different address gets its own budget', async () => {
  const res = await POST(siteFeaturesRequest('203.0.113.251'));
  assert.equal(res.status, 400, 'a fresh address must not inherit another address\'s exhausted budget');
});
