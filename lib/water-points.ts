import { upsertWaterPoint, removeWaterPoint, mergeItems } from './user-sync';
import { getFirebase } from './firebase/init';
import { addTombstone, readTombstones } from './local-tombstones';
import { activeAccountLocalStorageKey } from './account-local-storage';

export type WaterPointCategory = 'Dam' | 'Borehole' | 'Spring' | 'Well' | 'Pond' | 'Tank' | 'Other';

export interface WaterPoint {
  id: string;
  name: string;
  category: WaterPointCategory | '';
  lat: number;
  lon: number;
  createdAt: string; // ISO
  updatedAt?: number; // ms — last edit time, drives cross-device newest-wins merge
}

export const WATER_POINT_CATEGORIES: { v: WaterPointCategory; icon: string; color: string }[] = [
  { v: 'Dam',      icon: '🌊', color: '#1A5F8C' },
  { v: 'Pond',     icon: '💧', color: '#2D7BAA' },
  { v: 'Borehole', icon: '⚙',  color: '#5C5040' },
  { v: 'Spring',   icon: '♒',  color: '#3A9E7C' },
  { v: 'Well',     icon: '⭕',  color: '#7A5230' },
  { v: 'Tank',     icon: '🔵',  color: '#235E86' },
  { v: 'Other',    icon: '📍',  color: '#8C7A62' },
];

const WATER_POINT_CATEGORY_VALUES = new Set<WaterPointCategory>(
  WATER_POINT_CATEGORIES.map((category) => category.v),
);

export function categoryColor(cat?: string): string {
  return WATER_POINT_CATEGORIES.find((c) => c.v === cat)?.color ?? '#235E86';
}

const KEY = 'imbewu_water_points';
const DELETED_KEY = `${KEY}_deleted`; // local deletion tombstones — see lib/local-tombstones.ts

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-water-points-changed'));
}

function currentUid(): string | undefined {
  return getFirebase()?.auth?.currentUser?.uid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isValidWaterPoint(value: unknown): value is WaterPoint {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.name === 'string'
    && (value.category === '' || WATER_POINT_CATEGORY_VALUES.has(value.category as WaterPointCategory))
    && typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
    && typeof value.lon === 'number' && Number.isFinite(value.lon) && value.lon >= -180 && value.lon <= 180
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && (value.updatedAt === undefined
      || (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0));
}

function waterPointTimestamp(point: WaterPoint): number {
  return point.updatedAt ?? Date.parse(point.createdAt);
}

export function normaliseWaterPoints(value: unknown): WaterPoint[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, WaterPoint>();
  for (const candidate of value) {
    if (!isValidWaterPoint(candidate)) continue;
    const current = byId.get(candidate.id);
    if (!current || waterPointTimestamp(candidate) >= waterPointTimestamp(current)) {
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()];
}

export function loadWaterPoints(): WaterPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    return normaliseWaterPoints(JSON.parse(
      localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? '[]',
    ));
  } catch {
    return [];
  }
}

export function saveWaterPoint(pt: WaterPoint): WaterPoint[] {
  if (!isValidWaterPoint(pt)) throw new Error('Invalid water point');
  const stamped: WaterPoint = { ...pt, updatedAt: Date.now() };
  const updated = [stamped, ...loadWaterPoints().filter((p) => p.id !== stamped.id)];
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertWaterPoint(uid, stamped).catch(() => {});
  return updated;
}

export function deleteWaterPoint(id: string): WaterPoint[] {
  const current = loadWaterPoints();
  if (!id || !current.some((point) => point.id === id)) return current;
  const deletedAt = Date.now();
  const updated = current.filter((p) => p.id !== id);
  // localStorage writes are synchronous: no snapshot callback can interleave these statements.
  // Persist the visible deletion first so a quota/security failure cannot leave a tombstone for
  // a point that is still present. The tombstone is then in place before control returns.
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  addTombstone(activeAccountLocalStorageKey(DELETED_KEY), id, deletedAt);
  notify();
  const uid = currentUid();
  // Thread the SAME timestamp into removeWaterPoint() as its `deletedAtMs` — see
  // removePlace()/isDeleteStale() in lib/user-sync.ts for why a fresh Date.now() sampled at
  // transaction-commit time would let a delayed delete kill a genuinely newer remote edit.
  if (uid) removeWaterPoint(uid, id, deletedAt).catch(() => {});
  return updated;
}

export function generateWaterPointId(): string {
  return `wp_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Merge an externally-sourced batch of water points — currently only the `?share=<code>` site
 * import in components/Map.tsx — into localStorage through the same union-by-id/newest-wins/
 * tombstone-aware path every other write goes through (lib/user-sync.ts's mergeItems()), instead
 * of a raw full-array overwrite. See lib/saved-places.ts's mergeIncomingPlaces() for the full
 * rationale — this is the water-point mirror of the same fix.
 */
export function mergeIncomingWaterPoints(incoming: WaterPoint[]): WaterPoint[] {
  const safeIncoming = normaliseWaterPoints(incoming);
  if (typeof window === 'undefined') return safeIncoming;
  const local = loadWaterPoints();
  const localDel = readTombstones(activeAccountLocalStorageKey(DELETED_KEY));
  const { items } = mergeItems(
    safeIncoming,
    local,
    {},
    localDel,
    (p) => p.id,
    waterPointTimestamp,
    Date.now(),
  );
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(items));
  notify();
  return items;
}
