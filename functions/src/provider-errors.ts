/**
 * Turning an image provider's failure into something the person looking at it can act on.
 *
 * WHY THIS IS ITS OWN FILE. What these functions return is stored on the sheet and printed, in
 * red, underneath the Design Studio's own controls — so it is farmer-facing copy, not a
 * diagnostic. The version this replaced was `OpenAI ${status}: ${body.slice(0, 200)}`, and Rory
 * met it on his own screen as:
 *
 *     Error: OpenAI 400: { "error": { "message": "Billing hard limit has been reached",
 *     ... "code": "hard_limit_reached" } }
 *
 * That tells someone standing in a field nothing they can do, and — worse — it does not say that
 * the free exact sheets are completely unaffected. A farmer who reads "Error" and stops has lost
 * a plan they could have had in one tap.
 *
 * TWO RULES. Never surface a JSON body or a provider error code. And where a failure only affects
 * PAID renders, say so in the same breath, because that is the difference between "the app is
 * broken" and "one optional finish is unavailable today".
 *
 * PURE MODULE — no firebase-admin, no network. functions/src/index.ts calls initializeApp() at
 * import time, so anything a test needs to reach has to live outside it.
 */

/**
 * @param status HTTP status from the provider.
 * @param detail Raw response body. Logged in full at the call site; never shown to a farmer.
 */
export function friendlyProviderError(status: number, detail: string): string {
  const body = detail.toLowerCase();
  // The account's own spend ceiling at OpenAI — not a fault in the app, the design or the sheet.
  if (body.includes('hard_limit_reached') || body.includes('billing hard limit')) {
    return 'AI maps are paused — the account has reached its spending limit. Your exact maps still work.';
  }
  if (body.includes('insufficient_quota') || body.includes('exceeded your current quota')) {
    return 'AI maps are paused — the account is out of credit. Your exact maps still work.';
  }
  if (status === 401 || status === 403 || body.includes('invalid_api_key')) {
    return 'AI maps are not set up on this version. Your exact maps still work.';
  }
  if (status === 429) {
    return 'The AI is busy right now — try this sheet again in a few minutes.';
  }
  if (status >= 500) {
    return 'The AI service had a problem. Try this sheet again in a few minutes.';
  }
  return 'The AI could not draw this sheet. Try again, or use the exact map.';
}
