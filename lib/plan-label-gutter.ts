/**
 * A LABEL GUTTER: clean paper down each side of the map, where every callout lives.
 *
 * WHY THIS EXISTS. Rory, on the Ubhejane planting sheet, after a year of asking: "not every tree
 * has a label — been saying this forever … don't say moringa ×5 [pointing at] one plant … perhaps
 * better label every plant unless really a considerable amount, like I don't want to label 300
 * pigeon pea shrubs, but big trees, important plants, even if there is 3, I suggest labeling each.
 * The legend can say moringa ×3. **The labels must not be drawn over the design, they must be to
 * the side of the design.**"
 *
 * Both halves of that are the drafting convention, and the sheets were failing both.
 *
 * WHAT WAS ACTUALLY WRONG. The label engine has always PINNED callouts to the left and right
 * margins (see producerLabels' "Pin each BLOCK to the LEFT or RIGHT margin"), and that layout is
 * the thing that guarantees leaders cannot cross. What undid it was LEADER_MAX_RUN_RATIO: a later
 * rule that stops a leader marching all the way across the sheet by pulling the LABEL back toward
 * its own feature. On a farm whose plot sits in the middle of the frame that drags every pill off
 * the margin and onto the planting — which is exactly the screenshot Rory sent, with "PAWPAW TREE
 * ×4" sitting on a canopy.
 *
 * A margin is not a gutter. A margin is wherever the map happens to end; a gutter is RESERVED, and
 * nothing else may be drawn in it. So the sheet now reserves one.
 *
 * WHERE THE SPACE COMES FROM, AND WHY NOT FROM THE PHOTOGRAPH. The first attempt reserved the band
 * inside the map by zooming the viewport out until the plot left a clear strip of aerial on each
 * side. It measured beautifully in isolation and did nothing at all on a real farm: the app fetches
 * its imagery FRAMED ON THE FARM, so on the Ubhejane demo the plot runs from x=0.0001 to x=0.9999 of
 * its own photo and there is no margin to reserve. calculateBoundaryPresentationLayout cannot invent
 * one either — its crop may never reach outside the source image.
 *
 * So the gutter is SHEET real estate, added beside the map, exactly as the legend panel is. The map
 * canvas is untouched and full-bleed, the drawing is not shrunk by a single pixel, and the band is
 * clean paper that no photograph was ever going to occupy. calculateStyleSheetSize counts it in the
 * sheet width so the A-series aspect search still lands on paper rather than leaving a cream band.
 *
 * (Worth keeping in mind next time: a "reserve" that depends on the source data having slack is not
 * a reserve. The measurement that settled this was one line of instrumentation in the real render —
 * the unit test asserting the reserve worked was perfectly correct and perfectly irrelevant, because
 * it supplied its own boundary.)
 */

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import { plantingLegendSectionForFeature } from '@/lib/planting-cartography';

/**
 * How wide each gutter is, as a fraction of the map's own width.
 *
 * 0.13 is not a taste call — it is the narrowest band that holds the LONGEST name in the catalog
 * ("Indigenous Shade Tree") at a size that survives print. Below about 0.11 the shrink-to-fit floor
 * starts firing on ordinary names, and a sheet whose labels are three different sizes is the defect
 * the sheet audit already caught once.
 */
export const LABEL_GUTTER_FRACTION = 0.13;

/** The band's width in pixels for a map of this width. One number for both sides: a plan set whose
 *  margins differ left to right reads as a printing error, not as a layout. */
export function sheetGutterWidth(mapWidth: number): number {
  if (!Number.isFinite(mapWidth) || mapWidth <= 0) return 0;
  return Math.round(mapWidth * LABEL_GUTTER_FRACTION);
}

