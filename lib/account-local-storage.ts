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

export const ACCOUNT_LOCAL_STORAGE_OWNER_SEPARATOR = OWNER_SEPARATOR;
