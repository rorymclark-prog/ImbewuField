/**
 * ImbewuField — Firestore seed script
 * Mirrors the sample data from components/NgoDashboard.tsx exactly.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id \
 *   npm run seed
 *
 * Or place serviceAccount.json in the project root and set only
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID (the script falls back to the file).
 *
 * ONE-TIME USE, GUARDED. Unlike scripts/provision-org.mjs, this script has no concept of "an
 * org that already exists" — every run unconditionally calls `organizations.doc()` (a fresh
 * auto-id) and writes a full fictional NGO under it. Before this guard, running it twice (or
 * pointing it at a project that already had a real org #1) silently produced a SECOND
 * "ImbewuField NGO" with duplicate gardens/farmers/logs, because nothing ever checked. Pass
 * --force to seed anyway (e.g. deliberately seeding a second demo org for local comparison).
 */

import { existsSync, readFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';

// ── Initialise Firebase Admin ──────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID env var is required.');
  process.exit(1);
}

// Emulator mode (see scripts/seed-emulator.mjs / scripts/provision-org.mjs for the same
// convention) — lets the idempotency guard above be exercised in a test without a throwaway
// serviceAccount.json that would otherwise exist only to satisfy existsSync().
if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  initializeApp({ projectId });
} else {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccount.json';
  if (!existsSync(credPath)) {
    console.error(`ERROR: Service account not found at ${credPath}.`);
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json in the project root.');
    process.exit(1);
  }
  const json = JSON.parse(readFileSync(credPath, 'utf8'));
  initializeApp({ credential: cert(json), projectId });
}
const db = getFirestore();

// ── Source data (from NgoDashboard.tsx) ────────────────────────────────────

const GARDENS_SEED = [
  { id: 'g1',  name: 'Siyazama Community Garden',  town: 'Soweto, GP',        lat: -26.267, lon: 27.858, farmers: 28, status: 'thriving',     produceKg: 1240, training: 92, facilitator: 'Nomsa M.'   },
  { id: 'g2',  name: 'Umlazi Food Garden',          town: 'Umlazi, KZN',       lat: -29.966, lon: 30.889, farmers: 19, status: 'thriving',     produceKg: 980,  training: 84, facilitator: 'Sipho D.'   },
  { id: 'g3',  name: 'Mthatha Permaculture Hub',    town: 'Mthatha, EC',       lat: -31.589, lon: 28.783, farmers: 22, status: 'establishing', produceKg: 410,  training: 61, facilitator: 'Thandi N.'  },
  { id: 'g4',  name: 'Gugulethu Greens',            town: 'Gugulethu, WC',     lat: -33.98,  lon: 18.571, farmers: 16, status: 'thriving',     produceKg: 1130, training: 88, facilitator: 'Aviwe K.'   },
  { id: 'g5',  name: 'Tzaneen Agroecology Plot',    town: 'Tzaneen, LP',       lat: -23.833, lon: 30.163, farmers: 31, status: 'thriving',     produceKg: 1560, training: 79, facilitator: 'Rofhiwa M.' },
  { id: 'g6',  name: 'Botshabelo Plots',            town: 'Botshabelo, FS',    lat: -29.27,  lon: 26.74,  farmers: 14, status: 'support',      produceKg: 180,  training: 38, facilitator: 'Lerato S.'  },
  { id: 'g7',  name: 'Kuyasa Kitchen Garden',       town: 'Khayelitsha, WC',   lat: -34.043, lon: 18.681, farmers: 20, status: 'establishing', produceKg: 520,  training: 66, facilitator: 'Aviwe K.'   },
  { id: 'g8',  name: 'Giyani Indigenous Garden',    town: 'Giyani, LP',        lat: -23.302, lon: 30.718, farmers: 25, status: 'thriving',     produceKg: 1020, training: 81, facilitator: 'Rofhiwa M.' },
  { id: 'g9',  name: 'Mdantsane Veg Co-op',         town: 'Mdantsane, EC',     lat: -32.94,  lon: 27.78,  farmers: 18, status: 'establishing', produceKg: 470,  training: 58, facilitator: 'Thandi N.'  },
  { id: 'g10', name: 'Galeshewe Food Forest',       town: 'Kimberley, NC',     lat: -28.715, lon: 24.733, farmers: 12, status: 'support',      produceKg: 140,  training: 32, facilitator: 'Lerato S.'  },
  { id: 'g11', name: 'Bushbuckridge Garden',        town: 'Bushbuckridge, MP', lat: -24.83,  lon: 31.08,  farmers: 27, status: 'thriving',     produceKg: 1310, training: 86, facilitator: 'Sipho D.'   },
  { id: 'g12', name: 'Rustenburg Roots',            town: 'Rustenburg, NW',    lat: -25.667, lon: 27.242, farmers: 17, status: 'establishing', produceKg: 600,  training: 64, facilitator: 'Nomsa M.'   },
];

