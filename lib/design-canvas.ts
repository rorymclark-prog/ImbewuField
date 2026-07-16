// Design Studio — shared canvas types, storage, and scale-accurate map math.
//
// Coordinates in every shape here are NORMALISED [0..1] within the CanvasFrame (x right,
// y down), so they survive resizes and always line up with the satellite underlay. The
// map-math functions below are adapted from components/GeometryDesignStudio.tsx (same
// Web-Mercator projection the Mapbox Static Images API uses) so the Design Studio's
// satellite fit can never drift from the rest of the app.

import type { Geometry, Position } from 'geojson';
import type { DesignLayer } from '@/lib/design-studio';

// ── Shared types (verbatim contract) ──────────────────────────────────────────

export interface CanvasFrame {
  centerLng: number;
  centerLat: number;
  zoom: number;
  imgW: number;
  imgH: number; // logical px of the satellite image (e.g. 960x640)
  mPerPx: number; // metres per logical pixel at this zoom+lat
  satDataUrl: string | null; // inlined satellite image
}

export interface PlacedItem {
  id: string;
  defId: string; // references DesignElementDef.id
  x: number;
  y: number; // normalised [0..1] centre position in the frame
  wM?: number;
  hM?: number; // optional per-item size override in metres
  rot?: number; // clockwise rotation in degrees (0 = footprint's natural orientation). Only
  // meaningful for rect-shaped elements (strips/beds/rows) — circles are rotation-invariant.
  label?: string;
  note?: string;
}

// Real ground/built features the farmer traces on their own site (house outline, paving,
// lawn, existing veg garden, orchard, cleared ground) — WHAT IS THERE, as opposed to the
// permaculture effort-zones. Rides on ZoneShape via the optional `feature` tag so it reuses
// the whole zone draw/edit/persist/adopt engine rather than a parallel shape system.
export type GroundFeatureKind = 'house' | 'patio' | 'lawn' | 'veg_garden' | 'orchard' | 'cleared';

export interface ZoneShape {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  points: Array<[number, number]>; // normalised ring
  // When set, this ring is a real ground/built feature (filled, labelled) rather than a
  // permaculture effort-zone ring; `zone` then rides along as an inert value. Optional so
  // it is JSON-safe and survives migrateStateToFrame's spread untouched.
  feature?: GroundFeatureKind;
  // Optional normalised offset of the name label from the ring centroid — lets the farmer drag a
  // label off a feature it overlaps (e.g. a lawn wrapping the house). Undefined = at centroid.
  labelDx?: number;
  labelDy?: number;
}

export interface LineShape {
  id: string;
  kind: 'swale' | 'fence' | 'path' | 'pipe' | 'drip' | 'windbreak';
  points: Array<[number, number]>;
}

export type WizardStep = 'base' | 'water' | 'zones' | 'planting' | 'structures' | 'review' | 'glossy';

export interface DesignCanvasState {
  siteId: string;
  frame: Omit<CanvasFrame, 'satDataUrl'>;
  items: PlacedItem[];
  zones: ZoneShape[];
  lines: LineShape[];
  step: WizardStep;
  updatedAt: string;
}

// ── Web-Mercator helpers (adapted from components/GeometryDesignStudio.tsx) ──────
// Same maths as the Mapbox Static Images API tile grid — do NOT swap in the
// hardcoded 156543/2^z formula, tile size assumptions differ.

const TILE = 512;

export function lngLatToWorld(lng: number, lat: number, zoom: number): [number, number] {
  const worldSize = TILE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * worldSize;
  const sinLat = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldSize;
  return [x, y];
}

