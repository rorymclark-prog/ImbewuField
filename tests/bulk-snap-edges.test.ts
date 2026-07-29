import test from 'node:test';
import assert from 'node:assert/strict';

import {
  snapSelectedRings,
  snapSelectedRingsSummary,
  type BulkSnapRing,
} from '../lib/bulk-snap-edges.ts';

const FRAME = { imgW: 100, imgH: 100, mPerPx: 1 };
const toNorm = (points: Array<[number, number]>): Array<[number, number]> =>
  points.map(([x, y]) => [x / 100, y / 100]);
const square = (x: number, y: number, size: number): Array<[number, number]> =>
  [[x, y], [x + size, y], [x + size, y + size], [x, y + size]];
const ring = (id: string, label: string, points: Array<[number, number]>, kind: BulkSnapRing['kind'] = 'zone'): BulkSnapRing => ({
  id,
  label,
  kind,
  points: toNorm(points),
});

test('every selected ring that passes the single-ring guards snaps in one batch', () => {
  const a = ring('a', 'Zone 1', square(0, 0, 10));
  const aNeighbour = ring('a-neighbour', 'Zone 2', square(10.2, 0, 10));
  const b = ring('b', 'Zone 3', square(40, 40, 10));
  const bNeighbour = ring('b-neighbour', 'Zone 4', square(50.2, 40, 10));
  const result = snapSelectedRings([a, b], [a, aNeighbour, b, bNeighbour], { frame: FRAME });

  assert.equal(result.changed, true);
  assert.deepEqual(result.updates.map((update) => update.id), ['a', 'b']);
  assert.equal(result.skipped.length, 0);
  assert.match(snapSelectedRingsSummary(result), /Snaps Zone 1, Zone 3/);
});

test('one unsafe ring stays byte-identical while another selected ring still moves', () => {
  const safe = ring('safe', 'Safe zone', square(40, 40, 10));
  const safeNeighbour = ring('safe-neighbour', 'Safe neighbour', square(50.2, 40, 10));
  const risky = ring('risky', 'Risky zone', [[0, 0], [10, 0], [10, 10], [5, 0.3], [0, 10]]);
  const riskyNeighbour = ring('risky-neighbour', 'Risky neighbour', [[4, -0.15], [6, -0.15]]);
  const before = JSON.stringify(risky.points);
  const result = snapSelectedRings(
    [safe, risky],
    [safe, safeNeighbour, risky, riskyNeighbour],
    { frame: FRAME, toleranceM: 0.5, maxAreaChangePct: 1000 },
  );

  assert.deepEqual(result.updates.map((update) => update.id), ['safe']);
  assert.deepEqual(result.skipped, [{ id: 'risky', label: 'Risky zone', reason: 'would_self_intersect' }]);
  assert.equal(JSON.stringify(risky.points), before, 'a vetoed ring must remain byte-identical');
  assert.match(snapSelectedRingsSummary(result), /Leaves unchanged: Risky zone \(would cross itself\)/);
});

test('a selected property boundary is named as unchanged and never dragged into a zone', () => {
  const boundary = ring('boundary', 'Property boundary', square(0, 0, 30), 'boundary');
  const zone = ring('zone', 'Zone 1', square(40, 40, 10));
  const neighbour = ring('neighbour', 'Zone 2', square(50.2, 40, 10));
  const before = JSON.stringify(boundary.points);
  const result = snapSelectedRings([boundary, zone], [boundary, zone, neighbour], { frame: FRAME });

  assert.equal(result.updates.some((update) => update.id === boundary.id), false);
  assert.deepEqual(result.skipped.find((entry) => entry.id === boundary.id), {
    id: 'boundary',
    label: 'Property boundary',
    reason: 'boundary_excluded',
  });
  assert.equal(JSON.stringify(boundary.points), before);
  assert.match(snapSelectedRingsSummary(result), /Property boundary \(property boundary never moves\)/);
});
