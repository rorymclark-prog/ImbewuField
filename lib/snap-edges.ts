// Farmer-invoked, explicitly previewed geometry cleanup that closes a hairline seam between a
// SINGLE selected zone ring and its already-saved NEIGHBOUR rings. See
// docs/ACTIVE-MAP-QUALITY-TASKS.md P2 "Snap neighbouring zone edges only within a strict tolerance
// and never merge different zones" and "Cover false joins, excessive movement, overlapping zones
// and gate-away-from-boundary cases with tests" — the two callers are app/design/page.tsx's
// onSnapSelected and components/design/DesignPalette.tsx's Snap button.
// This file itself renders nothing and knows nothing about React, undo, or Firestore: pure
// geometry in, pure geometry out — the SAME discipline as lib/tidy-outline.ts (same author, same
// problem class, shipped one day earlier — read that file first, this one mirrors its guard-then-
// revert shape throughout).
//
// THE APP DELIBERATELY HAS NO AUTOMATIC SEAM-CLOSING — two zones traced 20cm apart were traced
// that way by a real finger, not corrupted, and a boundary is a legal/physical fact. This was
// previously deferred as too risky to do automatically, so it is NOT automatic: it is a
// FARMER-INVOKED, previewed, undoable action on ONE selected zone, never run automatically and
// never touching anything but that zone's own points — exactly like the Tidy outline action
// (commit 95af7ee) it is modelled on.
//
// Unlike tidyOutline (whose whole job is to REMOVE points, never reposition a surviving one), this
// file's whole job is to MOVE points — each vertex of the target ring may be relocated onto the
// nearest point of a neighbouring ring's EDGE (point-to-segment, not point-to-vertex: a seam is
// usually vertex-against-edge), bounded by a tolerance in real METRES (converted via frame.mPerPx —
// a normalised tolerance would behave wildly differently on a 20m plot vs a 5ha farm, same reason
// tidyOutline's tolerance is metres-denominated). A vertex that finds nothing within tolerance is
// returned as the EXACT SAME array reference it was given — never round-tripped through the metres
// conversion — so an untouched vertex can never drift by even a float epsilon.
//
// Safe by construction AND by a defensive post-check battery, mirroring tidyOutline's guard-then-
// revert shape: ANY invariant breach below discards the WHOLE result and hands back the ORIGINAL
// untouched, with a plain `reason` a farmer-facing summary (snapToNeighboursSummary) can read
// straight off. A caller should treat `changed === false` as "offer no destructive action"
// regardless of which reason fired — same contract as tidyOutline's `changed`.

type Pt = [number, number];

// Mirrors lib/tidy-outline.ts's WPt: pairs the METRE-space coordinate every internal function
// operates on with the vertex's ORIGINAL normalised coordinate, carried through untouched. A
// vertex that never finds a snap target is returned via `.orig` — bit-for-bit the value the farmer
// originally traced, never a forward/inverse-transformed approximation of it.
interface WPt {
  m: Pt;
  orig: Pt;
}

export interface SnapEdgesFrame {
  imgW: number;
  imgH: number;
  mPerPx: number; // metres per logical pixel — see lib/design-canvas.ts's CanvasFrame
}

// Mirrors lib/design-canvas.ts's GroundFeatureKind values plus 'zone' for a plain permaculture
// effort-zone ring (ZoneShape.feature undefined). Duplicated here rather than imported — this file
// knows nothing about the app's React/Firestore types, only about rings and metres, same
// self-containment lib/tidy-outline.ts practices.
export type SnapRingKind =
  | 'zone'
  | 'house'
  | 'patio'
  | 'driveway'
  | 'lawn'
  | 'veg_garden'
  | 'orchard'
  | 'cleared'
  | 'boundary'
  | 'terrace_bank';