export function getBounds(layers: DesignLayer[]) {
  const coords = layers.flatMap((layer) => collectPositions(layer.geometry));
  if (coords.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  const xs = coords.map((c) => c[0]).filter(Number.isFinite);
  const ys = coords.map((c) => c[1]).filter(Number.isFinite);
  if (!xs.length || !ys.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function collectPositions(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    case 'GeometryCollection':
      return geometry.geometries.flatMap(collectPositions);
    default:
      return [];
  }
}

// Fractional zoom so the bbox fits inside (imgW x imgH) logical px, with breathing room.
export function fitZoom(
  bounds: ReturnType<typeof getBounds>,
  imgW: number,
  imgH: number,
  padFrac = 0.76,
): { zoom: number; centerLng: number; centerLat: number } {
  const centerLng = (bounds.minX + bounds.maxX) / 2;
  const centerLat = (bounds.minY + bounds.maxY) / 2;
  const [x1, y1] = lngLatToWorld(bounds.minX, bounds.maxY, 0); // top-left
  const [x2, y2] = lngLatToWorld(bounds.maxX, bounds.minY, 0); // bottom-right
  const spanX = Math.max(Math.abs(x2 - x1), 1e-9);
  const spanY = Math.max(Math.abs(y2 - y1), 1e-9);
  const zoomX = Math.log2((imgW * padFrac) / spanX);
  const zoomY = Math.log2((imgH * padFrac) / spanY);
  let zoom = Math.min(zoomX, zoomY);
  zoom = Math.max(1, Math.min(zoom, 19.5)); // clamp into a sane satellite range
  return { zoom, centerLng, centerLat };
}

// Static Images API URL (center+zoom, satellite, no labels), logical px (<=1280), @2x.
export function buildSatelliteUrl(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  token: string,
): string {
  const w = Math.min(Math.round(imgW), 1280);
  const h = Math.min(Math.round(imgH), 1280);
  return (
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
    `${centerLng.toFixed(6)},${centerLat.toFixed(6)},${zoom.toFixed(4)},0,0/` +
    `${w}x${h}@2x?access_token=${encodeURIComponent(token)}&attribution=false&logo=false`
  );
}

// Projector that lines up exactly with the static tile (center-relative Mercator).
export function makeMercatorProjector(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
  originX: number,
  originY: number,
) {
  const [cx, cy] = lngLatToWorld(centerLng, centerLat, zoom);
  return (coord: Position): readonly [number, number] => {
    const [wx, wy] = lngLatToWorld(coord[0], coord[1], zoom);
    const x = originX + imgW / 2 + (wx - cx);
    const y = originY + imgH / 2 + (wy - cy);
    return [
      Number.isFinite(x) ? x : originX + imgW / 2,
      Number.isFinite(y) ? y : originY + imgH / 2,
    ];
  };
}

// Inverse of makeMercatorProjector/lngLatToWorld: normalised [0..1] canvas coords → [lng,lat].
// Must stay the exact algebraic inverse of lngLatToWorld — verify any edit round-trips.
export function makeMercatorUnprojector(
  centerLng: number,
  centerLat: number,
  zoom: number,
  imgW: number,
  imgH: number,
) {
  const worldSize = TILE * Math.pow(2, zoom);
  const [cx, cy] = lngLatToWorld(centerLng, centerLat, zoom);
  return (norm: [number, number]): [number, number] => {
    const x = norm[0] * imgW;
    const y = norm[1] * imgH;
    const wx = cx + (x - imgW / 2);
    const wy = cy + (y - imgH / 2);
    const lng = (wx / worldSize) * 360 - 180;
    const n = Math.PI - 2 * Math.PI * (wy / worldSize);
    const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return [lng, lat];
  };
}

// Re-normalises saved geometry into a freshly-recomputed frame. If the new frame is
// (within tolerance) the same as the one the state was saved with, returns state
// unchanged — this is the common case and must stay a cheap no-op.
export function migrateStateToFrame(
  state: DesignCanvasState,
  newFrame: Omit<CanvasFrame, 'satDataUrl'>,
  project: (lngLat: [number, number]) => [number, number],
): DesignCanvasState {
  const f = state.frame;
  const sameFrame =
    Math.abs(f.centerLng - newFrame.centerLng) < 1e-7 &&
    Math.abs(f.centerLat - newFrame.centerLat) < 1e-7 &&
    Math.abs(f.zoom - newFrame.zoom) < 1e-6 &&
    f.imgW === newFrame.imgW &&
    f.imgH === newFrame.imgH;
  if (sameFrame) return state;

  const unprojectOld = makeMercatorUnprojector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH);
  const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
  const remap = (pt: [number, number]): [number, number] => {
    const lngLat = unprojectOld(pt);
    const [x, y] = project(lngLat);
    return [clamp01(x), clamp01(y)];
  };

  const items = state.items.map((item) => {
    const [x, y] = remap([item.x, item.y]);
    return { ...item, x, y };
  });
  const zones = state.zones.map((z) => ({ ...z, points: z.points.map(remap) }));
  const lines = state.lines.map((l) => ({ ...l, points: l.points.map(remap) }));

  return { ...state, frame: newFrame, items, zones, lines };
}

export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mapbox static ${res.status}`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('Could not read satellite image.'));
    fr.readAsDataURL(blob);
  });
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

const DEFAULT_IMG_W = 960;
const DEFAULT_IMG_H = 640;
const METRES_PER_DEGREE_LAT = 111.32;

// Builds the CanvasFrame (minus the inlined image) + the satellite URL to fetch + a
// project() helper that maps [lng,lat] → normalised [0..1] canvas coordinates.
//
// mPerPx is computed EMPIRICALLY from the same Mercator projector used for the satellite
// fit: project [centerLng, centerLat] and [centerLng, centerLat + 0.001]; the latitude
// delta 0.001° = 111.32 m; mPerPx = 111.32 / |pyA - pyB|. Do NOT use a hardcoded
// 156543/2^z formula — tile size assumptions differ.
export function computeCanvasFrame(
  layers: DesignLayer[],
  lat: number,
  lon?: number,
  opts?: { imgW?: number; imgH?: number },
): {
  frame: Omit<CanvasFrame, 'satDataUrl'>;
  url: string;
  project: (lngLat: Position) => [number, number];
} {
  const imgW = opts?.imgW ?? DEFAULT_IMG_W;
  const imgH = opts?.imgH ?? DEFAULT_IMG_H;

  const rawBounds = getBounds(layers);
  const hasRealBounds =
    layers.length > 0 &&
    Number.isFinite(rawBounds.minX) &&
    rawBounds.maxX - rawBounds.minX > 0 &&
    rawBounds.maxY - rawBounds.minY > 0;

  // Fallback: a 120 m box around the site's centre — the REAL lat/lon, so an un-traced
  // saved place still gets its own satellite (lng 0 here once meant "Atlantic Ocean").
  const bounds = hasRealBounds
    ? rawBounds
    : (() => {
        const centerLat = Number.isFinite(lat) ? lat : 0;
        const centerLng = Number.isFinite(lon as number) ? (lon as number) : 0;
        // 120 m box → 60 m half-span. NB: METRES_PER_DEGREE_LAT (111.32) is metres per
        // 0.001° (milli-degree) — one full degree of latitude is 111,320 m. Using it as
        // per-degree here once produced a ±30 km box (a whole-suburb satellite view).
        const halfDegLat = 60 / (METRES_PER_DEGREE_LAT * 1000);
        const cosLat = Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01);
        const halfDegLng = halfDegLat / cosLat;
        return {
          minX: centerLng - halfDegLng,
          maxX: centerLng + halfDegLng,
          minY: centerLat - halfDegLat,
          maxY: centerLat + halfDegLat,
        };
      })();

  const fit = fitZoom(bounds, imgW, imgH);
  const url = MAPBOX_TOKEN
    ? buildSatelliteUrl(fit.centerLng, fit.centerLat, fit.zoom, imgW, imgH, MAPBOX_TOKEN)
    : '';

  const projector = makeMercatorProjector(fit.centerLng, fit.centerLat, fit.zoom, imgW, imgH, 0, 0);

  // Empirical metres-per-logical-pixel: project the centre and a point 0.001° north of it.
  const [, pyA] = projector([fit.centerLng, fit.centerLat]);
  const [, pyB] = projector([fit.centerLng, fit.centerLat + 0.001]);
  const pxDelta = Math.abs(pyA - pyB) || 1e-9;
  const mPerPx = METRES_PER_DEGREE_LAT / pxDelta;

  const project = (lngLat: Position): [number, number] => {
    const [px, py] = projector(lngLat);
    return [px / imgW, py / imgH];
  };

  const frame: Omit<CanvasFrame, 'satDataUrl'> = {
    centerLng: fit.centerLng,
    centerLat: fit.centerLat,
    zoom: fit.zoom,
    imgW,
    imgH,
    mPerPx,
  };

  return { frame, url, project };
}

// ── Storage (mirrors lib/site-elements.ts conventions) ────────────────────────

export const DESIGN_CANVAS_CHANGED_EVENT = 'imbewu-design-canvas-changed';

const keyFor = (siteId: string) => `imbewu_design_canvas_${siteId}`;

export function loadCanvasState(siteId: string): DesignCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as DesignCanvasState) : null;
  } catch {
    return null;
  }
}

// Returns the restamped state (fresh updatedAt) so a caller that also syncs to the cloud
// pushes the SAME timestamp that was persisted locally — pushing the pre-stamp object would
// send a stale updatedAt and lose a genuine edit to last-write-wins on a two-device race.
export function saveCanvasState(state: DesignCanvasState): DesignCanvasState {
  const stamped: DesignCanvasState = { ...state, updatedAt: new Date().toISOString() };
  if (typeof window === 'undefined') return stamped;
  try {
    localStorage.setItem(keyFor(state.siteId), JSON.stringify(stamped));
  } catch {
    return stamped;
  }
  window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
  return stamped;
}

// Applies a state that a cloud merge (lib/design-canvas-sync.ts) already decided is newest —
// written verbatim, WITHOUT restamping updatedAt (restamping would make a same-tick re-reconcile
// think this device just edited it, when it only received someone else's edit). Still dispatches
// the change event so the page's normal refresh() path picks it up like any external change.
export function applyRemoteCanvasState(state: DesignCanvasState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(state.siteId), JSON.stringify(state));
  } catch {
    return;
  }
  window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
}

// ── Geometry helpers ───────────────────────────────────────────────────────────

// Ray-casting point-in-polygon test. `ring` is a normalised [0..1] polygon ring.
export function pointInRing(pt: [number, number], ring: Array<[number, number]>): boolean {
  const [px, py] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

// Distance in metres between two normalised [0..1] points within the same frame.
// Respects imgW/imgH aspect — dx uses imgW, dy uses imgH (both scaled by mPerPx).
export function distM(
  a: [number, number],
  b: [number, number],
  frame: Pick<CanvasFrame, 'imgW' | 'imgH' | 'mPerPx'>,
): number {
  const dx = (a[0] - b[0]) * frame.imgW * frame.mPerPx;
  const dy = (a[1] - b[1]) * frame.imgH * frame.mPerPx;
  return Math.sqrt(dx * dx + dy * dy);
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `dc_${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Auto-detect (Tier 1) ──────────────────────────────────────────────────────
// AI-suggested features from the satellite image. Suggestions are GHOSTS until the
// farmer accepts them (they then become normal items/zones/lines via onChange).
export type SuggestionKind =
  | 'tree' | 'building' | 'water_tank' | 'pond' | 'veg_area' | 'driveway' // vision (base step)
  | 'zone' | 'greywater' | 'compost' | 'beehive' | 'veg_bed' | 'nursery' | 'swale'; // local per-step generators

export interface DetectSuggestion {
  id: string;
  kind: SuggestionKind;
  points: Array<[number, number]>; // normalised [0..1]; length 1 = point (use sizeM), 2+ = line, 3+ ring for areas
  sizeM?: number; // canopy/footprint diameter estimate for point features
  zone?: 0 | 1 | 2 | 3 | 4 | 5; // set when kind === 'zone'
  note?: string;
  status: 'pending' | 'accepted' | 'rejected';
}
