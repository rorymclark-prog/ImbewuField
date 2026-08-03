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
 * NOTHING ON A SCALED SHEET IS DRAWN BIGGER THAN IT IS.
 *
 * There used to be a blanket print-scale emphasis here: trees ×1.36, basins ×1.28, banana clumps
 * ×1.3, on the reasoning that a point-like symbol needs help to read. The reasoning is fine and the
 * implementation was not, because these sheets carry a SCALE BAR. A 4 m citrus drawn at 1.36
 * measures 5.4 m against that bar, and canopy spacing is exactly the decision the planting sheet
 * exists to support — plant a mango at its drawn width and it goes in a metre and a half too close.
 * The sheet's own footer says "geometry and counts come from your saved design"; a multiplier
 * applied after the geometry makes that untrue for the most-measured symbols on the page.
 *
 * A symbol may legitimately be drawn larger than scale only when at scale it would be too small to
 * see at all, which is the standard minimum-symbol-size rule and is handled by the legibility floor
 * in plantingPresentationDimensions below. The difference matters: the floor fires only for things
 * already too small to measure, and on a real sheet (~40 px per metre) it never fires for a tree.
 * The blanket multiplier fired for every tree at every zoom, including the ones a farmer is
 * measuring.
 *
 * Visibility is carried by the opaque canopy backing and outline in PLANTING_CANOPY_PAINT — which
 * is what actually fixed "I can't see any of the trees" — not by drawing them oversized.
 */


export interface PlantingPresentationDimensions {
  width: number;
  height: number;
  scale: number;
}

export interface PlantingCanopyPaintStyle {
  /** A quiet backing that separates a placed canopy from busy photographic tree texture. */
  baseAlpha: number;
  baseColor: string;
  /** Damp shaded soil directly under the trunk — the centre of the basin. */
  basinCoreColor: string;
  /** Worked soil across the body of the basin. */
  basinSoilColor: string;
  /** Drier straw-toned mulch at the basin rim, where the sun reaches it. */
  basinRimColor: string;
  /** Strength of the deterministic mulch stipple laid over the soil. */
  mulchAlpha: number;
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
  // A TREE STANDS ON SOIL, NOT ON PAPER.
  //
  // The cream backing above was measured against the wrong artwork. orchard-canopy-v1 is 85%
  // opaque across its disc, so almost none of the cream ever showed and the treatment looked
  // settled. pawpaw-tree-v1 is 48% and moringa-tree-v1 59% — these are airy, open-crowned trees,
  // deliberately painted with gaps you can see the ground through — so on those the cream is the
  // majority of the symbol, and a pawpaw came out as leaves floating on a white coin. Rory: "slight
  // white on the trees still ... either these get the plant basin underneath or the leaves get
  // bordered with black but not against a white background."
  //
  // The basin is the right half of that choice, because it is also the truth: sheet 05 already
  // derives a tree pit for every tree that has no basin element of its own, on the grounds that
  // digging one is the ground work planting a tree IS (see drawEarthworksFeatures). So what shows
  // through an open crown is the mulched basin the tree is standing in — which reads correctly at
  // any crown density, where a flat backing only ever read correctly at high ones. Damp shaded
  // soil under the trunk out to drier straw at the rim, which is what a mulch basin looks like
  // from above and gives the disc a centre without a highlight.
  //
  // Nothing is counted, legended or billed by this: it is ground under a symbol, exactly as the
  // derived pits are, and the Bill of Quantities still counts only basins the farmer placed.
  basinCoreColor: '#4B3C2A',
  basinSoilColor: '#6B583C',
  basinRimColor: '#8A7454',
  mulchAlpha: 0.3,
  artworkAlpha: 0.96,
  washAlpha: 0.4,
  detailAlphaMin: 0.11,
  detailAlphaMax: 0.15,
  edgeColor: '#24482D',
  edgeAlpha: 0.98,
  // The dark edge is now the border the eye actually reads, because the cream casing behind it was
  // cut from 3.2x to a hairline (drawPaintedReferenceFeature). Rory asked for "a black border
  // exactly around everything" instead of the halo; this is that border, kept dark-green rather
  // than true black so it belongs to the same drawing as the canopies and the boundary line, and
  // kept over a sliver of cream so it survives landing on dark photographic foliage.
  edgeWidthScale: 1.4,
};

