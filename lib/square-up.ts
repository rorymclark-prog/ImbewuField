// SQUARING A TRACED OUTLINE — the second half of Tidy.
//
// Rory: "i think tidy option should also work on making something square — it's difficult to get
// things square or rectangular by inserting points."
//
// He is right that it is difficult, and it is difficult for a reason no amount of care fixes: a
// slab, a shed and a fenced field are rectangular ON THE GROUND, but you trace them by putting a
// fingertip on four spots of a photograph. A finger is about a metre wide at working zoom, so the
// corners land a metre out and the walls come back at 87° and 93°. Nudging the points afterwards
// makes one corner right and the opposite one wrong, forever.
//
// So this does what the farmer was aiming at rather than what their finger achieved: it reads the
// outline's DOMINANT DIRECTION, snaps every edge to that direction or square to it, and rebuilds
// the corners where the straightened walls cross. An L-shaped building stays L-shaped; a
// rectangle becomes a true rectangle.
//
// WHAT IT MUST NEVER DO — and this is why it is not simply "fit a rectangle":
//
//  - It must never square a shape that was never meant to be square. A swale follows a contour and
//    a food forest follows a canopy; turning either into a polygon of right angles would destroy
//    real information the farmer traced deliberately. So it only acts when the outline is ALREADY
//    NEARLY RECTILINEAR (see RECTILINEAR_TOLERANCE_DEG) and refuses, untouched, otherwise. This is
//    "snap what was meant to be square", never "make everything square".
//  - It must never move a corner further than a farmer would accept without being told. Every
//    result carries maxMovedM, and a move beyond the tolerance discards the WHOLE thing and hands
//    back the original — the same guard-then-revert shape as lib/tidy-outline.ts and
//    lib/snap-edges.ts, which this file deliberately mirrors throughout.
//  - It must never change what is stored without the farmer confirming. Like its two siblings this
//    is pure geometry in, pure geometry out: no React, no undo, no persistence. The caller
//    previews the result and commits only on a tap.
//
// Metres, not normalised units, for every tolerance — for the reason given at length in
// snap-edges.ts: a normalised tolerance behaves completely differently on a 20 m plot and a 5 ha
// farm, and the farmer's judgement of "that's close enough" is in metres.

type Pt = [number, number];

export interface SquareUpFrame {
  imgW: number;
  imgH: number;
  /** Metres per logical pixel — see CanvasFrame in lib/design-canvas.ts. */
  mPerPx: number;
}

export interface SquareUpOptions {
  frame: SquareUpFrame;
  /** How far a corner may move before the whole result is discarded. */
  toleranceM?: number;
  /** How far off-square an edge may already be and still count as "meant to be square". */
  rectilinearToleranceDeg?: number;
}

export type SquareUpReason =
  | 'squared'
  | 'too_few_points' // fewer than 4 corners: nothing to square
  | 'not_rectilinear' // a curve, a contour, an organic boundary — deliberately left alone
  | 'already_square' // every edge is already within a whisker of the grid
  | 'movement_exceeded_tolerance' // squaring would drag a corner further than promised
  | 'degenerate'; // parallel walls that never cross, zero-length edges, NaN — refuse

export interface SquareUpResult {
  points: Pt[];
  changed: boolean;
  reason: SquareUpReason;
  /** Furthest any corner moved, in metres. 0 when unchanged. */
  maxMovedM: number;
  /** How far the worst edge was off square BEFORE, in degrees. Reported so the farmer can see
   *  what was wrong as well as what was done. */
  worstOffSquareDeg: number;
}

const DEFAULT_TOLERANCE_M = 1.5;
/**
 * 12° is the line between "aimed at square and missed" and "deliberately not square".
 *
 * A finger-traced rectangle at working zoom comes back with walls 3–8° out; a contour, a canopy
 * edge or a stream bank is nowhere near a right-angle grid. 12° admits the first and excludes the
 * second with room to spare. Set it much higher and Tidy starts flattening real curves, which is
 * the one failure that would make the button untrustworthy.
 */
