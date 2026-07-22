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
  'tree_indigenous',
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
 * Print-scale emphasis for the Planting sheet. Canopies and long beds need more visual weight
 * than their tiny true-footprint symbols at sheet size; centres and stored dimensions stay exact.
 */
export function plantingFeaturePresentationScale(id: string): number {
  if (id === 'veg_bed' || id === 'raised_bed') return 1.28;
  if (id === 'keyhole_bed' || id === 'herb_spiral') return 1.18;
  if (id === 'pollinator_strip' || id === 'spekboom_hedge' || id === 'vetiver_row') return 1.16;
  if (GREYWATER_READY_BASINS.has(id)) return 1.2;
  if (id === 'banana_clump') return 1.24;
  if (id.startsWith('tree_')) return 1.3;
  return 1;
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
