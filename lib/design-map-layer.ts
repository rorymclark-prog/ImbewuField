// Design → live-map GeoJSON (One-Surface plan, Phase 3 — "design flows back to the map").
//
// PURE converter from a saved Design Studio canvas (lib/design-canvas.ts — every coordinate
// normalised [0..1] within a georeferenced CanvasFrame) to real-world [lng,lat] GeoJSON the
// live Mapbox map can draw as a READ-ONLY "My design" layer. Deterministic, no side effects:
// it never touches localStorage, never mutates its inputs, and the same (state, frame) pair
// always yields the same FeatureCollection. The impure per-site loader that Map.tsx consumes
// (lib/design-overlay.ts buildDesignOverlay) is a thin wrapper over this function.
//
// The frame carries centerLng/centerLat/zoom/imgW/imgH — exactly what makeMercatorUnprojector
// needs to invert a normalised canvas point back to [lng,lat] (the same Web-Mercator maths the
// Static Images API + the Mapbox GL tile grid use), so the overlay lines up with where the
// farmer drew in the Studio.
//
// GEO-REGISTRATION IS A PRECONDITION, NOT AN ASSUMPTION. A design drawn on a custom photo or
// on blank paper is anchored to the PHOTO'S PIXELS, not to the earth (see migrateStateToFrame
// in lib/design-canvas.ts: on those bases a frame recompute deliberately does NOT re-project
// the points, so the normalised coords stop corresponding to the frame's Mercator registration
// the first time the satellite frame moves). Unprojecting such a design would paint it
// confidently in the wrong place on the real map — worse than not painting it at all — so a
// non-satellite base, like a corrupt frame, yields an EMPTY collection.

import {
  designBaseMode,
  makeMercatorUnprojector,
  ringAreaOf,
  type CanvasFrame,
  type DesignCanvasState,
  type LineShape,
} from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_COLORS, ZONE_DEFS } from '@/lib/design-elements';
import { waterRouteStyleFor } from '@/lib/water-cartography';

/** The georeferencing part of a CanvasFrame — what the unprojector consumes. */
export type DesignMapFrame = Omit<CanvasFrame, 'satDataUrl' | 'underlayDataUrl'>;

/** The slice of DesignCanvasState this converter reads. Accepting the slice (rather than the
 *  whole state) keeps tests honest about what can influence the output. */
export type DesignMapState = Pick<
  DesignCanvasState,
  'items' | 'zones' | 'lines' | 'baseMode' | 'useCustomBase' | 'customBase'
>;

// Line styling mirrors components/design/DesignCanvas.tsx `lineStroke` so the on-map lines
// read the same as they do in the Studio (that helper isn't exported, so the conventions
// are duplicated here — keep in sync if the Studio palette changes).
function lineStyle(kind: LineShape['kind']): { stroke: string; width: number; dashed: boolean } {
  const waterStyle = waterRouteStyleFor(kind);
  switch (kind) {
    case 'swale':
      return { stroke: waterStyle!.color, width: 3, dashed: true };
    case 'fence':
      return { stroke: '#8E7CC3', width: 2, dashed: false };
    case 'path':
      return { stroke: '#E8D9B8', width: 2.5, dashed: true };
    case 'pipe':
      return { stroke: waterStyle!.color, width: 2, dashed: false };
    case 'drip':
      return { stroke: waterStyle!.color, width: 1.6, dashed: true };
    case 'greywater':
      return { stroke: waterStyle!.color, width: 2.1, dashed: true };
    case 'windbreak':
      return { stroke: '#2F7A4A', width: 6, dashed: false };
    default:
      return { stroke: '#8C8577', width: 2, dashed: false };
  }
}

function validNormPoint(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(value[0])
    && Number.isFinite(value[1])
    && value[0] >= 0
    && value[0] <= 1
    && value[1] >= 0
    && value[1] <= 1;
}

