import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import type { Firestore } from 'firebase/firestore';

// This package is deliberately an optional test-only edge: the normal test manifest must stay
// runnable without a Firestore emulator. Keeping the require untyped also lets `tsc` pass in a
// checkout before the owner installs the declared devDependency.
const require = createRequire(import.meta.url);
type RulesContext = { firestore: () => Firestore };
type RulesEnvironment = {
  withSecurityRulesDisabled: (callback: (context: RulesContext) => Promise<void>) => Promise<void>;
  authenticatedContext: (uid: string) => RulesContext;
  unauthenticatedContext: () => RulesContext;
  cleanup: () => Promise<void>;
};
type RulesUnitTestingApi = {
  initializeTestEnvironment: (options: Record<string, unknown>) => Promise<RulesEnvironment>;
  assertFails: (promise: Promise<unknown>) => Promise<unknown>;
  assertSucceeds: <T>(promise: Promise<T>) => Promise<T>;
};
const {
  initializeTestEnvironment, assertFails, assertSucceeds,
} = require('@firebase/rules-unit-testing') as RulesUnitTestingApi;

// THE FIRESTORE FUNCTIONS MUST COME FROM THE SAME MODULE INSTANCE THE TEST HARNESS USES.
//
// These were imported from the ESM entry point 'firebase/firestore', which resolves to the copy
// bundled inside firebase@12. @firebase/rules-unit-testing is loaded through createRequire (CJS)
// and hands back a Firestore built by the hoisted @firebase/firestore@4.16.0 — a different
// instance of the same library. doc() then rejects it outright: "Expected first argument to doc()
// to be a CollectionReference, a DocumentReference or FirebaseFirestore", and EVERY test in this
// file failed identically, including ones that had nothing to do with the change under test.
//
// That is worth spelling out because of how it hid: this file is excluded from `npm test` (it
// needs an emulator) and no workflow ran `test:rules`, so the suite reported green while these
// seven tests could not even construct a document reference.
const {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
} = require('@firebase/firestore') as {
  collection: (...args: unknown[]) => unknown;
  doc: (...args: unknown[]) => never;
  getDoc: (...args: unknown[]) => Promise<unknown>;
  getDocs: (...args: unknown[]) => Promise<unknown>;
  setDoc: (...args: unknown[]) => Promise<unknown>;
  updateDoc: (...args: unknown[]) => Promise<unknown>;
  deleteDoc: (...args: unknown[]) => Promise<unknown>;
  query: (...args: unknown[]) => unknown;
  where: (...args: unknown[]) => unknown;
};

const PROJECT_ID = 'fieldproof-sa';
const DEFAULT_TRACK = 'permaculture-core';
const LOG_COLLECTIONS = ['production_logs', 'sales_logs', 'expense_logs'] as const;
const FARMER_WITHOUT_LINK = 'farmer-without-link';
const FARMER_WITH_LINK = 'farmer-with-link';
const LINKED_MENTOR = 'mentor-with-link';
const SELF_ASSIGNED_MENTOR = 'self-assigned-mentor';
const OUT_OF_ORG_MENTOR = 'mentor-other-org';
const NEW_SIGNUP = 'brand-new-signup';
const STAFF_IN_ORG = 'ngo-org-1';
const STAFF_OTHER_ORG = 'ngo-org-2';
const FUNDER_FUNDING_ORG1 = 'funder-funds-org-1';
const FUNDER_FUNDING_NOTHING = 'funder-funds-nothing';
// The three collections that were UNSCOPED: their read rule was a bare isStaff()/isMentor()
// that never inspected resource.data, so any staff account in any org read every farmer's
// record in the database. They carry a denormalised org_id now; these are the cases that
// would have passed before the fix and must fail after it.
const LEAKY_COLLECTIONS = ['course_progress', 'course_submissions', 'survey_responses'] as const;

let env: RulesEnvironment;

