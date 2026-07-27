import test from 'node:test';
import assert from 'node:assert/strict';

import {
  snapToNeighbours,
  snapToNeighboursSummary,
  neighbourEligible,
  SNAP_EDGES_DEFAULTS,
  type SnapEdgesFrame,
  type SnapTargetRing,
  type SnapNeighbourRing,
  type SnapEdgesResult,
} from '../lib/snap-edges.ts';

// A plain 1 normalised-unit = 100 real metres frame (imgW=imgH=100, mPerPx=1) — every helper
// below builds points directly in METRES and divides by 100 to land in normalised [0..1] space,
// mirroring tests/tidy-outline.test.ts's FRAME convention exactly so numbers read as real-world
// distances a farmer would recognise.
const FRAME: SnapEdgesFrame = { imgW: 100, imgH: 100, mPerPx: 1 };

function toNorm(ptsM: Array<[number, number]>, frame: SnapEdgesFrame): Array<[number, number]> {
  return ptsM.map(([x, y]) => [x / (frame.imgW * frame.mPerPx), y / (frame.imgH * frame.mPerPx)]);
}

function square(x0: number, y0: number, side: number): Array<[number, number]> {
  return [
    [x0, y0],
    [x0 + side, y0],
    [x0 + side, y0 + side],
    [x0, y0 + side],
  ];
}

// ── a shaky-but-close hand-traced seam closes ─────────────────────────────────

test('snapToNeighbours: a 20cm seam between two adjacent zones is closed', () => {
  // Target: a 10m square. Neighbour: an identical square whose LEFT edge sits 0.2m to the right
  // of the target's right edge — exactly the "traced two zones that should share an edge 20cm
  // apart" scenario the module doc describes.
  const targetM = square(0, 0, 10);
  const neighbourM = square(10.2, 0, 10);
  const target: SnapTargetRing = { id: 'a', kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'b', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME });

  assert.equal(result.reason, 'snapped');
  assert.equal(result.changed, true);
  assert.equal(result.moved, 2); // only the two right-hand corners are near the seam
  assert.ok(result.maxMovedM < SNAP_EDGES_DEFAULTS.toleranceM, `maxMovedM ${result.maxMovedM} should be under the tolerance`);
  assert.ok(Math.abs(result.maxMovedM - 0.2) < 1e-6, `expected the seam to close by ~0.2m, got ${result.maxMovedM}`);
  assert.equal(result.points.length, target.points.length); // NEVER MERGE ZONES — same point count
  // The two right-hand corners now sit exactly on the neighbour's left edge (x=10.2); the two
  // left-hand corners are untouched (verbatim, not round-tripped through the metres conversion).
  assert.ok(Math.abs(result.points[1][0] - 10.2 / 100) < 1e-9);
  assert.ok(Math.abs(result.points[2][0] - 10.2 / 100) < 1e-9);
  assert.deepEqual(result.points[0], target.points[0]);
  assert.deepEqual(result.points[3], target.points[3]);
});

test('snapToNeighbours: a ring 5m away is left untouched', () => {
  const targetM = square(0, 0, 10);
  const neighbourM = square(15, 0, 10); // gap of 5m — far beyond any sane tolerance
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'b', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME });

  assert.equal(result.reason, 'nothing_in_tolerance');
  assert.equal(result.changed, false);
  assert.equal(result.moved, 0);
  assert.deepEqual(result.points, target.points);
});

// ── tolerance is a hard, real-METRES bound ─────────────────────────────────────

test('SAFETY: a vertex just inside the tolerance snaps, the same gap just outside does not', () => {
  // A LARGE ring with a short neighbour segment near only ONE corner, so the area-change guard
  // never enters into it (a single small corner nudge on a 100m ring changes area negligibly) —
  // isolating this test to the tolerance check alone, the same isolation trick
  // tests/tidy-outline.test.ts uses maxAreaChangePct for.
  const mk = (gapM: number) => {
    const targetM = square(0, 0, 100);
    const neighbourM: Array<[number, number]> = [[100 + gapM, -1], [100 + gapM, 1]];
    const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
    const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];
    return snapToNeighbours(target, neighbours, { frame: FRAME, toleranceM: 0.5 });
  };
  const under = mk(0.49);
  const over = mk(0.51);
  assert.equal(under.reason, 'snapped');
  assert.equal(under.moved, 1);
  assert.ok(under.maxMovedM <= 0.5, `maxMovedM ${under.maxMovedM} must never exceed the tolerance`);
  assert.equal(over.reason, 'nothing_in_tolerance');
  assert.equal(over.changed, false);
});

