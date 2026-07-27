import test from 'node:test';
import assert from 'node:assert/strict';

import { tidyOutline, tidyOutlineSummary, TIDY_OUTLINE_DEFAULTS, type TidyOutlineFrame } from '../lib/tidy-outline.ts';

// A plain 1 normalised-unit = 100 real metres frame (imgW=imgH=100, mPerPx=1) — every helper
// below builds points directly in METRES and divides by 100 to land in normalised [0..1] space,
// so test data reads as real-world distances a farmer would recognise.
const FRAME: TidyOutlineFrame = { imgW: 100, imgH: 100, mPerPx: 1 };

function toNorm(ptsM: Array<[number, number]>, frame: TidyOutlineFrame): Array<[number, number]> {
  return ptsM.map(([x, y]) => [x / (frame.imgW * frame.mPerPx), y / (frame.imgH * frame.mPerPx)]);
}

// Deterministic pseudo-jitter — a plain sine wave, not a PRNG — so a reader can see exactly what
// perturbation each generated point gets without trusting an RNG algorithm.
function jitter(amplitudeM: number, i: number): number {
  return amplitudeM * Math.sin(i * 2.3);
}

// A farmer's shaky finger-traced square: `perSide` points along each of 4 edges, each nudged
// off the true edge by up to `jitterM`. This is exactly the kind of trace the Tidy outline
// action exists for.
function shakySquareM(sideM: number, jitterM: number, perSide: number): Array<[number, number]> {
  const corners: Array<[number, number]> = [
    [0, 0],
    [sideM, 0],
    [sideM, sideM],
    [0, sideM],
  ];
  const pts: Array<[number, number]> = [];
  let i = 0;
  for (let c = 0; c < 4; c++) {
    const [ax, ay] = corners[c];
    const [bx, by] = corners[(c + 1) % 4];
    for (let k = 0; k < perSide; k++, i++) {
      const t = k / perSide;
      const j = jitter(jitterM, i);
      pts.push([ax + (bx - ax) * t + j, ay + (by - ay) * t + j]);
    }
  }
  return pts;
}

function shakyLineM(lenM: number, jitterM: number, n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= n; i++) {
    pts.push([lenM * (i / n), jitter(jitterM, i)]);
  }
  return pts;
}

// Signed shoelace area — reimplemented locally (not imported from lib/tidy-outline.ts, which
// exposes none of its internals) so the winding-preservation test is checking the PUBLIC
// contract, not calling back into the code under test.
function signedShoelace(pts: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return a / 2;
}

function isExactMember(pt: [number, number], arr: Array<[number, number]>): boolean {
  return arr.some(([x, y]) => x === pt[0] && y === pt[1]);
}

// ── a shaky traced ring simplifies sensibly ───────────────────────────────────

test('tidyOutline: a shaky traced 10m square collapses down toward its 4 corners', () => {
  const shakyM = shakySquareM(10, 0.03, 5); // 20 points, 3cm jitter around a 10m square
  const input = toNorm(shakyM, FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true });
  assert.equal(result.reason, 'simplified');
  assert.equal(result.changed, true);
  assert.equal(result.points.length, 4);
  assert.equal(result.removed, input.length - 4);
  assert.ok(result.maxMovedM < TIDY_OUTLINE_DEFAULTS.toleranceM, `maxMovedM ${result.maxMovedM} should be under the tolerance`);
});

test('tidyOutline: a shaky traced fence line collapses toward its 2 endpoints', () => {
  const shakyM = shakyLineM(20, 0.03, 10); // 11 points, 3cm jitter along a near-straight 20m run
  const input = toNorm(shakyM, FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: false });
  assert.equal(result.reason, 'simplified');
  assert.equal(result.points.length, 2);
  assert.deepEqual(result.points[0], input[0]);
  assert.deepEqual(result.points[result.points.length - 1], input[input.length - 1]);
});

// ── a clean shape (nothing shaky about it) is left alone ──────────────────────

test('tidyOutline: an already-clean square is reported unchanged, not destructively re-simplified', () => {
  const cleanM: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  const input = toNorm(cleanM, FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true });
  assert.equal(result.reason, 'already_tidy');
  assert.equal(result.changed, false);
  assert.equal(result.removed, 0);
  assert.deepEqual(result.points, input);
});

