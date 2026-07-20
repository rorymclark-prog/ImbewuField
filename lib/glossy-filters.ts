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
// PER-ELEMENT OVERRIDES, because filing by CATEGORY is the wrong grain. 'earthworks' is a build
// category — how the ground is shaped — and it mixes two things a farmer reads on different sheets:
// water-shaping (swale berms, infiltration and greywater basins, contour berms) and PLANTING beds
// that merely happen to be earth-shaped. Filing the whole category under 'water' put a farmer's
// raised beds, keyhole bed, herb spiral, banana circles and tree basins on the WATER PLAN and left
// them off the PLANTING PLAN entirely — he placed a banana circle from the Planting step and then
// could not find it on the planting sheet.
//
// overlayElementsText already knew this and patched it downstream with a SECTION_BY_ID table, which
// changed the legend HEADING but not which sheet the element was drawn on — hence a sheet titled
// WATER PLAN carrying a legend section headed PLANTING. This is that same knowledge applied one
// level up, where it decides the sheet instead of the caption.
// These five are the whole of it: every OTHER earthworks element (greywater_basin,
// infiltration_basin, half_moon, berm, terrace) really is water-shaping and correctly stays on the
// Water sheet. Vetiver Bank needs no entry — it is already category 'growing'.
const SHEET_OVERRIDE: Record<string, GlossyLayerFilter> = {
  banana_circle: 'planting',
  tree_basin: 'planting',
  raised_bed: 'planting',
  keyhole_bed: 'planting',
  herb_spiral: 'planting',
};

/** Which single layer sheet an element belongs on. Exported so a test can assert the whole catalog
 *  lands on exactly one sheet — the guard this module's own header claimed to exist and did not. */
export function sheetForElement(category: string, defId?: string): Exclude<GlossyLayerFilter, 'all' | 'zones'> | null {
  if (defId && SHEET_OVERRIDE[defId]) return SHEET_OVERRIDE[defId] as Exclude<GlossyLayerFilter, 'all' | 'zones'>;
  switch (category) {
    case 'water':
    case 'earthworks':
      return 'water';
    case 'growing':
      return 'planting';
    case 'structure':
    case 'animal':
    case 'access':
      return 'structures';
    default:
      return null;
  }
}

/** Does this element belong on `filter` as CONTEXT — shown so the sheet reads, never counted as its
 *  content? Only Water needs it: irrigation lines mean nothing without the beds and basins they
 *  water, and those live on the Planting sheet. Kept here beside sheetForElement so the membership
 *  rules stay in one file. */
export function isContextElement(
  def: { category: string; id: string; name: string },
  filter: GlossyLayerFilter,
): boolean {
  if (filter !== 'water') return false;
  if (sheetForElement(def.category, def.id) !== 'planting') return false;
  return /bed|basin|circle|spiral/i.test(def.name);
}

export function itemInFilter(category: string, filter: GlossyLayerFilter, defId?: string): boolean {
  if (filter === 'all') return true;
  // Zones carries no elements — the effort-zone bands are its entire content.
  if (filter === 'zones') return false;
  return sheetForElement(category, defId) === filter;
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