test('SAFETY: no result ever reports a moved vertex farther than the tolerance, across a battery of cases', () => {
  const cases: Array<{ target: SnapTargetRing; neighbours: SnapNeighbourRing[]; toleranceM: number }> = [
    {
      target: { kind: 'zone', points: toNorm(square(0, 0, 10), FRAME) },
      neighbours: [{ id: 'n', kind: 'zone', points: toNorm(square(10.05, 0, 10), FRAME) }],
      toleranceM: 0.5,
    },
    {
      target: { kind: 'zone', points: toNorm(square(0, 0, 3), FRAME) },
      neighbours: [{ id: 'n', kind: 'zone', points: toNorm(square(3.2, 0, 3), FRAME) }],
      toleranceM: 0.3,
    },
    {
      target: { kind: 'zone', points: toNorm(square(0, 0, 50), FRAME) },
      neighbours: [{ id: 'n', kind: 'zone', points: toNorm(square(50.4, -10, 70), FRAME) }],
      toleranceM: 0.5,
    },
  ];
  for (const c of cases) {
    const result = snapToNeighbours(c.target, c.neighbours, { frame: FRAME, toleranceM: c.toleranceM, maxAreaChangePct: 1000 });
    if (!result.changed) continue;
    assert.ok(result.maxMovedM <= c.toleranceM + 1e-6, `maxMovedM ${result.maxMovedM} exceeded toleranceM ${c.toleranceM}`);
  }
});

// ── NEVER MERGE ZONES: identity + point count are preserved, neighbours are read-only ─────────

test('SAFETY: the target never gains or loses a point, whether or not anything snapped', () => {
  const targetM = square(0, 0, 10);
  const neighbourFar: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(50, 50, 10), FRAME) }];
  const neighbourClose: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(10.1, 0, 10), FRAME) }];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };

  const untouched = snapToNeighbours(target, neighbourFar, { frame: FRAME });
  const snapped = snapToNeighbours(target, neighbourClose, { frame: FRAME });

  assert.equal(untouched.points.length, target.points.length);
  assert.equal(snapped.points.length, target.points.length);
  assert.equal(snapped.reason, 'snapped'); // sanity: this case really did snap
});

test('SAFETY: a neighbour ring is never mutated — this action only ever touches the target', () => {
  const targetM = square(0, 0, 10);
  const neighbourM = square(10.1, 0, 10);
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbour: SnapNeighbourRing = { id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) };
  const before = JSON.stringify(neighbour.points);

  const result = snapToNeighbours(target, [neighbour], { frame: FRAME });

  assert.equal(result.reason, 'snapped'); // sanity: the call actually did something
  assert.equal(JSON.stringify(neighbour.points), before);
});

// ── SAFETY INVARIANT: never self-intersect a ring that was simple before ──────
// A deep concave notch reaching almost to the ring's own base edge (still simple — the notch tip
// sits just ABOVE the base) — a neighbour edge pulls the notch tip DOWN, just past the base line,
// crossing the two non-adjacent edges that meet it on either side.

test('SAFETY: a snap that would push a concave vertex across the ring and cross itself is rejected', () => {
  const targetM: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [5, 0.3], // concave notch tip, 0.3m above the base edge — ring is simple
    [0, 10],
  ];
  const neighbourM: Array<[number, number]> = [[4, -0.15], [6, -0.15]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  // maxAreaChangePct set very high specifically to ISOLATE this guard from the separately-tested
  // area guard below — see tests/tidy-outline.test.ts's identical isolation reasoning for its own
  // comb-ring self-intersection test.
  const result = snapToNeighbours(target, neighbours, { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 });

  assert.equal(result.reason, 'would_self_intersect');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, target.points);
});

// ── SAFETY INVARIANT: never flip winding ────────────────────────────────────────
// A near-degenerate (almost flat) triangle — snapping its apex across its own base line produces
// its mirror image: same magnitude of area, opposite sign.

test('SAFETY: a snap that would mirror a near-flat vertex across its base and flip winding is rejected', () => {
  const targetM: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [5, 0.2], // apex just above the base
  ];
  const neighbourM: Array<[number, number]> = [[4, -0.2], [6, -0.2]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 });

  assert.equal(result.reason, 'would_change_winding');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, target.points);
});

