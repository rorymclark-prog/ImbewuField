/**
 * Rows of actual crops, drawn inside a bed or a staple plot.
 *
 * WHY THIS EXISTS. A vegetable bed printed as a green rectangle and a quarter-hectare staple plot
 * printed as a pale green polygon tell a farmer nothing they did not already know. Rory has asked
 * for the real thing repeatedly and in plain terms: "veg beds improve, brown background with
 * actual veg — I have asked and asked, gawd please do it! Put cabbages, tomatoes etc etc"; and
 * "staple plot polygons ... they need to have actual rows of maize, beans, potatoes, and another
 * for 4 plots — not a polygon!"
 *
 * This is also how planting plans are actually drawn. A landscape or market-garden planting sheet
 * shows bed geometry AND the planting pattern inside it, because the pattern is the instruction:
 * the farmer reads the row spacing and sets out to it. A flat fill is a diagram of the bed; rows
 * are a drawing of the crop.
 *
 * PURE GEOMETRY ONLY. This module returns positions and glyph kinds; the canvas work lives in the
 * renderer, matching the split already used by lib/water-cartography.ts and lib/sector.ts. Nothing
 * here reads or mutates saved design state.
 *
 * NOTHING HERE IS AN AGRONOMIC RECOMMENDATION. The row spacings below are DRAWING rhythms chosen
 * so a plot reads as rows at sheet scale — they are not sowing advice and must never be presented
 * as such. Real spacings are sourced and cited in lib/crop-catalog.ts, which is the only place a
 * farmer-facing spacing figure may come from.
 */

/** The forms a crop glyph can take. Deliberately few: at sheet scale, silhouette is all that survives. */
export type CropGlyph =
  /** Leafy rosette — cabbage, spinach, lettuce. Concentric arcs. */
  | 'rosette'
  /** Staked fruiting plant — tomato, pepper. Upright stem with a canopy. */
  | 'staked'
  /** Tall grain stalk with an ear — maize. THE staple silhouette in southern Africa. */
  | 'grain'
  /** Climbing legume — beans, cowpea. A slim twining stroke. */
  | 'legume'
  /** Root crop — potato, beetroot, carrot. A low mound with a leaf tuft. */
  | 'root'
  /** Sprawling ground layer — pumpkin, squash. A wide low lobe. */
  | 'vine'
  /** Anything unrecognised: a plain small plant. Never invents a crop identity. */
  | 'generic';

export interface CropRowPlant {
  /** Position in the same units the caller passed its rectangle/ring in. */
  x: number;
  y: number;
  glyph: CropGlyph;
  /** 0..1, stable per plant — lets the renderer vary size/rotation without looking random. */
  jitter: number;
}

export interface CropRowLayout {
  plants: CropRowPlant[];
  /** Centre line of each row, for the faint drill line drawn under the plants. */
  rows: Array<{ x0: number; y0: number; x1: number; y1: number }>;
  /** Distance between rows in the caller's units — the renderer sizes glyphs from this. */
  rowGapPx: number;
}

/**
 * Which silhouette a catalog crop key or free-text crop name is drawn with.
 *
 * Matching is on substrings of a normalised name so a farmer's own label ("green mielies",
 * "cabbages") lands on the right silhouette without needing a catalog entry. Unknown names get
 * 'generic' — a plain plant — because drawing a maize stalk for a crop we cannot identify would
 * be asserting something about the farm that nobody told us.
 */
export function cropGlyphFor(name: string | undefined): CropGlyph {
  if (!name) return 'generic';
  const key = name.toLowerCase();
  const has = (...needles: string[]) => needles.some((needle) => key.includes(needle));
  if (has('maize', 'mielie', 'mealie', 'corn', 'sorghum', 'millet', 'wheat')) return 'grain';
  if (has('bean', 'cowpea', 'pea', 'groundnut', 'peanut', 'lentil', 'jugo')) return 'legume';
  if (has('pumpkin', 'squash', 'butternut', 'melon', 'gem squash', 'marrow')) return 'vine';
  if (has('potato', 'beetroot', 'carrot', 'onion', 'turnip', 'radish', 'amadumbe', 'taro', 'madumbi')) return 'root';
  if (has('tomato', 'pepper', 'chilli', 'brinjal', 'aubergine', 'eggplant', 'okra')) return 'staked';
  if (has('cabbage', 'spinach', 'chard', 'lettuce', 'kale', 'imifino', 'morogo', 'herb', 'coriander')) return 'rosette';
  return 'generic';
}

