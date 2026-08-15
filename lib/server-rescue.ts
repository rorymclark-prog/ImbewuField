// THE RESCUE THAT CANNOT BE KILLED, BECAUSE IT DOES NOT RUN ON THE PHONE.
//
// 15 August, 08:44, battery at 7%: the same grey iOS screen, with every client-side guard this
// app owns already deployed — the load counter, the death watch, safe mode at threshold two. All
// of them share one assumption: that our JavaScript gets to RUN. A phone in Low Power Mode with
// nothing left gives the design page's bundle no chance to even finish starting; the rescue code
// dies with the patient, and the counter it faithfully maintains is read by nobody.
//
// The server has no such dependency. Cookies ride along with the page REQUEST itself, before a
// byte of JavaScript executes on the phone. So the middleware counts page requests in a
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

/** The same rescue for the farmer map — "it crashes in multiple places on the app". Separate
 *  cookies, because a design page dying must not hold the farmer map hostage or vice versa. */
export const FARMER_PULSE_COOKIE = 'imbewu_farmer_pulse';

/**
 * The rolling window, in seconds. The cookie expires on its own, so two crashes on a bad morning
 * do not brand the phone for life — a farmer who comes back after lunch starts clean without
 * anyone having to clear anything.
 */
export const RESCUE_WINDOW_S = 600;

/**
 * ONE, BECAUSE THE GREY SCREEN ARRIVES AT THE SECOND DEATH.
 *
 * The first shipped threshold was two, "matching the client guard" — and 15 August, 09:01, three
 * minutes AFTER that deploy went live, produced the same grey screenshot. The arithmetic was
 * wrong on the server side: iOS kills the page (request one), auto-reloads it once (request
 * two), kills it again — and shows "A problem repeatedly occurred". There is no third request.
 * A threshold of two redirected a request that iOS never makes; the rescue waited politely
 * behind the very screen it exists to prevent.
 *
 * At one, the automatic reload IS the redirect: the first death's reload lands on /design/lite
 * before a second death can happen, and the terminal screen — which needs two deaths on the same
 * URL — becomes unreachable. The price is that ONE unlucky kill sends the next open to the lite
 * page; its links put the farmer back in the full designer in one tap.
 */
export const RESCUE_THRESHOLD = 1;

/**
 * The one-shot grant behind the lite page's "try again" links (`?full=1`).
 *
 * `full=1` alone cannot simply mean "always pass": iOS's automatic reload repeats the SAME URL,
 * so after a granted retry dies, the reload arrives carrying full=1 too — and an unconditional
 * pass would run the heavy page straight into the second death and the grey screen (observed:
 * 09:03, the grey screen on ...&safe=1&full=1, the lite page's own light link). So a full=1
 * request without this grant cookie passes and PLANTS the grant; a full=1 request that still
 * carries the grant is the reload of a retry that just died, and it counts like any other
 * request — straight back to the lite page, never to a second death.
 *
 * Short-lived: it exists only to outlive one crash-and-reload cycle, and a healthy retry settles
 * and clears the pulse long before anyone taps "try again" twice.
 */
export const GRANT_COOKIE = 'imbewu_design_grant';
export const FARMER_GRANT_COOKIE = 'imbewu_farmer_grant';
export const GRANT_WINDOW_S = 60;

export interface RescueDecision {
  action: 'pass' | 'redirect';
  /** The count to store with the response when passing (the request we are now serving). */
  nextCount: number;
  /** Plant the one-shot grant cookie with this pass (a fresh `full=1` retry). */
  grant?: boolean;
}

/** Parse the cookie's count. Anything unreadable is a first visit — refusing the full designer
 *  on the strength of a corrupt string would be its own bug. */
export function parsePulse(value: string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Decide what this page request gets.
 *
 * `resetRequested` is the lite page's "try again" links (`?full=1`): a deliberate human choice
 * to go back in heavy, which passes and restarts the count — otherwise the redirect would be a
 * one-way door. `grantActive` is the one-shot grant riding with that choice: when it is still
 * present, this full=1 request is the automatic reload of a retry that died, and it must count,
 * not pass — see GRANT_COOKIE.
 */
export function decideDesignRescue(
  cookieValue: string | null | undefined,
  resetRequested: boolean,
  grantActive: boolean = false,
): RescueDecision {
  if (resetRequested && !grantActive) return { action: 'pass', nextCount: 1, grant: true };
  const count = parsePulse(cookieValue);
  if (count >= RESCUE_THRESHOLD) return { action: 'redirect', nextCount: count };
  return { action: 'pass', nextCount: count + 1 };
}

/** The client-side half of the contract: a page healthy enough to settle deletes its cookie.
 *  Kept here so the names and path stay in one module rather than being retyped at both ends. */
export function clearPulseCookie(name: string = RESCUE_COOKIE): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  } catch {
    /* a page that cannot write cookies still deserves its design */
  }
}
