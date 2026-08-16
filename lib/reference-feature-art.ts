import { normaliseLookupKey } from '@/lib/key-normalisation';

export const REFERENCE_FEATURE_ART_ROOT = '/render-assets/reference-blueprint';

/** Optional painted assets improve a sheet but never outrank finishing it. A same-origin image
 *  decode that neither loads nor errors used to leave the paid flow permanently on "locking the
 *  exact map". After this deadline the renderer uses its deterministic vector fallback. */
export const REFERENCE_FEATURE_ART_WAIT_MS = 8_000;

export async function settleOptionalReferenceArtLoad<T>(
  load: Promise<T>,
  maxWaitMs: number = REFERENCE_FEATURE_ART_WAIT_MS,
): Promise<T | null> {
  if (!Number.isFinite(maxWaitMs) || maxWaitMs <= 0) return null;
  const timedOut = Symbol('reference-art-timeout');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      load,
      new Promise<typeof timedOut>((resolve) => {
        timer = setTimeout(() => resolve(timedOut), maxWaitMs);
      }),
    ]);
    return result === timedOut ? null : result;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export type ReferenceFeatureArtwork =
  | 'banana-basin-v1.png'
  // v1 was leaves-only, no visible fruit (Rory: "banana circle needs to have bananas in it just
  // like banana clumps"). v2 adds three fruit bunches in the same ring composition.
  | 'banana-basin-v2.png'
  | 'orchard-canopy-v1.png'
  | 'production-bed-v1.png'
  | 'pollinator-strip-v1.png'
  | 'vetiver-bank-v1.png'
  | 'shade-house-v4.png'
  | 'polytunnel-v1.png'
  | 'banana-clump-v5.png'
  | 'pawpaw-tree-v2.png'
  | 'moringa-tree-v1.png'
  | 'avocado-tree-v5.png'
  | 'mango-tree-v2.png'
  | 'litchi-tree-v5.png'
  | 'macadamia-tree-v2.png'
  | 'citrus-tree-v3.png'
  | 'apple-tree-v1.png'
  | 'pear-tree-v1.png'
  | 'plum-tree-v1.png'
  | 'peach-tree-v1.png'
  | 'fig-tree-v1.png'
  | 'pomegranate-tree-v1.png'
  | 'keyhole-bed-v1.png'
  | 'herb-spiral-v1.png'
  | 'spekboom-hedge-v1.png'
  | 'marula-tree-v2.png'
  | 'kei-apple-tree-v2.png'
  // Six crowns drawn to break up the generic canopy — see the ORCHARD_TREES note below.
  | 'indigenous-shade-v1.png'
  | 'wild-plum-v2.png'
  | 'guava-v2.png'
  | 'olive-v2.png'
  | 'waterberry-v2.png'
  | 'natal-plum-v2.png'
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
  | 'jojo-1000-top-v2.png'
  | 'jojo-2500-top-v2.png'
  | 'jojo-5000-top-v2.png'
  | 'jojo-10000-top-v2.png'
  | 'rain-barrel-top-v1.png';

// PER-CAPACITY, not one shared drawing — the whole point of the tank family's colour code is
// that a farmer can tell 2500 from 5000 at a glance, and a single 'jojo-tank-v1' threw that
// away on the one sheet where tanks matter most. Rory, on the old blue dartboard symbol:
// "new graphic for jojo tank (this is the old one?)".
const TANK_TOP_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  jojo_1000: 'jojo-1000-top-v2.png',
  jojo_2500: 'jojo-2500-top-v2.png',
  jojo_5000: 'jojo-5000-top-v2.png',
  jojo_10000: 'jojo-10000-top-v2.png',
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
// Every named fruit and nut tree now carries its own map-scale identity fruit and foliage. The
// deliberately-unspecified Other Tree is the only honest user of the neutral orchard crown.
const ORCHARD_TREES = new Set(['tree_other']);
const PRODUCTION_BEDS = new Set(['veg_bed', 'raised_bed']);
const VETIVER_BANKS = new Set(['vetiver_row', 'mulch_bank']);

const STRUCTURE_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  // v3 was photographed from the entrance, so stretching it to the farmer's saved rectangle
  // made a 6 x 6 m tunnel converge toward the far end. v4 is a square-on overhead footprint:
  // half net, half open frame, and its subject reaches every edge that encodes the saved size.
  shade_house: 'shade-house-v4.png',
  greenhouse_tunnel: 'polytunnel-v1.png',
};

const PLANTING_DETAIL_ART: Readonly<Record<string, ReferenceFeatureArtwork>> = {
  banana_clump: 'banana-clump-v5.png',
  tree_pawpaw: 'pawpaw-tree-v2.png',
  tree_moringa: 'moringa-tree-v1.png',
  tree_avocado: 'avocado-tree-v5.png',
  tree_mango: 'mango-tree-v2.png',
  tree_litchi: 'litchi-tree-v5.png',
  tree_macadamia: 'macadamia-tree-v2.png',
  tree_citrus: 'citrus-tree-v3.png',
  tree_apple: 'apple-tree-v1.png',
  tree_pear: 'pear-tree-v1.png',
  tree_plum: 'plum-tree-v1.png',
  tree_peach: 'peach-tree-v1.png',
  tree_fig: 'fig-tree-v1.png',
  tree_pomegranate: 'pomegranate-tree-v1.png',
  keyhole_bed: 'keyhole-bed-v1.png',
  herb_spiral: 'herb-spiral-v1.png',
  spekboom_hedge: 'spekboom-hedge-v1.png',
  // Marula and kei apple are the two indigenous fruit species with dedicated canopy art, so
  // they belong HERE and not in ORCHARD_TREES above. Order of checks matters: ORCHARD_TREES is
  // tested first in referenceFeatureArtworkFor, so an id listed in both would silently keep the
  // generic canopy and this entry would never fire.
  tree_marula: 'marula-tree-v2.png',
  tree_kei_apple: 'kei-apple-tree-v2.png',
  // Named fruit and shade crowns stay here; only the deliberately generic Other Tree may use the
  // neutral orchard image. ORCHARD_TREES is checked first, so membership there remains exclusive.
  tree_indigenous: 'indigenous-shade-v1.png',
  tree_wild_plum: 'wild-plum-v2.png',
  tree_guava: 'guava-v2.png',
  tree_olive: 'olive-v2.png',
  tree_waterberry: 'waterberry-v2.png',
  tree_natal_plum: 'natal-plum-v2.png',
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
  if (key === 'banana_circle') return 'banana-basin-v2.png';
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
