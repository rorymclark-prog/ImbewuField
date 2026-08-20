'use client';

// ── Reading the farm's own map, for the report ────────────────────────────────────────────────
//
// The CLIENT half of lib/report-site-facts.ts. Everything the report needs about THIS farm already
// exists in local state — the report just never asked for it. This module asks, once, and hands
// back the pure `ReportSiteFacts` the API route renders.
//
// It is separate from report-site-facts.ts on purpose: that module is imported by the API route
// and must stay free of window/localStorage, while this one reads both. Nothing here computes a
// number that the app does not already compute somewhere else — every area, length and capacity
// comes from the app's existing accessors (summariseDesignStudio, bedsFromDesignCanvas,
// studioBoundaryMetrics, surveyRoofAreaM2, statedTankCapacityLitres) so the report can never
// disagree with the plan sheets about the same farm.
//
// The one exception is zone area/contents, which nothing exported before; it uses the canvas's own
// exported ringAreaOf + pointInRing at the same ground scale the sheets use, so it is the same
// maths, not a second opinion.

import turfArea from '@turf/area';
import turfLength from '@turf/length';
import type { Feature } from 'geojson';

import { pointInRing, ringAreaOf, type DesignCanvasState } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, ZONE_DEFS } from '@/lib/design-elements';
import { summariseDesignStudio } from '@/lib/design-studio-report';
import { bedsFromDesignCanvas, BED_DEF_IDS } from '@/lib/design-beds-bridge';
import { studioBoundaryMetrics, surveyRoofAreaM2, studioRoofAreaM2 } from '@/lib/studio-traced-areas';
import { statedTankCapacityLitres, TANK_IDS } from '@/lib/water-system';
import { computeTracedAreaTotals, loadDesignStudioState, mergeFarmShapesIntoDesignState } from '@/lib/design-studio';
import { readLocalFarmShapes } from '@/lib/map-sync';
import { loadWaterPoints, type WaterPoint } from '@/lib/water-points';
import { loadCropPlan, type CropPlanState } from '@/lib/crop-plan';
import { cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type {
  FactElementGroup,
  FactTank,
  FactWaterPoint,
  FactZone,
  ReportSiteFacts,
} from '@/lib/report-site-facts';

/** Water-catalog elements that ARE a body of water, not a container of it. */
const WATER_BODY_DEF_IDS: ReadonlySet<string> = new Set(['pond_small', 'dam', 'borehole']);

/** Map water-point categories that name a body of water. */
const WATER_BODY_CATEGORIES: ReadonlySet<string> = new Set(['Dam', 'Borehole', 'Spring', 'Well', 'Pond']);

/** Same precedence as design-studio-report.ts and studio-traced-areas.ts: the farmer's own
 *  scaleFactor outranks the projection. Kept local because neither module exports it. */
function metreExtent(state: DesignCanvasState): { wMetres: number; hMetres: number } {
  const scale = state.scaleFactor && Number.isFinite(state.scaleFactor) && state.scaleFactor > 0
    ? state.scaleFactor
    : 1;
  const mPerPx = state.frame.mPerPx * scale;
  return { wMetres: state.frame.imgW * mPerPx, hMetres: state.frame.imgH * mPerPx };
}

/**
 * The permaculture effort-zone rings the farmer drew, with their true area and what sits inside.
 *
 * A ZoneShape with no `feature` IS an effort zone (a `feature` makes it a ground/built ring — see
 * design-canvas.ts). Containment is a plain ray-cast in normalised space, which is valid because
 * both the ring and the item centres live in the same normalised frame; area is the canvas's own
 * shoelace scaled into metre space.
 */
function collectZones(state: DesignCanvasState): FactZone[] {
  const { wMetres, hMetres } = metreExtent(state);
  if (!(wMetres > 0) || !(hMetres > 0)) return [];
  const zones: FactZone[] = [];
  for (const zone of state.zones) {
    if (zone.feature || zone.points.length < 3) continue;
    const areaM2 = Math.round(ringAreaOf(zone.points) * wMetres * hMetres);
    if (!(areaM2 > 0)) continue;
    // Counted, not just named: "Moringa Tree" where the farmer placed two of them under-reports
    // their own plan, and a funder reading the zone list against the map will spot the difference.
    const counts = new Map<string, number>();
    for (const item of state.items) {
      const def = ELEMENTS_BY_ID[item.defId];
      if (!def) continue;
      if (!pointInRing([item.x, item.y], zone.points)) continue;
      const name = item.label?.trim() || def.name;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const names = [...counts.entries()].map(([name, count]) => (count > 1 ? `${name} x${count}` : name));
    let staplePlots = 0;
    for (const other of state.zones) {
      if (other.feature !== 'staple_garden' || other.points.length < 3) continue;
      const cx = other.points.reduce((sum, p) => sum + p[0], 0) / other.points.length;
      const cy = other.points.reduce((sum, p) => sum + p[1], 0) / other.points.length;
      if (pointInRing([cx, cy], zone.points)) staplePlots += 1;
    }
    const zoneNumber = Number(zone.zone);
    zones.push({
      zone: zoneNumber,
      label: ZONE_DEFS[zone.zone]?.label ?? `Zone ${zoneNumber}`,
      areaM2,
      contains: names.slice(0, 12),
      staplePlots,
    });
  }
  return zones.sort((a, b) => a.zone - b.zone);
}

/** The property boundary and roof as traced on the MAP, when the Design Studio has no ring.
 *  Mirrors computeTracedAreaTotals' own ~2 km proximity guard so a farmer's other site's shapes
 *  can never be summed into this one. */
function mapTracedAreas(siteId: string, lat: number, lon: number): {
  boundary: { areaM2: number; perimeterM: number; name?: string } | null;
} {
  try {
    const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), loadDesignStudioState(siteId), siteId);
    const NEAR_DEG = 0.02;
    const near = merged.layers.filter((layer) => {
      const geom = layer.geometry;
      const first = geom && geom.type === 'Polygon'
        ? geom.coordinates?.[0]?.[0]
        : geom && geom.type === 'MultiPolygon'
          ? geom.coordinates?.[0]?.[0]?.[0]
          : null;
      if (!first) return false;
      return Math.abs(first[1] - lat) < NEAR_DEG && Math.abs(first[0] - lon) < NEAR_DEG;
    });
    const boundaryLayer = near
      .filter((layer) => layer.layerType === 'property_boundary')
      .sort((a, b) => b.areaM2 - a.areaM2)[0];
    if (!boundaryLayer) return { boundary: null };
    const feature = { type: 'Feature', properties: {}, geometry: boundaryLayer.geometry } as Feature;
    let perimeterM = 0;
    try {
      perimeterM = turfLength(feature as never, { units: 'kilometers' }) * 1000;
    } catch { perimeterM = 0; }
    let areaM2 = boundaryLayer.areaM2;
    if (!(areaM2 > 0)) {
      try { areaM2 = turfArea(feature); } catch { areaM2 = 0; }
    }
    if (!(areaM2 > 0)) return { boundary: null };
    return {
      boundary: {
        areaM2: Math.round(areaM2),
        perimeterM: Math.round(perimeterM * 10) / 10,
        name: boundaryLayer.name,
      },
    };
  } catch {
    return { boundary: null };
  }
}

