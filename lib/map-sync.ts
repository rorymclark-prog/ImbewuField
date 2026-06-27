'use client';

import type { FeatureCollection } from 'geojson';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/init';
import type { SavedPlace } from '@/lib/saved-places';
import type { WaterPoint } from '@/lib/water-points';

export interface UserMapState {
  shapes: FeatureCollection | null;
  places: SavedPlace[];
  waterPoints: WaterPoint[];
  localStorageSnapshot: Record<string, string>;
  localStorageUpdatedAt: Record<string, number>;
}

type UserMapPatch = Partial<UserMapState>;

const USER_MAP_COLLECTION = 'user_map_state';
const SHAPES_KEY = 'imbewu_farm_shapes';
const PLACES_KEY = 'permamap_saved_places';
const LEGACY_PLACES_KEY = 'imbewu_places';
const WATER_POINTS_KEY = 'imbewu_water_points';
const LOCAL_STORAGE_META_KEY = 'imbewu_sync_meta_v1';
const LEGACY_STORAGE_TIMESTAMP = 1;

const MAP_STATE_EVENT = 'imbewu-map-state-changed';
const PLACES_EVENT = 'permamap-places-changed';
const WATER_EVENT = 'imbewu-water-points-changed';
const LOCAL_STORAGE_EXACT_KEYS = new Set([
  SHAPES_KEY,
  PLACES_KEY,
  LEGACY_PLACES_KEY,
  WATER_POINTS_KEY,
  'imbewu_evidence_v1',
  'imbewu_garden_survey',
  'imbewu_invoice_customers',
  'imbewu_invoice_products',
  'imbewu_invoices',
  'imbewu_last_site',
  'imbewu_planner_crops',
  'imbewu_planner_qty',
  'imbewu_saved_reports',
  'permamap_lang',
  'permamap_onboarded',
]);
const LOCAL_STORAGE_PREFIX_KEYS = [
  'imbewu_garden_survey_',
  'imbewu_site_survey_',
];

const pendingSyncs = new Map<string, { patch: UserMapPatch; timer: ReturnType<typeof setTimeout> | null }>();

function emit(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name));
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function isFeatureCollection(value: unknown): value is FeatureCollection {
  return !!value && typeof value === 'object' && Array.isArray((value as FeatureCollection).features);
}

function isSyncableStorageKey(key: string): boolean {
  return LOCAL_STORAGE_EXACT_KEYS.has(key) || LOCAL_STORAGE_PREFIX_KEYS.some((prefix) => key.startsWith(prefix));
}

function hasAnyState(state: UserMapState): boolean {
  return !!state.shapes?.features?.length ||
    state.places.length > 0 ||
    state.waterPoints.length > 0 ||
    Object.keys(state.localStorageSnapshot).length > 0;
}

function cleanPatch(patch: UserMapPatch): UserMapPatch {
  const next: UserMapPatch = {};
  if (patch.shapes !== undefined) next.shapes = patch.shapes;
  if (patch.places !== undefined) next.places = patch.places;
  if (patch.waterPoints !== undefined) next.waterPoints = patch.waterPoints;
  if (patch.localStorageSnapshot !== undefined) next.localStorageSnapshot = patch.localStorageSnapshot;
  if (patch.localStorageUpdatedAt !== undefined) next.localStorageUpdatedAt = patch.localStorageUpdatedAt;
  return next;
}

function cleanStorageUpdatedAt(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const cleaned: Record<string, number> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, raw]) => {
    if (!isSyncableStorageKey(key) || typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return;
    cleaned[key] = raw;
  });
  return cleaned;
}

function readLocalStorageUpdatedAt(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    return cleanStorageUpdatedAt(safeParse<Record<string, unknown>>(window.localStorage.getItem(LOCAL_STORAGE_META_KEY), {}));
  } catch {
    return {};
  }
}

