'use client';

import { activeAccountLocalStorageKey } from './account-local-storage';
import { normaliseCropPlanV2, type CropPlanV2 } from './crop-plan-v2';

const STORAGE_PREFIX = 'imbewu_crop_plan_v2::site::';
const SAMPLE_MODE_FLAG = 'imbewu_sample_mode';
export const CROP_PLAN_V2_CHANGED_EVENT = 'imbewu-crop-plan-v2-changed';

function siteKeyIsUsable(siteKey: string): boolean {
  return siteKey.trim().length > 0;
}

function sampleModeActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage?.getItem(SAMPLE_MODE_FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * The site is encoded before the account namespace is applied. A V2 physical
 * layout must never accidentally read another farm's plan, even for the same
 * signed-in farmer.
 */
export function cropPlanV2StorageKey(siteKey: string): string | null {
  if (!siteKeyIsUsable(siteKey)) return null;
  return activeAccountLocalStorageKey(`${STORAGE_PREFIX}${encodeURIComponent(siteKey)}`);
}

function storageForV2(): Storage | null {
  if (typeof window === 'undefined' || sampleModeActive()) return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * V2 deliberately has no V1 fallback. The old account-global plan has no
 * trustworthy site, date or section assignment, so returning it here would
 * turn an unsafe migration into an invisible one.
 */
export function loadCropPlanV2(siteKey: string): CropPlanV2 | null {
  const key = cropPlanV2StorageKey(siteKey);
  const storage = storageForV2();
  if (!key || !storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const plan = normaliseCropPlanV2(JSON.parse(raw));
    return plan?.siteKey === siteKey ? plan : null;
  } catch {
    return null;
  }
}

export function saveCropPlanV2(value: CropPlanV2): boolean {
  const plan = normaliseCropPlanV2(value);
  const storage = storageForV2();
  if (!plan || !storage) return false;
  const key = cropPlanV2StorageKey(plan.siteKey);
  if (!key) return false;
  try {
    storage.setItem(key, JSON.stringify(plan));
    window.dispatchEvent(new Event(CROP_PLAN_V2_CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}
