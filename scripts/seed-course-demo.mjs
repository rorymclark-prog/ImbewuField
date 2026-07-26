/**
 * Seeds a mentor + learner pair into the LOCAL Firebase emulators so the course
 * enrolment and assignment flow can be walked end to end. Emulator only — the env vars
 * below are set before firebase-admin loads, so there is no credential path in this file
 * that could reach the real fieldproof-sa project. Same contract as seed-emulator.mjs.
 *
 *   firebase emulators:start --only auth,firestore --project fieldproof-sa
 *   node scripts/seed-course-demo.mjs
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const PROJECT_ID = 'fieldproof-sa';
initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore();

const ORG_ID = 'org-demo';
const PASSWORD = 'testpass123';

const PEOPLE = [
  { email: 'mentor@imbewufield.local',  name: 'Zimisele Luthuli', role: 'mentor',  lang: 'en' },
  { email: 'learner@imbewufield.local', name: 'Nomvula Dlamini',  role: 'student', lang: 'zu' },
];

async function upsertUser({ email, name, role, lang }) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password: PASSWORD, displayName: name });
  } catch {
    user = await auth.createUser({ email, password: PASSWORD, displayName: name });
  }
  await db.doc(`profiles/${user.uid}`).set({
    full_name: name, role, org_id: ORG_ID, language: lang,
    id_number: null, phone: null, photo_url: null,
    created_at: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`  ${role.padEnd(8)} ${email}  uid=${user.uid}`);
  return user.uid;
}

await db.doc(`organizations/${ORG_ID}`).set(
  { name: 'Imbewu Demo Org', kind: 'ngo', created_at: FieldValue.serverTimestamp() },
  { merge: true },
);

const uids = {};
for (const p of PEOPLE) uids[p.role] = await upsertUser(p);

// Two modules already ticked by the learner, so "in progress" and the derived status have
// something real to compute from rather than starting at zero.
for (const module of ['intro-permaculture', 'reading-landscape']) {
  await db.doc(`course_progress/${uids.student}_${module}`).set({
    profile_id: uids.student, module, done: true, updated_at: FieldValue.serverTimestamp(),
  });
}

console.log(`\n  org: ${ORG_ID}   password for both: ${PASSWORD}`);
console.log('  learner starts with 2 of 10 modules ticked, no enrolment and no assignments.\n');
