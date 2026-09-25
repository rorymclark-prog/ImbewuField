// /api/location-data was a public, unauthenticated door onto four third-party calls per
// request (NASA POWER, ISRIC, an elevation API, SANBI) — the Atlas (app/atlas) lets anyone drop
// a pin anywhere on Earth with no sign-in at all, and nothing counted how many times they did.
//
// The fix is the guard every other data-fetching route already uses: guardPaidApiRequest, which
// is log-only auth (so a signed-out Atlas visitor keeps working exactly as before) but a LIVE
// rate limit regardless — see lib/api-rate-limit.ts. This file asserts two things: the route
// actually calls the guard before doing any work (a source check, since the guard is soft-mode
// and a missing call would behave identically today), and the 'data' cost class it was given
// behaves the way the Atlas needs it to — anonymous visitors served up to the budget, refused
// with a readable message past it, and one visitor's budget never touches another's.

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guardPaidApiRequest } from '@/lib/api-auth';
import { ANONYMOUS_BUDGETS, RateLimiter, costClassFor } from '@/lib/api-rate-limit';

const ROOT = join(import.meta.dirname, '..');

let originalWarn: typeof console.warn;
before(() => { originalWarn = console.warn; console.warn = () => {}; });
after(() => { console.warn = originalWarn; });

function atlasRequest(ip: string): Request {
  return new Request(`https://example.test/api/location-data?lat=-25.7&lon=28.2`, {
    headers: { 'x-forwarded-for': ip },
  });
}

const neverVerifies: () => Promise<{ uid: string }> = async () => {
  throw new Error('no token to verify');
};

test('the route guards the request before doing any work', () => {
  const src = readFileSync(join(ROOT, 'app', 'api', 'location-data', 'route.ts'), 'utf8');
  assert.match(
    src, /guardPaidApiRequest\(\s*req,\s*['"]\/api\/location-data['"]\s*\)/,
    'GET must call guardPaidApiRequest for this exact route name',
  );
  const guardIndex = src.search(/guardPaidApiRequest\(/);
  const coordsIndex = src.search(/searchParams\.get\(['"]lat['"]\)/);
  assert.ok(guardIndex >= 0 && coordsIndex > guardIndex, 'the guard must run before the request is parsed');
  assert.match(
    src.slice(guardIndex, coordsIndex), /if\s*\(\s*auth\.response\s*\)\s*return\s*auth\.response;/,
    'a refused request must short-circuit, never fall through to the upstream fetches',
  );
});

test('location-data is counted as a data-fan-out route, like network/farmers', () => {
  assert.equal(costClassFor('/api/location-data'), 'data');
});

test('a signed-out Atlas visitor is served up to the anonymous data budget, then refused with a readable message', async () => {
  const limiter = new RateLimiter();
  const options = { limiter };
  const ip = '203.0.113.201';

  for (let i = 0; i < ANONYMOUS_BUDGETS.data.limit; i += 1) {
    const served = await guardPaidApiRequest(atlasRequest(ip), '/api/location-data', neverVerifies, options);
    assert.equal(served.response, undefined, `Atlas request ${i + 1} of ${ANONYMOUS_BUDGETS.data.limit} should be served`);
    assert.equal(served.uid, null, 'no sign-in required to use the Atlas');
  }

  const refused = await guardPaidApiRequest(atlasRequest(ip), '/api/location-data', neverVerifies, options);
  assert.ok(refused.response, 'the budget was spent — this must be refused');
  assert.equal(refused.response.status, 429);
  const body = await refused.response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0, 'the Atlas UI needs a message to show, not an empty body');
  assert.ok(Number(refused.response.headers.get('retry-after')) > 0);
});

test('one Atlas visitor exhausting the budget does not block another address', async () => {
  const limiter = new RateLimiter();
  const options = { limiter };
  for (let i = 0; i <= ANONYMOUS_BUDGETS.data.limit; i += 1) {
    await guardPaidApiRequest(atlasRequest('203.0.113.202'), '/api/location-data', neverVerifies, options);
  }
  const other = await guardPaidApiRequest(atlasRequest('203.0.113.203'), '/api/location-data', neverVerifies, options);
  assert.equal(other.response, undefined, 'a different visitor must still be able to use the Atlas');
});
