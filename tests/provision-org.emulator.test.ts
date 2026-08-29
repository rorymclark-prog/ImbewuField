// End-to-end emulator test for scripts/provision-org.mjs and scripts/seed.mjs — the
// tenant-2-onboarding path. Runs each script as a real CLI subprocess (exactly how an operator
// invokes it) against the Firestore + Auth emulators, then reads Firestore directly with the
// Admin SDK to assert on what actually got written.
//
// Requires the Firestore AND Auth emulators running — see package.json's "test:provisioning",
// which wraps this file in `firebase emulators:exec` exactly like "test:rules" does for
// tests/firestore-rules.test.ts. Not part of `npm test`'s plain node:test run, for the same
// reason firestore-rules.test.ts isn't: no emulator there.
//
// THIS IS THE "run it twice against the emulator and diff the results" check. Two real bugs
// were found this way and are pinned here so they can't come back silently:
//   1. Re-running with --org "<same name>" must refuse (organizations doc count stays 1).
//   2. Re-running with --org-id <existing> --programme "<same name>" ALSO used to silently mint a
//      SECOND programme doc under the same org — confirmed here, fixed in provision-org.mjs, and
//      the fix is what this file actually asserts today (see 'programme re-run' below).

import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

// Force emulator hosts before importing firebase-admin — same convention as
// scripts/seed-emulator.mjs and the emulator branch added to provision-org.mjs/seed.mjs.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'fieldproof-sa';

const { initializeApp } = await import('firebase-admin/app');
const { getAuth } = await import('firebase-admin/auth');
const { getFirestore } = await import('firebase-admin/firestore');

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const PROVISION_SCRIPT = fileURLToPath(new URL('../scripts/provision-org.mjs', import.meta.url));
const SEED_SCRIPT = fileURLToPath(new URL('../scripts/seed.mjs', import.meta.url));

let app;
let auth;
let db;

before(() => {
  app = initializeApp({ projectId: PROJECT_ID }, `provision-org-test-${randomUUID()}`);
  auth = getAuth(app);
  db = getFirestore(app);
});

