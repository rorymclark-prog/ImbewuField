// Design Studio — base-layer resolver.
//
// refLayers (app/design/page.tsx) is built ONLY from main-map traced layers, never from Studio-
// drawn ZoneShape features (design-canvas.ts GroundFeatureKind). A farmer who traces house/
// driveway/boundary inside the Studio's Base step gets ZoneShape rings that most sheets never
// read. resolveBaseLayers is the single place that decides, per slot, which geometry actually
// describes 'the house' etc. — PURE, no React, no canvas, so it is unit-testable without
// mounting the Studio.
//
// FIRST STAGE ONLY (docs/RENDER-INVESTIGATION-2026-07-20.md, studio-only section): per-slot
// 'biggest Studio ring wins, else the map ring, else none'. It deliberately does NOT dedupe a
// Studio ring that was ADOPTED from the very map layer refLayers also carries (see
// adoptTracedLayer's sourceFeatureId in components/design/DesignCanvas.tsx) — that merge is
// later work. This module is also not wired into any render call site yet (DesignGlossy,
// DesignPrint, buildPhasePlan, deriveWaterSystem, producerLabels, layerContentCount all still
// read refLayers directly) — landing the resolver standalone first means it has zero blast
// radius on any existing sheet until a follow-up change wires it in.

import type { DesignCanvasState, GroundFeatureKind } from '@/lib/design-canvas';

export type BaseLayerSlot = 'boundary' | 'house' | 'driveway';
export type BaseLayerSource = 'studio' | 'map' | 'none';

// Only the fields resolveBaseLayers reads — a structural subset of the several near-identical
// RefLayers interfaces scattered across the app (app/design/page.tsx, DesignPrint.tsx,
// producer-labels.ts, phasing.ts, water-system.ts — the investigation's own finding on that
// duplication), so this module doesn't have to import any one of them.
export interface MapRefLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  // True when the main-map driveway was traced as an AREA (polygon) rather than a track (line) —
  // see driveIsArea, app/design/page.tsx.
  drivewayClosed?: boolean;
}

export interface ResolvedBaseLayers {
  boundary: Array<[number, number]>;
  house: Array<[number, number]>;
  driveway: Array<[number, number]>;
  drivewayClosed: boolean;
  source: Record<BaseLayerSlot, BaseLayerSource>;
}

/** Signed-area magnitude of a normalised ring (shoelace) — used only to pick the LARGEST ring
 *  when a farmer has traced the same feature more than once. Deliberately a local copy (mirrors
 *  DesignGlossy.tsx's own `ringArea`) rather than an import — this module must stay free of the
 *  5,000-line canvas component so it can be unit-tested in isolation. */
function ringArea(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

function largestStudioRing(state: DesignCanvasState, feature: GroundFeatureKind): Array<[number, number]> | null {
  let best: Array<[number, number]> | null = null;
  let bestArea = -1;
  for (const z of state.zones) {
    if (z.feature !== feature || z.points.length < 3) continue;
    const a = ringArea(z.points);
    if (a > bestArea) {
      bestArea = a;
      best = z.points;
    }
  }
  return best;
}

/** Per slot: the largest matching Studio ZoneShape feature wins; else the main-map ring; else
 *  none. A farmer who only ever traces on the main map gets EXACTLY today's refLayers back
 *  (source 'map' on every populated slot, 'none' on an empty one) — this function changes
 *  nothing for them; it only has an effect once a ZoneShape with a matching `feature` exists. */
export function resolveBaseLayers(state: DesignCanvasState, refLayers: MapRefLayers): ResolvedBaseLayers {
  const source: Record<BaseLayerSlot, BaseLayerSource> = { boundary: 'none', house: 'none', driveway: 'none' };

  const boundaryStudio = largestStudioRing(state, 'boundary');
  const boundary = boundaryStudio ?? (refLayers.boundary.length >= 3 ? refLayers.boundary : []);
  source.boundary = boundaryStudio ? 'studio' : refLayers.boundary.length >= 3 ? 'map' : 'none';

  const houseStudio = largestStudioRing(state, 'house');
  const house = houseStudio ?? (refLayers.house.length >= 3 ? refLayers.house : []);
  source.house = houseStudio ? 'studio' : refLayers.house.length >= 3 ? 'map' : 'none';

  const drivewayStudio = largestStudioRing(state, 'driveway');
  const driveway = drivewayStudio ?? (refLayers.driveway.length >= 2 ? refLayers.driveway : []);
  source.driveway = drivewayStudio ? 'studio' : refLayers.driveway.length >= 2 ? 'map' : 'none';
  // A Studio-drawn feature ring is always a closed polygon — DesignCanvas.commitZone refuses
  // fewer than 3 points for every feature, boundary/house/driveway included — so a Studio-sourced
  // driveway is closed by construction. Only a MAP-sourced driveway can be the open TRACK line
  // drivewayClosed exists to distinguish from a traced paved area.
  const drivewayClosed = source.driveway === 'studio' ? true : (refLayers.drivewayClosed ?? false);

  return { boundary, house, driveway, drivewayClosed, source };
}