export interface SnapTargetRing {
  // Optional — when set, a neighbour carrying the SAME id is ignored defensively (a caller should
  // never include the target in its own neighbour list, but this makes that a no-op instead of a
  // self-snap bug if it ever happens).
  id?: string;
  kind: SnapRingKind;
  points: Array<[number, number]>;
}

export interface SnapNeighbourRing {
  id: string;
  kind: SnapRingKind;
  points: Array<[number, number]>;
  // Explicit opt-in: lets this neighbour receive a snap even though its `kind` differs from the
  // target's, because the two rings are known to share a real physical edge (e.g. a patio ring
  // genuinely meeting a house ring along one real wall). Has NO effect when kind === 'boundary' —
  // the property boundary is NEVER an eligible neighbour, full stop, regardless of this flag. A
  // farmer's zone snapping onto the boundary fence is exactly the "pulls a zone across it" /
  // "gate-away-from-boundary" risk named in docs/ACTIVE-MAP-QUALITY-TASKS.md: the boundary is a
  // legal fence line (possibly with a gate opening this module has no way to see), not a seam to
  // be smoothed, so it is excluded from candidacy entirely rather than trusted to "snap safely".
  sharedEdge?: boolean;
}

export interface SnapEdgesOptions {
  frame: SnapEdgesFrame;
  // Max distance, in METRES, a single vertex may move. Default 0.5m — a farmer's traced boundary
  // is a physical fact; see the module doc comment.
  toleranceM?: number;
  // A PATHOLOGY BACKSTOP, not the primary safety rail — see DEFAULT_MAX_AREA_CHANGE_PCT below for
  // why this is deliberately loose here and tight in tidyOutline. Exceeding it reverts untouched.
  maxAreaChangePct?: number;
}

export type SnapEdgesReason =
  | 'snapped' // a real, safe snap was applied — `points` differs from the input
  | 'nothing_in_tolerance' // no eligible neighbour edge came within toleranceM of any vertex
  | 'too_few_points' // target has fewer than 3 points — not a usable ring
  | 'invalid_frame' // frame.imgW/imgH/mPerPx are not usable for a metres conversion
  | 'would_self_intersect' // the snapped ring would cross itself although the original did not
  | 'would_change_winding' // the snapped ring's winding direction would flip
  | 'area_change_exceeded' // the snapped ring's area drifted more than maxAreaChangePct
  | 'would_merge_vertices' // two of the target's OWN vertices would land on the same point
  | 'movement_exceeded_tolerance'; // defensive: a vertex ended up farther than the tolerance promised

export interface SnapEdgesResult {
  points: Array<[number, number]>; // normalised [0..1], same convention as the input, SAME LENGTH as input.points always
  moved: number; // how many vertices actually moved; 0 whenever reason !== 'snapped'
  // Largest distance, in METRES, any vertex moved. The honest number to show a farmer — see
  // snapToNeighboursSummary. Always 0 when changed is false.
  maxMovedM: number;
  changed: boolean; // === (reason === 'snapped')
  reason: SnapEdgesReason;
}

const DEFAULT_TOLERANCE_M = 0.5;
// 25%, NOT tidyOutline's 2% — copying that number here was a real bug, caught by Rory on a live
// farm on 2026-07-27: every snap he tried was refused with "would change the enclosed area too
// much", i.e. the guard blocked the exact thing the feature exists to do.
//
// The two actions are not the same shape. tidyOutline REMOVES points and must leave the enclosed
// area alone — 2% is right there. snapToNeighbours MOVES an edge onto a neighbour, so an area
// change is the intended OUTCOME, not a symptom. Closing a 0.4m seam along a 20m shared edge adds
// ~8m²; on a 200m² zone that is 4% — refused at 2%, while being precisely the correct result.
//
// The real safety rail here is toleranceM: no vertex may move more than 0.5m, enforced both
// constructively (candidates beyond it are never considered) and defensively (re-checked against
// each vertex's ORIGINAL position afterwards). Area change is therefore already bounded by roughly
// perimeter × tolerance, which for a small zone is a large PERCENTAGE of a small area — so a tight
// percentage cap punishes small zones hardest, exactly backwards. This 25% remains only to catch
// pathological geometry (a degenerate sliver ring inverting), alongside the self-intersection,
// winding and false-join guards which are the ones actually doing the protective work.
const DEFAULT_MAX_AREA_CHANGE_PCT = 25;
const EPS_M = 1e-9;
// Below this, two of the TARGET's own vertices are considered coincident for the false-join guard
// — deliberately much smaller than any sane toleranceM (a farmer will never place two corners this
// close on purpose), the same "basically the same point" role tidyOutline's dedupeToleranceM plays.
const MERGE_EPS_M = 0.01;

