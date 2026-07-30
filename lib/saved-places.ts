import { upsertPlace, removePlace, mergeItems } from './user-sync';
import { getFirebase } from './firebase/init';
import { isSampleMode, getSandboxPlaces, upsertSandboxPlace, deleteSandboxPlace } from './sample-mode';
import { addTombstone, readTombstones } from './local-tombstones';
import { activeAccountLocalStorageKey } from './account-local-storage';

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

const PLACE_LABEL_VALUES = new Set<PlaceLabel>(PLACE_LABELS.map((label) => label.v));

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isValidSavedPlace(value: unknown): value is SavedPlace {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.name === 'string'
    && typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
    && typeof value.lon === 'number' && Number.isFinite(value.lon) && value.lon >= -180 && value.lon <= 180
    && typeof value.biome === 'string'
    && typeof value.rainfall === 'number' && Number.isFinite(value.rainfall)
    && typeof value.elevation === 'number' && Number.isFinite(value.elevation)
    // Pre-sync local records used an empty timestamp. Keep them readable at timestamp zero;
    // network shares apply the stricter ISO requirement at their own trust boundary.
    && typeof value.savedAt === 'string'
    && (value.savedAt === '' || Number.isFinite(Date.parse(value.savedAt)))
    && (value.updatedAt === undefined
      || (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0))
    && (value.label === undefined || PLACE_LABEL_VALUES.has(value.label as PlaceLabel))
    && (value.color === undefined || typeof value.color === 'string')
    && (value.notes === undefined || typeof value.notes === 'string');
}

function placeTimestamp(place: SavedPlace): number {
  const savedAt = Date.parse(place.savedAt);
  return place.updatedAt ?? (Number.isFinite(savedAt) ? savedAt : 0);
}

export function normalisePlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedPlace>();
  for (const candidate of value) {
    if (!isValidSavedPlace(candidate)) continue;
    const current = byId.get(candidate.id);
    if (!current || placeTimestamp(candidate) >= placeTimestamp(current)) {
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()];
}

export function loadPlaces(): SavedPlace[] {
  if (isSampleMode()) return normalisePlaces(getSandboxPlaces());
  if (typeof window === 'undefined') return [];
  try {
    return normalisePlaces(JSON.parse(localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? '[]'));
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
  if (!isValidSavedPlace(place)) throw new Error('Invalid saved place');
  const stamped: SavedPlace = { ...place, updatedAt: Date.now() };
  if (isSampleMode()) {
    const updated = upsertSandboxPlace(stamped);
    notify();
    return updated;
  }
  const places = loadPlaces().filter(p => p.id !== stamped.id);
  const updated = [stamped, ...places];
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertPlace(uid, stamped).catch(() => {});
  return updated;
}

export function deletePlace(id: string): SavedPlace[] {
  if (isSampleMode()) {
    const current = normalisePlaces(getSandboxPlaces());
    if (!id || !current.some((place) => place.id === id)) return current;
    const updated = deleteSandboxPlace(id);
    notify();
    return updated;
  }
  const current = loadPlaces();
  if (!id || !current.some((place) => place.id === id)) return current;
  const deletedAt = Date.now();
  const updated = current.filter(p => p.id !== id);
  // localStorage writes are synchronous: persist the visible deletion before its tombstone so
  // a quota/security failure cannot leave a deletion marker for a place still present locally.
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  addTombstone(activeAccountLocalStorageKey(DELETED_KEY), id, deletedAt);
  notify();
  const uid = currentUid();
  // Thread the SAME timestamp into removePlace() as its `deletedAtMs` — not a fresh Date.now()
  // sampled whenever that async transaction eventually commits — so a delayed delete on a slow
  // connection can't retroactively kill a genuinely newer edit from another device. See
  // removePlace()/isDeleteStale() in lib/user-sync.ts.
  if (uid) removePlace(uid, id, deletedAt).catch(() => {});
  return updated;
}

/**
 * Merge an externally-sourced batch of places — currently only the `?share=<code>` site import
 * in components/Map.tsx — into localStorage through the SAME union-by-id/newest-updatedAt-wins/
 * tombstone-aware path every other write in this app goes through (lib/user-sync.ts's
 * mergeItems()), instead of a raw full-array `localStorage.setItem` overwrite.
 *
 * Why this matters: the raw overwrite bypassed loadPlaces()/mergeItems()/tombstones entirely, so
 * importing a shared site could silently clobber places this device had added locally since its
 * last sync, or resurrect a place this device had just deleted (its local tombstone — see
 * lib/local-tombstones.ts — was never consulted). This still delivers the shared places: any
 * incoming place absent locally, or newer (by updatedAt) than what's stored locally, wins the
 * merge exactly as it would from any other sync path — only a place this device deliberately
 * tombstoned in a way that outranks the incoming copy is excluded.
 *
 * A shared site carries no deletion tombstones of its own (see lib/site-share.ts's
 * SharedSiteData — no `deleted` field), so `remoteDel` is always {}.
 */
export function mergeIncomingPlaces(incoming: SavedPlace[]): SavedPlace[] {
  if (isSampleMode()) return getSandboxPlaces(); // sample mode never accepts external data (safety layer)
  const safeIncoming = normalisePlaces(incoming);
  if (typeof window === 'undefined') return safeIncoming;
  const local = loadPlaces();
  const localDel = readTombstones(activeAccountLocalStorageKey(DELETED_KEY));
  const { items } = mergeItems(
    safeIncoming,
    local,
    {},
    localDel,
    (p) => p.id,
    placeTimestamp,
    Date.now(),
  );
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(items));
  notify();
  return items;
}

export function updatePlacePosition(id: string, lat: number, lon: number): SavedPlace[] {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Invalid place position');
  }
  if (isSampleMode()) {
    const current = normalisePlaces(getSandboxPlaces());
    const existing = current.find(p => p.id === id);
    if (!existing || (existing.lat === lat && existing.lon === lon)) return current;
    const updated = upsertSandboxPlace({ ...existing, lat, lon, updatedAt: Date.now() });
    notify();
    return updated;
  }
  const current = loadPlaces();
  const existing = current.find((place) => place.id === id);
  if (!existing || (existing.lat === lat && existing.lon === lon)) return current;
  const moved: SavedPlace = { ...existing, lat, lon, updatedAt: Date.now() };
  const updated = current.map(p => {
    if (p.id !== id) return p;
    return moved;
  });
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertPlace(uid, moved).catch(() => {});
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
  return localStorage.getItem(activeAccountLocalStorageKey(MAIN_KEY));
}

export function setMainSiteId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(activeAccountLocalStorageKey(MAIN_KEY), id);
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
