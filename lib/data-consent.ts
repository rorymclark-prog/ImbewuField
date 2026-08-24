import type { Profile } from './db/types';

/**
 * Phase 3 of the NGO/funder dashboard build (see PROGRESS.md): the farmer-facing half of
 * `Profile.dataConsent` (Phase 1 shipped the field + the rule enforcement in `firestore.rules`'
 * `consentGranted()`/`staffConsentedAccess()`). This is the one pure function the settings
 * toggle in `ProfileSheet.tsx` calls — kept separate from the component so the history-keeping
 * behaviour (see below) is unit-testable without rendering anything.
 *
 * Both timestamps are kept even across repeated grant/revoke cycles: granting stamps a fresh
 * `grantedAt` and leaves the previous `revokedAt` alone; revoking does the mirror image. Neither
 * transition erases the other's most recent timestamp, so the record always shows "most recently
 * granted at X" and "most recently revoked at Y" rather than only ever remembering one of the two.
 */
export function nextDataConsent(
  current: Profile['dataConsent'] | undefined,
  granted: boolean,
  now: string,
): NonNullable<Profile['dataConsent']> {
  if (granted) {
    return { granted: true, grantedAt: now, revokedAt: current?.revokedAt ?? null };
  }
  return { granted: false, grantedAt: current?.grantedAt ?? null, revokedAt: now };
}
