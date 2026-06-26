'use client';

import type { FeatureCollection } from 'geojson';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/init';
import type { SavedPlace } from '@/lib/saved-places';
import type { WaterPoint } from '@/lib/water-points';

export interface UserMapState {
  shapes: FeatureCollection | null;
  places: SavedPlace[];
  waterPoints: WaterPoint[];
}

type UserMapPatch = Partial<UserMapState>;

const USER_MAP_COLLECTION = 'user_map_state';
const SHAPES_KEY = 'imbewu_farm_shapes';
const PLACES_KEY = 'permamap_saved_places';
const LEGACY_PLACES_KEY = 'imbewu_places';
const WATER_POINTS_KEY = 'imbewu_water_points';

const MAP_STATE_EVENT = 'imbewu-map-state-changed';
const PLACES_EVENT = 'permamap-places-changed';
const WATER_EVENT = 'imbewu-water-points-changed';

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

function hasAnyState(state: UserMapState): boolean {
  return !!state.shapes?.features?.length || state.places.length > 0 || state.waterPoints.length > 0;
}

function cleanPatch(patch: UserMapPatch): UserMapPatch {
  const next: UserMapPatch = {};
  if (patch.shapes !== undefined) next.shapes = patch.shapes;
  if (patch.places !== undefined) next.places = patch.places;
  if (patch.waterPoints !== undefined) next.waterPoints = patch.waterPoints;
  return next;
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

export async function pushUserMapStatePatch(patch: UserMapPatch): Promise<void> {
  const ref = currentUserMapDocRef();
  const next = cleanPatch(patch);
  if (!ref || Object.keys(next).length === 0) return;
  await setDoc(ref, { ...next, updatedAt: serverTimestamp() }, { merge: true });
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

  const local = {
    shapes: readLocalFarmShapes(),
    places: readLocalSavedPlaces(),
    waterPoints: readLocalWaterPoints(),
  };

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    if (hasAnyState(local)) {
      await pushUserMapStatePatch(local);
      writeLocalSavedPlaces(local.places, { notify: true });
      writeLocalWaterPoints(local.waterPoints, { notify: true });
      writeLocalFarmShapes(local.shapes, { notify: true });
    }
    return local;
  }

  const remote = snap.data() as UserMapPatch;
  const merged: UserMapState = {
    shapes: remote.shapes !== undefined ? (remote.shapes ?? null) : local.shapes,
    places: remote.places !== undefined ? (remote.places ?? []) : local.places,
    waterPoints: remote.waterPoints !== undefined ? (remote.waterPoints ?? []) : local.waterPoints,
  };

  writeLocalSavedPlaces(merged.places, { notify: true });
  writeLocalWaterPoints(merged.waterPoints, { notify: true });
  writeLocalFarmShapes(merged.shapes, { notify: true });

  const needsBackfill =
    (remote.shapes === undefined && local.shapes !== null) ||
    (remote.places === undefined && local.places.length > 0) ||
    (remote.waterPoints === undefined && local.waterPoints.length > 0);

  if (needsBackfill) {
    await pushUserMapStatePatch(merged);
  }

  return merged;
}

export { MAP_STATE_EVENT, PLACES_EVENT, WATER_EVENT, SHAPES_KEY, PLACES_KEY, WATER_POINTS_KEY };
