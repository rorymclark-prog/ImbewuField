import test from 'node:test';
import assert from 'node:assert/strict';

import { countedLegendText, legendRowGap } from '../lib/sheet-legend-layout.ts';

test('legend rows consume the height the panel actually has instead of keeping a short-sheet cap', () => {
  const rowCount = 6;
  const usedHeight = 360;
  const shortAvailable = 760;
  const tallAvailable = 1960;
  const shortGap = legendRowGap(shortAvailable, usedHeight, rowCount);
  const tallGap = legendRowGap(tallAvailable, usedHeight, rowCount);

  assert.ok(tallGap > shortGap, 'a taller boundary must produce a taller row rhythm');
  assert.equal(usedHeight + shortGap * rowCount, shortAvailable);
  assert.equal(usedHeight + tallGap * rowCount, tallAvailable);
});

test('an overcrowded panel never invents negative space or shrinks type through the gap helper', () => {
  assert.equal(legendRowGap(400, 600, 8), 0);
  assert.equal(legendRowGap(Number.NaN, 200, 4), 0);
  assert.equal(legendRowGap(400, 200, 0), 0);
});

test('legend gap geometry is finite, non-negative, and exactly consumes spare height', () => {
  for (const availableHeight of [0, 1, 400, 10_000]) {
    for (const usedHeight of [0, 1, 399, 20_000]) {
      for (const rowCount of [1, 2, 7, 100]) {
        const gap = legendRowGap(availableHeight, usedHeight, rowCount);
        assert.ok(Number.isFinite(gap) && gap >= 0);
        if (availableHeight >= usedHeight) {
          assert.equal(usedHeight + gap * rowCount, availableHeight);
        } else {
          assert.equal(gap, 0);
        }
      }
    }
  }
});

test('invalid measurements cannot become legend spacing', () => {
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
  ]) {
    assert.equal(legendRowGap(invalid, 10, 2), 0);
    assert.equal(legendRowGap(10, invalid, 2), 0);
  }
  for (const invalidCount of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.equal(legendRowGap(10, 5, invalidCount), 0);
  }
});

test('every countable row states its count, including one', () => {
  assert.equal(countedLegendText('Empty group', 0), 'Empty group ×0');
  assert.equal(countedLegendText('JoJo Tank', 1), 'JoJo Tank ×1');
  assert.equal(countedLegendText('Tap Point', 6), 'Tap Point ×6');
  assert.equal(countedLegendText('Buried water pipe', 1), 'Buried water pipe ×1');
});

test('invalid counts can never print as plausible legend facts', () => {
  for (const invalid of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    assert.throws(
      () => countedLegendText('Feature', invalid),
      /non-negative safe integer/i,
    );
  }
});
