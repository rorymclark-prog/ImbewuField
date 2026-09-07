import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { activeAccountLocalStorageKey } from './account-local-storage';
import './sample-mode';
import { isValidLocationData, isValidSiteData, isValidWaterData } from './last-site';
import type { SavedPlace } from './saved-places';
import { designSiteIdFromLocation } from './design-studio';
import { normaliseReportSiteFacts, type ReportSiteFacts } from './report-site-facts';

// A permaculture report saved locally so the farmer can re-read it without
// regenerating (each generation is an AI call). We store the markdown plus a
// snapshot of the location data so the charts/header re-render exactly.
export interface ReportGenerationSettings {
  tone: 'simple' | 'professional';
  length: 'one-pager' | 'standard' | 'comprehensive';
  language: string;
  bilingual: boolean;
  sections: string[];
  generatedAt: string;
  provider?: string;
  model?: string;
}

export type ReportCoverChoice = 'auto' | 'map' | 'photo' | 'none';

export interface SavedReport {
  id: string;
  name: string;          // e.g. "Indian Ocean Coastal Belt · 2026-06-22"
  savedAt: string;       // ISO date
  lang: string;
  report: string;        // the generated markdown
  location: LocationData;
  siteData?: SiteData;
  waterData?: WaterData;
  /** The measured design/crop/BOQ facts used when this report was generated. */
  facts?: ReportSiteFacts;
  /** Absent on older reports: never infer historical settings from today's controls. */
  settings?: ReportGenerationSettings;
  coverChoice?: ReportCoverChoice;
}

export function reportSiteName(report: Pick<SavedReport, 'name' | 'facts' | 'location'>, places: SavedPlace[] = []): string {
  return report.facts?.farmName?.trim()
    || places.find(p => designSiteIdFromLocation(p) === designSiteIdFromLocation(report.location))?.name
    || report.name;
}

export function normaliseReportSettings(value: unknown): ReportGenerationSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const s = value as Record<string, unknown>;
  if (!['simple', 'professional'].includes(s.tone as string)
    || !['one-pager', 'standard', 'comprehensive'].includes(s.length as string)
    || typeof s.language !== 'string' || !s.language.trim()
    || typeof s.bilingual !== 'boolean'
    || !Array.isArray(s.sections) || !s.sections.length || s.sections.length > 100
    || !s.sections.every(v => typeof v === 'string' && v.trim())
    || typeof s.generatedAt !== 'string' || !Number.isFinite(Date.parse(s.generatedAt))) return undefined;
  return {
    tone: s.tone as ReportGenerationSettings['tone'], length: s.length as ReportGenerationSettings['length'],
    language: s.language, bilingual: s.bilingual, sections: [...new Set(s.sections as string[])], generatedAt: s.generatedAt,
    ...(typeof s.provider === 'string' && s.provider.trim() ? { provider: s.provider } : {}),
    ...(typeof s.model === 'string' && s.model.trim() ? { model: s.model } : {}),
  };
}

const KEY = 'imbewu_saved_reports';
// The root sample-mode shim redirects this same API into disposable memory. Keeping the
// report workflow intact lets the tour save/reopen/delete snapshots without touching an
// account's real history. Import the shim even when this store is used outside ReportView.
/** The store cap. EXPORTED so the message a farmer reads names the real number: a hard-coded
 *  "50" in the UI silently becomes a lie the day this changes. */
export const MAX_REPORTS = 50;

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
  const facts = normaliseReportSiteFacts(row.facts);
  if (facts) report.facts = facts;
  const settings = normaliseReportSettings(row.settings);
  if (settings) report.settings = settings;
  if (['auto', 'map', 'photo', 'none'].includes(row.coverChoice as string)) report.coverChoice = row.coverChoice as ReportCoverChoice;
  return report;
}

export function loadReports(): SavedReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(
      window.localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? '[]',
    );
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

export type SaveReportReason = 'store-full' | 'storage-error';

export interface SaveReportResult {
  reports: SavedReport[];
  saved: boolean;
  reason?: SaveReportReason;
}

export function saveReport(r: SavedReport): SaveReportResult {
  const current = loadReports();
  const safe = normaliseReport(r);
  if (!safe || typeof window === 'undefined') return { reports: current, saved: false };
  const isExisting = current.some((x) => x.id === safe.id);
  if (!isExisting && current.length >= MAX_REPORTS) {
    return { reports: current, saved: false, reason: 'store-full' };
  }
  const others = current.filter((x) => x.id !== safe.id);
  const updated = [safe, ...others].slice(0, MAX_REPORTS);
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  } catch {
    return { reports: current, saved: false, reason: 'storage-error' };
  }
  notify();
  return { reports: updated, saved: true };
}

