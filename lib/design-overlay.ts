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

import { loadCanvasState, makeMercatorUnprojector, type LineShape } from '@/lib/design-canvas';
import { ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_COLORS, ZONE_DEFS } from '@/lib/design-elements';

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
  switch (kind) {
    case 'swale':
      return { stroke: '#4EA6D8', width: 3, dashed: true };
    case 'fence':
      return { stroke: '#3A352C', width: 2, dashed: false };
    case 'path':
      return { stroke: '#E8D9B8', width: 2.5, dashed: true };
    case 'pipe':
      return { stroke: '#8C8577', width: 2, dashed: false };
    case 'drip':
      return { stroke: '#4EA6D8', width: 1.6, dashed: true };
    case 'windbreak':
      return { stroke: '#2F7A4A', width: 6, dashed: false };
    default:
      return { stroke: '#8C8577', width: 2, dashed: false };
  }
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

  const hasContent =
    (state.zones?.length ?? 0) > 0 ||
    (state.lines?.length ?? 0) > 0 ||
    (state.items?.length ?? 0) > 0;
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
  for (const z of state.zones ?? []) {
    if (!z.points || z.points.length < 3) continue;
    const ring = z.points.map((p) => unproject(p));
    // GeoJSON polygon rings must be explicitly closed.
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);

    let fill: string;
    let label: string;
    if (z.feature && GROUND_FEATURES[z.feature]) {
      fill = GROUND_FEATURES[z.feature].color;
      label = GROUND_FEATURES[z.feature].label;
    } else {
      fill = ZONE_COLORS[z.zone] ?? ZONE_COLORS[2];
      label = ZONE_DEFS[z.zone]?.label ?? `Zone ${z.zone}`;
    }

    features.push({
      type: 'Feature',
      properties: {
        kind: z.feature ? 'ground' : 'zone',
        fill,
        stroke: darken(fill),
        label,
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    });
  }

  // Lines → linestrings (swales, fences, paths, pipes, drip, windbreaks).
  for (const l of state.lines ?? []) {
    if (!l.points || l.points.length < 2) continue;
    const coords = l.points.map((p) => unproject(p));
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
  for (const it of state.items ?? []) {
    const def = ELEMENTS_BY_ID[it.defId];
    if (!def) continue;
    const [lng, lat] = unproject([it.x, it.y]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    items.push({
      id: it.id,
      lng,
      lat,
      icon: def.icon,
      label: it.label || def.name,
      color: def.color,
    });
  }

  if (features.length === 0 && items.length === 0) return null;

  return {
    collection: { type: 'FeatureCollection', features },
    items,
  };
}
