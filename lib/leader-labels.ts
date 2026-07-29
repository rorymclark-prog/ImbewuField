// Where a margin callout sits on an exported sheet, and how wide it is allowed to be.
//
// WHY THIS IS ITS OWN MODULE: this maths lived inline in DesignGlossy's drawWaterLeaderLabels,
// tangled with canvas calls, so it could not be tested — and it was wrong in a way nobody could
// see without rendering at an unusual size. It is the third label system in this codebase
// (lib/producer-labels.ts for plan sheets, lib/canvas-labels.ts for the interactive canvas), so
// it is at least named and checkable now.
//
// THE BUG IT WAS EXTRACTED TO FIX:
//
//   const textW = Math.min(W * 0.24, ctx.measureText(text).width);
//   const x = side === 'left' ? Math.max(safe, box.x0 * W - gap - textW) : ...
//   drawReferenceMapText(ctx, text, x, ...)      // <- drawn at its REAL width
//
// The cap constrained the number used to POSITION the label, and did nothing at all to the text
// actually painted. So whenever a name measured wider than 24% of the canvas, the label was placed
// as though it were narrower and then drawn past the sheet edge — "GREYWATER DIVERTER & FILTER ×3"
// is the worst case at 30 characters. It never showed up in review because the sheets that get
// looked at are rendered wide; it appears as the canvas narrows. The label size therefore has to
// follow the map width until it reaches the explicit printed-legibility floor below.
//
// It also cannot be reasoned about from the font stack: REFERENCE_LABEL_FONT asks for three
// condensed faces and then falls back to plain `sans-serif`, which is ~30% wider per character. A
// device missing all three silently gets the wide one. That is why this takes a `measure` callback
// and trusts it, rather than estimating from character counts.

export type LeaderSide = 'left' | 'right';

export interface LeaderLabelPlacement {
  /** Left edge of the text, in canvas pixels. */
  x: number;
  /** Font size to draw at — reduced from the requested size only if the text would not fit. */
  fontSize: number;
  /** Width the text will actually occupy at `fontSize`. */
  textW: number;
  /** True when the label had to be shrunk to stay on the sheet. Callers may want to know. */
  shrunk: boolean;
}

export interface LeaderLabelInput {
  text: string;
  side: LeaderSide;
  /** Canvas width in pixels. */
  W: number;
  /** Property bounding box, as fractions of W. Callouts sit outside it, in the margin. */
  plotX0: number;
  plotX1: number;
  /** Preferred size. Reduced only when the text will not otherwise fit. */
  fontSize: number;
  /** Real text width at a given size — pass ctx.measureText, never an estimate. */
  measure: (text: string, fontSize: number) => number;
}

/** Keeps callouts clear of the sheet edge and the deterministic scale bar. */
export const SAFE_INSET_RATIO = 0.022;
/** Space between the property edge and the start of the callout text. */
export const LABEL_GAP_RATIO = 0.025;
/**
 * Smallest size a callout may shrink to.
 *
 * Below this a name on a printed plan is not readable at arm's length, and a label nobody can read
 * is worse than one that is obviously clipped — it looks fine and says nothing. If the text still
 * does not fit at this size the caller gets `shrunk: true` with the text overflowing, which is a
 * visible failure rather than a silent one.
 */
export const MIN_FONT_SIZE = 12;

/**
 * A callout may never shrink below this fraction of the sheet's own callout size.
 *
 * MIN_FONT_SIZE alone is an absolute floor, and on a 2517px sheet the base size is 50px — so a name
 * that did not fit its margin was allowed to fall all the way to 12px, a quarter the size of its
 * neighbours. Rendered water sheet 04 of the Ubhejane demo showed exactly that: "SWALE" full size,
 * "GREYWATER LINE" middling, "JOJO TANK 2500L" a barely-legible scratch — three sizes on one sheet,
 * which reads as a broken page rather than a designed one.
 *
 * The margins got tight when sheets started following the traced boundary (v57): the plot now fills
 * the frame, so a side margin can be ~70px on a sheet whose callouts want 380px. Shrinking to fit
 * that is not a solution, it is just a quieter failure.
 *
 * So the label stops shrinking here and is allowed to overrun its margin onto the map instead. That
 * is safe: `placeLeaderLabel` already clamps x to the safe inset so nothing leaves the sheet, and
 * drawReferenceMapText paints a dark halo under every glyph, which is what keeps the full-size
 * "SWALE" readable where it already crosses the map today.
 */
