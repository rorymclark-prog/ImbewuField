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

// ── Cross-org isolation matrix (org-isolation matrix audit, 2026-08-29) ─────────────────────────
// A second, self-contained two-org world — ORG_A and ORG_B, each with an admin-role-less staff
// account, a farmer and a mentor — built so every match block in firestore.rules can be proven,
// in one place, never to let one org read or write another's documents. This is deliberately
// SEPARATE from the org-1/org-2 fixtures above: those pin specific historical bugs to their own
// exact fixture names and are left untouched; this proves the CURRENT full ruleset holds,
// collection by collection, so multi-tenancy can be audited from one block without reconstructing
// it from two dozen scattered tests. PLATFORM_ADMIN (org_id: null, seeded above) plays admin's
// part here too — there is deliberately only one platform-admin fixture in the whole file.
const ORG_A = 'org-a';
const ORG_B = 'org-b';
const STAFF_A = 'staff-org-a';
const STAFF_B = 'staff-org-b';
const FARMER_A = 'farmer-org-a';
const FARMER_B = 'farmer-org-b';
const MENTOR_A = 'mentor-org-a';
const MENTOR_B = 'mentor-org-b';

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
      // ── Fixtures for the isAdmin gap fix (data-integrity audit, row 4): gardens (+ its members
      // subcollection), reports and surveys all read via the bare sameOrg() helper, which has no
      // admin bypass — see the isAdmin() comments on each of these four blocks in firestore.rules.
      // PLATFORM_ADMIN's own org_id is null (see its profile above), so sameOrg()'s `myOrg() !=
      // null` term is what makes it fail closed for admin specifically — no missing-field error
      // is needed to prove that part of the gap.
      setDoc(doc(db, 'gardens', 'garden-org1'), {
        programme_id: null, name: 'Org1 Garden', town: 'Test town', lat: null, lon: null,
        status: 'active', supervisor_id: FARMER_WITHOUT_LINK, org_id: 'org-1', created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'gardens', 'garden-org2'), {
        programme_id: null, name: 'Org2 Garden', town: 'Test town', lat: null, lon: null,
        status: 'active', supervisor_id: 'farmer-org2', org_id: 'org-2', created_at: '2026-08-01T00:00:00.000Z',
      }),
      // FARMER_WITH_LINK is a member of garden-org1 but NOT its supervisor — the member-exists
      // branch is the other pre-existing self-access path the isAdmin() addition must not disturb.
      setDoc(doc(db, 'gardens', 'garden-org1', 'members', FARMER_WITH_LINK), {
        garden_id: 'garden-org1', profile_id: FARMER_WITH_LINK, plot: 'A1', size_m2: 20, lat: null, lon: null,
      }),
      setDoc(doc(db, 'reports', 'report-org1'), {
        owner_id: FARMER_WITH_LINK, org_id: 'org-1', garden_id: null, title: 'Org1 report', content: 'x', lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'reports', 'report-org2'), {
        owner_id: 'farmer-org2', org_id: 'org-2', garden_id: null, title: 'Org2 report', content: 'x', lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
      }),
      // A report saved before saveReport() stamped org_id — every real report predates this fix.
      // sameOrg() cannot prove any staff account safe on this doc (the field is absent, not just
      // mismatched); only the owner's ownsField() branch and the new isAdmin() bypass can reach it.
      setDoc(doc(db, 'reports', 'report-legacy-noorg'), {
        owner_id: FARMER_WITHOUT_LINK, garden_id: null, title: 'Pre-fix report', content: 'x', lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'surveys', 'survey-org1'), {
        org_name: 'Org One', title: 'Survey 1', questions: [], created_by: NGO_SAME_ORG, org_id: 'org-1', created_at: '2026-08-01T00:00:00.000Z',
      }),
      setDoc(doc(db, 'surveys', 'survey-org2'), {
        org_name: 'Org Two', title: 'Survey 2', questions: [], created_by: NGO_OTHER_ORG, org_id: 'org-2', created_at: '2026-08-01T00:00:00.000Z',
      }),
    ]);

    // ── Cross-org isolation matrix fixtures (org-isolation matrix audit, 2026-08-29) ───────────
    // Kept as its OWN Promise.all, seeded after the array above, so the pre-existing fixtures
    // every earlier test in this file depends on are never touched by this addition. One document
    // per collection per org (A and B), covering every match block that is actually org-scoped —
    // see the 'cross-org isolation matrix: ...' tests below for which collections are and are not
    // included and why.
    await Promise.all([
      profile(db, STAFF_A, 'ngo', ORG_A),
      profile(db, STAFF_B, 'ngo', ORG_B),
      profile(db, FARMER_A, 'farmer', ORG_A),
      profile(db, FARMER_B, 'farmer', ORG_B),
      profile(db, MENTOR_A, 'mentor', ORG_A),
      profile(db, MENTOR_B, 'mentor', ORG_B),
      // Both farmers pre-consent every gated scope — this matrix proves ORG isolation, not
      // consent (CONSENTED_FARMER above already proves consent is per-scope), so a same-org
      // staff assertion below must never fail FOR THE WRONG REASON.
      setDoc(doc(db, 'farmer_consents', FARMER_A), {
        uid: FARMER_A, org_id: ORG_A, scopes: { production: true, sales: true, expenses: true, training: true },
        granted_at: '2026-08-29T00:00:00.000Z', revoked_at: null, updated_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'farmer_consents', FARMER_B), {
        uid: FARMER_B, org_id: ORG_B, scopes: { production: true, sales: true, expenses: true, training: true },
        granted_at: '2026-08-29T00:00:00.000Z', revoked_at: null, updated_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'organizations', ORG_A), { name: 'Org A', kind: 'ngo', created_at: '2026-08-29T00:00:00.000Z' }),
      setDoc(doc(db, 'organizations', ORG_B), { name: 'Org B', kind: 'ngo', created_at: '2026-08-29T00:00:00.000Z' }),
      setDoc(doc(db, 'gardens', 'garden-a'), {
        programme_id: null, name: 'Garden A', town: 'Town A', lat: null, lon: null,
        status: 'active', supervisor_id: FARMER_A, org_id: ORG_A, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'gardens', 'garden-b'), {
        programme_id: null, name: 'Garden B', town: 'Town B', lat: null, lon: null,
        status: 'active', supervisor_id: FARMER_B, org_id: ORG_B, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'gardens', 'garden-a', 'members', FARMER_A), {
        garden_id: 'garden-a', profile_id: FARMER_A, plot: 'A1', size_m2: 20, lat: null, lon: null,
      }),
      setDoc(doc(db, 'gardens', 'garden-b', 'members', FARMER_B), {
        garden_id: 'garden-b', profile_id: FARMER_B, plot: 'B1', size_m2: 20, lat: null, lon: null,
      }),
      ...LOG_COLLECTIONS.flatMap((collectionName) => [
        setDoc(doc(db, collectionName, `${FARMER_A}-${collectionName}`), logData(FARMER_A, ORG_A, collectionName)),
        setDoc(doc(db, collectionName, `${FARMER_B}-${collectionName}`), logData(FARMER_B, ORG_B, collectionName)),
      ]),
      setDoc(doc(db, 'designs', 'design-a'), {
        owner_id: FARMER_A, org_id: ORG_A, title: 'Design A', data: {}, shared_with: null, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'designs', 'design-b'), {
        owner_id: FARMER_B, org_id: ORG_B, title: 'Design B', data: {}, shared_with: null, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'reports', 'report-a'), {
        owner_id: FARMER_A, org_id: ORG_A, garden_id: null, title: 'Report A', content: 'x', lang: 'en', created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'reports', 'report-b'), {
        owner_id: FARMER_B, org_id: ORG_B, garden_id: null, title: 'Report B', content: 'x', lang: 'en', created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'surveys', 'survey-a'), {
        org_name: 'Org A', title: 'Survey A', questions: [], created_by: STAFF_A, org_id: ORG_A, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'surveys', 'survey-b'), {
        org_name: 'Org B', title: 'Survey B', questions: [], created_by: STAFF_B, org_id: ORG_B, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'survey_responses', 'resp-a'), {
        survey_id: 'survey-a', profile_id: FARMER_A, org_id: ORG_A, answers: {}, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'survey_responses', 'resp-b'), {
        survey_id: 'survey-b', profile_id: FARMER_B, org_id: ORG_B, answers: {}, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'course_progress', 'cp-a'), { profile_id: FARMER_A, org_id: ORG_A, module: 'm1', done: true }),
      setDoc(doc(db, 'course_progress', 'cp-b'), { profile_id: FARMER_B, org_id: ORG_B, module: 'm1', done: true }),
      setDoc(doc(db, 'course_enrollments', `${FARMER_A}_${DEFAULT_TRACK}`), {
        profile_id: FARMER_A, track: DEFAULT_TRACK, cohort: 'Cohort A', status: 'active',
        enrolled_by: MENTOR_A, org_id: ORG_A, enrolled_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'course_enrollments', `${FARMER_B}_${DEFAULT_TRACK}`), {
        profile_id: FARMER_B, track: DEFAULT_TRACK, cohort: 'Cohort B', status: 'active',
        enrolled_by: MENTOR_B, org_id: ORG_B, enrolled_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'course_assignments', 'assign-a'), {
        profile_id: FARMER_A, org_id: ORG_A, assigned_by: MENTOR_A, module: 'm1', due_at: null,
      }),
      setDoc(doc(db, 'course_assignments', 'assign-b'), {
        profile_id: FARMER_B, org_id: ORG_B, assigned_by: MENTOR_B, module: 'm1', due_at: null,
      }),
      setDoc(doc(db, 'course_submissions', 'sub-a'), {
        profile_id: FARMER_A, org_id: ORG_A, module: 'm1', submitted_at: '2026-08-29T00:00:00.000Z',
        self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'course_submissions', 'sub-b'), {
        profile_id: FARMER_B, org_id: ORG_B, module: 'm1', submitted_at: '2026-08-29T00:00:00.000Z',
        self_check: [], photo_path: null, voice_path: null,
      }),
      setDoc(doc(db, 'mentor_visits', 'visit-a'), {
        mentor_id: MENTOR_A, trainee_id: FARMER_A, org_id: ORG_A, garden_id: null,
        notes: 'Visit A', visited_at: '2026-08-29T00:00:00.000Z', created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'mentor_visits', 'visit-b'), {
        mentor_id: MENTOR_B, trainee_id: FARMER_B, org_id: ORG_B, garden_id: null,
        notes: 'Visit B', visited_at: '2026-08-29T00:00:00.000Z', created_at: '2026-08-29T00:00:00.000Z',
      }),
      // A pre-existing visit with no org_id at all — proves sameOrg() fails closed on a legacy
      // doc the same way reports' own legacy fixture does, while mentor/trainee self-access
      // (neither branch touches org_id) still works regardless.
      setDoc(doc(db, 'mentor_visits', 'visit-legacy-noorg'), {
        mentor_id: MENTOR_A, trainee_id: FARMER_A, garden_id: null,
        notes: 'Pre-fix visit', visited_at: '2026-08-29T00:00:00.000Z', created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'programmes', 'programme-a'), {
        org_id: ORG_A, name: 'Programme A', funder: 'Funder X', deployed_amount: 1000, created_at: '2026-08-29T00:00:00.000Z',
      }),
      setDoc(doc(db, 'programmes', 'programme-b'), {
        org_id: ORG_B, name: 'Programme B', funder: 'Funder Y', deployed_amount: 2000, created_at: '2026-08-29T00:00:00.000Z',
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

// ── isAdmin gap fix (data-integrity audit, row 4) ───────────────────────────────────────────────
// gardens, gardens/members, reports and surveys all read via the bare sameOrg() helper, which
// never had an admin bypass: sameOrg() requires isStaff() AND the caller's own org to equal the
// resource's, so PLATFORM_ADMIN (org_id: null) failed closed on every one of these four reads even
// though every OTHER staff-scoped collection in this file already carries an unconditional
// isAdmin() branch (directly, or via staffOrgAccess()/staffConsentedAccess()). These four tests
// assert the fix without loosening anything else: admin now reads across orgs, non-admin cross-org
// access is exactly as closed as before, and every pre-existing self-access path (supervisor,
// garden member, report owner, survey creator) is unaffected.

test('gardens: same-org staff and the supervisor/member can read; cross-org staff cannot; admin can', async () => {
  const sameOrgDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(sameOrgDb, 'gardens', 'garden-org1')));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'gardens', 'garden-org1')));

  // Pre-existing self-access, unaffected by isAdmin(): the supervisor, and a farmer who is a
  // member of the garden but not its supervisor.
  const supervisorDb = env.authenticatedContext(FARMER_WITHOUT_LINK).firestore();
  await assertSucceeds(getDoc(doc(supervisorDb, 'gardens', 'garden-org1')));
  const memberDb = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'gardens', 'garden-org1')));
  await assertSucceeds(getDoc(doc(memberDb, 'gardens', 'garden-org1', 'members', FARMER_WITH_LINK)));

  // THE FIX: admin's own org_id is null, so sameOrg() alone always failed closed here.
  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'gardens', 'garden-org2')));
  await assertSucceeds(getDoc(doc(adminDb, 'gardens', 'garden-org1', 'members', FARMER_WITH_LINK)));

  // Write was never gated by sameOrg() (isStaff() is bare there already, so admin write already
  // worked) — confirmed unaffected by this change, not a new capability from it.
  await assertSucceeds(setDoc(doc(adminDb, 'gardens', 'admin-written-garden'), {
    programme_id: null, name: 'Admin garden', town: null, lat: null, lon: null,
    status: 'active', supervisor_id: PLATFORM_ADMIN, org_id: 'org-2', created_at: '2026-08-01T00:00:00.000Z',
  }));
});