function validNormPath(
  value: unknown,
  minimumPoints: number,
): value is Array<[number, number]> {
  if (!Array.isArray(value) || value.length < minimumPoints || !value.every(validNormPoint)) {
    return false;
  }
  return new Set(value.map(([x, y]) => `${x},${y}`)).size >= minimumPoints;
}

function orientation(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [cx, cy]: [number, number],
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

function pointOnSegment(
  [px, py]: [number, number],
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
): boolean {
  return orientation([ax, ay], [bx, by], [px, py]) === 0
    && px >= Math.min(ax, bx)
    && px <= Math.max(ax, bx)
    && py >= Math.min(ay, by)
    && py <= Math.max(ay, by);
}

function segmentsIntersect(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
): boolean {
  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;
  return (o1 === 0 && pointOnSegment(c, a, b))
    || (o2 === 0 && pointOnSegment(d, a, b))
    || (o3 === 0 && pointOnSegment(a, c, d))
    || (o4 === 0 && pointOnSegment(b, c, d));
}

function validNormRing(value: unknown): value is Array<[number, number]> {
  if (!validNormPath(value, 3)) return false;
  const ring = value.length > 3
    && value[0][0] === value[value.length - 1][0]
    && value[0][1] === value[value.length - 1][1]
      ? value.slice(0, -1)
      : value;
  if (ring.length < 3 || ringAreaOf(ring) <= 0) return false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    for (let j = i + 1; j < ring.length; j++) {
      const adjacent = j === i
        || j === (i + 1) % ring.length
        || i === (j + 1) % ring.length;
      if (adjacent) continue;
      const c = ring[j];
      const d = ring[(j + 1) % ring.length];
      if (segmentsIntersect(a, b, c, d)) return false;
    }
  }
  return true;
}

