import type { CanvasFrame, DesignCanvasState, LineShape, PlacedItem } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

export interface WaterRouteStyle {
  color: string;
  dash: number[];
  width: number;
  label: string;
}

export type WaterRouteKind = Extract<LineShape['kind'], 'swale' | 'pipe' | 'drip' | 'greywater'>;

export type WaterLegendSection =
  | 'RAINWATER'
  | 'IRRIGATION'
  | 'FILTERED GREYWATER'
  | 'WATER EARTHWORKS';

export const WATER_LEGEND_SECTION_ORDER: readonly WaterLegendSection[] = [
  'RAINWATER',
  'IRRIGATION',
  'FILTERED GREYWATER',
  'WATER EARTHWORKS',
];

const RAINWATER_FEATURES = new Set([
  'jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000', 'rain_barrel',
  'first_flush', 'pump_filter',
]);

const FILTERED_GREYWATER_FEATURES = new Set([
  'greywater_outlet', 'greywater_diverter', 'greywater_basin', 'banana_circle', 'tree_basin',
]);

const WATER_EARTHWORK_FEATURES = new Set([
  'pond_small', 'dam', 'infiltration_basin', 'half_moon', 'berm', 'terrace',
]);

/** Reading-order group for the deterministic Water legend. This is deliberately based on stable
 * element IDs rather than display names, so a farmer can rename an item without moving it into a
 * different water system. */
export function waterLegendSectionForFeature(id: string): WaterLegendSection {
  if (RAINWATER_FEATURES.has(id) || id.startsWith('jojo_')) return 'RAINWATER';
  if (FILTERED_GREYWATER_FEATURES.has(id)) return 'FILTERED GREYWATER';
  if (WATER_EARTHWORK_FEATURES.has(id)) return 'WATER EARTHWORKS';
  return 'IRRIGATION';
}

export function waterLegendSectionForRoute(kind: WaterRouteKind): WaterLegendSection {
  if (kind === 'greywater') return 'FILTERED GREYWATER';
  if (kind === 'swale') return 'WATER EARTHWORKS';
  return 'IRRIGATION';
}

export type RenderWaterRoute = Pick<LineShape, 'id' | 'kind' | 'points'> & {
  kind: WaterRouteKind;
  visualBridge?: true;
};

/** One drawing registry for every line kind assigned to the Water sheet. */
export const WATER_ROUTE_STYLE: Record<WaterRouteKind, WaterRouteStyle> = {
  swale: { color: '#258DBA', dash: [], width: 5.6, label: 'Swale / contour water line' },
  // A buried main reads as one continuous pipe; repeated connector dots made the final sheet busy.
  pipe: { color: '#087CB8', dash: [], width: 6.2, label: 'Buried water pipe' },
  drip: { color: '#238ACB', dash: [], width: 4.2, label: 'Drip header and laterals' },
  greywater: { color: '#8A43B3', dash: [], width: 5.3, label: 'Filtered greywater line' },
};

/** The Earthworks editor and exact sheet paint the swale's physical cut-and-fill, not its
 * water-route function. The Water sheet retains WATER_ROUTE_STYLE's blue route ink; the
 * Earthworks sheet routes the same saved line through this brown casing/fill style. */
export interface EarthworksRouteStyle {
  casing: string;
  color: string;
  dash: number[];
  width: number;
  label: string;
}

export type EarthworksRouteKind = Extract<LineShape['kind'], 'swale'>;

export const EARTHWORKS_ROUTE_STYLE: Record<EarthworksRouteKind, EarthworksRouteStyle> = {
  // Dark casing plus warm soil centre reads as a built bank/trench at phone scale, while the
  // absence of blue and dashes stops the same saved line being mistaken for a water pipe.
  swale: { casing: '#5B3A22', color: '#A9743F', dash: [], width: 5.2, label: 'Swale / cut-and-fill earthwork' },
};

export function earthworksRouteStyleFor(kind: LineShape['kind']): EarthworksRouteStyle | undefined {
  return EARTHWORKS_ROUTE_STYLE[kind as EarthworksRouteKind];
}

export function waterRouteStyleFor(kind: LineShape['kind']): WaterRouteStyle | undefined {
  return WATER_ROUTE_STYLE[kind as WaterRouteKind];
}

export interface WaterRouteLegendEntry extends WaterRouteStyle {
  kind: WaterRouteKind;
  count: number;
  section: WaterLegendSection;
}

/** One truthful legend row per saved Water route kind. Visual bridge segments are render-only and
 * are deliberately not counted, so the legend always reports the farmer's saved design. */
