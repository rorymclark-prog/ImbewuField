/*
 * ── THE ROUTES A STRANGER READS ──────────────────────────────────────────────────────────────
 *
 * ImbewuField's marketing pages exist to be read by people who are not signed in and may never
 * sign in: an NGO programme manager comparing tools, a funder sent a link in an email, a search
 * crawler. Everything else in this app is the opposite — it is someone's own farm, and it is
 * worth nothing until we know whose.
 *
 * That difference is why this list exists. AuthProvider holds the whole tree unmounted behind a
 * pulsing dot until Firebase has told us who is signed in, because until then the browser-storage
 * namespace is not yet bound and an account-bound screen would read the wrong farmer's rows (see
 * lib/account-local-storage.ts, and the header comment on mountedAccountUid in particular). That
 * hold is correct for a farm. It is exactly wrong for a page whose whole job is to be readable by
 * someone with no account at all: it means the SERVER-RENDERED html for these routes contains the
 * spinner and nothing else — no headings, no sections, no links — so a crawler that does not run
 * JavaScript sees a pulsing dot, and an entry-level Android on a weak connection waits for the
 * whole bundle before it sees a single word.
 *
 * WHY IT IS SAFE TO LET THESE THREE THROUGH, and why the list must stay short. A route may only
 * be added here if it reads no account-scoped browser storage, because these routes render in the
 * window BEFORE the storage namespace is bound. As at this commit:
 *   - /partners is a server component with no client state whatsoever;
 *   - /pitch is a client component that touches no localStorage of its own;
 *   - /welcome does not exist on main yet — it arrives with the open /welcome pull request, and
 *     is listed now so that it lands already fixed rather than shipping the spinner for a while.
 * The only account-scoped read anywhere in the shared chrome is LanguageProvider's onboarding
 * flag, and the gate that consumes it (components/AccountOnboardingGates.tsx) renders null for
 * the entire time `loading` is true — so it cannot act on a pre-bind value. AuthProvider also
 * keeps its accountTreeKey Fragment on this path, so the moment Firebase resolves an identity the
 * subtree remounts and re-reads under the right namespace.
 *
 * ADDING A ROUTE HERE IS A DATA-SAFETY DECISION, not a performance one. If a page shows anything
 * belonging to a particular person, it does not belong on this list no matter how much faster it
 * would paint.
 */

export const PUBLIC_MARKETING_ROUTES: readonly string[] = ['/welcome', '/partners', '/pitch'];

/**
 * Is this the kind of page a signed-out stranger is supposed to be able to read?
 *
 * A null pathname answers FALSE — deliberately the safe direction. usePathname() returns null
 * outside a Next.js router (isolated component tests, any future non-router mount), and an
 * unknown route must be treated as somebody's farm rather than as public.
 *
 * Matching is exact, or a path segment below the route. A prefix test alone would be wrong:
 * '/partnerships-private' starts with '/partners' and would silently join the public list.
 */
export function isPublicMarketingRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_MARKETING_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * Should AuthProvider replace the whole tree with its holding screen right now?
 *
 * Pulled out as a pure function so the decision can be tested directly and so the three inputs
 * are named where someone changing one of them will read the reason. The rule it encodes:
 * suspend while the account is unresolved, EXCEPT on a page that never needed an account.
 */
export function shouldSuspendAccountTree(input: {
  backendConfigured: boolean;
  loading: boolean;
  pathname: string | null | undefined;
}): boolean {
  const { backendConfigured, loading, pathname } = input;
  if (!backendConfigured) return false;
  if (!loading) return false;
  return !isPublicMarketingRoute(pathname);
}