export const SNAP_EDGES_DEFAULTS = {
  toleranceM: DEFAULT_TOLERANCE_M,
  maxAreaChangePct: DEFAULT_MAX_AREA_CHANGE_PCT,
} as const;

function unchanged(points: Pt[], reason: SnapEdgesReason): SnapEdgesResult {
  return { points, moved: 0, maxMovedM: 0, changed: false, reason };
}

// ── metre-space <-> normalised [0..1] conversion (verbatim from lib/tidy-outline.ts) ───────────

function toMetres(p: Pt, f: SnapEdgesFrame): Pt {
  return [p[0] * f.imgW * f.mPerPx, p[1] * f.imgH * f.mPerPx];
}

function fromMetres(p: Pt, f: SnapEdgesFrame): Pt {
  return [p[0] / (f.imgW * f.mPerPx), p[1] / (f.imgH * f.mPerPx)];
}

function dist(a: Pt, b: Pt): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// Clamped point-to-SEGMENT nearest point + distance — the core primitive this whole file exists
// for: a seam is usually vertex-against-EDGE, not vertex-against-vertex, so snapping only to a
// neighbour's own vertices would miss the common case entirely.
function nearestPointOnSegment(p: Pt, a: Pt, b: Pt): { point: Pt; dist: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS_M) return { point: a, dist: dist(p, a) };
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const point: Pt = [a[0] + dx * t, a[1] + dy * t];
  return { point, dist: dist(p, point) };
}

// ── ring inspection: winding, area, simplicity (verbatim from lib/tidy-outline.ts) ─────────────

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

// Whether `neighbour` is allowed to receive a snap from a ring of `targetKind` — the "never snap
// to a different ground-feature kind unless it is a shared physical edge" HARD invariant, plus the
// boundary carve-out that is never overridable. Exported (unlike tidyOutline's internals) because
// it is small, self-contained, and worth unit-testing directly rather than only through
// snapToNeighbours' end-to-end behaviour.
export function neighbourEligible(targetKind: SnapRingKind, neighbour: Pick<SnapNeighbourRing, 'kind' | 'sharedEdge'>): boolean {
  if (neighbour.kind === 'boundary') return false; // HARD — never overridable, see module doc
  if (neighbour.kind === targetKind) return true;
  return neighbour.sharedEdge === true;
}

// ── entry point ────────────────────────────────────────────────────────────────

/**
 * Snaps every vertex of ONE traced zone ring onto nearby NEIGHBOUR rings, closing hairline seams
 * left by hand-tracing two zones that should share an edge. Never mutates its input, never touches
 * a neighbour's points (they are read-only reference geometry), and never changes the target's own
 * point count — vertices are MOVED, never added, removed, or shared with a neighbour. A vertex that
 * finds nothing within `toleranceM` (in real METRES) of any eligible neighbour EDGE (point-to-
 * segment, not point-to-vertex) is returned as the exact same value it was given.
 *
 * Safe by construction AND by a defensive post-check: if the result would self-intersect a ring
 * that was simple before, flip its winding, drift its area beyond maxAreaChangePct, place two of
 * the target's OWN vertices on top of each other (a "false join"), or move a vertex farther than
 * the tolerance actually promised, the ORIGINAL is returned untouched with `reason` explaining why.
 * A caller should treat `changed === false` as "offer no destructive action" regardless of reason.
 *
 * Eligible neighbours (see neighbourEligible): the property boundary (`kind === 'boundary'`) is
 * NEVER eligible, and a different-`kind` neighbour is only eligible when explicitly marked
 * `sharedEdge`. This is what makes "never snap to the property boundary ring in a way that pulls a
 * zone across it" and "never snap a gate/opening closed" true by construction rather than by hope:
 * the boundary — the one ring a gate's opening could ever live on — simply never enters the
 * candidate set, so nothing this function does can ever move a vertex onto it, let alone across it.
 */