// Slightly darkened outline colour for filled areas so the edge reads on a bright fill.
function darken(hex: string, amount = 0.35): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.round(((n >> 16) & 255) * (1 - amount));
  const g = Math.round(((n >> 8) & 255) * (1 - amount));
  const b = Math.round((n & 255) * (1 - amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/**
 * Whether this state's geometry can honestly be unprojected through this frame to [lng,lat].
 * Two conditions, both required:
 *  1. the ground being drawn over is the SATELLITE (see the header — photo/blank geometry is
 *     anchored to the photo's pixels, not to the earth), and
 *  2. every field the unprojector consumes is finite and in range — a corrupt/old persisted
 *     frame with a non-finite or zero imgW/imgH would otherwise yield NaN coordinates in a
 *     Polygon/LineString and poison the Mapbox GeoJSON source.
 */
export function frameIsGeoRegistered(
  state: Pick<DesignMapState, 'baseMode' | 'useCustomBase' | 'customBase'> | null | undefined,
  frame: DesignMapFrame | null | undefined,
): boolean {
  if (designBaseMode(state) !== 'satellite') return false;
  return !!frame
    && Number.isFinite(frame.centerLng)
    && Number.isFinite(frame.centerLat)
    && Number.isFinite(frame.zoom)
    && Number.isFinite(frame.imgW)
    && Number.isFinite(frame.imgH)
    && frame.centerLng >= -180
    && frame.centerLng <= 180
    && frame.centerLat >= -90
    && frame.centerLat <= 90
    && frame.zoom >= 0
    && frame.zoom <= 30
    && frame.imgW > 0
    && frame.imgH > 0;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = Object.freeze({
  type: 'FeatureCollection',
  features: [],
}) as GeoJSON.FeatureCollection;

/**
 * Convert a design state's geometry to real-world GeoJSON:
 *  - zones → Polygons — `kind` 'zone' (effort-zone ring, carries its `zone` 0..5 number) or
 *    'ground' (traced ground/built feature, carries its `feature` tag), plus `label`, `color`
 *    and the map-styling pair `fill`/`stroke`;
 *  - lines → LineStrings — `kind` 'line' with `lineKind`, `color`/`stroke`, `width`, `dashed`;
 *  - placed items → Points — `kind` 'item' with the item `id`, display `name`, the element's
 *    icon `category`, its emoji `icon` and accent `color`.
 *
 * Invalid or degenerate shapes (out-of-range coords, self-crossing or zero-area rings, unknown
 * element defs, duplicate item ids) are skipped rather than poisoning the collection; a state
 * with nothing valid, or a frame that isn't geo-registered, yields an EMPTY collection.
 */
export function designStateToGeoJSON(
  state: DesignMapState | null | undefined,
  frame: DesignMapFrame | null | undefined,
): GeoJSON.FeatureCollection {
  if (!state || !frame || !frameIsGeoRegistered(state, frame)) return EMPTY_COLLECTION;

  const zones = Array.isArray(state.zones) ? state.zones : [];
  const lines = Array.isArray(state.lines) ? state.lines : [];
  const placedItems = Array.isArray(state.items) ? state.items : [];
  if (zones.length === 0 && lines.length === 0 && placedItems.length === 0) {
    return EMPTY_COLLECTION;
  }

  const unproject = makeMercatorUnprojector(
    frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH,
  );

  const features: GeoJSON.Feature[] = [];

  // Zones + ground-feature areas → filled polygons. A `feature` tag makes the ring a real
  // ground/built feature (house/patio/lawn/…); otherwise it's a permaculture effort-zone,
  // coloured by its 0..5 zone number.
  for (const z of zones) {
    if (!validNormRing(z.points)) continue;
    const ring = z.points.map((p) => unproject(p));
    if (ring.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) continue;
    // GeoJSON polygon rings must be explicitly closed.
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);

    const groundFeature = z.feature ? GROUND_FEATURES[z.feature] : undefined;
    const color = groundFeature
      ? groundFeature.color
      : ZONE_COLORS[z.zone] ?? ZONE_COLORS[2];
    const label = groundFeature
      ? (z.name?.trim() || groundFeature.label)
      : ZONE_DEFS[z.zone]?.label ?? `Zone ${z.zone}`;

    features.push({
      type: 'Feature',
      properties: {
        kind: groundFeature ? 'ground' : 'zone',
        ...(groundFeature ? { feature: z.feature } : { zone: z.zone }),
        label,
        color,
        fill: color,
        stroke: darken(color),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }

  // Lines → linestrings (swales, fences, paths, pipes, drip, windbreaks, greywater…).
  for (const l of lines) {
    if (!validNormPath(l.points, 2)) continue;
    const coords = l.points.map((p) => unproject(p));
    if (coords.some(([lng, lat]) => !Number.isFinite(lng) || !Number.isFinite(lat))) continue;
    const style = lineStyle(l.kind);
    features.push({
      type: 'Feature',
      properties: {
        kind: 'line',
        lineKind: l.kind,
        ...(l.name?.trim() ? { label: l.name.trim() } : {}),
        color: style.stroke,
        stroke: style.stroke,
        width: style.width,
        dashed: style.dashed,
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  // Placed elements → Points. The map renders these as react-map-gl <Marker>s (so the emoji
  // icons render reliably — a Mapbox symbol layer can't show arbitrary emoji glyphs), but they
  // are part of the one collection so any GeoJSON consumer gets the whole design.
  const itemIds = new Set<string>();
  for (const it of placedItems) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !it.id || itemIds.has(it.id) || !validNormPoint([it.x, it.y])) continue;
    const [lng, lat] = unproject([it.x, it.y]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    itemIds.add(it.id);
    features.push({
      type: 'Feature',
      properties: {
        kind: 'item',
        id: it.id,
        name: it.label?.trim() || def.name,
        category: def.category,
        icon: def.icon,
        color: def.color,
      },
      geometry: { type: 'Point', coordinates: [lng, lat] },
    });
  }

  if (features.length === 0) return EMPTY_COLLECTION;
  return { type: 'FeatureCollection', features };
}
