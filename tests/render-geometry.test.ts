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

// A SWALE IS A DITCH AND A BERM. offsetPolyline is what lets the Earthworks sheet draw those two
// halves either side of the pegged contour instead of one thick stroke (Rory: "its just a path
// naow thin and scraggly but swale is made up of the ditch and berm"). The saved centreline is
// the farmer's surveyed contour, so the one thing this must never do is move it.
test('offsetPolyline shifts a copy to a consistent side and never touches the saved centreline', async () => {
  const { offsetPolyline } = await import('@/lib/water-cartography');
  const centreline: Array<[number, number]> = [[0, 0], [10, 0], [20, 0]];
  const frozen = JSON.parse(JSON.stringify(centreline));

  const right = offsetPolyline(centreline, -4);
  const left = offsetPolyline(centreline, 4);

  assert.deepEqual(centreline, frozen, 'the surveyed contour must never be mutated for drawing');
  // Horizontal run: the two offsets land on opposite sides, each a clean 4 units away.
  for (let i = 0; i < centreline.length; i++) {
    assert.equal(right[i][0], centreline[i][0], 'a straight run must not drift along its own axis');
    assert.equal(left[i][0], centreline[i][0]);
    assert.ok(Math.abs(right[i][1] - centreline[i][1]) - 4 < 1e-9);
    assert.ok(Math.abs(left[i][1] - centreline[i][1]) - 4 < 1e-9);
    assert.ok((right[i][1] - centreline[i][1]) * (left[i][1] - centreline[i][1]) < 0,
      'ditch and berm must end up on OPPOSITE sides, or the swale renders as one lopsided band');
  }
});

test('offsetPolyline bisects a corner instead of kinking, and survives degenerate input', async () => {
  const { offsetPolyline } = await import('@/lib/water-cartography');
  // A right-angle bend: the offset vertex must sit on the corner's bisector, further from the
  // original than a straight-run offset would be — that's what keeps the bank width even round a
  // bend rather than pinching to nothing.
  const bend: Array<[number, number]> = [[0, 0], [10, 0], [10, 10]];
  const out = offsetPolyline(bend, 4);
  const moved = Math.hypot(out[1][0] - bend[1][0], out[1][1] - bend[1][1]);
  assert.ok(moved > 3.9, `corner vertex should still be offset (was ${moved})`);

  // Degenerate inputs return the geometry unchanged rather than NaN coordinates, which would
  // silently blank the whole line on the canvas.
  assert.deepEqual(offsetPolyline([[1, 2]], 4), [[1, 2]]);
  assert.deepEqual(offsetPolyline([], 4), []);
  const duplicate: Array<[number, number]> = [[5, 5], [5, 5]];
  for (const [x, y] of offsetPolyline(duplicate, 4)) {
    assert.ok(Number.isFinite(x) && Number.isFinite(y), 'repeated points must not produce NaN');
  }
});
