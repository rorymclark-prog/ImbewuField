// Opt-in integration test. Run from the checkout on Node 24 with both emulator
// ports free. This command starts and stops its own disposable Firebase project:
// env -u GOOGLE_APPLICATION_CREDENTIALS -u FIREBASE_TOKEN firebase emulators:exec --project demo-imbewu-area --only auth,firestore "FIREBASE_PROJECT_ID=demo-imbewu-area REQUIRE_API_AUTH=1 node --import ./tests/register-alias.mjs --test tests/production-area-auth.emulator.test.mjs"
//
// Invoke the real handler and token verifier. No Next server or browser is required.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test, { after, before } from 'node:test';

// ── Project and loopback safety guards before any backend imports ─────────────
const projectId = 'demo-imbewu-area';
assert.equal(process.env.FIREBASE_PROJECT_ID, projectId, 'FIREBASE_PROJECT_ID must match emulator demo project');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080', 'FIRESTORE_EMULATOR_HOST must point to 127.0.0.1:8080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'FIREBASE_AUTH_EMULATOR_HOST must point to 127.0.0.1:9099');
assert.equal(process.env.REQUIRE_API_AUTH, '1', 'REQUIRE_API_AUTH must be set to 1');
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS, undefined, 'GOOGLE_APPLICATION_CREDENTIALS must be undefined');
assert.equal(process.env.FIREBASE_TOKEN, undefined, 'FIREBASE_TOKEN must be undefined');
if (process.env.FIREBASE_CONFIG) assert.equal(JSON.parse(process.env.FIREBASE_CONFIG).projectId, projectId);

const { initializeApp, deleteApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');
const { NextRequest } = await import('next/server');
const { GET } = await import('../app/api/production-sites/route.ts');

// The handler must reuse this default app so the same explicit project ID governs
// token verification and the authorisation reads.
const app = initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const suffix = randomUUID();
const orgA = 'synthetic-a-' + suffix;
const orgB = 'synthetic-b-' + suffix;
const fundingOrg = 'synthetic-funder-' + suffix;
const privateMark = 'private-fixture-' + suffix;
const publicMark = 'published-fixture-' + suffix;

let managerToken = '';
let managerUid = '';
let funderToken = '';
const fixtureUids = [];

async function signup(role, org) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=emulator-only', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${role}-${suffix}@example.test`, password: randomUUID(), returnSecureToken: true }),
  });
  assert.equal(response.status, 200, 'local emulator auth signup succeeds');
  const { localId, idToken } = await response.json();
  assert.ok(localId, 'Auth emulator must return a fixture account ID');
  fixtureUids.push(localId);
  assert.ok(idToken, 'Auth emulator must return an ID token');
  await db.doc(`profiles/${localId}`).set({ role, org_id: org });
  return { uid: localId, token: idToken };
}

async function requestRoute(org, token, published = false) {
  const url = new URL('http://127.0.0.1/api/production-sites');
  url.searchParams.set('org', org);
  if (published) url.searchParams.set('published', 'true');
  const response = await GET(new NextRequest(url, { headers: token ? { authorization: `Bearer ${token}` } : undefined }));
  return { status: response.status, data: await response.json() };
}

before(async () => {
  const manager = await signup('ngo', orgA);
  managerUid = manager.uid;
  managerToken = manager.token;

  const funder = await signup('funder', fundingOrg);
  funderToken = funder.token;

  const fixture = (name, published) => ({
    code: name,
    name,
    published,
    observedOn: '2026-11-01',
    vegetableM2: 2,
    stapleM2: 1,
    boundaryM2: null,
    evidence: name,
    updatedBy: managerUid,
  });

  const seed = db.batch();
  seed.set(db.doc(`org_permissions/${managerUid}`), { manage: true });
  seed.set(db.doc(`organization_controls/${orgA}`), { funderAccess: true });
  seed.set(db.doc(`organization_controls/${orgB}`), { funderAccess: false });
  for (const org of [orgA, orgB]) {
    seed.set(db.doc(`grants/${org}`), { funder_org_id: fundingOrg, ngo_org_id: org });
  }
  seed.set(db.doc(`production_sites/${orgA}/sites/private`), fixture(privateMark, false));
  seed.set(db.doc(`production_sites/${orgA}/sites/public`), fixture(publicMark, true));
  seed.set(db.doc(`production_sites/${orgB}/sites/public`), fixture('disabled-org-fixture', true));
  await seed.commit();
});

