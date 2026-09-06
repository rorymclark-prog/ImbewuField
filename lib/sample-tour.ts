import type { UserRole } from './db/types';

// A sample is an isolated teaching workspace, never an alternative permission grant.
export function sampleRolesFor(role: UserRole | null): string[] {
  if (!role || role === 'admin' || role === 'ngo') return ['ngo', 'funder', 'farmer', 'mentor', 'student'];
  return [role];
}

/** Unknown signed-in identities fail closed; anonymous visitors can explore public samples. */
export function sampleChoicesForAccount(role: UserRole | null, signedIn: boolean, ready: boolean): string[] {
  if (!ready || (signedIn && !role)) return [];
  return sampleRolesFor(role);
}

export const FARM_TOUR = [
  { id: 'map', minutes: 2, title: 'Find the garden', href: '/farmer', task: 'Open the saved sample pin. Explore the map layers and garden boundary.' },
  { id: 'design', minutes: 3, title: 'Try the Design Studio', href: '/design?lat=-27.72623&lon=31.96304', task: 'Select a bed or tree, move it and try Undo. Edits affect only this sample.' },
  { id: 'assessment', minutes: 2, title: 'Review the site assessment', href: '/farmer?openSurvey=1', task: 'Review the completed example, change a water or site answer, then save.' },
  { id: 'evidence', minutes: 2, title: 'Explore the evidence pack', href: '/samples/farm#evidence', task: 'Review the illustrative photos, fictional soil result and completed household interview.' },
  { id: 'crops', minutes: 2, title: 'Read the crop plan', href: '/facilitator/crops', task: 'Compare vegetable beds and staple plots. Inspect the planting calendar.' },
  { id: 'money', minutes: 2, title: 'Follow the harvest and money', href: '/records', task: 'Compare sample income, costs and returns per square metre. These are invented transactions.' },
  { id: 'report', minutes: 2, title: 'Make a report', href: '/samples/farm#report', task: 'Download the branded farm evidence report, including your saved edits and illustrative photos.' },
] as const;

export function cleanTourProgress(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((x): x is string => typeof x === 'string' && FARM_TOUR.some(s => s.id === x)))] : [];
}
