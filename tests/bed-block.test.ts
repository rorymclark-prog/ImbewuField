import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bedBlockFootprintM,
  layoutBedBlock,
  normaliseBedBlockSpec,
  MAX_BED_COUNT,
} from '../lib/bed-block.ts';

// A block of beds is the one placement where being subtly wrong is invisible: seven beds at a
// slightly wrong spacing still LOOK like a bed block. So the assertions here are metric — real
// distances on the ground — rather than "it produced seven things".

const IMG_W = 1200;
const IMG_H = 800;
const M_PER_PX = 0.05; // 20 px per metre — round numbers make the expectations readable
const SPEC = { bedLengthM: 10, bedWidthM: 1, pathWidthM: 0.5, count: 3 };

/** Ground distance in metres between two normalised points. */
function metresBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = (a.x - b.x) * IMG_W;
  const dy = (a.y - b.y) * IMG_H;
  return Math.hypot(dx, dy) * M_PER_PX;
}

test('neighbouring beds sit exactly one bed width plus one path apart, on the ground', () => {
  const beds = layoutBedBlock(SPEC, [0.2, 0.2], 0, M_PER_PX, IMG_W, IMG_H);
  assert.equal(beds.length, 3);
  // 1 m bed + 0.5 m path = 1.5 m centre to centre. Getting this wrong by one path width is the
  // classic off-by-one here and it still looks like a tidy block.
  assert.ok(Math.abs(metresBetween(beds[0], beds[1]) - 1.5) < 1e-9);
  assert.ok(Math.abs(metresBetween(beds[1], beds[2]) - 1.5) < 1e-9);
});

test('the anchor is the block CORNER — bed one is half a bed in from it, not centred on it', () => {
  // The farmer taps a corner of the plot; the block grows away from that point. If the anchor
  // were treated as a centre the whole block would sit half its width off the tapped corner.
  const beds = layoutBedBlock(SPEC, [0.2, 0.2], 0, M_PER_PX, IMG_W, IMG_H);
  const anchorPt = { x: 0.2, y: 0.2 };
  // At angle 0 the length runs east, the width steps south: bed 1's centre is 5 m east
  // (half of 10) and 0.5 m south (half of 1).
  const eastM = (beds[0].x - anchorPt.x) * IMG_W * M_PER_PX;
  const southM = (beds[0].y - anchorPt.y) * IMG_H * M_PER_PX;
  assert.ok(Math.abs(eastM - 5) < 1e-9, `east ${eastM}`);
  assert.ok(Math.abs(southM - 0.5) < 1e-9, `south ${southM}`);
});

test('a bed is emitted width-across by length-along, and rotated to match the element\'s natural axis', () => {
  // A bed def is wM across by hM along (veg_bed is 1.2 x 3), so at rot 0 its length already runs
  // DOWN the screen — 90 degrees. Emitting rot = angleDeg would lay every block out square to
  // the aim direction, off by a quarter turn, which still looks like a plausible bed block.
  const beds = layoutBedBlock(SPEC, [0.5, 0.5], 0, M_PER_PX, IMG_W, IMG_H);
  assert.equal(beds[0].wM, 1);
  assert.equal(beds[0].hM, 10);
  assert.equal(beds[0].rot, 270); // 0 - 90, normalised
  const aimed = layoutBedBlock(SPEC, [0.5, 0.5], 90, M_PER_PX, IMG_W, IMG_H);
  // Aiming the length down the screen IS the natural orientation, and normaliseRotation returns
  // undefined there on purpose — that is what keeps a meaningless `rot: 0` out of every saved
  // item. Asserting 0 here would be asserting against the codebase's own storage convention.
  assert.equal(aimed[0].rot, undefined);
});

test('rotating the block preserves every ground distance — no shear on a non-square frame', () => {
  // Normalised x and y divide by different numbers (1200 vs 800). Rotating in normalised space
  // instead of pixel space would stretch the block differently at every angle, and only on
  // non-square frames — which is every real frame.
  for (const angle of [0, 17, 45, 90, 133, 180, 271, 359]) {
    const beds = layoutBedBlock(SPEC, [0.5, 0.5], angle, M_PER_PX, IMG_W, IMG_H);
    assert.ok(
      Math.abs(metresBetween(beds[0], beds[1]) - 1.5) < 1e-9,
      `angle ${angle} spacing ${metresBetween(beds[0], beds[1])}`,
    );
    assert.ok(Math.abs(metresBetween(beds[0], beds[2]) - 3) < 1e-9, `angle ${angle} span`);
  }
});

