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
import polygonClipping from 'polygon-clipping';

export type GroundFeatureKind =
  | 'house' | 'patio' | 'driveway' | 'lawn' | 'veg_garden' | 'orchard' | 'cleared' | 'boundary'
  | 'terrace_bank'; // the retained/graded riser face between two levels — see docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2

export interface ZoneShape {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  points: Array<[number, number]>; // normalised ring
  // When set, this ring is a real ground/built feature (filled, labelled) rather than a
  // permaculture effort-zone ring; `zone` then rides along as an inert value. Optional so
  // it is JSON-safe and survives migrateStateToFrame's spread untouched.
  feature?: GroundFeatureKind;
  // Optional custom name shown on the label (tap the label to rename); falls back to the ground
  // feature's default label when unset.
  name?: string;
  // Optional normalised offset of the name label from the ring centroid — lets the farmer drag a
  // label off a feature it overlaps (e.g. a lawn wrapping the house). Undefined = at centroid.
  labelDx?: number;
  labelDy?: number;
  // Farmer-entered signed level in metres, relative to a site datum the farmer picks
  // (house-floor-level = 0.0 is the obvious default, but it's whatever the farmer typed against).
  // Only meaningful when `feature` is set; independent of WHICH kind — a lawn, a veg garden, an
  // orchard platform, or a terrace_bank riser can each carry one. Optional so it stays JSON-safe
  // and survives migrateStateToFrame's spread untouched, same reasoning as `feature` itself.
  levelM?: number;
  // An optional farmer-PACED slope measurement (%) for this specific ring, used ONLY when
  // feature === 'terrace_bank'. When present, effectiveSlopeForRing (lib/terracing.ts) prefers
  // this over the whole-site SRTM average, because it is the farmer's own on-site measurement of
  // the exact spot, not a ~1 km-baseline approximation. Absent by default — most farmers won't
  // pace a slope, and the whole-site fallback must degrade honestly, not silently assume a
  // farmer input exists. See docs/TERRACES-EARTHWORKS-SPEC-2026-07-21.md §2/§3.
  measuredSlopePct?: number;
}

export interface LineShape {
  id: string;
  // 'greywater' is the subsurface run from the house diverter to the basins it feeds. It was
  // missing for a long time while the water PROMPT described it in detail — so the sheet asked
  // for a violet greywater line that a farmer had no tool to draw, and the only way the model
  // could satisfy that was to invent one. Purple/violet follows the reclaimed-water pipe
  // convention, and is deliberately more saturated than the fence lilac.
  kind: 'swale' | 'fence' | 'path' | 'pipe' | 'drip' | 'windbreak' | 'greywater';
  points: Array<[number, number]>;
  // Optional custom name shown on the on-canvas label pill (tap the label to rename); falls back
  // to the kind's default name (LINE_KIND_LABEL, components/design/DesignCanvas.tsx) when unset.
  // Mirrors ZoneShape.name above — same pattern, same reason (no on-canvas label existed for any
  // line kind at all, including swales, until this field).
  name?: string;
  // Optional normalised offset of the name label from its anchor point (the line's midpoint) —
  // mirrors ZoneShape.labelDx/labelDy so a farmer can drag a line's label clear of the line itself.
  // Undefined = pinned at the midpoint.
  labelDx?: number;
  labelDy?: number;
}

export type WizardStep = 'base' | 'sector' | 'water' | 'zones' | 'planting' | 'structures' | 'review' | 'glossy';

// A farmer's own uploaded (drone/aerial) photo of their site, used as the Studio's base image
// INSTEAD of the fetched satellite tile. Deliberately just a small Storage download URL + the
// calibrated scale — never the image bytes themselves — so it persists exactly like every other
// small field on DesignCanvasState (the whole object round-trips through localStorage AND
// Firestore as one JSON blob; see lib/design-canvas-sync.ts). The rotation the farmer dialled in
// is NOT stored here: it is baked into the image pixels once, before upload (see
// components/design/BasePhotoImport.tsx), because none of this app's renderers (satellite base,
// every Blueprint sheet, every AI composite) have any concept of a live rotation transform —
// teaching all of them would be a far bigger and riskier change than doing it once at upload time.
export interface CustomBaseImage {
  url: string; // Firebase Storage download URL (uploadPhoto in lib/db/queries.ts)
  mPerPx: number; // calibrated metres-per-pixel, from the farmer's two-point tap + entered distance
  uploadedAt: string; // ISO timestamp, for display only
}