function profile(db: Firestore, uid: string, role: string, orgId: string | null) {
  return setDoc(doc(db, 'profiles', uid), {
    role, org_id: orgId, full_name: uid, language: 'en', created_at: '2026-08-01T00:00:00.000Z',
  });
}

function logData(profileId: string, orgId: string | null, collectionName: string) {
  if (collectionName === 'production_logs') {
    return { profile_id: profileId, org_id: orgId, crop: 'maize', kg: 1 };
  }
  if (collectionName === 'sales_logs') {
    return { profile_id: profileId, org_id: orgId, crop: 'maize', kg: 1, amount: 1 };
  }
  return { profile_id: profileId, org_id: orgId, item: 'seed', amount: 1 };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      profile(db, FARMER_WITHOUT_LINK, 'farmer', 'org-1'),
      profile(db, FARMER_WITH_LINK, 'farmer', 'org-1'),
      profile(db, LINKED_MENTOR, 'mentor', 'org-1'),
      // This profile represents a legacy/self-selected mentor account. The test below also
      // proves that an untrusted client cannot create the same role for a new account.
      profile(db, SELF_ASSIGNED_MENTOR, 'mentor', 'org-1'),
      // A real, admin-granted mentor belonging to a DIFFERENT org. Financial logs must be closed
      // to them entirely — this is the case org scoping exists to stop.
      profile(db, OUT_OF_ORG_MENTOR, 'mentor', 'org-2'),
      setDoc(doc(db, 'course_enrollments', `${FARMER_WITH_LINK}_${DEFAULT_TRACK}`), {
        profile_id: FARMER_WITH_LINK,
        track: DEFAULT_TRACK,
        cohort: 'Test cohort',
        status: 'active',
        enrolled_by: LINKED_MENTOR,
        org_id: 'org-1',
        enrolled_at: '2026-08-01T00:00:00.000Z',
      }),
      ...LOG_COLLECTIONS.flatMap((collectionName) => [
        setDoc(doc(db, collectionName, `${FARMER_WITHOUT_LINK}-${collectionName}`), logData(FARMER_WITHOUT_LINK, 'org-1', collectionName)),
        setDoc(doc(db, collectionName, `${FARMER_WITH_LINK}-${collectionName}`), logData(FARMER_WITH_LINK, 'org-1', collectionName)),
      ]),
      profile(db, STAFF_IN_ORG, 'ngo', 'org-1'),
      profile(db, STAFF_OTHER_ORG, 'ngo', 'org-2'),
      // A funder in its OWN org (org-3) that funds org-1 through the new multi-org key.
      setDoc(doc(db, 'profiles', FUNDER_FUNDING_ORG1), {
        role: 'funder', org_id: 'org-3', funded_org_ids: ['org-1'],
        full_name: FUNDER_FUNDING_ORG1, language: 'en', created_at: '2026-08-01T00:00:00.000Z',
      }),
      profile(db, FUNDER_FUNDING_NOTHING, 'funder', 'org-3'),
      setDoc(doc(db, 'course_progress', `${FARMER_WITH_LINK}_m1`), {
        profile_id: FARMER_WITH_LINK, org_id: 'org-1', module: 'm1', done: true, updated_at: 'x',
      }),
      setDoc(doc(db, 'course_submissions', `${FARMER_WITH_LINK}_m1`), {
        profile_id: FARMER_WITH_LINK, org_id: 'org-1', module: 'm1',
        submitted_at: '2026-08-01T00:00:00.000Z', self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'survey_responses', `${FARMER_WITH_LINK}-survey`), {
        survey_id: 's1', profile_id: FARMER_WITH_LINK, org_id: 'org-1',
        answers: { income: 'R400 a month' }, created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'farmer_consents', FARMER_WITH_LINK), {
        uid: FARMER_WITH_LINK, org_id: 'org-1', scopes: { training: true },
        granted_at: '2026-08-01T00:00:00.000Z', revoked_at: null,
        updated_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'shared_sites', 'ABC123'), {
        code: 'ABC123',
        geojson: { type: 'FeatureCollection', features: [] },
      }),
    ]);
  });
}

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules },
  });
  await seed();
});

