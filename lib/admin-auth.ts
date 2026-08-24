import { getApps, getApp, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { UserRole } from '@/lib/db/types';

// Guard for every app/api/admin/* route (user role/org assignment, org/grant creation — see
// design/plan for the full platform-admin scope). This is deliberately its own module rather
// than a reuse of lib/api-auth.ts's guardPaidApiRequest, for one reason: guardPaidApiRequest is
// SOFT by default (REQUIRE_API_AUTH gates whether a failure actually blocks the request) so the
// owner can smoke-test the paid-route auth cutover without breaking farmers mid-design. There is
// no equivalent cutover here and there must never be one — an admin route that silently let an
// unauthenticated or non-admin caller through while "still testing" is not a smoke test, it's a
// privilege-escalation hole. requireAdmin() below always hard-fails, independent of any env var.

export type VerifyAdminToken = (idToken: string) => Promise<{ uid: string }>;
export type LookupCallerRole = (uid: string) => Promise<UserRole | null>;

export interface AdminAuthResult {
  uid: string | null;
  response?: Response;
}

function adminApp() {
  if (getApps().length > 0) return getApp();
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) });
  }
  // No FIREBASE_SERVICE_ACCOUNT (e.g. a Cloud Functions runtime, or a local box with
  // GOOGLE_APPLICATION_CREDENTIALS set) — fall back to Application Default Credentials, same as
  // the bare initializeApp() already used for token verification in lib/api-auth.ts. If neither
  // is actually present, the Firestore calls below throw and requireAdmin() reports that as a
  // failed lookup (401), not silent access — the correct failure mode, not a security hole.
  return initializeApp();
}

async function verifyWithFirebaseAdmin(idToken: string): Promise<{ uid: string }> {
  return getAuth(adminApp()).verifyIdToken(idToken);
}

async function lookupCallerRoleFromFirestore(uid: string): Promise<UserRole | null> {
  const snap = await getFirestore(adminApp()).collection('profiles').doc(uid).get();
  if (!snap.exists) return null;
  const role = snap.data()?.role;
  return typeof role === 'string' ? (role as UserRole) : null;
}

/**
 * The credentialed Admin SDK Firestore handle, shared by every app/api/admin/* route so the
 * cert(...)-vs-ADC init logic above lives in exactly one place. Safe to call once per request —
 * adminApp() reuses the already-initialised app rather than re-initialising.
 */
export function getAdminFirestore() {
  return getFirestore(adminApp());
}

function rejected(routeName: string, reason: string, status: 401 | 403): AdminAuthResult {
  console.warn(`[admin-auth] ${routeName}: rejected (${reason})`);
  const message = status === 401 ? 'Authentication required.' : 'Admin access required.';
  return {
    uid: null,
    response: new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

/**
 * Authenticate + authorise a request to app/api/admin/*. Always hard-fails (never log-only) on a
 * missing/invalid bearer token or on a caller whose Firestore profile role isn't 'admin' —
 * independent of REQUIRE_API_AUTH, which this module never reads. The verifier and role-lookup
 * arguments keep the policy unit-testable without real Firebase credentials or network access.
 */
export async function requireAdmin(
  req: Request,
  routeName: string,
  verifyToken: VerifyAdminToken = verifyWithFirebaseAdmin,
  lookupRole: LookupCallerRole = lookupCallerRoleFromFirestore,
): Promise<AdminAuthResult> {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return rejected(routeName, 'missing bearer token', 401);

  let uid: string;
  try {
    const decoded = await verifyToken(match[1]);
    if (!decoded?.uid) return rejected(routeName, 'token had no uid', 401);
    uid = decoded.uid;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'token verification failed';
    return rejected(routeName, reason.slice(0, 160), 401);
  }

  let role: UserRole | null;
  try {
    role = await lookupRole(uid);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'profile lookup failed';
    return rejected(routeName, reason.slice(0, 160), 401);
  }

  if (role !== 'admin') return rejected(routeName, `uid ${uid} has role ${role ?? 'none'}`, 403);

  return { uid };
}
