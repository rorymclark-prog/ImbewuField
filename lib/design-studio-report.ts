// ── What the farmer actually designed, as report facts ───────────────────────
//
// The 11-section report was BLIND to the Design Studio: 'master-design' and 'planting' shipped
// "pending" placeholders sourced from the old geometry layers, while the farmer's real plan —
// placed elements, chosen species, traced routes and ground areas — sat in DesignCanvasState a
// key away. This module is the bridge: a pure summary of the SAVED design, nothing more.
//
// Honesty rules, in order of importance:
// - Counts are the farmer's own placements ('user-reported' — it is their design, restated).
// - Lengths and areas are computed from traced geometry at the frame's ground scale
//   ('measured', with the basis naming the trace). scaleFactor is honoured because the
//   farmer's own measurement of a known wall outranks the projection (see design-canvas.ts).
// - NO PRICES. Costing a Studio element needs a defId→price-book mapping and an
//   existing-vs-proposed costing rule — money-path decisions that are Rory's to make, not a
//   summary's to imply. 'cost-labour' is deliberately untouched by this module.
//
// PURE MODULE — no react, no window, no fetch. Callable from any report builder and from tests.

import type { DesignCanvasState, LineShape } from '@/lib/design-canvas';
import { GROUND_FEATURES, ELEMENTS_BY_ID } from '@/lib/design-elements';

export interface StudioElementGroup {
  /** Display name — the farmer's own label when they renamed the item, else the catalog name.
   *  Same grouping rule the sheet legends use, so the report and the plan sheets agree. */
  name: string;
  defId: string;
  category: string;
  count: number;
  /** 'existing' | 'proposed' | 'mixed' — mixed when one name covers both. */
  status: 'existing' | 'proposed' | 'mixed';
}

export interface StudioRouteGroup {
  kind: LineShape['kind'];
  label: string;
  count: number;
  totalLengthM: number;
  /** Only a width the farmer stated; a drawing's legibility band is never a dimension. */
  statedWidthM?: number;
}

export interface StudioGroundArea {
  name: string;
  areaM2: number;
}

export interface StudioReportSummary {
  /** Every placed element, grouped by display name — growing and infrastructure alike. */
  elements: StudioElementGroup[];
  /** The growing subset, for the planting tables. */
  planted: StudioElementGroup[];
  routes: StudioRouteGroup[];
  groundAreas: StudioGroundArea[];
}

const ROUTE_LABELS: Record<LineShape['kind'], string> = {
  swale: 'Swale (on-contour earthwork)',
  fence: 'Fence',
  path: 'Path',
  bedpath: 'Bed path',
  pipe: 'Water pipe',
  drip: 'Drip line',
  windbreak: 'Windbreak row',
  greywater: 'Greywater line',
};

/** Shoelace area of a normalised ring, in square metres at the frame's ground scale. */
function ringAreaM2(points: Array<[number, number]>, wMetres: number, hMetres: number): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * wMetres * (y2 * hMetres) - x2 * wMetres * (y1 * hMetres);
  }
  return Math.abs(sum) / 2;
}

function polylineLengthM(points: Array<[number, number]>, wMetres: number, hMetres: number): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(
      (points[i][0] - points[i - 1][0]) * wMetres,
      (points[i][1] - points[i - 1][1]) * hMetres,
    );
  }
  return total;
}

export function summariseDesignStudio(state: DesignCanvasState): StudioReportSummary {
  const scale = (state.scaleFactor && Number.isFinite(state.scaleFactor) && state.scaleFactor > 0)
    ? state.scaleFactor
    : 1;
  const mPerPx = state.frame.mPerPx * scale;
  const wMetres = state.frame.imgW * mPerPx;
  const hMetres = state.frame.imgH * mPerPx;

  // ── Elements, grouped by display name (label ?? catalog name — the legend's own rule) ──
  const byName = new Map<string, StudioElementGroup>();
  for (const it of state.items) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue; // an unknown defId must vanish here exactly as it does on the sheets
    const name = it.label?.trim() || def.name;
    const status: 'existing' | 'proposed' = it.status === 'existing' ? 'existing' : 'proposed';
    const group = byName.get(name);
    if (!group) {
      byName.set(name, { name, defId: def.id, category: def.category, count: 1, status });
    } else {
      group.count += 1;
      if (group.status !== status) group.status = 'mixed';
    }
  }
  const elements = [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const planted = elements.filter((group) => group.category === 'growing');

  // ── Routes, grouped by kind ──
  const byKind = new Map<LineShape['kind'], StudioRouteGroup>();
  for (const line of state.lines) {
    if (line.points.length < 2) continue;
    const label = ROUTE_LABELS[line.kind];
    if (!label) continue;
    const lengthM = polylineLengthM(line.points, wMetres, hMetres);
    const group = byKind.get(line.kind);
    if (!group) {
      byKind.set(line.kind, {
        kind: line.kind,
        label,
        count: 1,
        totalLengthM: lengthM,
        ...(line.kind === 'swale' && Number.isFinite(line.widthM) && (line.widthM as number) > 0
          ? { statedWidthM: line.widthM }
          : {}),
      });
    } else {
      group.count += 1;
      group.totalLengthM += lengthM;
      // Two swales with different stated widths cannot honestly share one printed width.
      if (line.kind === 'swale' && group.statedWidthM !== undefined && group.statedWidthM !== line.widthM) {
        delete group.statedWidthM;
      }
    }
  }
  const routes = [...byKind.values()]
    .map((group) => ({ ...group, totalLengthM: Math.round(group.totalLengthM * 10) / 10 }))
    .sort((a, b) => b.totalLengthM - a.totalLengthM);

  // ── Traced ground areas (named feature rings, never effort zones) ──
  const groundAreas: StudioGroundArea[] = [];
  for (const zone of state.zones) {
    if (!zone.feature || zone.feature === 'boundary' || zone.points.length < 3) continue;
    const label = zone.name?.trim() || GROUND_FEATURES[zone.feature]?.label;
    if (!label) continue;
    const areaM2 = Math.round(ringAreaM2(zone.points, wMetres, hMetres));
    if (areaM2 <= 0) continue;
    groundAreas.push({ name: label, areaM2 });
  }
  groundAreas.sort((a, b) => b.areaM2 - a.areaM2);

  return { elements, planted, routes, groundAreas };
}

/** True when the summary carries anything worth printing — the builder falls back to its
 *  "pending" placeholders otherwise, so an empty Studio never erases a section. */
export function studioSummaryHasContent(summary: StudioReportSummary | null | undefined): summary is StudioReportSummary {
  return Boolean(summary && (summary.elements.length || summary.routes.length || summary.groundAreas.length));
}
