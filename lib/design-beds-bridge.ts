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
export const BED_DEF_IDS = ['veg_bed', 'keyhole_bed', 'herb_spiral'] as const;

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Design-Studio canvas items → crop-planner beds. Pure; returns [] when state is
 * null. Only items whose defId is a plantable bed are included, in canvas
 * (array) placement order. Each bed's real-world area comes from the item's own
 * size override (wM/hM in metres) when present, else the catalog default for
 * that def — matching how the old facilitator computeDesignBeds derives area.
 * For circle-footprint defs (keyhole bed, herb spiral) wM === hM === diameter,
 * so wM*hM is the bounding-box area, consistent with the legacy bed maths.
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
