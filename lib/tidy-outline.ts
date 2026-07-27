// Farmer-invoked, explicitly previewed geometry cleanup for a SINGLE traced zone ring or line
// polyline. See docs/ACTIVE-MAP-QUALITY-TASKS.md P2 "Add an explicit previewed and undoable
// `Tidy outline` design action; never silently rewrite saved geometry" — the two callers are
// app/design/page.tsx's onTidySelected and components/design/DesignPalette.tsx's Tidy button.
// This file itself renders nothing and knows nothing about React, undo, or Firestore: pure
// geometry in, pure geometry out.
//
// THE APP DELIBERATELY HAS NO AUTOMATIC SMOOTHING — renders must never rewrite a farmer's saved
// geometry. This is the opposite of that: a FARMER-INVOKED, previewed, undoable action on ONE
// selected shape, never run automatically and never touching anything but that shape. A traced
// boundary is a legal/physical fact: tidying may smooth the hand-shake (duplicate taps, finger
// jitter) but must never resize the plot.
//
// Every step below only REMOVES points from the input array — it never repositions, merges, or
// averages a surviving one. Every point in the result is therefore drawn VERBATIM from the input
// (same object identity is not preserved through JSON, but the numeric value is exact — no
// forward+inverse float round-trip through the metres conversion touches a surviving point). See
// the exact-subsequence test in tests/tidy-outline.test.ts, which is what makes "never move any
// surviving point more than the tolerance" true by construction rather than by hope.
//
// Pipeline: (a) drop consecutive near-duplicate points → (b) Ramer–Douglas–Peucker simplify,
// tolerance in METRES and converted via the frame's mPerPx (a tolerance in normalised [0..1]
// units would behave wildly differently on a 20 m plot vs a 5 ha farm — that is the whole point)
// → (c) collapse near-collinear vertices. Every step reverts itself (keeps its own pre-step
// points) rather than push the ring/line below the minimum vertex count.
//
// After the pipeline, a battery of safety checks can still discard the WHOLE result and hand
// back the original untouched: self-intersection of a ring that was simple before, a winding
// flip, an area drift beyond maxAreaChangePct, or (a defensive backstop — see the module doc
// comment on collapseNearCollinear for why this is a REAL risk, not decoration) a point ending up
// farther from the result than the tolerance actually promised.

type Pt = [number, number];

// A working point pairs the METRE-space coordinate every internal geometry function operates on
// with the point's ORIGINAL normalised coordinate, carried through untouched. The result is
// built from `.orig` only — this is what guarantees a surviving point's reported position is
// bit-for-bit the value the farmer originally traced, not a forward/inverse-transformed
// approximation of it (multiplying then dividing by the same imgW*mPerPx is not guaranteed to
// round-trip exactly in floating point).
interface WPt {
  m: Pt;
  orig: Pt;
}

export interface TidyOutlineFrame {
  imgW: number;
  imgH: number;
  mPerPx: number; // metres per logical pixel — see lib/design-canvas.ts's CanvasFrame
}

export interface TidyOutlineOptions {
  // The CanvasFrame the points are normalised against — needed to convert a metres tolerance
  // into the same [0..1] space ZoneShape.points/LineShape.points live in. imgW/imgH matter (not
  // just mPerPx): a normalised unit is NOT isotropic when imgW !== imgH (960x640 by default, see
  // DEFAULT_IMG_W/H in lib/design-canvas.ts) — equal dx/dy in [0..1] space are not equal
  // real-world distances. Mirrors lib/design-canvas.ts's distM exactly for this reason.
  frame: TidyOutlineFrame;
  // true for a ZoneShape ring — implicit closing edge from the last point back to the first,
  // matching lib/design-canvas.ts's ringAreaOf/pointInRing convention (no repeated first point).
  // false for a LineShape open polyline.
  closed: boolean;
  // RDP + collinear-collapse tolerance, in METRES. Default matches the worked example in the
  // Tidy outline task ("nothing moves more than 0.4 m") — sensible for a phone-traced farm
  // boundary; pass a tighter one for a small plot.
  toleranceM?: number;
  // Distance below which two CONSECUTIVE points are treated as the same tap (finger jitter or a
  // double-registered touch event), so the second is dropped outright before simplification even
  // starts. Deliberately much smaller than toleranceM; clamped to it defensively either way.
  dedupeToleranceM?: number;
  // Only checked for closed rings. A tidied ring's absolute area may drift from the original's by
  // at most this many PERCENT — small enough that smoothing the hand-shake can never quietly
  // resize the plot. Exceeding it reverts to the original untouched.
  maxAreaChangePct?: number;
}

