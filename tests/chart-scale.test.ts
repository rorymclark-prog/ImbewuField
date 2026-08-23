import test from 'node:test';
import assert from 'node:assert/strict';

import { cappedScale } from '@/lib/chart-scale';

test('chart scale: ordinary variation is never capped', () => {
  // The tallest bar being twice the next is a good month, not a spike. Capping
  // here would flatten exactly the variation the chart exists to show.
  const s = cappedScale([100, 200, 150, 90, 220, 180]);
  assert.equal(s.capped, false);
  assert.equal(s.max, 220);
  assert.equal(s.draw(220), 220);
  assert.equal(s.isClipped(220), false);
});

test('chart scale: one lone spike is capped, and the rest keep their proportions', () => {
  // The real case: R6 600 of setup costs beside eleven months of R100–450.
  const months = [6600, 454, 300, 210, 180, 164, 150, 120, 110, 95, 60, 35];
  const s = cappedScale(months);
  assert.equal(s.capped, true);
  assert.ok(s.max > 454, 'the runner-up still fits inside the axis');
  assert.ok(s.max < 1000, 'and the axis is nowhere near the spike');
  assert.equal(s.isClipped(6600), true);
  assert.equal(s.isClipped(454), false);
  assert.equal(s.draw(6600), s.max, 'the spike draws to the cap');
  assert.equal(s.draw(454), 454, 'everything else draws at its real height');
  // The whole point: the runner-up is now a substantial bar, not a sliver.
  assert.ok(454 / s.max > 0.7, `runner-up fills ${(454 / s.max) * 100}% of the axis`);
});

test('chart scale: two comparable spikes are not capped', () => {
  // Capping from the second largest means a genuine pair of big months protects
  // itself — there is no "typical" being crushed, there are two real peaks.
  const s = cappedScale([6600, 6200, 300, 210, 180, 120]);
  assert.equal(s.capped, false);
  assert.equal(s.max, 6600);
});

test('chart scale: too few points to have a typical month', () => {
  // Three bars, one big: that IS the chart. Nothing is being protected.
  const s = cappedScale([5000, 100, 80]);
  assert.equal(s.capped, false);
  assert.equal(s.max, 5000);
});

test('chart scale: an empty or all-zero series has a zero maximum and caps nothing', () => {
  for (const values of [[], [0, 0, 0, 0, 0]]) {
    const s = cappedScale(values);
    assert.equal(s.max, 0);
    assert.equal(s.capped, false);
    assert.equal(s.draw(0), 0);
  }
});

test('chart scale: negatives and non-finite values cannot set the scale', () => {
  const s = cappedScale([-9999, Number.NaN, Number.POSITIVE_INFINITY, 100, 90, 80, 70]);
  assert.equal(s.max, 100);
  assert.equal(s.capped, false);
  assert.equal(s.draw(-50), 0, 'a negative draws nothing rather than inverting a bar');
  assert.equal(s.draw(Number.NaN), 0);
});

test('chart scale: a capped value is always reported as clipped, so the card can name it', () => {
  // The condition that makes a capped axis honest rather than wrong: whatever is
  // cut must be identifiable, so its real figure can still be printed.
  const values = [9000, 300, 250, 200, 150];
  const s = cappedScale(values);
  assert.equal(s.capped, true);
  const clipped = values.filter((v) => s.isClipped(v));
  assert.deepEqual(clipped, [9000]);
});