test('reports: owner reads their own (even a pre-org_id one); same-org staff scoped; admin reads any', async () => {
  const ownerDb = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'reports', 'report-org1')));

  const sameOrgDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(sameOrgDb, 'reports', 'report-org1')));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'reports', 'report-org1')));

  // Pre-existing self-access, unaffected: the owner of a report saved before org_id existed can
  // still read it purely via ownsField() — that branch never touches org_id at all.
  const legacyOwnerDb = env.authenticatedContext(FARMER_WITHOUT_LINK).firestore();
  await assertSucceeds(getDoc(doc(legacyOwnerDb, 'reports', 'report-legacy-noorg')));
  // A same-org staff account that is NOT the owner still cannot reach it: sameOrg() needs
  // org_id, which this legacy doc doesn't have, so this branch is exactly as closed as before.
  await assertFails(getDoc(doc(sameOrgDb, 'reports', 'report-legacy-noorg')));

  // THE FIX, twice over: admin's own org_id is null (fails sameOrg() on report-org2), AND admin
  // can now reach a report with no org_id at all — neither was possible before isAdmin() was
  // added. Both are read-only: create/update/delete stay owner-pinned, unchanged by this fix.
  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'reports', 'report-org2')));
  await assertSucceeds(getDoc(doc(adminDb, 'reports', 'report-legacy-noorg')));
  await assertFails(setDoc(doc(adminDb, 'reports', 'admin-spoofed-report'), {
    owner_id: FARMER_WITH_LINK, org_id: 'org-1', garden_id: null, title: 'x', content: null, lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
  }));
});

