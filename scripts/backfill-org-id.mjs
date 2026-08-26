/**
 * Backfill `org_id` onto course_progress, course_submissions and survey_responses.
 *
 * WHY THIS IS NOT OPTIONAL. Those three collections used to carry no org_id at all, which is
 * exactly why their read rules could only say `isStaff() || isMentor()` — a bare role check that
 * let any staff account in any org read every farmer's training record and survey answers in the
 * database. The rules are now scoped to org_id, and lib/db/queries.ts stamps it on new writes.
 *
 * Rows written BEFORE that change have no org_id, so the scoped rule cannot match them. They
 * fail closed — which is the safe direction, but it means a mentor's dashboard quietly loses
 * every pre-existing training record until this runs. Run it as part of deploying the rules.
 *
 * The org comes from the row's OWN author (`profiles/{profile_id}.org_id`), never from a flag,
 * so this cannot move anyone's data into an org they were not already in. A row whose author has
 * no profile, or no org, is SKIPPED and reported rather than guessed at.
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id \
 *   node scripts/backfill-org-id.mjs            # dry run — counts only, writes nothing
 *   node scripts/backfill-org-id.mjs --apply    # commit
 */

import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTIONS = ['course_progress', 'course_submissions', 'survey_responses'];
const DRY = !process.argv.includes('--apply');
const BATCH = 400; // Firestore caps a write batch at 500

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) { console.error('ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is required.'); process.exit(1); }
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccount.json';
if (!existsSync(credPath)) { console.error(`ERROR: no service account at ${credPath}.`); process.exit(1); }
initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))), projectId });
const db = getFirestore();

const orgCache = new Map();
async function orgOf(profileId) {
  if (!profileId) return undefined;
  if (orgCache.has(profileId)) return orgCache.get(profileId);
  const snap = await db.collection('profiles').doc(profileId).get();
  const org = snap.exists ? (snap.data().org_id ?? null) : undefined;
  orgCache.set(profileId, org);
  return org;
}

async function main() {
  console.log(`\nBackfill org_id — project ${projectId}`);
  console.log(DRY ? '  MODE: dry run (nothing will be written). Add --apply to commit.\n'
                  : '  MODE: APPLY — this writes to the live database.\n');

  const totals = { stamped: 0, already: 0, noProfile: 0, noOrg: 0 };

  for (const name of COLLECTIONS) {
    const snap = await db.collection(name).get();
    let stamped = 0, already = 0, noProfile = 0, noOrg = 0;
    let batch = db.batch(), pending = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.org_id !== undefined && data.org_id !== null) { already++; continue; }
      const org = await orgOf(data.profile_id);
      if (org === undefined) { noProfile++; continue; }   // author's profile is gone
      if (org === null)      { noOrg++; continue; }        // author genuinely has no org
      stamped++;
      if (!DRY) {
        batch.update(docSnap.ref, { org_id: org });
        if (++pending >= BATCH) { await batch.commit(); batch = db.batch(); pending = 0; }
      }
    }
    if (!DRY && pending > 0) await batch.commit();

    console.log(`  ${name.padEnd(20)} ${String(snap.size).padStart(6)} rows | `
      + `stamp ${stamped} · already ${already} · no-profile ${noProfile} · author-has-no-org ${noOrg}`);
    totals.stamped += stamped; totals.already += already;
    totals.noProfile += noProfile; totals.noOrg += noOrg;
  }

  console.log(`\n${DRY ? 'Dry run complete — nothing written.' : 'Done.'}`);
  console.log(`  ${totals.stamped} row(s) ${DRY ? 'would be' : ''} stamped, ${totals.already} already had an org.`);
  if (totals.noProfile || totals.noOrg) {
    console.log(`  ${totals.noProfile + totals.noOrg} row(s) SKIPPED and still unreadable by staff:`);
    if (totals.noProfile) console.log(`    ${totals.noProfile} — the author's profile no longer exists.`);
    if (totals.noOrg)     console.log(`    ${totals.noOrg} — the author has no org (never assigned one).`);
    console.log('  Both are left alone deliberately: guessing an org here would put one');
    console.log('  farmer\'s record inside another organisation\'s dashboard.');
  }
  if (DRY) console.log('  Re-run with --apply to commit.');
  console.log('');
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
