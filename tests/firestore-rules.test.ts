import { before, after, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  type Firestore,
} from 'firebase/firestore';

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

const PROJECT_ID = 'fieldproof-sa';
const DEFAULT_TRACK = 'permaculture-core';
const LOG_COLLECTIONS = ['production_logs', 'sales_logs', 'expense_logs'] as const;
const FARMER_WITHOUT_LINK = 'farmer-without-link';
const FARMER_WITH_LINK = 'farmer-with-link';
const LINKED_MENTOR = 'mentor-with-link';
const SELF_ASSIGNED_MENTOR = 'self-assigned-mentor';

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

test('a self-assigned mentor cannot create that role or read an unrelated farmer\'s money', async () => {
  const db = env.authenticatedContext(SELF_ASSIGNED_MENTOR).firestore();

  await assertFails(setDoc(doc(db, 'profiles', 'new-self-assigned-mentor'), {
    role: 'mentor', org_id: null, full_name: 'Not trusted', language: 'en',
  }));

  for (const collectionName of LOG_COLLECTIONS) {
    await assertFails(getDoc(doc(db, collectionName, `${FARMER_WITHOUT_LINK}-${collectionName}`)));
  }
});

test('a mentor with the learner enrollment link can read that learner\'s three financial log types', async () => {
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

test('a profile owner cannot change role or org_id, but can edit an ordinary profile field', async () => {
  const db = env.authenticatedContext(FARMER_WITH_LINK).firestore();
  await assertFails(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { role: 'admin' }));
  await assertFails(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { org_id: 'org-2' }));
  await assertSucceeds(updateDoc(doc(db, 'profiles', FARMER_WITH_LINK), { full_name: 'Updated name' }));
});
