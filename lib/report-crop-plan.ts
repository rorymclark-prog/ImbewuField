import type { DesignCanvasState } from './design-canvas';
import { bedsFromDesignCanvas, canvasMetreExtent } from './design-beds-bridge';
import { ELEMENTS_BY_ID } from './design-elements';
import { cropByKey, MONTHS_SHORT } from './crop-catalog';
import { buildOccupancyCalendar } from './crop-export-benchmark';
import { tasksForPlan, type Planting, type PlanBed, type CropPlanState } from './crop-plan';
import type { PlanNote } from './crop-autosuggest';
import type { CropPlanPdfInput } from './crop-export-pdf';
import type { FactCropPlan } from './report-site-facts';

export interface ReportCropSnapshot {
  siteId: string;
  capturedAt: string;
  planUpdatedAt: number;
  planNotes?: PlanNote[];
  planNotesAt?: number;
  beds: PlanBed[];
  plantings: Planting[];
  /** Metre-space copies for drawing only. They are never written back to the design. */
  outlines: Array<{ bedId: string; points: [number, number][] }>;
}

export function captureReportCropPlan(canvas: DesignCanvasState, plan: CropPlanState, siteId: string, now = new Date()): ReportCropSnapshot {
  const beds = bedsFromDesignCanvas(canvas).map(b => ({ ...b, kind: b.kind ?? 'bed' as const }));
  const ids = new Set(beds.map(b => b.id));
  const { wMetres, hMetres } = canvasMetreExtent(canvas);
  const outlines: ReportCropSnapshot['outlines'] = [];
  for (const item of canvas.items.filter(i => ids.has(i.id))) {
    const def = ELEMENTS_BY_ID[item.defId];
    const w = item.wM ?? def.wM, h = item.hM ?? def.hM, a = (item.rot ?? 0) * Math.PI / 180;
    const local: [number, number][] = def.shape === 'circle'
      ? Array.from({ length: 32 }, (_, i) => [Math.cos(i * Math.PI / 16) * w / 2, Math.sin(i * Math.PI / 16) * h / 2])
      : [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
    outlines.push({ bedId: item.id, points: local.map(([x, y]) => [item.x * wMetres + x * Math.cos(a) - y * Math.sin(a), item.y * hMetres + x * Math.sin(a) + y * Math.cos(a)]) });
  }
  for (const zone of canvas.zones.filter(z => ids.has(z.id))) outlines.push({ bedId: zone.id, points: zone.points.map(([x, y]) => [x * wMetres, y * hMetres]) });
  return { siteId, capturedAt: now.toISOString(), planUpdatedAt: plan.updatedAt, planNotes: plan.planNotes?.filter(n => n.bedIds?.length ? n.bedIds.every(id => ids.has(id)) : plan.plantings.every(p => ids.has(p.bedId))).map(n => ({ ...n, bedIds: n.bedIds ? [...n.bedIds] : undefined })), planNotesAt: plan.planNotesAt, beds, plantings: plan.plantings.filter(p => ids.has(p.bedId)).map(p => ({ ...p })), outlines };
}

/** A malformed new attachment must not discard a readable legacy report. */
export function normaliseReportCropSnapshot(value: unknown): ReportCropSnapshot | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as ReportCropSnapshot;
  if (typeof v.siteId !== 'string' || !v.siteId || typeof v.capturedAt !== 'string' || !Number.isFinite(Date.parse(v.capturedAt)) || !Number.isFinite(v.planUpdatedAt)) return;
  if (!Array.isArray(v.beds) || v.beds.length > 1000 || !Array.isArray(v.plantings) || v.plantings.length > 10000 || !Array.isArray(v.outlines)) return;
  const str = (s: unknown): s is string => typeof s === 'string' && s.length > 0 && s.length <= 200;
  if (!v.beds.every(b => b && str(b.id) && str(b.label) && Number.isFinite(b.areaM2) && b.areaM2 > 0)) return;
  const ids = new Set(v.beds.map(b => b.id));
  if (ids.size !== v.beds.length) return;
  if (!v.plantings.every(p => p && str(p.id) && ids.has(p.bedId) && str(p.cropKey) && Number.isInteger(p.sowMonth) && p.sowMonth >= 1 && p.sowMonth <= 12 && (p.areaFraction === undefined || Number.isFinite(p.areaFraction) && p.areaFraction > 0 && p.areaFraction <= 1) && (p.variety === undefined || typeof p.variety === 'string') && [p.once, p.inNursery].every(d => d === undefined || typeof d === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(d)))) return;
  if (!v.outlines.every(o => o && ids.has(o.bedId) && Array.isArray(o.points) && o.points.length >= 3 && o.points.length <= 10000 && o.points.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isFinite(n) && Math.abs(n) < 1e8)))) return;
  return { siteId: v.siteId, capturedAt: v.capturedAt, planUpdatedAt: v.planUpdatedAt, planNotes: Array.isArray(v.planNotes) ? v.planNotes.filter(n => n && ['warning', 'choice', 'gap', 'basis'].includes(n.kind) && typeof n.text === 'string').slice(0, 100).map(n => ({ kind: n.kind, text: n.text.slice(0, 4000), bedIds: Array.isArray(n.bedIds) ? n.bedIds.filter(id => ids.has(id)) : undefined })) : undefined, planNotesAt: Number.isFinite(v.planNotesAt) ? v.planNotesAt : undefined, beds: v.beds.map(b => ({ id: b.id, label: b.label, areaM2: b.areaM2, kind: b.kind === 'plot' ? 'plot' : 'bed', ...(Number.isFinite(b.minDimM) ? { minDimM: b.minDimM } : {}) })), plantings: v.plantings.map(p => ({ id: p.id, bedId: p.bedId, cropKey: p.cropKey, sowMonth: p.sowMonth, areaFraction: p.areaFraction, existing: p.existing === true, once: p.once, inNursery: p.inNursery, variety: p.variety?.trim().slice(0, 120) || undefined })), outlines: v.outlines.map(o => ({ bedId: o.bedId, points: o.points.map(p => [...p] as [number, number]) })) };
}

