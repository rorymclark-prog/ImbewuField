import test from 'node:test';
import assert from 'node:assert/strict';

import { countedLegendText, legendRowGap, MAX_GAP_TO_ROW_RHYTHM } from '../lib/sheet-legend-layout.ts';

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

test('a short legend stays a compact block instead of being justified down a tall panel', () => {
  // Rendered water sheet 04: three rows in a full-height cream panel. Sharing ALL the slack put a
  // visible hole between each row — the legend read as broken rather than full, and the panel was
  // still empty at the bottom because the same gap follows the last row too.
  const lineH = 40;
  const spread = legendRowGap(1000, 130, 3, lineH);
  assert.ok(spread <= lineH * MAX_GAP_TO_ROW_RHYTHM + 0.001, `gap ${spread} dwarfs the row rhythm ${lineH}`);

  // A well-populated legend still spreads: with enough rows the shared slack is under the ceiling,
  // so the cap never binds and the column fills as intended.
  const many = legendRowGap(1000, 880, 12, lineH);
  assert.equal(many, (1000 - 880) / 12, 'the cap must not bite on a full legend');
  assert.ok(many < spread, 'a fuller legend has tighter gaps than a sparse one');
});

test('legendRowGap never returns a negative or non-finite gap', () => {
  assert.equal(legendRowGap(100, 400, 3, 40), 0, 'an overfull legend gets no extra gap');
  assert.equal(legendRowGap(Number.NaN, 10, 3, 40), 0);
  assert.equal(legendRowGap(100, 10, 0, 40), 0);
  assert.ok(Number.isFinite(legendRowGap(1000, 100, 3)), 'omitting the rhythm still yields a number');
});
