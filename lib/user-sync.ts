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

// Pull map data from Firestore. Strategy per key:
//   • Firestore has data → overwrite localStorage with it
//   • Firestore empty AND localStorage has data → bootstrap Firestore from localStorage
// This handles first-run on a device that already had local data before sync was added.
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

    // Farm shapes
    if (shapesSnap.exists() && shapesSnap.data().shapes) {
      localStorage.setItem(FARM_KEY, JSON.stringify(shapesSnap.data().shapes));
      console.log('[sync] restored shapes from Firestore');
    } else {
      const local = localStorage.getItem(FARM_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed?.features?.length) {
          await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes: parsed, updatedAt: serverTimestamp() });
          console.log('[sync] bootstrapped shapes to Firestore, features=', parsed.features.length);
        }
      }
    }

    // Saved places
    if (placesSnap.exists() && placesSnap.data().places) {
      localStorage.setItem(PLACES_KEY, JSON.stringify(placesSnap.data().places));
      console.log('[sync] restored places from Firestore, count=', placesSnap.data().places.length);
    } else {
      const local = localStorage.getItem(PLACES_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length) {
          await setDoc(doc(d, COLL, uid, 'data', 'places'), { places: parsed, updatedAt: serverTimestamp() });
          console.log('[sync] bootstrapped places to Firestore, count=', parsed.length);
        }
      }
    }

    // Water points
    if (waterSnap.exists() && waterSnap.data().points) {
      localStorage.setItem(WATER_KEY, JSON.stringify(waterSnap.data().points));
      console.log('[sync] restored water from Firestore, count=', waterSnap.data().points.length);
    } else {
      const local = localStorage.getItem(WATER_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length) {
          await setDoc(doc(d, COLL, uid, 'data', 'water'), { points: parsed, updatedAt: serverTimestamp() });
          console.log('[sync] bootstrapped water to Firestore, count=', parsed.length);
        }
      }
    }
  } catch (e) { console.error('[sync] pull error', e); }
}

export async function pushFarmShapes(uid: string, shapes: object): Promise<void> {
  const d = db();
  const count = (shapes as { features?: unknown[] }).features?.length ?? 0;
  console.log('[sync] push shapes uid=', uid, 'features=', count);
  if (!d) return;
  try {
    await setDoc(doc(d, COLL, uid, 'data', 'shapes'), { shapes, updatedAt: serverTimestamp() });
    console.log('[sync] push shapes OK');
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
