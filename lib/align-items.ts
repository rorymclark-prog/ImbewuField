// Farmer-invoked, explicitly previewed "clean up" for a MULTI-SELECTION of placed items — the
// third sibling of lib/tidy-outline.ts (drops points off one shape) and lib/snap-edges.ts (moves
// one zone's points onto a neighbour). Same author, same problem class, same discipline: pure
// geometry in, pure geometry out, tolerance in real METRES, and every hard invariant enforced
// AND defended by reverting the WHOLE batch untouched with a plain reason rather than silently
// doing part of the job. This file itself renders nothing and knows nothing about React, undo,
// or Firestore — the two callers are app/design/page.tsx's onCleanupSelected and
// components/design/DesignPalette.tsx's Clean up button, exactly like Tidy/Snap.
//
// Rory, after using the app on a real farm, taps out a row of beds by finger and gets slightly
// different angles and uneven spacing: "is there a way to snap these into alignment not 90deg
// but to find the avg angle for example and average the distance ... then press snap and it all
// cleans up ... like a Canva tool". This is that tool, scoped to a GROUP the farmer explicitly
// multi-selected (never automatic — see the module docs on tidy-outline.ts/snap-edges.ts for why
// this app deliberately has no automatic geometry cleanup at all).
//
// Three independently switchable steps, always in this order:
//   1. AVERAGE ANGLE — every RECT-shaped item (see PlacedItem.rot / DesignElementDef.shape in
//      lib/design-canvas.ts and lib/design-elements.ts) is rotated to the CIRCULAR mean of the
//      group's current angles. Circles are rotation-invariant (PlacedItem.rot doc comment) and
//      are never touched by this step, or any step — see PRESERVE_CIRCLE_ROTATION below.
//   2. ALIGN TO LINE — every item's centre is projected onto the group's own best-fit (principal
//      axis / least-squares) line through the centres, computed in METRES so an oblong frame
//      (imgW !== imgH) can't skew the fit.
//   3. EVEN SPACING — items are redistributed at equal spacing ALONG that line between the two
//      OUTERMOST centres (by original position along the line) — the group's own footprint, never
//      re-centred to some other reference point.
//
// Like lib/marquee.ts's clampGroupDelta (the rigid-group precedent this mirrors in spirit, not
// mechanism — clampGroupDelta clamps a shared DELTA so a drag never breaks the group's relative
// arrangement; this file computes each item's new ABSOLUTE position from one shared fitted line
// so the row stays a rigid, coherent row), the group is treated as ONE geometric object: there is
// no per-item independent decision here, only per-item invariant CHECKS that can revert the
// whole batch.

type Pt = [number, number];

export interface AlignItemsFrame {
  imgW: number;
  imgH: number;
  mPerPx: number; // metres per logical pixel — see lib/design-canvas.ts's CanvasFrame
}

// The minimal per-item contract this file needs — deliberately NOT lib/design-canvas.ts's
// PlacedItem itself, so this module stays self-contained (same practice lib/snap-edges.ts follows
// for SnapRingKind) and so its return type can never accidentally carry wM/hM/defId/label along
// for the ride. `shape` is the caller's own ELEMENTS_BY_ID[defId].shape lookup (see
// app/design/page.tsx's angleControl for the existing call site of that exact lookup) — this file
// has no catalog of its own and trusts the caller's classification.
export interface AlignInputItem {
  id: string;
  x: number;
  y: number; // normalised [0..1] CENTRE — same convention as PlacedItem.x/y
  rot?: number; // clockwise degrees, undefined === 0 — same convention as PlacedItem.rot
  shape: 'rect' | 'circle'; // rect-shaped items may be rotated by step 1; circles never are
}

export interface AlignItemsOptions {
  frame: AlignItemsFrame;
  alignAngle?: boolean; // default true — step 1
  alignToLine?: boolean; // default true — step 2
  evenSpacing?: boolean; // default true — step 3
  // Max distance, in METRES, any item's centre may move. Default 2m — DELIBERATELY 4x
  // lib/snap-edges.ts's 0.5m default. Snap nudges one shape's own corners onto an already-drawn
  // neighbour a few tens of centimetres away; Clean up can rebuild an entire row's spacing from
  // scratch, which is a bigger, more deliberate action a farmer reaches for on purpose after
  // looking at the whole group, not a small correction — see maxRotateDeg below for the same
  // reasoning applied to rotation.
  maxMoveM?: number;
  // Max rotation, in DEGREES, any rect item's angle may change — measured as the shortest
  // distance in the FOLDED 180° space (see foldedAngleDelta), so a rect at 10° moving to a target
  // near 190° counts as ~0° of visual change, not 180°. Default 30°: a genuinely diagonal bed in
  // an otherwise-straight row is very likely intentional (a farmer following a slope or a fence
  // line at an angle), not a mistake this tool should "correct" by force-averaging it away — see
  // the revert-everything behaviour below rather than silently excluding the outlier.
  maxRotateDeg?: number;
}

