'use client';
import { useSyncExternalStore } from 'react';
import { useAuth } from './auth';
import { enterSampleMode, isSampleMode, SAMPLE_MODE_EVENT } from './sample-mode';
import type { UserRole } from './db/types';

const KEY = 'imbewu-sample-role';
const ROLES = ['farmer', 'mentor', 'student', 'ngo', 'funder'];
const subscribe = (notify: () => void) => {
  window.addEventListener(SAMPLE_MODE_EVENT, notify);
  return () => window.removeEventListener(SAMPLE_MODE_EVENT, notify);
};
export function useSampleRole() {
  return useSyncExternalStore(subscribe, () => {
    if (!isSampleMode()) return '';
    try { const role = sessionStorage.getItem(KEY); return role && ROLES.includes(role) ? role : 'sample'; } catch { return 'sample'; }
  }, () => '');
}
export function useRoleNavigation() {
  const { role } = useAuth();
  const sampleRole = useSampleRole();
  return { accountRole: role, sample: !!sampleRole, navigationRole: (sampleRole && sampleRole !== 'sample' ? sampleRole : role) as UserRole | null };
}
export function startRolePreview(role: string): boolean {
  if (!ROLES.includes(role) || (!isSampleMode() && !enterSampleMode())) return false;
  try { sessionStorage.setItem(KEY, role); } catch { return false; }
  window.dispatchEvent(new CustomEvent(SAMPLE_MODE_EVENT));
  return true;
}
