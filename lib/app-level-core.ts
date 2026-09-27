// The pure half of Simple / All tools (lib/app-level.ts holds the storage and the React hook).
// Kept free of imports so tests and server code can use it without pulling in auth or storage.

import type { UserRole } from '@/lib/db/types';

export type AppLevel = 'simple' | 'full';

export function isAppLevel(value: unknown): value is AppLevel {
  return value === 'simple' || value === 'full';
}

// Some material is not a Simple/All-tools density choice at all — it is genuinely staff-only
// (mentor/ngo/funder/admin), never meant for a farmer or student whichever level they are on.
// Kept loose on the input type (not UserRole) because callers pass it a GatingContext role —
// 'string | null | undefined', including sample-mode role previews — not just an account's own.
const STAFF_ROLES = new Set(['mentor', 'ngo', 'funder', 'admin']);
export function isStaffRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && STAFF_ROLES.has(role);
}

/**
 * The starting level before anyone has chosen. `sampleRole` is the sample-mode role preview
 * ('' outside sample mode, 'sample' for the unassigned tour, or a role name).
 */
export function defaultAppLevel(role: UserRole | null, sampleRole: string): AppLevel {
  if (sampleRole) return sampleRole === 'farmer' ? 'simple' : 'full';
  return role === null || role === 'farmer' ? 'simple' : 'full';
}