test('reports: a new report is stamped with the writer\'s own org_id and cannot be spoofed', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(setDoc(doc(db, 'reports', 'spoofed-report'), {
    owner_id: FARMER_WITH_LINK, org_id: 'org-2', garden_id: null, title: 'Spoofed', content: null, lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
  }));
  await assertSucceeds(setDoc(doc(db, 'reports', 'honest-report'), {
    owner_id: FARMER_WITH_LINK, org_id: 'org-1', garden_id: null, title: 'Honest', content: null, lang: 'en', created_at: '2026-08-01T00:00:00.000Z',
  }));
});

test('surveys: creator and same-org staff read; cross-org staff cannot; admin reads any', async () => {
  const creatorDb = env.authenticatedContext(NGO_SAME_ORG).firestore();
  await assertSucceeds(getDoc(doc(creatorDb, 'surveys', 'survey-org1')));

  const otherOrgDb = env.authenticatedContext(NGO_OTHER_ORG).firestore();
  await assertFails(getDoc(doc(otherOrgDb, 'surveys', 'survey-org1')));
  // Pre-existing self-access, unaffected: the creator of the other org's survey reads their own.
  await assertSucceeds(getDoc(doc(otherOrgDb, 'surveys', 'survey-org2')));

  // THE FIX: admin's own org_id is null, so sameOrg() alone always failed closed here.
  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'surveys', 'survey-org1')));
  await assertSucceeds(getDoc(doc(adminDb, 'surveys', 'survey-org2')));
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// CROSS-ORG ISOLATION MATRIX (org-isolation matrix audit, 2026-08-29)
//
// The mission: make it provable that with 100+ organisations on this platform, tenant #2 through
// #100 can never see each other. Every test below uses the ORG_A / ORG_B / STAFF_* / FARMER_* /
// MENTOR_* fixtures seeded above, plus the single shared PLATFORM_ADMIN fixture from the older
// fixture block (there is deliberately only one platform-admin account in the whole file).
//
// COVERAGE. Every `match` block in firestore.rules is accounted for somewhere in this section.
// Collections that are ORG-scoped get a live cross-org assertion below (both directions — org A
// staff/farmer/mentor cannot reach org B, AND org B cannot reach org A — proven explicitly for
// staff on every collection, and additionally for mentor/farmer wherever the collection has a
// mentor/farmer branch at all; the remainder follows from the same organisation-generic rule
// logic, since no rule in this file branches on which literal org string is "special").
// Collections that are NOT org-scoped by design — because they are per-user, capability-based, or
// a deliberately cross-org feature — are named in the last test below with a comment explaining
// why each one is out of scope for an ORG isolation matrix specifically, rather than skipped
// without a trace: saved_places, user_map_data, shared_sites, community_profiles, board_posts,
// message_threads (+ its messages subcollection), community_reports, render_jobs, render_usage.
// `grants` is a deliberate middle case, covered in its own test: it is not a leak candidate in the
// same sense as the rest (a grant's entire purpose is to be readable by BOTH orgs it names), so
// its test instead proves a THIRD, uninvolved org cannot read it.
//
// KNOWN, DELIBERATELY UNCHANGED GAPS. Three write-side gaps already catalogued in
// docs/RULES-FIX-PROPOSAL-2026-08-01.md Part 3 ("report only") are confirmed still present. They
// are NOT fixed, and NOT asserted either way, here — seeing them asserted `assertSucceeds` in an
// "isolation matrix" file would read as endorsement, and asserting `assertFails` would be a test
// that fails against the actual rules today. Each is called out in a comment at its collection's
// test instead, with a pointer to the PR description: gardens/gardens.members writes (#3), survey
// creation not pinning org_id (#7), and mentor_visits creation not verifying the named trainee_id
// belongs to the writing mentor's own org (#8, second half — the read half of #8 is this PR's fix).