function writeLocalStorageUpdatedAt(updatedAt: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(cleanStorageUpdatedAt(updatedAt)));
  } catch {
    // Keep the app usable if storage is blocked or full.
  }
}

function withLegacyStorageTimestamps(
  snapshot: Record<string, string>,
  updatedAt: Record<string, number>,
): Record<string, number> {
  const next = cleanStorageUpdatedAt(updatedAt);
  Object.keys(snapshot).forEach((key) => {
    if (next[key] === undefined) next[key] = LEGACY_STORAGE_TIMESTAMP;
  });
  return next;
}

function mergeLocalStorageState(
  localSnapshot: Record<string, string>,
  localUpdatedAt: Record<string, number>,
  remoteSnapshot: Record<string, string> = {},
  remoteUpdatedAt: Record<string, number> = {},
): Pick<UserMapState, 'localStorageSnapshot' | 'localStorageUpdatedAt'> {
  const localTimes = cleanStorageUpdatedAt(localUpdatedAt);
  const remoteTimes = cleanStorageUpdatedAt(remoteUpdatedAt);
  const mergedSnapshot: Record<string, string> = {};
  const mergedUpdatedAt: Record<string, number> = {};
  const keys = new Set([...Object.keys(localSnapshot), ...Object.keys(remoteSnapshot)]);

  keys.forEach((key) => {
    if (!isSyncableStorageKey(key)) return;
    const localHas = Object.prototype.hasOwnProperty.call(localSnapshot, key);
    const remoteHas = Object.prototype.hasOwnProperty.call(remoteSnapshot, key);
    if (!localHas && !remoteHas) return;

    const localTime = localTimes[key];
    const remoteTime = remoteTimes[key];
    let useLocal = localHas && !remoteHas;
    if (localHas && remoteHas) {
      if (localTime !== undefined && remoteTime !== undefined) useLocal = localTime >= remoteTime;
      else if (localTime !== undefined) useLocal = true;
      else if (remoteTime !== undefined) useLocal = false;
      else useLocal = true;
    }

    if (useLocal) {
      mergedSnapshot[key] = localSnapshot[key];
      mergedUpdatedAt[key] = localTime ?? remoteTime ?? LEGACY_STORAGE_TIMESTAMP;
    } else {
      mergedSnapshot[key] = remoteSnapshot[key];
      mergedUpdatedAt[key] = remoteTime ?? localTime ?? LEGACY_STORAGE_TIMESTAMP;
    }
  });

  return { localStorageSnapshot: mergedSnapshot, localStorageUpdatedAt: mergedUpdatedAt };
}

function recordsEqual<T extends string | number>(
  left: Record<string, T> = {},
  right: Record<string, T> = {},
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => right[key] === left[key]);
}

function currentUserMapDocRef() {
  const fb = getFirebase();
  const uid = fb?.auth.currentUser?.uid;
  if (!fb || !uid) return null;
  return doc(fb.db, USER_MAP_COLLECTION, uid);
}

function applyLocalSavedPlaces(places: SavedPlace[], notify = true): SavedPlace[] {
  if (typeof window === 'undefined') return places;
  const serialized = JSON.stringify(places);
  try {
    window.localStorage.setItem(PLACES_KEY, serialized);
    window.localStorage.setItem(LEGACY_PLACES_KEY, serialized);
  } catch {
    // localStorage can be unavailable or full; keep the in-memory value.
  }
  if (notify) emit(PLACES_EVENT);
  return places;
}

function applyLocalWaterPoints(waterPoints: WaterPoint[], notify = true): WaterPoint[] {
  if (typeof window === 'undefined') return waterPoints;
  try {
    window.localStorage.setItem(WATER_POINTS_KEY, JSON.stringify(waterPoints));
  } catch {
    // localStorage can be unavailable or full; keep the in-memory value.
  }
  if (notify) emit(WATER_EVENT);
  return waterPoints;
}

