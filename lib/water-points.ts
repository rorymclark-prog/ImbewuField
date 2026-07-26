import { upsertWaterPoint, removeWaterPoint } from './user-sync';
import { getFirebase } from './firebase/init';
import { addTombstone } from './local-tombstones';

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

export function loadWaterPoints(): WaterPoint[] {
  if (typeof window === 'undefined') return [];
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function saveWaterPoint(pt: WaterPoint): WaterPoint[] {
  const stamped = { ...pt, updatedAt: Date.now() };
  const updated = [stamped, ...loadWaterPoints().filter((p) => p.id !== stamped.id)];
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertWaterPoint(uid, stamped).catch(() => {});
  return updated;
}

export function deleteWaterPoint(id: string): WaterPoint[] {
  // Record the local tombstone BEFORE the array rewrite — see lib/local-tombstones.ts for why
  // (closes the deletion-resurrection window against a concurrent remote snapshot).
  addTombstone(DELETED_KEY, id);
  const updated = loadWaterPoints().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) removeWaterPoint(uid, id).catch(() => {});
  return updated;
}

export function generateWaterPointId(): string {
  return `wp_${Math.random().toString(36).slice(2, 10)}`;
}
