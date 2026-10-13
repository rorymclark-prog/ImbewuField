// sec-08: tree-id, life-guide, area-profile, design-review and read-slip each called
// `await req.json()` with no try/catch, so a malformed body threw inside the handler and Next.js
// turned that into a bare 500 instead of a clear 400. lib/api-json-body.ts's parseJsonBody is the
// one shared fix; this pins both the helper itself and that each route actually uses it.

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import { parseJsonBody } from '@/lib/api-json-body';
import { sharedLimiter } from '@/lib/api-rate-limit';

let originalWarn: typeof console.warn;

before(() => {
  originalWarn = console.warn; console.warn = () => {};
  sharedLimiter.reset();
});

after(() => {
  console.warn = originalWarn;
  sharedLimiter.reset();
});

test('parseJsonBody: valid JSON passes through, invalid JSON returns a 400 response', async () => {
  const ok = await parseJsonBody<{ a: number }>(new Request('https://x', { method: 'POST', body: '{"a":1}' }));
  assert.equal(ok.response, undefined);
  assert.equal(ok.data!.a, 1);

  const bad = await parseJsonBody(new Request('https://x', { method: 'POST', body: '{not json' }));
  assert.equal(bad.data, undefined);
  assert.equal(bad.response!.status, 400);
  assert.match(JSON.stringify(await bad.response!.json()), /Invalid request body/);

  const empty = await parseJsonBody(new Request('https://x', { method: 'POST' }));
  assert.equal(empty.response!.status, 400);
});

const MALFORMED = '{this is not json';

const CASES: Array<{ name: string; path: string; ip: string; sample?: boolean }> = [
  { name: 'tree-id', path: '/api/tree-id', ip: '203.0.113.40' },
  { name: 'life-guide', path: '/api/life-guide', ip: '203.0.113.41', sample: true },
  { name: 'area-profile', path: '/api/area-profile', ip: '203.0.113.42', sample: true },
  { name: 'design-review', path: '/api/design-review', ip: '203.0.113.43' },
  { name: 'read-slip', path: '/api/read-slip', ip: '203.0.113.44', sample: true },
];

for (const { name, path, ip, sample } of CASES) {
  test(`${name} returns 400 (not 500) for a malformed body`, async () => {
    const mod = await import(`@/app${path}/route`);
    const headers: Record<string, string> = { 'x-forwarded-for': ip };
    if (sample) headers['x-imbewu-sample'] = '1';
    const req = new NextRequest(`http://localhost${path}`, { method: 'POST', headers, body: MALFORMED });
    const res = await mod.POST(req);
    assert.equal(res.status, 400, `${name} must answer malformed JSON with 400, not throw/500`);
  });
}
