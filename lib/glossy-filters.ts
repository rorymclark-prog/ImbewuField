// Design Studio — per-layer glossy filter helpers, extracted VERBATIM out of
// components/design/DesignGlossy.tsx so the pure layer-membership logic is unit-testable
// without pulling in the whole (5,000+ line) React component. Comments preserved as-is.

// Per-layer glossy: 'all' = the whole design; the others render just one theme (with the
// base map + ground context always kept so the picture is legible). Only the drawn marks in
// the chosen layer are locked; everything else is repainted as background.
export type GlossyLayerFilter = 'all' | 'water' | 'zones' | 'planting' | 'structures';

// NOTE: 'earthworks' is deliberately NOT its own glossy/print layer — it folds into 'water'.
// A GlossyLayerFilter is not just a UI filter: FILTER_TO_LAYER below maps it to the API's
// RenderLayer union ('overall'|'base'|'sector'|'zone'|'water'|'opportunity'|'planting'|
// 'implementation'), which has no earthworks theme, and an unmapped filter falls through to the
// full-design theme — the exact bug that made the AI invent ponds and orchards on a layer map.
// Folding into 'water' is also the honest reading: earthworks IS the water layer's land-shaping
// (basins, berms and banana circles are how water is slowed, spread and sunk), and the water
// theme's blue-green "water plan" wash suits them. 'structures' already folds to 'overall' the
// same way. Adding a real earthworks layer means an API-side RenderLayer + layerTheme prompt
// block first — see docs/DESIGN-TAXONOMY.md.
export function itemInFilter(category: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return category === 'water' || category === 'earthworks';
    case 'planting':
      return category === 'growing';
    case 'structures':
      return category === 'structure' || category === 'animal' || category === 'access';
    case 'zones':
      return false;
  }
}

export function lineInFilter(kind: string, filter: GlossyLayerFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'water':
      return kind === 'swale' || kind === 'pipe' || kind === 'drip';
    case 'planting':
      return kind === 'windbreak'; // a windbreak is a planted row → Planting sheet, not Structures
    case 'structures':
      return kind === 'fence' || kind === 'path';
    default:
      return false;
  }
}

export function zonesInFilter(filter: GlossyLayerFilter): boolean {
  return filter === 'all' || filter === 'zones';
}
