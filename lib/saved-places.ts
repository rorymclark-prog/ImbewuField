import { upsertPlace, removePlace } from './user-sync';
import { getFirebase } from './firebase/init';
import { isSampleMode, getSandboxPlaces, upsertSandboxPlace, deleteSandboxPlace } from './sample-mode';
import { addTombstone } from './local-tombstones';

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
const DELETED_KEY = `${KEY}_deleted`; // local deletion tombstones — see lib/local-tombstones.ts

export function loadPlaces(): SavedPlace[] {
  if (isSampleMode()) return getSandboxPlaces();
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
  if (isSampleMode()) {
    const updated = upsertSandboxPlace(stamped);
    notify();
    return updated;
  }
  const places = loadPlaces().filter(p => p.id !== stamped.id);
  const updated = [stamped, ...places];
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertPlace(uid, stamped).catch(() => {});
  return updated;
}

export function deletePlace(id: string): SavedPlace[] {
  if (isSampleMode()) {
    const updated = deleteSandboxPlace(id);
    notify();
    return updated;
  }
  // Record the local tombstone BEFORE the array rewrite: closes the window where a concurrent
  // remote snapshot (written before the async removePlace() transaction below lands) would
  // otherwise resurrect this item on the very next merge. See lib/local-tombstones.ts.
  addTombstone(DELETED_KEY, id);
  const updated = loadPlaces().filter(p => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) removePlace(uid, id).catch(() => {});
  return updated;
}

export function updatePlacePosition(id: string, lat: number, lon: number): SavedPlace[] {
  if (isSampleMode()) {
    const existing = getSandboxPlaces().find(p => p.id === id);
    if (!existing) { notify(); return getSandboxPlaces(); }
    const updated = upsertSandboxPlace({ ...existing, lat, lon, updatedAt: Date.now() });
    notify();
    return updated;
  }
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

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two lat/lon points, in metres. Pure, no dependency added —
 * no other geo/haversine helper existed in lib/ to reuse (checked). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Find the nearest already-saved place within `radiusM` metres of (lat, lon) — used by the
 * save flow (components/SavedPlaces.tsx handleSave) to warn before minting a second SavedPlace
 * row for the same real-world farm (two saves of the same site fork downstream coordinate-keyed
 * data, e.g. designSiteIdFromLocation's 5dp-rounded site id). Pure — reads via loadPlaces() —
 * so it's trivially unit-testable and does no merging/deciding on its own; callers decide what
 * to do with the match.
 */
export function findNearbyPlace(lat: number, lon: number, radiusM = 60): SavedPlace | null {
  let best: SavedPlace | null = null;
  let bestDist = Infinity;
  for (const p of loadPlaces()) {
    const d = distanceMeters(lat, lon, p.lat, p.lon);
    if (d <= radiusM && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/**
 * THE save-time duplicate-site guard — the ONE authority every SavedPlace-creation entry point
 * must call before minting a new id (components/SavedPlaces.tsx handleSave, components/
 * DataPanel.tsx quickSavePlace, components/Map.tsx confirmSavePlace). A review caught the guard
 * wired into only one of the three save buttons; per this repo's recurring drift pattern, the
 * check + wording live here once rather than being pasted per call site.
 *
 * Returns the existing nearby place the farmer chose to UPDATE (callers must reuse its id — that
 * is the entire point, so coordinate-keyed downstream data doesn't fork onto a second id), or
 * null to proceed with a brand-new save (no nearby place, farmer declined, or SSR).
 */
export function promptNearbyUpdate(lat: number, lon: number): SavedPlace | null {
  if (typeof window === 'undefined') return null;
  const nearby = findNearbyPlace(lat, lon);
  if (!nearby) return null;
  const distM = Math.round(distanceMeters(lat, lon, nearby.lat, nearby.lon));
  const update = window.confirm(
    `You already saved "${nearby.name}" about ${distM} m from here. Update that place instead of creating a second one? (OK = update "${nearby.name}", Cancel = save as a new place)`,
  );
  return update ? nearby : null;
}

const MAIN_KEY = 'imbewu_main_site_id';

export function getMainSiteId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MAIN_KEY);
}

export function setMainSiteId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MAIN_KEY, id);
  notify(); // reuse the same 'permamap-places-changed' event listeners already subscribe to
}

// Pure resolver (takes the already-loaded list) so callers can reuse a single
// loadPlaces() read and so this stays trivially testable.
export function resolveMainSite(places: SavedPlace[]): SavedPlace | null {
  if (places.length === 0) return null;
  if (places.length === 1) return places[0]; // sole site is auto-main, no prompt
  const mainId = getMainSiteId();
  if (mainId) {
    const found = places.find((p) => p.id === mainId);
    if (found) return found;
  }
  // No main set, or the previously-pinned place was deleted — fall back to the
  // most-recently-touched place. Array order isn't reliable: savePlace() prepends
  // new saves but updatePlacePosition() edits in place without reordering.
  return places.reduce((newest, p) => {
    const pTime = p.updatedAt ?? Date.parse(p.savedAt);
    const newestTime = newest.updatedAt ?? Date.parse(newest.savedAt);
    return pTime > newestTime ? p : newest;
  }, places[0]);
}
