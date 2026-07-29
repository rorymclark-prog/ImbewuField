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

test('every countable row states its count, including one', () => {
  assert.equal(countedLegendText('JoJo Tank', 1), 'JoJo Tank ×1');
  assert.equal(countedLegendText('Tap Point', 6), 'Tap Point ×6');
  assert.equal(countedLegendText('Buried water pipe', 1), 'Buried water pipe ×1');
});
