import type { CanvasFrame } from '@/lib/design-canvas';
import { makeMercatorUnprojector, pointInRing, projectorForFrame } from '@/lib/design-canvas';
import { contourIntervalForFrame } from '@/lib/contours';

export interface SheetContourLine {
  points: Array<[number, number]>;
  elevM: number;
  major: boolean;
}

export interface SheetContourResult {
  lines: SheetContourLine[];
  intervalM: number;
  tooFlat: boolean;
  status: 'ok' | 'too-flat' | 'unavailable';
  source: 'mapbox-terrain-rgb' | null;
}

type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

export type SheetContourFetcher = (url: string) => Promise<FetchResponse>;

const resultWithoutLines = (
  status: 'too-flat' | 'unavailable',
  intervalM: number,
  source: SheetContourResult['source'],
): SheetContourResult => ({
  lines: [],
  intervalM,
  tooFlat: status === 'too-flat',
  status,
  source,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function segmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  if (
    Math.max(a[0], b[0]) < Math.min(c[0], d[0])
    || Math.max(c[0], d[0]) < Math.min(a[0], b[0])
    || Math.max(a[1], b[1]) < Math.min(c[1], d[1])
    || Math.max(c[1], d[1]) < Math.min(a[1], b[1])
  ) {
    return false;
  }
  const cross = (p: [number, number], q: [number, number], r: [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return (
    ((abC <= 0 && abD >= 0) || (abC >= 0 && abD <= 0))
    && ((cdA <= 0 && cdB >= 0) || (cdA >= 0 && cdB <= 0))
  );
}

function polylineTouchesRing(
  points: Array<[number, number]>,
  ring: Array<[number, number]>,
): boolean {
  if (points.some((point) => pointInRing(point, ring))) return true;
  for (let pointIndex = 1; pointIndex < points.length; pointIndex++) {
    const a = points[pointIndex - 1];
    const b = points[pointIndex];
    for (let ringIndex = 0; ringIndex < ring.length; ringIndex++) {
      const c = ring[ringIndex];
      const d = ring[(ringIndex + 1) % ring.length];
      if (segmentsIntersect(a, b, c, d)) return true;
    }
  }
  return false;
}

/**
 * Fetch real Terrain-RGB contours for a plan sheet and project the returned lon/lat paths into the
 * exact CanvasFrame the sheet draws. The old five-point plane still chooses a readable interval;
 * it never supplies a line endpoint here.
 */
export async function fetchSheetContours(
  frame: CanvasFrame,
  boundary: Array<[number, number]>,
  slopeDeg: number,
  aspectDeg: number,
  fetcher: SheetContourFetcher = fetch,
): Promise<SheetContourResult> {
  const interval = contourIntervalForFrame(
    slopeDeg,
    aspectDeg,
    boundary,
    frame.mPerPx,
    frame.imgW,
    frame.imgH,
  );
  if (interval.status !== 'ok') {
    return resultWithoutLines(interval.status, interval.intervalM, null);
  }

  const unproject = makeMercatorUnprojector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
  );
  const lngLatBoundary = boundary.map(unproject);
  const longitudes = lngLatBoundary.map(([longitude]) => longitude);
  const latitudes = lngLatBoundary.map(([, latitude]) => latitude);
  const minLon = Math.min(...longitudes);
  const maxLon = Math.max(...longitudes);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  if (
    ![minLon, minLat, maxLon, maxLat].every(Number.isFinite)
    || minLon >= maxLon
    || minLat >= maxLat
  ) {
    return resultWithoutLines('unavailable', interval.intervalM, null);
  }

  const params = new URLSearchParams({
    minLon: minLon.toFixed(7),
    minLat: minLat.toFixed(7),
    maxLon: maxLon.toFixed(7),
    maxLat: maxLat.toFixed(7),
    interval: String(interval.intervalM),
    major: '25',
  });

  let payload: unknown;
  try {
    const response = await fetcher(`/api/contours?${params.toString()}`);
    if (!response.ok) return resultWithoutLines('unavailable', interval.intervalM, null);
    payload = await response.json();
  } catch {
    return resultWithoutLines('unavailable', interval.intervalM, null);
  }

  if (!isRecord(payload) || payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) {
    return resultWithoutLines('unavailable', interval.intervalM, null);
  }
  const metadata = isRecord(payload.contour) ? payload.contour : null;
  if (
    !metadata
    || metadata.source !== 'mapbox-terrain-rgb'
    || (metadata.status !== 'ok' && metadata.status !== 'too-flat')
    || !Number.isFinite(metadata.intervalM)
    || Number(metadata.intervalM) !== interval.intervalM
  ) {
    return resultWithoutLines('unavailable', interval.intervalM, null);
  }
  if (metadata.status === 'too-flat') {
    return resultWithoutLines('too-flat', interval.intervalM, 'mapbox-terrain-rgb');
  }

  const project = projectorForFrame(frame);
  const boundaryXs = boundary.map(([x]) => x);
  const boundaryYs = boundary.map(([, y]) => y);
  const boundaryBox = {
    minX: Math.min(...boundaryXs),
    maxX: Math.max(...boundaryXs),
    minY: Math.min(...boundaryYs),
    maxY: Math.max(...boundaryYs),
  };
  const lines: SheetContourLine[] = [];
  for (const feature of payload.features) {
    if (!isRecord(feature) || !isRecord(feature.geometry) || feature.geometry.type !== 'LineString') continue;
    if (!Array.isArray(feature.geometry.coordinates) || !isRecord(feature.properties)) continue;
    const elevM = Number(feature.properties.ele);
    const index = Number(feature.properties.index);
    if (!Number.isFinite(elevM) || (index !== 0 && index !== 1)) continue;
    const points: Array<[number, number]> = [];
    for (const coordinate of feature.geometry.coordinates) {
      if (
        !Array.isArray(coordinate)
        || coordinate.length < 2
        || !Number.isFinite(coordinate[0])
        || !Number.isFinite(coordinate[1])
      ) {
        continue;
      }
      const point = project([Number(coordinate[0]), Number(coordinate[1])]);
      if (point.every(Number.isFinite)) points.push(point);
    }
    if (points.length < 2) continue;
    const xs = points.map(([x]) => x);
    const ys = points.map(([, y]) => y);
    if (
      Math.max(...xs) < boundaryBox.minX
      || Math.min(...xs) > boundaryBox.maxX
      || Math.max(...ys) < boundaryBox.minY
      || Math.min(...ys) > boundaryBox.maxY
    ) {
      continue;
    }
    if (!polylineTouchesRing(points, boundary)) continue;
    lines.push({ points, elevM, major: index === 1 });
  }
  lines.sort((a, b) =>
    a.elevM - b.elevM
    || a.points[0][1] - b.points[0][1]
    || a.points[0][0] - b.points[0][0]);
  if (lines.length === 0) {
    return resultWithoutLines('too-flat', interval.intervalM, 'mapbox-terrain-rgb');
  }
  return {
    lines,
    intervalM: interval.intervalM,
    tooFlat: false,
    status: 'ok',
    source: 'mapbox-terrain-rgb',
  };
}