/**
 * The four silhouettes an UNNAMED vegetable bed is drawn with, rotated bed by bed.
 *
 * WHY THIS IS NOT A RECOMMENDATION. Seven beds a farmer has not yet assigned crops to were all
 * drawn 'generic', so a sheet showed seven identical rectangles of identical dots and read as
 * wallpaper (Rory: "can we improve the veg on the veg beds maybe alternate the beds with different
 * veg"). A mixed home garden is what a vegetable garden IS, and the drawing should look like one.
 *
 * The critical line: this varies the SILHOUETTE only. Nothing downstream is told a bed contains
 * cabbage — the legend still reads "Vegetable Bed ×7", no callout names a crop, no BOQ row appears
 * and no yield is claimed. The moment a farmer assigns a species or types a recognisable label,
 * cropGlyphFor wins and this is never consulted. So the sheet says "a mixed vegetable garden",
 * which is true, and never "plant cabbage in bed 3", which would not be ours to say.
 *
 * The four are the ones a southern-African homestead garden actually carries, and — just as
 * important for a drawing — they are the four that stay apart from each other at sheet scale.
 */
const UNNAMED_BED_GLYPHS: readonly CropGlyph[] = ['rosette', 'root', 'staked', 'legume'];

/**
 * ONE CROP PER PLOT — Rory's words, three times: "maizes on one plot beans on another etc etc".
 *
 * Two earlier attempts got this wrong in the same way. Both mixed several crops INSIDE each plot
 * and varied the mixture between plots: first four orderings of the same three sisters, then a
 * three-rows-in-four lead crop with a companion row through it. On paper those are four different
 * patterns. On a sheet they are four patches of the same speckle, because a reader at plan scale
 * sees a plot's overall texture, never its row sequence — so "which crop leads here" was a
 * distinction only the code could perceive. That is why the complaint kept coming back unchanged.
 *
 * A plot is now a single crop, and neighbouring plots are different crops. That is the only version
 * you can read from across the room, and it is also what a rotated staple garden IS: the reason a
 * farmer divides one field into four plots is so that this year's maize block becomes next year's
 * bean block. Four blocks with the same speckle is a drawing of the thing they specifically did
 * not do.
 *
 * NOT AGRONOMIC, as with every number in this file. It draws the four plots as four crops so they
 * read apart, in the order the farmer created them. It states no seed rate, spacing, rotation
 * sequence or yield, no legend row names a crop, and nothing downstream reads it as advice.
 */
const STAPLE_PLOT_CROPS: readonly CropGlyph[] = ['grain', 'legume', 'vine', 'root'];

