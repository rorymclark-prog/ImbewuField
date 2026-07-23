export const REFERENCE_FEATURE_ART_ROOT = '/render-assets/reference-blueprint';

export type ReferenceFeatureArtwork =
  | 'jojo-tank-v1.png'
  | 'banana-basin-v1.png'
  | 'orchard-canopy-v1.png'
  | 'production-bed-v1.png'
  | 'pollinator-strip-v1.png'
  | 'vetiver-bank-v1.png'
  | 'compost-bay-v1.png'
  | 'beehive-v1.png'
  | 'chicken-tractor-v1.png'
  | 'nursery-table-v1.png'
  | 'shade-house-v1.png'
  | 'driveway-gate-v1.png'
  | 'pond-small-v1.png'
  | 'greywater-basin-v1.png'
  | 'tree-basin-v1.png'
  | 'tap-point-v1.png'
  | 'pump-filter-v1.png'
  | 'greywater-diverter-v1.png'
  | 'banana-clump-v1.png'
  | 'pawpaw-tree-v1.png'
  | 'moringa-tree-v1.png'
  | 'keyhole-bed-v1.png'
  | 'herb-spiral-v1.png'
  | 'spekboom-hedge-v1.png';

const JOJO_TANKS = new Set(['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000']);
const ORCHARD_TREES = new Set([
  'tree_citrus',
  'tree_mango',
  'tree_avocado',
  'tree_macadamia',
  'tree_guava',
  'tree_litchi',
  'tree_natal_plum',
  'tree_wild_plum',
  'tree_waterberry',
  'tree_other',
  'tree_indigenous',
  'tree_apple',
  'tree_pear',
  'tree_plum',
  'tree_peach',
  'tree_fig',
  'tree_pomegranate',
  'tree_olive',
]);
const PRODUCTION_BEDS = new Set(['veg_bed', 'raised_bed']);
const VETIVER_BANKS = new Set(['vetiver_row', 'mulch_bank']);

const STRUCTURE_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  compost_bay: 'compost-bay-v1.png',
  beehive: 'beehive-v1.png',
  chicken_tractor: 'chicken-tractor-v1.png',
  nursery_table: 'nursery-table-v1.png',
  shade_house: 'shade-house-v1.png',
  gate: 'driveway-gate-v1.png',
};

const WATER_HARDWARE_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  pond_small: 'pond-small-v1.png',
  greywater_basin: 'greywater-basin-v1.png',
  tree_basin: 'tree-basin-v1.png',
  tap_point: 'tap-point-v1.png',
  pump_filter: 'pump-filter-v1.png',
  greywater_diverter: 'greywater-diverter-v1.png',
};

const PLANTING_DETAIL_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  banana_clump: 'banana-clump-v1.png',
  tree_pawpaw: 'pawpaw-tree-v1.png',
  tree_moringa: 'moringa-tree-v1.png',
  keyhole_bed: 'keyhole-bed-v1.png',
  herb_spiral: 'herb-spiral-v1.png',
  spekboom_hedge: 'spekboom-hedge-v1.png',
};

/**
 * Stable, reusable AI-painted artwork for exact app-owned feature footprints.
 *
 * The mapping is deliberately conservative. A generic basin never receives a tree canopy, and an
 * unknown/custom item stays on the deterministic fallback instead of being visually invented.
 */
export function referenceFeatureArtworkFor(defId: string): ReferenceFeatureArtwork | null {
  if (JOJO_TANKS.has(defId)) return 'jojo-tank-v1.png';
  if (defId === 'banana_circle') return 'banana-basin-v1.png';
  if (ORCHARD_TREES.has(defId)) return 'orchard-canopy-v1.png';
  if (PRODUCTION_BEDS.has(defId)) return 'production-bed-v1.png';
  if (defId === 'pollinator_strip') return 'pollinator-strip-v1.png';
  if (VETIVER_BANKS.has(defId)) return 'vetiver-bank-v1.png';
  if (STRUCTURE_ART[defId]) return STRUCTURE_ART[defId];
  if (WATER_HARDWARE_ART[defId]) return WATER_HARDWARE_ART[defId];
  if (PLANTING_DETAIL_ART[defId]) return PLANTING_DETAIL_ART[defId];
  return null;
}

export function referenceFeatureArtworkUrl(defId: string): string | null {
  const asset = referenceFeatureArtworkFor(defId);
  return asset ? `${REFERENCE_FEATURE_ART_ROOT}/${asset}` : null;
}