const RECTILINEAR_TOLERANCE_DEG = 12;
/** Below this, the outline is square already and squaring it is a no-op that still costs an undo. */
const ALREADY_SQUARE_DEG = 0.75;
const EPS = 1e-12;

function toMetres(p: Pt, f: SquareUpFrame): Pt {
  return [p[0] * f.imgW * f.mPerPx, p[1] * f.imgH * f.mPerPx];
}
function toNormalised(p: Pt, f: SquareUpFrame): Pt {
  return [p[0] / (f.imgW * f.mPerPx), p[1] / (f.imgH * f.mPerPx)];
}

/**
 * Bearing of a wall, in [0, 180).
 *
 * Folded modulo 180, not 90. A wall and the wall opposite it are the same line direction, so 180
 * is the right fold — but 90 is NOT: folding to [0, 90) makes a wall and its own perpendicular
 * indistinguishable, and every rectangle then snaps all four sides onto one direction and
 * collapses. (It did, on the first run: four right angles came back as 'degenerate'.) The 90°
 * symmetry belongs to the GRID, not to an individual wall — see dominantBearingDeg, which folds
 * again on purpose.
 */
function bearingDeg(a: Pt, b: Pt): number | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (Math.hypot(dx, dy) < EPS) return null;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
}

/**
 * Signed angle from a wall to the nearest arm of the grid at `base`, in [-45, 45].
 *
 * The grid has arms at base, base+90, base+180… so this asks which arm is nearest and how far off
 * the wall is — which preserves WHICH of the two perpendicular directions the wall belongs to.
 */
function offsetFromGrid(bearing: number, base: number): number {
  const k = Math.round((bearing - base) / 90);
  return bearing - (base + k * 90);
}

/**
 * The direction the outline is really built on.
 *
 * Length-weighted on purpose: a building's two long walls say what the building's orientation is,
 * and a short jog between them should follow the walls rather than drag them. Taking the plain
 * average would let three stubby edges outvote the wall that defines the shape.
 *
 * Averaged as unit vectors at 4× the angle so that bearings either side of the 0/90 fold (89° and
 * 1°, which are 2° apart on a square grid) average to 0° rather than to 45°.
 */
function dominantBearingDeg(ring: Pt[]): number | null {
  let sx = 0;
  let sy = 0;
  let total = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const bearing = bearingDeg(a, b);
    if (bearing === null) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Folded to the grid's own 90° symmetry HERE, where it is correct: a wall and its
    // perpendicular do describe the same square grid.
    const rad = ((bearing % 90) * 4 * Math.PI) / 180;
    sx += Math.cos(rad) * len;
    sy += Math.sin(rad) * len;
    total += len;
  }
  if (total < EPS || Math.hypot(sx, sy) < EPS) return null;
  const mean = (Math.atan2(sy, sx) * 180) / Math.PI / 4;
  return ((mean % 90) + 90) % 90;
}

/** Where two infinite lines cross, or null when they are parallel. */
function intersect(p: Pt, dirP: Pt, q: Pt, dirQ: Pt): Pt | null {
  const den = dirP[0] * dirQ[1] - dirP[1] * dirQ[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q[0] - p[0]) * dirQ[1] - (q[1] - p[1]) * dirQ[0]) / den;
  return [p[0] + dirP[0] * t, p[1] + dirP[1] * t];
}