after(async () => { await env?.cleanup(); });

// THE ATTACK THIS CLOSES. "Mentor", "NGO coordinator" and "Funder" were options in the PUBLIC
// signup dropdown, and the rules let a new account self-assign any of them. isMentor() is a bare
// role check that never inspects resource.data, and it sat in `allow read` on all three financial
// log collections and on /reports — which authorises an unfiltered collection list. So anyone who
// signed up and picked Mentor could read every farmer's crop, kilograms and rand figures, in every
// org, and `allow list` on /profiles let them put names and phone numbers against it.
test('a new signup cannot give itself an elevated role', async () => {
  // Authenticated AS the uid it is writing. The previous version of this test wrote to a different
  // document id than the uid it was authed as, so `uid == request.auth.uid` failed on its own and
  // the assertion passed no matter what the role list said — it proved nothing.
  const db = env.authenticatedContext(NEW_SIGNUP).firestore();
  const signUpAs = (role: string) => setDoc(doc(db, 'profiles', NEW_SIGNUP), {
    role, org_id: null, full_name: 'Not trusted', language: 'en',
  });

  for (const role of ['mentor', 'ngo', 'funder', 'admin']) {
    await assertFails(signUpAs(role));
  }
  // The two roles self-service signup may legitimately choose still work. Each needs its OWN uid:
  // a second write to the same profile is an UPDATE, and role is deliberately immutable there, so
  // reusing one uid would fail for the right reason and look like the wrong one.
  await assertSucceeds(signUpAs('student'));
  const farmerDb = env.authenticatedContext('brand-new-farmer').firestore();
  await assertSucceeds(setDoc(doc(farmerDb, 'profiles', 'brand-new-farmer'), {
    role: 'farmer', org_id: null, full_name: 'New farmer', language: 'en',
  }));
});

test('a mentor in another org cannot read a farmer\'s money', async () => {
  const db = env.authenticatedContext(OUT_OF_ORG_MENTOR).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertFails(getDoc(doc(db, collectionName, `${FARMER_WITHOUT_LINK}-${collectionName}`)));
  }
});

test('an org-less mentor account cannot read anyone\'s money', async () => {
  // org_id is admin-driven and can never be self-assigned, so any account that reached the mentor
  // role without an administrator has org_id null. inMyOrg() refuses to match two null orgs
  // against each other, which is what makes that account harmless.
  await env.withSecurityRulesDisabled(async (c) => {
    await profile(c.firestore(), 'mentor-no-org', 'mentor', null);
  });
  const db = env.authenticatedContext('mentor-no-org').firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertFails(getDoc(doc(db, collectionName, `${FARMER_WITHOUT_LINK}-${collectionName}`)));
  }
});

// CURRENT POLICY, stated so it is a decision rather than an accident: a mentor may read the
// financial logs of farmers in their OWN org. Narrowing this further — to only the learners they
// personally enrolled — needs a deterministic mentor-to-learner document the rules can exists()
// on, because rules cannot query. That is a data-model change, and it is flagged for Rory in
// docs/AUDIT-FARMER-MONEY-2026-08-02.md rather than guessed at here.
test('a mentor in the same org can read that farmer\'s three financial log types', async () => {
  const db = env.authenticatedContext(LINKED_MENTOR).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertSucceeds(getDoc(doc(db, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
  }
});

test('a farmer can read and write their own production, sales, and expense logs', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertSucceeds(getDoc(doc(db, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
    await assertSucceeds(setDoc(
      doc(db, collectionName, `${FARMER_WITH_LINK}-new-${collectionName}`),
      logData(FARMER_WITH_LINK, 'org-1', collectionName),
    ));
  }
});

test('a shared site is readable by exact code but its collection cannot be listed', async () => {
  const anonymous = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonymous, 'shared_sites', 'ABC123')));
  await assertFails(getDocs(collection(anonymous, 'shared_sites')));
});

