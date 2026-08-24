// Firebase STORAGE rules, exercised against the real emulator — the sibling of
// tests/firestore-rules.test.ts, and excluded from `npm test` for the same reason: it needs
// services, so running it in the canonical lane would fail on every checkout. Registered instead
// through package.json's test:storage-rules script and tests/test-manifest.test.ts.
//
// WHY IT EXISTS. /photos/** was world-readable (`allow read: if true`, twice), and the rules file
// asserted that was necessary "so they show in reports/dashboards". It was not, and the cost of
// believing it was a bucket of photographs of identifiable people that anyone could walk by path
// — with the operator carrying responsible-party liability for them under POPIA.
//
// The claim these tests exist to keep honest is the one the fix rests on: photos are stored in
// Firestore as the URL getDownloadURL() returned and rendered with a plain <img src>, and that
// fetch carries a download token and never consults these rules. So the display path is checked
// here by actually fetching the URL over HTTP, not by reasoning about it — with the token, and
// again with the token stripped, because a test that only proves the first half would pass just
// as happily if the bucket were still wide open.
//
// It also pins two things that were previously unproven rather than merely unwritten:
//   * profile_photos/** matched NO rule at all, so uploadProfilePhoto() was denied by
//     default-deny on every attempt, and ProfileSheet.tsx awaits it in a try/finally with no
//     catch — the farmer got a spinner and then silence.
//   * the cross-service firestore.get() in isCourseStaffOrMentor() was carrying a comment saying
//     to treat it as unverified. It is verified now — including the org term added by 84db120 and
//     the case that makes the whole lookup safe to lean on: a signed-in account with NO profile
//     document is DENIED, because firestore.get() on a missing document fails the rule outright
//     rather than yielding a roleless object.
//
// Run with:
//   npm run test:storage-rules

import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type Ctx = { storage: () => unknown; firestore: () => unknown };
type Env = {
  withSecurityRulesDisabled: (cb: (c: Ctx) => Promise<void>) => Promise<void>;
  authenticatedContext: (uid: string) => Ctx;
  unauthenticatedContext: () => Ctx;
  cleanup: () => Promise<void>;
};
const { initializeTestEnvironment, assertFails, assertSucceeds } =
  require('@firebase/rules-unit-testing') as {
    initializeTestEnvironment: (o: Record<string, unknown>) => Promise<Env>;
    assertFails: (p: Promise<unknown>) => Promise<unknown>;
    assertSucceeds: <T>(p: Promise<T>) => Promise<T>;
  };

/* Same module-instance trap as tests/firestore-rules.test.ts: the SDK objects must come from the
   copy @firebase/rules-unit-testing itself loaded, not from the ESM 'firebase/*' entry point. */
const { ref, uploadBytes, getDownloadURL, getBytes } = require('firebase/storage');
const { doc, setDoc } = require('firebase/firestore');

const PNG = new Uint8Array([137, 80, 78, 71]);
const IMG = { contentType: 'image/png' };

let env: Env;
let alice: Ctx, mentor: Ctx, otherOrgMentor: Ctx, otherFarmer: Ctx, noProfile: Ctx, anon: Ctx;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'fieldproof-sa',
    storage: { rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 9199 },
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  // The storage rules read these through firestore.get(); seed them past the Firestore rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // org_id matters here since 84db120: isCourseStaffOrMentor(uid) now compares the reader's org
    // to the LEARNER's, so a mentor with no org — or another org — must not get through.
    await setDoc(doc(db, 'profiles/alice'), { role: 'farmer', org_id: 'org-1' });
    await setDoc(doc(db, 'profiles/mentor1'), { role: 'mentor', org_id: 'org-1' });
    await setDoc(doc(db, 'profiles/mentor2'), { role: 'mentor', org_id: 'org-2' });
    await setDoc(doc(db, 'profiles/other1'), { role: 'farmer', org_id: 'org-1' });
  });
  alice = env.authenticatedContext('alice');
  mentor = env.authenticatedContext('mentor1');
  otherOrgMentor = env.authenticatedContext('mentor2');
  otherFarmer = env.authenticatedContext('other1');
  noProfile = env.authenticatedContext('ghost');
  anon = env.unauthenticatedContext();
});

after(async () => { await env?.cleanup(); });

const at = (ctx: Ctx, path: string) => ref(ctx.storage(), path);

