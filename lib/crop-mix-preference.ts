// The farmer's own crop mix, remembered per map.
//
// Rory, 2026-09-30: "maybe we can have a save preference option too?" The auto-suggest crop-mix
// tiles reset to the recommended mix every time the questionnaire opens, so a farmer who never
// wants herbs or mung beans had to switch them off on every run.
//
// WHAT IS SAVED. The ticked tiles and the "only use these exact crops" list, for one map and one
// goal. Per goal because the goals start from opposite defaults: a family mix starts with every
// tile on and a commercial one starts empty, so one saved list cannot serve both. It lives in this
// browser's storage, per signed-in account, like the saved animal choices in
// lib/animal-enterprises.ts. It does not follow the farmer to another device.
//
// A TILE ADDED AFTER THE SAVE. The saved record also keeps which tiles existed when it was saved.
// A tile the app adds later was never switched off by the farmer, so for a family or hybrid mix
// it comes back on, the recommended default; a commercial mix starts empty, so it stays off.

import { activeAccountLocalStorageKey } from './account-local-storage';
import { isSampleMode } from './sample-mode';
import { cropByKey } from './crop-catalog';
import { FOOD_GROUP_META, GROUP_PRIORITY, type FoodGroup } from './crop-groups';
import type { GardenGoal } from './crop-autosuggest';

export interface CropMix {
  groups: FoodGroup[];
  cropKeys: string[];
}

interface StoredCropMix extends CropMix {
  /** The tiles the crop-mix filter offered when this was saved. */
  offered: FoodGroup[];
}

type SiteMixes = Partial<Record<GardenGoal, StoredCropMix>>;

const CROP_MIX_KEY = 'imbewu_crop_mix_v1';
const GOALS: readonly GardenGoal[] = ['family', 'commercial', 'hybrid'];

let sandboxMixes: Record<string, SiteMixes> = {};

function isFoodGroup(value: unknown): value is FoodGroup {
  return typeof value === 'string' && Object.hasOwn(FOOD_GROUP_META, value);
}

function cleanGroups(value: unknown): FoodGroup[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isFoodGroup))];
}

function cleanStored(value: unknown): StoredCropMix | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.groups)) return null;
  const cropKeys = Array.isArray(raw.cropKeys)
    ? [...new Set(raw.cropKeys.filter((k): k is string => typeof k === 'string' && !!cropByKey(k)))]
    : [];
  return {
    groups: cleanGroups(raw.groups),
    cropKeys,
    // Missing or damaged: treat it as saved with every tile the app has now, so no tile the
    // farmer switched off comes back on.
    offered: Array.isArray(raw.offered) ? cleanGroups(raw.offered) : [...GROUP_PRIORITY],
  };
}

function readAll(): Record<string, unknown> {
  if (isSampleMode()) return sandboxMixes;
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(CROP_MIX_KEY));
    const all = raw ? JSON.parse(raw) : {};
    return all && typeof all === 'object' && !Array.isArray(all) ? all : {};
  } catch {
    return {};
  }
}

function writeSite(siteId: string, mixes: SiteMixes): void {
  if (isSampleMode()) {
    sandboxMixes = { ...sandboxMixes, [siteId]: mixes };
    return;
  }
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const key = activeAccountLocalStorageKey(CROP_MIX_KEY);
    window.localStorage.setItem(key, JSON.stringify({ ...readAll(), [siteId]: mixes }));
  } catch {
    // Quota exceeded or storage unavailable — fail silently, same as saveEnterpriseChoices.
  }
}

function siteMixes(siteId: string): SiteMixes {
  const raw = readAll()[siteId];
  if (!raw || typeof raw !== 'object') return {};
  const out: SiteMixes = {};
  for (const goal of GOALS) {
    const mix = cleanStored((raw as Record<string, unknown>)[goal]);
    if (mix) out[goal] = mix;
  }
  return out;
}

/** The saved mix for this map and goal, or null when the farmer has not saved one. */
export function loadCropMix(siteId: string, goal: GardenGoal): CropMix | null {
  const stored = siteMixes(siteId)[goal];
  if (!stored) return null;
  const added = goal === 'commercial' ? [] : GROUP_PRIORITY.filter((g) => !stored.offered.includes(g));
  const groups = new Set([...stored.groups, ...added]);
  return {
    // In the filter's own order, so a saved mix reads the same as a fresh one.
    groups: GROUP_PRIORITY.filter((g) => groups.has(g)),
    cropKeys: stored.cropKeys,
  };
}

export function saveCropMix(siteId: string, goal: GardenGoal, mix: CropMix): void {
  const stored = cleanStored({ ...mix, offered: GROUP_PRIORITY });
  if (!stored) return;
  writeSite(siteId, { ...siteMixes(siteId), [goal]: stored });
}

/** Forget the saved mix for this map and goal; the next run starts from the recommended mix. */
export function clearCropMix(siteId: string, goal: GardenGoal): void {
  const mixes = siteMixes(siteId);
  delete mixes[goal];
  writeSite(siteId, mixes);
}

/** Test seam: the sample-mode sandbox is module state, reset by a full page load. */
export function resetSampleCropMix(): void {
  sandboxMixes = {};
}