export interface DesignCanvasState {
  siteId: string;
  frame: Omit<CanvasFrame, 'satDataUrl'>;
  items: PlacedItem[];
  zones: ZoneShape[];
  lines: LineShape[];
  step: WizardStep;
  updatedAt: string;
  // Optional back-compat pair: when useCustomBase is true and customBase is set, the Studio shows
  // the farmer's own uploaded photo (customBase.url, fetched into the ephemeral CanvasFrame at
  // render time exactly like the satellite tile is) and frame.mPerPx is overridden by
  // customBase.mPerPx instead of the GPS-derived value. Farmers who never upload a photo see
  // exactly today's behaviour — both fields stay undefined. Keeping the ORIGINAL satellite frame
  // computation running unchanged (rather than replacing it) is what lets a farmer switch back to
  // the real satellite view at any time without losing anything.
  useCustomBase?: boolean;
  customBase?: CustomBaseImage | null;
  // Monotonic edit counter for this site's design lineage. Bumped by saveCanvasState on every
  // real local save, and NEVER by applyRemoteCanvasState (receiving someone else's edit is not
  // editing). Cloud sync (lib/design-canvas-sync.ts) ranks by rev FIRST and only falls back to
  // updatedAt on a tie, because a wall-clock stamp only says "when this device last touched it"
  // — which a device that reloaded a STALE snapshot forges for free just by being late. rev says
  // "how many edits this lineage has seen", which a stale snapshot cannot fake: it re-enters the
  // race at the low rev it was saved with.
  // OPTIONAL for back-compat: states written before this field existed read as rev 0 (see revOf).
  rev?: number;
}

/**
 * Cloud sync owns design content, but the open tab owns where its user is currently working.
 * A remote winner may therefore replace every authored field while retaining local navigation.
 */
export function preserveCanvasNavigation(
  incoming: DesignCanvasState,
  current: DesignCanvasState | null | undefined,
): DesignCanvasState {
  if (!current || current.siteId !== incoming.siteId || current.step === incoming.step) return incoming;
  return { ...incoming, step: current.step };
}

/** Reads a state's rev defensively: missing (pre-rev states) or corrupt (hand-edited/truncated
 *  localStorage blob) both read as 0 rather than throwing or poisoning comparisons with NaN.
 *  Single source of truth for the "missing rev = 0" rule — sync imports this too. */
export function revOf(state: Pick<DesignCanvasState, 'rev'> | null | undefined): number {
  return typeof state?.rev === 'number' && Number.isFinite(state.rev) ? state.rev : 0;
}

/** How much design a state actually holds. Single source of truth for the "is there anything to
 *  lose here?" question, which BOTH the cloud winner rule (lib/design-canvas-sync.ts) and the
 *  auto-persist guard (app/design/page.tsx) hang off — they must never disagree about what counts
 *  as empty, or one will happily push a state the other would have refused. */