/**
 * WHICH THINGS ARE NAMED ONE BY ONE, AND WHICH ARE NAMED ONCE WITH A COUNT.
 *
 * Rory's rule, in his words: label each big tree even where there are only three of them; do not
 * label three hundred pigeon peas. The distinction he is drawing is not really about NUMBER — nine
 * vegetable beds are as numerous as nine mangoes and he has never asked for nine bed labels. It is
 * about what the thing IS.
 *
 * A perennial is a specimen. It goes in once, it is there for thirty years, it is pruned and
 * harvested as an individual, and when a farmer is standing under one in year four the only
 * question that matters is "which of these is the litchi". A bed, a row, a strip or a basin is a
 * UNIT of a system: nine beds are one vegetable garden, and labelling each of them nine times says
 * nothing the one label did not.
 *
 * So the split follows the planting legend's own sections, which already encode exactly this
 * distinction — 'PERENNIAL GUILDS' is the tree-and-shrub section — plus a hard ceiling, because a
 * food forest with three hundred pigeon peas is a real design and three hundred rows down a gutter
 * is not a sheet.
 *
 * A NAME IS NOT AN INTENTION. The first version also treated "the farmer renamed it" as a request
 * to label it individually, which sounds right and is wrong: the Studio itself auto-names beds
 * "Bed 1 … Bed 7", so the very first real render came back with seven bed rows down the gutter —
 * precisely the list Rory did not want. Renaming changes what a row SAYS, never how many rows
 * there are.
 */
export const LABEL_EVERY_SPECIMEN_MAX = 24;

export function labelsEverySpecimen(defId: string, count: number): boolean {
  if (!Number.isFinite(count) || count < 1) return false;
  if (count > LABEL_EVERY_SPECIMEN_MAX) return false;
  return plantingLegendSectionForFeature(defId) === 'PERENNIAL GUILDS';
}

/** The name a gutter row carries. Mixed case, not the CAPS an on-map pill uses: a pill is fighting
 *  a photograph and needs the weight, a gutter row is on clean paper and mixed case is both more
 *  legible and about 12% narrower — which is what buys the long names their single line. */
export function gutterLabelText(defId: string, custom: string | undefined, count: number): string {
  const name = custom ?? ELEMENTS_BY_ID[defId]?.name ?? defId;
  return count > 1 ? `${name} ×${count}` : name;
}

export interface GutterRow {
  id: string;
  /** Where the leader lands, in map px. */
  cx: number;
  cy: number;
  text: string;
}

export interface PlacedGutterRow extends GutterRow {
  side: 'left' | 'right';
  /** Row centre, in map px, after de-collision. */
  ay: number;
}

export interface GutterLayout {
  /** Band width in px, the same on both sides. */
  gutter: number;
  rows: PlacedGutterRow[];
  /** Rows that did not fit and were folded away — reported so a caller can say so rather than
   *  silently shipping a sheet that names less than its legend does. */
  dropped: GutterRow[];
  /** Vertical distance between row centres, in map px. Drives the font size. */
  pitch: number;
}

/**
 * Range the rows down the gutters: nearest side first, sorted by the y of the thing they name,
 * de-collided downward, and slid back up as a block if the column overran.
 *
 * NO-CROSSING LEADERS is the property this layout exists to hold, and it survives here for the same
 * reason it did in producerLabels: within a side, the column stays in the same vertical ORDER as
 * the features it points at, so two leaders on one side can never swap places. What is new is that
 * every row now carries its own leader — the old layout gave a whole block one leader and let its
 * member rows go silent, which is precisely how "moringa ×5" ended up as one line to one tree.
 *
 * A side that overflows sheds its rows to the other side, nearest the middle first, before anything
 * is dropped — a farm with all its trees on the west side should not lose labels while the east
 * gutter sits empty.
 */