test('tidyOutline: a genuine right-angle corner on a line is never mistaken for jitter', () => {
  // Only 3 points and a real 90° bend — nothing here is "shaky", so nothing should move.
  const bentM: Array<[number, number]> = [
    [0, 0],
    [10, 0],
    [10, 10],
  ];
  const input = toNorm(bentM, FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: false });
  assert.equal(result.reason, 'already_tidy');
  assert.deepEqual(result.points, input);
});

// ── tolerance is real METRES, converted via the frame's mPerPx — not a raw [0..1] number ──────

test('tidyOutline: the exact same normalised ring simplifies differently depending on the frame — proves the tolerance is metres, not normalised units', () => {
  const shakyM = shakySquareM(10, 0.03, 5);
  const normRing = toNorm(shakyM, FRAME); // fixed, frame-independent input from here on

  // Interpreted at FRAME's scale (1 normalised unit = 100m): the 3cm jitter reads as a few cm —
  // far under the 0.4m default tolerance — so it collapses hard.
  const atFrameScale = tidyOutline(normRing, { frame: FRAME, closed: true });

  // The SAME normalised numbers, reinterpreted at a much coarser scale (1 normalised unit =
  // 5,000m): the ring itself is now a 500m square and the "jitter" reads as ~1.5m swings —
  // comparable to the tolerance — so almost nothing gets removed. If tolerance were applied in
  // raw normalised units instead of metres, these two calls would behave identically.
  const coarseFrame: TidyOutlineFrame = { imgW: 100, imgH: 100, mPerPx: 50 };
  const atCoarseScale = tidyOutline(normRing, { frame: coarseFrame, closed: true });

  assert.ok(
    atFrameScale.removed > atCoarseScale.removed,
    `expected the fine-scale frame to remove more points (${atFrameScale.removed}) than the coarse-scale frame (${atCoarseScale.removed})`,
  );
  assert.equal(atFrameScale.points.length, 4);
});

// ── SAFETY INVARIANT: a surviving point never moves ────────────────────────────
// Enforced by construction — every step in lib/tidy-outline.ts only REMOVES points, it never
// averages or repositions one. This test fails if that ever changes (e.g. a future edit merges
// near-duplicates to their midpoint instead of keeping the first).

test('SAFETY: every surviving point is an EXACT value from the input — nothing is ever repositioned', () => {
  const cases: Array<{ points: Array<[number, number]>; closed: boolean }> = [
    { points: toNorm(shakySquareM(10, 0.03, 5), FRAME), closed: true },
    { points: toNorm(shakySquareM(3, 0.15, 9), FRAME), closed: true },
    { points: toNorm(shakyLineM(20, 0.03, 10), FRAME), closed: false },
    { points: toNorm(shakyLineM(50, 0.4, 25), FRAME), closed: false },
  ];
  for (const c of cases) {
    const result = tidyOutline(c.points, { frame: FRAME, closed: c.closed });
    for (const p of result.points) {
      assert.ok(isExactMember(p, c.points), `point ${JSON.stringify(p)} is not a verbatim input point`);
    }
  }
});

// ── SAFETY INVARIANT: never reduce a ring below 3 points or a line below 2 ────

test('SAFETY: a ring never drops below 3 points, even under an absurdly generous tolerance', () => {
  // Five points nearly collinear along a long run, closed by one point far off to the side —
  // a naive simplifier handed a huge tolerance would happily flatten this to a 2-point line.
  const nearFlatM: Array<[number, number]> = [
    [0, 0],
    [3, 0.001],
    [6, -0.001],
    [9, 0.0005],
    [12, 0],
    [6, 50],
  ];
  const input = toNorm(nearFlatM, FRAME);
  const result = tidyOutline(input, {
    frame: FRAME,
    closed: true,
    toleranceM: 1e6,
    dedupeToleranceM: 1e6,
    maxAreaChangePct: 1e6,
  });
  assert.ok(result.points.length >= 3, `ring collapsed to ${result.points.length} points`);
});

