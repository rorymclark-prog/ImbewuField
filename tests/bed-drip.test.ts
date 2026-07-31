import test from 'node:test';
import assert from 'node:assert/strict';

import { dripLinesForBeds, bedDripSummary, pointInBed, type DripBed } from '../lib/bed-drip';

// 960×640 logical frame at 0.1 m/px = a 96 m × 64 m site — the canvas's own convention.
const frame = { imgW: 960, imgH: 640, mPerPx: 0.1 };
const mx = frame.imgW * frame.mPerPx; // metres per normalised x
const my = frame.imgH * frame.mPerPx; // metres per normalised y

const bed = (over: Partial<DripBed> = {}): DripBed => ({
  id: 'b1', x: 0.5, y: 0.5, wM: 1.2, hM: 3, ...over,
});

/** Length of a normalised segment, in metres. */
const lengthM = ([a, b]: [[number, number], [number, number]]): number =>
  Math.hypot((b[0] - a[0]) * mx, (b[1] - a[1]) * my);

/** Direction of a normalised segment in metre space, degrees clockwise from east. */
const bearing = ([a, b]: [[number, number], [number, number]]): number => {
  const deg = (Math.atan2((b[1] - a[1]) * my, (b[0] - a[0]) * mx) * 180) / Math.PI;
  return ((deg % 180) + 180) % 180;
};

test('a lateral runs down the LONG axis of the bed, not across it', () => {
  const r = dripLinesForBeds([bed()], [], frame);
  assert.equal(r.lines.length, 1);
  // veg_bed is 1.2 across × 3 along, and at rot 0 the long side runs down the screen — so the
  // line must be vertical (90°), not horizontal. This is the one that is easy to get backwards.
  assert.ok(Math.abs(bearing(r.lines[0].points) - 90) < 0.001, 'the lateral is crossing its bed');
});

test('it runs nearly the whole bed, stopping just short of each end', () => {
  const r = dripLinesForBeds([bed()], [], frame);
  const len = lengthM(r.lines[0].points);
  assert.ok(len < 3, 'a lateral that reaches the very ends reads as a fence running past the bed');
  assert.ok(len > 3 * 0.8, `only ${len.toFixed(2)} m of a 3 m bed is watered`);
});

test('it stays centred on the bed', () => {
  const r = dripLinesForBeds([bed({ x: 0.3, y: 0.7 })], [], frame);
  const [a, b] = r.lines[0].points;
  assert.ok(Math.abs((a[0] + b[0]) / 2 - 0.3) < 1e-9);
  assert.ok(Math.abs((a[1] + b[1]) / 2 - 0.7) < 1e-9);
});

test('a rotated bed gets a rotated lateral, still down its length', () => {
  for (const rot of [30, 90, 135, -45]) {
    const r = dripLinesForBeds([bed({ rot })], [], frame);
    const expected = ((90 + rot) % 180 + 180) % 180;
    assert.ok(
      Math.abs(bearing(r.lines[0].points) - expected) < 0.001,
      `bed at ${rot}° got a lateral at ${bearing(r.lines[0].points).toFixed(1)}°, expected ${expected}`,
    );
    // …and the whole line is still inside the bed it belongs to.
    for (const p of r.lines[0].points) {
      assert.ok(pointInBed(bed({ rot }), p, frame), `an endpoint fell outside the bed at ${rot}°`);
    }
  }
});

test('a bed resized wider than it is long still gets its lateral down the long side', () => {
  // A farmer can drag a bed to 4 m across by 1 m along. The long side is now wM.
  const r = dripLinesForBeds([bed({ wM: 4, hM: 1 })], [], frame);
  assert.ok(Math.abs(bearing(r.lines[0].points) - 0) < 0.001, 'lateral should run east–west here');
  assert.ok(lengthM(r.lines[0].points) > 3, 'and should be nearly 4 m long');
});

