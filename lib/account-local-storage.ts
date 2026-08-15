'use client';

import { getFirebase, isBackendConfigured } from './firebase/init';

// Account-local browser data must never use one shared physical key while a user is
// signed in. The suffix deliberately keeps the historical base key readable in logs
// and lets prefix-based stores (surveys, site elements, design canvases) enumerate only
// the current account's rows.
const OWNER_SEPARATOR = '::imbewu-owner::';
const USER_OWNER_PREFIX = 'uid:';
const SIGNED_OUT_OWNER = 'guest';
const SAMPLE_MODE_FLAG = 'imbewu_sample_mode';

// Firebase mutates auth.currentUser before its observer reaches React. Sampling that
// singleton directly during an A → B transition lets one last timer from A choose B's
// namespace in the small gap before AuthProvider unmounts A. AuthProvider therefore
// binds this value only after the old account subtree is gone and before the new one
// mounts. `undefined` preserves a safe fallback for isolated helpers/tests rendered
// without AuthProvider.
let mountedAccountUid: string | null | undefined;

export function bindMountedAccountLocalStorageUid(uid: string | null): void {
  mountedAccountUid = uid;
}

function sampleModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Keep this tiny check local instead of importing sample-mode.ts. That module imports
    // demo-farm, which imports storage-backed design modules; importing it here would create
    // a runtime cycle at the storage boundary itself.
    return window.sessionStorage.getItem(SAMPLE_MODE_FLAG) === '1';
  } catch {
    return false;
  }
}

export function accountLocalStorageKey(baseKey: string, uid: string | null | undefined): string {
  return uid
    ? `${baseKey}${OWNER_SEPARATOR}${USER_OWNER_PREFIX}${encodeURIComponent(uid)}`
    : baseKey;
}

export function activeAccountUid(): string | null {
  // Sample mode's root storage shim is intentionally seeded with historical bare keys.
  // Returning no owner preserves that isolated in-memory namespace even if a real user
  // happens to be signed in behind the sample.
  if (typeof window === 'undefined' || sampleModeActive()) return null;
  if (mountedAccountUid !== undefined) return mountedAccountUid;
  return getFirebase()?.auth?.currentUser?.uid ?? null;
}

export function activeAccountLocalStorageKey(baseKey: string): string {
  if (typeof window === 'undefined' || sampleModeActive()) return baseKey;
  const uid = activeAccountUid();
  if (uid) return accountLocalStorageKey(baseKey, uid);
  // Production has real accounts, so "signed out" must not reveal historical bare
  // data left by an old app version. A dedicated guest namespace keeps signed-out
  // drafts usable without treating an unknown legacy owner as public data. Builds
  // with no backend configured retain their original local-only bare-key behaviour.
  return isBackendConfigured()
    ? `${baseKey}${OWNER_SEPARATOR}${SIGNED_OUT_OWNER}`
    : baseKey;
}

/**
 * Retire an owner-unknown legacy row only after a real signed-in account has written its
 * account-scoped replacement. Guest, sample and backend-unconfigured sessions keep their
 * historical bare-key storage.
 */
export function removeSignedInLegacyLocalStorageKey(baseKey: string): void {
  if (typeof window === 'undefined' || !activeAccountUid()) return;
  try {
    window.localStorage.removeItem(baseKey);
  } catch {
    // Storage may be unavailable in privacy/quota modes. The scoped replacement still stands.
  }
}

/**
 * True only for a prefix-keyed row owned by `uid`.
 *
 * Bare rows are legacy/guest data. They remain readable while signed out (and in the
 * sample sandbox), but are never silently assigned to the first account that signs in:
 * legacy storage has no trustworthy ownership evidence, and guessing recreates the
 * cross-account data-loss bug this boundary exists to prevent.
 */
export function accountLocalStorageKeyMatchesPrefix(
  physicalKey: string,
  basePrefix: string,
  uid: string | null | undefined,
): boolean {
  if (!physicalKey.startsWith(basePrefix)) return false;
  if (!uid) return !physicalKey.includes(OWNER_SEPARATOR);
  return physicalKey.endsWith(
    `${OWNER_SEPARATOR}${USER_OWNER_PREFIX}${encodeURIComponent(uid)}`,
  );
}

/**
 * One localStorage row to carry over from the guest namespace into a freshly
 * signed-in account's namespace, plus the predicate that decides whether that
 * account's row already holds real content worth protecting.
 */
export interface GuestLocalStorageMigration {
  /** The store's bare/unscoped key, e.g. lib/field-journal.ts's STORAGE_KEY. */
  baseKey: string;
  /** True when `raw` (the uid-scoped row, or null if it doesn't exist yet) has no
   *  farmer-entered content — i.e. it is safe to overwrite with the guest draft. */
  isEmpty: (raw: string | null) => boolean;
}

/**
 * Copy guest-namespaced rows into a newly signed-in account's namespace, but only
 * into rows that don't already hold real data. Call this once, synchronously,
 * right after a successful signUp / signIn / signInWithGoogle / getRedirectResult
 * — see lib/auth.tsx.
 *
 * Some pages (the Field Journal, the Crop Planner) are reachable while signed out.
 * A farmer who writes there before ever creating an account is working under the
 * `guest` owner suffix; the moment they sign up, activeAccountLocalStorageKey()
 * starts reading an entirely different physical row for the same base key, and
 * without this call that guest work would simply vanish. Signing IN (not just up)
 * goes through the same path deliberately, so a farmer who drafted a journal entry
 * as a guest on a shared phone before logging into their existing account still
 * gets it — but ONLY when their real account's row is empty, so signing in on a
 * second device can never let a stale guest draft clobber real cloud-era data.
 *
 * Deliberately synchronous (plain localStorage calls, no I/O) and swallow-all: this
 * runs inline in the sign-in path, and a farmer must be able to log in even if one
 * row's migration throws (corrupt guest JSON, a full origin, anything). Each row is
 * handled independently so one bad row can't block another.
 *
 * The guest row is deleted after a successful copy. Leaving it behind would mean
 * the next guest session on a shared family phone opens straight into the previous
 * person's journal — worse than the data loss this function exists to fix.
 */
export function migrateGuestLocalStorageRows(
  migrations: readonly GuestLocalStorageMigration[],
  uid: string,
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  for (const { baseKey, isEmpty } of migrations) {
    try {
      const guestKey = `${baseKey}${OWNER_SEPARATOR}${SIGNED_OUT_OWNER}`;
      const guestRaw = window.localStorage.getItem(guestKey);
      if (guestRaw === null || isEmpty(guestRaw)) continue; // nothing worth copying
      const uidKey = accountLocalStorageKey(baseKey, uid);
      if (!isEmpty(window.localStorage.getItem(uidKey))) continue; // never clobber real data
      window.localStorage.setItem(uidKey, guestRaw);
      window.localStorage.removeItem(guestKey);
    } catch {
      // One row's migration must never break sign-in. See the function-level note.
    }
  }
}

export const ACCOUNT_LOCAL_STORAGE_OWNER_SEPARATOR = OWNER_SEPARATOR;
