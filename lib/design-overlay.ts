// Design-on-map overlay (Fable one-surface plan, Phase 3).
//
// Converts a saved Design Studio canvas (lib/design-canvas.ts, all coords normalised
// [0..1] within a georeferenced CanvasFrame) into REAL-WORLD [lng,lat] geometry the live
// Mapbox map can draw as a read-only overlay. This is the bridge that turns the farmer's
// map into a report dashboard: the design becomes visible without opening the Studio.
//
// The frame carries centerLng/centerLat/zoom/imgW/imgH — exactly what
// makeMercatorUnprojector needs to invert a normalised canvas point back to [lng,lat]
// (the same Web-Mercator maths the Static Images API + Mapbox GL tile grid use), so the
// overlay lines up pixel-for-pixel with where it was drawn in the Studio.

import { loadCanvasState, makeMercatorUnprojector, ringAreaOf, type LineShape } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_COLORS, ZONE_DEFS } from '@/lib/design-elements';
import { waterRouteStyleFor } from '@/lib/water-cartography';

export interface DesignOverlayItem {
  id: string;
  lng: number;
  lat: number;
  icon: string;
  label: string;
  color: string;
}

export interface DesignOverlay {
  collection: GeoJSON.FeatureCollection;
  items: DesignOverlayItem[];
}

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

// Builds a read-only overlay for a site's saved design, or null when there's nothing to
// show (no saved design, or a design with no zones/lines/items). Callers use the null to
// disable/hide the "Design" toggle.
export function buildDesignOverlay(siteId: string): DesignOverlay | null {
  const state = loadCanvasState(siteId);
  if (!state) return null;
  const zones = Array.isArray(state.zones) ? state.zones : [];
  const lines = Array.isArray(state.lines) ? state.lines : [];
  const placedItems = Array.isArray(state.items) ? state.items : [];

  const hasContent =
    zones.length > 0 ||
    lines.length > 0 ||
    placedItems.length > 0;
  if (!hasContent) return null;

  const f = state.frame;
  // Guard EVERY field the unprojector consumes — a corrupt/old persisted frame with a
  // non-finite or zero imgW/imgH would otherwise yield NaN coords in a Polygon/LineString
  // and poison the Mapbox GeoJSON source.
  if (
    !f ||
    !Number.isFinite(f.centerLng) ||
    !Number.isFinite(f.centerLat) ||
    !Number.isFinite(f.zoom) ||
    !Number.isFinite(f.imgW) ||
    !Number.isFinite(f.imgH) ||
    f.centerLng < -180 ||
    f.centerLng > 180 ||
    f.centerLat < -90 ||
    f.centerLat > 90 ||
    f.zoom < 0 ||
    f.zoom > 30 ||
    f.imgW <= 0 ||
    f.imgH <= 0
  ) {
    return null;
  }
  const unproject = makeMercatorUnprojector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH);

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

    let fill: string;
    let label: string;
    const groundFeature = z.feature ? GROUND_FEATURES[z.feature] : undefined;
    if (groundFeature) {
      fill = groundFeature.color;
      label = groundFeature.label;
    } else {
      fill = ZONE_COLORS[z.zone] ?? ZONE_COLORS[2];
      label = ZONE_DEFS[z.zone]?.label ?? `Zone ${z.zone}`;
    }

    features.push({
      type: 'Feature',
      properties: {
        kind: groundFeature ? 'ground' : 'zone',
        fill,
        stroke: darken(fill),
        label,
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }

  // Lines → linestrings (swales, fences, paths, pipes, drip, windbreaks).
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
        stroke: style.stroke,
        width: style.width,
        dashed: style.dashed,
      },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }

  // Placed elements → point markers (rendered as react-map-gl <Marker>s by the map, so the
  // emoji icons render reliably — a Mapbox symbol layer can't show arbitrary emoji glyphs).
  const items: DesignOverlayItem[] = [];
  const itemIds = new Set<string>();
  for (const it of placedItems) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def || !it.id || itemIds.has(it.id) || !validNormPoint([it.x, it.y])) continue;
    const [lng, lat] = unproject([it.x, it.y]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    itemIds.add(it.id);
    items.push({
      id: it.id,
      lng,
      lat,
      icon: def.icon,
      label: it.label?.trim() || def.name,
      color: def.color,
    });
  }

  if (features.length === 0 && items.length === 0) return null;

  return {
    collection: { type: 'FeatureCollection', features },
    items,
  };
}
