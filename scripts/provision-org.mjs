/**
 * ImbewuField — organisation provisioning (Admin SDK)
 *
 * Fills the gap named in lib/network.ts §B: "there is also no way to PROVISION
 * a funder today: signup may only self-assign farmer|student, and no admin UI
 * or script promotes an account."
 *
 * firestore.rules pins `role` and `org_id` as immutable from the client
 * (rules §42–51), so staff onboarding can only happen through a trusted
 * Admin-SDK path. This is that path.
 *
 * Usage (DRY RUN by default — nothing is written without --apply):
 *
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id \
 *   node scripts/provision-org.mjs \
 *     --org "Africa Conservation Trust" --kind ngo \
 *     --programme "SEF Cycle 1" --funder "IDC" --deployed 4500000 \
 *     --grant sipho@act.org.za=ngo \
 *     --grant reviewer@idc.co.za=funder \
 *     --apply
 *
 * Attach people to an organisation that already exists:
 *   node scripts/provision-org.mjs --org-id abc123 --grant new@act.org.za=ngo --apply
 *
 * Let a funder see an org it funds. A funder funds SEVERAL NGOs, which the scalar org_id
 * cannot express, so the pairing lives in its own /grants collection (firestore.rules
 * `grantedOrg`), one document per funder-org/NGO-org pair, id `${funder_org_id}_${ngo_org_id}`:
 *   node scripts/provision-org.mjs --org-id <funderOwnOrg> \
 *     --grant reviewer@idc.co.za=funder --fund <ngoOrgId> --fund <otherNgoOrgId> --apply
 *
 * /grants is `allow write: if false` — no client, funder or otherwise, can create one — which
 * is exactly why it has to be minted here. THIS SCRIPT IS THE ONLY WRITER. A funder able to
 * widen its own reach would grant itself any organisation's farmer data, so the reach
 * deliberately does not live on a document the funder can edit.
 *
 * NOTE: profiles are keyed by AUTH UID (/profiles/{uid}), per firestore.rules.
 * Each grantee must already have signed in once so the account exists.
 */

import { existsSync, readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// ── args ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const grants = [];
const funds = [];
const opt = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--apply' || a === '--force' || a === '--allow-admin') { opt[a.slice(2)] = true; continue; }
  if (!a.startsWith('--')) continue;
  const v = argv[i + 1];
  if (v === undefined || v.startsWith('--')) { console.error(`ERROR: ${a} needs a value.`); process.exit(1); }
  i++;
  if (a === '--grant') grants.push(v);
  else if (a === '--fund') funds.push(v);
  else opt[a.slice(2)] = v;
}

const STAFF_ROLES = ['ngo', 'funder', 'mentor', 'admin'];
const DRY = !opt.apply;

if (!opt.org && !opt['org-id']) {
  console.error('ERROR: pass --org "Name" to create an organisation, or --org-id <id> to use an existing one.');
  process.exit(1);
}
if (opt.org && opt['org-id']) { console.error('ERROR: --org and --org-id are mutually exclusive.'); process.exit(1); }

if (opt.deployed !== undefined && !Number.isFinite(Number(opt.deployed))) {
  console.error(`ERROR: --deployed must be a number (got "${opt.deployed}").`);
  process.exit(1);
}

const kind = opt.kind ?? 'ngo';
if (opt.org && !['ngo', 'funder'].includes(kind)) {
  console.error(`ERROR: --kind must be ngo or funder (got "${kind}").`);
  process.exit(1);
}

const parsedGrants = grants.map((g) => {
  const at = g.lastIndexOf('=');
  if (at < 1) { console.error(`ERROR: --grant must be <email-or-uid>=<role>, got "${g}".`); process.exit(1); }
  const who = g.slice(0, at); const role = g.slice(at + 1);
  if (!STAFF_ROLES.includes(role)) {
    console.error(`ERROR: role "${role}" not allowed. Use one of: ${STAFF_ROLES.join(', ')}.`);
    console.error('       farmer and student are self-assigned at signup and are not granted here.');
    process.exit(1);
  }
  if (role === 'admin' && !opt['allow-admin']) {
    console.error('ERROR: granting admin requires --allow-admin (it bypasses every tenancy rule).');
    process.exit(1);
  }
  return { who, role };
});

// ── firebase admin ─────────────────────────────────────────────────────────

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) { console.error('ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID env var is required.'); process.exit(1); }
const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? './serviceAccount.json';
if (!existsSync(credPath)) {
  console.error(`ERROR: Service account not found at ${credPath}.`);
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS or place serviceAccount.json in the project root.');
  process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(readFileSync(credPath, 'utf8'))), projectId });
const db = getFirestore();
const auth = getAuth();

// ── run ────────────────────────────────────────────────────────────────────

async function resolveAccount(who) {
  if (who.includes('@')) {
    try { const u = await auth.getUserByEmail(who); return { uid: u.uid, label: `${who} (${u.uid})` }; }
    catch { return { uid: null, label: who, missing: true }; }
  }
  try { const u = await auth.getUser(who); return { uid: u.uid, label: `${u.email ?? '(no email)'} (${u.uid})` }; }
  catch { return { uid: null, label: who, missing: true }; }
}

