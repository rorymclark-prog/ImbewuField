import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { isSampleMode } from './sample-mode';

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
  if (isSampleMode()) return []; // never surface the real signed-in user's own saved reports inside a demo
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

export function saveReport(r: SavedReport): { reports: SavedReport[]; saved: boolean } {
  if (isSampleMode()) return { reports: [], saved: false }; // demo "save" no-ops — never writes real storage
  const others = loadReports().filter((x) => x.id !== r.id);
  const updated = [r, ...others].slice(0, 50); // keep the 50 most recent
  let saved = false;
  try {
    localStorage.setItem(KEY, JSON.stringify(updated));
    saved = true;
  } catch { /* quota exceeded — report not persisted */ }
  if (saved) notify();
  return { reports: updated, saved };
}

export function deleteReport(id: string): SavedReport[] {
  if (isSampleMode()) return []; // no-op — nothing real was ever saved to delete
  const updated = loadReports().filter((x) => x.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch {}
  notify();
  return updated;
}

export function reportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