function midpoint(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function unchanged(points: Pt[], reason: SquareUpReason, worstOffSquareDeg = 0): SquareUpResult {
  return { points, changed: false, reason, maxMovedM: 0, worstOffSquareDeg };
}

/**
 * Straighten a nearly-rectilinear ring onto its own dominant grid.
 *
 * Returns the ORIGINAL array reference whenever it declines, so a caller can treat an unchanged
 * result as "offer nothing" without comparing coordinates.
 */
export function squareUp(points: Pt[], opts: SquareUpOptions): SquareUpResult {
  const { frame } = opts;
  const toleranceM = opts.toleranceM ?? DEFAULT_TOLERANCE_M;
  const rectTolDeg = opts.rectilinearToleranceDeg ?? RECTILINEAR_TOLERANCE_DEG;

  if (!Array.isArray(points) || points.length < 4) return unchanged(points, 'too_few_points');
  if (!Number.isFinite(frame.mPerPx) || frame.mPerPx <= 0) return unchanged(points, 'degenerate');
  if (points.some((p) => !Number.isFinite(p?.[0]) || !Number.isFinite(p?.[1]))) {
    return unchanged(points, 'degenerate');
  }

  const ring = points.map((p) => toMetres(p, frame));
  const base = dominantBearingDeg(ring);
  if (base === null) return unchanged(points, 'degenerate');

  // How far off the grid the worst wall is. This is the whole "was it meant to be square" test.
  let worst = 0;
  const bearings: Array<number | null> = [];
  for (let i = 0; i < ring.length; i += 1) {
    const bearing = bearingDeg(ring[i], ring[(i + 1) % ring.length]);
    bearings.push(bearing);
    if (bearing === null) continue;
    worst = Math.max(worst, Math.abs(offsetFromGrid(bearing, base)));
  }
  if (worst > rectTolDeg) return unchanged(points, 'not_rectilinear', worst);
  if (worst < ALREADY_SQUARE_DEG) return unchanged(points, 'already_square', worst);

  // Straighten each wall: keep it where it is (through its own midpoint, so it does not slide
  // sideways) and turn it onto the nearest grid direction.
  const lines: Array<{ through: Pt; dir: Pt } | null> = ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const bearing = bearings[i];
    if (bearing === null) return null;
    const snapped = bearing - offsetFromGrid(bearing, base);
    const rad = (snapped * Math.PI) / 180;
    return { through: midpoint(a, b), dir: [Math.cos(rad), Math.sin(rad)] as Pt };
  });
  if (lines.some((l) => l === null)) return unchanged(points, 'degenerate', worst);

  // Each corner is where its two walls now cross. Parallel neighbours (a straightened zig-zag that
  // collapsed onto one line) have no crossing — refuse rather than invent a corner.
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i += 1) {
    const prev = lines[(i - 1 + ring.length) % ring.length]!;
    const here = lines[i]!;
    const corner = intersect(prev.through, prev.dir, here.through, here.dir);
    if (!corner) return unchanged(points, 'degenerate', worst);
    out.push(corner);
  }

  let maxMovedM = 0;
  for (let i = 0; i < ring.length; i += 1) {
    maxMovedM = Math.max(maxMovedM, Math.hypot(out[i][0] - ring[i][0], out[i][1] - ring[i][1]));
  }
  if (!Number.isFinite(maxMovedM)) return unchanged(points, 'degenerate', worst);
  if (maxMovedM > toleranceM) return unchanged(points, 'movement_exceeded_tolerance', worst);

  const normalised = out.map((p) => toNormalised(p, frame));
  // A corner pushed outside the frame is a straightening that ran away; the frame is the whole
  // world this design lives in, so there is no honest way to keep it.
  if (normalised.some(([x, y]) => x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02)) {
    return unchanged(points, 'degenerate', worst);
  }

  return { points: normalised, changed: true, reason: 'squared', maxMovedM, worstOffSquareDeg: worst };
}

/** One line a farmer can read before deciding. Mirrors tidyOutlineSummary's voice. */
export function squareUpSummary(result: SquareUpResult): string {
  switch (result.reason) {
    case 'squared':
      return `Squares the corners — the worst wall was ${result.worstOffSquareDeg.toFixed(0)}° out. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`;
    case 'already_square':
      return 'Already square.';
    case 'not_rectilinear':
      return `Left as drawn — this shape is ${result.worstOffSquareDeg.toFixed(0)}° off square, so it was not meant to be a rectangle.`;
    case 'too_few_points':
      return 'Needs at least four corners to square.';
    case 'movement_exceeded_tolerance':
      return 'Left as drawn — squaring it would move a corner too far.';
    case 'degenerate':
    default:
      return 'Left as drawn — this outline cannot be squared safely.';
  }
}
