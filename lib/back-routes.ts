/**
 * WHERE THE GLOBAL "BACK" BUTTON MAY APPEAR.
 *
 * Every page should offer a way back (Rory: "we need a simple go back to the last page button for
 * everything every page") — but a floating control that appears unconditionally is worse than
 * none in three specific places, so the rule lives here, in plain TypeScript, under test.
 *
 * Pure and DOM-free on purpose: components/BackControl.tsx consumes it, and a rule about
 * navigation should be checkable without rendering React.
 */

/**
 * Routes that must NOT get the floating back button.
 *
 * The four tab-bar destinations are top-level — the tab bar IS their navigation, and "back" from
 * a home screen means leaving the app. (`/records` took `/finances`'s place in that four when the
 * two money screens were merged into one book; /finances is now only a redirect onto it.) The auth routes are gates, where a back button offers an
 * escape from the very thing the gate exists to enforce. `/design` draws its own arrow in its
 * title bar, positioned where its own layout expects it; a second one would both duplicate and
 * collide. `/partners` is the public NGO/funder showcase — reached only by an external link
 * (email, QR code, a conference flyer), never from in-app navigation, so `window.history.length`
 * is typically 1 and the fallback's own goBack() would push an anonymous visitor into /home —
 * the signed-in app the button has no business sending them to. Same class of exclusion as the
 * auth gates, for the same reason: nowhere real to go back to.
 *
 * Keep this list short. Every entry is a page where "every page has a back button" is knowingly
 * untrue, so each one needs a reason.
 */
export const NO_FLOATING_BACK: ReadonlySet<string> = new Set([
  '/', '/home', '/farmer', '/records', '/account', '/login', '/gate', '/design', '/partners',
  // /pitch is the projector deck: it is opened directly for a meeting, owns the whole
  // viewport, and has its own Back/Next controls — a floating back button over a slide
  // would be a second, wrong navigation system.
  '/pitch',
  // /welcome is the public front door, reached from outside the app entirely (a search result,
  // a link in a funder's email, a QR code on a flyer). Same reason /partners is on this list:
  // history.length is 1, so the fallback's goBack() would push a stranger who has never signed
  // in into /home. The page carries its own "Sign in / Get started" as its only forward action.
  '/welcome',
]);

/** Whether the floating fallback may render for this path. */
export function floatingBackAllowed(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Compare on the FIRST SEGMENT as well as the whole path, so a nested route follows its
  // section's rule: /journal/2026-07 gets a button, /design/anything does not.
  const first = pathname.split('/').filter(Boolean)[0];
  const root = `/${first ?? ''}`;
  return !NO_FLOATING_BACK.has(pathname) && !NO_FLOATING_BACK.has(root);
}