// ── AREA CHANGE: a pathology backstop, NOT the primary safety rail ────────────
// The tolerance is what actually protects a farmer's drawing (no vertex moves more than 0.5m,
// enforced constructively and re-checked defensively). Area change is bounded by roughly
// perimeter × tolerance, which on a SMALL zone is a large percentage of a small number — so a
// tight percentage cap punishes small zones hardest, exactly backwards. See the two tests below.

// REGRESSION, caught by Rory on a live farm 2026-07-27: this exact case — an ordinary zone with an
// ordinary seam — was REFUSED with "would change the enclosed area too much", because the default
// had been copied from tidyOutline's 2%. Snapping MOVES an edge onto a neighbour, so an area change
// is the intended outcome, not a symptom: closing a 0.49m seam on a 10m-wide zone is ~4.9% and is
// precisely the correct result. The guard was blocking the exact thing the feature exists to do.
test('an ordinary seam on an ordinary zone SNAPS — the area guard must not block the feature', () => {
  const targetM = square(0, 0, 10); // 100 m²
  const neighbourM: Array<[number, number]> = [[9.51, -1], [9.51, 11]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME });

  assert.equal(result.reason, 'snapped');
  assert.equal(result.changed, true);
  assert.ok(result.moved > 0, 'at least one corner should meet the neighbour');
  // The tolerance is the REAL safety rail here, and it still holds.
  assert.ok(result.maxMovedM <= 0.5 + 1e-6, 'no corner may move further than the promised tolerance');
});

// The backstop still exists — it now catches pathological geometry rather than ordinary work.
// A 1m sliver losing 0.4m of its width is a 40% change: a shape being deformed, not a seam closed.
test('SAFETY: the area backstop still fires on pathological geometry', () => {
  const targetM = square(0, 0, 1); // 1 m² — small enough that a 0.4m move is a huge proportion
  const neighbourM: Array<[number, number]> = [[0.6, -1], [0.6, 2]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME });

  assert.equal(result.reason, 'area_change_exceeded');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, target.points, 'the original must come back untouched');
});

// ── "FALSE JOIN" guard: two of the target's OWN vertices must never coincide ──────────────────
// Two of the target's own corners (5.05,10) and (4.95,10) are only 0.1m apart. A degenerate
// (zero-length) neighbour "ring" — a single repeated point — pulls BOTH onto the exact same spot,
// which would silently collapse a real corner into a zero-length edge without ever removing a
// point.

test('SAFETY: a snap that would place two of the target\'s own corners on the same point is rejected', () => {
  const targetM: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [5.05, 10],
    [4.95, 10],
  ];
  const neighbourM: Array<[number, number]> = [[5, 10.3], [5, 10.3]]; // a single point, doubled
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, neighbours, { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 });

  assert.equal(result.reason, 'would_merge_vertices');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, target.points);
});

// ── SAFETY INVARIANT: never snap to a different-kind neighbour, and NEVER the boundary ────────
// Covers docs/ACTIVE-MAP-QUALITY-TASKS.md's "gate-away-from-boundary" case: the property boundary
// is the one ring a farmer's gate opening could ever live on, so it must never be pulled toward —
// closing that gap would be exactly "snapping a gate/opening closed". Enforced by hard-excluding
// `kind === 'boundary'` from candidacy entirely (see neighbourEligible), so there is no gate-aware
// logic to get wrong: the boundary simply never competes for a vertex, regardless of distance.

test('SAFETY: the property boundary ring is never used as a snap target, even when it is the closest thing within tolerance', () => {
  const targetM = square(0, 0, 10);
  const neighbourM: Array<[number, number]> = [[10.2, -1], [10.2, 11]]; // 0.2m away — well within tolerance
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const boundary: SnapNeighbourRing[] = [{ id: 'boundary-1', kind: 'boundary', points: toNorm(neighbourM, FRAME) }];

  const result = snapToNeighbours(target, boundary, { frame: FRAME });

  assert.equal(result.reason, 'nothing_in_tolerance');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, target.points);
});