export const MIN_RELATIVE_SIZE = 0.72;

/** The smallest this particular sheet's callouts may become — never a quarter of their neighbours. */
export function minSizeFor(requestedFontSize: number): number {
  return Math.max(MIN_FONT_SIZE, Math.round(requestedFontSize * MIN_RELATIVE_SIZE));
}

/**
 * Preferred map-callout size before a particular long name is shrunk to fit its margin.
 *
 * A bitmap-pixel floor cannot protect a phone preview: the browser scales the whole sheet, floor
 * and all. It only made the same 19px label occupy wildly different shares of a 784px tall-plot
 * map and a 2404px wide-plot map. Width-relative type keeps that hierarchy stable; MIN_FONT_SIZE
 * remains the honest print-legibility stop for the narrowest map.
 */
export function leaderLabelFontSize(mapWidth: number): number {
  const safeWidth = Number.isFinite(mapWidth) && mapWidth > 0 ? mapWidth : 0;
  return Math.max(MIN_FONT_SIZE, Math.round(safeWidth * LABEL_SHARE_OF_MAP_WIDTH));
}

/**
 * Two percent of the map's width — measured off a real render, not chosen by feel.
 *
 * Making the type width-relative was right; carrying 0.011 across with it was not. That coefficient
 * came from `Math.max(19, W * 0.011)`, where at every realistic sheet width the 19 won — so the
 * fraction had never actually been exercised and nobody had cause to notice it was small. Dropping
 * the floor to MIN_FONT_SIZE exposed it, and made these labels SMALLER: on the 1480px-wide map of
 * Rory's Extension Blueprint water sheet, 19px would have become 16px.
 *
 * The reference is the same design rendered under Satellite Overlay, where the model sizes the
 * labels itself and they read cleanly at arm's length — those sit at roughly 2% of map width. The
 * app-drawn ones were at 1.1–1.3%, which is most of why one sheet looked authored and the other
 * looked like a draft.
 *
 * Long names still shrink to fit their own margin (placeLeaderLabel), so a larger base size costs
 * nothing on a crowded sheet — it only stops an uncrowded one being timid.
 */
const LABEL_SHARE_OF_MAP_WIDTH = 0.02;

/**
 * Place one margin callout so that it is fully on the sheet.
 *
 * The available width is the real margin — sheet edge to property edge, less the safe inset and
 * the gap — not a fixed fraction of the canvas. A fixed fraction is what broke: it does not know
 * how much room there actually is on this particular sheet.
 */
export function placeLeaderLabel(input: LeaderLabelInput): LeaderLabelPlacement {
  const { text, side, measure } = input;
  const W = Number.isFinite(input.W) && input.W > 0 ? input.W : 1;
  const plotX0 = Number.isFinite(input.plotX0) ? Math.max(0, Math.min(1, input.plotX0)) : 0;
  const plotX1 = Number.isFinite(input.plotX1) ? Math.max(0, Math.min(1, input.plotX1)) : 1;
  const safe = Math.round(W * SAFE_INSET_RATIO);
  const gap = Math.round(W * LABEL_GAP_RATIO);

  const available = side === 'left'
    ? Math.round(plotX0 * W) - gap - safe
    : W - safe - (Math.round(plotX1 * W) + gap);

  let fontSize = Number.isFinite(input.fontSize)
    ? Math.max(MIN_FONT_SIZE, input.fontSize)
    : MIN_FONT_SIZE;
  const measuredWidth = (size: number) => {
    const width = measure(text, size);
    return Number.isFinite(width) && width >= 0 ? width : 0;
  };
  let textW = measuredWidth(fontSize);
  // Shrink to fit rather than clip. A name is the whole point of a callout, so losing its tail is
  // losing the information; losing a couple of points of size is not. But only down to
  // minSizeFor() — past that the label stops shrinking and overruns onto the map, because a sheet
  // whose callouts are four different sizes reads worse than one whose longest name crosses the
  // plot edge. See MIN_RELATIVE_SIZE.
  const floor = minSizeFor(input.fontSize);
  while (textW > available && fontSize > floor) {
    fontSize -= 1;
    textW = measuredWidth(fontSize);
  }
  const shrunk = fontSize < input.fontSize;

  const x = side === 'left'
    ? Math.max(safe, Math.round(plotX0 * W) - gap - textW)
    : Math.min(W - safe - textW, Math.round(plotX1 * W) + gap);

  return { x, fontSize, textW, shrunk };
}