test('cross-org isolation matrix: profiles', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'profiles', FARMER_A)));
  await assertFails(getDoc(doc(staffADb, 'profiles', FARMER_B)));
  await assertFails(getDocs(query(collection(staffADb, 'profiles'), where('org_id', '==', ORG_B))));
  await assertSucceeds(getDoc(doc(staffBDb, 'profiles', FARMER_B)));
  await assertFails(getDoc(doc(staffBDb, 'profiles', FARMER_A)));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'profiles', FARMER_A)));
  await assertFails(getDoc(doc(mentorADb, 'profiles', FARMER_B)));

  // A farmer is neither staff nor mentor — /profiles has no owns()-style branch for reading
  // ANOTHER profile, so a farmer reading anyone but themselves falls through entirely.
  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertSucceeds(getDoc(doc(farmerADb, 'profiles', FARMER_A)));
  await assertFails(getDoc(doc(farmerADb, 'profiles', FARMER_B)));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'profiles', FARMER_A)));
  await assertSucceeds(getDoc(doc(adminDb, 'profiles', FARMER_B)));
});

test('cross-org isolation matrix: organizations', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'organizations', ORG_A)));
  await assertFails(getDoc(doc(staffADb, 'organizations', ORG_B)));
  await assertSucceeds(getDoc(doc(staffBDb, 'organizations', ORG_B)));
  await assertFails(getDoc(doc(staffBDb, 'organizations', ORG_A)));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertSucceeds(getDoc(doc(farmerADb, 'organizations', ORG_A)));
  await assertFails(getDoc(doc(farmerADb, 'organizations', ORG_B)));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'organizations', ORG_A)));
  await assertSucceeds(getDoc(doc(adminDb, 'organizations', ORG_B)));
});

test('cross-org isolation matrix: programmes', async () => {
  // THE FIX: no staff/admin concept existed here at all before this PR — bare
  // `resource.data.org_id == myOrg()`, no isAdmin() bypass, and (unlike the inMyOrg() helper)
  // no guard against an org-less caller null==null matching an org-less programme document.
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'programmes', 'programme-a')));
  await assertFails(getDoc(doc(staffADb, 'programmes', 'programme-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'programmes', 'programme-b')));
  await assertFails(getDoc(doc(staffBDb, 'programmes', 'programme-a')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertSucceeds(getDoc(doc(farmerADb, 'programmes', 'programme-a')));
  await assertFails(getDoc(doc(farmerADb, 'programmes', 'programme-b')));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'programmes', 'programme-a')));
  await assertFails(getDoc(doc(mentorADb, 'programmes', 'programme-b')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'programmes', 'programme-a')));
  await assertSucceeds(getDoc(doc(adminDb, 'programmes', 'programme-b')));

  // No client anywhere in this app reads or writes /programmes at all (no lib/db/queries.ts
  // function touches it). Confirm the write side stays closed to everyone, admin included —
  // Admin-SDK/console-only by design, not an accident of no rule matching.
  await assertFails(setDoc(doc(adminDb, 'programmes', 'admin-written-programme'), {
    org_id: ORG_A, name: 'Spoofed', funder: null, deployed_amount: null, created_at: '2026-08-29T00:00:00.000Z',
  }));
});

