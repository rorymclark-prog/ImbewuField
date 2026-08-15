// THE RESCUE THAT CANNOT BE KILLED, BECAUSE IT DOES NOT RUN ON THE PHONE.
//
// 15 August, 08:44, battery at 7%: the same grey iOS screen, with every client-side guard this
// app owns already deployed — the load counter, the death watch, safe mode at threshold two. All
// of them share one assumption: that our JavaScript gets to RUN. A phone in Low Power Mode with
// nothing left gives the design page's bundle no chance to even finish starting; the rescue code
// dies with the patient, and the counter it faithfully maintains is read by nobody.
//
// The server has no such dependency. Cookies ride along with the page REQUEST itself, before a
// byte of JavaScript executes on the phone. So the middleware counts design-page requests in a
// short-lived cookie; a page healthy enough to settle clears it from the client; and a count
// that keeps climbing means this phone is opening the page and never surviving long enough to
// say so. At the threshold the server answers with a REDIRECT to /design/lite — a page of a few
// kilobytes with no map, no studio and no photo pipeline, which opens on any phone at any
// battery because there is nothing left to kill.
//
// Rory: "I need to sell this thing with confidence." This is the floor under that confidence:
// whatever else fails, the app's worst screen is now a branded, working page with a way back in
// — never Apple's grey apology.
//
// Pure logic here, Web-API-only (this is imported by middleware, which runs on the Edge runtime
// — no Node built-ins), so the policy is testable without a server.

/** Scoped to the design path so an unrelated page's requests never inflate the count. */
export const RESCUE_COOKIE = 'imbewu_design_pulse';

/**
 * The rolling window, in seconds. The cookie expires on its own, so two crashes on a bad morning
 * do not brand the phone for life — a farmer who comes back after lunch starts clean without
 * anyone having to clear anything.
 */
export const RESCUE_WINDOW_S = 600;

/** Same rationale as the client threshold: iOS grants one automatic reload; the second death is
 *  the terminal screen. Two requests with no survival between them is the loop. */
export const RESCUE_THRESHOLD = 2;

export interface RescueDecision {
  action: 'pass' | 'redirect';
  /** The count to store with the response when passing (the request we are now serving). */
  nextCount: number;
}

/** Parse the cookie's count. Anything unreadable is a first visit — refusing the full designer
 *  on the strength of a corrupt string would be its own bug. */
export function parsePulse(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Decide what this design-page request gets.
 *
 * `resetRequested` is the lite page's "try again" links (`?full=1`): a deliberate human choice
 * to go back in heavy, which both passes and restarts the count — otherwise the redirect would
 * be a one-way door.
 */
export function decideDesignRescue(cookieValue: string | null | undefined, resetRequested: boolean): RescueDecision {
  if (resetRequested) return { action: 'pass', nextCount: 1 };
  const count = parsePulse(cookieValue);
  if (count >= RESCUE_THRESHOLD) return { action: 'redirect', nextCount: count };
  return { action: 'pass', nextCount: count + 1 };
}

/** The client-side half of the contract: a page healthy enough to settle deletes the cookie.
 *  Kept here so the name and path stay in one module rather than being retyped at both ends. */
export function clearPulseCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${RESCUE_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } catch {
    /* a page that cannot write cookies still deserves its design */
  }
}