const NAMES = [
  'Thabo Mahlangu', 'Nosipho Khumalo', 'Jabu Dlamini', 'Maria Sithole',
  'Andile Ngubane', 'Grace Mokoena', 'Sibusiso Ndlovu', 'Lerato Phiri',
  'Bongani Zulu', 'Precious Mbeki',
];
const CROPS = [
  'Spinach', 'Tomatoes', 'Cabbage', 'Carrots', 'Onions',
  'Maize', 'Beans', 'Pumpkin', 'Sweet potato', 'Green pepper',
];
const MONTHS = ['Feb', 'Mar', 'Apr', 'May', 'Jun'];
const BUYERS = ['Local market', 'Spaza shop', 'School feeding', 'Bakkie trader', 'Neighbours'];
const COURSES = [
  'Soil & compost', 'Water harvesting', 'Planting calendar',
  'Pest & disease', 'Seed saving', 'Markets & records',
];

// ── Deterministic seeded RNG (identical to NgoDashboard.tsx) ───────────────

function seeded(seed) {
  let s = 2166136261;
  for (const ch of seed) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const pick = (r, a) => a[Math.floor(r() * a.length)];
const rint = (r, a, b) => a + Math.floor(r() * (b - a + 1));

// ── Gardener generator (mirrors gardenersFor() in NgoDashboard.tsx) ─────────

function gardenersFor(garden) {
  const r = seeded(garden.id);
  const n = rint(r, 3, 4);
  return Array.from({ length: n }).map((_, i) => {
    const trainingPct = Math.max(20, Math.min(100, garden.training + rint(r, -14, 14)));
    const doneCount = Math.round((trainingPct / 100) * COURSES.length);
    const idNumber = `${rint(r, 70, 99)}${rint(r, 10, 12)}${rint(r, 10, 28)}••••${pick(r, ['08', '18', '19'])}${rint(r, 0, 9)}`;
    const sizeM2 = rint(r, 80, 620);
    const lat = garden.lat + (r() - 0.5) * 0.012;
    const lon = garden.lon + (r() - 0.5) * 0.012;

    const production = Array.from({ length: rint(r, 4, 6) }).map(() => ({
      crop: pick(r, CROPS),
      date: `${rint(r, 2, 27)} ${pick(r, MONTHS)}`,
      kg: rint(r, 4, 38),
    }));

    const sales = Array.from({ length: rint(r, 2, 4) }).map(() => {
      const kg = rint(r, 3, 22);
      return {
        crop: pick(r, CROPS),
        date: `${rint(r, 2, 27)} ${pick(r, MONTHS)}`,
        kg,
        rand: kg * rint(r, 11, 19),
        buyer: pick(r, BUYERS),
      };
    });

    return {
      name: NAMES[(i * 3 + garden.id.length * 2) % NAMES.length],
      plot: `Plot ${i + 1}`,
      idNumber,
      sizeM2,
      lat,
      lon,
      trainingPct,
      courses: COURSES.map((name, idx) => ({ name, done: idx < doneCount })),
      production,
      sales,
    };
  });
}

// ── Date helper — convert "14 Mar" to a Firestore Timestamp ────────────────

const MONTH_MAP = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function parseDate(dateStr) {
  // dateStr e.g. "14 Mar"
  const [day, mon] = dateStr.split(' ');
  const d = new Date(2026, MONTH_MAP[mon] ?? 0, parseInt(day, 10));
  return Timestamp.fromDate(d);
}

// ── Main seed ──────────────────────────────────────────────────────────────

const FORCE = process.argv.includes('--force');
const SEED_ORG_NAME = 'ImbewuField NGO';

async function seed() {
  console.log('ImbewuField Firestore seed starting...\n');

  // Idempotency guard — see the header comment. Checked before any write, same pattern as
  // provision-org.mjs's own by-name dedupe.
  const dupe = await db.collection('organizations').where('name', '==', SEED_ORG_NAME).limit(1).get();
  if (!dupe.empty && !FORCE) {
    console.error(`ERROR: an organisation named "${SEED_ORG_NAME}" already exists (${dupe.docs[0].id}).`);
    console.error('       Refusing to seed a duplicate demo org. Pass --force to seed anyway.');
    process.exit(1);
  }

  // 1. Organisation
  console.log('[1/5] Writing organisation...');
  const orgRef = db.collection('organizations').doc();
  await orgRef.set({
    name: SEED_ORG_NAME,
    kind: 'ngo',
    created_at: FieldValue.serverTimestamp(),
  });
  const orgId = orgRef.id;
  console.log(`      org id: ${orgId}`);

  // 2. Programme
  console.log('[2/5] Writing programme...');
  const progRef = db.collection('programmes').doc();
  await progRef.set({
    org_id: orgId,
    name: 'Community Food Security Initiative',
    funder: 'Presidential Fund + IDC',
    deployed_amount: 48600000,        // R48.6m as cents? kept as Rands for readability
    created_at: FieldValue.serverTimestamp(),
  });
  const programmeId = progRef.id;
  console.log(`      programme id: ${programmeId}`);

  // 3. Gardens
  console.log('[3/5] Writing 12 gardens...');
  const gardenIdMap = {}; // seed id (g1…g12) → Firestore doc id
  const batch1 = db.batch();
  for (const g of GARDENS_SEED) {
    const ref = db.collection('gardens').doc();
    gardenIdMap[g.id] = ref.id;
    batch1.set(ref, {
      programme_id: programmeId,
      org_id: orgId,
      name: g.name,
      town: g.town,
      lat: g.lat,
      lon: g.lon,
      status: g.status,
      supervisor_id: null,
      created_at: FieldValue.serverTimestamp(),
    });
  }
  await batch1.commit();
  console.log(`      garden ids written: ${Object.keys(gardenIdMap).length}`);

  // 4 & 5. Gardeners (profiles, members, production_logs, sales_logs, course_progress)
  console.log('[4/5] Writing gardeners, production, sales, and course progress...');

  let totalProfiles = 0;
  let totalProduction = 0;
  let totalSales = 0;
  let totalCourses = 0;

  for (const seedGarden of GARDENS_SEED) {
    const gardenFirestoreId = gardenIdMap[seedGarden.id];
    const gardeners = gardenersFor(seedGarden);

    for (const gardener of gardeners) {
      // profiles/{profileId}
      const profileRef = db.collection('profiles').doc();
      const profileId = profileRef.id;
      await profileRef.set({
        full_name: gardener.name,
        role: 'farmer',
        org_id: orgId,
        language: 'en',
        id_number: gardener.idNumber,
        phone: null,
        photo_url: null,
        created_at: FieldValue.serverTimestamp(),
      });
      totalProfiles++;

      // gardens/{gardenId}/members/{profileId}
      const memberRef = db.collection('gardens').doc(gardenFirestoreId).collection('members').doc(profileId);
      await memberRef.set({
        garden_id: gardenFirestoreId,
        profile_id: profileId,
        plot: gardener.plot,
        size_m2: gardener.sizeM2,
        lat: gardener.lat,
        lon: gardener.lon,
      });

      // production_logs (sub-batched per gardener to stay under 500-write limit)
      const prodBatch = db.batch();
      for (const prod of gardener.production) {
        const ref = db.collection('production_logs').doc();
        prodBatch.set(ref, {
          profile_id: profileId,
          garden_id: gardenFirestoreId,
          org_id: orgId,
          crop: prod.crop,
          kg: prod.kg,
          logged_at: parseDate(prod.date),
          photo_url: null,
          created_at: FieldValue.serverTimestamp(),
        });
        totalProduction++;
      }
      await prodBatch.commit();

      // sales_logs
      const salesBatch = db.batch();
      for (const sale of gardener.sales) {
        const ref = db.collection('sales_logs').doc();
        salesBatch.set(ref, {
          profile_id: profileId,
          garden_id: gardenFirestoreId,
          org_id: orgId,
          crop: sale.crop,
          kg: sale.kg,
          amount: sale.rand,
          buyer: sale.buyer,
          sold_at: parseDate(sale.date),
          created_at: FieldValue.serverTimestamp(),
        });
        totalSales++;
      }
      await salesBatch.commit();

      // course_progress
      const courseBatch = db.batch();
      for (const course of gardener.courses) {
        const ref = db.collection('course_progress').doc();
        courseBatch.set(ref, {
          profile_id: profileId,
          module: course.name,
          done: course.done,
          updated_at: FieldValue.serverTimestamp(),
        });
        totalCourses++;
      }
      await courseBatch.commit();
    }

    console.log(`      [garden ${seedGarden.id}] ${gardeners.length} gardeners seeded — ${seedGarden.name}`);
  }

  console.log('\n[5/5] Done.\n');
  console.log('Summary');
  console.log('-------');
  console.log(`  Organization:     1  (id: ${orgId})`);
  console.log(`  Programme:        1  (id: ${programmeId})`);
  console.log(`  Gardens:          ${GARDENS_SEED.length}`);
  console.log(`  Farmer profiles:  ${totalProfiles}`);
  console.log(`  Production logs:  ${totalProduction}`);
  console.log(`  Sales logs:       ${totalSales}`);
  console.log(`  Course progress:  ${totalCourses}`);
  console.log('\nFirestore is ready. Open the Firebase console to verify.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
