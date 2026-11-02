// Shared mapping from a failed /api/* fetch to a short, translated, farmer-facing message —
// never a bare status code, "Failed to fetch", "API error 500", or "HTTP 429" (lang-08 +
// bug-10). app/farmer/page.tsx's header pill, AreaPanel, AtlasExplorer and SiteDesign's network
// call each used to build their own ad hoc string from `res.status` or a thrown Error's own
// .message and show it directly to the farmer.
//
// Callers pass the HTTP status when they have it (the `!res.ok` branch already knows res.status)
// rather than this module inspecting a thrown Error's message — that keeps a genuinely
// farmer-facing message the app wrote for itself (e.g. SiteDesign's own validation errors)
// separate from a raw network/server failure, so only the latter goes through this mapping.

export interface NetworkFailureOptions {
  /** The failed response's HTTP status, when known. */
  status?: number;
  /**
   * A response body this app already wrote AS farmer-facing copy — currently only the 429
   * rate-limit message from lib/api-rate-limit.ts, which says what happened and how long to
   * wait. Shown verbatim only when status is 429; every other status in this app's API routes
   * returns a developer-facing error body, not farmer copy, so it is never passed through.
   */
  serverMessage?: string | null;
  /**
   * Whether the browser was offline WHEN THE REQUEST FAILED. A screen that keeps the failure and
   * words it at render time (so it follows a language chunk that loads after the request) sets this
   * through networkFailure(); left out, the current navigator.onLine decides, as before.
   */
  offline?: boolean;
}

/** True when the browser itself reports no connection — checked before the status, since a
 *  farmer who is offline does not need to be told the request was "busy" or "failed". */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function networkFailureMessage(t: (key: string) => string, opts: NetworkFailureOptions = {}): string {
  if (opts.offline ?? isOffline()) return t('networkOffline');
  if (opts.status === 429) return opts.serverMessage || t('networkBusy');
  return t('networkFailed');
}

/**
 * The failure itself, to keep in state instead of its wording. A message built when the request fails
 * is fixed in whatever language was loaded THEN: an isiXhosa reader whose locale chunk arrives a moment
 * later keeps the English. Keep this, and word it with networkFailureMessage(t, ...)
 * when rendering, so the text follows the language that is showing.
 */
export function networkFailure(opts: NetworkFailureOptions = {}): NetworkFailureOptions {
  return { ...opts, offline: isOffline() };
}
