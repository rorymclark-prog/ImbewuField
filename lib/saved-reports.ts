import type { LocationData, SiteData, WaterData } from '@/lib/types';

// A permaculture report saved locally so the farmer can re-read it without
// regenerating (each generation is an AI call). We store the markdown plus a
// snapshot of the location data so the charts/header re-render exactly.
export interface SavedReport {
  id: string;
  name: string;          // e.g. "Indian Ocean Coastal Belt · 2026-06-22"
  savedAt: string;       // ISO date
  lang: string;
  report: string;        // the generated markdown
  location: LocationData;
  siteData?: SiteData;
  waterData?: WaterData;
}

const KEY = 'imbewu_saved_reports';

export function loadReports(): SavedReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-reports-changed'));
}

export function saveReport(r: SavedReport): SavedReport[] {
  const others = loadReports().filter((x) => x.id !== r.id);
  const updated = [r, ...others].slice(0, 50); // keep the 50 most recent
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { /* quota — ignore */ }
  notify();
  return updated;
}

export function deleteReport(id: string): SavedReport[] {
  const updated = loadReports().filter((x) => x.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
  notify();
  return updated;
}

export function reportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
