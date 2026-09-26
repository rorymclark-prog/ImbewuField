import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/gate/route';

// app/api/gate/route.ts is the site-password check behind app/gate/page.tsx. Nothing in this
// codebase currently redirects a visitor to /gate — middleware.ts turned the wall off on
// 2026-07-03 — but the route stays live and reachable directly, so it is hardened rather than
// left as it was: a plain `===` password compare with no rate limit at all. This pins both fixes:
// a guesser is capped per address, and a wrong-length guess is not free to distinguish from a
// right-length one by response time alone (the two Buffer paths inside constantTimeEqual are
// exercised, even though a timing test itself would be flaky in CI).

function gateRequest(ip: string, password: string): NextRequest {
  return new NextRequest('http://localhost/api/gate', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
}

test('a guesser is capped per address, not left unlimited', async () => {
  const ip = '203.0.113.30';
  for (let i = 0; i < 10; i++) {
    const res = await POST(gateRequest(ip, `wrong-${i}`));
    assert.equal(res.status, 401, `guess ${i + 1} should be a plain wrong-password 401`);
  }
  const res = await POST(gateRequest(ip, 'wrong-11'));
  assert.equal(res.status, 429, 'the 11th guess in the window must be refused by the rate limiter');
});

test('a different address gets its own budget', async () => {
  const res = await POST(gateRequest('203.0.113.31', 'wrong'));
  assert.equal(res.status, 401, 'a fresh address must not inherit another address\'s exhausted budget');
});

test('a wrong-length guess and a right-length wrong guess are both plain 401s', async () => {
  const shortGuess = await POST(gateRequest('203.0.113.32', 'x'));
  assert.equal(shortGuess.status, 401);
  const sameLengthGuess = await POST(gateRequest('203.0.113.33', 'y'.repeat(64)));
  assert.equal(sameLengthGuess.status, 401);
});

test('with no SITE_PASSWORD configured, every guess is refused, never accidentally accepted', async () => {
  const previous = process.env.SITE_PASSWORD;
  delete process.env.SITE_PASSWORD;
  try {
    const res = await POST(gateRequest('203.0.113.34', ''));
    assert.equal(res.status, 401, 'an empty configured password must never match an empty guess');
  } finally {
    if (previous === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = previous;
  }
});
