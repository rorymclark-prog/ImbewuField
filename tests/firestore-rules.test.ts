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

// Fixtures for the cross-org leak fix (docs/AUDIT-NEEDS-RORY-2026-08-15.md #1): an ngo staff
// account in each of two orgs, a funder with a grant onto org-1 and one without, the platform
// admin role, and a farmer who has explicitly opted in via /farmer_consents.
const NGO_SAME_ORG = 'ngo-org-1';
const NGO_OTHER_ORG = 'ngo-org-2';
const FUNDER_ORG_A = 'funder-org-a';
const FUNDER_ORG_B = 'funder-org-b';
const FUNDER_WITH_GRANT = 'funder-with-grant';
const FUNDER_NO_GRANT = 'funder-no-grant';
const PLATFORM_ADMIN = 'platform-admin';
const CONSENTED_FARMER = 'farmer-consented';

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
      profile(db, NGO_SAME_ORG, 'ngo', 'org-1'),
      profile(db, NGO_OTHER_ORG, 'ngo', 'org-2'),
      profile(db, FUNDER_WITH_GRANT, 'funder', FUNDER_ORG_A),
      profile(db, FUNDER_NO_GRANT, 'funder', FUNDER_ORG_B),
      profile(db, PLATFORM_ADMIN, 'admin', null),
      // A farmer who has explicitly opted in, per scope, at /farmer_consents/{uid}. Every other
      // farmer fixture has NO consent doc at all, which the consent check treats as refusal.
      // NOTE 'expenses' is deliberately absent from the scopes map: this fixture is what proves
      // consent is per-scope rather than one global yes, so an ngo that may read this farmer's
      // harvest and sales still cannot read what they spent.
      profile(db, CONSENTED_FARMER, 'farmer', 'org-1'),
      setDoc(doc(db, 'farmer_consents', CONSENTED_FARMER), {
        uid: CONSENTED_FARMER,
        org_id: 'org-1',
        scopes: { production: true, sales: true, training: true },
        granted_at: '2026-08-01T00:00:00.000Z',
        revoked_at: null,
        updated_at: '2026-08-01T00:00:00.000Z',
      }),
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
        setDoc(doc(db, collectionName, `${CONSENTED_FARMER}-${collectionName}`), logData(CONSENTED_FARMER, 'org-1', collectionName)),
      ]),
      setDoc(doc(db, 'shared_sites', 'ABC123'), {
        code: 'ABC123',
        geojson: { type: 'FeatureCollection', features: [] },
      }),
      setDoc(doc(db, 'organizations', 'org-1'), { name: 'Org One', kind: 'ngo', created_at: '2026-08-01T00:00:00.000Z' }),
      setDoc(doc(db, 'organizations', 'org-2'), { name: 'Org Two', kind: 'ngo', created_at: '2026-08-01T00:00:00.000Z' }),
      // The one grant on file: FUNDER_ORG_A -> org-1. FUNDER_ORG_B has none.
      setDoc(doc(db, 'grants', `${FUNDER_ORG_A}_org-1`), {
        funder_org_id: FUNDER_ORG_A, ngo_org_id: 'org-1', created_at: '2026-08-01T00:00:00.000Z', created_by: PLATFORM_ADMIN,
      }),
      setDoc(doc(db, 'designs', 'design-org1'), {
        owner_id: FARMER_WITH_LINK, org_id: 'org-1', title: 'Org1 design', data: {}, shared_with: null, created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'designs', 'design-org2'), {
        owner_id: 'farmer-org2', org_id: 'org-2', title: 'Org2 design', data: {}, shared_with: null, created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'course_submissions', 'sub-consented-org1'), {
        profile_id: CONSENTED_FARMER, org_id: 'org-1', module: 'm1', submitted_at: '2026-08-01T00:00:00.000Z', self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'course_submissions', 'sub-noconsent-org1'), {
        profile_id: FARMER_WITH_LINK, org_id: 'org-1', module: 'm1', submitted_at: '2026-08-01T00:00:00.000Z', self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'course_submissions', 'sub-org2'), {
        profile_id: 'farmer-org2', org_id: 'org-2', module: 'm1', submitted_at: '2026-08-01T00:00:00.000Z', self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'course_progress', 'cp-consented-org1'), {
        profile_id: CONSENTED_FARMER, org_id: 'org-1', module: 'm1', done: true,
      }),
      setDoc(doc(db, 'course_progress', 'cp-noconsent-org1'), {
        profile_id: FARMER_WITH_LINK, org_id: 'org-1', module: 'm1', done: true,
      }),
      setDoc(doc(db, 'course_progress', 'cp-org2'), {
        profile_id: 'farmer-org2', org_id: 'org-2', module: 'm1', done: true,
      }),
      setDoc(doc(db, 'survey_responses', 'resp-org1'), {
        survey_id: 'survey-1', profile_id: FARMER_WITH_LINK, org_id: 'org-1', answers: {}, created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'survey_responses', 'resp-org2'), {
        survey_id: 'survey-2', profile_id: 'farmer-org2', org_id: 'org-2', answers: {}, created_at: '2026-08-01T00:00:00.000Z',
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

// ── Cross-org leak fix (docs/AUDIT-NEEDS-RORY-2026-08-15.md #1) ────────────────────────────────
// Below: ngo/funder staff are scoped to their own org (or a granted org, for funders), admin
// stays unconditional, and the five consent-gated collections additionally require the farmer's
// own opt-in before an org-scoped staff account can read them. Mentor access is asserted
// unaffected by consent throughout — narrowing mentor's existing same-org visibility was not
// part of this fix.

test('ngo staff can get/list same-org profiles; cross-org ngo staff cannot', async () => {
  const sameOrgDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(sameOrgDb, 'profiles', FARMER_WITH_LINK)));
  await assertSucceeds(getDocs(query(collection(sameOrgDb, 'profiles'), where('org_id', '==', 'org-1'))));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'profiles', FARMER_WITH_LINK)));
  await assertFails(getDocs(query(collection(otherOrgDb, 'profiles'), where('org_id', '==', 'org-1'))));
});