test('cross-org isolation matrix: gardens and members', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'gardens', 'garden-a')));
  await assertFails(getDoc(doc(staffADb, 'gardens', 'garden-b')));
  await assertSucceeds(getDoc(doc(staffADb, 'gardens', 'garden-a', 'members', FARMER_A)));
  await assertFails(getDoc(doc(staffADb, 'gardens', 'garden-b', 'members', FARMER_B)));
  await assertSucceeds(getDoc(doc(staffBDb, 'gardens', 'garden-b')));
  await assertFails(getDoc(doc(staffBDb, 'gardens', 'garden-a')));

  // THE FIX: isMentor() was bare on both of these reads — a mentor from ANY org could read ANY
  // org's gardens and member lists (and, since a bare resource-independent OR branch authorises
  // a `list` regardless of the query's own where clause, could in principle list every garden in
  // every org directly via the SDK, not just get() by id). Now org-scoped like every other
  // mentor branch in this file.
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  const mentorBDb = env.authenticatedContext(MENTOR_B).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'gardens', 'garden-a')));
  await assertFails(getDoc(doc(mentorADb, 'gardens', 'garden-b')));
  await assertSucceeds(getDoc(doc(mentorADb, 'gardens', 'garden-a', 'members', FARMER_A)));
  await assertFails(getDoc(doc(mentorADb, 'gardens', 'garden-b', 'members', FARMER_B)));
  await assertSucceeds(getDoc(doc(mentorBDb, 'gardens', 'garden-b')));
  await assertFails(getDoc(doc(mentorBDb, 'gardens', 'garden-a')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(getDoc(doc(farmerADb, 'gardens', 'garden-b')));
  await assertFails(getDoc(doc(farmerADb, 'gardens', 'garden-b', 'members', FARMER_B)));
  // Pre-existing self-access: the supervisor and a garden member both still read their own.
  await assertSucceeds(getDoc(doc(farmerADb, 'gardens', 'garden-a')));
  await assertSucceeds(getDoc(doc(farmerADb, 'gardens', 'garden-a', 'members', FARMER_A)));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'gardens', 'garden-b')));
  await assertSucceeds(getDoc(doc(adminDb, 'gardens', 'garden-b', 'members', FARMER_B)));

  // KNOWN, DELIBERATELY UNCHANGED GAP (RULES-FIX-PROPOSAL-2026-08-01.md Part 3 #3): garden and
  // garden-member WRITES are still bare isStaff(), with no same-org requirement at all. NOT
  // fixed or asserted here (report-only backlog item; see the PR description) — only the READ
  // side is this PR's scope, matching the four collections #375 already fixed the same way.
});

test('cross-org isolation matrix: production, sales and expense logs', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  const farmerBDb = env.authenticatedContext(FARMER_B).firestore();

  for (const collectionName of LOG_COLLECTIONS) {
    const rowA = `${FARMER_A}-${collectionName}`;
    const rowB = `${FARMER_B}-${collectionName}`;

    // Same-org staff (pre-consented above) reads; cross-org staff cannot, either direction.
    await assertSucceeds(getDoc(doc(staffADb, collectionName, rowA)));
    await assertFails(getDoc(doc(staffADb, collectionName, rowB)));
    await assertSucceeds(getDoc(doc(staffBDb, collectionName, rowB)));
    await assertFails(getDoc(doc(staffBDb, collectionName, rowA)));

    // Same-org mentor reads without needing consent; cross-org mentor cannot.
    await assertSucceeds(getDoc(doc(mentorADb, collectionName, rowA)));
    await assertFails(getDoc(doc(mentorADb, collectionName, rowB)));

    // A farmer reads only their own row, whichever org either side belongs to.
    await assertFails(getDoc(doc(farmerADb, collectionName, rowB)));
    await assertFails(getDoc(doc(farmerBDb, collectionName, rowA)));

    // WRITE: owns() gates update/delete regardless of role or org, so staff/mentor of either
    // org can never write into a farmer's row at all. This is ownership isolation more than org
    // isolation, but the mission's claim is "can never read OR WRITE" — worth proving rather
    // than assumed.
    await assertFails(updateDoc(doc(staffADb, collectionName, rowB), { crop: 'hacked', item: 'hacked' }));
    await assertFails(deleteDoc(doc(mentorADb, collectionName, rowB)));
  }
});

test('cross-org isolation matrix: designs', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'designs', 'design-a')));
  await assertFails(getDoc(doc(staffADb, 'designs', 'design-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'designs', 'design-b')));
  await assertFails(getDoc(doc(staffBDb, 'designs', 'design-a')));

  // Mentors have no branch on /designs at all (ownsField/isAdmin/staffOrgAccess only) — a
  // mentor reads neither org's design unless they happen to own it themselves.
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertFails(getDoc(doc(mentorADb, 'designs', 'design-a')));
  await assertFails(getDoc(doc(mentorADb, 'designs', 'design-b')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertSucceeds(getDoc(doc(farmerADb, 'designs', 'design-a')));
  await assertFails(getDoc(doc(farmerADb, 'designs', 'design-b')));
  // A farmer cannot spoof the other org onto their own design, at create or update time.
  await assertFails(setDoc(doc(farmerADb, 'designs', 'design-a-spoof'), {
    owner_id: FARMER_A, org_id: ORG_B, title: 'Spoofed', data: {}, shared_with: null, created_at: '2026-08-29T00:00:00.000Z',
  }));
  await assertFails(updateDoc(doc(farmerADb, 'designs', 'design-a'), { org_id: ORG_B }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'designs', 'design-a')));
  await assertSucceeds(getDoc(doc(adminDb, 'designs', 'design-b')));
});

test('cross-org isolation matrix: reports', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'reports', 'report-a')));
  await assertFails(getDoc(doc(staffADb, 'reports', 'report-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'reports', 'report-b')));
  await assertFails(getDoc(doc(staffBDb, 'reports', 'report-a')));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'reports', 'report-a')));
  await assertFails(getDoc(doc(mentorADb, 'reports', 'report-b')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertSucceeds(getDoc(doc(farmerADb, 'reports', 'report-a')));
  await assertFails(getDoc(doc(farmerADb, 'reports', 'report-b')));
  await assertFails(setDoc(doc(farmerADb, 'reports', 'report-a-spoof'), {
    owner_id: FARMER_A, org_id: ORG_B, garden_id: null, title: 'Spoofed', content: 'x', lang: 'en', created_at: '2026-08-29T00:00:00.000Z',
  }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'reports', 'report-a')));
  await assertSucceeds(getDoc(doc(adminDb, 'reports', 'report-b')));
});

