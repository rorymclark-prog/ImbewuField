import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { requireAdmin } from '@/lib/admin-auth';

// app/api/admin/* changes role/org_id/grants via the Admin SDK — every failure mode here MUST
// hard-fail (401/403), unlike lib/api-auth.ts's guardPaidApiRequest which has a soft/log-only
// mode gated by REQUIRE_API_AUTH. requireAdmin() never reads that env var, and this suite asserts
// that directly (see the REQUIRE_API_AUTH sub-block below) alongside every other failure path, so
// a future edit that accidentally wires the paid-route cutover into the admin guard is caught
// here rather than in production.
//
// Both dependencies (token verification, profile-role lookup) are injected, so nothing here
// touches firebase-admin or the network.

let originalWarn: typeof console.warn;

before(() => {
  originalWarn = console.warn;
  console.warn = () => {};
});

after(() => {
  console.warn = originalWarn;
});

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/admin/users', { headers });
}

const throwIfCalled: () => Promise<{ uid: string }> = async () => {
  throw new Error('verifyToken must not be called when there is no bearer token to verify');
};

const neverLookedUp = async (): Promise<never> => {
  throw new Error('lookupRole must not be called when token verification already failed');
};

async function assertRejected(response: Response | undefined, status: number) {
  assert.ok(response, 'a Response must be returned so the route stops processing');
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
}

// ── Missing / malformed bearer token → 401, profile lookup never runs ─────────

test('a request with no Authorization header is rejected with 401 and never looks up a role', async () => {
  const result = await requireAdmin(requestWithHeaders({}), '/api/admin/users', throwIfCalled, neverLookedUp);
  assert.equal(result.uid, null);
  await assertRejected(result.response, 401);
});

test('a malformed Authorization header is rejected with 401', async () => {
  for (const header of ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer   ', 'just-a-token', '']) {
    const result = await requireAdmin(
      requestWithHeaders({ authorization: header }),
      '/api/admin/users',
      throwIfCalled,
      neverLookedUp,
    );
    assert.equal(result.uid, null, header);
    await assertRejected(result.response, 401);
  }
});

// ── Token verification failures → 401 ──────────────────────────────────────────

test('a verifier that throws (expired or forged token) is rejected with 401', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer bad-token' });
  const result = await requireAdmin(req, '/api/admin/users', async () => {
    throw new Error('token expired');
  }, neverLookedUp);
  assert.equal(result.uid, null);
  await assertRejected(result.response, 401);
});

test('a verifier that resolves without a uid is rejected with 401', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer weird-token' });
  const result = await requireAdmin(req, '/api/admin/users', async () => ({ uid: '' }), neverLookedUp);
  assert.equal(result.uid, null);
  await assertRejected(result.response, 401);
});

// ── Role lookup: not admin → 403, lookup throws → 401 ──────────────────────────

test('a caller with no profile (lookupRole resolves null) is rejected with 403', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer good-token' });
  const result = await requireAdmin(
    req, '/api/admin/users',
    async () => ({ uid: 'farmer-1' }),
    async () => null,
  );
  assert.equal(result.uid, null);
  await assertRejected(result.response, 403);
});

for (const role of ['farmer', 'mentor', 'student', 'ngo', 'funder'] as const) {
  test(`a caller with role '${role}' is rejected with 403`, async () => {
    const req = requestWithHeaders({ authorization: 'Bearer good-token' });
    const result = await requireAdmin(
      req, '/api/admin/users',
      async () => ({ uid: 'u-1' }),
      async () => role,
    );
    assert.equal(result.uid, null);
    await assertRejected(result.response, 403);
  });
}

test('a role lookup that throws (e.g. Firestore unreachable) is rejected with 401, not silently allowed', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer good-token' });
  const result = await requireAdmin(
    req, '/api/admin/users',
    async () => ({ uid: 'u-1' }),
    async () => { throw new Error('Firestore unreachable'); },
  );
  assert.equal(result.uid, null);
  await assertRejected(result.response, 401);
});

// ── A caller whose profile role is 'admin' passes ──────────────────────────────

test('a valid token whose profile role is admin returns the uid with no response', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer good-token' });
  const result = await requireAdmin(
    req, '/api/admin/users',
    async (token) => { assert.equal(token, 'good-token'); return { uid: 'rory' }; },
    async (uid) => { assert.equal(uid, 'rory'); return 'admin'; },
  );
  assert.deepEqual(result, { uid: 'rory' });
});

// ── requireAdmin never has a soft mode — REQUIRE_API_AUTH must not change its behaviour ────────

test('REQUIRE_API_AUTH being unset does not weaken requireAdmin (still 401 with no token)', async () => {
  const previous = process.env.REQUIRE_API_AUTH;
  delete process.env.REQUIRE_API_AUTH;
  try {
    const result = await requireAdmin(requestWithHeaders({}), '/api/admin/users', throwIfCalled, neverLookedUp);
    assert.equal(result.uid, null);
    await assertRejected(result.response, 401);
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_API_AUTH;
    else process.env.REQUIRE_API_AUTH = previous;
  }
});

test('REQUIRE_API_AUTH=1 makes no difference — a non-admin caller is still rejected', async () => {
  const previous = process.env.REQUIRE_API_AUTH;
  process.env.REQUIRE_API_AUTH = '1';
  try {
    const req = requestWithHeaders({ authorization: 'Bearer good-token' });
    const result = await requireAdmin(
      req, '/api/admin/users',
      async () => ({ uid: 'farmer-1' }),
      async () => 'farmer',
    );
    assert.equal(result.uid, null);
    await assertRejected(result.response, 403);
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_API_AUTH;
    else process.env.REQUIRE_API_AUTH = previous;
  }
});

// ── The Bearer regex behaves the same as lib/api-auth.ts's ─────────────────────

test('the Bearer scheme match is case-insensitive', async () => {
  for (const scheme of ['Bearer', 'bearer', 'BEARER', 'BeArEr']) {
    const req = requestWithHeaders({ authorization: `${scheme} tok-1` });
    const result = await requireAdmin(
      req, '/api/admin/users',
      async (token) => { assert.equal(token, 'tok-1', scheme); return { uid: 'u' }; },
      async () => 'admin',
    );
    assert.equal(result.uid, 'u', scheme);
  }
});