/** Run provision-org.mjs (or another script) as a real subprocess, exactly as an operator would. */
async function run(script, args) {
  try {
    const { stdout } = await execFileAsync('node', [script, ...args], {
      env: process.env,
      encoding: 'utf8',
    });
    return { code: 0, out: stdout };
  } catch (err) {
    return { code: typeof err.code === 'number' ? err.code : 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

const provision = (args) => run(PROVISION_SCRIPT, args);

async function makeSignedUpAccount(role, orgId = null) {
  const email = `${randomUUID()}@tenant2-test.example`;
  const user = await auth.createUser({ email, password: 'x'.repeat(8) });
  await db.collection('profiles').doc(user.uid).set({
    role, org_id: orgId, full_name: 'Test Person', language: 'en',
    id_number: null, phone: null, photo_url: null, created_at: new Date(),
  });
  return { email, uid: user.uid };
}

async function orgsNamed(name) {
  const snap = await db.collection('organizations').where('name', '==', name).get();
  return snap.docs;
}

/* ── organisation creation: idempotent, no duplicate on a second run ────── */

test('provisioning org #2 while org #1 has live data does not collide, and re-running the same create is refused (not duplicated)', async () => {
  const org1Name = `Org One ${randomUUID()}`;
  const org2Name = `Org Two ${randomUUID()}`;

  // Org #1's "live data" — a real farmer already in it, to prove org #2's provisioning run
  // cannot see or touch it.
  const org1 = await db.collection('organizations').add({ name: org1Name, kind: 'ngo', created_at: new Date() });
  const org1Farmer = await makeSignedUpAccount('farmer', org1.id);

  const create1 = await provision(['--org', org2Name, '--kind', 'ngo', '--apply']);
  assert.equal(create1.code, 0, create1.out);

  const afterFirst = await orgsNamed(org2Name);
  assert.equal(afterFirst.length, 1, 'expected exactly one org after the first create');
  const org2Id = afterFirst[0].id;
  assert.notEqual(org2Id, org1.id, 'org #2 must get its own id, not collide with org #1');

  // Run it again — literally the same command. This must refuse, not create a second org.
  const create2 = await provision(['--org', org2Name, '--kind', 'ngo', '--apply']);
  assert.equal(create2.code, 1, 'a duplicate --org name must be refused');
  assert.match(create2.out, /already exists/);

  const afterSecond = await orgsNamed(org2Name);
  assert.equal(afterSecond.length, 1, 'the second run must not have created a duplicate organisation');
  assert.equal(afterSecond[0].id, org2Id, 'the surviving org must be the one from the first run');

  // And org #1's farmer is completely untouched by any of this.
  const org1FarmerProfile = await db.collection('profiles').doc(org1Farmer.uid).get();
  assert.equal(org1FarmerProfile.data().org_id, org1.id);
});

/* ── programme creation: same dedupe guard, added by this change ────────── */

test('re-running provisioning against an EXISTING org with the same --programme name is refused, not duplicated', async () => {
  const orgName = `Programme Test Org ${randomUUID()}`;
  const progName = 'Cycle 1';

  const create = await provision(['--org', orgName, '--kind', 'ngo', '--programme', progName, '--apply']);
  assert.equal(create.code, 0, create.out);
  const [org] = await orgsNamed(orgName);
  assert.ok(org, 'org should have been created');

  const before = await db.collection('programmes').where('org_id', '==', org.id).get();
  assert.equal(before.size, 1, 'expected exactly one programme after the first run');

  // Realistic re-run: onboarding a second batch of members against the SAME org, with
  // --programme left in the copy-pasted command. This is the exact scenario that used to mint a
  // second "Cycle 1" programme doc silently.
  const rerun = await provision(['--org-id', org.id, '--programme', progName, '--apply']);
  assert.equal(rerun.code, 1, 'a duplicate programme name under the same org must be refused');
  assert.match(rerun.out, /programme named "Cycle 1" already exists/);

  const after = await db.collection('programmes').where('org_id', '==', org.id).get();
  assert.equal(after.size, 1, 'the re-run must not have created a second programme doc');

  // --force is still the deliberate escape hatch, same as organisations.
  const forced = await provision(['--org-id', org.id, '--programme', progName, '--force', '--apply']);
  assert.equal(forced.code, 0, forced.out);
  const afterForce = await db.collection('programmes').where('org_id', '==', org.id).get();
  assert.equal(afterForce.size, 2, '--force must still be able to create a second programme on purpose');
});

/* ── --attach: the farmer/student org-attach path ────────────────────────── */

test('--attach puts an org-less, self-signed-up farmer into an org', async () => {
  const orgName = `Attach Org ${randomUUID()}`;
  const create = await provision(['--org', orgName, '--kind', 'ngo', '--apply']);
  assert.equal(create.code, 0, create.out);
  const [org] = await orgsNamed(orgName);

  const farmer = await makeSignedUpAccount('farmer', null);
  const result = await provision(['--org-id', org.id, '--attach', `${farmer.email}=farmer`, '--apply']);
  assert.equal(result.code, 0, result.out);

  const profile = await db.collection('profiles').doc(farmer.uid).get();
  assert.equal(profile.data().org_id, org.id);
  assert.equal(profile.data().role, 'farmer', '--attach must never change role');
});

test('--attach is idempotent: attaching the same farmer to the same org twice is a no-op, not an error', async () => {
  const orgName = `Attach Idempotent Org ${randomUUID()}`;
  const create = await provision(['--org', orgName, '--kind', 'ngo', '--apply']);
  const [org] = await orgsNamed(orgName);
  const farmer = await makeSignedUpAccount('farmer', null);

  const first = await provision(['--org-id', org.id, '--attach', `${farmer.email}=farmer`, '--apply']);
  assert.equal(first.code, 0);
  const second = await provision(['--org-id', org.id, '--attach', `${farmer.email}=farmer`, '--apply']);
  assert.equal(second.code, 0, 'attaching to the SAME org a second time must succeed, not refuse');

  const profile = await db.collection('profiles').doc(farmer.uid).get();
  assert.equal(profile.data().org_id, org.id);
});

test('--attach refuses to move a farmer who already belongs to a DIFFERENT org, without --reassign', async () => {
  const org1Name = `Org A ${randomUUID()}`;
  const org2Name = `Org B ${randomUUID()}`;
  await provision(['--org', org1Name, '--kind', 'ngo', '--apply']);
  await provision(['--org', org2Name, '--kind', 'ngo', '--apply']);
  const [org1] = await orgsNamed(org1Name);
  const [org2] = await orgsNamed(org2Name);

  const farmer = await makeSignedUpAccount('farmer', org1.id);

  const blocked = await provision(['--org-id', org2.id, '--attach', `${farmer.email}=farmer`, '--apply']);
  assert.equal(blocked.code, 0, 'a blocked attach is a skip, not a hard failure of the whole run');
  assert.match(blocked.out, /SKIP/);
  assert.match(blocked.out, /already in org/);

  const untouchedProfile = await db.collection('profiles').doc(farmer.uid).get();
  assert.equal(untouchedProfile.data().org_id, org1.id, 'org #2 must not have pulled org #1\'s farmer out of org #1');

  // --reassign is the explicit override.
  const reassigned = await provision(['--org-id', org2.id, '--attach', `${farmer.email}=farmer`, '--reassign', '--apply']);
  assert.equal(reassigned.code, 0, reassigned.out);
  const movedProfile = await db.collection('profiles').doc(farmer.uid).get();
  assert.equal(movedProfile.data().org_id, org2.id);
});

test('--attach refuses an account with no profile yet, and a role that does not match the existing profile', async () => {
  const orgName = `Attach Edge Org ${randomUUID()}`;
  await provision(['--org', orgName, '--kind', 'ngo', '--apply']);
  const [org] = await orgsNamed(orgName);

  // Auth account exists, but signup never completed (no /profiles doc) — e.g. Google sign-in
  // started and abandoned before the profile write.
  const email = `${randomUUID()}@tenant2-test.example`;
  await auth.createUser({ email, password: 'x'.repeat(8) });
  const noProfile = await provision(['--org-id', org.id, '--attach', `${email}=farmer`, '--apply']);
  assert.equal(noProfile.code, 0);
  assert.match(noProfile.out, /no profile yet/);

  const student = await makeSignedUpAccount('student', null);
  const wrongRole = await provision(['--org-id', org.id, '--attach', `${student.email}=farmer`, '--apply']);
  assert.equal(wrongRole.code, 0);
  assert.match(wrongRole.out, /existing profile role is "student"/);
  const untouched = await db.collection('profiles').doc(student.uid).get();
  assert.equal(untouched.data().org_id, null, 'a role mismatch must not have set org_id');
});

test('--attach rejects a staff role outright (that is what --grant is for)', async () => {
  const orgName = `Attach Staff Rejection Org ${randomUUID()}`;
  const create = await provision(['--org', orgName, '--kind', 'ngo', '--apply']);
  assert.equal(create.code, 0, create.out);
  const result = await provision(['--org-id', 'irrelevant', '--attach', 'someone@example.com=ngo']);
  assert.equal(result.code, 1);
  assert.match(result.out, /--attach role must be one of/);
});

/* ── --grant: the staff path gets the same reassignment guard ────────────── */

test('--grant refuses to move a staff member who already belongs to a DIFFERENT org, without --reassign', async () => {
  const org1Name = `Staff Org A ${randomUUID()}`;
  const org2Name = `Staff Org B ${randomUUID()}`;
  await provision(['--org', org1Name, '--kind', 'ngo', '--apply']);
  await provision(['--org', org2Name, '--kind', 'ngo', '--apply']);
  const [org1] = await orgsNamed(org1Name);
  const [org2] = await orgsNamed(org2Name);

  const mentor = await makeSignedUpAccount('mentor', org1.id);

  const blocked = await provision(['--org-id', org2.id, '--grant', `${mentor.email}=mentor`, '--apply']);
  assert.equal(blocked.code, 0);
  assert.match(blocked.out, /BLOCKED/);
  const stillOrg1 = await db.collection('profiles').doc(mentor.uid).get();
  assert.equal(stillOrg1.data().org_id, org1.id);

  const reassigned = await provision(['--org-id', org2.id, '--grant', `${mentor.email}=mentor`, '--reassign', '--apply']);
  assert.equal(reassigned.code, 0, reassigned.out);
  const movedProfile = await db.collection('profiles').doc(mentor.uid).get();
  assert.equal(movedProfile.data().org_id, org2.id);
});

/* ── seed.mjs: idempotency guard on the fixed demo-org name ─────────────── */

test('seed.mjs refuses to seed a duplicate demo org, and --force is the deliberate override', async () => {
  // A fresh project namespace so this test doesn't depend on (or interfere with) whatever the
  // manual/local seed history in this emulator session looks like.
  const seedProjectId = `seed-test-${randomUUID().slice(0, 8)}`;
  const seedEnv = { ...process.env, NEXT_PUBLIC_FIREBASE_PROJECT_ID: seedProjectId };
  const seedApp = initializeApp({ projectId: seedProjectId }, `seed-test-${randomUUID()}`);
  const seedDb = getFirestore(seedApp);

  async function runSeed(args = []) {
    try {
      const { stdout } = await execFileAsync('node', [SEED_SCRIPT, ...args], { env: seedEnv, encoding: 'utf8' });
      return { code: 0, out: stdout };
    } catch (err) {
      return { code: typeof err.code === 'number' ? err.code : 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  }

  const first = await runSeed();
  assert.equal(first.code, 0, first.out);
  const afterFirst = await seedDb.collection('organizations').where('name', '==', 'ImbewuField NGO').get();
  assert.equal(afterFirst.size, 1);

  const second = await runSeed();
  assert.equal(second.code, 1, 'seeding twice must refuse, not double the demo data');
  assert.match(second.out, /already exists/);
  const afterSecond = await seedDb.collection('organizations').where('name', '==', 'ImbewuField NGO').get();
  assert.equal(afterSecond.size, 1, 'the refused second run must not have written a second org');

  const forced = await runSeed(['--force']);
  assert.equal(forced.code, 0, forced.out);
  const afterForce = await seedDb.collection('organizations').where('name', '==', 'ImbewuField NGO').get();
  assert.equal(afterForce.size, 2, '--force must still allow a deliberate second demo org');
});