function applyLocalShapes(shapes: FeatureCollection | null, notify = true): FeatureCollection | null {
  if (typeof window === 'undefined') return shapes;
  try {
    if (shapes) window.localStorage.setItem(SHAPES_KEY, JSON.stringify(shapes));
    else window.localStorage.removeItem(SHAPES_KEY);
  } catch {
    // ignore blocked storage
  }
  if (notify) emit(MAP_STATE_EVENT);
  return shapes;
}

export function readLocalSavedPlaces(): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  const canonical = safeParse<SavedPlace[] | null>(window.localStorage.getItem(PLACES_KEY), null);
  if (Array.isArray(canonical)) return canonical;
  const legacy = safeParse<SavedPlace[] | null>(window.localStorage.getItem(LEGACY_PLACES_KEY), null);
  return Array.isArray(legacy) ? legacy : [];
}

export function writeLocalSavedPlaces(places: SavedPlace[], opts?: { notify?: boolean }): SavedPlace[] {
  return applyLocalSavedPlaces(places, opts?.notify ?? true);
}

export function readLocalWaterPoints(): WaterPoint[] {
  if (typeof window === 'undefined') return [];
  const raw = safeParse<WaterPoint[] | null>(window.localStorage.getItem(WATER_POINTS_KEY), null);
  return Array.isArray(raw) ? raw : [];
}

export function writeLocalWaterPoints(waterPoints: WaterPoint[], opts?: { notify?: boolean }): WaterPoint[] {
  return applyLocalWaterPoints(waterPoints, opts?.notify ?? true);
}

export function readLocalFarmShapes(): FeatureCollection | null {
  if (typeof window === 'undefined') return null;
  const raw = safeParse<unknown>(window.localStorage.getItem(SHAPES_KEY), null);
  return isFeatureCollection(raw) ? raw : null;
}

export function writeLocalFarmShapes(shapes: FeatureCollection | null, opts?: { notify?: boolean }): FeatureCollection | null {
  return applyLocalShapes(shapes, opts?.notify ?? true);
}

export function readLocalStorageSnapshot(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const snapshot: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key || !isSyncableStorageKey(key)) continue;
      const value = window.localStorage.getItem(key);
      if (value != null) snapshot[key] = value;
    }
  } catch {
    return {};
  }
  return snapshot;
}

export function writeLocalStorageSnapshot(snapshot: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    Object.entries(snapshot).forEach(([key, value]) => {
      if (isSyncableStorageKey(key)) window.localStorage.setItem(key, value);
    });
  } catch {
    // Keep the app usable if storage is blocked or full.
  }
  emit(MAP_STATE_EVENT);
}

export function markLocalStorageKeyUpdated(key: string): void {
  if (typeof window === 'undefined' || !isSyncableStorageKey(key)) return;
  const localStorageUpdatedAt = {
    ...readLocalStorageUpdatedAt(),
    [key]: Date.now(),
  };
  writeLocalStorageUpdatedAt(localStorageUpdatedAt);
  queueUserMapStatePatch({
    localStorageSnapshot: readLocalStorageSnapshot(),
    localStorageUpdatedAt,
  });
  emit(MAP_STATE_EVENT);
}

function readLocalUserMapState(): UserMapState {
  return {
    shapes: readLocalFarmShapes(),
    places: readLocalSavedPlaces(),
    waterPoints: readLocalWaterPoints(),
    localStorageSnapshot: readLocalStorageSnapshot(),
    localStorageUpdatedAt: readLocalStorageUpdatedAt(),
  };
}

export async function pushUserMapStatePatch(patch: UserMapPatch): Promise<void> {
  const ref = currentUserMapDocRef();
  const next = cleanPatch(patch);
  if (!ref || Object.keys(next).length === 0) return;
  await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
}

