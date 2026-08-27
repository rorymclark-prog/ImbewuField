/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  SERVER-SIDE AUTHORISATION FOR THE FUNDER PORTFOLIO — precondition (A)   ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * lib/network.ts states the requirement: a route that, in this order,
 *   (i)   verifies the caller's Firebase ID token,
 *   (ii)  loads /profiles/{callerUid} SERVER-SIDE and asserts the role — never
 *         trusting a role the client sent,
 *   (iii) asserts the target farmer's org is in the caller's funded set AND
 *         that the farmer consented to each scope,
 *   (iv)  reads with the Admin SDK and returns a PROJECTION.
 *
 * THIS MODULE IS STEPS (ii) AND (iii), AND NOTHING ELSE. It is deliberately
 * pure — no Firebase, no fetch, no environment — so the authorisation policy
 * can be exhaustively unit-tested without credentials, and so that reviewing it
 * means reading one file rather than tracing a request handler. The route in
 * app/api/network/farmers/route.ts supplies (i) and (iv) and owns no policy.
 *
 * WHY A CLIENT-SIDE FIRESTORE READ CANNOT DO THIS JOB. firestore.rules can now
 * express "this funder funds this NGO" (the /grants join collection, checked by
 * `grantedOrg()`), so a client read is no longer wide open. But rules cannot
 * express "return the income figure only if
 * this farmer ticked the sales box", because a rule decides whether a DOCUMENT
 * is readable, not which FIELDS of it are. Consent is per-scope, so honouring
 * it requires computing a projection somewhere the farmer's raw documents are
 * not already in the reader's hands. That is here.
 */

import type { UserRole } from './db/types';

/** The caller's own profile, loaded server-side. Never assembled from request input. */
export interface CallerProfile {
  id: string;
  role: UserRole;
  org_id: string | null;
  /**
   * The NGO orgs this funder may read, resolved by the CALLER from /grants —
   * one doc per funder-org/NGO-org pairing, `allow write: if false`, so only an
   * Admin-SDK script (scripts/provision-org.mjs --fund) can mint one. It is
   * passed in rather than read here so this module stays pure and testable;
   * the route owns the query. Absent or empty means this funder funds nothing.
   */
  fundedOrgIds?: string[];
}

export type AccessDenied = { ok: false; status: 401 | 403; reason: string };
export interface AccessGranted {
  ok: true;
  callerId: string;
  role: UserRole;
  /**
   * The orgs this caller may see BY NAME. For an admin this is not the whole answer —
   * see `allOrgs`, which is what actually decides an admin's reach. It can be empty for
   * an admin (and only for an admin), because a platform admin need not belong anywhere.
   */
  visibleOrgIds: string[];
  /**
   * ADMIN ONLY: this caller may see every org, including ones not in `visibleOrgIds`.
   *
   * This exists because the platform admin role was a master key that opened nothing. The
   * rules have always given admin an unconditional bypass (`isAdmin()` short-circuits both
   * org scoping and the consent gate), but this module refused an admin whose `org_id` was
   * null — which is the NORMAL state for a platform admin, since admins are not members of
   * a tenant. The result was an account with permission to read everything and a portfolio
   * containing nothing, and the failure looked exactly like "there is no data yet".
   *
   * Kept as an explicit flag rather than by stuffing every org id into `visibleOrgIds`:
   * that would need a full read of /organizations here (this module is pure), and it would
   * silently go stale the moment an org is created.
   */
  allOrgs: boolean;
}
export type NetworkAccess = AccessGranted | AccessDenied;

const PORTFOLIO_ROLES: readonly UserRole[] = ['ngo', 'funder', 'admin'];

/**
 * Step (ii)+(iii-a): may this caller see a portfolio at all, and whose?
 *
 * `profile` MUST come from a server-side read of /profiles/{uid} keyed by the
 * uid decoded from the verified token. Passing anything a client supplied
 * defeats the entire check.
 */
export function decideNetworkAccess(profile: CallerProfile | null): NetworkAccess {
  if (!profile) {
    // Authenticated but no profile doc. Not an error to explain in detail — a
    // caller probing for which uids have profiles learns nothing from this.
    return { ok: false, status: 403, reason: 'No profile for this account.' };
  }
  if (!PORTFOLIO_ROLES.includes(profile.role)) {
    return { ok: false, status: 403, reason: 'This account is not a programme or funder account.' };
  }

  // A funder sees the orgs it funds. It may also have an org of its own (the funding
  // institution itself), which carries no farmers — including it is harmless and keeps
  // this decision the same shape as firestore.rules `staffOrgAccess() || grantedOrg()`.
  const visible = new Set<string>();
  if (profile.org_id) visible.add(profile.org_id);
  if (profile.role === 'funder') {
    for (const id of profile.fundedOrgIds ?? []) if (id) visible.add(id);
  }

  // Admin is the platform role, not a tenant role, so it is decided BEFORE the org check
  // below — an admin with no org is the normal case, not a misconfigured one.
  if (profile.role === 'admin') {
    return { ok: true, callerId: profile.id, role: profile.role, visibleOrgIds: [...visible], allOrgs: true };
  }

  if (visible.size === 0) {
    // An org-less staff account. This is the state EVERY staff account was in before
    // scripts/provision-org.mjs existed, and it must resolve to "sees nothing" rather
    // than to a null that some downstream comparison treats as a wildcard.
    return { ok: false, status: 403, reason: 'This account is not linked to an organisation.' };
  }
  return { ok: true, callerId: profile.id, role: profile.role, visibleOrgIds: [...visible], allOrgs: false };
}

/** Step (iii-b): is this specific farmer inside the caller's visible set? */
export function canSeeOrg(access: NetworkAccess, orgId: string | null | undefined): boolean {
  if (!access.ok) return false;
  if (!orgId) return false;              // an org-less farmer belongs to no portfolio, admin included
  if (access.allOrgs) return true;
  return access.visibleOrgIds.includes(orgId);
}

/**
 * Narrow a candidate list to what the caller may see. Returns the kept rows and a
 * count of what was dropped, so the route can log the drop instead of silently
 * shrinking a response — a portfolio that quietly returns fewer farmers than the
 * org actually has is indistinguishable from farmers having left the programme.
 */
export function scopeToVisible<T extends { orgId?: string | null; org_id?: string | null }>(
  access: NetworkAccess, rows: readonly T[],
): { visible: T[]; withheld: number } {
  if (!access.ok) return { visible: [], withheld: rows.length };
  const visible = rows.filter((r) => canSeeOrg(access, r.orgId ?? r.org_id ?? null));
  return { visible, withheld: rows.length - visible.length };
}
