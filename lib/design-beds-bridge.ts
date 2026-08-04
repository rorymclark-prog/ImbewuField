// Bridge: Design Studio canvas → crop planner.
//
// The crop planner (app/facilitator/crops/page.tsx) historically read its beds
// from the OLD facilitator Konva canvas / Firestore designs — veg beds placed in
// the NEW Design Studio (lib/design-canvas.ts DesignCanvasState) never reached it.
// This module is that missing link: it reads a site's DesignCanvasState and
// exposes its plantable beds (and its fruit/food trees) in the exact shapes the
// crop planner's auto-suggest + seed-BOQ machinery already consumes (PlanBed).
//
// Pure functions, no React, no storage of their own — the caller loads the
// DesignCanvasState (via lib/design-canvas loadCanvasState) and passes it in.

import type { DesignCanvasState } from '@/lib/design-canvas';
import type { PlanBed } from '@/lib/crop-plan';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

/** defIds that count as plantable beds for the crop planner. */
export const BED_DEF_IDS = ['veg_bed', 'raised_bed', 'keyhole_bed', 'herb_spiral'] as const;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Ground metres-per-normalised-unit on each axis, with the farmer's scale correction applied —
 * mirrors lib/studio-traced-areas.ts's own (unexported) metreExtent exactly: same precedence
 * (scaleFactor first, frame.mPerPx underneath), same simplification (frame.mPerPx only — a custom
 * base photo's own calibrated mPerPx isn't consulted here either, matching that module). Copied
 * rather than imported because that module exports no such helper and is owned by another
 * engineer right now; this is the SAME projection, not a second one — see studio-traced-areas.ts's
 * own module comment for why a second opinion on this maths is the thing to avoid.
 */
function metreExtent(state: DesignCanvasState): { wMetres: number; hMetres: number } {
  const scale = state.scaleFactor && Number.isFinite(state.scaleFactor) && state.scaleFactor > 0
    ? state.scaleFactor
    : 1;
  const mPerPx = state.frame.mPerPx * scale;
  return { wMetres: state.frame.imgW * mPerPx, hMetres: state.frame.imgH * mPerPx };
}

/**
 * Real-world area (shoelace, same maths as studio-traced-areas.ts's ringAreaM2) plus the ring's
 * bounding-box short side, both in metres, for a normalised ring evaluated at this frame's scale.
 * `<3` points or a ~zero area is degenerate — the caller skips it rather than plant a phantom plot.
 */
function ringMetrics(
  points: ReadonlyArray<readonly [number, number]>,
  wMetres: number,
  hMetres: number,
): { areaM2: number; minDimM: number } {
  if (points.length < 3) return { areaM2: 0, minDimM: 0 };
  let twice = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0] * wMetres, yi = points[i][1] * hMetres;
    const xj = points[j][0] * wMetres, yj = points[j][1] * hMetres;
    twice += xj * yi - xi * yj;
    if (xi < minX) minX = xi;
    if (xi > maxX) maxX = xi;
    if (yi < minY) minY = yi;
    if (yi > maxY) maxY = yi;
  }
  return { areaM2: Math.abs(twice) / 2, minDimM: Math.min(maxX - minX, maxY - minY) };
}

/**
 * Design-Studio canvas items → crop-planner beds. Pure; returns [] when state is
 * null. Only items whose defId is a plantable bed are included, in canvas
 * (array) placement order. Each bed's real-world area comes from the item's own
 * size override (wM/hM in metres) when present, else the catalog default for
 * that def — matching how the old facilitator computeDesignBeds derives area.
 * For circle-footprint defs (keyhole bed, herb spiral) wM === hM === diameter,
 * so wM*hM is the bounding-box area, consistent with the legacy bed maths.
 *
 * Staple plots (ZoneShape rings with feature === 'staple_garden' — the field of
 * maize/beans/pumpkin, see GroundFeatureKind) come AFTER the item beds, as
 * kind: 'plot' PlanBeds: this is the ONE place a DesignCanvasState becomes crop-
 * planner beds, so every caller (crop planner, task board, harvest reconciliation,
 * site progress) gets plot rotation for free rather than needing its own zone scan.
 * A plot's id is its ZoneShape.id VERBATIM — rotation history and the plan-sheet
 * cartography (staplePlotOrdinalById, lib/crop-row-cartography.ts) both key off it,
 * so it can never be re-derived or re-numbered here. Plots are numbered in SAVED
 * (zones array) order — the same creation-order ordinal staplePlotOrdinalById uses,
 * so a plot's number never disagrees between the crop plan and the printed sheet —
 * with a zone's own `name` preferred when the farmer set one.
 */
export function bedsFromDesignCanvas(state: DesignCanvasState | null): PlanBed[] {
  if (!state) return [];
  const beds: PlanBed[] = [];
  let n = 0;
  for (const item of state.items) {
    if (!(BED_DEF_IDS as readonly string[]).includes(item.defId)) continue;
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def) continue;
    n += 1;
    const wM = item.wM ?? def.wM;
    const hM = item.hM ?? def.hM;
    beds.push({
      id: item.id,
      label: item.label ?? `Bed ${n}`,
      areaM2: round1(wM * hM),
      minDimM: Math.min(wM, hM),
    });
  }

  const { wMetres, hMetres } = metreExtent(state);
  let plotN = 0;
  for (const zone of state.zones) {
    if (zone.feature !== 'staple_garden') continue;
    // Ordinal counts every staple-garden zone, degenerate or not — matching
    // staplePlotOrdinalById, which has no notion of "degenerate" either — so a plot
    // that IS plantable never shifts number just because an earlier one got skipped.
    plotN += 1;
    if (!(wMetres > 0) || !(hMetres > 0)) continue;
    const { areaM2, minDimM } = ringMetrics(zone.points, wMetres, hMetres);
    if (zone.points.length < 3 || !(areaM2 > 0)) continue; // degenerate ring — nothing to plant
    beds.push({
      id: zone.id,
      label: zone.name ?? `Plot ${plotN}`,
      areaM2: round1(areaM2),
      minDimM,
      kind: 'plot',
    });
  }

  return beds;
}

/**
 * Fruit/food trees placed on the canvas — for the Simple-Path shopping-list
 * add-on ("Also buy: 2 × Citrus tree"). Any growing- or earthworks-category def
 * that casts shade is a tree/large perennial (see lib/design-elements
 * castsShade), grouped by defId with a count. Pure; [] when state is null.
 * Grouped in first-appearance order so the recap reads in the order the farmer
 * placed them. ('earthworks' is in the gate because the banana circle — a
 * shade-casting food plant — is an earthworks element; without it the shopping
 * list would quietly stop listing bananas.)
 */
export function treesFromDesignCanvas(
  state: DesignCanvasState | null,
): Array<{ defId: string; name: string; count: number }> {
  if (!state) return [];
  const order: string[] = [];
  const counts = new Map<string, number>();
  const names = new Map<string, string>();
  for (const item of state.items) {
    const def = ELEMENTS_BY_ID[item.defId];
    if (!def || (def.category !== 'growing' && def.category !== 'earthworks') || !def.castsShade) continue;
    if (!counts.has(item.defId)) {
      order.push(item.defId);
      names.set(item.defId, def.name);
    }
    counts.set(item.defId, (counts.get(item.defId) ?? 0) + 1);
  }
  return order.map((defId) => ({
    defId,
    name: names.get(defId)!,
    count: counts.get(defId)!,
  }));
}
