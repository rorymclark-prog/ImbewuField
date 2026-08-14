import { normaliseLookupKey } from '@/lib/key-normalisation';

export const REFERENCE_FEATURE_ART_ROOT = '/render-assets/reference-blueprint';

export type ReferenceFeatureArtwork =
  | 'banana-basin-v1.png'
  | 'orchard-canopy-v1.png'
  | 'production-bed-v1.png'
  | 'pollinator-strip-v1.png'
  | 'vetiver-bank-v1.png'
  | 'shade-house-v2.png'
  | 'banana-clump-v1.png'
  | 'pawpaw-tree-v1.png'
  | 'moringa-tree-v1.png'
  | 'avocado-tree-v1.png'
  | 'mango-tree-v1.png'
  | 'litchi-tree-v1.png'
  | 'macadamia-tree-v1.png'
  | 'citrus-tree-v3.png'
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
  | 'natal-plum-v1.png'
  // Staple-plot field tiles — OPAQUE and SEAMLESS-TILEABLE, unlike everything above. They are
  // clip-filled across a traced staple_garden polygon as a repeating pattern, not composited on
  // an item footprint. See stapleTileFor.
  | 'staple-maize-v1.png'
  | 'staple-beans-v1.png'
  | 'staple-pumpkin-v1.png'
  | 'staple-mixed-v1.png'
  // Vegetable plant sprites, one per CropGlyph kind — stamped along bed rows by
  // drawCropRowLayout in place of its vector glyphs. Sprites, not tiles: transparent field,
  // centred subject, drawn many-per-bed at ~20px.
  | 'veg-rosette-v1.png'
  | 'veg-staked-v1.png'
  | 'veg-grain-v1.png'
  | 'veg-legume-v1.png'
  | 'veg-root-v1.png'
  | 'veg-vine-v1.png'
  | 'veg-generic-v1.png'
  // Top-down tank sprites — the water sheet's plan-view identity, lids in the same capacity
  // colours the side-view picker family wears (#89): charcoal, green, teal, sandstone, blue.
  | 'jojo-1000-top-v1.png'
  | 'jojo-2500-top-v1.png'
  | 'jojo-5000-top-v1.png'
  | 'jojo-10000-top-v1.png'
  | 'rain-barrel-top-v1.png';

// PER-CAPACITY, not one shared drawing — the whole point of the tank family's colour code is
// that a farmer can tell 2500 from 5000 at a glance, and a single 'jojo-tank-v1' threw that
// away on the one sheet where tanks matter most. Rory, on the old blue dartboard symbol:
// "new graphic for jojo tank (this is the old one?)".
const TANK_TOP_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  jojo_1000: 'jojo-1000-top-v1.png',
  jojo_2500: 'jojo-2500-top-v1.png',
  jojo_5000: 'jojo-5000-top-v1.png',
  jojo_10000: 'jojo-10000-top-v1.png',
  rain_barrel: 'rain-barrel-top-v1.png',
};

/** WHICH ELEMENTS ARE TANKS, derived from the art table above rather than typed out again.
 *  The Water sheet needs this twice — once to DRAW the tank, once to draw the water story
 *  arriving in it and overflowing out of it — and a hand-copied second list is exactly how a new
 *  tank capacity ends up drawn but not plumbed. Note that `nearRoofM` alone will NOT serve as the
 *  test: the pump & filter carries one too, and it is not a tank. */
export function isTankDefId(defId: string): boolean {
  return Boolean(TANK_TOP_ART[normaliseLookupKey(defId, '_')]);
}

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
  shade_house: 'shade-house-v2.png',
};

const PLANTING_DETAIL_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  banana_clump: 'banana-clump-v1.png',
  tree_pawpaw: 'pawpaw-tree-v1.png',
  tree_moringa: 'moringa-tree-v1.png',
  tree_avocado: 'avocado-tree-v1.png',
  tree_mango: 'mango-tree-v1.png',
  tree_litchi: 'litchi-tree-v1.png',
  tree_macadamia: 'macadamia-tree-v1.png',
  tree_citrus: 'citrus-tree-v3.png',
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
  if (TANK_TOP_ART[key]) return TANK_TOP_ART[key];
  if (key === 'banana_circle') return 'banana-basin-v1.png';
  if (ORCHARD_TREES.has(key)) return 'orchard-canopy-v1.png';
  if (PRODUCTION_BEDS.has(key)) return 'production-bed-v1.png';
  if (key === 'pollinator_strip') return 'pollinator-strip-v1.png';
  if (VETIVER_BANKS.has(key)) return 'vetiver-bank-v1.png';
  if (STRUCTURE_ART[key]) return STRUCTURE_ART[key];
  if (PLANTING_DETAIL_ART[key]) return PLANTING_DETAIL_ART[key];
  return null;
}

/** The four staple-plot field tiles, in the SAME rotation staplePlotGlyph uses — one crop per
 *  plot, neighbouring plots different, and a given plot keeps its crop on every sheet because
 *  both are driven by the plot's saved-creation ordinal (staplePlotOrdinalById). The tile
 *  answers "what does this plot LOOK like"; the glyph engine remains the fallback wherever the
 *  tile has not loaded, so a plot is never blank.
 *
 *  The order below must match STAPLE_PLOT_CROPS in lib/crop-row-cartography.ts — grain(maize),

 *  legume(beans), vine(pumpkin), generic(mixed) — or a plot's drawn rows and its tile would disagree about its crop. */
export const STAPLE_TILES: readonly ReferenceFeatureArtwork[] = [
  'staple-maize-v1.png',
  'staple-beans-v1.png',
  'staple-pumpkin-v1.png',
  'staple-mixed-v1.png',
];

export function stapleTileFor(ordinal: number): ReferenceFeatureArtwork {
  const i = Number.isFinite(ordinal) && ordinal >= 0 ? Math.floor(ordinal) : 0;
  return STAPLE_TILES[i % STAPLE_TILES.length];
}

export function stapleTileUrl(ordinal: number): string {
  return `${REFERENCE_FEATURE_ART_ROOT}/${stapleTileFor(ordinal)}`;
}

/** One sprite per CropGlyph kind. Keyed by the same union the row engine plants with, so a
 *  glyph can never stamp a sprite of a different crop. */
export const VEG_SPRITES: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  rosette: 'veg-rosette-v1.png',
  staked: 'veg-staked-v1.png',
  grain: 'veg-grain-v1.png',
  legume: 'veg-legume-v1.png',
  root: 'veg-root-v1.png',
  vine: 'veg-vine-v1.png',
  generic: 'veg-generic-v1.png',
};

export function vegSpriteUrl(glyph: string): string | null {
  const file = VEG_SPRITES[glyph];
  return file ? `${REFERENCE_FEATURE_ART_ROOT}/${file}` : null;
}

export function referenceFeatureArtworkUrl(defId: string): string | null {
  const asset = referenceFeatureArtworkFor(defId);
  return asset ? `${REFERENCE_FEATURE_ART_ROOT}/${asset}` : null;
}