/**
 * MINIMUM SYMBOL SIZE — the only reason a planting symbol is ever drawn off-scale.
 *
 * Every map has a size below which a mark stops being a mark, and the standard answer is a floor:
 * anything that would render smaller than the floor is drawn AT the floor. That is a legibility
 * rule, and it is honest in a way a blanket multiplier is not, because it can only affect symbols
 * that were already too small to measure. On a real sheet — roughly 40 px per metre — the floor
 * never fires for a tree canopy or a bed; it rescues a 30 cm herb spiral on a phone-sized export.
 *
 * The saved centre, rotation and aspect ratio are untouched: `scale` is returned for the caller to
 * paint with, and nothing here writes to the design.
 *
 * `id` is retained in the signature deliberately. It is no longer consulted — every planting symbol
 * now obeys one rule instead of a per-species table — and the parameter stays so a future
 * per-symbol exception has an obvious place to go, rather than being reinvented at a call site.
 */
export function plantingFeaturePresentationDimensions(
  id: string,
  naturalWidth: number,
  naturalHeight: number,
  canvasWidth: number,
): PlantingPresentationDimensions {
  void id;
  if (
    !Number.isFinite(naturalWidth)
    || naturalWidth <= 0
    || !Number.isFinite(naturalHeight)
    || naturalHeight <= 0
  ) {
    return { width: 0, height: 0, scale: 1 };
  }
  if (!Number.isFinite(canvasWidth) || canvasWidth <= 0) {
    return { width: naturalWidth, height: naturalHeight, scale: 1 };
  }
  const longSide = Math.max(0.01, naturalWidth, naturalHeight);
  // TWO CORRECTIONS TO THE OLD FLOOR, and the second is the interesting one.
  //
  // 22 px was right while this only ever applied to symbols already enlarged for emphasis. As a
  // universal rule it is far too coarse — it was lifting a 20 px vegetable bed by 10%, the same
  // false measurement in miniature. This is the size below which a mark stops being visible at
  // all, not the size at which it becomes comfortable to look at.
  //
  // And it is measured on the LONGEST side, not the shortest. A shape disappears when the whole
  // shape is too small, not when it is thin: a 180 × 8 px pollinator strip is perfectly legible as
  // a strip, and its 8 px width is a real planting measurement a farmer may take off the sheet.
  // Keying off the short side rescued nothing and quietly widened every hedge, row and strip on
  // the sheet.
  const minimumLongSide = Math.max(9, canvasWidth * 0.005);
  // Long beds and hedges need room to read at phone size. This is a presentation cap, not a
  // geometry edit: the saved centre, rotation and aspect ratio remain untouched by the caller.
  const maximumLongSide = Math.max(minimumLongSide, canvasWidth * 0.16);
  const requestedScale = minimumLongSide / longSide;
  const cappedScale = Math.min(requestedScale, maximumLongSide / longSide);
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

/**
 * WHICH TREES HAVE SOMETHING PLANTED UNDERNEATH THEM.
 *
 * Rory: "bigger trees should always be above smaller? how do we show them underneath?"
 *
 * Half of that is already right and must stay right. The sheets draw the LARGEST canopy first and
 * the smallest last, so a pawpaw planted under a mango is visible on top of it. That is the correct
 * choice for a plan even though it inverts the physics: the job of a planting sheet is to say what
 * is planted where, and a drawing that hides plants under a canopy fails at its only job. Guild
 * planting is the whole point of the sheet — an understory you cannot see is an understory nobody
 * plants.
 *
 * What was missing is the SIGNAL. Drawn solid, the small tree reads as sitting ON the big one's
 * leaves rather than beneath them. The drafting convention for anything overhead is a DASHED line —
 * the same mark a floor plan uses for a roof overhang — so a canopy with planting under it draws
 * its edge dashed and the understory stays solid on top of it. The reader gets both facts: the
 * small plant is there, and the big one is above it.
 *
 * Only canopies that ACTUALLY have something under them are dashed. Dashing every tree would make
 * the mark meaningless, and a lone tree with nothing beneath it has nothing to disambiguate.
 */
export interface CanopyOverlapInput {
  id: string;
  cx: number;
  cy: number;
  /** Half the drawn footprint's short side — the disc a plant's centre has to fall inside. */
  rPx: number;
}

export function overstoryCanopyIds(items: readonly CanopyOverlapInput[]): Set<string> {
  const out = new Set<string>();
  for (const canopy of items) {
    if (!Number.isFinite(canopy.rPx) || canopy.rPx <= 0) continue;
    for (const other of items) {
      if (other.id === canopy.id) continue;
      // Strictly smaller: two touching canopies of the same size are neighbours, not a guild, and
      // dashing both of them would say each is above the other.
      if (!(other.rPx < canopy.rPx * 0.92)) continue;
      if (Math.hypot(other.cx - canopy.cx, other.cy - canopy.cy) <= canopy.rPx) {
        out.add(canopy.id);
        break;
      }
    }
  }
  return out;
}