export function snapToNeighbours(
  target: SnapTargetRing,
  neighbours: SnapNeighbourRing[],
  opts: SnapEdgesOptions,
): SnapEdgesResult {
  const { frame } = opts;
  const toleranceM = opts.toleranceM ?? DEFAULT_TOLERANCE_M;
  const maxAreaChangePct = opts.maxAreaChangePct ?? DEFAULT_MAX_AREA_CHANGE_PCT;

  if (!(frame.imgW > 0) || !(frame.imgH > 0) || !(frame.mPerPx > 0)) {
    return unchanged(target.points, 'invalid_frame');
  }
  if (target.points.length < 3) return unchanged(target.points, 'too_few_points');

  const eligible = neighbours.filter(
    (n) => n.id !== target.id && n.points.length >= 2 && neighbourEligible(target.kind, n),
  );

  const targetWork: WPt[] = target.points.map((p) => ({ m: toMetres(p, frame), orig: p }));
  // Pre-convert every eligible neighbour ring to metres ONCE — reused across every target vertex.
  // Neighbour arrays themselves are never written to (only read), and toMetres always allocates a
  // fresh point — a neighbour's saved geometry can never be mutated by this function.
  const neighboursM = eligible.map((n) => n.points.map((p) => toMetres(p, frame)));

  let movedCount = 0;
  const resultM: Pt[] = targetWork.map((wp) => {
    let best: Pt | null = null;
    let bestD = toleranceM;
    for (const ringM of neighboursM) {
      const n = ringM.length;
      const segCount = n; // neighbour rings are always closed (zones), implicit wraparound edge
      for (let i = 0; i < segCount; i++) {
        const a = ringM[i];
        const b = ringM[(i + 1) % n];
        const { point, dist: d } = nearestPointOnSegment(wp.m, a, b);
        if (d <= bestD) {
          bestD = d;
          best = point;
        }
      }
    }
    if (best) {
      movedCount += 1;
      return best;
    }
    return wp.m; // untouched — SAME reference as targetWork[i].m, see the exact-passthrough below
  });

  if (movedCount === 0) return unchanged(target.points, 'nothing_in_tolerance');

  // "False join" guard: no two of the TARGET's own vertices may end up coincident. That would
  // silently collapse a corner (a zero-length edge) without actually removing a point — a
  // different failure mode than tidyOutline's dedupe step (which removes on purpose, honestly),
  // and one this action must never produce as a side effect of chasing a nearby neighbour.
  for (let i = 0; i < resultM.length; i++) {
    for (let j = i + 1; j < resultM.length; j++) {
      if (dist(resultM[i], resultM[j]) < MERGE_EPS_M) {
        return unchanged(target.points, 'would_merge_vertices');
      }
    }
  }

  // Defensive backstop: re-check every moved vertex against its ORIGINAL position (not a
  // re-derived one). By construction every accepted move was found within toleranceM during the
  // search above, but re-proving it here — the same "constructive AND defensive" doubling
  // lib/tidy-outline.ts uses for its own movement guarantee — is what keeps the promise airtight
  // against a future edit to the search loop rather than merely "true today".
  for (let i = 0; i < resultM.length; i++) {
    if (dist(targetWork[i].m, resultM[i]) > toleranceM + 1e-6) {
      return unchanged(target.points, 'movement_exceeded_tolerance');
    }
  }

  const originalM = targetWork.map((w) => w.m);
  const wasSimple = isSimpleRing(originalM);
  if (wasSimple && !isSimpleRing(resultM)) return unchanged(target.points, 'would_self_intersect');

  const originalArea = signedArea(originalM);
  const resultArea = signedArea(resultM);
  if (originalArea !== 0 && Math.sign(originalArea) !== Math.sign(resultArea)) {
    return unchanged(target.points, 'would_change_winding');
  }
  const originalAreaAbs = Math.abs(originalArea);
  if (originalAreaAbs > EPS_M) {
    const changePct = (Math.abs(resultArea - originalArea) / originalAreaAbs) * 100;
    if (changePct > maxAreaChangePct) return unchanged(target.points, 'area_change_exceeded');
  }

  // NEVER MERGE ZONES: built by mapping the target's OWN points 1:1 — same length, same order,
  // same identity. An untouched vertex is returned via `.orig` (bit-for-bit the input value, no
  // metres round-trip); a moved vertex is a freshly computed point, never a reference into a
  // neighbour's own points array — the target never comes to "share" geometry with a neighbour.
  let maxMovedM = 0;
  const points = resultM.map((m, i) => {
    if (m === targetWork[i].m) return targetWork[i].orig; // untouched — exact passthrough
    const moved = dist(targetWork[i].m, m);
    if (moved > maxMovedM) maxMovedM = moved;
    return fromMetres(m, frame);
  });

  return { points, moved: movedCount, maxMovedM, changed: true, reason: 'snapped' };
}