test('SAFETY: a line never drops below 2 points, even under an absurdly generous tolerance', () => {
  const nearFlatM: Array<[number, number]> = [
    [0, 0],
    [3, 0.001],
    [6, -0.001],
    [9, 0.0005],
    [12, 0],
  ];
  const input = toNorm(nearFlatM, FRAME);
  const result = tidyOutline(input, {
    frame: FRAME,
    closed: false,
    toleranceM: 1e6,
    dedupeToleranceM: 1e6,
  });
  assert.ok(result.points.length >= 2, `line collapsed to ${result.points.length} points`);
});

test('too_few_points: a triangle (already at the ring floor) is left alone, not shrunk further', () => {
  const input = toNorm([[0, 0], [10, 0], [5, 10]], FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true });
  assert.equal(result.reason, 'too_few_points');
  assert.deepEqual(result.points, input);
});

test('too_few_points: a 2-point line (already at the line floor) is left alone', () => {
  const input = toNorm([[0, 0], [10, 0]], FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: false });
  assert.equal(result.reason, 'too_few_points');
  assert.deepEqual(result.points, input);
});

// ── SAFETY INVARIANT: never change winding/orientation ─────────────────────────

test('SAFETY: winding direction never flips across a battery of shaky shapes', () => {
  const shapes = [shakySquareM(10, 0.03, 5), shakySquareM(3, 0.15, 9), shakySquareM(40, 0.05, 4)];
  for (const shapeM of shapes) {
    const input = toNorm(shapeM, FRAME);
    const result = tidyOutline(input, { frame: FRAME, closed: true });
    if (!result.changed) continue;
    const before = Math.sign(signedShoelace(input));
    const after = Math.sign(signedShoelace(result.points));
    assert.equal(after, before, 'winding flipped');
  }
});

// ── SAFETY INVARIANT: never self-intersect a ring that was simple before ──────
// A "comb" ring — 3 narrow teeth. A tolerance loose enough to skip straight across a tooth gap
// (chord-only reasoning, no simplicity check) would cross itself. maxAreaChangePct is set very
// high here specifically to ISOLATE this guard from the separately-tested area guard below —
// without that, the area guard fires first (see the next test) and self-intersection is never
// reached, which would be true safety but wouldn't prove THIS guard exists.

function combM(): Array<[number, number]> {
  return [
    [0, 0], [0, 10], [1, 10], [1, 1], [2, 1], [2, 10],
    [3, 10], [3, 1], [4, 1], [4, 10], [5, 10], [5, 0],
  ];
}

test('SAFETY: a naive high-tolerance simplification that would cross a simple ring is rejected', () => {
  const input = toNorm(combM(), FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true, toleranceM: 5, maxAreaChangePct: 1000 });
  assert.equal(result.reason, 'would_self_intersect');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, input);
});

// ── SAFETY INVARIANT: area change stays under maxAreaChangePct ────────────────
// The same comb ring, at a tolerance loose enough to cut straight across the tooth gaps and
// swallow real area — well before it's loose enough to actually self-intersect.

test('SAFETY: a naive simplification that would blow the area budget is rejected', () => {
  const input = toNorm(combM(), FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true, toleranceM: 1.0 }); // default maxAreaChangePct: 2%
  assert.equal(result.reason, 'area_change_exceeded');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, input);
});

// ── SAFETY INVARIANT: no point ends up farther from the result than the tolerance promised ────
// collapseNearCollinear (unlike RDP) only ever checks a point against its CURRENT immediate
// neighbours — if those neighbours are themselves removed later, an earlier removal that looked
// safe at the time can compound into a bigger final deviation than advertised. This ring (a
// noisy near-semicircular arc — real per-point radial noise, not a smooth curve) is a genuine,
// found-by-search instance of that compounding, not a contrived call into private internals.
// maxAreaChangePct is generous here to isolate this guard from the area guard tested above.