export type AlignItemsReason =
  | 'aligned' // success — the full pipeline (whichever steps were enabled) changed something
  | 'angle_only' // exactly 2 items: only the angle step ran and changed something. Two points
  // trivially define a line (nothing to "fit") and there is nothing between them to
  // "redistribute", so align-to-line/even-spacing are skipped honestly rather than run as a
  // no-op that LOOKS like they did something.
  | 'already_aligned' // the pipeline ran (or every step was switched off) but found nothing worth
  // changing — mirrors lib/tidy-outline.ts's 'already_tidy'.
  | 'too_few_items' // fewer than 2 items — nothing to align
  | 'invalid_frame' // frame.imgW/imgH/mPerPx are not usable for a metres conversion
  | 'movement_exceeded' // a centre would move farther than maxMoveM — reverts ALL items untouched
  | 'rotation_exceeded' // a rect item would rotate farther than maxRotateDeg — reverts ALL items
  | 'would_leave_frame'; // defensive: a resulting centre would land outside [0,1] — reverts ALL

export interface AlignedItem {
  id: string;
  x: number;
  y: number;
  rot?: number;
}

export interface AlignItemsResult {
  // Position + rotation ONLY, one entry per input item, SAME ids/order/length as input — a
  // caller merges these back onto its own richer objects (`{ ...item, x, y, rot }`, exactly the
  // pattern app/design/page.tsx's onConfirmTidy/onConfirmSnap already use for zones/lines) so
  // wM/hM/defId/label are NEVER even passed through this file, let alone changed by it.
  items: AlignedItem[];
  movedCount: number; // how many items' centres actually moved
  maxMovedM: number; // largest single-item movement, in METRES — the honest number to show
  rotatedCount: number; // how many rect items actually rotated (circles are never in this count)
  // The folded [0,180) angle every rect item was (or would be) rotated to — present whenever the
  // angle step ran against at least one rect item, regardless of whether any of them actually
  // needed to move (a row already sitting at the average still reports it). undefined when there
  // were no rect items to average, or alignAngle was switched off. Preview copy
  // (alignAndDistributeSummary) uses this ONLY to phrase the rotation half of the sentence,
  // honestly omitting it rather than inventing a number nothing was measured against.
  angleDeg?: number;
  changed: boolean; // mirrors TidyOutlineResult/SnapEdgesResult — true only for 'aligned'/'angle_only'
  reason: AlignItemsReason;
}

const DEFAULT_MAX_MOVE_M = 2;
const DEFAULT_MAX_ROTATE_DEG = 30;
const EPS = 1e-9;
// Below these, a computed change is float noise from the metres round-trip / trig, not a real
// farmer-visible move or rotation — same "basically unchanged" role tidyOutline's EPS_M plays.
const MOVE_EPS_M = 1e-6;
const ROTATE_EPS_DEG = 1e-6;
// A tiny METRES tolerance for the would_leave_frame check ONLY — not a physical safety margin
// (maxMoveM is that), just enough to absorb the float residue the trig-heavy line fit
// (atan2/cos/sin, then reconstructing each point from its own projected scalar and the shared
// unit direction vector) legitimately leaves on a point that starts sitting exactly on the frame
// edge, without EVER treating a genuine escape as noise. 1mm: far below anything a farmer could
// physically place or notice, and several orders of magnitude under maxMoveM's 2m default. Found
// empirically: a row of items with one item at exactly x=0 was reverted with 'would_leave_frame'
// over a computed overshoot of ~0.3mm — legitimate "align to line" geometry, not a real escape —
// because the check compared against the file's general-purpose EPS (1e-9, sized for exact
// structural comparisons elsewhere, not for this trig-heavy round-trip). would_leave_frame is
// checked in METRES (against frame.imgW/imgH*mPerPx) rather than normalised [0,1] units for the
// same reason every other tolerance in this file is metres-denominated: a fixed normalised EPS
// would be a wildly different real-world size depending on the frame's own scale.
const FRAME_EPS_M = 1e-3;

