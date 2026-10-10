// sec-04: read-slip is in the guest lane (GUEST_LANE_ROUTES), so an anonymous visitor could always
// reach lowCostText before this. Pin the two guards added for it: an oversized photo is rejected
// before any AI call, and a guest whose daily allowance is already spent is turned away rather than
// getting a free read.

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/read-slip/route';
import { sharedLimiter } from '@/lib/api-rate-limit';
import { ledgerKey } from '@/lib/ai-budget';

let originalWarn: typeof console.warn;
let originalLog: typeof console.log;

before(() => {
  originalWarn = console.warn; console.warn = () => {};
  originalLog = console.log; console.log = () => {};
  sharedLimiter.reset();
});

after(() => {
  console.warn = originalWarn;
  console.log = originalLog;
  sharedLimiter.reset();
});

function slipRequest(ip: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/read-slip', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'x-imbewu-sample': '1' },
    body: JSON.stringify(body),
  });
}

test('an oversized slip photo is rejected before any AI call', async () => {
  const res = await POST(slipRequest('203.0.113.20', {
    image: { data: 'A'.repeat(3_000_001), mediaType: 'image/jpeg' },
  }));
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.match(body.error, /too large/i);
});

test('a guest whose daily AI allowance is spent cannot read another slip', async () => {
  // Spend the guest's whole R1/day pool under the key the route itself will compute, by pre-loading
  // the in-memory fallback ledger the route falls back to when Firestore has no credentials.
  const { memorySpendStore } = await import('@/lib/ai-budget');
  const key = ledgerKey({ kind: 'guest', ip: '203.0.113.21' }, new Date());
  await memorySpendStore.add(key, 1, '/api/read-slip', 'claude-haiku-4-5');
  const res = await POST(slipRequest('203.0.113.21', {
    image: { data: 'AA==', mediaType: 'image/jpeg' },
  }));
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.code, 'guest_ai_allowance_spent');
});
