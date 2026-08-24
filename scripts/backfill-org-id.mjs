/**
 * ImbewuField — one-off org_id backfill
 *
 * Part of the cross-org Firestore leak fix (docs/AUDIT-NEEDS-RORY-2026-08-15.md #1). The new
 * org-scoped rules on `designs`, `course_progress`, `course_submissions` and `survey_responses`
 * compare `resource.data.org_id` against the caller's own org — but every doc in those four
 * collections written BEFORE this fix has no `org_id` field at all (undefined != any org, so
 * they'd become permanently unreadable to staff/mentor until backfilled). Farmer/self reads are
 * unaffected (owns()/owns-field branches don't touch org_id) — this only restores staff/mentor
 * visibility of PRE-EXISTING rows.
 *
 * For each doc, org_id is taken from its own `profile_id` (or `owner_id` for designs) field's
 * CURRENT profile — i.e. "whatever org this person belongs to today". Docs whose profile_id no
 * longer resolves to a profile, or whose owning profile has no org, are left with org_id: null
 * (matching what a fresh write would stamp for an org-less user) rather than skipped, so nothing
 * is silently left in the pre-fix "no field at all" state.
 *
 * Idempotent: only writes docs that are missing org_id, so it's safe to re-run.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id \
 *   node scripts/backfill-org-id.mjs
 *
 * Or place serviceAccount.json in the project root and set only
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID (the script falls back to the file).
 *
 * Add --dry-run to report what WOULD be written without writing anything.
 */

import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');

// ── Initialise Firebase Admin ──────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  console.error('ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID env var is required.');
  process.exit(1);
}

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccount.json';
if (!existsSync(credPath)) {
  console.error(`ERROR: Service account not found at ${credPath}.`);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json in the project root.');
  process.exit(1);
}
const json = JSON.parse(readFileSync(credPath, 'utf8'));
initializeApp({ credential: cert(json), projectId });
const db = getFirestore();

// ── Backfill ────────────────────────────────────────────────────────────────

// { collection, ownerField } — the field on each doc that names whose org this row belongs to.
const TARGETS = [
  { collection: 'designs', ownerField: 'owner_id' },
  { collection: 'course_progress', ownerField: 'profile_id' },
  { collection: 'course_submissions', ownerField: 'profile_id' },
  { collection: 'survey_responses', ownerField: 'profile_id' },
];

async function orgIdForProfile(profileCache, profileId) {
  if (!profileId) return null;
  if (profileCache.has(profileId)) return profileCache.get(profileId);
  const snap = await db.collection('profiles').doc(profileId).get();
  const orgId = snap.exists ? (snap.data().org_id ?? null) : null;
  profileCache.set(profileId, orgId);
  return orgId;
}

async function backfillCollection({ collection, ownerField }) {
  const profileCache = new Map();
  const snap = await db.collection(collection).get();
  let missing = 0, written = 0, alreadyOk = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if ('org_id' in data) { alreadyOk++; continue; }
    missing++;
    const orgId = await orgIdForProfile(profileCache, data[ownerField]);
    if (DRY_RUN) {
      console.log(`  [dry-run] ${collection}/${docSnap.id}: org_id -> ${JSON.stringify(orgId)}`);
    } else {
      await docSnap.ref.update({ org_id: orgId });
    }
    written++;
  }

  console.log(`${collection}: ${snap.size} docs total, ${alreadyOk} already had org_id, ${missing} backfilled${DRY_RUN ? ' (dry-run, no writes)' : ''}.`);
  return written;
}

async function main() {
  console.log(`Backfilling org_id on ${TARGETS.map((t) => t.collection).join(', ')}${DRY_RUN ? ' (DRY RUN)' : ''}...`);
  let total = 0;
  for (const target of TARGETS) {
    total += await backfillCollection(target);
  }
  console.log(`Done. ${total} doc(s) ${DRY_RUN ? 'would be' : 'were'} updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