test('admin can read any profile regardless of org', async () => {
  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'profiles', FARMER_WITH_LINK)));
  await assertSucceeds(getDocs(query(collection(adminDb, 'profiles'), where('org_id', '==', 'org-2'))));
});

test('organizations: staff read their own org, cross-org staff cannot, admin reads any', async () => {
  const sameOrgDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(sameOrgDb, 'organizations', 'org-1')));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'organizations', 'org-1')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'organizations', 'org-2')));
});

test('a funder with a grant can read the granted org; a funder without one cannot', async () => {
  const grantedDb = env.authenticatedContext(FUNDER_WITH_GRANT).firestore();
  await assertSucceeds(getDoc(doc(grantedDb, 'organizations', 'org-1')));

  const ungrantedDb = env.authenticatedContext(FUNDER_NO_GRANT).firestore();
  await assertFails(getDoc(doc(ungrantedDb, 'organizations', 'org-1')));
});

test('designs: same-org staff can read, cross-org staff cannot, admin can', async () => {
  const sameOrgDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(sameOrgDb, 'designs', 'design-org1')));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'designs', 'design-org1')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'designs', 'design-org2')));
});

test('a farmer cannot spoof another org onto their own design at create time', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(setDoc(doc(db, 'designs', 'spoofed-design'), {
    owner_id: FARMER_WITH_LINK, org_id: 'org-2', title: 'Spoofed', data: {}, shared_with: null, created_at: '2026-08-01T00:00:00.000Z',
  }));
  await assertSucceeds(setDoc(doc(db, 'designs', 'honest-design'), {
    owner_id: FARMER_WITH_LINK, org_id: 'org-1', title: 'Honest', data: {}, shared_with: null, created_at: '2026-08-01T00:00:00.000Z',
  }));
});

test('course_submissions: consent gates ngo/funder staff reads but not same-org mentor', async () => {
  const staffDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(staffDb, 'course_submissions', 'sub-consented-org1')));
  await assertFails(getDoc(doc(staffDb, 'course_submissions', 'sub-noconsent-org1')));
  await assertFails(getDoc(doc(staffDb, 'course_submissions', 'sub-org2')));

  const mentorDb = env.authenticatedContext(LINKED_MENTOR).firestore();
  await assertSucceeds(getDoc(doc(mentorDb, 'course_submissions', 'sub-noconsent-org1')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'course_submissions', 'sub-org2')));
});

test('course_progress: consent gates ngo/funder staff reads but not same-org mentor', async () => {
  const staffDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(staffDb, 'course_progress', 'cp-consented-org1')));
  await assertFails(getDoc(doc(staffDb, 'course_progress', 'cp-noconsent-org1')));
  await assertFails(getDoc(doc(staffDb, 'course_progress', 'cp-org2')));

  const mentorDb = env.authenticatedContext(LINKED_MENTOR).firestore();
  await assertSucceeds(getDoc(doc(mentorDb, 'course_progress', 'cp-noconsent-org1')));
});

test('survey_responses: same-org staff reads without needing consent; cross-org denied', async () => {
  const staffDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(staffDb, 'survey_responses', 'resp-org1')));
  await assertFails(getDoc(doc(staffDb, 'survey_responses', 'resp-org2')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'survey_responses', 'resp-org2')));
});

