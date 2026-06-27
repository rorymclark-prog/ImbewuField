import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { markLocalStorageKeyUpdated } from '@/lib/map-sync';

// Remembers the farmer's most recently analysed site so the global chat
// assistant stays site-aware on every page (not just the map).
const KEY = 'imbewu_last_site';

export interface LastSite {
  locationData: LocationData;
  siteData?: SiteData | null;
  waterData?: WaterData | null;
}

export function setLastSite(s: LastSite) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    markLocalStorageKeyUpdated(KEY);
  } catch {}
}

export function getLastSite(): LastSite | null {
  if (typeof window === 'undefined') return null;
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