async function main() {
  console.log(`\nImbewuField provisioning — project ${projectId}`);
  console.log(DRY ? '  MODE: dry run (nothing will be written). Add --apply to commit.\n'
                  : '  MODE: APPLY — this writes to the live database.\n');

  // 1. organisation
  let orgId = opt['org-id'];
  if (orgId) {
    const snap = await db.collection('organizations').doc(orgId).get();
    if (!snap.exists) { console.error(`ERROR: organisation ${orgId} does not exist.`); process.exit(1); }
    console.log(`[org]       using existing "${snap.data().name}" (${orgId})`);
  } else {
    const dupe = await db.collection('organizations').where('name', '==', opt.org).limit(1).get();
    if (!dupe.empty && !opt.force) {
      console.error(`ERROR: an organisation named "${opt.org}" already exists (${dupe.docs[0].id}).`);
      console.error('       Use --org-id to attach to it, or --force to create a second one anyway.');
      process.exit(1);
    }
    const ref = db.collection('organizations').doc();
    orgId = ref.id;
    console.log(`[org]       create "${opt.org}" kind=${kind} -> ${orgId}`);
    if (!DRY) await ref.set({ name: opt.org, kind, created_at: FieldValue.serverTimestamp() });
  }

  // 2. optional programme
  if (opt.programme) {
    const ref = db.collection('programmes').doc();
    const deployed = opt.deployed !== undefined ? Number(opt.deployed) : null;
    console.log(`[programme] create "${opt.programme}" funder=${opt.funder ?? 'none'} deployed=${deployed ?? 'null'} -> ${ref.id}`);
    if (!DRY) await ref.set({
      org_id: orgId, name: opt.programme, funder: opt.funder ?? null,
      deployed_amount: deployed, created_at: FieldValue.serverTimestamp(),
    });
  }

  // 3. funded orgs (item B) — every target validated BEFORE a single grant doc is written, so a
  //    typo in the third --fund cannot leave the first two already minted.
  if (funds.length) {
    const bad = [];
    for (const f of funds) {
      const snap = await db.collection('organizations').doc(f).get();
      if (!snap.exists) bad.push(f);
      else console.log(`[fund]      grants sight of "${snap.data().name}" (${f})`);
    }
    if (bad.length) {
      console.error(`ERROR: --fund names organisation(s) that do not exist: ${bad.join(', ')}.`);
      console.error('       Refusing to write an org id that resolves to nothing.');
      process.exit(1);
    }
    if (!parsedGrants.length) {
      console.error('ERROR: --fund needs at least one --grant <who>=funder.'); process.exit(1);
    }
    if (parsedGrants.some((g) => g.role !== 'funder')) {
      console.error('ERROR: --fund applies only to funder grants, and a non-funder grant was also given.');
      console.error('       Run the funder grant as its own command.');
      process.exit(1);
    }
    if (funds.includes(orgId)) {
      console.error(`ERROR: --fund ${orgId} is the funder's OWN org (--org-id). It already sees that one.`);
      process.exit(1);
    }

    // The grant is org->org, so it is written ONCE per pair and not per grantee — every funder
    // account in this org inherits it. Deterministic id makes re-running this a no-op instead
    // of a second, divergent grant for the same pairing.
    for (const f of funds) {
      const id = `${orgId}_${f}`;
      console.log(`[grant-doc] /grants/${id}`);
      if (!DRY) {
        await db.collection('grants').doc(id).set({
          funder_org_id: orgId, ngo_org_id: f,
          granted_at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  }

  // 4. staff grants
  let missing = 0;
  for (const { who, role } of parsedGrants) {
    const acct = await resolveAccount(who);
    if (acct.missing) {
      console.log(`[grant]     SKIP ${who} — no account. They must sign in once first.`);
      missing++; continue;
    }
    const pref = db.collection('profiles').doc(acct.uid);
    const existing = await pref.get();
    const before = existing.exists ? `${existing.data().role}/${existing.data().org_id ?? 'no-org'}` : 'new profile';
    // The funded orgs are NOT echoed onto the profile. They live only in /grants, so there is
    // exactly one place that answers "what may this funder see" and no second copy to drift.
    const fundNote = funds.length ? `  (org funds [${funds.join(', ')}] via /grants)` : '';
    console.log(`[grant]     ${acct.label}\n              ${before} -> ${role}/${orgId}${fundNote}`);
    if (!DRY) {
      await pref.set({
        role, org_id: orgId,
        ...(existing.exists ? {} : {
          full_name: null, language: 'en', id_number: null, phone: null,
          photo_url: null, created_at: FieldValue.serverTimestamp(),
        }),
      }, { merge: true });
    }
  }

  console.log(`\n${DRY ? 'Dry run complete — nothing written.' : 'Done.'}`);
  console.log(`  org_id: ${orgId}`);
  if (missing) console.log(`  ${missing} grant(s) skipped: account does not exist yet.`);
  if (DRY) console.log('  Re-run with --apply to commit these changes.');
  console.log('');
}

main().catch((e) => { console.error('\nFAILED:', e.message); process.exit(1); });
