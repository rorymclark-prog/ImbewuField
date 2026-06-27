import { upsertPlace, removePlace } from './user-sync';
import { getFirebase } from './firebase/init';

export type PlaceLabel = 'home' | 'field' | 'water' | 'other';

// The label sets the pin colour on the map.
export const PLACE_LABELS: { v: PlaceLabel; name: string; color: string }[] = [
  { v: 'home',  name: 'Home',  color: '#C07A1E' },
  { v: 'field', name: 'Field', color: '#1F4D2B' },
  { v: 'water', name: 'Water', color: '#235E86' },
  { v: 'other', name: 'Other', color: '#5C5040' },
];
export const placeColor = (label?: PlaceLabel): string =>
  PLACE_LABELS.find((l) => l.v === label)?.color ?? '#C07A1E';

export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  biome: string;
  rainfall: number;
  elevation: number;
  savedAt: string; // ISO date
  updatedAt?: number; // ms — last edit time, drives cross-device newest-wins merge
  label?: PlaceLabel;
  color?: string;  // custom hex — overrides label colour when set
  notes?: string;
}

export const resolveColor = (p: { label?: PlaceLabel; color?: string }): string =>
  p.color ?? placeColor(p.label);

const KEY = 'permamap_saved_places';

export function loadPlaces(): SavedPlace[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permamap-places-changed'));
}

function currentUid(): string | undefined {
  return getFirebase()?.auth?.currentUser?.uid;
}

export function savePlace(place: SavedPlace): SavedPlace[] {
  const stamped = { ...place, updatedAt: Date.now() };
  const places = loadPlaces().filter(p => p.id !== stamped.id);
  const updated = [stamped, ...places];
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertPlace(uid, stamped).catch(() => {});
  return updated;
}

export function deletePlace(id: string): SavedPlace[] {
  const updated = loadPlaces().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) removePlace(uid, id).catch(() => {});
  return updated;
}

export function updatePlacePosition(id: string, lat: number, lon: number): SavedPlace[] {
  let moved: SavedPlace | undefined;
  const updated = loadPlaces().map(p => {
    if (p.id !== id) return p;
    moved = { ...p, lat, lon, updatedAt: Date.now() };
    return moved;
  });
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid && moved) upsertPlace(uid, moved).catch(() => {});
  return updated;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
