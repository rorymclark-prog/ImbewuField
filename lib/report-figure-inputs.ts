// What the report's drawn figures read that the typed site facts do not carry: the saved drawing
// itself, the boundary / house / driveway traced on the main map, and the build order worked out
// from both. Browser-only (localStorage), so ReportView calls it from an effect.

import { loadCanvasState } from './design-canvas';
import { loadDesignStudioState, mergeFarmShapesIntoDesignState } from './design-studio';
import { readLocalFarmShapes } from './map-sync';
import { resolveBaseLayers } from './base-layers';
import { buildPhasePlan } from './phasing';
import { EMPTY_MAP_REF_LAYERS, mapRefLayersForCanvas } from './report-map-layers';
import type { ReportFigureInputs } from './report-figures';

export function collectReportFigureInputs(input: { siteId: string; lat: number; lon: number; biome?: string; rainfallMm?: number }): ReportFigureInputs {
  try {
    const canvas = loadCanvasState(input.siteId);
    if (!canvas) return {};
    let mapLayers = EMPTY_MAP_REF_LAYERS;
    try {
      const merged = mergeFarmShapesIntoDesignState(readLocalFarmShapes(), loadDesignStudioState(input.siteId), input.siteId);
      mapLayers = mapRefLayersForCanvas(merged.layers, canvas, input.lat, input.lon);
    } catch { /* the drawing still stands without the traced map shapes */ }
    let phasePlan = null;
    try {
      phasePlan = buildPhasePlan(canvas, resolveBaseLayers(canvas, mapLayers), { biome: input.biome, rainfallMm: input.rainfallMm });
    } catch { /* no build order: the timeline figure is simply left out */ }
    return { canvas, mapLayers, phasePlan };
  } catch {
    return {};
  }
}
