/**
 * ImbewuField — pure decision logic for scripts/provision-org.mjs
 *
 * Split out of the CLI so the tenant-2-onboarding safety rules can be unit-tested with
 * node:test alone: no Firebase Admin SDK, no emulator, no argv parsing in the import path.
 * provision-org.mjs is the only caller; nothing in this file talks to Firestore or Auth.
 */

// Kept in sync with provision-org.mjs's own STAFF_ROLES — duplicated rather than imported
// because provision-org.mjs has top-level argv parsing that runs on import (see its own
// `import.meta.url` guard notes); pulling constants the other direction keeps this module's
// import graph side-effect-free. tests/provision-org-guards.test.ts asserts the two lists agree.
export const STAFF_ROLES = ['ngo', 'funder', 'mentor', 'admin'];

// Roles --attach may target. Deliberately NOT in STAFF_ROLES and vice versa: a single role
// string must never be valid for both a --grant (which can create a profile and change role)
// and an --attach (which can only touch org_id on a profile that already has this exact role).
export const ATTACHABLE_ROLES = ['farmer', 'student'];

/**
 * Would writing `newOrgId` onto an account that already has a DIFFERENT non-null org_id
 * silently move that person out of the org they are already in?
 *
 * This is the tenant-2 failure this guards against: org #2's admin runs --grant or --attach
 * with an email that turns out to already belong to one of org #1's real people (a typo, a
 * copy-pasted list that still has an old row in it, the same person legitimately working with
 * two NGOs). Before this guard, scripts/provision-org.mjs's `pref.set(..., {merge:true})` moved
 * them unconditionally — the dry-run output showed the before/after org on one line among
 * however many `--grant`s were on the command, which is exactly the kind of line a person
 * skims past at row 60 of 100.
 *
 * Returns `{ blocked: false }` when it is safe to proceed: no existing org_id, the SAME org_id
 * (re-running an already-applied grant), or the caller explicitly passed --reassign. Otherwise
 * `{ blocked: true, reason }`.
 */
export function checkReassignment({ existingOrgId, newOrgId, allowReassign }) {
  if (existingOrgId == null) return { blocked: false };
  if (existingOrgId === newOrgId) return { blocked: false };
  if (allowReassign) return { blocked: false };
  return {
    blocked: true,
    reason: `already in org ${existingOrgId}, not ${newOrgId}. Pass --reassign to move them on purpose.`,
  };
}

/**
 * Decide whether `--attach <who>=<role>` may set org_id on an EXISTING farmer/student profile.
 *
 * Deliberately narrower than the staff `--grant` path:
 *   - NEVER creates a profile. Farmer/student profiles are created by self-service signup only
 *     (firestore.rules `allow create` on /profiles, app/login/page.tsx SIGNUP_ROLES) — this script
 *     is not a second way to mint one, so `existingRole === undefined` (no profile yet) refuses.
 *   - NEVER changes `role`. A mistyped --attach must not silently promote or demote someone; the
 *     existing profile's role must already equal the requested role.
 *   - Reuses checkReassignment() for the same org-move protection --grant gets.
 *
 * This exists because, before it, there was NO admin-driven path at all to put a self-signed-up
 * farmer or student into an org: --grant's STAFF_ROLES check correctly refuses to hand out an
 * elevated ROLE for farmer/student (see app/login/page.tsx's privilege-escalation history), but
 * as a side effect it also made org_id unreachable for the two roles an NGO actually has 100 of.
 */
export function decideAttach({ existingRole, existingOrgId, requestedRole, newOrgId, allowReassign }) {
  if (!ATTACHABLE_ROLES.includes(requestedRole)) {
    return { ok: false, reason: `--attach role must be one of: ${ATTACHABLE_ROLES.join(', ')} (got "${requestedRole}"). Staff roles go through --grant.` };
  }
  if (existingRole === undefined) {
    return { ok: false, reason: 'no profile yet — they must sign in and complete signup (choosing Farmer or Student) first.' };
  }
  if (existingRole !== requestedRole) {
    return {
      ok: false,
      reason: `existing profile role is "${existingRole}", not "${requestedRole}". --attach never changes role — fix the --attach role to match, or use the Firebase console if this account genuinely needs a role change.`,
    };
  }
  const reassignment = checkReassignment({ existingOrgId, newOrgId, allowReassign });
  if (reassignment.blocked) return { ok: false, reason: reassignment.reason };
  return { ok: true };
}
