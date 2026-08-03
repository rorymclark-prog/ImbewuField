import assert from 'node:assert/strict';
import test from 'node:test';

import { ELEMENTS_BY_ID } from '@/lib/design-elements';
import {
  VETIVER_HEDGE_IDS,
  VETIVER_CLUMP_RADIUS_M,
  VETIVER_LINE_SPACING_M,
  vetiverHedgeGeometry,
} from '@/lib/vetiver-hedge';

// Roughly what a real plan sheet renders at — the figure planting-cartography already uses when it
// reasons about whether its minimum-symbol floor ever fires.
const SHEET_PX_PER_M = 40;
const MIN_CLUMP_PX = 2.6;

const geometryFor = (wM: number, hM: number, pxPerM = SHEET_PX_PER_M, seed = 'item-1') =>
  vetiverHedgeGeometry(wM * pxPerM, hM * pxPerM, wM, hM, pxPerM, MIN_CLUMP_PX, seed);

test('both catalog ids that mean "vetiver" are drawn as a hedge', () => {
  // If a third vetiver id is ever added to the catalog and not to this set, it silently falls back
  // to the side-elevation artwork — which is the bug this drawing exists to end.
  for (const id of VETIVER_HEDGE_IDS) {
    assert.ok(ELEMENTS_BY_ID[id], `${id} is in the hedge set but not in the catalog`);
  }
  assert.ok(VETIVER_HEDGE_IDS.has('vetiver_row'));
  assert.ok(VETIVER_HEDGE_IDS.has('mulch_bank'));
});

test('a Vetiver Row is one slip line and a Vetiver Bank is several', () => {
  // The whole point of deriving lines from the SHORT axis: 0.3 m holds one line of vetiver, 2 m
  // holds a block of them. Drawing a 2 m bank as one impossibly fat hedge is what a fixed
  // single-line drawing would have done.
  const row = ELEMENTS_BY_ID.vetiver_row;
  const bank = ELEMENTS_BY_ID.mulch_bank;

  const rowGeometry = geometryFor(row.wM, row.hM);
  const bankGeometry = geometryFor(bank.wM, bank.hM);
  assert.ok(rowGeometry && bankGeometry);
  assert.equal(rowGeometry.lines, 1, 'a 0.3 m row is a single line of slips');
  assert.ok(bankGeometry.lines > 1, 'a 2 m bank is more than one line');
  assert.ok(
    bankGeometry.lines <= Math.ceil(bank.wM / VETIVER_LINE_SPACING_M),
    'never more lines than the bank is wide enough to hold',
  );
});

test('the hedge runs along the long axis whichever way the footprint is drawn', () => {
  const upright = geometryFor(0.3, 5);
  const laid = geometryFor(5, 0.3);
  assert.ok(upright && laid);
  assert.equal(upright.alongY, true);
  assert.equal(laid.alongY, false);
  // Same physical hedge, so the same number of plants either way round. A drawing that put more
  // tufts in one orientation than the other would change what the sheet claims when a farmer
  // rotates a bank.
  assert.equal(upright.lines, laid.lines);
  assert.equal(upright.perLine, laid.perLine);
});

test('every tuft stays within reach of its own footprint', () => {
  // Blades deliberately overshoot the plate — that bristle is the identifying silhouette — but a
  // CROWN outside the footprint would be a plant drawn on ground the farmer did not allocate.
  for (const [wM, hM] of [[0.3, 5], [2, 2], [5, 0.3], [1.2, 12]] as const) {
    const geometry = geometryFor(wM, hM);
    assert.ok(geometry, `${wM}x${hM} produced no geometry`);
    const halfW = (wM * SHEET_PX_PER_M) / 2;
    const halfH = (hM * SHEET_PX_PER_M) / 2;
    for (const crown of geometry.crowns) {
      assert.ok(Math.abs(crown.x) <= halfW + 0.01, `crown x ${crown.x} outside ${halfW}`);
      assert.ok(Math.abs(crown.y) <= halfH + 0.01, `crown y ${crown.y} outside ${halfH}`);
      assert.ok(Number.isFinite(crown.r) && crown.r > 0);
    }
    assert.equal(geometry.crowns.length, geometry.lines * geometry.perLine);
  }
});

test('the same design draws the same hedge every time, and two banks differ', () => {
  // Plan sheets are re-rendered constantly and compared against each other; jitter that moved
  // between renders would make every export look like a change.
  const a = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-a');
  const again = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-a');
  const b = geometryFor(2, 2, SHEET_PX_PER_M, 'bank-b');
  assert.ok(a && again && b);
  assert.deepEqual(a.crowns, again.crowns);
  assert.notDeepEqual(a.crowns, b.crowns, 'two banks on one sheet must not be identical stamps');
});

test('a clump never falls below the legibility floor, however small the sheet', () => {
  // On a phone-sized export the true 15 cm clump radius is sub-pixel. Below the floor the drawing
  // becomes a legible map symbol rather than a literal one — a smudge says nothing.
  for (const pxPerM of [4, 8, 14, 40, 120]) {
    const geometry = geometryFor(2, 2, pxPerM);
    if (!geometry) continue;
    assert.ok(geometry.clumpR >= MIN_CLUMP_PX - 1e-9, `${pxPerM} px/m gave r=${geometry.clumpR}`);
    if (pxPerM >= 40) {
      assert.ok(
        Math.abs(geometry.clumpR - VETIVER_CLUMP_RADIUS_M * pxPerM) < 1e-9,
        'at sheet scale the real clump size wins, not the floor',
      );
    }
  }
});

test('a footprint too short to read as a hedge falls through instead of drawing three tufts', () => {
  assert.equal(geometryFor(0.3, 0.2, 4), null, 'a sub-symbol footprint must decline');
  // And nothing invalid can manufacture a drawing.
  assert.equal(vetiverHedgeGeometry(NaN, 10, 1, 1, 40, 2.6, 'x'), null);
  assert.equal(vetiverHedgeGeometry(10, 10, 1, 1, 0, 2.6, 'x'), null);
  assert.equal(vetiverHedgeGeometry(-5, 10, 1, 1, 40, 2.6, 'x'), null);
});

test('a very long bank stays bounded rather than drawing thousands of tufts', () => {
  const geometry = geometryFor(1.2, 400);
  assert.ok(geometry);
  assert.ok(geometry.perLine <= 180, `perLine ${geometry.perLine} is unbounded`);
  assert.ok(geometry.lines <= 6, `lines ${geometry.lines} is unbounded`);
});
