import assert from 'node:assert/strict';
import test from 'node:test';

import { polishedRenderPoints, type RenderPoint } from '@/lib/render-geometry';

function wobble(points: readonly RenderPoint[]): number {
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last[0] - first[0];
  const dy = last[1] - first[1];
  const length = Math.hypot(dx, dy);
  return points.slice(1, -1).reduce(
    (sum, point) => sum + Math.abs(dy * point[0] - dx * point[1] + last[0] * first[1] - last[1] * first[0]) / length,
    0,
  );
}

test('paint-time polish reduces shallow hand jitter without moving line endpoints', () => {
  const shaky: RenderPoint[] = [[0, 0], [20, 2], [40, -2], [60, 2], [80, 0]];
  const polished = polishedRenderPoints(shaky);

  assert.ok(wobble(polished) < wobble(shaky), 'the exported line is no straighter than the hand trace');
  assert.deepEqual(polished[0], shaky[0]);
  assert.deepEqual(polished.at(-1), shaky.at(-1));
});

test('meaningful corners stay exact instead of rounding a building into a blob', () => {
  const steppedBuilding: RenderPoint[] = [
    [0, 0], [40, 0], [40, 16], [28, 16],
    [28, 32], [12, 32], [12, 18], [0, 18],
  ];

  assert.deepEqual(
    polishedRenderPoints(steppedBuilding, { closed: true }),
    steppedBuilding,
  );
});

test('a closed ring stays closed and never changes its point count', () => {
  const ring: RenderPoint[] = [[0, 0], [20, 1], [40, 0], [40, 30], [0, 30], [0, 0]];
  const polished = polishedRenderPoints(ring, { closed: true });

  assert.equal(polished.length, ring.length);
  assert.deepEqual(polished[0], polished.at(-1));
});

test('render polish never mutates the saved geometry it receives', () => {
  const saved: RenderPoint[] = [[0, 0], [20, 2], [40, 0]];
  const snapshot = structuredClone(saved);
  const polished = polishedRenderPoints(saved);

  assert.deepEqual(saved, snapshot);
  assert.notEqual(polished, saved);
  for (let i = 0; i < saved.length; i += 1) assert.notEqual(polished[i], saved[i]);
});

test('every polished point obeys the caller movement cap', () => {
  const shapes: Array<{ points: RenderPoint[]; closed: boolean }> = [
    {
      points: [[0, 0], [20, 4], [40, -3], [60, 2], [80, 0]],
      closed: false,
    },
    {
      points: [[0, 0], [20, 2], [40, 0], [40, 30], [0, 30], [0, 0]],
      closed: true,
    },
  ];
  for (const maxShiftPx of [0, 0.1, 1, 3.5, 20]) {
    for (const { points, closed } of shapes) {
      const result = polishedRenderPoints(points, { closed, maxShiftPx, maxTurnDeg: 180 });
      assert.equal(result.length, points.length);
      for (let index = 0; index < points.length; index++) {
        assert.ok(
          Math.hypot(
            result[index][0] - points[index][0],
            result[index][1] - points[index][1],
          ) <= maxShiftPx + 1e-9,
        );
      }
    }
  }
});

test('invalid options cannot manufacture non-finite render geometry', () => {
  const points: RenderPoint[] = [[0, 0], [20, 2], [40, 0]];
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    const shiftResult = polishedRenderPoints(points, { maxShiftPx: invalid });
    const turnResult = polishedRenderPoints(points, { maxTurnDeg: invalid });
    for (const result of [shiftResult, turnResult]) {
      assert.equal(result.length, points.length);
      assert.ok(result.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
    }
  }
});

test('a non-finite point set is refused instead of passed to a canvas path', () => {
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ]) {
    assert.deepEqual(
      polishedRenderPoints([[0, 0], [10, invalid], [20, 0]]),
      [],
    );
  }
});
