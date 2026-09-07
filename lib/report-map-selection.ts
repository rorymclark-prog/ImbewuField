import type { ReportPlateCandidate } from './report-plates';
import { activeAccountLocalStorageKey } from './account-local-storage';

export const REPORT_MAP_TYPES = [
  { key: 'base', label: 'Existing site & boundary', zu: 'Indawo ekhona nomngcele', step: 'base' },
  { key: 'sector', label: 'Sector analysis', zu: 'Ukuhlaziywa kwemikhakha', step: 'glossy' },
  { key: 'zones', label: 'Zones', zu: 'Izindawo', step: 'zones' },
  { key: 'water', label: 'Water', zu: 'Amanzi', step: 'water' },
  { key: 'earthworks', label: 'Earthworks', zu: 'Imisebenzi yomhlaba', step: 'water' },
  { key: 'planting', label: 'Planting', zu: 'Ukutshala', step: 'planting' },
  { key: 'structures', label: 'Structures', zu: 'Izakhiwo', step: 'structures' },
  { key: 'whole', label: 'Whole design', zu: 'Umklamo ophelele', step: 'glossy' },
  { key: 'phasing', label: 'Implementation & phasing', zu: 'Ukuqalisa ngezigaba', step: 'glossy' },
] as const;
export type ReportMapType = typeof REPORT_MAP_TYPES[number]['key'];
export type MapReview = 'saved' | 'needs-changes' | 'reviewed';
export interface ReportMapSelection { siteId: string; ids: string[] }
export interface SiteMapReview {
  reviews: Record<string, MapReview>;
  notNeeded: string[];
  preferred: Record<string, string>;
}
export const emptyMapReview = (): SiteMapReview => ({ reviews: {}, notNeeded: [], preferred: {} });

/** Old numbering changed when Earthworks was added. Recognise names, never infer a type
 * from the number alone. New saves retain this explicit type alongside the original label. */
export function reportMapType(candidate: Pick<ReportPlateCandidate, 'label'> & { sheetType?: string }): ReportMapType | undefined {
  if (REPORT_MAP_TYPES.some(t => t.key === candidate.sheetType)) return candidate.sheetType as ReportMapType;
  const name = candidate.label.replace(/^\s*\d{1,2}\s*[·—–.-]\s*/, '').split('·')[0].trim().toLowerCase();
  const rules: Array<[ReportMapType, RegExp]> = [
    ['base', /^(existing site|site & base|base map|site base|site survey|site$)/],
    ['sector', /^sector\b/], ['zones', /^zones?\b/], ['water', /^water\b/],
    ['earthworks', /^earthworks?\b/], ['planting', /^planting\b/], ['structures', /^structures?\b/],
    ['whole', /^(whole|integrated masterplan|final master ?plan|masterplan)\b/],
    ['phasing', /^(implementation|phasing)\b/],
  ];
  return rules.find(([, re]) => re.test(name))?.[0];
}
export function reportMapGroup(candidate: ReportPlateCandidate & { sheetType?: string }): string {
  return reportMapType(candidate) ?? `other:${candidate.label.split('·')[0].trim().toLowerCase()}`;
}
export function groupReportMaps<T extends ReportPlateCandidate & { sheetType?: string }>(maps: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const map of maps) {
    const key = reportMapGroup(map);
    groups.set(key, [...(groups.get(key) ?? []), map]);
  }
  for (const rows of groups.values()) rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id));
  return groups;
}
export function defaultReportMapIds(maps: readonly ReportPlateCandidate[], review: SiteMapReview): string[] {
  const order = REPORT_MAP_TYPES.map(t => t.key as string);
  return [...groupReportMaps(maps)].sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : 99) - (order.includes(b) ? order.indexOf(b) : 99)).filter(([key]) => !review.notNeeded.includes(key)).map(([key, rows]) => {
    return rows.find(m => m.id === review.preferred[key])?.id
      ?? rows.find(m => review.reviews[m.id] === 'reviewed')?.id ?? rows[0].id;
  }).slice(0, 12);
}
export function normaliseReportMapSelection(value: unknown, siteId: string): ReportMapSelection | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as ReportMapSelection;
  if (v.siteId !== siteId || !Array.isArray(v.ids) || v.ids.length > 12 || !v.ids.every(id => typeof id === 'string' && !!id.trim() && id.length <= 256)) return;
  return { siteId, ids: [...new Set(v.ids)] };
}
/** Explicit empty selection means no maps; missing selected originals are never replaced. */
export function selectedReportMaps<T extends ReportPlateCandidate>(maps: readonly T[], selection: ReportMapSelection | undefined, siteId: string, review: SiteMapReview): T[] {
  const ids = selection?.siteId === siteId ? selection.ids : defaultReportMapIds(maps, review);
  return ids.flatMap(id => { const map = maps.find(m => m.id === id); return map ? [map] : []; });
}
function reviewKey(siteId: string) { return activeAccountLocalStorageKey(`imbewu_report_map_review:${siteId}`); }
export function loadSiteMapReview(siteId: string): SiteMapReview {
  try {
    const value = JSON.parse(window.localStorage.getItem(reviewKey(siteId)) ?? '{}');
    const result = emptyMapReview();
    if (!value || typeof value !== 'object') return result;
    for (const [id, status] of Object.entries(value.reviews ?? {})) {
      if (['saved', 'needs-changes', 'reviewed'].includes(status as string)) result.reviews[id] = status as MapReview;
    }
    result.notNeeded = Array.isArray(value.notNeeded) ? value.notNeeded.filter((v: unknown) => typeof v === 'string') : [];
    for (const [key, id] of Object.entries(value.preferred ?? {})) if (typeof id === 'string') result.preferred[key] = id;
    return result;
  } catch { return emptyMapReview(); }
}
export function saveSiteMapReview(siteId: string, review: SiteMapReview): boolean {
  try {
    window.localStorage.setItem(reviewKey(siteId), JSON.stringify(review));
    window.dispatchEvent(new CustomEvent('imbewu-map-review-changed', { detail: siteId }));
    return true;
  } catch { return false; }
}