test('a farmer cannot re-point their own financial row at another farmer', async () => {
  // owns() only inspects the document as it was BEFORE the write, so without pinning, this landed
  // R90 000 of imaginary income in the victim's ledger — /finances queries by profile_id.
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(updateDoc(doc(db, 'sales_logs', `${FARMER_WITH_LINK}-sales_logs`), {
    profile_id: FARMER_WITHOUT_LINK, amount: 90000,
  }));
  await assertFails(updateDoc(doc(db, 'sales_logs', `${FARMER_WITH_LINK}-sales_logs`), {
    org_id: 'org-2',
  }));
});

test('create-time validation is re-applied on update, so a negative amount cannot be saved', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(updateDoc(doc(db, 'sales_logs', `${FARMER_WITH_LINK}-sales_logs`), { amount: -90000 }));
  await assertFails(updateDoc(doc(db, 'production_logs', `${FARMER_WITH_LINK}-production_logs`), { kg: 0 }));
  // An ordinary, valid correction still works — this must not become a read-only ledger.
  await assertSucceeds(updateDoc(doc(db, 'sales_logs', `${FARMER_WITH_LINK}-sales_logs`), { amount: 250 }));
});

test('a profile owner cannot change role or org_id, but can edit an ordinary profile field', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { role: 'admin' }));
  await assertFails(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { org_id: 'org-2' }));
  await assertSucceeds(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { full_name: 'Updated name' }));
});

/* ─── ITEM D: the three collections that leaked across orgs ─────────────────── */

test('staff in another org cannot read training, submissions or survey answers', async () => {
  // BEFORE THE FIX ALL THREE OF THESE SUCCEEDED. The read rules said `isStaff() || isMentor()`
  // with no reference to the document, so one signed-up NGO account read every farmer's
  // training record and every free-text survey answer in the entire database.
  const db = env.authenticatedContext(STAFF_OTHER_ORG).firestore();
  for (const name of LEAKY_COLLECTIONS) {
    await assertFails(getDoc(doc(db, name, name === 'survey_responses'
      ? `${FARMER_WITH_LINK}-survey` : `${FARMER_WITH_LINK}_m1`)));
  }
});

test('staff in the same org still can read them — the fix must not break the dashboard', async () => {
  const db = env.authenticatedContext(STAFF_IN_ORG).firestore();
  for (const name of LEAKY_COLLECTIONS) {
    await assertSucceeds(getDoc(doc(db, name, name === 'survey_responses'
      ? `${FARMER_WITH_LINK}-survey` : `${FARMER_WITH_LINK}_m1`)));
  }
});

test('a farmer cannot stamp another org onto their own training or survey rows', async () => {
  // Without pinning org_id to the writer's own org, a farmer could appear inside any org's
  // dashboard by writing that org's id — the mirror image of the leak above.
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(setDoc(doc(db, 'course_progress', `${FARMER_WITH_LINK}_m2`), {
    profile_id: FARMER_WITH_LINK, org_id: 'org-2', module: 'm2', done: true, updated_at: 'x',
  }));
  await assertSucceeds(setDoc(doc(db, 'course_progress', `${FARMER_WITH_LINK}_m2`), {
    profile_id: FARMER_WITH_LINK, org_id: 'org-1', module: 'm2', done: true, updated_at: 'x',
  }));
});

test('staff cannot list the profiles of another org', async () => {
  // `allow list` was `isStaff() || isMentor()` — an UNFILTERED list of every profile in the
  // database, names and phone numbers included.
  const outsider = env.authenticatedContext(STAFF_OTHER_ORG).firestore();
  await assertFails(getDocs(query(
    collection(outsider, 'profiles'), where('org_id', '==', 'org-1'),
  )));
  const insider = env.authenticatedContext(STAFF_IN_ORG).firestore();
  await assertSucceeds(getDocs(query(
    collection(insider, 'profiles'), where('org_id', '==', 'org-1'),
  )));
});