export function contentCountOf(
  state: Pick<DesignCanvasState, 'items' | 'zones' | 'lines'> | null | undefined,
): number {
  return state ? state.items.length + state.zones.length + state.lines.length : 0;
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

// Rebuilds the [lng,lat] → normalised [0..1] projector for an ALREADY-COMPUTED frame, using the
// same maths computeCanvasFrame uses for its own project() (they share this function, so the two
// can never drift). Exists for callers that hold a frame but not the layers it was fitted from —
// e.g. the Design Studio re-normalising a cloud copy into the frame it is currently rendering.
export function projectorForFrame(
  frame: Omit<CanvasFrame, 'satDataUrl'>,
): (lngLat: Position) => [number, number] {
  const projector = makeMercatorProjector(
    frame.centerLng,
    frame.centerLat,
    frame.zoom,
    frame.imgW,
    frame.imgH,
    0,
    0,
  );
  return (lngLat: Position): [number, number] => {
    const [px, py] = projector(lngLat);
    return [px / frame.imgW, py / frame.imgH];
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

// Exported so a custom-photo base (components/design/BasePhotoImport.tsx) can bake/calibrate at
// the exact same logical canvas size every satellite-fitted frame already uses — the two base
// image sources must never disagree about the CanvasFrame's imgW/imgH.
export const DEFAULT_IMG_W = 960;
export const DEFAULT_IMG_H = 640;
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

  const frame: Omit<CanvasFrame, 'satDataUrl'> = {
    centerLng: fit.centerLng,
    centerLat: fit.centerLat,
    zoom: fit.zoom,
    imgW,
    imgH,
    mPerPx,
  };

  // Same projector every other frame-holder gets (projectorForFrame) — deliberately not a second
  // local copy of the divide-by-imgW/imgH step, so a fix to one is a fix to both.
  const project = projectorForFrame(frame);

  return { frame, url, project };
}

// ── Storage (mirrors lib/site-elements.ts conventions) ────────────────────────

export const DESIGN_CANVAS_CHANGED_EVENT = 'imbewu-design-canvas-changed';

const keyFor = (siteId: string) => `imbewu_design_canvas_${siteId}`;

// Legacy designs (and some cross-device round-trips) persisted a zone's `zone` as a STRING
// ("1") rather than the number 1. Object-key access (ZONE_DEFS[z.zone]) and the number badge
// both tolerate that, so painted zones still RENDER — but strict checks (new Set([1]).has(z.zone))
// silently fail, which is what made a fully-painted Zones step still read "0/4" on the
// step-by-step guide. Coerce to a clamped integer on load so every consumer sees a real number.
/** Shoelace area magnitude of a normalised ring. Used only to order ground features by size. */
export function ringAreaOf(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a / 2);
}

/** GROUND FEATURES NEST. A farmer traces the property boundary, then the lawn inside it, then the
 *  house inside that, then the patio inside that — and drawn naively they simply stack, so the
 *  lawn's hatch runs straight over the roof and the boundary's over everything (Rory: "polygons
 *  must be nested in eachother"). A ring's TRUE extent is itself MINUS every smaller ground ring
 *  inside it, which is the same donut rule zoneFillPolys already applies to effort-zones.
 *
 *  Strictly smaller only, by area: two rings of equal size cannot each cut the other, and a
 *  same-size overlap is a tracing mistake the farmer should see rather than have silently hidden.
 *  Returns MultiPolygon rings — [outer, ...holes] — which canvas' nonzero fill renders as holes
 *  when each is its own subpath, and SVG renders the same way with fillRule="evenodd". */
/** Closest point ON a ring's outline to a given point, in normalised coords.
 *
 *  A label's leader used to run to the ring CENTROID, which is meaningless for a large enclosing
 *  area: the centroid of a property boundary is the middle of the plot, which is where the house
 *  is — so dragging the boundary label away left its leader pointing confidently at the house
 *  (Rory: "even if i move the property boundry the leader stay on the house"). The edge is what a
 *  boundary actually IS, and for small shapes the nearest edge point is a few pixels from the
 *  centroid anyway, so this is right for both. */
export function nearestPointOnRing(
  ring: Array<[number, number]>,
  to: [number, number],
): [number, number] {
  let best: [number, number] = ring[0] ?? to;
  let bestD = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    // t clamped to [0,1] keeps the foot of the perpendicular ON the segment, not on its extension.
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((to[0] - ax) * dx + (to[1] - ay) * dy) / len2));
    const px = ax + dx * t, py = ay + dy * t;
    const d = (px - to[0]) ** 2 + (py - to[1]) ** 2;
    if (d < bestD) { bestD = d; best = [px, py]; }
  }
  return best;
}

export function groundFillPolys(
  zones: ZoneShape[],
  z: ZoneShape,
): Array<Array<Array<[number, number]>>> {
  const subject: Array<Array<Array<[number, number]>>> = [[z.points]];
  if (!z.feature || z.points.length < 3) return subject;
  const mine = ringAreaOf(z.points);
  const cutters: Array<Array<Array<[number, number]>>> = [];
  for (const other of zones) {
    if (other.id === z.id || !other.feature || other.points.length < 3) continue;
    if (ringAreaOf(other.points) < mine) cutters.push([other.points]);
  }
  if (!cutters.length) return subject;
  try {
    const out = polygonClipping.difference(subject as never, ...(cutters as never[]));
    return (out as unknown as Array<Array<Array<[number, number]>>>) ?? subject;
  } catch {
    return subject; // degenerate ring — better an overlapping fill than a crash
  }
}

export function normalizeZoneNumbers(state: DesignCanvasState): DesignCanvasState {
  if (!Array.isArray(state.zones)) return state;
  let changed = false;
  const zones = state.zones.map((z) => {
    const raw = Number(z.zone);
    const n = (Number.isFinite(raw) ? Math.max(0, Math.min(5, Math.round(raw))) : 0) as ZoneShape['zone'];
    if (n === z.zone) return z;
    changed = true;
    return { ...z, zone: n };
  });
  return changed ? { ...state, zones } : state;
}