function noisyArcRingM(): Array<[number, number]> {
  return [
    [-31.701162, 0.07732], [-31.451124, 2.749989], [-31.345197, 5.444892], [-30.773028, 8.079858],
    [-29.708332, 10.560547], [-28.898917, 13.125129], [-27.42714, 15.38108], [-26.094294, 17.694359],
    [-24.587963, 19.909685], [-22.837075, 21.942506], [-20.869279, 23.765754], [-18.870674, 25.567677],
    [-16.505388, 26.857978], [-14.194623, 28.20421], [-11.829038, 29.488248], [-9.184503, 30.040053],
    [-6.677194, 31.031948], [-4.027904, 31.503931], [-1.342617, 31.655451], [1.34421, 31.693028],
    [3.993284, 31.233152], [6.685508, 31.070588], [9.1743, 30.00668], [11.741154, 29.269166],
    [14.238315, 28.291025], [16.525287, 26.890358], [18.679064, 25.308067], [20.921516, 23.825242],
    [22.689011, 21.800242], [24.498822, 19.837505], [26.303352, 17.836121], [27.413492, 15.373426],
    [28.829692, 13.093689], [29.966685, 10.652385], [30.630327, 8.04239], [30.995911, 5.384218],
    [31.354004, 2.741497], [31.717448, 0.07736], [31.717448, -63.160611], [-31.701162, -63.160611],
  ];
}

test('SAFETY: a compounding local-collinear removal that would exceed the promised tolerance is rejected', () => {
  const input = toNorm(noisyArcRingM(), FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true, toleranceM: 0.434201, maxAreaChangePct: 1000 });
  assert.equal(result.reason, 'movement_exceeded_tolerance');
  assert.equal(result.changed, false);
  assert.deepEqual(result.points, input);
});

// ── invalid input handled gracefully, never throws ─────────────────────────────

test('tidyOutline: an unusable frame (mPerPx <= 0) is refused, not divided-by-zero into garbage', () => {
  const input = toNorm(shakySquareM(10, 0.03, 5), FRAME);
  const result = tidyOutline(input, { frame: { imgW: 100, imgH: 100, mPerPx: 0 }, closed: true });
  assert.equal(result.reason, 'invalid_frame');
  assert.deepEqual(result.points, input);
});

// ── tidyOutlineSummary: the plain-language preview copy the farmer actually reads ──────────────

test('tidyOutlineSummary: a real simplification names how many points go and the honest movement bound', () => {
  const input = toNorm(shakySquareM(10, 0.03, 5), FRAME);
  const result = tidyOutline(input, { frame: FRAME, closed: true });
  const summary = tidyOutlineSummary(result);
  assert.equal(summary, `Removes ${result.removed} of ${input.length} points. Nothing moves more than ${result.maxMovedM.toFixed(1)} m.`);
  assert.match(summary, /^Removes \d+ of \d+ points\. Nothing moves more than \d+\.\d m\.$/);
});

test('tidyOutlineSummary: an already-clean shape gets an honest "nothing to remove" message, not a fabricated count', () => {
  const cleanM: Array<[number, number]> = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const result = tidyOutline(toNorm(cleanM, FRAME), { frame: FRAME, closed: true });
  assert.equal(result.reason, 'already_tidy');
  assert.equal(tidyOutlineSummary(result), 'This outline is already tidy — nothing to remove.');
});

test('tidyOutlineSummary: every TidyOutlineReason has distinct, non-empty copy', () => {
  const input = toNorm(combM(), FRAME);
  const selfIntersect = tidyOutline(input, { frame: FRAME, closed: true, toleranceM: 5, maxAreaChangePct: 1000 });
  const areaExceeded = tidyOutline(input, { frame: FRAME, closed: true, toleranceM: 1.0 });
  const tooFew = tidyOutline(toNorm([[0, 0], [10, 0], [5, 10]], FRAME), { frame: FRAME, closed: true });
  const invalidFrame = tidyOutline(input, { frame: { imgW: 100, imgH: 100, mPerPx: 0 }, closed: true });
  const movementExceeded = tidyOutline(toNorm(noisyArcRingM(), FRAME), {
    frame: FRAME,
    closed: true,
    toleranceM: 0.434201,
    maxAreaChangePct: 1000,
  });
  const messages = [selfIntersect, areaExceeded, tooFew, invalidFrame, movementExceeded].map(tidyOutlineSummary);
  for (const m of messages) assert.ok(m.length > 0);
  assert.equal(new Set(messages).size, messages.length, 'expected every reason to produce distinct copy');
});
