'use client';

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import type { SavedPlace } from './saved-places';
import type { WaterPoint } from './water-points';

const FARM_KEY    = 'imbewu_farm_shapes';
const PLACES_KEY  = 'permamap_saved_places';
const WATER_KEY   = 'imbewu_water_points';
const COLL        = 'user_map_data';

function db() { return getFirebase()?.db ?? null; }

// Merge two place arrays: local wins on ID conflict (more recent edit on this device).
function mergePlaces(remote: SavedPlace[], local: SavedPlace[]): SavedPlace[] {
  const byId = new Map<string, SavedPlace>();
  for (const p of remote) byId.set(p.id, p);
  for (const p of local)  byId.set(p.id, p); // local overwrites remote on conflict
  return [...byId.values()];
}

function mergeWater(remote: WaterPoint[], local: WaterPoint[]): WaterPoint[] {
  const byId = new Map<string, WaterPoint>();
  for (const p of remote) byId.set(p.id, p);
  for (const p of local)  byId.set(p.id, p);
  return [...byId.values()];
}

// Merge two GeoJSON FeatureCollections by feature id. Local wins on conflict.
function mergeShapes(
  remote: { features: { id?: string }[] } | null,
  local:  { features: { id?: string }[] } | null,
): { type: string; features: { id?: string }[] } | null {
  const rf = remote?.features ?? [];
  const lf = local?.features  ?? [];
  if (!rf.length && !lf.length) return null;
  const byId = new Map<string, { id?: string }>();
  for (const f of rf) if (f.id) byId.set(String(f.id), f);
  for (const f of lf) if (f.id) byId.set(String(f.id), f);
  // Features without an id just append from local (shouldn't happen with Draw)
  const noId = lf.filter(f => !f.id);
  return { type: 'FeatureCollection', features: [...byId.values(), ...noId] };
}

// Pull user map data from Firestore and MERGE with localStorage.
// Both sources contribute; local wins on per-item conflicts.
// Merged result is saved back to both localStorage and Firestore.
export async function pullUserMapData(uid: string): Promise<void> {
  const d = db();
  console.log('[sync] pull uid=', uid, 'db=', !!d);
  if (!d) return;
  try {
    const [shapesSnap, placesSnap, waterSnap] = await Promise.all([
      getDoc(doc(d, COLL, uid, 'data', 'shapes')),
      getDoc(doc(d, COLL, uid, 'data', 'places')),
      getDoc(doc(d, COLL, uid, 'data', 'water')),
    ]);
    console.log('[sync] pull result: shapes=', shapesSnap.exists(), 'places=', placesSnap.exists(), 'water=', waterSnap.exists());

    // --- Places ---
    const remotePlaces: SavedPlace[] = placesSnap.exists() ? (placesSnap.data().places ?? []) : [];
    const localPlacesRaw = localStorage.getItem(PLACES_KEY);
    const localPlaces: SavedPlace[] = localPlacesRaw ? (JSON.parse(localPlacesRaw) ?? []) : [];
    const mergedPlaces = mergePlaces(remotePlaces, localPlaces);
    localStorage.setItem(PLACES_KEY, JSON.stringify(mergedPlaces));
    if (mergedPlaces.length !== remotePlaces.length || localPlaces.some(l => !remotePlaces.find(r => r.id === l.id))) {
      await setDoc(doc(d, COLL, uid, 'data', 'places'), { places: mergedPlaces, updatedAt: serverTimestamp() });
    }
    console.log('[sync] places merged: remote=', remotePlaces.length, 'local=', localPlaces.length, 'result=', mergedPlaces.length);

    // --- Water points ---
    const remoteWater: WaterPoint[] = waterSnap.exists() ? (waterSnap.data().points ?? []) : [];
    const localWaterRaw = localStorage.getItem(WATER_KEY);
    const localWater: WaterPoint[] = localWaterRaw ? (JSON.parse(localWaterRaw) ?? []) : [];
    const mergedWater = mergeWater(remoteWater, localWater);
    localStorage.setItem(WATER_KEY, JSON.stringify(mergedWater));
    if (mergedWater.length !== remoteWater.length || localWater.some(l => !remoteWater.find(r => r.id === l.id))) {
      await setDoc(doc(d, COLL, uid, 'data', 'water'), { points: mergedWater, updatedAt: serverTimestamp() });
    }
    console.log('[sync] water merged: remote=', remoteWater.length, 'local=', localWater.length, 'result=', mergedWater.length);

    // --- Farm shapes ---
    const remoteShapes = shapesSnap.exists() ? shapesSnap.data().shapes : null;
    const localShapesRaw = localStorage.getItem(FARM_KEY);
    const localShapes = localShapesRaw ? JSON.parse(localShapesRaw) : null;
    const mergedShapes = mergeShapes(remoteShapes, localShapes);
    if (mergedShapes) {
      localStorage.setItem(FARM_KEY, JSON.stringify(mergedShapes));
      const remoteCount = remoteShapes?.features?.length ?? 0;
      const localCount  = localShapes?.features?.length  ?? 0;
      if (mergedShapes.features.length !== remoteCount || localCount > 0) {
        await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes: mergedShapes, updatedAt: serverTimestamp() });
      }
      console.log('[sync] shapes merged: remote=', remoteCount, 'local=', localCount, 'result=', mergedShapes.features.length);
    }
  } catch (e) { console.error('[sync] pull error', e); }
}

export async function pushFarmShapes(uid: string, shapes: object): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes, updatedAt: serverTimestamp() });
    console.log('[sync] push shapes OK features=', (shapes as { features?: unknown[] }).features?.length);
  } catch (e) { console.error('[sync] push shapes error', e); }
}

export async function pushPlaces(uid: string, places: SavedPlace[]): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'places'), { places, updatedAt: serverTimestamp() });
    console.log('[sync] push places OK count=', places.length);
  } catch (e) { console.error('[sync] push places error', e); }
}

export async function pushWaterPoints(uid: string, points: WaterPoint[]): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'water'), { points, updatedAt: serverTimestamp() });
    console.log('[sync] push water OK count=', points.length);
  } catch (e) { console.error('[sync] push water error', e); }
}