test('pressing it twice does not double the drip', () => {
  const beds = [bed({ id: 'a' }), bed({ id: 'b', x: 0.7 })];
  const first = dripLinesForBeds(beds, [], frame);
  assert.equal(first.lines.length, 2);
  const second = dripLinesForBeds(beds, first.lines.map((l) => ({ points: l.points })), frame);
  assert.equal(second.lines.length, 0);
  assert.equal(second.changed, false);
  assert.equal(second.skipped.filter((s) => s.reason === 'already_watered').length, 2);
});

test('a bed added after the first press is the only one that gets a new lateral', () => {
  const first = dripLinesForBeds([bed({ id: 'a' })], [], frame);
  const r = dripLinesForBeds(
    [bed({ id: 'a' }), bed({ id: 'new', x: 0.8 })],
    first.lines.map((l) => ({ points: l.points })),
    frame,
  );
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].bedId, 'new');
});

test('a mainline CROSSING a bed does not count as watering it', () => {
  // A pipe on its way somewhere else, clipping the bed sideways. If this counted, a mainline laid
  // along the head of a block would leave every bed in that block with no lateral at all.
  const passing = [{ points: [[0.4, 0.5], [0.6, 0.5]] as Array<[number, number]> }];
  const r = dripLinesForBeds([bed({ id: 'a' })], passing, frame);
  assert.equal(r.lines.length, 1, 'a bed a pipe merely crosses still needs its own lateral');
});

test('a line running ALONG a bed does count, even when both its ends are outside', () => {
  // Both endpoints are well clear of the 3 m bed, but it runs its whole length. Checking only the
  // endpoints missed this and would have laid a second line underneath the first.
  const along = [{ points: [[0.5, 0.45], [0.5, 0.55]] as Array<[number, number]> }];
  const r = dripLinesForBeds([bed({ id: 'a' })], along, frame);
  assert.equal(r.lines.length, 0);
  assert.equal(r.skipped[0].reason, 'already_watered');
});

test('round beds are left for the farmer, not crossed with a chord', () => {
  const r = dripLinesForBeds([bed({ id: 'spiral', round: true, wM: 2, hM: 2 })], [], frame);
  assert.equal(r.lines.length, 0);
  assert.equal(r.skipped[0].reason, 'round');
  assert.match(bedDripSummary(r), /round beds/i);
});

test('nonsense beds are skipped rather than producing NaN geometry', () => {
  const r = dripLinesForBeds(
    [
      bed({ id: 'nan', x: Number.NaN }),
      bed({ id: 'zero', wM: 0, hM: 0 }),
      bed({ id: 'tiny', wM: 0.2, hM: 0.2 }),
    ],
    [],
    frame,
  );
  assert.equal(r.lines.length, 0);
  assert.equal(r.skipped.length, 3);
  assert.ok(r.skipped.every((s) => s.reason === 'too_small'));
});

test('a broken frame produces nothing rather than a line at infinity', () => {
  const r = dripLinesForBeds([bed()], [], { ...frame, mPerPx: 0 });
  assert.equal(r.changed, false);
  assert.equal(r.lines.length, 0);
});

test('the summary always says the mainline is still the farmer’s job', () => {
  const r = dripLinesForBeds([bed()], [], frame);
  assert.match(bedDripSummary(r), /Runs drip down the centre of 1 bed/);
  assert.match(bedDripSummary(r), /mainline/i);
});

test('every no-op has its own sentence, so "nothing happened" never looks like a bug', () => {
  const lines = new Set([
    bedDripSummary({ lines: [], skipped: [], changed: false }),
    bedDripSummary({ lines: [], skipped: [{ bedId: 'a', reason: 'already_watered' }], changed: false }),
    bedDripSummary({ lines: [], skipped: [{ bedId: 'a', reason: 'round' }], changed: false }),
  ]);
  assert.equal(lines.size, 3);
  for (const l of lines) assert.ok(l.length > 0);
});
