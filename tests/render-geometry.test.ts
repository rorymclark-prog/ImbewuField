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