export type TidyOutlineReason =
  | 'simplified' // a real, safe simplification was applied — `points` differs from the input
  | 'already_tidy' // the pipeline found nothing worth removing — input was already clean
  | 'too_few_points' // input is already at/under the minimum vertex count; nothing to safely drop
  | 'invalid_frame' // frame.imgW/imgH/mPerPx are not usable for a metres conversion
  | 'would_self_intersect' // the simplified ring would cross itself although the original did not
  | 'would_change_winding' // the simplified ring's winding direction would flip
  | 'area_change_exceeded' // the simplified ring's area drifted more than maxAreaChangePct
  | 'movement_exceeded_tolerance'; // defensive: a point ended up farther from the result than promised

export interface TidyOutlineResult {
  points: Array<[number, number]>; // normalised [0..1], same convention as the input
  removed: number; // input.length - points.length; 0 whenever reason !== 'simplified'
  // Largest distance, in METRES, from any ORIGINAL point (kept or dropped) to the resulting
  // outline. Always 0 for a point that survives (it IS a vertex of the result — see the
  // exact-subsequence guarantee above); in practice this reports how far the boundary moved at
  // the points that got dropped, which is the honest number to show a farmer.
  maxMovedM: number;
  changed: boolean; // === (reason === 'simplified')
  reason: TidyOutlineReason;
}

const DEFAULT_TOLERANCE_M = 0.4;
const DEFAULT_DEDUPE_TOLERANCE_M = 0.05;
const DEFAULT_MAX_AREA_CHANGE_PCT = 2;
const EPS_M = 1e-9;

export const TIDY_OUTLINE_DEFAULTS = {
  toleranceM: DEFAULT_TOLERANCE_M,
  dedupeToleranceM: DEFAULT_DEDUPE_TOLERANCE_M,
  maxAreaChangePct: DEFAULT_MAX_AREA_CHANGE_PCT,
} as const;

function unchanged(points: Pt[], reason: TidyOutlineReason): TidyOutlineResult {
  return { points, removed: 0, maxMovedM: 0, changed: false, reason };
}

// ── metre-space <-> normalised [0..1] conversion ──────────────────────────────

function toMetres(p: Pt, f: TidyOutlineFrame): Pt {
  return [p[0] * f.imgW * f.mPerPx, p[1] * f.imgH * f.mPerPx];
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Perpendicular distance from p to the INFINITE line through a,b — the classic Douglas-Peucker
// "furthest point from the chord" metric, and also used to test whether a middle vertex is
// roughly ON the line through its neighbours (collapseNearCollinear). Falls back to point-to-
// point distance when a and b coincide (a degenerate zero-length chord).
function perpDistToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < EPS_M) return dist(p, a);
  return Math.abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / len;
}

// Clamped point-to-SEGMENT distance — used for the final honest "how far from the actual drawn
// boundary" measurement (maxMovedM). Unlike perpDistToLine this never reports a point as "close"
// to a segment it is nowhere near just because it is near the segment's infinite extension.
function distPointToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS_M) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return dist(p, [a[0] + dx * t, a[1] + dy * t]);
}