test('SAFETY: the boundary is excluded even when explicitly marked sharedEdge — no override exists', () => {
  const targetM = square(0, 0, 10);
  const neighbourM: Array<[number, number]> = [[10.2, -1], [10.2, 11]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const boundary: SnapNeighbourRing[] = [{ id: 'boundary-1', kind: 'boundary', points: toNorm(neighbourM, FRAME), sharedEdge: true }];

  const result = snapToNeighbours(target, boundary, { frame: FRAME });

  assert.equal(result.reason, 'nothing_in_tolerance');
  assert.equal(result.changed, false);
});

test('a different ground-feature kind is ignored by default, but usable when explicitly marked a shared edge', () => {
  const targetM = square(0, 0, 10);
  const neighbourM: Array<[number, number]> = [[10.2, -1], [10.2, 11]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };

  const notShared: SnapNeighbourRing[] = [{ id: 'h', kind: 'house', points: toNorm(neighbourM, FRAME) }];
  const ignored = snapToNeighbours(target, notShared, { frame: FRAME });
  assert.equal(ignored.reason, 'nothing_in_tolerance');

  const shared: SnapNeighbourRing[] = [{ id: 'h', kind: 'house', points: toNorm(neighbourM, FRAME), sharedEdge: true }];
  const used = snapToNeighbours(target, shared, { frame: FRAME });
  assert.equal(used.reason, 'snapped');
});

test('neighbourEligible: boundary is excluded regardless of kind or sharedEdge; same-kind and sharedEdge are the only two paths in', () => {
  assert.equal(neighbourEligible('zone', { kind: 'boundary' }), false);
  assert.equal(neighbourEligible('zone', { kind: 'boundary', sharedEdge: true }), false);
  assert.equal(neighbourEligible('zone', { kind: 'zone' }), true);
  assert.equal(neighbourEligible('zone', { kind: 'house' }), false);
  assert.equal(neighbourEligible('zone', { kind: 'house', sharedEdge: true }), true);
});

// ── tolerance is real METRES, converted via the frame's mPerPx — not a raw [0..1] number ──────

test('snapToNeighbours: the exact same normalised rings snap differently depending on the frame — proves the tolerance is metres, not normalised units', () => {
  const targetM = square(0, 0, 10);
  const neighbourM = square(10.2, 0, 10);
  const normTarget = toNorm(targetM, FRAME); // fixed, frame-independent input from here on
  const normNeighbour = toNorm(neighbourM, FRAME);

  // Interpreted at FRAME's scale (1 normalised unit = 100m): the 0.2m gap is well under the 0.5m
  // default tolerance, so it closes.
  const atFrameScale = snapToNeighbours(
    { kind: 'zone', points: normTarget },
    [{ id: 'n', kind: 'zone', points: normNeighbour }],
    { frame: FRAME },
  );

  // The SAME normalised numbers, reinterpreted at a much coarser scale (1 normalised unit =
  // 5,000m): the "0.2m gap" now reads as ~10m — far beyond the tolerance — so nothing snaps. If
  // tolerance were applied in raw normalised units instead of metres, these two calls would behave
  // identically.
  const coarseFrame: SnapEdgesFrame = { imgW: 100, imgH: 100, mPerPx: 50 };
  const atCoarseScale = snapToNeighbours(
    { kind: 'zone', points: normTarget },
    [{ id: 'n', kind: 'zone', points: normNeighbour }],
    { frame: coarseFrame },
  );

  assert.equal(atFrameScale.reason, 'snapped');
  assert.equal(atCoarseScale.reason, 'nothing_in_tolerance');
});

// ── invalid / degenerate input handled gracefully, never throws ───────────────────────────────

test('snapToNeighbours: an unusable frame (mPerPx <= 0) is refused, not divided-by-zero into garbage', () => {
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(square(0, 0, 10), FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(10.1, 0, 10), FRAME) }];
  const result = snapToNeighbours(target, neighbours, { frame: { imgW: 100, imgH: 100, mPerPx: 0 } });
  assert.equal(result.reason, 'invalid_frame');
  assert.deepEqual(result.points, target.points);
});

test('too_few_points: a 2-point target is not a usable ring and is left alone', () => {
  const target: SnapTargetRing = { kind: 'zone', points: toNorm([[0, 0], [10, 0]], FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(10.1, 0, 10), FRAME) }];
  const result = snapToNeighbours(target, neighbours, { frame: FRAME });
  assert.equal(result.reason, 'too_few_points');
  assert.deepEqual(result.points, target.points);
});

// ── snapToNeighboursSummary: the plain-language preview copy the farmer actually reads ────────

test('snapToNeighboursSummary: a real snap names how many corners moved, the honest movement bound, and (optionally) who it met', () => {
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(square(0, 0, 10), FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(10.2, 0, 10), FRAME) }];
  const result = snapToNeighbours(target, neighbours, { frame: FRAME });

  const withName = snapToNeighboursSummary(result, 'Zone 2');
  assert.equal(withName, 'Moves 2 corners to meet Zone 2. Nothing moves more than 0.2 m.');

  const withoutName = snapToNeighboursSummary(result);
  assert.equal(withoutName, 'Moves 2 corners. Nothing moves more than 0.2 m.');
});

