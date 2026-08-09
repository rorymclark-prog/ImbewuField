import { normaliseLookupKey } from '@/lib/key-normalisation';

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
  | 'avocado-tree-v1.png'
  | 'mango-tree-v1.png'
  | 'litchi-tree-v1.png'
  | 'macadamia-tree-v1.png'
  | 'citrus-tree-v1.png'
  | 'keyhole-bed-v1.png'
  | 'herb-spiral-v1.png'
  | 'spekboom-hedge-v1.png'
  | 'marula-tree-v1.png'
  | 'kei-apple-tree-v1.png'
  // Six crowns drawn to break up the generic canopy — see the ORCHARD_TREES note below.
  | 'indigenous-shade-v1.png'
  | 'wild-plum-v1.png'
  | 'guava-v1.png'
  | 'olive-v1.png'
  | 'waterberry-v1.png'
  | 'natal-plum-v1.png';

const JOJO_TANKS = new Set(['jojo_1000', 'jojo_2500', 'jojo_5000', 'jojo_10000']);
// THIRTEEN SPECIES USED TO SHARE ONE DRAWING, and that — not hue — is why a Planting sheet read
// as "all the trees look like variants of themselves". On a real sheet, "Wild plum" and two
// "Indigenous Shade Tree" labels were the same image drawn three times.
//
// Six of the thirteen now have their own crown (see PLANTING_DETAIL_ART). What is left here is
// the genuinely deciduous, pruned-goblet group — apple, pear, plum, peach, fig, pomegranate and
// the deliberately-unspecified 'Other Tree' — which orchard-canopy-v1 was redrawn to serve, and
// which really do share a habit at plan scale.
const ORCHARD_TREES = new Set([
  'tree_other',
  'tree_apple',
  'tree_pear',
  'tree_plum',
  'tree_peach',
  'tree_fig',
  'tree_pomegranate',
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
  tree_avocado: 'avocado-tree-v1.png',
  tree_mango: 'mango-tree-v1.png',
  tree_litchi: 'litchi-tree-v1.png',
  tree_macadamia: 'macadamia-tree-v1.png',
  tree_citrus: 'citrus-tree-v1.png',
  keyhole_bed: 'keyhole-bed-v1.png',
  herb_spiral: 'herb-spiral-v1.png',
  spekboom_hedge: 'spekboom-hedge-v1.png',
  // Marula and kei apple are the two indigenous fruit species with dedicated canopy art, so
  // they belong HERE and not in ORCHARD_TREES above. Order of checks matters: ORCHARD_TREES is
  // tested first in referenceFeatureArtworkFor, so an id listed in both would silently keep the
  // generic canopy and this entry would never fire.
  tree_marula: 'marula-tree-v1.png',
  tree_kei_apple: 'kei-apple-tree-v1.png',
  // The six lifted out of ORCHARD_TREES. Same ordering rule as marula and kei apple above:
  // ORCHARD_TREES is checked FIRST, so an id left in that set would never reach this table.
  tree_indigenous: 'indigenous-shade-v1.png',
  tree_wild_plum: 'wild-plum-v1.png',
  tree_guava: 'guava-v1.png',
  tree_olive: 'olive-v1.png',
  tree_waterberry: 'waterberry-v1.png',
  tree_natal_plum: 'natal-plum-v1.png',
};

/**
 * Stable, reusable AI-painted artwork for exact app-owned feature footprints.
 *
 * The mapping is deliberately conservative. A generic basin never receives a tree canopy, and an
 * unknown/custom item stays on the deterministic fallback instead of being visually invented.
 */
export function referenceFeatureArtworkFor(defId: string): ReferenceFeatureArtwork | null {
  const key = normaliseLookupKey(defId, '_');
  if (JOJO_TANKS.has(key)) return 'jojo-tank-v1.png';
  if (key === 'banana_circle') return 'banana-basin-v1.png';
  if (ORCHARD_TREES.has(key)) return 'orchard-canopy-v1.png';
  if (PRODUCTION_BEDS.has(key)) return 'production-bed-v1.png';
  if (key === 'pollinator_strip') return 'pollinator-strip-v1.png';
  if (VETIVER_BANKS.has(key)) return 'vetiver-bank-v1.png';
  if (STRUCTURE_ART[key]) return STRUCTURE_ART[key];
  if (WATER_HARDWARE_ART[key]) return WATER_HARDWARE_ART[key];
  if (PLANTING_DETAIL_ART[key]) return PLANTING_DETAIL_ART[key];
  return null;
}

export function referenceFeatureArtworkUrl(defId: string): string | null {
  const asset = referenceFeatureArtworkFor(defId);
  return asset ? `${REFERENCE_FEATURE_ART_ROOT}/${asset}` : null;
}