test('financial logs: consent gates ngo/funder staff reads but not same-org mentor', async () => {
  const staffDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  const mentorDb = env.authenticatedContext(LINKED_MENTOR).firestore();
  for (const collectionName of LOG_COLLECTIONS) {
    await assertFails(getDoc(doc(staffDb, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
    await assertSucceeds(getDoc(doc(mentorDb, collectionName, `${FARMER_WITH_LINK}-${collectionName}`)));
  }
  // CONSENTED_FARMER granted production and sales but NOT expenses, so the same staff account
  // reading the same farmer in the same org is admitted to two of these three collections and
  // refused the third. If this ever passes for all three, consent has silently collapsed back
  // into one global yes/no and the per-scope toggles in ConsentPanel are decorative.
  await assertSucceeds(getDoc(doc(staffDb, 'production_logs', `${CONSENTED_FARMER}-production_logs`)));
  await assertSucceeds(getDoc(doc(staffDb, 'sales_logs', `${CONSENTED_FARMER}-sales_logs`)));
  await assertFails(getDoc(doc(staffDb, 'expense_logs', `${CONSENTED_FARMER}-expense_logs`)));
});

test('farmer_consents: only the farmer writes it; staff read it; nobody forges one', async () => {
  const farmerDb = env.authenticatedContext(CONSENTED_FARMER).firestore();
  const staffDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  const victimDb = env.authenticatedContext(FARMER_WITH_LINK).firestore();

  await assertSucceeds(getDoc(doc(farmerDb, 'farmer_consents', CONSENTED_FARMER)));
  // Staff may READ it — that is what lets a dashboard say "withheld" instead of showing an
  // empty chart that reads as a farmer who logged nothing.
  await assertSucceeds(getDoc(doc(staffDb, 'farmer_consents', CONSENTED_FARMER)));
  await assertFails(getDoc(doc(otherOrgDb, 'farmer_consents', CONSENTED_FARMER)));

  // THE ONE THAT MATTERS: staff cannot mint consent on a farmer's behalf. If this ever passes,
  // the whole opt-in is theatre — an NGO could grant itself access to every farmer it hosts.
  await assertFails(setDoc(doc(staffDb, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-1', scopes: { sales: true },
    granted_at: null, revoked_at: null, updated_at: '2026-08-02T00:00:00.000Z',
  }));
  // Nor can one farmer consent on another's behalf.
  await assertFails(setDoc(doc(victimDb, 'farmer_consents', CONSENTED_FARMER), {
    uid: CONSENTED_FARMER, org_id: 'org-1', scopes: { expenses: true },
    granted_at: null, revoked_at: null, updated_at: '2026-08-02T00:00:00.000Z',
  }));
  // A farmer may not point their consent at an org they do not belong to.
  await assertFails(setDoc(doc(victimDb, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-2', scopes: { sales: true },
    granted_at: null, revoked_at: null, updated_at: '2026-08-02T00:00:00.000Z',
  }));

  // The farmer writes their own, and can delete it outright — absence is refusal, so deletion
  // is a complete revocation rather than a doc they are stuck with.
  await assertSucceeds(setDoc(doc(victimDb, 'farmer_consents', FARMER_WITH_LINK), {
    uid: FARMER_WITH_LINK, org_id: 'org-1', scopes: { sales: true },
    granted_at: '2026-08-02T00:00:00.000Z', revoked_at: null, updated_at: '2026-08-02T00:00:00.000Z',
  }));
  await assertSucceeds(deleteDoc(doc(victimDb, 'farmer_consents', FARMER_WITH_LINK)));
});

test('grants: readable only by the two named orgs or admin, never client-writable', async () => {
  const grantedDb = env.authenticatedContext(FUNDER_WITH_GRANT).firestore();
  await assertSucceeds(getDoc(doc(grantedDb, 'grants', `${FUNDER_ORG_A}_org-1`)));

  const ungrantedDb = env.authenticatedContext(FUNDER_NO_GRANT).firestore();
  await assertFails(getDoc(doc(ungrantedDb, 'grants', `${FUNDER_ORG_A}_org-1`)));

  const ngoDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(ngoDb, 'grants', `${FUNDER_ORG_A}_org-1`)));

  await assertFails(setDoc(doc(grantedDb, 'grants', 'client-write-attempt'), {
    funder_org_id: FUNDER_ORG_A, ngo_org_id: 'org-1', created_at: '2026-08-01T00:00:00.000Z', created_by: FUNDER_WITH_GRANT,
  }));
});
