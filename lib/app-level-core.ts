// The pure half of Simple / All tools (lib/app-level.ts holds the storage and the React hook).
// Kept free of imports so tests and server code can use it without pulling in auth or storage.

import type { UserRole } from '@/lib/db/types';

export type AppLevel = 'simple' | 'full';

export function isAppLevel(value: unknown): value is AppLevel {
  return value === 'simple' || value === 'full';
}

/**
 * The starting level before anyone has chosen. `sampleRole` is the sample-mode role preview
 * ('' outside sample mode, 'sample' for the unassigned tour, or a role name).
 */
export function defaultAppLevel(role: UserRole | null, sampleRole: string): AppLevel {
  if (sampleRole) return sampleRole === 'farmer' ? 'simple' : 'full';
  return role === null || role === 'farmer' ? 'simple' : 'full';
}