test('a farmer’s produce photos are readable through the SDK by that farmer alone', async () => {
  await assertSucceeds(uploadBytes(at(alice, 'photos/produce/alice/a.png'), PNG, IMG));
  await assertSucceeds(getBytes(at(alice, 'photos/produce/alice/a.png')));
  await assertFails(getBytes(at(otherFarmer, 'photos/produce/alice/a.png')));
  await assertFails(getBytes(at(anon, 'photos/produce/alice/a.png')));
});

test('the bucket cannot be walked by path any more', async () => {
  // The removed catch-all (`match /photos/{allPaths=**} { allow read: if true; }`) made ANY path
  // under /photos readable to anyone who could guess it, including paths nothing writes.
  await assertFails(getBytes(at(anon, 'photos/produce/someone-else/guess.png')));
  await assertFails(getBytes(at(anon, 'photos/anything/at/all.png')));
});

test('nobody can write into another farmer’s folder', async () => {
  await assertFails(uploadBytes(at(otherFarmer, 'photos/produce/alice/evil.png'), PNG, IMG));
  await assertFails(uploadBytes(at(anon, 'photos/produce/alice/evil.png'), PNG, IMG));
});

test('the stored download URL still renders for any viewer — the whole basis of the lock', async () => {
  await assertSucceeds(uploadBytes(at(alice, 'photos/produce/alice/shown.png'), PNG, IMG));
  const url = (await getDownloadURL(at(alice, 'photos/produce/alice/shown.png'))) as string;
  assert.match(url, /token=/, 'getDownloadURL must return a tokenised URL');

  // Exactly what <img src={photo_url}> does: an unauthenticated fetch, no SDK, no rules.
  const shown = await fetch(url);
  assert.equal(shown.status, 200, 'reports, dashboards and the community feed must keep working');

  // And the other half, without which the test above would pass on a wide-open bucket too.
  const guessed = await fetch(url.split('&token=')[0]);
  assert.equal(guessed.status, 403, 'the same path without the token must be refused');
});

test('a farmer can finally upload a profile photo, and only their own', async () => {
  // This block did not exist. profile_photos/** matched nothing, so default-deny refused every
  // upload — a silent failure, because ProfileSheet.tsx has no catch around it.
  await assertSucceeds(uploadBytes(at(alice, 'profile_photos/alice/p.png'), PNG, IMG));
  await assertFails(uploadBytes(at(otherFarmer, 'profile_photos/alice/evil.png'), PNG, IMG));
  await assertFails(getBytes(at(anon, 'profile_photos/alice/p.png')));
});

test('an upload must be an image, and must be small enough', async () => {
  await assertFails(uploadBytes(at(alice, 'photos/produce/alice/x.pdf'), PNG, { contentType: 'application/pdf' }));
  await assertFails(uploadBytes(at(alice, 'profile_photos/alice/x.pdf'), PNG, { contentType: 'application/pdf' }));
});

test('course submissions reach mentors and staff, and stop there', async () => {
  await assertSucceeds(uploadBytes(at(alice, 'course_submissions/alice/m1/e.png'), PNG, IMG));
  await assertSucceeds(getBytes(at(alice, 'course_submissions/alice/m1/e.png')));
  await assertSucceeds(getBytes(at(mentor, 'course_submissions/alice/m1/e.png')));
  // Cross-org staff are refused — the org term 84db120 added to isCourseStaffOrMentor(uid).
  await assertFails(getBytes(at(otherOrgMentor, 'course_submissions/alice/m1/e.png')));
  await assertFails(getBytes(at(otherFarmer, 'course_submissions/alice/m1/e.png')));
  await assertFails(getBytes(at(anon, 'course_submissions/alice/m1/e.png')));
  // The shape that makes the cross-service lookup safe to rely on: firestore.get() on a MISSING
  // profile fails the rule rather than returning something roleless, so an account with no
  // profile document is denied instead of falling through.
  await assertFails(getBytes(at(noProfile, 'course_submissions/alice/m1/e.png')));
});

test('render inputs and outputs stay owner-only', async () => {
  await assertSucceeds(uploadBytes(at(alice, 'renders/alice/j1/in.png'), PNG, IMG));
  await assertFails(getBytes(at(otherFarmer, 'renders/alice/j1/in.png')));
  await assertFails(getBytes(at(anon, 'renders/alice/j1/in.png')));
});