function distPointToPath(p: Pt, path: Pt[], closed: boolean): number {
  const n = path.length;
  if (n === 0) return Infinity;
  if (n === 1) return dist(p, path[0]);
  const segCount = closed ? n : n - 1;
  let best = Infinity;
  for (let i = 0; i < segCount; i++) {
    const d = distPointToSegment(p, path[i], path[(i + 1) % n]);
    if (d < best) best = d;
  }
  return best;
}

// ── (a) drop consecutive near-duplicate points ────────────────────────────────
// Keeps the FIRST of each near-duplicate run untouched (never averages/repositions it) — the
// exact-subsequence guarantee this whole file relies on. For a closed ring, also checks the
// wraparound pair (last, first).
function dedupeConsecutive(pts: WPt[], tolM: number, closed: boolean, minPoints: number): WPt[] {
  if (pts.length <= minPoints) return pts;
  const out: WPt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (dist(pts[i].m, out[out.length - 1].m) > tolM) out.push(pts[i]);
  }
  if (closed && out.length > 1 && dist(out[out.length - 1].m, out[0].m) <= tolM) out.pop();
  return out.length >= minPoints ? out : pts; // revert rather than cross the floor
}

// ── (b) Ramer–Douglas–Peucker ──────────────────────────────────────────────────
// Standard recursive form. Its guarantee is GLOBAL, not just local-to-a-triple: recursion only
// stops on a sub-chain once every interior point of THAT sub-chain is within tolM of the chord
// between its own two endpoints, and those endpoints are exactly the points that survive into
// the output — so no later step in this function can silently push a kept point's neighbours
// further away than what was already checked. This is why RDP alone needs no defensive
// post-check the way collapseNearCollinear (below) does.
function rdpRecursive(pts: WPt[], tolM: number): WPt[] {
  const n = pts.length;
  if (n < 3) return pts.slice();
  const first = pts[0];
  const last = pts[n - 1];
  let idx = -1;
  let maxDist = -1;
  for (let i = 1; i < n - 1; i++) {
    const d = perpDistToLine(pts[i].m, first.m, last.m);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist <= tolM || idx === -1) return [first, last];
  const left = rdpRecursive(pts.slice(0, idx + 1), tolM);
  const right = rdpRecursive(pts.slice(idx), tolM);
  return [...left.slice(0, -1), ...right];
}

function rdpOpen(pts: WPt[], tolM: number, minPoints: number): WPt[] {
  if (pts.length <= minPoints) return pts;
  const out = rdpRecursive(pts, tolM);
  return out.length >= minPoints ? out : pts;
}

// Closed-ring RDP: splits the ring at its two farthest-apart points (the "diameter" — RDP has no
// single well-defined anchor pair for a cycle) into two open chains that share those two points
// as endpoints, RDP's each independently, then stitches the results back together IN THE SAME
// TRAVERSAL ORDER as the input (both chains walk forward through the original index order, never
// reversed) — which is what keeps winding direction intact.
function rdpClosed(pts: WPt[], tolM: number, minPoints: number): WPt[] {
  const n = pts.length;
  if (n <= minPoints) return pts;
  let bi = 0;
  let bj = 1;
  let bestD = -1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = dist(pts[i].m, pts[j].m);
      if (d > bestD) {
        bestD = d;
        bi = i;
        bj = j;
      }
    }
  }
  const chainA = pts.slice(bi, bj + 1); // bi..bj inclusive, forward order
  const chainB = [...pts.slice(bj), ...pts.slice(0, bi + 1)]; // bj..n-1,0..bi inclusive, wraps forward
  const simpA = rdpRecursive(chainA, tolM);
  const simpB = rdpRecursive(chainB, tolM);
  const combined = [...simpA, ...simpB.slice(1, -1)];
  return combined.length >= minPoints ? combined : pts;
}