export function startUserMapStateListener(onState?: (state: UserMapState | null) => void): () => void {
  const ref = currentUserMapDocRef();
  if (!ref) return () => {};
  return onSnapshot(ref, async (snap) => {
    if (!snap.exists()) {
      onState?.(null);
      return;
    }
    try {
      const state = await hydrateUserMapStateFromCloud();
      onState?.(state);
    } catch {
      // Ignore transient read errors; the next snapshot or refresh will retry.
    }
  });
}

export function queueUserMapStatePatch(patch: UserMapPatch): void {
  const ref = currentUserMapDocRef();
  const next = cleanPatch(patch);
  if (!ref || Object.keys(next).length === 0) return;

  const fb = getFirebase();
  const uid = fb?.auth.currentUser?.uid;
  if (!uid) return;

  const pending = pendingSyncs.get(uid) ?? { patch: {}, timer: null };
  pending.patch = {
    ...pending.patch,
    ...next,
  };
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    const current = pendingSyncs.get(uid);
    if (!current) return;
    pendingSyncs.delete(uid);
    void pushUserMapStatePatch(current.patch).catch(() => {
      // Fire-and-forget sync; local data remains intact if the write fails.
    });
  }, 350);
  pendingSyncs.set(uid, pending);
}

export async function hydrateUserMapStateFromCloud(): Promise<UserMapState | null> {
  const ref = currentUserMapDocRef();
  if (!ref) return null;

  const local = readLocalUserMapState();

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    if (hasAnyState(local)) {
      const initial = {
        ...local,
        localStorageUpdatedAt: withLegacyStorageTimestamps(local.localStorageSnapshot, local.localStorageUpdatedAt),
      };
      await pushUserMapStatePatch(initial);
      writeLocalStorageUpdatedAt(initial.localStorageUpdatedAt);
      writeLocalSavedPlaces(local.places, { notify: true });
      writeLocalWaterPoints(local.waterPoints, { notify: true });
      writeLocalFarmShapes(local.shapes, { notify: true });
      writeLocalStorageSnapshot(local.localStorageSnapshot);
    }
    return local;
  }

  const remote = snap.data() as UserMapPatch;
  const localStorage = mergeLocalStorageState(
    local.localStorageSnapshot,
    local.localStorageUpdatedAt,
    remote.localStorageSnapshot ?? {},
    remote.localStorageUpdatedAt ?? {},
  );
  const merged: UserMapState = {
    shapes: remote.shapes !== undefined ? (remote.shapes ?? null) : local.shapes,
    places: remote.places !== undefined ? (remote.places ?? []) : local.places,
    waterPoints: remote.waterPoints !== undefined ? (remote.waterPoints ?? []) : local.waterPoints,
    ...localStorage,
  };

  writeLocalStorageSnapshot(merged.localStorageSnapshot);
  writeLocalStorageUpdatedAt(merged.localStorageUpdatedAt);
  writeLocalSavedPlaces(merged.places, { notify: true });
  writeLocalWaterPoints(merged.waterPoints, { notify: true });
  writeLocalFarmShapes(merged.shapes, { notify: true });

  const needsBackfill =
    (remote.shapes === undefined && local.shapes !== null) ||
    (remote.places === undefined && local.places.length > 0) ||
    (remote.waterPoints === undefined && local.waterPoints.length > 0) ||
    remote.localStorageSnapshot === undefined ||
    remote.localStorageUpdatedAt === undefined ||
    !recordsEqual(remote.localStorageSnapshot ?? {}, merged.localStorageSnapshot) ||
    !recordsEqual(cleanStorageUpdatedAt(remote.localStorageUpdatedAt), merged.localStorageUpdatedAt);

  if (needsBackfill) {
    await pushUserMapStatePatch(merged);
  }

  return merged;
}

export async function syncLocalMapStateToCloud(): Promise<UserMapState | null> {
  return hydrateUserMapStateFromCloud();
}

export { MAP_STATE_EVENT, PLACES_EVENT, WATER_EVENT, SHAPES_KEY, PLACES_KEY, WATER_POINTS_KEY };
