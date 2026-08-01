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

export interface PlantingCanopyPaintStyle {
  /** A quiet backing that separates a placed canopy from busy photographic tree texture. */
  baseAlpha: number;
  baseColor: string;
  artworkAlpha: number;
  washAlpha: number;
  detailAlphaMin: number;
  detailAlphaMax: number;
  edgeColor: string;
  edgeAlpha: number;
  edgeWidthScale: number;
}

/**
 * Mature canopy paint is deliberately translucent, with a stronger footprint edge. The farmer's
 * saved overlap is evidence about future spacing: the later-painted tree must not erase the
 * neighbouring canopy, beds, paths or water lines beneath it.
 */
export const PLANTING_CANOPY_PAINT: Readonly<PlantingCanopyPaintStyle> = {
  // A PLANTED TREE IS A DECISION, NOT A TINT. Rory has now asked four separate times for the
  // trees on sheet 06 to be visible, most recently: "i cant see any of the trees ... no plants are
  // clearly visible. do something to make them more visible, they are also translucent?!"
  //
  // The old values (6% backing, 48% artwork) were chosen so two overlapping canopies would each
  // stay readable through the other. That is a real drawing problem, but solving it with ALPHA is
  // the exact mistake this repo has already made and undone twice — on the sector arrows ("you
  // can't see the arrows") and on the map labels. Both landed on the same answer, the one every
  // route on every road map uses: an opaque body with a LIGHT CASING around it. Alpha loses to a
  // busy aerial photograph every time, and this photo is full of existing dark-green trees, which
  // is the worst possible ground for a 48%-alpha green disc.
  //
  // So: a near-opaque cream backing carries the canopy clear of whatever is underneath, the
  // artwork sits on that at near-full strength, and overlap is now resolved by the cream casing
  // ring drawn between neighbours (see drawPaintedReferenceFeature) rather than by transparency.
  baseAlpha: 0.92,
  baseColor: '#F4EFDF',
  artworkAlpha: 0.96,
  washAlpha: 0.4,
  detailAlphaMin: 0.11,
  detailAlphaMax: 0.15,
  edgeColor: '#24482D',
  edgeAlpha: 0.98,
  edgeWidthScale: 1.05,
};

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
  if (
    !Number.isFinite(naturalWidth)
    || naturalWidth <= 0
    || !Number.isFinite(naturalHeight)
    || naturalHeight <= 0
  ) {
    return { width: 0, height: 0, scale: 1 };
  }
  const baseScale = plantingFeaturePresentationScale(id);
  if (baseScale === 1 || !Number.isFinite(canvasWidth) || canvasWidth <= 0) {
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
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(scale)) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  return {
    width,
    height,
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
export const PLANTING_ROUTE_STYLE: Readonly<{ windbreak: PlantingRouteStyle; bedpath: PlantingRouteStyle }> = {
  windbreak: {
    color: '#3A7A30',
    dash: [],
    width: 5.2,
    label: 'Windbreak hedge',
  },
  // The walking path between the beds of a bed block — planting-sheet geometry because the beds
  // are (see lineInFilter). Tan with a tight dash, matching the canvas's bedpath stroke family.
  bedpath: {
    color: '#C9A227',
    dash: [7, 5],
    width: 2.4,
    label: 'Bed path',
  },
};

export function plantingRouteStyleFor(kind: string): PlantingRouteStyle | undefined {
  return kind === 'windbreak' || kind === 'bedpath' ? PLANTING_ROUTE_STYLE[kind] : undefined;
}