export const ALIGN_ITEMS_DEFAULTS = {
  maxMoveM: DEFAULT_MAX_MOVE_M,
  maxRotateDeg: DEFAULT_MAX_ROTATE_DEG,
} as const;

function unchanged(items: AlignInputItem[], reason: AlignItemsReason): AlignItemsResult {
  return {
    items: items.map((it) => ({ id: it.id, x: it.x, y: it.y, rot: it.rot })),
    movedCount: 0,
    maxMovedM: 0,
    rotatedCount: 0,
    changed: false,
    reason,
  };
}

// ── metre-space <-> normalised [0..1] conversion (verbatim convention from lib/tidy-outline.ts
// and lib/snap-edges.ts) ─────────────────────────────────────────────────────────────────────────

function toMetres(p: Pt, f: AlignItemsFrame): Pt {
  return [p[0] * f.imgW * f.mPerPx, p[1] * f.imgH * f.mPerPx];
}

function fromMetres(p: Pt, f: AlignItemsFrame): Pt {
  return [p[0] / (f.imgW * f.mPerPx), p[1] / (f.imgH * f.mPerPx)];
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

// ── angle folding + circular mean ───────────────────────────────────────────────────────────────

// Folds ANY degree value into [0, 180). A rectangle's footprint is 180°-symmetric — a bed stored
// at rot=10 and one stored at rot=190 occupy the exact same physical rectangle (rotating any
// rect 180° about its own centre maps it onto itself) — so 10 and 190 must be treated as the SAME
// orientation for averaging purposes, not as two values 180° apart.
function fold180(deg: number): number {
  return ((deg % 180) + 180) % 180;
}

// Circular mean of a set of AXIAL (180°-periodic) angles — NOT an arithmetic mean, and NOT a
// plain 360°-periodic circular mean either. Two failure modes this specifically avoids:
//   - Arithmetic mean of 350° and 10° gives 180° (exactly backwards — both are near 0°/360°).
//   - Arithmetic mean of 10° and 190° (two rects at the SAME visual angle, per fold180 above)
//     gives 100° — a completely different orientation from either input.
// The fix for both is the standard "doubling" trick for axial data: fold into [0,180), double
// (mapping the 180°-periodic domain onto a full 360° circle so a proper circular mean applies),
// average as unit vectors, then halve and re-fold. Falls back to the plain arithmetic mean of the
// folded angles on the (rare) degenerate case where the averaged vector has ~zero magnitude — e.g.
// two angles exactly 90° apart in the folded space have no well-defined "mean direction" — rather
// than propagating whatever Math.atan2(0, 0) happens to return.
function circularMeanFold180(anglesDeg: number[]): number {
  let sx = 0;
  let sy = 0;
  for (const a of anglesDeg) {
    const doubledRad = (fold180(a) * 2 * Math.PI) / 180;
    sx += Math.cos(doubledRad);
    sy += Math.sin(doubledRad);
  }
  const mag = Math.hypot(sx, sy);
  if (mag < EPS) {
    const arithMean = anglesDeg.reduce((s, a) => s + fold180(a), 0) / anglesDeg.length;
    return fold180(arithMean);
  }
  const meanDoubledDeg = (Math.atan2(sy, sx) * 180) / Math.PI; // (-180, 180]
  // Round to a precision far finer than anything ever stored (normaliseForOutput rounds to whole
  // degrees) before folding. Without this, an EXACT mathematical cancellation — e.g. averaging
  // 350° and 10°, which is precisely 0° once folded and doubled — can leave a sub-nanodegree
  // floating-point residue on the negative side (sin(340°) and sin(20°) aren't bitwise negatives
  // of each other), and fold180's modulo would wrap that all the way round to ~180° instead of
  // ~0°: the right answer, represented as the wrong number. A genuinely non-zero tiny angle (not
  // just float noise) is many orders of magnitude larger than this grain and is unaffected.
  const meanAngle = Math.round((meanDoubledDeg / 2) * 1e9) / 1e9;
  return fold180(meanAngle); // halve back into the un-doubled domain, then re-fold
}

// Shortest distance between two angles IN THE FOLDED 180° SPACE — i.e. how far a rect must
// actually visually rotate to go from `a` to `b`, correctly reporting ~0° for e.g. 10° -> 190°
// (the same physical orientation) rather than 180°. Range [0, 90]. This is what maxRotateDeg is
// checked against, not a raw |a - b|.
function foldedAngleDelta(a: number, b: number): number {
  const d = Math.abs(fold180(a) - fold180(b));
  return Math.min(d, 180 - d);
}

// Mirrors lib/design-canvas.ts's normaliseRotation exactly (0° stored as undefined) — PlacedItem
// already treats "no rot field" as "0°, natural orientation" everywhere else in the app, and this
// file must not invent a second convention for the same field. Rounds to the nearest whole degree
// for the same reason normaliseRotation does: every other way of writing PlacedItem.rot (the drag
// handle, the palette's Angle field) commits a whole-degree value.
function normaliseForOutput(deg: number): number | undefined {
  const wrapped = ((Math.round(deg) % 360) + 360) % 360;
  return wrapped === 0 ? undefined : wrapped;
}

// ── best-fit line through a set of centres (principal axis / least-squares) ───────────────────

// Fits the line that minimises total perpendicular distance to `pointsM` (all in METRES), via the
// covariance matrix's principal eigenvector — NOT a naive y = mx + c regression, which divides by
// zero (or blows up numerically) on a vertical row. atan2 over (2*Sxy, Sxx-Syy) handles every
// orientation, including perfectly vertical (Sxy=0, Sxx=0 -> atan2(0, -Syy) = π -> a vertical
// direction vector), uniformly.
function fitPrincipalAxis(pointsM: Pt[]): { originM: Pt; dir: Pt } {
  const n = pointsM.length;
  let mx = 0;
  let my = 0;
  for (const [x, y] of pointsM) {
    mx += x;
    my += y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const [x, y] of pointsM) {
    const dx = x - mx;
    const dy = y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { originM: [mx, my], dir: [Math.cos(theta), Math.sin(theta)] };
}

// ── 2-item special case ─────────────────────────────────────────────────────────────────────────

function applyAngleOnly(items: AlignInputItem[], alignAngle: boolean, maxRotateDeg: number): AlignItemsResult {
  const rectIdx = items.reduce<number[]>((acc, it, i) => (it.shape === 'rect' ? [...acc, i] : acc), []);
  if (!alignAngle || rectIdx.length === 0) return unchanged(items, 'already_aligned');

  const angleDeg = circularMeanFold180(rectIdx.map((i) => items[i].rot ?? 0));
  for (const i of rectIdx) {
    if (foldedAngleDelta(items[i].rot ?? 0, angleDeg) > maxRotateDeg + EPS) {
      return unchanged(items, 'rotation_exceeded');
    }
  }

  let rotatedCount = 0;
  const outItems: AlignedItem[] = items.map((it) => {
    if (it.shape !== 'rect') return { id: it.id, x: it.x, y: it.y, rot: it.rot }; // PRESERVE_CIRCLE_ROTATION
    const rot = normaliseForOutput(angleDeg);
    if (foldedAngleDelta(it.rot ?? 0, rot ?? 0) > ROTATE_EPS_DEG) rotatedCount++;
    return { id: it.id, x: it.x, y: it.y, rot };
  });

  if (rotatedCount === 0) return unchanged(items, 'already_aligned');
  return { items: outItems, movedCount: 0, maxMovedM: 0, rotatedCount, angleDeg, changed: true, reason: 'angle_only' };
}

// ── entry point ────────────────────────────────────────────────────────────────────────────────

/**
 * Straightens and evenly spaces a farmer's multi-selected group of placed items — Canva/Figma's
 * "align + distribute", scoped to exactly the group the farmer selected. Never mutates its input,
 * never touches wM/hM/defId/label/id (the return type physically cannot carry them), and never
 * rotates a circle-shaped item (PRESERVE_CIRCLE_ROTATION: circles are rotation-invariant footprints
 * — see PlacedItem.rot's doc comment in lib/design-canvas.ts — so this function's rotation step
 * simply never visits them, by construction, not by a runtime check that could be forgotten).
 *
 * Safe by construction AND by a defensive post-check, mirroring lib/tidy-outline.ts and
 * lib/snap-edges.ts's guard-then-revert shape throughout: if any item's centre would move farther
 * than maxMoveM, any rect item would rotate farther than maxRotateDeg, or any resulting centre
 * would land outside [0,1], the WHOLE batch is discarded and the ORIGINAL positions/rotations are
 * returned untouched, with `reason` explaining why. A caller should treat `changed === false` as
 * "offer no destructive action" regardless of which reason fired — same contract as the two
 * siblings' `changed`.
 */
export function alignAndDistribute(items: AlignInputItem[], opts: AlignItemsOptions): AlignItemsResult {
  const { frame } = opts;
  const alignAngle = opts.alignAngle ?? true;
  const alignToLine = opts.alignToLine ?? true;
  const evenSpacing = opts.evenSpacing ?? true;
  const maxMoveM = opts.maxMoveM ?? DEFAULT_MAX_MOVE_M;
  const maxRotateDeg = opts.maxRotateDeg ?? DEFAULT_MAX_ROTATE_DEG;

  if (!(frame.imgW > 0) || !(frame.imgH > 0) || !(frame.mPerPx > 0)) return unchanged(items, 'invalid_frame');
  if (items.length < 2) return unchanged(items, 'too_few_items');
  // Two points trivially define a line and there is nothing between them to redistribute — see
  // AlignItemsReason's 'angle_only' doc comment for why this is a distinct, honestly-labelled
  // path rather than running fit/distribute as a no-op that would look like it did something.
  if (items.length === 2) return applyAngleOnly(items, alignAngle, maxRotateDeg);

  const origM: Pt[] = items.map((it) => toMetres([it.x, it.y], frame));

  // ── step 1: average angle (rect items only) ─────────────────────────────────────────────────
  const rectIdx = items.reduce<number[]>((acc, it, i) => (it.shape === 'rect' ? [...acc, i] : acc), []);
  let angleDeg: number | undefined;
  const newRot: Array<number | undefined> = items.map((it) => it.rot); // untouched unless overwritten below
  if (alignAngle && rectIdx.length > 0) {
    angleDeg = circularMeanFold180(rectIdx.map((i) => items[i].rot ?? 0));
    for (const i of rectIdx) newRot[i] = normaliseForOutput(angleDeg);
  }

  // ── step 2 + 3: fit the group's own best-fit line, project onto it, optionally redistribute
  // evenly along it. `perp` is each centre's offset FROM the fitted line — preserved verbatim
  // when alignToLine is off, so a farmer can ask for even spacing alone without every item
  // snapping onto one perfectly straight line. ─────────────────────────────────────────────────
  const { originM, dir } = fitPrincipalAxis(origM);
  const t = origM.map(([x, y]) => (x - originM[0]) * dir[0] + (y - originM[1]) * dir[1]);
  const perp: Pt[] = origM.map(([x, y], i) => [
    x - (originM[0] + t[i] * dir[0]),
    y - (originM[1] + t[i] * dir[1]),
  ]);

  let newT = t;
  if (evenSpacing) {
    const order = t.map((_, i) => i).sort((a, b) => t[a] - t[b]);
    const tMin = t[order[0]];
    const tMax = t[order[order.length - 1]];
    const redistributed = new Array<number>(items.length);
    order.forEach((origIdx, rank) => {
      // rank 0 lands exactly on tMin, the last rank exactly on tMax — the two OUTERMOST items
      // (by ORIGINAL position along the line) are therefore mapped to their own original t,
      // i.e. they stay put; only the interior ranks actually redistribute. Never re-centres the
      // group: tMin/tMax come from the group's own extent, not any external reference point.
      redistributed[origIdx] = order.length > 1 ? tMin + ((tMax - tMin) * rank) / (order.length - 1) : tMin;
    });
    newT = redistributed;
  }
  const newPerp: Pt[] = alignToLine ? perp.map((): Pt => [0, 0]) : perp;

  const newM: Pt[] = origM.map((_, i) => [
    originM[0] + newT[i] * dir[0] + newPerp[i][0],
    originM[1] + newT[i] * dir[1] + newPerp[i][1],
  ]);

  // ── invariants: constructive is not enough here (unlike RDP in tidy-outline.ts, this pipeline
  // can genuinely move an item farther than intended if e.g. one outlier drags the whole fitted
  // line), so every check below is a real, load-bearing defensive gate — checked in the same
  // order the task's own invariant list gives them. ANY failure reverts ALL items untouched. ────
  let maxMovedM = 0;
  for (let i = 0; i < items.length; i++) {
    const d = dist(origM[i], newM[i]);
    if (d > maxMovedM) maxMovedM = d;
    if (d > maxMoveM + EPS) return unchanged(items, 'movement_exceeded');
  }
  if (angleDeg !== undefined) {
    for (const i of rectIdx) {
      if (foldedAngleDelta(items[i].rot ?? 0, angleDeg) > maxRotateDeg + EPS) {
        return unchanged(items, 'rotation_exceeded');
      }
    }
  }
  const newNorm: Pt[] = newM.map((p) => fromMetres(p, frame));
  const boundWM = frame.imgW * frame.mPerPx;
  const boundHM = frame.imgH * frame.mPerPx;
  for (const [mx, my] of newM) {
    if (mx < -FRAME_EPS_M || mx > boundWM + FRAME_EPS_M || my < -FRAME_EPS_M || my > boundHM + FRAME_EPS_M) {
      return unchanged(items, 'would_leave_frame');
    }
  }

  // ── assemble ─────────────────────────────────────────────────────────────────────────────────
  let movedCount = 0;
  let rotatedCount = 0;
  const outItems: AlignedItem[] = items.map((it, i) => {
    if (dist(origM[i], newM[i]) > MOVE_EPS_M) movedCount++;
    const rot = it.shape === 'rect' ? newRot[i] : it.rot; // PRESERVE_CIRCLE_ROTATION
    if (it.shape === 'rect' && foldedAngleDelta(it.rot ?? 0, rot ?? 0) > ROTATE_EPS_DEG) rotatedCount++;
    return { id: it.id, x: clamp01(newNorm[i][0]), y: clamp01(newNorm[i][1]), rot };
  });

  if (movedCount === 0 && rotatedCount === 0) return unchanged(items, 'already_aligned');
  return { items: outItems, movedCount, maxMovedM, rotatedCount, angleDeg, changed: true, reason: 'aligned' };
}

/**
 * A plain-language, farmer-facing sentence for an AlignItemsResult — e.g. "Straightens 6 items to
 * 12° and spaces them evenly. Nothing moves more than 0.8 m." Callers (components/design/
 * DesignCanvas.tsx's preview panel) show this verbatim; every number in it is read straight off
 * `result`, never estimated — same discipline as tidyOutlineSummary/snapToNeighboursSummary.
 *
 * A `switch` with NO default case over AlignItemsReason on purpose — same convention as the two
 * siblings: adding a new reason without adding its copy here must be a compile error, not a
 * silently blank message.
 */
export function alignAndDistributeSummary(result: AlignItemsResult): string {
  switch (result.reason) {
    case 'aligned': {
      const bits: string[] = [];
      if (result.rotatedCount > 0 && result.angleDeg !== undefined) {
        bits.push(`Straightens ${result.rotatedCount} ${result.rotatedCount === 1 ? 'item' : 'items'} to ${Math.round(result.angleDeg)}°`);
      }
      if (result.movedCount > 0) {
        bits.push(bits.length ? 'spaces them evenly' : `Spaces ${result.movedCount} ${result.movedCount === 1 ? 'item' : 'items'} evenly`);
      }
      const sentence = bits.length ? `${bits.join(' and ')}.` : 'Cleans up the selection.';
      return `${sentence} Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`;
    }
    case 'angle_only':
      return `Straightens ${result.rotatedCount} ${result.rotatedCount === 1 ? 'item' : 'items'} to ${
        result.angleDeg !== undefined ? `${Math.round(result.angleDeg)}°` : 'match'
      } — only 2 items selected, so spacing is left as is.`;
    case 'already_aligned':
      return 'This selection is already aligned — nothing to clean up.';
    case 'too_few_items':
      return 'Select at least 2 items to clean up.';
    case 'invalid_frame':
      return "Map scale isn't ready yet — try again in a moment.";
    case 'movement_exceeded':
      return 'Cleaning up would move an item farther than the allowed distance, so nothing was changed.';
    case 'rotation_exceeded':
      return 'Cleaning up would rotate an item more than the allowed amount, so nothing was changed.';
    case 'would_leave_frame':
      return 'Cleaning up would push an item off the map, so nothing was changed.';
  }
}
