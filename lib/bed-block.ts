// Lay out a BLOCK of parallel growing beds in one action, instead of placing and nudging each
// bed by hand (Rory: "i also need a way to insert multiple beds - we set the bed length the bed
// width the path width etc and then we can have it hanging on our mouse ... and then i set it on
// a corner and pivot into place"). Seven beds used to mean seven placements and seven alignment
// drags; this makes it one anchor tap and one pivot.
//
// Pure geometry, deliberately: the canvas owns the gesture, this owns the maths. That keeps the
// part that is easy to get subtly wrong — metres-to-pixels, the rotation convention, where the
// anchor sits relative to the first bed — under unit test rather than under a pointer event.
//
// CONVENTIONS, all three of which are easy to get backwards:
//  - The anchor is the block's CORNER, not its centre. That is what the farmer taps: they stand
//    at a corner of the plot and lay the block out from it.
//  - `angleDeg` is the direction the bed LENGTH runs, clockwise from east, in the same y-DOWN
//    screen space the canvas uses. The pivot gesture produces exactly this (anchor → pointer).
//  - A bed element's natural footprint is wM ACROSS by hM ALONG (veg_bed is 1.2 x 3 — the long
//    side is hM), so at rot 0 a bed's length already runs down the screen, i.e. at 90 degrees.
//    The emitted `rot` is therefore angleDeg - 90, not angleDeg.

import { normaliseRotation } from './design-canvas';

export interface BedBlockSpec {
  /** The long side of each bed, in metres. */
  bedLengthM: number;
  /** The short side of each bed, in metres — how far you can reach in from a path. */
  bedWidthM: number;
  /** Gap between neighbouring beds, in metres. 0 is legal: it means one continuous wide bed. */
  pathWidthM: number;
  /** How many beds in the block. */
  count: number;
}

export interface BedBlockPlacement {
  /** Normalised [0..1] centre of this bed in the frame. */
  x: number;
  y: number;
  /** Footprint in metres, in the element's own w-across / h-along convention. */
  wM: number;
  hM: number;
  /** Clockwise degrees, ready to write straight onto PlacedItem.rot — including being
   *  `undefined` at natural orientation, which is how this codebase keeps a meaningless
   *  `rot: 0` out of every persisted item (see normaliseRotation). */
  rot?: number;
}

/** Beds per block. The ceiling is a runaway guard, not a design opinion — a slip in a number
 *  field should not be able to commit ten thousand items in one undo entry. */
export const MIN_BED_COUNT = 1;
export const MAX_BED_COUNT = 60;
/** Metre bounds for each dimension. The floor keeps a bed from collapsing to an untappable
 *  sliver; the ceiling is well past any real market-garden bed. Paths may be 0 (touching beds). */
export const MIN_BED_DIM_M = 0.2;
export const MAX_BED_DIM_M = 200;
export const MAX_PATH_M = 50;

const clampNum = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Coerce whatever came out of a number input into a spec that cannot produce broken geometry.
 *  Non-finite values fall back to the defaults rather than propagating NaN into coordinates,
 *  because a NaN centre renders as nothing at all and reads as "the button did nothing". */
export function normaliseBedBlockSpec(spec: Partial<BedBlockSpec>): BedBlockSpec {
  const num = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return {
    bedLengthM: clampNum(num(spec.bedLengthM, 3), MIN_BED_DIM_M, MAX_BED_DIM_M),
    bedWidthM: clampNum(num(spec.bedWidthM, 1.2), MIN_BED_DIM_M, MAX_BED_DIM_M),
    pathWidthM: clampNum(num(spec.pathWidthM, 0.5), 0, MAX_PATH_M),
    count: Math.round(clampNum(num(spec.count, 4), MIN_BED_COUNT, MAX_BED_COUNT)),
  };
}

/**
 * Place `count` parallel beds running out from `anchor`.
 *
 * Bed 1's near corner sits ON the anchor; each later bed steps sideways by one bed width plus
 * one path. Nothing is clamped to the frame — a farmer aiming a block off the edge should see
 * it hang off the edge in the ghost and re-aim, rather than have beds silently pile up against
 * an invisible wall.
 */
export function layoutBedBlock(
  spec: BedBlockSpec,
  anchor: [number, number],
  angleDeg: number,
  mPerPx: number,
  imgW: number,
  imgH: number,
): BedBlockPlacement[] {
  const s = normaliseBedBlockSpec(spec);
  // A zero/negative/NaN scale would make every bed infinitely large or land at NaN. There is no
  // sensible block to draw without a real ground scale, so draw none.
  if (!Number.isFinite(mPerPx) || mPerPx <= 0) return [];
  if (!Number.isFinite(imgW) || !Number.isFinite(imgH) || imgW <= 0 || imgH <= 0) return [];
  if (!Number.isFinite(anchor[0]) || !Number.isFinite(anchor[1])) return [];
  const angle = Number.isFinite(angleDeg) ? angleDeg : 0;

  const pxPerM = 1 / mPerPx;
  const rad = (angle * Math.PI) / 180;
  // Along the bed's length, and 90 degrees clockwise from it (y-down, so +90 is (-sin, cos)).
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad);

  // Work in PIXELS, not normalised units: x and y normalise by different divisors (imgW vs imgH),
  // so rotating in normalised space would shear every bed whenever the frame is not square.
  const ax = anchor[0] * imgW;
  const ay = anchor[1] * imgH;
  const lengthPx = s.bedLengthM * pxPerM;
  const widthPx = s.bedWidthM * pxPerM;
  const pathPx = s.pathWidthM * pxPerM;
  const rot = normaliseRotation(angle - 90);

  const out: BedBlockPlacement[] = [];
  for (let i = 0; i < s.count; i++) {
    const along = lengthPx / 2;
    const across = widthPx / 2 + i * (widthPx + pathPx);
    const cx = ax + ux * along + vx * across;
    const cy = ay + uy * along + vy * across;
    out.push({
      x: cx / imgW,
      y: cy / imgH,
      wM: s.bedWidthM,
      hM: s.bedLengthM,
      rot,
    });
  }
  return out;
}

/** Total ground the block occupies, for the "12.4 m × 8.6 m" readout on the placement hint —
 *  a farmer aiming a block wants to know whether it fits before committing, not after. */
export function bedBlockFootprintM(spec: BedBlockSpec): { alongM: number; acrossM: number } {
  const s = normaliseBedBlockSpec(spec);
  return {
    alongM: s.bedLengthM,
    // n beds have n-1 paths BETWEEN them; counting n paths would overstate the block by one
    // path and quietly make every "will it fit" answer wrong in the farmer's favour.
    acrossM: s.count * s.bedWidthM + Math.max(0, s.count - 1) * s.pathWidthM,
  };
}
