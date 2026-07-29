/**
 * ImbewuField — Firebase EMULATOR seed script
 *
 * Seeds a test user + minimal farmer profile into the LOCAL Firebase
 * emulators ONLY. Never touches the production project (fieldproof-sa) —
 * no serviceAccount.json is read, and no production credentials are used.
 *
 * This is a separate script from scripts/seed.mjs on purpose: seed.mjs
 * writes to production via serviceAccount.json and must never be pointed
 * at the emulator or vice versa.
 *
 * Prerequisite — emulators must already be running:
 *   firebase emulators:start --only auth,firestore --project fieldproof-sa
 *
 * Usage:
 *   node scripts/seed-emulator.mjs
 */

// ── Force emulator hosts BEFORE importing firebase-admin ──────────────────
// firebase-admin reads these env vars when talking to Auth/Firestore; setting
// them here (rather than relying on the caller's shell) makes this script
// self-contained and impossible to accidentally point at production — there
// is no credential path in this file that could reach a real project.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Must match .firebaserc / NEXT_PUBLIC_FIREBASE_PROJECT_ID so the app (when
// run with NEXT_PUBLIC_USE_FIREBASE_EMULATOR=1) reads the same emulator
// namespace this script writes to. It is only ever a *label* here — with the
// emulator env vars set above, no network call in this script can reach the
// real fieldproof-sa project.
const PROJECT_ID = 'fieldproof-sa';

// No service account / credential needed — the emulator env vars above
// redirect every Admin SDK call to the local emulators, which don't check
// credentials.
initializeApp({ projectId: PROJECT_ID });

const auth = getAuth();
const db = getFirestore();

const TEST_EMAIL = 'test@imbewufield.local';
const TEST_PASSWORD = 'testpass123';
const TEST_DISPLAY_NAME = 'Test Farmer';

// ── Auth emulator: create or update the test user ──────────────────────────

async function upsertAuthUser() {
  let uid;
  try {
    const existing = await auth.getUserByEmail(TEST_EMAIL);
    uid = existing.uid;
    await auth.updateUser(uid, { password: TEST_PASSWORD, displayName: TEST_DISPLAY_NAME });
    console.log(`Auth user already existed in emulator — updated. UID: ${uid}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    const created = await auth.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: TEST_DISPLAY_NAME,
      emailVerified: true,
    });
    uid = created.uid;
    console.log(`Auth user created in emulator. UID: ${uid}`);
  }
  return uid;
}

// ── Firestore emulator: minimal valid profile for a logged-in farmer ───────
// getMyProfile() in lib/db/queries.ts reads doc(f.db, 'profiles', uid), and
// firestore.rules requires role in the allowed set + org_id null for a
// self-service (non-staff) signup — this mirrors exactly what signUp() in
// lib/auth.tsx writes for a real farmer signup.

async function seedFirestore(uid) {
  const now = FieldValue.serverTimestamp();

  await db.doc(`profiles/${uid}`).set(
    {
      full_name: TEST_DISPLAY_NAME,
      role: 'farmer',
      org_id: null,
      language: 'en',
      id_number: null,
      phone: null,
      photo_url: null,
      created_at: now,
    },
    { merge: true }
  );

  // One saved place so a walkthrough has somewhere to land. The map UI reads
  // localStorage synced against user_map_data/{uid}/data/places (lib/user-sync.ts
  // placesRef; doc shape { places: SavedPlace[], deleted, updatedAt }) — NOT the
  // top-level saved_places collection, whose lib/db/queries.ts helpers are dead
  // code nothing calls (IF-001-C1).
  await db.doc(`user_map_data/${uid}/data/places`).set({
    places: [{
      id: 'seed-test-farm',
      name: 'Test Farm',
      lat: -29.783,
      lon: 30.742,
      biome: 'Indian Ocean Coastal Belt',
      rainfall: 900,
      elevation: 628,
      savedAt: new Date().toISOString().slice(0, 10),
      updatedAt: Date.now(),
      label: 'field',
    }],
    deleted: {},
    updatedAt: now,
  });

  console.log('Firestore seeded (emulator only):');
  console.log(`  profile      -> profiles/${uid}`);
  console.log(`  saved place  -> user_map_data/${uid}/data/places (the path the map actually syncs)`);

  // The AI-render kill switch (firestore.rules rendersOn()). Without this doc every emulator
  // enqueue dies at the rules gate with an opaque "evaluation error", which reads like a bug in
  // the flow when it is really just an unseeded config doc. Rendering in the emulator costs
  // nothing — no Cloud Function worker runs here, so jobs sit 'queued' until a test completes
  // them (see the emulator render-loop recipe in docs/CODEX-QUEUE.md item 36).
  await db.doc('app_config/renders').set({ enabled: true }, { merge: true });
  console.log('  kill switch  -> app_config/renders { enabled: true } (emulator renders allowed)');
}

// ── Main ─────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('ImbewuField EMULATOR seed starting...');
    console.log(`  Firestore host: ${process.env.FIRESTORE_EMULATOR_HOST}`);
    console.log(`  Auth host:      ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
    console.log(`  Project label:  ${PROJECT_ID} (emulator namespace — production is untouched)\n`);

    const uid = await upsertAuthUser();
    await seedFirestore(uid);

    console.log(`\nDone. Test farmer UID: ${uid}`);
    console.log(`  Email:    ${TEST_EMAIL}`);
    console.log(`  Password: ${TEST_PASSWORD}`);
  } catch (err) {
    console.error('Emulator seed failed:', err.message ?? err);
    console.error(
      'Is the emulator running? firebase emulators:start --only auth,firestore --project fieldproof-sa'
    );
    process.exit(1);
  }
})();
