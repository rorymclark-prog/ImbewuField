import type { CanvasFrame, LineShape } from '@/lib/design-canvas';

export interface WaterRouteStyle {
  color: string;
  dash: number[];
  width: number;
}

export type WaterRouteKind = Extract<LineShape['kind'], 'swale' | 'pipe' | 'drip' | 'greywater'>;

export type RenderWaterRoute = Pick<LineShape, 'id' | 'kind' | 'points'> & {
  kind: WaterRouteKind;
  visualBridge?: true;
};

/** One drawing registry for every line kind assigned to the Water sheet. */
export const WATER_ROUTE_STYLE: Record<WaterRouteKind, WaterRouteStyle> = {
  swale: { color: '#4EA6D8', dash: [], width: 4.5 },
  pipe: { color: '#2379A8', dash: [14, 6], width: 5 },
  drip: { color: '#4E8B3B', dash: [3, 8], width: 3.5 },
  greywater: { color: '#9B56B5', dash: [10, 6], width: 4.2 },
};

export function waterRouteStyleFor(kind: LineShape['kind']): WaterRouteStyle | undefined {
  return WATER_ROUTE_STYLE[kind as WaterRouteKind];
}

const EMPHASIZED_WATER_HARDWARE = new Set([
  'tap_point', 'borehole', 'first_flush', 'pump_filter', 'greywater_diverter',
  'greywater_outlet', 'water_trough', 'water_trough2',
]);

/**
 * Small operational fittings are cartographic point symbols rather than literal footprints.
 * Their saved centre remains exact, but a modest print-scale enlargement keeps them legible on a
 * phone without letting them compete with ponds, basins or other measured landscape areas.
 */
export function waterFeaturePresentationScale(id: string): number {
  if (id.startsWith('jojo_') || id === 'rain_barrel') return 1.28;
  if (EMPHASIZED_WATER_HARDWARE.has(id)) return 1.2;
  return 1;
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
  maxGapM = 0.45,
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
  const minimumAlignment = Math.cos((55 * Math.PI) / 180);
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
