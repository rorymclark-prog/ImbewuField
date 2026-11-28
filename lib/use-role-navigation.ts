'use client';
import { useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { enterSampleMode, getSampleWorkspace, SAMPLE_MODE_EVENT } from './sample-mode';
import type { UserRole } from './db/types';

const KEY = 'imbewu-sample-role';
const ROLES = ['farmer', 'mentor', 'student', 'ngo', 'funder'];
const subscribe = (notify: () => void) => {
  window.addEventListener(SAMPLE_MODE_EVENT, notify);
  return () => window.removeEventListener(SAMPLE_MODE_EVENT, notify);
};
export function useSampleWorkspace() {
  return useSyncExternalStore(subscribe, getSampleWorkspace, () => null);
}
export function useSampleRole() {
  return useSyncExternalStore(subscribe, () => {
    const workspace = getSampleWorkspace();
    if (!workspace) return '';
    if (workspace !== 'ubhejane') return 'farmer';
    try { const role = sessionStorage.getItem(KEY); return role && ROLES.includes(role) ? role : 'sample'; } catch { return 'sample'; }
  }, () => '');
}
export function useRoleNavigation() {
  const { role } = useAuth();
  const sampleRole = useSampleRole();
  return { accountRole: role, sample: !!sampleRole, navigationRole: (sampleRole && sampleRole !== 'sample' ? sampleRole : role) as UserRole | null };
}
export function startRolePreview(role: string): boolean {
  if (!ROLES.includes(role)) return false;
  try {
    sessionStorage.setItem(KEY, role);
    if (sessionStorage.getItem(KEY) !== role) return false;
  } catch { return false; }
  if (getSampleWorkspace() !== 'ubhejane' && !enterSampleMode()) return false;
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
  return true;
}

export function openRolePreview(role: string, href: string, navigate: (href: string) => void): boolean {
  const workspace = getSampleWorkspace();
  const switchingWorkspace = workspace !== null && workspace !== 'ubhejane';
  if (!startRolePreview(role)) return false;
  if (switchingWorkspace) window.location.assign(href);
  else navigate(href);
  return true;
}