export function reportCropMonths(s: ReportCropSnapshot) {
  const start = new Date(s.capturedAt);
  return Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), start.getMonth() + i, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' }));
}
export function reportCropCalendar(s: ReportCropSnapshot) {
  return buildOccupancyCalendar(s.plantings, s.beds, new Date(s.capturedAt).getMonth() + 1);
}
export function reportCropSignature(s: Pick<ReportCropSnapshot, 'beds' | 'plantings' | 'outlines'>) {
  return JSON.stringify([s.beds.map(b => [b.id, b.label, b.areaM2, b.kind ?? 'bed', b.minDimM ?? null]), s.plantings.map(p => [p.id, p.bedId, p.cropKey, p.sowMonth, p.areaFraction ?? 1, !!p.existing, p.once ?? '', p.inNursery ?? '', p.variety ?? '']), s.outlines]);
}
export interface ReportCropRow { key: string; name: string; cropKey?: string; where: string; sow: string; status: string; variety: string }
export function reportCropRows(crop: FactCropPlan): ReportCropRow[] {
  const s = crop.snapshot;
  if (s) {
    const grouped = new Map<string, ReportCropRow>();
    for (const p of s.plantings) {
      const status = p.inNursery ? 'In nursery' : p.existing ? 'Recorded as growing' : p.once ? 'First season only' : 'Planned annual sowing';
      const sow = p.once ?? MONTHS_SHORT[p.sowMonth - 1];
      const variety = p.variety || 'Not recorded';
      // Group only identical sowing/status/variety rows, keeping the bed-month link intact.
      const key = JSON.stringify([p.cropKey, sow, status, variety]);
      const where = s.beds.find(b => b.id === p.bedId)?.label ?? 'Not recorded';
      const previous = grouped.get(key);
      if (previous) { if (!previous.where.split(', ').includes(where)) previous.where += `, ${where}`; }
      else grouped.set(key, { key, cropKey: p.cropKey, name: cropByKey(p.cropKey)?.name ?? p.cropKey, where, sow, status, variety });
    }
    return [...grouped.values()];
  }
  return crop.crops.map(c => ({ key: c.name, name: c.name, where: c.bedLabels.join(', '), sow: c.sowMonths.join(', '), status: c.alreadyGrowing ? 'Includes a recorded growing crop' : c.firstSeasonOnlyMonths.length ? `Includes first-season sowing: ${c.firstSeasonOnlyMonths.join(', ')}` : 'Planned', variety: 'Not recorded' }));
}

const xml = (s: string) => s.replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]!));
export function reportCropMapLayout(s: ReportCropSnapshot, offset: number) {
  if (!s.outlines.length) return [];
  const pts = s.outlines.flatMap(o => o.points), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys), dx = Math.max(...xs) - minX, dy = Math.max(...ys) - minY;
  if (!(dx > 0 && dy > 0)) return [];
  const scale = Math.min(740 / dx, 350 / dy), ox = (800 - dx * scale) / 2, oy = (410 - dy * scale) / 2;
  const calendar = reportCropCalendar(s);
  return s.outlines.map(o => {
    const points = o.points.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale] as [number, number]);
    return { points, cx: points.reduce((a, p) => a + p[0], 0) / points.length, cy: points.reduce((a, p) => a + p[1], 0) / points.length, number: s.beds.findIndex(b => b.id === o.bedId) + 1, active: !!calendar.find(b => b.bedId === o.bedId)?.cells[offset]?.length };
  });
}
export function reportCropMapSvg(s: ReportCropSnapshot, offset: number): string | null {
  const shapes = reportCropMapLayout(s, offset);
  if (!shapes.length) return null;
  const body = shapes.map(({ points, cx, cy, number, active }) => `<polygon points="${points.map(p => p.join(',')).join(' ')}" fill="${active ? '#d4e7d9' : '#f2f1ec'}" stroke="#315740" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="12" fill="#173f2d"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="white">${number}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="410" viewBox="0 0 800 410"><title>${xml(`Saved growing spaces - ${reportCropMonths(s)[offset]}`)}</title><rect width="800" height="410" fill="white"/>${body}</svg>`;
}

export function reportCropWorkingInput(s: ReportCropSnapshot, title: string): CropPlanPdfInput {
  const now = new Date(s.capturedAt);
  return { plantings: s.plantings, beds: s.beds, tasks: tasksForPlan(s.plantings, s.beds, now.getMonth() + 1), now, planNotes: s.planNotes, planNotesAt: s.planNotesAt, sections: ['calendar', 'plan', 'buying', 'fieldsheets', 'record'], meta: { planTitle: title, siteLine: 'Saved site report crop plan', locationLine: title, climateLine: '', bedsSummary: `${s.beds.length} beds / plots`, dateLabel: now.toLocaleDateString('en-ZA'), estimatedKgPerYear: null, lossPercent: 0, lossAllowanceConfirmed: false } };
}
