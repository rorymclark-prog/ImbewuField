import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { GET } from '@/app/api/build-info/route';

// /api/build-info is unauthenticated by design (the update banner and the build-source tooltip
// both read it signed out) and used to fork a `git` subprocess on every single request and hand
// back the server's filesystem path. This pins the fix: no repoRoot in the response, and a caller
// that will not stop gets refused rather than forking forever.

function buildInfoRequest(ip: string): NextRequest {
  return new NextRequest('http://localhost/api/build-info', { headers: { 'x-forwarded-for': ip } });
}

test('the response never carries the server filesystem path', async () => {
  const res = await GET(buildInfoRequest('203.0.113.20'));
  const body = await res.json();
  assert.equal('repoRoot' in body, false, 'repoRoot must not be in the build-info response');
  // The fields the update banner and build-source tooltip actually read must still be there.
  assert.ok('branch' in body);
  assert.ok('sha' in body);
  assert.ok('notes' in body);
  assert.ok('tour' in body);
  assert.ok('source' in body);
});

test('a caller that will not stop is rate limited, not left to fork forever', async () => {
  const ip = '203.0.113.21';
  for (let i = 0; i < 120; i++) {
    const res = await GET(buildInfoRequest(ip));
    assert.equal(res.status, 200, `request ${i + 1} should be allowed within the budget`);
  }
  const res = await GET(buildInfoRequest(ip));
  assert.equal(res.status, 429, 'the 121st request within the window must be refused');
});

test('a different address gets its own budget', async () => {
  const res = await GET(buildInfoRequest('203.0.113.220'));
  assert.equal(res.status, 200, 'a fresh address must not inherit another address\'s exhausted budget');
});
