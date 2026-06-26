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

// Pull all map data from Firestore → overwrite localStorage (called on login).
export async function pullUserMapData(uid: string): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    const [shapesSnap, placesSnap, waterSnap] = await Promise.all([
      getDoc(doc(d, COLL, uid, 'data', 'shapes')),
      getDoc(doc(d, COLL, uid, 'data', 'places')),
      getDoc(doc(d, COLL, uid, 'data', 'water')),
    ]);
    if (shapesSnap.exists() && shapesSnap.data().shapes)
      localStorage.setItem(FARM_KEY, JSON.stringify(shapesSnap.data().shapes));
    if (placesSnap.exists() && placesSnap.data().places)
      localStorage.setItem(PLACES_KEY, JSON.stringify(placesSnap.data().places));
    if (waterSnap.exists() && waterSnap.data().points)
      localStorage.setItem(WATER_KEY, JSON.stringify(waterSnap.data().points));
  } catch { /* offline or permission error — keep existing localStorage */ }
}

export async function pushFarmShapes(uid: string, shapes: object): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes, updatedAt: serverTimestamp() });
  } catch { }
}

export async function pushPlaces(uid: string, places: SavedPlace[]): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'places'), { places, updatedAt: serverTimestamp() });
  } catch { }
}

export async function pushWaterPoints(uid: string, points: WaterPoint[]): Promise<void> {
  const d = db();
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'water'), { points, updatedAt: serverTimestamp() });
  } catch { }
}