test('cross-org isolation matrix: surveys and survey_responses', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'surveys', 'survey-a')));
  await assertFails(getDoc(doc(staffADb, 'surveys', 'survey-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'surveys', 'survey-b')));
  await assertFails(getDoc(doc(staffBDb, 'surveys', 'survey-a')));
  await assertSucceeds(getDoc(doc(staffADb, 'survey_responses', 'resp-a')));
  await assertFails(getDoc(doc(staffADb, 'survey_responses', 'resp-b')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(getDoc(doc(farmerADb, 'surveys', 'survey-b')));
  await assertFails(getDoc(doc(farmerADb, 'survey_responses', 'resp-b')));
  await assertFails(setDoc(doc(farmerADb, 'survey_responses', 'resp-a-spoof'), {
    survey_id: 'survey-b', profile_id: FARMER_A, org_id: ORG_B, answers: {}, created_at: '2026-08-29T00:00:00.000Z',
  }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'surveys', 'survey-b')));
  await assertSucceeds(getDoc(doc(adminDb, 'survey_responses', 'resp-b')));

  // Cross-organisation survey creation is now refused; covered below with the MEL access tests.
});

test('cross-org isolation matrix: course_progress', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'course_progress', 'cp-a')));
  await assertFails(getDoc(doc(staffADb, 'course_progress', 'cp-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'course_progress', 'cp-b')));
  await assertFails(getDoc(doc(staffBDb, 'course_progress', 'cp-a')));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'course_progress', 'cp-a')));
  await assertFails(getDoc(doc(mentorADb, 'course_progress', 'cp-b')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(getDoc(doc(farmerADb, 'course_progress', 'cp-b')));
  await assertFails(setDoc(doc(farmerADb, 'course_progress', `${FARMER_A}_m2`), {
    profile_id: FARMER_A, org_id: ORG_B, module: 'm2', done: true,
  }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'course_progress', 'cp-a')));
  await assertSucceeds(getDoc(doc(adminDb, 'course_progress', 'cp-b')));
});

test('cross-org isolation matrix: course_enrollments and course_assignments', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  const enrollId = (p: string) => `${p}_${DEFAULT_TRACK}`;

  await assertSucceeds(getDoc(doc(staffADb, 'course_enrollments', enrollId(FARMER_A))));
  await assertFails(getDoc(doc(staffADb, 'course_enrollments', enrollId(FARMER_B))));
  await assertSucceeds(getDoc(doc(staffBDb, 'course_enrollments', enrollId(FARMER_B))));
  await assertFails(getDoc(doc(staffBDb, 'course_enrollments', enrollId(FARMER_A))));

  await assertSucceeds(getDoc(doc(mentorADb, 'course_assignments', 'assign-a')));
  await assertFails(getDoc(doc(mentorADb, 'course_assignments', 'assign-b')));

  // Cross-org WRITE: inMyOrg(request.resource.data) gates create/update, inMyOrg(resource.data)
  // gates delete — org A staff/mentor can create, update, nor delete an org B document.
  await assertFails(setDoc(doc(staffADb, 'course_enrollments', `${enrollId(FARMER_B)}-spoof`), {
    profile_id: FARMER_B, track: DEFAULT_TRACK, status: 'active', enrolled_by: STAFF_A, org_id: ORG_B,
  }));
  await assertFails(deleteDoc(doc(staffADb, 'course_enrollments', enrollId(FARMER_B))));
  await assertFails(setDoc(doc(mentorADb, 'course_assignments', 'assign-b-spoof'), {
    profile_id: FARMER_B, org_id: ORG_B, assigned_by: MENTOR_A, module: 'm2', due_at: null,
  }));
  await assertFails(deleteDoc(doc(mentorADb, 'course_assignments', 'assign-b')));

  // THE FIX: admin's own org_id is null, so inMyOrg() alone always failed closed on both of
  // these before isAdmin() was added.
  await assertSucceeds(getDoc(doc(adminDb, 'course_enrollments', enrollId(FARMER_B))));
  await assertSucceeds(getDoc(doc(adminDb, 'course_assignments', 'assign-b')));
});

test('cross-org isolation matrix: course_submissions', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'course_submissions', 'sub-a')));
  await assertFails(getDoc(doc(staffADb, 'course_submissions', 'sub-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'course_submissions', 'sub-b')));
  await assertFails(getDoc(doc(staffBDb, 'course_submissions', 'sub-a')));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'course_submissions', 'sub-a')));
  await assertFails(getDoc(doc(mentorADb, 'course_submissions', 'sub-b')));

  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(getDoc(doc(farmerADb, 'course_submissions', 'sub-b')));
  await assertFails(setDoc(doc(farmerADb, 'course_submissions', `${FARMER_A}_m2`), {
    profile_id: FARMER_A, org_id: ORG_B, module: 'm2', submitted_at: '2026-08-29T00:00:00.000Z',
    self_check: [], photo_path: null, voice_path: null,
  }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'course_submissions', 'sub-b')));
});