// ── (c) collapse near-collinear vertices ──────────────────────────────────────
// Iterative + greedy: each pass removes the single MOST-collinear qualifying vertex (smallest
// perpendicular-to-chord error under tolerance) against its CURRENT neighbours, then recomputes
// from scratch. Endpoints of an OPEN line are never candidates (a polyline's ends are real,
// meaningful boundary points).
//
// Unlike RDP above, this step's per-removal check is only ever local (against the two neighbours
// present AT THAT MOMENT). If a point's neighbour is itself removed in a later round, the first
// point's true final distance to the (now longer) resulting chord was never re-checked — so,
// unlike RDP, this step cannot make the same "global by construction" guarantee on its own. That
// compounding is exactly what tidyOutline's post-pipeline maxMovedM check exists to catch: it is
// a real safety net for this step, not decoration.
function collapseNearCollinear(pts: WPt[], tolM: number, closed: boolean, minPoints: number): WPt[] {
  let work = pts.slice();
  for (;;) {
    const n = work.length;
    if (n <= minPoints) return work;
    let bestIdx = -1;
    let bestErr = Infinity;
    for (let i = 0; i < n; i++) {
      if (!closed && (i === 0 || i === n - 1)) continue;
      const prev = work[(i - 1 + n) % n];
      const cur = work[i];
      const next = work[(i + 1) % n];
      const err = perpDistToLine(cur.m, prev.m, next.m);
      if (err < tolM && err < bestErr) {
        bestErr = err;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return work;
    work = [...work.slice(0, bestIdx), ...work.slice(bestIdx + 1)];
  }
}

// ── ring inspection: winding, area, simplicity ────────────────────────────────

function signedArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return a / 2;
}

function orient(a: Pt, b: Pt, c: Pt): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Pt, b: Pt, p: Pt): boolean {
  return (
    Math.min(a[0], b[0]) - EPS_M <= p[0] && p[0] <= Math.max(a[0], b[0]) + EPS_M &&
    Math.min(a[1], b[1]) - EPS_M <= p[1] && p[1] <= Math.max(a[1], b[1]) + EPS_M
  );
}

function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = orient(p3, p4, p1);
  const d2 = orient(p3, p4, p2);
  const d3 = orient(p1, p2, p3);
  const d4 = orient(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (Math.abs(d1) < EPS_M && onSegment(p3, p4, p1)) return true;
  if (Math.abs(d2) < EPS_M && onSegment(p3, p4, p2)) return true;
  if (Math.abs(d3) < EPS_M && onSegment(p1, p2, p3)) return true;
  if (Math.abs(d4) < EPS_M && onSegment(p1, p2, p4)) return true;
  return false;
}

