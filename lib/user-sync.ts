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
    if (shapesSnap.exists() && shapesSnap.data().shapes)
      localStorage.setItem(FARM_KEY, JSON.stringify(shapesSnap.data().shapes));
    if (placesSnap.exists() && placesSnap.data().places)
      localStorage.setItem(PLACES_KEY, JSON.stringify(placesSnap.data().places));
    if (waterSnap.exists() && waterSnap.data().points)
      localStorage.setItem(WATER_KEY, JSON.stringify(waterSnap.data().points));
  } catch (e) { console.error('[sync] pull error', e); }
}

export async function pushFarmShapes(uid: string, shapes: object): Promise<void> {
  const d = db();
  const count = (shapes as { features?: unknown[] }).features?.length ?? 0;
  console.log('[sync] push shapes uid=', uid, 'features=', count, 'db=', !!d);
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes, updatedAt: serverTimestamp() });
    console.log('[sync] push shapes OK');
  } catch (e) { console.error('[sync] push shapes error', e); }
}

export async function pushPlaces(uid: string, places: SavedPlace[]): Promise<void> {
  const d = db();
  console.log('[sync] push places uid=', uid, 'count=', places.length, 'db=', !!d);
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'places'), { places, updatedAt: serverTimestamp() });
    console.log('[sync] push places OK');
  } catch (e) { console.error('[sync] push places error', e); }
}

export async function pushWaterPoints(uid: string, points: WaterPoint[]): Promise<void> {
  const d = db();
  console.log('[sync] push water uid=', uid, 'count=', points.length, 'db=', !!d);
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'water'), { points, updatedAt: serverTimestamp() });
    console.log('[sync] push water OK');
  } catch (e) { console.error('[sync] push water error', e); }
}
