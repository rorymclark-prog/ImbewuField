import test from 'node:test';
import assert from 'node:assert/strict';

import { squareUp, squareUpSummary } from '../lib/square-up';

// 960×640 logical frame at 0.1 m per pixel = a 96 m × 64 m site. Same convention as the canvas.
const frame = { imgW: 960, imgH: 640, mPerPx: 0.1 };

/** Build a normalised ring from metre coordinates on this frame. */
const ring = (pts: Array<[number, number]>): Array<[number, number]> =>
  pts.map(([mx, my]) => [mx / (frame.imgW * frame.mPerPx), my / (frame.imgH * frame.mPerPx)] as [number, number]);

/** Interior angles of a closed ring, in degrees. */
function angles(points: Array<[number, number]>): number[] {
  const m = points.map(([x, y]) => [x * frame.imgW * frame.mPerPx, y * frame.imgH * frame.mPerPx] as [number, number]);
  return m.map((_, i) => {
    const prev = m[(i - 1 + m.length) % m.length];
    const here = m[i];
    const next = m[(i + 1) % m.length];
    const a = Math.atan2(prev[1] - here[1], prev[0] - here[0]);
    const b = Math.atan2(next[1] - here[1], next[0] - here[0]);
    let d = ((b - a) * 180) / Math.PI;
    while (d < 0) d += 360;
    return d > 180 ? 360 - d : d;
  });
}

test('a finger-traced rectangle comes back with true right angles', () => {
  // Four corners aimed at a 20×10 m slab, each off by up to a metre — what a fingertip produces.
  const traced = ring([[10, 10], [30.6, 9.2], [31.1, 19.4], [9.4, 20.2]]);
  const r = squareUp(traced, { frame });
  assert.equal(r.reason, 'squared');
  assert.equal(r.changed, true);
  for (const a of angles(r.points)) {
    assert.ok(Math.abs(a - 90) < 0.5, `corner came out at ${a.toFixed(2)}°, not square`);
  }
});

test('squaring reports how far it moved anything, and stays modest', () => {
  const traced = ring([[10, 10], [30.6, 9.2], [31.1, 19.4], [9.4, 20.2]]);
  const r = squareUp(traced, { frame });
  assert.ok(r.maxMovedM > 0, 'a change that moves nothing is not a change');
  assert.ok(r.maxMovedM < 1.5, `moved ${r.maxMovedM.toFixed(2)} m — more than a farmer would accept silently`);
  assert.match(squareUpSummary(r), /Squares the corners/);
});

test('an L-shaped building stays L-shaped — this is not rectangle-fitting', () => {
  const traced = ring([[10, 10], [30, 9.6], [30.4, 20], [20.2, 19.7], [19.8, 30], [9.6, 29.6]]);
  const r = squareUp(traced, { frame });
  assert.equal(r.reason, 'squared');
  assert.equal(r.points.length, 6, 'squaring must not drop or add corners');
  for (const a of angles(r.points)) {
    assert.ok(Math.abs(a - 90) < 0.5, `corner came out at ${a.toFixed(2)}°`);
  }
});

test('a rotated building squares onto ITS OWN grid, not onto north', () => {
  // A 20×10 slab turned 30°, then jittered.
  const rad = (30 * Math.PI) / 180;
  const rect: Array<[number, number]> = [[0, 0], [20, 0], [20, 10], [0, 10]];
  const jitter = [[0.3, -0.2], [-0.25, 0.35], [0.2, 0.3], [-0.3, -0.25]];
  const turned = rect.map(([x, y], i) => [
    20 + x * Math.cos(rad) - y * Math.sin(rad) + jitter[i][0],
    15 + x * Math.sin(rad) + y * Math.cos(rad) + jitter[i][1],
  ] as [number, number]);
  const r = squareUp(ring(turned), { frame });
  assert.equal(r.reason, 'squared');
  for (const a of angles(r.points)) {
    assert.ok(Math.abs(a - 90) < 0.5, `corner came out at ${a.toFixed(2)}°`);
  }
});

// ── The refusals. These are the whole reason the feature is safe to put on a shared button. ────

test('a contour or an organic boundary is LEFT ALONE, not flattened', () => {
  // An arc — a swale following a contour. Squaring this would destroy real traced information.
  const arc: Array<[number, number]> = [];
  for (let i = 0; i <= 8; i += 1) {
    const t = (i / 8) * Math.PI;
    arc.push([30 + 20 * Math.cos(t), 30 + 12 * Math.sin(t)]);
  }
  const r = squareUp(ring(arc), { frame });
  assert.equal(r.reason, 'not_rectilinear');
  assert.equal(r.changed, false);
  assert.match(squareUpSummary(r), /not meant to be a rectangle/);
});

test('an already-square outline is declined rather than costing an undo entry', () => {
  const r = squareUp(ring([[10, 10], [30, 10], [30, 20], [10, 20]]), { frame });
  assert.equal(r.reason, 'already_square');
  assert.equal(r.changed, false);
});

test('a triangle is not squared', () => {
  const r = squareUp(ring([[10, 10], [30, 10], [20, 25]]), { frame });
  assert.equal(r.reason, 'too_few_points');
  assert.equal(r.changed, false);
});

test('a result that would drag a corner too far is discarded whole', () => {
  const traced = ring([[10, 10], [30.6, 9.2], [31.1, 19.4], [9.4, 20.2]]);
  const r = squareUp(traced, { frame, toleranceM: 0.05 });
  assert.equal(r.reason, 'movement_exceeded_tolerance');
  assert.equal(r.changed, false);
  // …and hands back the very array it was given, so a caller can compare by reference.
  assert.equal(r.points, traced);
});

test('rubbish in, original out — never NaN coordinates', () => {
  const bad = [[0.1, 0.1], [Number.NaN, 0.2], [0.3, 0.3], [0.1, 0.3]] as Array<[number, number]>;
  const r = squareUp(bad, { frame });
  assert.equal(r.changed, false);
  assert.equal(r.points, bad);
  const badFrame = squareUp(ring([[10, 10], [30, 9], [30, 20], [10, 21]]), { frame: { ...frame, mPerPx: 0 } });
  assert.equal(badFrame.changed, false);
});

test('a declined result never reports movement it did not make', () => {
  for (const r of [
    squareUp(ring([[10, 10], [30, 10], [20, 25]]), { frame }),
    squareUp(ring([[10, 10], [30, 10], [30, 20], [10, 20]]), { frame }),
  ]) {
    assert.equal(r.maxMovedM, 0);
    assert.equal(r.changed, false);
  }
});

test('every reason has its own sentence — none falls through to the generic one', () => {
  const reasons = ['squared', 'already_square', 'not_rectilinear', 'too_few_points', 'movement_exceeded_tolerance', 'degenerate'] as const;
  const seen = new Set<string>();
  for (const reason of reasons) {
    const line = squareUpSummary({ points: [], changed: reason === 'squared', reason, maxMovedM: 0.4, worstOffSquareDeg: 6 });
    assert.ok(line.length > 0);
    seen.add(line);
  }
  assert.equal(seen.size, reasons.length, 'two reasons share a sentence — the farmer cannot tell them apart');
});
