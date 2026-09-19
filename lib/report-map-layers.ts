// The map's boundary, house and driveway, for the report's site plan.
//
// A farmer usually traces the property boundary and the house roof on the MAIN map, not in the
// Design Studio, so the saved design canvas on its own shows beds and trees floating in nothing.
// app/design/page.tsx already solves this for the Studio: it picks the boundary, house and
// driveway out of the traced map layers and projects them into the canvas frame. This is the same
// choice, made once more for the report, as a pure function so it can be tested without a browser.
//
// The ONE deliberate difference: the Studio fits a NEW frame to the layers and migrates the saved
// canvas into it; the report holds only the saved canvas, so it projects into the frame the canvas
// was SAVED with (projectorForFrame — the same projector computeCanvasFrame hands out). Rings and
// placed items therefore share one frame and cannot drift apart on the drawing.

import type { Position } from 'geojson';
import type { DesignLayer } from './design-studio';
import { projectorForFrame, type DesignCanvasState } from './design-canvas';
import type { MapRefLayers } from './base-layers';

/** ~2 km. The main map stores every site's shapes in one pool — see app/design/page.tsx. */
const NEAR_DEG = 0.02;

function ringOf(geometry: DesignLayer['geometry'] | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates[0] ?? [];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0]?.[0] ?? [];
  return [];
}

function lineOf(geometry: DesignLayer['geometry'] | undefined): Position[] {
  if (!geometry) return [];
  if (geometry.type === 'LineString') return geometry.coordinates ?? [];
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0] ?? [];
  return ringOf(geometry);
}

export const EMPTY_MAP_REF_LAYERS: MapRefLayers = Object.freeze({ boundary: [], house: [], driveway: [], drivewayClosed: false }) as MapRefLayers;

/** Boundary, house and driveway from the traced map layers, normalised into the canvas's own frame. */
export function mapRefLayersForCanvas(layers: DesignLayer[] | null | undefined, canvas: Pick<DesignCanvasState, 'frame'> | null | undefined, lat: number, lon: number): MapRefLayers {
  const frame = canvas?.frame;
  if (!layers?.length || !frame || !Number.isFinite(lat) || !Number.isFinite(lon)) return EMPTY_MAP_REF_LAYERS;
  if (![frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH].every(Number.isFinite) || !(frame.imgW > 0) || !(frame.imgH > 0)) return EMPTY_MAP_REF_LAYERS;
  const near = layers.filter((layer) => {
    const first = ringOf(layer.geometry)[0] ?? lineOf(layer.geometry)[0];
    return !!first && Math.abs(first[1] - lat) < NEAR_DEG && Math.abs(first[0] - lon) < NEAR_DEG;
  });
  const pick = (test: (layer: DesignLayer) => boolean) => near.find(layer => test(layer) && layer.approved) ?? near.find(test);
  const boundary = pick(layer => layer.layerType === 'property_boundary')
    ?? [...near].filter(layer => layer.layerType !== 'water_body' && ringOf(layer.geometry).length >= 3).sort((a, b) => b.areaM2 - a.areaM2)[0];
  const house = pick(layer => (layer.layerType === 'roof' || layer.layerType === 'structure') && layer !== boundary);
  const drive = pick(layer => layer.layerType === 'access' && layer !== boundary);
  const project = projectorForFrame(frame);
  const projected = (positions: Position[]) => positions.map(position => project(position)).filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  const drivewayClosed = drive?.geometry?.type === 'Polygon' || drive?.geometry?.type === 'MultiPolygon';
  return {
    boundary: projected(ringOf(boundary?.geometry)),
    house: projected(ringOf(house?.geometry)),
    driveway: drive ? projected(drivewayClosed ? ringOf(drive.geometry) : lineOf(drive.geometry)) : [],
    drivewayClosed,
  };
}
