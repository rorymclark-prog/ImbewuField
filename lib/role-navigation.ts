import type { UserRole } from './db/types';

/** Presentation only. Server roles and consent remain the authority for data. */
export function canSeeWorkspaceLink(role: UserRole | null, href: string): boolean {
  if (!role || role === 'admin') return true;
  const path = href.split('?')[0];
  if (role === 'funder') return ['/home', '/funder', '/network', '/account', '/updates', '/contact', '/samples', '/tour', '/feedback'].includes(path);
  if (path === '/funder') return false;
  if (path === '/ngo') return role === 'ngo';
  if (path === '/mentor') return role === 'mentor' || role === 'ngo';
  return true;
}

export function visibleRoleTabs(role: UserRole | null): string[] {
  return !role || role === 'admin' ? ['farmer', 'mentor', 'student', 'ngo', 'funder'] : [role];
}