export function layoutGutterRows(
  rows: GutterRow[],
  opts: {
    /** The MAP's width, not the sheet's — rows are placed in map coordinates and the caller
     *  offsets them by the gutter when it paints. */
    mapWidth: number;
    gutter: number;
    /** Smallest gap between row centres that still reads as separate rows. */
    minPitch: number;
    /** Largest — past this the column looks like a list of unrelated notes, not an index. */
    maxPitch: number;
    top: number;
    bottom: number;
  },
): GutterLayout {
  const { mapWidth, gutter, minPitch, maxPitch, top, bottom } = opts;
  const usable = Math.max(0, bottom - top);
  const sides = gutter > 0 ? (['left', 'right'] as const) : ([] as const);
  if (!sides.length || usable <= 0 || !rows.length) {
    return { gutter, rows: [], dropped: [...rows], pitch: minPitch };
  }
  const perSide = Math.max(1, Math.floor(usable / minPitch) + 1);
  const capacity = perSide * sides.length;

  const ordered = [...rows].sort((a, b) => a.cy - b.cy || a.cx - b.cx || a.id.localeCompare(b.id));
  // Drop from the MIDDLE of the sheet outward when over capacity: a callout near the edge is the
  // one whose leader is short and whose position is least ambiguous, so the ones worth keeping are
  // the ones a reader would otherwise have to guess at. (Nothing is lost either way — the legend
  // still counts every specimen — but a dropped row is reported, never silent.)
  const dropped: GutterRow[] = [];
  let kept = ordered;
  if (ordered.length > capacity) {
    const byDistanceFromEdge = [...ordered].sort((a, b) => {
      const da = Math.min(a.cx, mapWidth - a.cx);
      const db = Math.min(b.cx, mapWidth - b.cx);
      return db - da || a.id.localeCompare(b.id);
    });
    const cut = new Set(byDistanceFromEdge.slice(0, ordered.length - capacity).map((r) => r.id));
    dropped.push(...ordered.filter((r) => cut.has(r.id)));
    kept = ordered.filter((r) => !cut.has(r.id));
  }

  const assign = new Map<string, 'left' | 'right'>();
  for (const row of kept) {
    const natural: 'left' | 'right' = row.cx < mapWidth / 2 ? 'left' : 'right';
    assign.set(row.id, sides.includes(natural) ? natural : sides[0]);
  }
  // Re-balance: a side over its capacity sheds the rows closest to the sheet's centre line, because
  // those are the ones whose "nearest side" was the weakest claim in the first place.
  if (sides.length === 2) {
    for (const side of sides) {
      const other = side === 'left' ? 'right' : 'left';
      const mine = kept.filter((r) => assign.get(r.id) === side);
      if (mine.length <= perSide) continue;
      const excess = [...mine]
        .sort((a, b) => Math.abs(a.cx - mapWidth / 2) - Math.abs(b.cx - mapWidth / 2))
        .slice(0, mine.length - perSide);
      for (const row of excess) assign.set(row.id, other);
    }
  }

  const busiest = Math.max(
    1,
    ...sides.map((side) => kept.filter((r) => assign.get(r.id) === side).length),
  );
  const pitch = busiest > 1
    ? Math.max(minPitch, Math.min(maxPitch, usable / (busiest - 1)))
    : maxPitch;

  const placed: PlacedGutterRow[] = [];
  for (const side of sides) {
    const column = kept
      .filter((r) => assign.get(r.id) === side)
      .sort((a, b) => a.cy - b.cy || a.cx - b.cx || a.id.localeCompare(b.id));
    if (!column.length) continue;
    const ys = column.map((r) => Math.max(top, Math.min(bottom, r.cy)));
    for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + pitch);
    const overflow = ys[ys.length - 1] - bottom;
    if (overflow > 0) {
      for (let i = 0; i < ys.length; i++) ys[i] -= overflow;
      // The upward slide is applied blindly, so re-establish the separations it just crushed. The
      // capacity check above guarantees this cannot overflow again.
      if (ys[0] < top) {
        ys[0] = top;
        for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + pitch);
      }
    }
    column.forEach((row, i) => placed.push({ ...row, side, ay: ys[i] }));
  }

  return { gutter, rows: placed, dropped, pitch };
}