export function loadCanvasState(siteId: string): DesignCanvasState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? normalizeZoneNumbers(parsed as DesignCanvasState) : null;
  } catch {
    return null;
  }
}

// Returns the restamped state (fresh updatedAt) so a caller that also syncs to the cloud
// pushes the SAME timestamp that was persisted locally — pushing the pre-stamp object would
// send a stale updatedAt and lose a genuine edit to last-write-wins on a two-device race.
/** Thrown when the design genuinely could not be persisted. Callers MUST surface this — silently
 *  returning "saved" is what let a farmer's zones disappear while the header said "Saved". */
export class CanvasSaveError extends Error {}

/** The glossy render cache keeps multi-MB dataURLs under `imbewu_design_glossy_*` and can exhaust
 *  the localStorage quota. The DESIGN outranks cached pictures every time — evict them to make
 *  room. Returns how many were dropped. */
export function evictGlossyCache(): number {
  let n = 0;
  if (typeof window === 'undefined') return 0;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('imbewu_design_glossy_')) {
        localStorage.removeItem(k);
        n += 1;
      }
    }
  } catch {
    /* best effort */
  }
  return n;
}

export function saveCanvasState(state: DesignCanvasState): DesignCanvasState {
  // rev is bumped from the state the CALLER is holding — deliberately NOT from whatever is
  // currently in localStorage. Taking the max of the two would let a caller working off a stale
  // in-memory snapshot inherit a high rev and then out-rank the good cloud copy, which is the
  // very bug this counter exists to stop. A stale caller must produce a LOW rev and lose.
  const stamped: DesignCanvasState = {
    ...state,
    updatedAt: new Date().toISOString(),
    rev: revOf(state) + 1,
  };
  if (typeof window === 'undefined') return stamped;
  const write = () => localStorage.setItem(keyFor(state.siteId), JSON.stringify(stamped));
  try {
    write();
  } catch {
    // Out of quota (almost always the render cache). Drop the pictures and try once more —
    // never let a cached render cost the farmer their design.
    evictGlossyCache();
    try {
      write();
    } catch {
      throw new CanvasSaveError('Could not save your design — this device’s storage is full.');
    }
  }
  window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
  return stamped;
}

// Writes `state` to localStorage EXACTLY as handed in — no updatedAt restamp, no rev bump — and
// dispatches the change event either way. Shared by the two callers that must move a state around
// WITHOUT claiming it as a new local edit; the difference between them is intent, not mechanics,
// so they share the mechanics and document the intent separately.
function writeCanvasStateVerbatim(state: DesignCanvasState): void {
  if (typeof window === 'undefined') return;
  const write = () => localStorage.setItem(keyFor(state.siteId), JSON.stringify(state));
  try {
    write();
  } catch {
    evictGlossyCache(); // same rule: cached pictures never outrank a real design
    try {
      write();
    } catch {
      /* Couldn't cache it locally — still dispatch below so the OPEN PAGE picks up the cloud
         copy. Swallowing the event here meant a good remote state could never rescue a
         quota-starved device (it just kept showing the stale, zone-less snapshot). */
    }
  }
  window.dispatchEvent(new CustomEvent(DESIGN_CANVAS_CHANGED_EVENT));
}

// Applies a state that a cloud merge (lib/design-canvas-sync.ts) already decided is newest —
// written verbatim, WITHOUT restamping updatedAt and WITHOUT bumping rev (this device is
// RECEIVING an edit, not making one; restamping/bumping would make a same-tick re-reconcile think
// this device just edited it, and would inflate rev on every hop between devices until the
// counter meant nothing). Still dispatches the change event so the page's normal refresh() path
// picks it up like any external change.
export function applyRemoteCanvasState(state: DesignCanvasState): void {
  writeCanvasStateVerbatim(normalizeZoneNumbers(state));
}

/** Persists a NAVIGATION-ONLY change — today that means `step`, where the farmer is in the wizard
 *  — WITHOUT restamping updatedAt and WITHOUT bumping rev.
 *
 *  WHY this exists instead of just calling saveCanvasState: updatedAt and rev are the two fields
 *  cloud sync ranks copies by. Moving between wizard steps changes no design content, so counting
 *  it as an edit hands a device holding a STALE snapshot a free promotion to "newest" — it can
 *  out-rank and erase a good cloud copy without the farmer ever touching their design. Looking at
 *  a page is not editing it, and must not move the counters. */
export function saveCanvasNavigation(state: DesignCanvasState): void {
  writeCanvasStateVerbatim(state);
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
