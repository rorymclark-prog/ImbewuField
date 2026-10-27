// Decides whether a caught error's message is copy this app wrote for the farmer. A catch block
// used to do `err instanceof Error ? err.message : <friendly fallback>`, which also showed the
// browser's "Failed to fetch" and Firebase's "Missing or insufficient permissions" in whatever
// language the farmer had chosen (w25-09).
//
// The positive signal is UserFacingError: code that throws a message on purpose for the farmer
// (validation, "photo too large") throws this class, and only its message is ever shown.
// Everything else gets the call site's own fallback — or, for a network failure where a `t` is
// at hand, networkFailureMessage.
import { networkFailureMessage } from './network-failure';

export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof UserFacingError) return false;
  // fetch() rejects with a TypeError when there is no connection; its wording differs per browser.
  // Any other TypeError is a bug in the app, not the farmer's signal.
  if (err instanceof TypeError) return /failed to fetch|load failed|networkerror/i.test(err.message);
  const e = err as { name?: unknown; code?: unknown } | null;
  if (e?.name === 'FirebaseError') return e.code === 'unavailable' || e.code === 'firestore/unavailable';
  return false;
}

export function userFacingMessage(err: unknown, fallback: string, t?: (key: string) => string): string {
  if (err instanceof UserFacingError) return err.message;
  if (t && isNetworkFailure(err)) return networkFailureMessage(t);
  return fallback;
}