after(async () => {
  try {
    const cleanup = db.batch();
    for (const uid of fixtureUids) cleanup.delete(db.doc(`profiles/${uid}`));
    if (managerUid) cleanup.delete(db.doc(`org_permissions/${managerUid}`));
    for (const org of [orgA, orgB]) {
      cleanup.delete(db.doc(`organization_controls/${org}`));
      cleanup.delete(db.doc(`grants/${org}`));
      cleanup.delete(db.doc(`production_sites/${org}/sites/public`));
    }
    cleanup.delete(db.doc(`production_sites/${orgA}/sites/private`));
    const results = await Promise.allSettled([
      cleanup.commit(), ...fixtureUids.map(uid => auth.deleteUser(uid)),
    ]);
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, 'Could not clean up synthetic fixtures');
  } finally {
    try {
      await db.terminate();
    } finally {
      await deleteApp(app);
    }
  }
});

test('unauthenticated request is rejected with 401', async () => {
  const anonymous = await requestRoute(orgA);
  assert.equal(anonymous.status, 401, 'anonymous request must return HTTP 401');
});

test('manager positive control retrieves full private and published records for own org', async () => {
  const own = await requestRoute(orgA, managerToken);
  assert.equal(own.status, 200, 'manager own org read must return HTTP 200');
  assert.equal(own.data.canManage, true, 'canManage must be true for manager');
  assert.equal(own.data.sites.length, 2, 'manager must receive all physical sites');
  assert.equal(own.data.summary.sites, 2, 'summary site count reflects both sites');
  assert.ok(own.data.sites.some((site) => site.name === privateMark), 'private site must be included for manager');
});

test('cross-org access is rejected with 403', async () => {
  const outside = await requestRoute(orgB, managerToken);
  assert.equal(outside.status, 403, 'cross-org request must return HTTP 403');
  assert.match(outside.data.error, /outside your access/, 'error message must indicate outside access');
});

test('published projection hides private rows, identifiers, and staff IDs from funder and published manager views', async () => {
  for (const response of [await requestRoute(orgA, funderToken), await requestRoute(orgA, managerToken, true)]) {
    assert.equal(response.status, 200, 'published request must return HTTP 200');
    assert.deepEqual(Object.keys(response.data), ['summary'], 'response payload must contain summary only');
    assert.equal(response.data.summary.sites, 1, 'published summary must count only published sites');
    assert.equal(response.data.summary.combinedM2, 3, 'combinedM2 matches published vegetable + staple m2');
    const encoded = JSON.stringify(response.data);
    for (const hidden of [privateMark, publicMark, managerUid]) {
      assert.ok(!encoded.includes(hidden), 'published output must omit fixture names and staff IDs');
    }
  }
});

test('funder access disabled then enabled then disabled on same grant', async () => {
  const denied = await requestRoute(orgB, funderToken);
  assert.equal(denied.status, 403, 'funder access disabled must return HTTP 403');
  assert.match(denied.data.error, /unavailable under the organisation’s permissions/);

  await db.doc(`organization_controls/${orgB}`).set({ funderAccess: true });
  const allowed = await requestRoute(orgB, funderToken);
  assert.equal(allowed.status, 200, 'same grant succeeds once funder access is enabled');
  assert.deepEqual(Object.keys(allowed.data), ['summary']);
  assert.equal(allowed.data.summary.sites, 1);

  await db.doc(`organization_controls/${orgB}`).set({ funderAccess: false });
  const reDenied = await requestRoute(orgB, funderToken);
  assert.equal(reDenied.status, 403, 'revocation is enforced immediately on fresh request');
});
