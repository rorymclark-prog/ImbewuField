import test from 'node:test';
import assert from 'node:assert/strict';

import {
  rectFromCorners,
  pointInRect,
  itemCenterInRect,
  anyVertexInRect,
  clampGroupDelta,
} from '../lib/marquee.ts';

// rectFromCorners — a marquee drag can go in any of the 4 directions from its pointer-down
// origin; the resulting rect must always normalise to min/max regardless of drag direction.
test('rectFromCorners: normalises regardless of drag direction (down-right)', () => {
  assert.deepEqual(rectFromCorners([0.1, 0.2], [0.6, 0.8]), { minX: 0.1, minY: 0.2, maxX: 0.6, maxY: 0.8 });
});

test('rectFromCorners: normalises regardless of drag direction (up-left)', () => {
  assert.deepEqual(rectFromCorners([0.6, 0.8], [0.1, 0.2]), { minX: 0.1, minY: 0.2, maxX: 0.6, maxY: 0.8 });
});

test('rectFromCorners: normalises a mixed diagonal (down-left)', () => {
  assert.deepEqual(rectFromCorners([0.6, 0.2], [0.1, 0.8]), { minX: 0.1, minY: 0.2, maxX: 0.6, maxY: 0.8 });
});

test('rectFromCorners: degenerate (zero-size) rect from equal corners', () => {
  assert.deepEqual(rectFromCorners([0.4, 0.4], [0.4, 0.4]), { minX: 0.4, minY: 0.4, maxX: 0.4, maxY: 0.4 });
});

const RECT = { minX: 0.2, minY: 0.2, maxX: 0.6, maxY: 0.6 };

test('pointInRect: a point well inside is inside', () => {
  assert.equal(pointInRect([0.4, 0.4], RECT), true);
});

test('pointInRect: a point well outside is outside', () => {
  assert.equal(pointInRect([0.9, 0.9], RECT), false);
});

test('pointInRect: exactly on the min edge counts as inside (inclusive)', () => {
  assert.equal(pointInRect([0.2, 0.4], RECT), true);
});

test('pointInRect: exactly on the max edge counts as inside (inclusive)', () => {
  assert.equal(pointInRect([0.6, 0.6], RECT), true);
});

test('pointInRect: inside on x but outside on y is outside', () => {
  assert.equal(pointInRect([0.4, 0.9], RECT), false);
});

// itemCenterInRect is a thin named wrapper over pointInRect for PlacedItem's x/y centre —
// table-driven over a few placements to lock in the "centre, not footprint" rule.
const itemCenterCases: Array<{ name: string; x: number; y: number; want: boolean }> = [
  { name: 'centre inside the rect', x: 0.4, y: 0.4, want: true },
  { name: 'centre outside the rect (item footprint might still overlap, ignored)', x: 0.61, y: 0.4, want: false },
  { name: 'centre exactly on the rect boundary', x: 0.2, y: 0.3, want: true },
];
for (const c of itemCenterCases) {
  test(`itemCenterInRect: ${c.name}`, () => {
    assert.equal(itemCenterInRect(c.x, c.y, RECT), c.want);
  });
}

// anyVertexInRect — table-driven over rings/lines that are fully inside, fully outside, and
// straddling the marquee (only one vertex caught).
const vertexCases: Array<{ name: string; points: Array<[number, number]>; want: boolean }> = [
  { name: 'all vertices inside', points: [[0.3, 0.3], [0.4, 0.3], [0.4, 0.4]], want: true },
  { name: 'all vertices outside, ring not touching rect', points: [[0.9, 0.9], [0.95, 0.9], [0.95, 0.95]], want: false },
  { name: 'one vertex inside, rest outside (straddling shape)', points: [[0.1, 0.1], [0.4, 0.4], [0.9, 0.9]], want: true },
  { name: 'a large shape whose vertices surround but never enter the rect', points: [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]], want: false },
  { name: 'empty points array', points: [], want: false },
  { name: 'single point exactly on the rect edge', points: [[0.6, 0.5]], want: true },
];
for (const c of vertexCases) {
  test(`anyVertexInRect: ${c.name}`, () => {
    assert.equal(anyVertexInRect(c.points, RECT), c.want);
  });
}

// clampGroupDelta — the group-move rigidity contract: every point in the group must land in
// [0,1] after the SAME delta is applied to all of them, and the delta returned is the tightest
// one that keeps the whole group legal (never a per-point distortion).
test('clampGroupDelta: unconstrained delta passes through unchanged', () => {
  const points: Array<[number, number]> = [[0.4, 0.4], [0.5, 0.5]];
  assert.deepEqual(clampGroupDelta(points, 0.05, -0.05), [0.05, -0.05]);
});

function assertCloseTuple(actual: [number, number], expected: [number, number]): void {
  assert.ok(Math.abs(actual[0] - expected[0]) < 1e-9, `dx: ${actual[0]} !~ ${expected[0]}`);
  assert.ok(Math.abs(actual[1] - expected[1]) < 1e-9, `dy: ${actual[1]} !~ ${expected[1]}`);
}

test('clampGroupDelta: positive dx clamped by the point nearest the right/bottom edge', () => {
  const points: Array<[number, number]> = [[0.1, 0.1], [0.9, 0.85]]; // second point: room is 0.1 right, 0.15 down
  assertCloseTuple(clampGroupDelta(points, 0.5, 0.5), [0.1, 0.15]);
});

test('clampGroupDelta: negative dx/dy clamped by the point nearest the left/top edge', () => {
  const points: Array<[number, number]> = [[0.1, 0.2], [0.9, 0.9]]; // first point: room is -0.1 left, -0.2 up
  assertCloseTuple(clampGroupDelta(points, -0.5, -0.5), [-0.1, -0.2]);
});

test('clampGroupDelta: rigidity — the SAME clamped delta applies to every point, so relative spacing is preserved', () => {
  const points: Array<[number, number]> = [[0.05, 0.5], [0.95, 0.5]]; // spans nearly the whole width
  const [dx] = clampGroupDelta(points, 0.5, 0); // wants to push right; second point only has ~0.05 of room
  assert.ok(Math.abs(dx - 0.05) < 1e-9);
  // Applying the SAME dx to both keeps their 0.9 separation intact (float-tolerant).
  assert.ok(Math.abs((0.95 + dx) - (0.05 + dx) - 0.9) < 1e-9);
});

test('clampGroupDelta: a group already flush against both edges on an axis has zero room on that axis', () => {
  const points: Array<[number, number]> = [[0.0, 0.4], [1.0, 0.6]];
  assert.deepEqual(clampGroupDelta(points, 0.3, 0.1), [0, 0.1]);
  assert.deepEqual(clampGroupDelta(points, -0.3, -0.1), [0, -0.1]);
});

test('clampGroupDelta: zero delta is always a no-op regardless of position', () => {
  assert.deepEqual(clampGroupDelta([[0, 0], [1, 1]], 0, 0), [0, 0]);
});

test('clampGroupDelta: empty points array is a no-op (nothing to clamp against)', () => {
  assert.deepEqual(clampGroupDelta([], 5, -5), [0, 0]);
});

test('clampGroupDelta: single point far from any edge clamps to the requested delta', () => {
  assert.deepEqual(clampGroupDelta([[0.5, 0.5]], 0.3, -0.2), [0.3, -0.2]);
});

test('clampGroupDelta: a point already at the exact edge allows zero further movement in that direction', () => {
  assert.deepEqual(clampGroupDelta([[0, 0.5]], -0.1, 0), [0, 0]);
  assert.deepEqual(clampGroupDelta([[1, 0.5]], 0.1, 0), [0, 0]);
});
