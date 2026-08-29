/**
 * ImbewuField — one-off org_id backfill
 *
 * Part of the cross-org Firestore leak fix (docs/AUDIT-NEEDS-RORY-2026-08-15.md #1). The
 * org-scoped rules on `designs`, `course_progress`, `course_submissions` and `survey_responses`
 * compare `resource.data.org_id` against the caller's own org — but every doc in those four
 * collections written BEFORE this fix has no `org_id` field at all (undefined != any org, so
 * they'd become permanently unreadable to staff/mentor until backfilled). Farmer/self reads are
 * unaffected (owns()/owns-field branches don't touch org_id) — this only restores staff/mentor
 * visibility of PRE-EXISTING rows.
 *
 * EXTENDED (data-integrity audit, follow-up to the above): `production_logs`, `sales_logs` and
 * `expense_logs` — the three money-log collections — read via `staffConsentedAccess()`, which
 * already compares `d.org_id == myOrg()` the same way, but they were never added to this script's
 * TARGETS. Any row written before this fix, or by a code path that predates the `org_id: me?.org_id
 * ?? null` stamp in lib/db/queries.ts's addProduction/addSale/addExpense, is in the same
 * permanently-unreadable-to-staff state the original four collections were in. `reports` is added
 * too: its write path (lib/db/queries.ts saveReport) never stamped org_id at all until this same
 * change, so every report saved before today has no org_id field to backfill FROM the profile —
 * this just brings it into line with the others now that the writer stamps one.
 *
 * For each doc, org_id is taken from its own `profile_id` (or `owner_id` for designs and reports)
 * field's CURRENT profile — i.e. "whatever org this person belongs to today". Docs whose
 * profile_id no longer resolves to a profile, or whose owning profile has no org, are left with
 * org_id: null (matching what a fresh write would stamp for an org-less user) rather than skipped,
 * so nothing is silently left in the pre-fix "no field at all" state.
 *
 * EXTENDED AGAIN (org-isolation matrix audit, 2026-08-29): `mentor_visits` read via a bare
 * `isStaff()` with no org_id field to check at all — see the read-rule comment in
 * firestore.rules. logMentorVisit() (lib/db/queries.ts) now stamps org_id going forward, and
 * this collection uses `trainee_id` as its owner field rather than `profile_id`: the visit is
 * fundamentally the TRAINEE's record (same role profile_id plays everywhere else), not the
 * mentor's — a mentor could in principle move between orgs while a visit they once logged
 * should stay attached to the org the trainee actually belongs to.
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
 * Add --dry-run to report what WOULD be written without writing anything. --dry-run is a single
 * global flag, not per-target — it covers every entry in TARGETS below (old and new alike) in one
 * pass, since backfillCollection() checks it on every doc it would otherwise write. There is no
 * per-collection flag to run just the new targets in isolation; to preview only their effect,
 * temporarily comment out the other TARGETS entries before running with --dry-run, or just read
 * the per-collection summary line each target already prints (it names its own collection, so the
 * four new lines are easy to pick out of the full-run output).
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
  // The three money-log collections — same staffConsentedAccess() org check, just missed when
  // this script was first written (see the EXTENDED note above).
  { collection: 'production_logs', ownerField: 'profile_id' },
  { collection: 'sales_logs', ownerField: 'profile_id' },
  { collection: 'expense_logs', ownerField: 'profile_id' },
  // Reports use owner_id (there is no profile_id on a report doc), same as designs.
  { collection: 'reports', ownerField: 'owner_id' },
  // mentor_visits uses trainee_id, not profile_id — see the EXTENDED AGAIN note above.
  { collection: 'mentor_visits', ownerField: 'trainee_id' },
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
