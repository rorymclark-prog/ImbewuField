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

/*
 * ── WHICH GATED ROUTES A NAVIGATION SURFACE MAY OFFER ────────────────────────────────────────
 *
 * The gate above is called by the four pages that need it, and it works. What did not work was
 * everything that LINKS to them: components/NavDrawer.tsx offered all 22 links to everybody, and
 * app/home/page.tsx rendered a "Dashboards · Farmer · Mentor · NGO · Funder · Student" row that
 * was equally unfiltered — it imports useAuth and destructures `{ user }`, never `role`. So a
 * farmer was handed four doors that open onto "This is the NGO area".
 *
 * That is worse than untidy for the farmer this was audited against: an isiZulu-speaking
 * smallholder learning the phone cannot tell a door she is not allowed through from one she is
 * using wrong, so a refusal screen reads as "I broke it".
 *
 * THE REGISTRY IS DUPLICATION, AND THAT IS WHY THERE IS A TEST. Each page still declares its own
 * allow-set inline — that is the real gate and it must stay next to the code it protects. This
 * mirror exists so navigation can ask the question WITHOUT importing four page components, and
 * tests/nav-role-filtering.test.ts parses those four pages and asserts this table still matches
 * them exactly. If someone widens a page's roles and forgets this file, the test fails rather
 * than the menu quietly hiding a page the user is now allowed to open.
 */
export const ROLE_GATED_ROUTES: Readonly<Record<string, ReadonlySet<UserRole>>> = Object.freeze({
  '/network': new Set<UserRole>(['ngo', 'funder', 'admin']),
  '/funder':  new Set<UserRole>(['funder', 'admin']),
  '/mentor':  new Set<UserRole>(['mentor', 'ngo', 'funder', 'admin']),
  '/ngo':     new Set<UserRole>(['ngo', 'admin']),
});

/**
 * May a navigation surface show this link?
 *
 * Ungated routes are always shown. A gated route is hidden ONLY when we have a resolved role that
 * fails its gate — deliberately not when the role is merely unknown:
 *
 *   • signed out — the sample/demo tour is meant to show what the programme dashboards look like,
 *     and hiding them would quietly delete that story. Those routes bounce to /login themselves.
 *   • signed in, profile still loading — `role` is null for a moment on a Google redirect (see the
 *     note above). Hiding on null would make links appear a beat late, which reads as a glitch on
 *     a slow phone. The page's own gate is what actually protects it; this only decides whether
 *     offering the link is honest, and offering it for one render is not a security question.
 *
 * The query string is ignored so `/farmer?panel=Reports` matches `/farmer`.
 */
export function canSeeNavLink(role: UserRole | null, href: string): boolean {
  const path = href.split('?')[0].split('#')[0];
  const allowed = ROLE_GATED_ROUTES[path];
  if (!allowed) return true;      // not a gated route
  if (role === null) return true;  // unknown role — see above
  return allowed.has(role);
}