test('cross-org isolation matrix: mentor_visits', async () => {
  // THE FIX: bare isStaff() (no org scoping at all — MentorVisit had no org_id field before this
  // PR) let any staff account in any org read every org's visits.
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'mentor_visits', 'visit-a')));
  await assertFails(getDoc(doc(staffADb, 'mentor_visits', 'visit-b')));
  await assertSucceeds(getDoc(doc(staffBDb, 'mentor_visits', 'visit-b')));
  await assertFails(getDoc(doc(staffBDb, 'mentor_visits', 'visit-a')));
  // A legacy visit with no org_id at all fails closed for staff — same shape as reports' own
  // pre-org_id legacy fixture (sameOrg() cannot prove a missing field safe).
  await assertFails(getDoc(doc(staffADb, 'mentor_visits', 'visit-legacy-noorg')));

  // Mentor/trainee self-access is unaffected: it never depended on isStaff() and doesn't touch
  // org_id, so it still works even on the legacy no-org_id doc.
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'mentor_visits', 'visit-a')));
  await assertSucceeds(getDoc(doc(mentorADb, 'mentor_visits', 'visit-legacy-noorg')));
  await assertFails(getDoc(doc(mentorADb, 'mentor_visits', 'visit-b')));

  const farmerBDb = env.authenticatedContext(FARMER_B).firestore();
  await assertSucceeds(getDoc(doc(farmerBDb, 'mentor_visits', 'visit-b'))); // the trainee reading their own
  await assertFails(getDoc(doc(farmerBDb, 'mentor_visits', 'visit-a')));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'mentor_visits', 'visit-b')));
  await assertSucceeds(getDoc(doc(adminDb, 'mentor_visits', 'visit-legacy-noorg')));

  // logMentorVisit() now stamps org_id from the writing mentor's own profile, and the create
  // rule pins it to myOrg() — a mentor cannot create a visit claiming the other org.
  await assertFails(setDoc(doc(mentorADb, 'mentor_visits', 'visit-a-spoof'), {
    mentor_id: MENTOR_A, trainee_id: FARMER_A, org_id: ORG_B, garden_id: null,
    notes: 'Spoofed', visited_at: '2026-08-29T00:00:00.000Z',
  }));
  await assertSucceeds(setDoc(doc(mentorADb, 'mentor_visits', 'visit-a-honest'), {
    mentor_id: MENTOR_A, trainee_id: FARMER_A, org_id: ORG_A, garden_id: null,
    notes: 'Honest', visited_at: '2026-08-29T00:00:00.000Z',
  }));

  // KNOWN, DELIBERATELY UNCHANGED GAP (RULES-FIX-PROPOSAL-2026-08-01.md Part 3 #8, second half):
  // create does not verify the named trainee_id actually belongs to the writing mentor's own
  // org at all — a mentor could name ANY trainee_id, including one in another org, inside an
  // otherwise-honest (own org_id) visit. Not fixed or asserted here (report-only backlog item);
  // see the PR description.
});

test('cross-org isolation matrix: farmer_consents', async () => {
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  const staffBDb = env.authenticatedContext(STAFF_B).firestore();
  await assertSucceeds(getDoc(doc(staffADb, 'farmer_consents', FARMER_A)));
  await assertFails(getDoc(doc(staffADb, 'farmer_consents', FARMER_B)));
  await assertSucceeds(getDoc(doc(staffBDb, 'farmer_consents', FARMER_B)));
  await assertFails(getDoc(doc(staffBDb, 'farmer_consents', FARMER_A)));

  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertSucceeds(getDoc(doc(mentorADb, 'farmer_consents', FARMER_A)));
  await assertFails(getDoc(doc(mentorADb, 'farmer_consents', FARMER_B)));

  // A farmer cannot consent on the other org's farmer's behalf, nor point their own consent at
  // an org they don't belong to (org_id is pinned to myOrg()).
  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(setDoc(doc(farmerADb, 'farmer_consents', FARMER_B), {
    uid: FARMER_B, org_id: ORG_B, scopes: { sales: true }, granted_at: null, revoked_at: null, updated_at: '2026-08-29T00:00:00.000Z',
  }));
  await assertFails(setDoc(doc(farmerADb, 'farmer_consents', FARMER_A), {
    uid: FARMER_A, org_id: ORG_B, scopes: { sales: true }, granted_at: null, revoked_at: null, updated_at: '2026-08-29T00:00:00.000Z',
  }));

  const adminDb = env.authenticatedContext(PLATFORM_ADMIN).firestore();
  await assertSucceeds(getDoc(doc(adminDb, 'farmer_consents', FARMER_B)));
});

