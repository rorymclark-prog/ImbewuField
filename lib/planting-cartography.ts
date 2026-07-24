/**
 * Render-only cartography for the Planting Reference Blueprint.
 *
 * These helpers deliberately accept canonical catalog IDs, not display labels. They never alter
 * a placed item's centre, footprint, or saved geometry; presentation scale is applied by a caller
 * only while composing the finished sheet.
 */

export type PlantingLegendSection =
  | 'PRODUCTION PLANTING'
  | 'PERENNIAL GUILDS'
  | 'GREYWATER-READY BASINS'
  | 'OTHER PLANTING';

/** Reading order follows the supplied Planting benchmark's editorial legend. */
export const PLANTING_LEGEND_SECTION_ORDER: readonly PlantingLegendSection[] = [
  'PRODUCTION PLANTING',
  'PERENNIAL GUILDS',
  'GREYWATER-READY BASINS',
  'OTHER PLANTING',
];

const PRODUCTION_PLANTING = new Set([
  'veg_bed', 'raised_bed', 'keyhole_bed', 'herb_spiral',
  'pollinator_strip', 'mulch_bank', 'spekboom_hedge', 'vetiver_row',
]);
const GREYWATER_READY_BASINS = new Set(['banana_circle', 'tree_basin']);
const PERENNIAL_GUILDS = new Set([
  'banana_clump',
  'tree_citrus',
  'tree_mango',
  'tree_avocado',
  'tree_macadamia',
  'tree_guava',
  'tree_litchi',
  'tree_pawpaw',
  'tree_moringa',
  'tree_natal_plum',
  'tree_wild_plum',
  'tree_waterberry',
  'tree_indigenous',
  'tree_other',
  'tree_apple',
  'tree_pear',
  'tree_plum',
  'tree_peach',
  'tree_fig',
  'tree_pomegranate',
  'tree_olive',
]);

/** Returns null for an unknown ID so a renamed/custom feature cannot be invented in the legend. */
export function plantingLegendSectionForFeature(id: string): PlantingLegendSection | null {
  if (PRODUCTION_PLANTING.has(id)) return 'PRODUCTION PLANTING';
  if (PERENNIAL_GUILDS.has(id)) return 'PERENNIAL GUILDS';
  if (GREYWATER_READY_BASINS.has(id)) return 'GREYWATER-READY BASINS';
  if (id === 'other_planting') return 'OTHER PLANTING';
  return null;
}

/**
 * Print-scale emphasis for point-like planting symbols. Mapped beds, hedges and strips retain
 * their true dimensions so a correctly sized canvas feature cannot grow in the finished sheet.
 */
export function plantingFeaturePresentationScale(id: string): number {
  if (
    id === 'veg_bed'
    || id === 'raised_bed'
    || id === 'keyhole_bed'
    || id === 'herb_spiral'
    || id === 'pollinator_strip'
    || id === 'spekboom_hedge'
    || id === 'vetiver_row'
  ) return 1;
  if (GREYWATER_READY_BASINS.has(id)) return 1.28;
  if (id === 'banana_clump') return 1.3;
  if (id.startsWith('tree_')) return 1.36;
  return 1;
}


export interface PlantingPresentationDimensions {
  width: number;
  height: number;
  scale: number;
}

/**
 * Bounded print emphasis for planting symbols. This preserves the saved centre, rotation and
 * aspect ratio while preventing small beds, tree basins and young-tree canopies from disappearing
 * in the exported sheet or a phone-sized reduction. Large mapped beds are capped so emphasis never
 * turns a true footprint into a different geometry.
 */
export function plantingFeaturePresentationDimensions(
  id: string,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
): PlantingPresentationDimensions {
  const baseScale = plantingFeaturePresentationScale(id);
  if (baseScale === 1) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  const shortSide = Math.max(0.01, Math.min(naturalWidth, naturalHeight));
  const longSide = Math.max(naturalWidth, naturalHeight);
  const minimumShortSide = Math.max(22, canvasWidth * 0.013);
  // Long beds and hedges need room to read at phone size. This is a presentation cap, not a
  // geometry edit: the saved centre, rotation and aspect ratio remain untouched by the caller.
  const maximumLongSide = Math.max(minimumShortSide, canvasWidth * 0.16);
  const requestedScale = Math.max(baseScale, minimumShortSide / shortSide);
  const cappedScale = Math.min(requestedScale, maximumLongSide / Math.max(0.01, longSide));
  const scale = Math.max(1, cappedScale);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
    scale,
  };
}

export interface PlantingRouteStyle {
  color: string;
  dash: number[];
  width: number;
  label: string;
}

/** Styling metadata for the optional planted windbreak line; no route is created by this module. */
export const PLANTING_ROUTE_STYLE: Readonly<{ windbreak: PlantingRouteStyle }> = {
  windbreak: {
    color: '#3A7A30',
    dash: [],
    width: 5.2,
    label: 'Windbreak hedge',
  },
};

export function plantingRouteStyleFor(kind: string): PlantingRouteStyle | undefined {
  return kind === 'windbreak' ? PLANTING_ROUTE_STYLE.windbreak : undefined;
}
