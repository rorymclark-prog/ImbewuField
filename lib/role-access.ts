/**
 * Shared gate for the staff-only pages (app/ngo, app/funder, app/mentor). Each of those pages
 * used to spell out its own `role && !ALLOWED.has(role)` check inline — three copies of the same
 * rule, and all three had the same bug: `role &&` meant a signed-in user whose profile hadn't
 * loaded (or didn't exist) skipped the check entirely and fell through to the FULL staff
 * dashboard, not the "you don't belong here" screen. That happens for real: a Google-redirect
 * sign-in resolves `loading` before `getRedirectResult()` finishes writing the new profile doc,
 * and every funder account today is provisioned by hand in the Firebase console (see the
 * precondition notes in lib/network.ts) — a profile doc that lags the auth account, or never gets
 * created, is a live possibility, not a hypothetical.
 *
 * `role` is `UserRole | null` for two reasons that must be told apart by the CALLER, not here:
 * still loading (skip the check — the page's own `!loading` guard handles that), or resolved to
 * "no role" (deny). This function only ever sees the second case, so it fails CLOSED: null is
 * never a member of any allow-set.
 */

import type { UserRole } from './db/types';

export function canAccessRolePage(role: UserRole | null, allowed: ReadonlySet<UserRole>): boolean {
  return role !== null && allowed.has(role);
}
