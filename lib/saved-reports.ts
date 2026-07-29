import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { isSampleMode } from './sample-mode';
import { isValidLocationData, isValidSiteData, isValidWaterData } from './last-site';

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
const MAX_REPORTS = 50;

type UnknownRecord = Record<string, unknown>;

function normaliseReport(value: unknown): SavedReport | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as UnknownRecord;
  if (typeof row.id !== 'string' || !row.id.trim()
      || typeof row.name !== 'string' || !row.name.trim()
      || typeof row.savedAt !== 'string' || !Number.isFinite(Date.parse(row.savedAt))
      || typeof row.lang !== 'string' || !row.lang.trim()
      || typeof row.report !== 'string' || !row.report.trim()
      || !isValidLocationData(row.location)) return null;

  const report: SavedReport = {
    id: row.id,
    name: row.name,
    savedAt: row.savedAt,
    lang: row.lang,
    report: row.report,
    location: row.location,
  };
  if (isValidSiteData(row.siteData)) report.siteData = row.siteData;
  if (isValidWaterData(row.waterData)) report.waterData = row.waterData;
  return report;
}

export function loadReports(): SavedReport[] {
  if (isSampleMode()) return []; // never surface the real signed-in user's own saved reports inside a demo
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const reports: SavedReport[] = [];
    for (const candidate of value) {
      const report = normaliseReport(candidate);
      if (!report || seen.has(report.id)) continue;
      seen.add(report.id);
      reports.push(report);
      if (reports.length >= MAX_REPORTS) break;
    }
    return reports;
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-reports-changed'));
}

export function saveReport(r: SavedReport): { reports: SavedReport[]; saved: boolean } {
  if (isSampleMode()) return { reports: [], saved: false }; // demo "save" no-ops — never writes real storage
  const current = loadReports();
  const safe = normaliseReport(r);
  if (!safe || typeof window === 'undefined') return { reports: current, saved: false };
  const others = current.filter((x) => x.id !== safe.id);
  const updated = [safe, ...others].slice(0, MAX_REPORTS);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    return { reports: current, saved: false };
  }
  notify();
  return { reports: updated, saved: true };
}

export function deleteReport(id: string): SavedReport[] {
  if (isSampleMode()) return []; // no-op — nothing real was ever saved to delete
  const current = loadReports();
  const updated = current.filter((x) => x.id !== id);
  if (typeof window === 'undefined' || updated.length === current.length) return current;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    return current;
  }
  notify();
  return updated;
}

export function reportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
