export type WaterPointCategory = 'Dam' | 'Borehole' | 'Spring' | 'Well' | 'Pond' | 'Tank' | 'Other';

export interface WaterPoint {
  id: string;
  name: string;
  category: WaterPointCategory | '';
  lat: number;
  lon: number;
  createdAt: string; // ISO
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

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-water-points-changed'));
}

export function loadWaterPoints(): WaterPoint[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; }
}

export function saveWaterPoint(pt: WaterPoint): WaterPoint[] {
  const updated = [pt, ...loadWaterPoints().filter((p) => p.id !== pt.id)];
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  return updated;
}

export function deleteWaterPoint(id: string): WaterPoint[] {
  const updated = loadWaterPoints().filter((p) => p.id !== id);
  localStorage.setItem(KEY, JSON.stringify(updated));
  notify();
  return updated;
}

export function generateWaterPointId(): string {
  return `wp_${Math.random().toString(36).slice(2, 10)}`;
}