export function deleteReport(id: string): SavedReport[] {
  const current = loadReports();
  const updated = current.filter((x) => x.id !== id);
  if (typeof window === 'undefined' || updated.length === current.length) return current;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  } catch {
    return current;
  }
  notify();
  return updated;
}

export function reportId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Grouping saved reports by site ──────────────────────────────────────────
//
// A SavedReport's `name` is a biome plus a date (see the comment on the interface above) — it
// carries no link to the farmer's own place. Two farms in the same biome produce rows a farmer
// cannot tell apart, and the report picker had no way to say "these three are Ubhejane Crèche,
// this one is the river field." That's the bug behind Rory's "should we see what sites first"
// ask.
//
// One function answers "which site does this report belong to" — every screen that groups saved
// reports by site (components/report/SavedReportsList.tsx today; the sole caller) must use THIS
// one, not re-derive its own grouping. This repo's most repeated defect is exactly one truth
// living in several places and drifting apart (see components/report/SavedReportsList.tsx's own
// header comment for the last time that happened to this exact screen).
//
// DERIVED FROM COORDINATES AT READ TIME, deliberately, not stamped onto SavedReport at save time:
// a place renamed after the report was saved shows its CURRENT name (no stale copy to migrate),
// and every report ever saved — including ones saved long before this feature existed — groups
// correctly with zero migration. The coordinate key is the SAME 5dp-rounded designSiteIdFromLocation
// the survey/design/crop stores already key off (lib/design-studio.ts), so this grouping can never
// disagree with the rest of the app about what counts as "the same site".

/** Sentinel siteId for the "not saved as a site" bucket — every report whose coordinates match no
 *  SavedPlace lands in ONE such group (not one bucket per orphan coordinate), so an untidy list of
 *  unnamed taps doesn't multiply into an untidy list of unnamed *groups*. Exported so callers can
 *  tell the two kinds of group apart without re-deriving the sentinel. */
export const UNSAVED_SITE_KEY = 'site:unsaved';

export interface SiteReportGroup {
  /** designSiteIdFromLocation() of the group's coordinates for a matched site, or UNSAVED_SITE_KEY
   *  for the catch-all. Stable across reloads, so a drill-down selection survives a re-render. */
  siteId: string;
  /** The matching saved place, or null for the "not saved as a site" catch-all. */
  place: SavedPlace | null;
  /** This group's reports, newest saved first. */
  reports: SavedReport[];
}

/**
 * Group a farmer's saved reports by the saved place their coordinates match, newest report first
 * within each group and newest-group-first overall. Reports matching no saved place are NOT
 * dropped — they collect under one UNSAVED_SITE_KEY group so a report can never go silently
 * missing just because the farmer never bookmarked that spot as a named place.
 */
export function groupReportsBySite(reports: SavedReport[], places: SavedPlace[]): SiteReportGroup[] {
  const placeBySiteId = new Map<string, SavedPlace>();
  for (const p of places) {
    placeBySiteId.set(designSiteIdFromLocation({ lat: p.lat, lon: p.lon } as LocationData), p);
  }

  const groups = new Map<string, SiteReportGroup>();
  for (const r of reports) {
    const matchedSiteId = designSiteIdFromLocation(r.location);
    const place = placeBySiteId.get(matchedSiteId) ?? null;
    const key = place ? matchedSiteId : UNSAVED_SITE_KEY;
    const existing = groups.get(key);
    if (existing) existing.reports.push(r);
    else groups.set(key, { siteId: key, place, reports: [r] });
  }

  const result = [...groups.values()];
  for (const g of result) g.reports.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  result.sort((a, b) => Date.parse(b.reports[0].savedAt) - Date.parse(a.reports[0].savedAt));
  return result;
}

/** The Reports door includes sites before their first report exists. Keep the established
 * coordinate matching and orphan bucket so renaming a place cannot lose a saved report. */
export function reportSiteChoices(reports: SavedReport[], places: SavedPlace[]): SiteReportGroup[] {
  const groups = groupReportsBySite(reports, places);
  const choices = new Map(groups.filter(g => g.place).map(g => [g.siteId, g]));
  for (const place of places) {
    const siteId = designSiteIdFromLocation(place);
    if (!choices.has(siteId)) choices.set(siteId, { siteId, place, reports: [] });
  }
  return [...choices.values()].sort((a, b) => a.place!.name.localeCompare(b.place!.name))
    .concat(groups.filter(g => !g.place));
}