/* ─── ITEM B: multi-org funders ─────────────────────────────────────────────── */

test('a funder reads the money of an org it funds, and only that org', async () => {
  const funder = env.authenticatedContext(FUNDER_FUNDING_ORG1).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertSucceeds(getDoc(doc(funder, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
  }
  // Same role, same org, no grant — funded_org_ids absent must collapse to the old
  // single-org behaviour rather than defaulting open.
  const unfunded = env.authenticatedContext(FUNDER_FUNDING_NOTHING).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertFails(getDoc(doc(unfunded, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
  }
});

test('a funder cannot grant itself an org', async () => {
  // The entire value of funded_org_ids depends on it being admin-SDK-write-only. If a client
  // can append to it, any funder account reads any org's farmer money on demand.
  const db = env.authenticatedContext(FUNDER_FUNDING_NOTHING).firestore();
  await assertFails(updateDoc(doc(db, 'profiles', FUNDER_FUNDING_NOTHING), {
    funded_org_ids: ['org-1'],
  }));
  await assertFails(updateDoc(doc(db, 'profiles', FUNDER_FUNDING_ORG1), { funded_org_ids: ['org-1', 'org-2'] }));
  // and a brand-new signup cannot smuggle it in at create time
  const fresh = env.authenticatedContext('funder-smuggler').firestore();
  await assertFails(setDoc(doc(fresh, 'profiles', 'funder-smuggler'), {
    role: 'farmer', org_id: null, funded_org_ids: ['org-1'], full_name: 'x', language: 'en',
  }));
});

/* ─── ITEM C: farmer consent ────────────────────────────────────────────────── */

test('only the farmer may write their own consent; staff may read it but never write it', async () => {
  const staff = env.authenticatedContext(STAFF_IN_ORG).firestore();
  // A consent an NGO can write on a farmer's behalf is not consent. This is the assertion
  // that makes the record worth anything.
  await assertFails(setDoc(doc(staff, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-1', scopes: { sales: true, expenses: true },
    granted_at: 'now', revoked_at: null, updated_at: 'now',
  }));
  await assertSucceeds(getDoc(doc(staff, 'farmer_consents', FARMER_WITH_LINK)));

  const outsider = env.authenticatedContext(STAFF_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(outsider, 'farmer_consents', FARMER_WITH_LINK)));

  const farmer = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertSucceeds(setDoc(doc(farmer, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-1', scopes: { sales: true },
    granted_at: 'now', revoked_at: null, updated_at: 'now',
  }));
});

test('a farmer cannot aim their consent at an org they do not belong to', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(setDoc(doc(db, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-2', scopes: { sales: true },
    granted_at: 'now', revoked_at: null, updated_at: 'now',
  }));
  // nor forge one for somebody else
  await assertFails(setDoc(doc(db, 'farmer_consents', FARMER_WITHOUT_LINK), {
    uid: FARMER_WITHOUT_LINK, org_id: 'org-1', scopes: { sales: true },
    granted_at: 'now', revoked_at: null, updated_at: 'now',
  }));
});

test('a farmer can revoke by deleting the record, and staff cannot delete it for them', async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), 'farmer_consents', FARMER_WITHOUT_LINK), {
      uid: FARMER_WITHOUT_LINK, org_id: 'org-1', scopes: { sales: true },
      granted_at: 'now', revoked_at: null, updated_at: 'now',
    });
  });
  const staff = env.authenticatedContext(STAFF_IN_ORG).firestore();
  await assertFails(deleteDoc(doc(staff, 'farmer_consents', FARMER_WITHOUT_LINK)));
  const farmer = env.authenticatedContext(FARMER_WITHOUT_LINK).firestore();
  await assertSucceeds(deleteDoc(doc(farmer, 'farmer_consents', FARMER_WITHOUT_LINK)));
});