test('snapToNeighboursSummary: singular "corner" when exactly one vertex moves', () => {
  const targetM = square(0, 0, 100);
  const neighbourM: Array<[number, number]> = [[100.3, -1], [100.3, 1]];
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(targetM, FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(neighbourM, FRAME) }];
  const result = snapToNeighbours(target, neighbours, { frame: FRAME });
  assert.equal(result.moved, 1);
  assert.match(snapToNeighboursSummary(result), /^Moves 1 corner\. /);
});

test('snapToNeighboursSummary: an honest "nothing to snap to" message, not a fabricated count', () => {
  const target: SnapTargetRing = { kind: 'zone', points: toNorm(square(0, 0, 10), FRAME) };
  const neighbours: SnapNeighbourRing[] = [{ id: 'n', kind: 'zone', points: toNorm(square(50, 50, 10), FRAME) }];
  const result = snapToNeighbours(target, neighbours, { frame: FRAME });
  assert.equal(result.reason, 'nothing_in_tolerance');
  assert.equal(snapToNeighboursSummary(result), 'No neighbouring edge is close enough to snap to.');
});

test('snapToNeighboursSummary: every SnapEdgesReason has distinct, non-empty copy', () => {
  const bigSquareTarget: SnapTargetRing = { kind: 'zone', points: toNorm(square(0, 0, 10), FRAME) };

  const snapped = snapToNeighbours(
    bigSquareTarget,
    [{ id: 'n', kind: 'zone', points: toNorm(square(10.2, 0, 10), FRAME) }],
    { frame: FRAME },
  );
  const nothingInTolerance = snapToNeighbours(
    bigSquareTarget,
    [{ id: 'n', kind: 'zone', points: toNorm(square(50, 50, 10), FRAME) }],
    { frame: FRAME },
  );
  const tooFewPoints = snapToNeighbours(
    { kind: 'zone', points: toNorm([[0, 0], [10, 0]], FRAME) },
    [{ id: 'n', kind: 'zone', points: toNorm(square(10.1, 0, 10), FRAME) }],
    { frame: FRAME },
  );
  const invalidFrame = snapToNeighbours(bigSquareTarget, [], { frame: { imgW: 100, imgH: 100, mPerPx: 0 } });
  const selfIntersect = snapToNeighbours(
    { kind: 'zone', points: toNorm([[0, 0], [10, 0], [10, 10], [5, 0.3], [0, 10]], FRAME) },
    [{ id: 'n', kind: 'zone', points: toNorm([[4, -0.15], [6, -0.15]], FRAME) }],
    { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 },
  );
  const windingFlip = snapToNeighbours(
    { kind: 'zone', points: toNorm([[0, 0], [10, 0], [5, 0.2]], FRAME) },
    [{ id: 'n', kind: 'zone', points: toNorm([[4, -0.2], [6, -0.2]], FRAME) }],
    { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 },
  );
  const areaExceeded = snapToNeighbours(
    bigSquareTarget,
    [{ id: 'n', kind: 'zone', points: toNorm([[9.51, -1], [9.51, 11]], FRAME) }],
    { frame: FRAME },
  );
  const falseJoin = snapToNeighbours(
    { kind: 'zone', points: toNorm([[0, 0], [10, 0], [10, 10], [5.05, 10], [4.95, 10]], FRAME) },
    [{ id: 'n', kind: 'zone', points: toNorm([[5, 10.3], [5, 10.3]], FRAME) }],
    { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 },
  );
  // movement_exceeded_tolerance is a DEFENSIVE backstop (see lib/snap-edges.ts's module doc): the
  // constructive search never proposes a move beyond toleranceM in the first place, so this reason
  // is not reachable through normal geometry the way the other eight are. Its copy is exercised
  // directly against a hand-built result, the same way the type system requires the summary
  // function's switch to handle it.
  const movementExceeded: SnapEdgesResult = { points: [], moved: 1, maxMovedM: 0.9, changed: false, reason: 'movement_exceeded_tolerance' };

  const results = [snapped, nothingInTolerance, tooFewPoints, invalidFrame, selfIntersect, windingFlip, areaExceeded, falseJoin, movementExceeded];
  const messages = results.map((r) => snapToNeighboursSummary(r));
  for (const m of messages) assert.ok(m.length > 0);
  assert.equal(new Set(messages).size, messages.length, 'expected every reason to produce distinct copy');
});