export function waterRouteLegendEntries(lines: LineShape[]): WaterRouteLegendEntry[] {
  const counts = new Map<WaterRouteKind, number>();
  for (const line of lines) {
    const style = waterRouteStyleFor(line.kind);
    if (!style || line.points.length < 2) continue;
    const kind = line.kind as WaterRouteKind;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return (Object.keys(WATER_ROUTE_STYLE) as WaterRouteKind[])
    .filter((kind) => counts.has(kind))
    .map((kind) => ({
      kind,
      count: counts.get(kind)!,
      section: waterLegendSectionForRoute(kind),
      ...WATER_ROUTE_STYLE[kind],
    }));
}

const EMPHASIZED_WATER_HARDWARE = new Set([
  'tap_point', 'borehole', 'first_flush', 'pump_filter', 'greywater_diverter',
  'greywater_outlet', 'water_trough', 'water_trough2',
]);

const WATER_BASIN_FEATURES = new Set([
  'greywater_basin', 'tree_basin', 'banana_circle', 'infiltration_basin', 'half_moon',
]);

const WATER_POND_FEATURES = new Set(['pond_small', 'dam']);

/**
 * Small operational fittings are cartographic point symbols rather than literal footprints.
 * Their saved centre remains exact, but a modest print-scale enlargement keeps them legible on a
 * phone without changing their saved footprint or centre.
 */
export function waterFeaturePresentationScale(id: string): number {
  if (id.startsWith('jojo_') || id === 'rain_barrel') return 2.1;
  if (EMPHASIZED_WATER_HARDWARE.has(id)) return 1.7;
  if (WATER_BASIN_FEATURES.has(id)) return 1.45;
  if (WATER_POND_FEATURES.has(id)) return 1.35;
  return 1;
}

export interface WaterPresentationDimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Print-only emphasis for Water hardware and basins. The saved centre, rotation and aspect ratio
 * stay exact; only the displayed symbol size is enlarged enough to survive phone/export reduction.
 */
export function waterFeaturePresentationDimensions(
  id: string,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
  /**
   * Centre-to-centre distance in PIXELS to the nearest OTHER emphasised feature, when the caller
   * knows it. Emphasis is then capped so an enlarged symbol cannot grow across that gap.
   *
   * WHY: a jojo tank is emphasised 2.1x so it survives phone-size reduction, and Rory reported
   * tanks "overlapping" on a real farm. Nothing was wrong with the saved geometry — two tanks a
   * realistic distance apart had their PAINTED footprints inflated past that distance, so they
   * merged on the sheet. The only prior protection was a line in the AI prompt asking for "narrow
   * visible separation": advice, not a guarantee, and absent entirely from the free exact sheet.
   *
   * Omitted, behaviour is byte-for-byte what it was — a caller that does not know its neighbours
   * loses nothing.
   */
  nearestNeighbourPx?: number,
): WaterPresentationDimensions {
  const baseScale = waterFeaturePresentationScale(id);
  if (baseScale === 1) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  const shortSide = Math.max(0.01, Math.min(naturalWidth, naturalHeight));
  const longSide = Math.max(naturalWidth, naturalHeight);
  const minimumShortSide = Math.max(28, canvasWidth * 0.0195);
  const maximumLongSide = Math.max(minimumShortSide, canvasWidth * 0.08);
  const requestedScale = Math.max(baseScale, minimumShortSide / shortSide);
  let cappedScale = Math.min(requestedScale, maximumLongSide / Math.max(0.01, longSide));
  if (typeof nearestNeighbourPx === 'number' && Number.isFinite(nearestNeighbourPx) && nearestNeighbourPx > 0) {
    // Two symbols of width W centred D apart touch when W reaches D. Hold the painted width to 82%
    // of the gap so a lane of ground always survives between them — hardware that reads as one
    // merged blob is worse than hardware that reads slightly smaller.
    cappedScale = Math.min(cappedScale, (nearestNeighbourPx * 0.82) / Math.max(0.01, longSide));
  }
  // Never below 1: emphasis may be withheld, but a saved feature is never painted SMALLER than the
  // farmer drew it.
  const scale = Math.max(1, cappedScale);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    scale,
  };
}

/**
 * Centre-to-centre pixel distance from `index` to its nearest OTHER emphasised water feature, or
 * undefined when it has none. Lives here beside the cap it feeds, but the caller supplies the list
 * because only the renderer holds every placed feature's screen position.
 */