/**
 * A plain-language, farmer-facing sentence for a SnapEdgesResult — e.g. "Moves 3 corners to meet
 * Zone 2. Nothing moves more than 0.3 m." Callers (components/design/DesignCanvas.tsx's preview
 * panel) show this verbatim; it is the honest summary the farmer confirms or cancels against, so
 * every number in it is read straight off `result`, never estimated.
 *
 * `neighbourLabel` is OPTIONAL and purely cosmetic — this function's own return contract (see
 * SnapEdgesResult's doc comment) deliberately reports only how many vertices moved and the largest
 * movement, never WHICH neighbour absorbed which vertex, so naming one in the sentence is the
 * caller's choice, not a geometric fact this module vouches for. Omit it and the sentence still
 * reads honestly, just without the neighbour's name.
 *
 * A `switch` with NO default case over SnapEdgesReason on purpose — same convention as
 * tidyOutlineSummary and components/design/DesignCanvas.tsx's categoryLayerKey: adding a new reason
 * without adding its copy here must be a compile error, not a silently blank message.
 */
export function snapToNeighboursSummary(result: SnapEdgesResult, neighbourLabel?: string): string {
  switch (result.reason) {
    case 'snapped': {
      const corner = result.moved === 1 ? 'corner' : 'corners';
      const who = neighbourLabel ? ` to meet ${neighbourLabel}` : '';
      return `Moves ${result.moved} ${corner}${who}. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`;
    }
    case 'nothing_in_tolerance':
      return 'No neighbouring edge is close enough to snap to.';
    case 'too_few_points':
      return 'Too few points to snap safely.';
    case 'invalid_frame':
      return "Map scale isn't ready yet — try again in a moment.";
    case 'would_self_intersect':
      return 'Snapping would cross the outline over itself, so nothing was changed.';
    case 'would_change_winding':
      return "Snapping would flip the shape's direction, so nothing was changed.";
    case 'area_change_exceeded':
      return 'Snapping would change the enclosed area too much, so nothing was changed.';
    case 'would_merge_vertices':
      return "Snapping would merge two of this shape's own corners together, so nothing was changed.";
    case 'movement_exceeded_tolerance':
      return 'Snapping would move a point farther than the promised tolerance, so nothing was changed.';
  }
}
