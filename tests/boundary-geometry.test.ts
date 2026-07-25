import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gateBoundaryBreak,
  gateBoundaryBreaks,
  boundarySegmentsWithBreaks,
} from '../lib/boundary-geometry.ts';

// A 100m x 100m square, normalized 0..1 coordinates, mPerPx=1 so meters = normalized * imgW/imgH.
// Vertices sit at arc-length 0, 100, 200, 300 (perimeter 400m).
const SQUARE: Array<[number, number]> = [[0, 0], [1, 0], [1, 1], [0, 1]];
const FRAME = { imgW: 100, imgH: 100, mPerPx: 1 };

test('a gate on the boundary line gets a centred break at its real width', () => {
  const gate = { x: 0.5, y: 0, wM: 4 }; // midpoint of the bottom edge, 4m wide
  const b = gateBoundaryBreak(SQUARE, gate, FRAME);
  assert.ok(b);
  assert.ok(Math.abs(b!.startArc - 48) < 0.01);
  assert.ok(Math.abs(b!.endArc - 52) < 0.01);
});

test('a gate far from the boundary (e.g. placed inside the property) breaks nothing', () => {
  const gate = { x: 0.5, y: 0.5, wM: 4 }; // dead centre, 50m from any edge
  assert.equal(gateBoundaryBreak(SQUARE, gate, FRAME, 3), null);
});

test('an unsized gate falls back to a plausible walk-through width, never absurdly wide', () => {
  const gate = { x: 0, y: 0.5 }; // midpoint of the left edge, no wM saved
  const b = gateBoundaryBreak(SQUARE, gate, FRAME);
  assert.ok(b);
  assert.ok(b!.endArc - b!.startArc <= 3.01); // default width 3m, half either side
});

test('a gate never eats more than 40% of a very short boundary run', () => {
  const tiny: Array<[number, number]> = [[0, 0], [0.02, 0], [0.02, 0.02], [0, 0.02]]; // 2m x 2m, perimeter 8m
  const gate = { x: 0.01, y: 0, wM: 50 }; // absurdly oversized for this plot
  const b = gateBoundaryBreak(tiny, gate, FRAME, 5);
  assert.ok(b);
  assert.ok(b!.endArc - b!.startArc <= 8 * 0.4 + 0.01);
});

test('a degenerate (<3 point) boundary never produces a break', () => {
  assert.equal(gateBoundaryBreak([[0, 0], [1, 1]], { x: 0.5, y: 0.5 }, FRAME), null);
});

test('gateBoundaryBreaks filters out gates too far from the boundary, keeps the rest', () => {
  const gates = [
    { x: 0.5, y: 0, wM: 4 }, // on the boundary
    { x: 0.5, y: 0.5, wM: 4 }, // dead centre — filtered
  ];
  const breaks = gateBoundaryBreaks(SQUARE, gates, FRAME);
  assert.equal(breaks.length, 1);
});

test('no breaks returns the boundary as one closed loop', () => {
  const segs = boundarySegmentsWithBreaks(SQUARE, FRAME, []);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].length, SQUARE.length + 1); // closed: first point repeated at the end
  assert.deepEqual(segs[0][0], segs[0][segs[0].length - 1]);
});

test('a break in the middle of one edge splits the ring into two runs at the arc-zero seam', () => {
  // Documented, accepted behaviour: the break itself falls entirely on the first edge, so the
  // continuous remaining run gets split into two adjacent sub-polylines at boundary[0]'s arc-zero
  // point rather than stitched into one — see boundarySegmentsWithBreaks's own doc comment.
  const segs = boundarySegmentsWithBreaks(SQUARE, FRAME, [{ startArc: 48, endArc: 52 }]);
  assert.equal(segs.length, 2);
  const totalPoints = segs.reduce((n, s) => n + s.length, 0);
  assert.ok(totalPoints > 0);
  // Neither run's endpoints fall inside the break.
  for (const seg of segs) {
    for (const [x, y] of seg) {
      const meterX = x * FRAME.imgW;
      assert.ok(meterX < 48.001 || meterX > 51.999 || y > 0.001, `point ${x},${y} lands inside the break`);
    }
  }
});

test('a break that wraps past the boundary start produces exactly one continuous kept run', () => {
  // The gate sits right at the corner (arc ~0), so the break itself straddles the wrap point —
  // subtracting it leaves one single clean arc, not two, unlike the mid-edge case above.
  const segs = boundarySegmentsWithBreaks(SQUARE, FRAME, [{ startArc: -2, endArc: 2 }]);
  assert.equal(segs.length, 1);
});

test('two adjacent gate breaks are each respected independently (not silently merged)', () => {
  const segs = boundarySegmentsWithBreaks(SQUARE, FRAME, [
    { startArc: 20, endArc: 24 },
    { startArc: 60, endArc: 64 },
  ]);
  // Two breaks on the same edge, neither touching the wrap point → three kept runs.
  assert.equal(segs.length, 3);
});

test('a boundary with fewer than 3 points yields no segments to draw', () => {
  assert.deepEqual(boundarySegmentsWithBreaks([[0, 0], [1, 1]], FRAME, []), []);
});