export interface CollectFactsInput {
  siteId: string;
  lat: number;
  lon: number;
  canvas: DesignCanvasState | null;
  /** The farm's own name, from the saved place. Injected rather than read so the caller keeps
   *  control of WHICH pin the report is about. */
  farmName?: string;
  /** Overridable for tests; defaults to the app's own loaders. */
  waterPoints?: WaterPoint[];
  cropPlan?: CropPlanState | null;
}

/**
 * Everything the report should know about THIS farm, read once.
 *
 * Never throws: a report that fails to generate because a water-point blob was malformed is worse
 * than a report missing the water-point row, and every field is optional by design — an absent
 * field prints as "not drawn / not recorded", never as a default.
 */
export function collectReportSiteFacts(input: CollectFactsInput): ReportSiteFacts {
  const facts: ReportSiteFacts = {};
  if (input.farmName?.trim()) facts.farmName = input.farmName.trim();

  const canvas = input.canvas;

  // ── The drawn design ──
  if (canvas) {
    try {
      const summary = summariseDesignStudio(canvas);
      const bedDefIds = new Set<string>(BED_DEF_IDS);
      const elements: FactElementGroup[] = summary.elements
        .filter((groupItem) => !bedDefIds.has(groupItem.defId))
        .map((groupItem) => ({
          name: groupItem.name,
          category: groupItem.category,
          count: groupItem.count,
          status: groupItem.status,
          // The catalog id rides along so the BOQ prices off a stable key rather than a display
          // name the farmer is free to change — see FactElementGroup.defId and lib/report-boq.ts.
          defId: groupItem.defId,
        }));
      const planBeds = bedsFromDesignCanvas(canvas);
      const beds = planBeds.map((bed) => ({
        label: bed.label,
        areaM2: bed.areaM2,
        kind: bed.kind === 'plot' ? ('plot' as const) : ('bed' as const),
      }));
      const bedAreaM2 = beds.filter((b) => b.kind === 'bed').reduce((sum, b) => sum + b.areaM2, 0);
      const plotAreaM2 = beds.filter((b) => b.kind === 'plot').reduce((sum, b) => sum + b.areaM2, 0);
      const routes = summary.routes.map((route) => ({
        label: route.label,
        count: route.count,
        totalLengthM: route.totalLengthM,
        kind: route.kind,
      }));
      const zones = collectZones(canvas);
      if (beds.length || elements.length || routes.length || zones.length) {
        facts.design = {
          beds,
          bedCount: beds.filter((b) => b.kind === 'bed').length,
          bedAreaM2: Math.round(bedAreaM2 * 10) / 10,
          plotCount: beds.filter((b) => b.kind === 'plot').length,
          plotAreaM2: Math.round(plotAreaM2 * 10) / 10,
          growingAreaM2: Math.round((bedAreaM2 + plotAreaM2) * 10) / 10,
          elements,
          routes,
          zones,
          ...(canvas.updatedAt ? { savedAt: canvas.updatedAt.slice(0, 10) } : {}),
        };
      }
    } catch { /* a malformed canvas means "no design", never a made-up one */ }
  }

  // ── Water: tanks drawn, points pinned, bodies of water ──
  const tanks: FactTank[] = [];
  const bodies: FactWaterPoint[] = [];
  if (canvas) {
    try {
      const summary = summariseDesignStudio(canvas);
      for (const groupItem of summary.elements) {
        if (TANK_IDS.has(groupItem.defId)) {
          const def = ELEMENTS_BY_ID[groupItem.defId];
          tanks.push({
            name: groupItem.name,
            count: groupItem.count,
            statedLitres: def ? statedTankCapacityLitres(def) : null,
            status: groupItem.status,
          });
        } else if (WATER_BODY_DEF_IDS.has(groupItem.defId)) {
          const def = ELEMENTS_BY_ID[groupItem.defId];
          bodies.push({ name: groupItem.name, category: def?.name ?? 'Water body' });
        }
      }
    } catch { /* keep going — an unreadable canvas must not erase the map's water points */ }
  }
  let waterPoints: WaterPoint[] = [];
  try {
    waterPoints = input.waterPoints ?? loadWaterPoints();
  } catch { waterPoints = []; }
  const mapPoints: FactWaterPoint[] = waterPoints.map((point) => ({
    name: point.name,
    category: point.category || 'Other',
  }));
  for (const point of waterPoints) {
    if (point.category && WATER_BODY_CATEGORIES.has(point.category)) {
      bodies.push({ name: point.name, category: point.category });
    }
  }
  if (tanks.length || mapPoints.length || bodies.length) {
    facts.water = {
      tanks,
      statedStorageLitres: tanks.reduce((sum, tank) => sum + (tank.statedLitres ?? 0) * tank.count, 0),
      tanksOfUnknownCapacity: tanks.filter((tank) => tank.statedLitres === null).length,
      mapPoints,
      bodies,
    };
  }

  // ── Roof: Studio ring wins, the map's traced roof is the fallback, zero means UNKNOWN ──
  let tracedRoofM2 = 0;
  try {
    tracedRoofM2 = computeTracedAreaTotals(input.siteId, input.lat, input.lon).roofAreaM2;
  } catch { tracedRoofM2 = 0; }
  const roofM2 = surveyRoofAreaM2(canvas, tracedRoofM2);
  if (roofM2 > 0) {
    facts.roof = {
      areaM2: Math.round(roofM2),
      source: studioRoofAreaM2(canvas) > 0 ? 'Traced by the farmer in the Design Studio' : 'Traced by the farmer on the map',
    };
  }

  // ── Boundary: the traced ring, never the sum of every shape on the map ──
  const studioBoundary = canvas ? studioBoundaryMetrics(canvas) : null;
  if (studioBoundary) {
    facts.boundary = {
      areaM2: Math.round(studioBoundary.areaM2),
      perimeterM: Math.round(studioBoundary.perimeterM * 10) / 10,
      source: `Traced by the farmer in the Design Studio (${studioBoundary.vertexCount} points)`,
    };
  } else {
    const mapped = mapTracedAreas(input.siteId, input.lat, input.lon).boundary;
    if (mapped) {
      facts.boundary = {
        areaM2: mapped.areaM2,
        ...(mapped.perimeterM > 0 ? { perimeterM: mapped.perimeterM } : {}),
        source: 'Traced by the farmer on the map',
        ...(mapped.name ? { label: mapped.name } : {}),
      };
    }
  }

  // ── The farmer's own measurements ──
  if (canvas) {
    const measurements: NonNullable<ReportSiteFacts['measurements']> = {};
    if (canvas.scaleFactor && Number.isFinite(canvas.scaleFactor) && canvas.scaleFactor > 0 && canvas.scaleFactor !== 1) {
      measurements.scaleFactor = Math.round(canvas.scaleFactor * 1000) / 1000;
    }
    if (canvas.localWind?.prevailingFrom) {
      measurements.localWindFrom = canvas.localWind.prevailingFrom;
      if (canvas.localWind.strongestFrom) measurements.localWindStrongestFrom = canvas.localWind.strongestFrom;
    }
    if (typeof canvas.dailyWaterUseL === 'number' && Number.isFinite(canvas.dailyWaterUseL) && canvas.dailyWaterUseL > 0) {
      measurements.dailyWaterUseL = Math.round(canvas.dailyWaterUseL);
    }
    if (Object.keys(measurements).length) facts.measurements = measurements;
  }

  // ── The crop plan already entered — WHAT and WHERE and WHEN, deliberately no yields ──
  try {
    const plan = input.cropPlan ?? loadCropPlan();
    const plantings = plan?.plantings ?? [];
    if (plantings.length) {
      const bedLabelById = new Map<string, string>();
      for (const bed of bedsFromDesignCanvas(canvas)) bedLabelById.set(bed.id, bed.label);
      const byCrop = new Map<string, { name: string; sowMonths: Set<number>; bedLabels: Set<string>; alreadyGrowing: boolean; recurringMonths: Set<number>; onceMonths: Set<number> }>();
      const bedsUsed = new Set<string>();
      for (const planting of plantings) {
        const crop = cropByKey(planting.cropKey);
        const name = crop?.name ?? planting.cropKey;
        const entry = byCrop.get(name) ?? { name, sowMonths: new Set<number>(), bedLabels: new Set<string>(), alreadyGrowing: false, recurringMonths: new Set<number>(), onceMonths: new Set<number>() };
        // Planting.sowMonth is ONE-based (1 = January) — every other reader in the codebase does
        // MONTHS_SHORT[sowMonth - 1] (crop-plan.ts:609, crop-autosuggest.ts:1004,
        // crop-export-schedule.ts:36) and occupiedMonthsForPlanting rejects anything outside 1..12.
        // Reading it zero-based silently shifts every date in the report by a month and drops
        // December entirely.
        if (Number.isInteger(planting.sowMonth) && planting.sowMonth >= 1 && planting.sowMonth <= 12) {
          entry.sowMonths.add(planting.sowMonth);
          // A one-time first-season starter is tracked apart from the repeating
          // rows: merged in, its month reads to the report model as ground the
          // farmer's annual plan covers every year, which is the opposite of
          // what a `once` row means.
          if (typeof planting.once === 'string') entry.onceMonths.add(planting.sowMonth);
          else entry.recurringMonths.add(planting.sowMonth);
        }
        const label = bedLabelById.get(planting.bedId);
        if (label) entry.bedLabels.add(label);
        if (planting.existing) entry.alreadyGrowing = true;
        byCrop.set(name, entry);
        bedsUsed.add(planting.bedId);
      }
      facts.crop = {
        plantingCount: plantings.length,
        bedsPlanted: bedsUsed.size,
        crops: [...byCrop.values()].map((entry) => ({
          name: entry.name,
          sowMonths: [...entry.sowMonths].sort((a, b) => a - b).map((month) => MONTHS_SHORT[month - 1] ?? String(month)),
          bedLabels: [...entry.bedLabels],
          alreadyGrowing: entry.alreadyGrowing,
          // Only months NO recurring row covers: where the annual plan sows the
          // same crop in the same month anyway, the month is genuinely covered
          // every year and the starter is not what makes it true.
          firstSeasonOnlyMonths: [...entry.onceMonths]
            .filter((month) => !entry.recurringMonths.has(month))
            .sort((a, b) => a - b)
            .map((month) => MONTHS_SHORT[month - 1] ?? String(month)),
        })),
      };
    }
  } catch { /* no crop plan is a fact, not an error */ }

  return facts;
}
