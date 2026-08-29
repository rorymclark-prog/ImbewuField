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

/*
 * ── WHOSE LAND IS IT ─────────────────────────────────────────────────────────────────────────
 *
 * A different question from the one above, and the difference is the whole point.
 *
 * ROLE_GATED_ROUTES answers "will this page refuse you?" — it mirrors the four pages that call
 * canAccessRolePage. /farmer and /records refuse nobody: any signed-in account may open them and
 * they render perfectly. They are simply EMPTY, because both are strictly my-own surfaces —
 * /farmer draws the places this account saved (loadPlaces / resolveMainSite) and /records reads
 * myProduction, mySales and myExpenses.
 *
 * So for a programme officer, a mentor or a funder the farmer tabs are not doors that refuse.
 * They are doors onto an empty room with the light on, which is worse in one specific way: the
 * money book's Add buttons work. A funder whose own role description in lib/i18n.tsx reads
 * "Read-only impact oversight" can file a sale against their own profile and leave a row in the
 * org's ledger that no report will ever reconcile.
 *
 * WHY THIS FOLLOWS THE PERSON, NOT THE PAGE. /mentor admits mentor, ngo, funder AND admin (see
 * the table above), so answering per-route would hand an NGO officer the farmer's bar on
 * /mentor and take it away again on /funder — the same person, the same session, two answers.
 * Only the account can settle it.
 *
 * Who farms: 'farmer' plainly; 'student' because the nine-month course is practical work on the
 * learner's own plot and /records is where that work lands; 'admin' because the platform operator
 * is the escape hatch in every allow-set above and should never be shown less than exists.
 * 'mentor' is NOT on this list — lib/i18n.tsx describes the role as "Run the course, visit farms,
 * sign off progress", and the farms being visited are other people's.
 */
export const OWN_LAND_ROLES: ReadonlySet<UserRole> = new Set<UserRole>(['farmer', 'student', 'admin']);

/**
 * Does this account have a farm of its own — so that "my map" and "my money book" mean anything?
 *
 * A null role answers TRUE, exactly as canSeeNavLink does and for the same two reasons: signed
 * out is the sample tour, which has to show the farmer flow or the story disappears; and a
 * profile that lags its auth account by a beat must not make two tabs pop in late on a slow
 * phone. Nothing here is a security boundary — /farmer and /records are open to everyone and
 * always have been. This only decides whether OFFERING the tab is honest.
 */
export function farmsOwnLand(role: UserRole | null): boolean {
  if (role === null) return true;
  return OWN_LAND_ROLES.has(role);
}