test('cross-org isolation matrix: grants (deliberately cross-org by design)', async () => {
  // /grants is not a "can org A see org B" leak candidate in the same sense as everything above
  // — a grant document's entire purpose is to be readable by BOTH of the two orgs it names (see
  // grantedOrg() and the dedicated 'grants: readable only by the two named orgs or admin, never
  // client-writable' test above, which already proves the named-funder / named-ngo / admin
  // shape). What this test adds: a THIRD org, uninvolved in the FUNDER_ORG_A -> org-1 grant
  // seeded above, cannot read it just by being staff/farmer/mentor somewhere else on the
  // platform.
  const staffADb = env.authenticatedContext(STAFF_A).firestore();
  await assertFails(getDoc(doc(staffADb, 'grants', `${FUNDER_ORG_A}_org-1`)));
  const farmerADb = env.authenticatedContext(FARMER_A).firestore();
  await assertFails(getDoc(doc(farmerADb, 'grants', `${FUNDER_ORG_A}_org-1`)));
  const mentorADb = env.authenticatedContext(MENTOR_A).firestore();
  await assertFails(getDoc(doc(mentorADb, 'grants', `${FUNDER_ORG_A}_org-1`)));
  // Write is unconditionally false for every role, admin included (asserted above already);
  // confirmed again here from a third org's perspective.
  await assertFails(setDoc(doc(staffADb, 'grants', `${ORG_A}_${ORG_B}`), {
    funder_org_id: ORG_A, ngo_org_id: ORG_B, created_at: '2026-08-29T00:00:00.000Z', created_by: STAFF_A,
  }));
});

test('cross-org isolation matrix: per-user collections (not org-scoped by design)', async () => {
  // saved_places, user_map_data/{uid}/data/{doc}, render_jobs and render_usage are PURE
  // per-user: their rules never mention role or org at all (owns()/uid==request.auth.uid only),
  // so "org A cannot see org B" is not the relevant question here — the boundary is per-ACCOUNT.
  // Proven below with FARMER_A/FARMER_B standing in for any two accounts, same org or not.
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    await Promise.all([
      setDoc(doc(db, 'saved_places', 'place-a'), { profile_id: FARMER_A, name: 'Place A', lat: 0, lon: 0, created_at: '2026-08-29T00:00:00.000Z' }),
      setDoc(doc(db, 'user_map_data', FARMER_A, 'data', 'shapes'), { geojson: {} }),
      setDoc(doc(db, 'render_jobs', 'job-a'), { uid: FARMER_A, status: 'queued', sheets: ['s1'] }),
      setDoc(doc(db, 'render_usage', `${FARMER_A}_2026-08-29`), { count: 1 }),
    ]);
  });

  const farmerBDb = env.authenticatedContext(FARMER_B).firestore();
  await assertFails(getDoc(doc(farmerBDb, 'saved_places', 'place-a')));
  await assertFails(getDoc(doc(farmerBDb, 'user_map_data', FARMER_A, 'data', 'shapes')));
  await assertFails(getDoc(doc(farmerBDb, 'render_jobs', 'job-a')));
  await assertFails(getDoc(doc(farmerBDb, 'render_usage', `${FARMER_A}_2026-08-29`)));

  // shared_sites is CAPABILITY-based by design, not org-scoped: `allow get: if true` is
  // deliberate (see the comment on that match block) — the six-character code IS the boundary,
  // not org membership. Already covered by 'a shared site is readable by exact code but its
  // collection cannot be listed' above; not re-tested here.
  //
  // community_profiles, board_posts, message_threads (+ its messages subcollection) and
  // community_reports are a DELIBERATELY cross-org feature (opt-in discovery directory, trade
  // board, 1:1 messaging) — the file's own section comment says so: "nothing here ever loosens
  // the existing profiles/gardens/logs isolation above". Gated by the communityOn() kill switch
  // plus signedIn() only, by product design, not an oversight. Out of scope for an ORG isolation
  // matrix, which is about tenants who should NOT see each other — community is the one place
  // farmers from different orgs are meant to.
});

// NGO assessment publication replaces unrestricted raw funder survey reads.
test('funders cannot read raw survey responses even with a valid NGO grant', async () => {
  const funderDb = env.authenticatedContext(FUNDER_WITH_GRANT).firestore();
  await assertFails(getDoc(doc(funderDb, 'survey_responses', 'resp-org1')));
  await assertFails(setDoc(doc(funderDb, 'org_permissions', FUNDER_WITH_GRANT), { analyse: true }));
  await assertFails(setDoc(doc(funderDb, 'organization_controls', 'org-1'), { funderAccess: true }));
  await assertFails(setDoc(doc(funderDb, 'mel_assessments', 'injected'), { orgId: 'org-1', published: true }));
});

test('survey authors cannot create surveys in a different organisation', async () => {
  const ngoDb = env.authenticatedContext(STAFF_A).firestore();
  await assertFails(setDoc(doc(ngoDb, 'surveys', 'spoofed-survey'), { created_by: STAFF_A, org_id: ORG_B, title: 'Injected', questions: [] }));
});

test('an NGO pause blocks a funder grant and cannot be undone by a client write', async () => {
  const funderDb = env.authenticatedContext(FUNDER_WITH_GRANT).firestore();
  await assertSucceeds(getDoc(doc(funderDb, 'profiles', FARMER_WITH_LINK)));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'organization_controls', 'org-1'), { funderAccess: false });
  });
  try {
    await assertFails(getDoc(doc(funderDb, 'profiles', FARMER_WITH_LINK)));
    await assertFails(updateDoc(doc(funderDb, 'organization_controls', 'org-1'), { funderAccess: true }));
  } finally {
    await env.withSecurityRulesDisabled(async (context) => { await deleteDoc(doc(context.firestore(), 'organization_controls', 'org-1')); });
  }
});

// The service publishes only aggregates; even NGO staff cannot bypass its validation.
test('production registers and their evidence history deny direct client access', async () => {
  for (const uid of [FUNDER_WITH_GRANT, STAFF_A, FARMER_A]) {
    const db = env.authenticatedContext(uid).firestore();
    for (const path of ['production_sites/org-1/sites/garden-01', 'production_sites/org-1/sites/garden-01/history/change']) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), { published: true, vegetableM2: 999999 }));
    }
  }
});
