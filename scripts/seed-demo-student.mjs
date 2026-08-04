/**
 * ImbewuField — Demo student seed script
 *
 * Creates (or updates) a fixed demo student account in Firebase Auth and
 * seeds Firestore with course progress, a journal entry, and a saved place.
 *
 * Run with:
 *   SERVICE_ACCOUNT_KEY=path/to/key.json node scripts/seed-demo-student.mjs
 *
 * Alternatively, set GOOGLE_APPLICATION_CREDENTIALS or drop serviceAccount.json
 * in the project root — the script checks all three in order.
 *
 * Requires NEXT_PUBLIC_FIREBASE_PROJECT_ID (or falls back to the project_id
 * inside the service account JSON).
 */

import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Resolve service account ───────────────────────────────────────────────────

function loadServiceAccount() {
  // 1. SERVICE_ACCOUNT_KEY env var (path to JSON file)
  if (process.env.SERVICE_ACCOUNT_KEY) {
    const p = process.env.SERVICE_ACCOUNT_KEY;
    if (!existsSync(p)) throw new Error(`SERVICE_ACCOUNT_KEY file not found: ${p}`);
    return JSON.parse(readFileSync(p, 'utf8'));
  }
  // 2. GOOGLE_APPLICATION_CREDENTIALS (standard ADC path)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const p = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (!existsSync(p)) throw new Error(`GOOGLE_APPLICATION_CREDENTIALS file not found: ${p}`);
    return JSON.parse(readFileSync(p, 'utf8'));
  }
  // 3. serviceAccount.json in project root (convenience)
  // fileURLToPath, not .pathname — .pathname stays percent-encoded, so on a checkout
  // path containing a space this fallback never matched and the script reported "no
  // service account found" with the file sitting right there (2026-08-04).
  const fallback = fileURLToPath(new URL('../serviceAccount.json', import.meta.url));
  if (existsSync(fallback)) return JSON.parse(readFileSync(fallback, 'utf8'));

  throw new Error(
    'No service account found. Set SERVICE_ACCOUNT_KEY=path/to/key.json ' +
    'or GOOGLE_APPLICATION_CREDENTIALS, or place serviceAccount.json in the project root.'
  );
}

const sa = loadServiceAccount();
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? sa.project_id;
if (!projectId) throw new Error('Cannot determine Firebase project ID.');

initializeApp({ credential: cert(sa), projectId });
const auth = getAuth();
const db = getFirestore();

// ── Demo student constants ────────────────────────────────────────────────────

const DEMO_EMAIL = 'student@demo.imbewufield.com';
const DEMO_PASSWORD = 'ImbewuField2026';
const DEMO_DISPLAY_NAME = 'Thandi Dlamini';

// 3 of the 8 modules marked complete (IDs from lib/course-modules.ts)
const COMPLETED_MODULES = ['intro-permaculture', 'reading-landscape', 'water-harvesting'];

// ── Helper: create or update the Auth user ───────────────────────────────────

async function upsertAuthUser() {
  let uid;
  try {
    const existing = await auth.getUserByEmail(DEMO_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, {
      password: DEMO_PASSWORD,
      displayName: DEMO_DISPLAY_NAME,
    });
    console.log(`Auth user already existed — updated. UID: ${uid}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      displayName: DEMO_DISPLAY_NAME,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Auth user created. UID: ${uid}`);
  }
  return uid;
}

// ── Seed Firestore ────────────────────────────────────────────────────────────

async function seedFirestore(uid) {
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();

  // 1. Profile document
  const profileRef = db.doc(`profiles/${uid}`);
  batch.set(
    profileRef,
    {
      full_name: DEMO_DISPLAY_NAME,
      role: 'student',
      org_id: null,
      language: 'en',
      id_number: null,
      phone: null,
      photo_url: null,
      created_at: now,
    },
    { merge: true }
  );

  // 2. Course progress — deterministic doc IDs match setCourseProgress() in queries.ts
  for (const module of COMPLETED_MODULES) {
    const ref = db.doc(`course_progress/${uid}_${module}`);
    batch.set(ref, {
      profile_id: uid,
      module,
      done: true,
      updated_at: now,
    });
  }

  // 3. Journal entry (stored under a user-scoped sub-collection)
  const journalRef = db.collection(`profiles/${uid}/journal`).doc();
  batch.set(journalRef, {
    date: '2026-06-01',
    body:
      'Today I measured my plot and found it is 0.2 ha. The slope faces north-east which is ' +
      'good for sun. I noticed a natural depression where water pools — perfect for a future pond.',
    mood: 'motivated',
    created_at: now,
  });

  // 4. Saved place (mirrors addSavedPlace() in queries.ts)
  const placeRef = db.collection('saved_places').doc();
  batch.set(placeRef, {
    profile_id: uid,
    name: "Thandi's Farm",
    lat: -29.783,
    lon: 30.742,
    biome: 'Indian Ocean Coastal Belt',
    rainfall: 900,
    elevation: 628,
    notes: null,
    savedAt: '2026-06-01',
    label: 'field',
    created_at: now,
  });

  await batch.commit();
  console.log('Firestore seeded:');
  console.log(`  profile           → profiles/${uid}`);
  console.log(`  course_progress   → ${COMPLETED_MODULES.length} modules marked done`);
  console.log(`  journal entry     → profiles/${uid}/journal/<auto-id>`);
  console.log(`  saved place       → saved_places/<auto-id>`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    const uid = await upsertAuthUser();
    await seedFirestore(uid);
    console.log(`\nDone. Demo student UID: ${uid}`);
    console.log(`Email:    ${DEMO_EMAIL}`);
    console.log(`Password: ${DEMO_PASSWORD}`);
  } catch (err) {
    console.error('Seed failed:', err.message ?? err);
    process.exit(1);
  }
})();