test('the block runs in the aimed direction: bed one\'s centre is half its length along the aim', () => {
  for (const angle of [0, 45, 90, 200]) {
    const beds = layoutBedBlock(SPEC, [0.5, 0.5], angle, M_PER_PX, IMG_W, IMG_H);
    const rad = (angle * Math.PI) / 180;
    const expX = 0.5 + (Math.cos(rad) * 5) / M_PER_PX / IMG_W + (-Math.sin(rad) * 0.5) / M_PER_PX / IMG_W;
    const expY = 0.5 + (Math.sin(rad) * 5) / M_PER_PX / IMG_H + (Math.cos(rad) * 0.5) / M_PER_PX / IMG_H;
    assert.ok(Math.abs(beds[0].x - expX) < 1e-9, `angle ${angle} x`);
    assert.ok(Math.abs(beds[0].y - expY) < 1e-9, `angle ${angle} y`);
  }
});

test('a zero path width means beds touch — legal, and still exactly one bed width apart', () => {
  const beds = layoutBedBlock({ ...SPEC, pathWidthM: 0 }, [0.3, 0.3], 0, M_PER_PX, IMG_W, IMG_H);
  assert.ok(Math.abs(metresBetween(beds[0], beds[1]) - 1) < 1e-9);
});

test('a single bed is the ordinary one-member case, not a special path', () => {
  const beds = layoutBedBlock({ ...SPEC, count: 1 }, [0.3, 0.3], 30, M_PER_PX, IMG_W, IMG_H);
  assert.equal(beds.length, 1);
  assert.equal(beds[0].hM, 10);
});

test('the footprint counts the gaps BETWEEN beds, not one per bed', () => {
  // 3 beds have 2 paths. Counting 3 would overstate the block by half a metre and answer
  // "does it fit" wrongly in the farmer's favour — the failure you only find on site.
  assert.deepEqual(bedBlockFootprintM(SPEC), { alongM: 10, acrossM: 3 * 1 + 2 * 0.5 });
  assert.deepEqual(bedBlockFootprintM({ ...SPEC, count: 1 }), { alongM: 10, acrossM: 1 });
});

test('a broken scale or anchor yields NO beds rather than beds at NaN', () => {
  // A NaN centre renders as nothing at all, so the farmer sees an empty map and concludes the
  // button is broken. Returning an empty list keeps the caller's "nothing to commit" path honest.
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(layoutBedBlock(SPEC, [0.5, 0.5], 0, bad, IMG_W, IMG_H), []);
  }
  assert.deepEqual(layoutBedBlock(SPEC, [Number.NaN, 0.5], 0, M_PER_PX, IMG_W, IMG_H), []);
  assert.deepEqual(layoutBedBlock(SPEC, [0.5, 0.5], 0, M_PER_PX, 0, IMG_H), []);
});

test('a non-finite aim angle falls back to 0 instead of poisoning every coordinate', () => {
  const beds = layoutBedBlock(SPEC, [0.5, 0.5], Number.NaN, M_PER_PX, IMG_W, IMG_H);
  assert.equal(beds.length, 3);
  for (const b of beds) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.rot));
  }
});

test('the spec normaliser clamps rather than trusts a typed number', () => {
  assert.equal(normaliseBedBlockSpec({ count: 9999 }).count, MAX_BED_COUNT);
  assert.equal(normaliseBedBlockSpec({ count: 0 }).count, 1);
  assert.equal(normaliseBedBlockSpec({ count: 3.6 }).count, 4); // number inputs can carry decimals
  assert.equal(normaliseBedBlockSpec({ bedWidthM: -5 }).bedWidthM, 0.2);
  assert.equal(normaliseBedBlockSpec({ pathWidthM: -1 }).pathWidthM, 0); // touching beds, never negative
  // An empty number input reads as NaN — fall back to the default rather than emit NaN geometry.
  assert.equal(normaliseBedBlockSpec({ bedLengthM: Number.NaN }).bedLengthM, 3);
  assert.deepEqual(normaliseBedBlockSpec({}), { bedLengthM: 3, bedWidthM: 1.2, pathWidthM: 0.5, count: 4 });
});

test('the count ceiling holds, so one slip cannot commit thousands of items in a single undo', () => {
  const beds = layoutBedBlock({ ...SPEC, count: 100_000 }, [0.1, 0.1], 0, M_PER_PX, IMG_W, IMG_H);
  assert.equal(beds.length, MAX_BED_COUNT);
});