// Simple = no two non-adjacent edges cross. `pts` is a ring (implicit closing edge n-1 -> 0).
function isSimpleRing(pts: Pt[]): boolean {
  const n = pts.length;
  if (n < 3) return true;
  for (let i = 0; i < n; i++) {
    const a1 = pts[i];
    const a2 = pts[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i || (j + 1) % n === i || (i + 1) % n === j;
      if (adjacent) continue;
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

// ── entry point ────────────────────────────────────────────────────────────────

/**
 * Tidies ONE traced ring or polyline: drops finger-jitter duplicates, simplifies with RDP, and
 * collapses near-collinear vertices — all bounded by a tolerance expressed in real METRES. Never
 * mutates its input. Every returned point is drawn verbatim from the input array (no averaging,
 * no repositioning) — see the exact-subsequence test in tests/tidy-outline.test.ts.
 *
 * Safe by construction AND by a defensive post-check: if the result would self-intersect a ring
 * that was simple before, flip its winding, drift its area beyond maxAreaChangePct, or move a
 * point farther than the tolerance actually promised, the ORIGINAL is returned untouched with
 * `reason` explaining why. A caller should treat `changed === false` as "offer no destructive
 * action" regardless of which reason fired.
 */
export function tidyOutline(points: Array<[number, number]>, opts: TidyOutlineOptions): TidyOutlineResult {
  const { frame, closed } = opts;
  const toleranceM = opts.toleranceM ?? DEFAULT_TOLERANCE_M;
  const dedupeToleranceM = Math.min(opts.dedupeToleranceM ?? DEFAULT_DEDUPE_TOLERANCE_M, toleranceM);
  const maxAreaChangePct = opts.maxAreaChangePct ?? DEFAULT_MAX_AREA_CHANGE_PCT;
  const minPoints = closed ? 3 : 2;

  if (!(frame.imgW > 0) || !(frame.imgH > 0) || !(frame.mPerPx > 0)) {
    return unchanged(points, 'invalid_frame');
  }
  if (points.length <= minPoints) return unchanged(points, 'too_few_points');

  const originalM = points.map((p) => toMetres(p, frame));
  const originalWork: WPt[] = points.map((p, i) => ({ m: originalM[i], orig: p }));

  let work = dedupeConsecutive(originalWork, dedupeToleranceM, closed, minPoints);
  work = closed ? rdpClosed(work, toleranceM, minPoints) : rdpOpen(work, toleranceM, minPoints);
  work = collapseNearCollinear(work, toleranceM, closed, minPoints);

  if (work.length < minPoints) return unchanged(points, 'too_few_points'); // defensive; steps already guard this
  if (work.length === originalWork.length) return unchanged(points, 'already_tidy');

  const resultM = work.map((w) => w.m);

  if (closed) {
    const wasSimple = isSimpleRing(originalM);
    if (wasSimple && !isSimpleRing(resultM)) return unchanged(points, 'would_self_intersect');

    const originalArea = signedArea(originalM);
    const resultArea = signedArea(resultM);
    if (originalArea !== 0 && Math.sign(originalArea) !== Math.sign(resultArea)) {
      return unchanged(points, 'would_change_winding');
    }
    const originalAreaAbs = Math.abs(originalArea);
    if (originalAreaAbs > EPS_M) {
      const changePct = (Math.abs(resultArea - originalArea) / originalAreaAbs) * 100;
      if (changePct > maxAreaChangePct) return unchanged(points, 'area_change_exceeded');
    }
  }

  const maxMovedM = originalM.reduce((max, p) => Math.max(max, distPointToPath(p, resultM, closed)), 0);
  const toleranceBudget = Math.max(toleranceM, dedupeToleranceM);
  if (maxMovedM > toleranceBudget + 1e-6) return unchanged(points, 'movement_exceeded_tolerance');

  return {
    points: work.map((w) => w.orig),
    removed: points.length - work.length,
    maxMovedM,
    changed: true,
    reason: 'simplified',
  };
}

/**
 * A plain-language, farmer-facing sentence for a TidyOutlineResult — e.g. "Removes 42 of 118
 * points. Nothing moves more than 0.4 m." Callers (components/design/DesignCanvas.tsx's preview
 * panel) show this verbatim; it is the honest summary the farmer confirms or cancels against, so
 * every number in it is read straight off `result`, never estimated.
 *
 * A `switch` with NO default case over TidyOutlineReason on purpose — see
 * components/design/DesignCanvas.tsx's categoryLayerKey for the same convention: adding a new
 * reason without adding its copy here must be a compile error, not a silently blank message.
 */
export function tidyOutlineSummary(result: TidyOutlineResult): string {
  switch (result.reason) {
    case 'simplified': {
      const originalCount = result.points.length + result.removed;
      return `Removes ${result.removed} of ${originalCount} points. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`;
    }
    case 'already_tidy':
      return 'This outline is already tidy — nothing to remove.';
    case 'too_few_points':
      return 'Too few points to tidy safely.';
    case 'invalid_frame':
      return "Map scale isn't ready yet — try again in a moment.";
    case 'would_self_intersect':
      return 'Tidying would cross the outline over itself, so nothing was changed.';
    case 'would_change_winding':
      return "Tidying would flip the shape's direction, so nothing was changed.";
    case 'area_change_exceeded':
      return 'Tidying would change the enclosed area too much, so nothing was changed.';
    case 'movement_exceeded_tolerance':
      return 'Tidying would move a point farther than the promised tolerance, so nothing was changed.';
  }
}