export function nearestWaterNeighbourPx(
  features: ReadonlyArray<{ id: string; cx: number; cy: number }>,
  index: number,
): number | undefined {
  const self = features[index];
  if (!self) return undefined;
  let best = Infinity;
  for (let i = 0; i < features.length; i++) {
    if (i === index) continue;
    const other = features[i];
    // An un-emphasised symbol is drawn at its true size and cannot balloon into us.
    if (waterFeaturePresentationScale(other.id) === 1) continue;
    const d = Math.hypot(other.cx - self.cx, other.cy - self.cy);
    if (d > 0 && d < best) best = d;
  }
  return Number.isFinite(best) ? best : undefined;
}

/**
 * Returns only saved tree canopies that are co-located with saved tree basins.
 *
 * This is a render-context relationship, not inferred planting: every returned canopy already
 * exists in the farmer's design, each basin can pair with at most one tree, and distant trees are
 * excluded. The Water sheet can therefore show what a greywater destination serves without
 * inventing an orchard or promoting Planting content into the Water legend.
 */
export function pairedWaterDestinationCanopyIds(
  state: Pick<DesignCanvasState, 'items'>,
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>,
): Set<string> {
  const basins = state.items
    .filter((item) => item.defId === 'tree_basin')
    .sort((a, b) => a.id.localeCompare(b.id));
  const trees = state.items
    .filter((item) => {
      const def = ELEMENTS_BY_ID[item.defId];
      return !!def && def.category === 'growing' && def.shape === 'circle' && item.defId.startsWith('tree_');
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const unusedTrees = new Set(trees.map((tree) => tree.id));
  const paired = new Set<string>();
  const distanceM = (a: PlacedItem, b: PlacedItem) => Math.hypot(
    (a.x - b.x) * frame.imgW * frame.mPerPx,
    (a.y - b.y) * frame.imgH * frame.mPerPx,
  );

  for (const basin of basins) {
    const def = ELEMENTS_BY_ID[basin.defId];
    const basinDiameterM = Math.max(basin.wM ?? def?.wM ?? 2, basin.hM ?? def?.hM ?? 2);
    const toleranceM = Math.max(1.5, basinDiameterM * 0.85);
    const nearest = trees
      .filter((tree) => unusedTrees.has(tree.id))
      .map((tree) => ({ tree, distance: distanceM(basin, tree) }))
      .filter(({ distance }) => distance <= toleranceM)
      .sort((a, b) => a.distance - b.distance || a.tree.id.localeCompare(b.tree.id))[0];
    if (!nearest) continue;
    paired.add(nearest.tree.id);
    unusedTrees.delete(nearest.tree.id);
  }
  return paired;
}

type RouteEndpoint = {
  key: string;
  lineId: string;
  kind: WaterRouteKind;
  point: [number, number];
  outwardM: [number, number];
};

function unit([x, y]: [number, number]): [number, number] | null {
  const length = Math.hypot(x, y);
  return length > 1e-9 ? [x / length, y / length] : null;
}

/**
 * Adds render-only bridge strokes across tiny, aligned gaps between matching route segments.
 * Saved geometry is never changed, and unlike an AI cleanup pass this cannot join different
 * systems or nearby parallel drip laterals.
 */
export function waterRoutesWithVisualBridges(
  lines: LineShape[],
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>,
  maxGapM = 0.25,
): RenderWaterRoute[] {
  const routes: RenderWaterRoute[] = lines
    .filter((line): line is LineShape & { kind: WaterRouteKind } => !!waterRouteStyleFor(line.kind) && line.points.length >= 2)
    .map((line) => ({ id: line.id, kind: line.kind, points: line.points }));
  const connectable = new Set<WaterRouteKind>(['pipe', 'drip', 'greywater']);
  const endpoints: RouteEndpoint[] = [];
  const toM = ([x, y]: [number, number]): [number, number] => [
    x * frame.imgW * frame.mPerPx,
    y * frame.imgH * frame.mPerPx,
  ];

  for (const line of routes) {
    if (!connectable.has(line.kind)) continue;
    const first = toM(line.points[0]);
    const second = toM(line.points[1]);
    const lastIndex = line.points.length - 1;
    const last = toM(line.points[lastIndex]);
    const previous = toM(line.points[lastIndex - 1]);
    endpoints.push({
      key: `${line.id}:start`,
      lineId: line.id,
      kind: line.kind,
      point: line.points[0],
      outwardM: [first[0] - second[0], first[1] - second[1]],
    });
    endpoints.push({
      key: `${line.id}:end`,
      lineId: line.id,
      kind: line.kind,
      point: line.points[lastIndex],
      outwardM: [last[0] - previous[0], last[1] - previous[1]],
    });
  }

  const candidates: Array<{ a: RouteEndpoint; b: RouteEndpoint; distanceM: number }> = [];
  // A bridge is presentation cleanup, never inferred plumbing. Keep both tolerances deliberately
  // tight: a quarter-metre seam and near-collinear tangents look like one imperfect phone trace;
  // anything larger or more angled is an ambiguous design decision and stays exactly as drawn.
  const minimumAlignment = Math.cos((20 * Math.PI) / 180);
  for (let i = 0; i < endpoints.length; i += 1) {
    for (let j = i + 1; j < endpoints.length; j += 1) {
      const a = endpoints[i];
      const b = endpoints[j];
      if (a.lineId === b.lineId || a.kind !== b.kind) continue;
      const aM = toM(a.point);
      const bM = toM(b.point);
      const delta: [number, number] = [bM[0] - aM[0], bM[1] - aM[1]];
      const distanceM = Math.hypot(delta[0], delta[1]);
      if (distanceM < 0.01 || distanceM > maxGapM) continue;
      const towardB = unit(delta);
      const outwardA = unit(a.outwardM);
      const outwardB = unit(b.outwardM);
      if (!towardB || !outwardA || !outwardB) continue;
      const aAlignment = outwardA[0] * towardB[0] + outwardA[1] * towardB[1];
      const bAlignment = outwardB[0] * -towardB[0] + outwardB[1] * -towardB[1];
      if (aAlignment < minimumAlignment || bAlignment < minimumAlignment) continue;
      candidates.push({ a, b, distanceM });
    }
  }

  candidates.sort((left, right) =>
    left.distanceM - right.distanceM ||
    left.a.key.localeCompare(right.a.key) ||
    left.b.key.localeCompare(right.b.key),
  );
  const used = new Set<string>();
  const bridges: RenderWaterRoute[] = [];
  for (const candidate of candidates) {
    if (used.has(candidate.a.key) || used.has(candidate.b.key)) continue;
    used.add(candidate.a.key);
    used.add(candidate.b.key);
    bridges.push({
      id: `visual-bridge:${candidate.a.key}:${candidate.b.key}`,
      kind: candidate.a.kind,
      points: [candidate.a.point, candidate.b.point],
      visualBridge: true,
    });
  }
  return [...routes, ...bridges];
}

/**
 * A SWALE IS A DITCH AND A BERM, NOT A LINE.
 *
 * Rory, looking at the rendered Earthworks sheet: "its just a path naow thin and scraggly but
 * swale is made up of the ditch and berm". A single stroke — however thick or brown — draws the
 * ROUTE the water takes, not the earthwork the farmer has to dig, so the sheet could not be used
 * to set the work out on the ground.
 *
 * This offsets the saved centreline to both sides so the renderer can paint the two halves
 * separately: the cut on one side, the spoil bank on the other. The saved geometry is never
 * touched — this returns new points and the centreline stays exactly what the farmer drew.
 *
 * Side convention: the berm sits to the RIGHT of the direction the line was drawn. Slope
 * direction is not saved per-line, so the sheet cannot know which side is truly downhill; the
 * phasing text already tells the farmer the rule that matters ("spread the spoil onto the
 * downhill berm"). A consistent schematic side keeps the drawing legible without asserting a
 * fact about their slope that the app has not measured.
 */
export function offsetPolyline(points: Array<[number, number]>, offset: number): Array<[number, number]> {
  if (points.length < 2 || !Number.isFinite(offset)) return points.map(([x, y]) => [x, y]);
  return points.map(([x, y], index) => {
    // Direction at this vertex: the segment ahead for the first point, behind for the last, and
    // the average of both elsewhere so corners bisect instead of kinking.
    const prev = points[index - 1];
    const next = points[index + 1];
    const dirs: Array<[number, number]> = [];
    if (prev) dirs.push([x - prev[0], y - prev[1]]);
    if (next) dirs.push([next[0] - x, next[1] - y]);
    let dx = 0;
    let dy = 0;
    for (const [ux, uy] of dirs) {
      const len = Math.hypot(ux, uy);
      if (len > 1e-9) {
        dx += ux / len;
        dy += uy / len;
      }
    }
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return [x, y] as [number, number];
    // Left normal of the unit direction; a negative offset therefore lands on the right.
    return [x - (dy / len) * offset, y + (dx / len) * offset] as [number, number];
  });
}
