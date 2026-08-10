// Design-on-map overlay (One-Surface plan, Phase 3).
//
// The per-site LOADER for the read-only "My design" map layer: reads the saved Design Studio
// canvas for a site (same loadCanvasState path /design uses, account-scoped keys included) and
// hands the geometry conversion to the PURE converter in lib/design-map-layer.ts
// (designStateToGeoJSON — normalised canvas coords → real-world [lng,lat] GeoJSON). This file
// owns only the impure edge (localStorage read) and the map-facing split below.
//
// The split: Point features (placed elements) are rendered by the map as react-map-gl
// <Marker>s — so their emoji icons render reliably; a Mapbox symbol layer can't show arbitrary
// emoji glyphs — while polygons and lines go through a GeoJSON source. DesignOverlay carries
// each half in the shape its renderer wants.

import { loadCanvasState } from '@/lib/design-canvas';
import { designStateToGeoJSON } from '@/lib/design-map-layer';

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

// Builds a read-only overlay for a site's saved design, or null when there's nothing to
// show (no saved design, a design with no valid zones/lines/items, or a design whose frame
// isn't geo-registered — drawn over a custom photo or blank paper, whose geometry is anchored
// to the photo's pixels rather than the earth; see lib/design-map-layer.ts). Callers use the
// null to disable/hide the "My design" toggle.
export function buildDesignOverlay(siteId: string): DesignOverlay | null {
  const state = loadCanvasState(siteId);
  if (!state) return null;

  const converted = designStateToGeoJSON(state, state.frame);

  const features: GeoJSON.Feature[] = [];
  const items: DesignOverlayItem[] = [];
  for (const feature of converted.features) {
    if (feature.geometry.type === 'Point' && feature.properties?.kind === 'item') {
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      items.push({
        id: String(feature.properties.id ?? ''),
        lng,
        lat,
        icon: String(feature.properties.icon ?? ''),
        label: String(feature.properties.name ?? ''),
        color: String(feature.properties.color ?? ''),
      });
    } else {
      features.push(feature);
    }
  }

  if (features.length === 0 && items.length === 0) return null;

  return {
    collection: { type: 'FeatureCollection', features },
    items,
  };
}