/** One leader, as the three points it is stroked through: element → elbow → label. */
export interface LeaderPath {
  from: [number, number];
  elbow: [number, number];
  to: [number, number];
}

/**
 * The polyline joining an element to its callout.
 *
 * THE RULE, AND WHY IT IS A RULE: the long horizontal run follows the LABEL's row, never the
 * element's. Label rows are de-collided by stackLeaderRows, so no two labels share a row and no two
 * long runs can coincide. Element positions have no such guarantee — nothing stops two icons being
 * a few pixels apart in y.
 *
 * Both leader drawers in DesignGlossy used to run the horizontal at the element's y and then cut a
 * diagonal to the label. On the Ubhejane demo the JoJo tank (y≈239) and the compost bay (y≈245) are
 * six pixels apart and both on the left, so their two runs overlapped into what reads as a single
 * unbroken line from "JOJO TANK 2500L" clear across the sheet to the compost bay. The data was
 * right and the page was wrong, which is the worst combination — nothing in a test or a diff could
 * see it, and a farmer reading that sheet stands the wrong thing on the wrong base.
 *
 * Keeping the long run on `labelY` means what leaves each element is a short diagonal at its own
 * angle, which also reads better: the eye follows the slope back to its own icon.
 */
export function leaderPath(
  element: [number, number],
  elbowX: number,
  leaderEndX: number,
  labelY: number,
): LeaderPath {
  return { from: element, elbow: [elbowX, labelY], to: [leaderEndX, labelY] };
}

/**
 * Stack callouts down one margin without overlapping, keeping each near its own feature.
 *
 * Extracted unchanged in behaviour from drawWaterLeaderLabels except for the final clamp. Each
 * label starts at its feature's average y, is pushed down past the one above it, and the whole
 * column is shifted up if it runs past the bottom.
 *
 * THE CLAMP IS NEW. The original shifted the column up by the overflow and stopped there, so a
 * side with more labels than fit produced negative positions — callouts drawn off the top of the
 * sheet, gone rather than crowded. It needs enough labels to trigger that the water sheet has
 * probably never hit it, but "probably never" is not a thing to leave in a renderer.
 */
export function stackLeaderRows(naturalY: number[], top: number, bottom: number, rowGap: number): number[] {
  if (naturalY.length === 0) return [];
  const safeTop = Number.isFinite(top) ? top : 0;
  const safeBottom = Number.isFinite(bottom) ? Math.max(safeTop, bottom) : safeTop;
  const safeGap = Number.isFinite(rowGap) && rowGap >= 0 ? rowGap : 0;
  const rows = naturalY.map((y, i) => {
    const safeY = Number.isFinite(y) ? y : safeTop;
    return Math.max(safeTop + i * safeGap, Math.min(safeBottom, safeY));
  });
  for (let i = 1; i < rows.length; i++) rows[i] = Math.max(rows[i], rows[i - 1] + safeGap);

  const overflow = rows[rows.length - 1] - safeBottom;
  if (overflow > 0) for (let i = 0; i < rows.length; i++) rows[i] -= overflow;

  // If there are more labels than the column can hold, shifting up put the first ones above the
  // sheet. Pin the top and let the tail crowd instead: a crowded column is legible-ish and a label
  // at y = -40 is simply not there.
  if (rows[0] < safeTop) {
    const lift = safeTop - rows[0];
    for (let i = 0; i < rows.length; i++) rows[i] += lift;
  }
  return rows;
}