/** Stable 0..1 from an id, so a bed keeps its silhouette across every render of the design. */
function idUnit(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

/**
 * The silhouette for a bed the farmer has not named a crop for.
 *
 * Keyed on the bed's own id rather than its position in the item list. Position looked tidier — it
 * would cycle 1,2,3,4 exactly — but the list holds every item on the farm, not just beds, so beds
 * landing on a stride of four would all take the SAME glyph and the garden would come out uniform
 * again by a different route. Two beds sharing a silhouette is not a defect anyway: a real garden
 * has two beds of greens.
 */
export function unnamedBedGlyph(seed: string): CropGlyph {
  return UNNAMED_BED_GLYPHS[Math.floor(idUnit(seed) * UNNAMED_BED_GLYPHS.length) % UNNAMED_BED_GLYPHS.length];
}

/**
 * The single crop one staple plot is drawn with, by the plot's position among the staple plots.
 *
 * ORDINAL, NOT HASH. Every other glyph choice in this file is keyed on an id hash, and that is
 * right for beds, where two beds of greens is realistic and a farm may hold thirty of them. It is
 * wrong here: four plots drawn from a hash collide, and the whole point is that a farmer who cut
 * their field into four sees four crops. Ordinal is what guarantees plot 1..4 are grain, legume,
 * vine, root — never two the same until there are more plots than crops. The caller numbers plots
 * in the farmer's own creation order, so the plot they drew first is the maize block on every
 * render and does not swap crops when they add a fifth.
 */
export function staplePlotGlyph(ordinal: number): CropGlyph {
  const index = Number.isFinite(ordinal) ? Math.max(0, Math.floor(ordinal)) : 0;
  return STAPLE_PLOT_CROPS[index % STAPLE_PLOT_CROPS.length];
}

/** The row sequence for one staple plot: a single crop, so the plot reads as a crop block. */
export function staplePlotGlyphs(ordinal: number): readonly CropGlyph[] {
  return [staplePlotGlyph(ordinal)];
}

/**
 * Lay out rows of plants inside an axis-aligned rectangle, in the rectangle's own local space
 * (origin at its centre, +x right, +y down). The caller applies the bed's rotation.
 *
 * Rows run along the LONG axis, which is how beds are actually worked — you walk the length of a
 * bed, not across it. `targetRows` is clamped so a small bed on a zoomed-out sheet does not try to
 * draw twelve rows into six pixels; below the floor the caller should fall back to a plain fill,
 * because a row of illegible dots is worse than an honest rectangle.
 */
export function bedCropRows(
  widthPx: number,
  heightPx: number,
  glyph: CropGlyph,
  seed: string,
  targetRowGapPx = 13,
): CropRowLayout {
  const w = Math.max(0, widthPx);
  const h = Math.max(0, heightPx);
  if (w < 6 || h < 6) return { plants: [], rows: [], rowGapPx: 0 };
  const alongX = w >= h;
  const across = alongX ? h : w;
  const along = alongX ? w : h;
  const rowCount = Math.max(1, Math.min(9, Math.round(across / Math.max(6, targetRowGapPx))));
  const rowGapPx = across / (rowCount + 1);
  // In-row spacing is a touch tighter than row spacing, which is what a bed actually looks like
  // from above: rows are set by the width of a hoe, plants by the crop.
  const stepAlong = Math.max(7, rowGapPx * 0.82);
  const perRow = Math.max(1, Math.floor((along - stepAlong) / stepAlong));

  const rows: CropRowLayout['rows'] = [];
  const plants: CropRowPlant[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const acrossPos = -across / 2 + rowGapPx * (r + 1);
    const halfAlong = (perRow - 1) * stepAlong * 0.5;
    const start = -halfAlong;
    rows.push(alongX
      ? { x0: -along / 2 + stepAlong * 0.5, y0: acrossPos, x1: along / 2 - stepAlong * 0.5, y1: acrossPos }
      : { x0: acrossPos, y0: -along / 2 + stepAlong * 0.5, x1: acrossPos, y1: along / 2 - stepAlong * 0.5 });
    for (let i = 0; i < perRow; i += 1) {
      const alongPos = start + i * stepAlong;
      plants.push({
        x: alongX ? alongPos : acrossPos,
        y: alongX ? acrossPos : alongPos,
        glyph,
        jitter: stableUnit(seed, r * 997 + i),
      });
    }
  }
  return { plants, rows, rowGapPx };
}

/**
 * Fill an arbitrary polygon (a traced staple plot) with rows, by scanning across its bounding box
 * and keeping only the points that fall inside the ring.
 *
 * A staple plot is traced freehand and is rarely a rectangle, so `bedCropRows` cannot serve it.
 * The rows run horizontally on the sheet — an honest simplification, since the app does not record
 * which way the farmer's rows actually run, and inventing a direction would be inventing a fact
 * about the farm. Rows follow a bearing only if the caller supplies one it can defend.
 *
 * The `crops` list is cycled row by row, which is what intercropped maize-and-bean plots look like
 * from above and is the traditional southern-African pattern the staple plot exists to model.
 */
export function polygonCropRows(
  ring: Array<[number, number]>,
  crops: readonly CropGlyph[],
  seed: string,
  rowGapPx: number,
): CropRowLayout {
  if (ring.length < 3 || !Number.isFinite(rowGapPx) || rowGapPx <= 0) {
    return { plants: [], rows: [], rowGapPx: 0 };
  }
  const glyphs = crops.length ? crops : (['generic'] as CropGlyph[]);
  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX) || maxX - minX < 4 || maxY - minY < 4) {
    return { plants: [], rows: [], rowGapPx: 0 };
  }
  const stepAlong = Math.max(7, rowGapPx * 0.85);
  const plants: CropRowPlant[] = [];
  const rows: CropRowLayout['rows'] = [];
  let rowIndex = 0;
  for (let y = minY + rowGapPx; y < maxY; y += rowGapPx, rowIndex += 1) {
    const glyph = glyphs[rowIndex % glyphs.length];
    let firstX: number | null = null;
    let lastX = 0;
    let column = 0;
    for (let x = minX + stepAlong * 0.5; x < maxX; x += stepAlong, column += 1) {
      if (!pointInRing(ring, x, y)) continue;
      if (firstX === null) firstX = x;
      lastX = x;
      plants.push({ x, y, glyph, jitter: stableUnit(seed, rowIndex * 997 + column) });
    }
    if (firstX !== null && lastX > firstX) rows.push({ x0: firstX, y0: y, x1: lastX, y1: y });
  }
  return { plants, rows, rowGapPx };
}

/** Even-odd point-in-polygon. Rings here are screen-space and small; no spatial index is warranted. */
export function pointInRing(ring: Array<[number, number]>, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/** Deterministic 0..1 from a seed — the same plot draws identically on every render and every device. */
export function stableUnit(seed: string, index: number): number {
  let hash = 2166136261;
  const value = `${seed}:${index}`;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}
