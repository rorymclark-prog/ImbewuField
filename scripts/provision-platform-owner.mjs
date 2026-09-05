/**
 * One-time owner bootstrap authorised by Rory on 5 September 2026.
 * Unlike organisation onboarding, this changes only an existing account's role:
 * it must not manufacture an organisation or move the owner's existing records.
 *
 * The reviewed account is pinned by its email digest so the email is not published
 * in source or logs. Firebase Auth has no digest lookup: accounts are scanned in
 * memory, retaining only the exact match. No user list is logged or exported.
 *
 * Dry run: node scripts/provision-platform-owner.mjs
 * Apply:   node scripts/provision-platform-owner.mjs --apply --allow-admin
 * Credentials stay in the trusted runner's environment, never in this repository.
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const PROJECT_ID = 'fieldproof-sa';
const TARGET_EMAIL_HASH = 'd1ab441e8199a620545ca8751ab0492f6c58396cb6ce7eb4a51bc50652d933a1';
const AUDIT_ID = 'platform-owner-bootstrap-2026-09-05';
const ROLES = new Set(['farmer', 'student', 'mentor', 'ngo', 'funder', 'admin']);

export function emailDigest(email) {
  return createHash('sha256').update(String(email ?? '').trim().toLowerCase()).digest('hex');
}

export function verifyOwnerAccount(user, expectedDigest) {
  if (!user?.uid || !user.email || emailDigest(user.email) !== expectedDigest) {
    throw new Error('OWNER_IDENTITY_MISMATCH');
  }
  if (user.disabled) throw new Error('OWNER_ACCOUNT_DISABLED');
  if (!user.emailVerified) throw new Error('OWNER_EMAIL_NOT_VERIFIED');
}

export async function findOwnerAccount(auth, expectedDigest) {
  let pageToken;
  let match;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.email && emailDigest(user.email) === expectedDigest) {
        if (match) throw new Error('OWNER_IDENTITY_AMBIGUOUS');
        match = { uid: user.uid };
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  if (!match) throw new Error('OWNER_ACCOUNT_NOT_FOUND');
  // Re-read this account immediately before checking its verified/disabled state.
  const account = await auth.getUser(match.uid);
  verifyOwnerAccount(account, expectedDigest);
  return account;
}

export async function provisionPlatformOwner({ auth, db, expectedDigest = TARGET_EMAIL_HASH,
  auditId = AUDIT_ID, apply = false, allowAdmin = false, timestamp, runId = null }) {
  if (apply && !allowAdmin) throw new Error('EXPLICIT_ADMIN_FLAG_REQUIRED');
  const account = await findOwnerAccount(auth, expectedDigest);
  const profileRef = db.collection('profiles').doc(account.uid);
  // org_access_audit already denies every client read/write. The marker is also
  // the replay guard: rerunning CI must never undo a later deliberate revocation.
  const auditRef = db.collection('org_access_audit').doc(auditId);
  const result = await db.runTransaction(async (tx) => {
    const [profile, audit] = await Promise.all([tx.get(profileRef), tx.get(auditRef)]);
    if (!profile.exists) throw new Error('OWNER_PROFILE_NOT_FOUND');
    const before = profile.data();
    if (!ROLES.has(before.role)) throw new Error('OWNER_PROFILE_ROLE_UNKNOWN');
    if (audit.exists) {
      const recorded = audit.data();
      if (recorded.uid !== account.uid || recorded.email_digest !== expectedDigest) {
        throw new Error('OWNER_AUDIT_IDENTITY_MISMATCH');
      }
      if (before.role !== 'admin') throw new Error('OWNER_ACCESS_WAS_REVOKED');
      return { status: 'already-completed', previousRole: recorded.previous_role,
        orgId: before.org_id ?? null };
    }
    if (apply) {
      // update, not set: this must not silently create a partial profile.
      tx.update(profileRef, { role: 'admin' });
      tx.create(auditRef, { type: 'platform_owner_provisioning', uid: account.uid,
        email_digest: expectedDigest, previous_role: before.role,
        org_id: before.org_id ?? null, created_at: timestamp(), run_id: runId });
    }
    return { status: apply ? 'applied' : 'dry-run', previousRole: before.role,
      orgId: before.org_id ?? null };
  });
  if (apply) {
    const saved = (await profileRef.get()).data();
    if (saved?.role !== 'admin' || (saved.org_id ?? null) !== result.orgId) {
      throw new Error('OWNER_ACCESS_READBACK_FAILED');
    }
  }
  // Neither identity nor organisation names/IDs belong in public workflow logs.
  return { status: result.status, previousRole: result.previousRole,
    role: apply || result.status === 'already-completed' ? 'admin' : result.previousRole,
    organisationPreserved: true };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if ([...args].some((arg) => !['--apply', '--allow-admin'].includes(arg))) {
    throw new Error('UNKNOWN_ARGUMENT');
  }
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('PRODUCTION_BOOTSTRAP_REFUSES_EMULATOR');
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('ADMIN_CREDENTIAL_UNAVAILABLE');
  let credential;
  try { credential = JSON.parse(raw); } catch { throw new Error('ADMIN_CREDENTIAL_INVALID_JSON'); }
  if (credential.project_id !== PROJECT_ID) throw new Error('ADMIN_CREDENTIAL_WRONG_PROJECT');
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const app = initializeApp({ credential: cert(credential), projectId: PROJECT_ID });
  try {
    const result = await provisionPlatformOwner({ auth: getAuth(app), db: getFirestore(app),
      apply: args.has('--apply'), allowAdmin: args.has('--allow-admin'),
      timestamp: () => FieldValue.serverTimestamp(), runId: process.env.GITHUB_RUN_ID ?? null });
    console.log(JSON.stringify({ project: PROJECT_ID, ...result }));
  } finally { await deleteApp(app); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = /^[A-Z_]+$/.test(error.message ?? '') ? error.message : error.code ?? 'OWNER_BOOTSTRAP_FAILED';
    console.error(`Owner provisioning failed: ${code}`);
    process.exitCode = 1;
  });
}
