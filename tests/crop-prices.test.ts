import assert from 'node:assert/strict';
import test from 'node:test';

import { isUsablePrice } from '@/lib/crop-prices';

// A CLEARED PRICE FIELD USED TO ERASE A CROP'S INCOME, PERMANENTLY.
//
// The two editor inputs coerced with `Number(value) || 0` and wrote through on every keystroke, so
// clearing a field to retype it persisted `0`. priceFor() falls back with `??`, which treats only
// null and undefined as missing, so a stored 0 shadowed the researched default for good — and the
// page has no reset control, so a farmer could not undo it. Every month of that crop then
// contributed R0 to the income chart and the year estimate, with no per-crop tooltip to reveal
// which crop had gone quiet.
//
// The guard lives in lib/crop-prices.ts and runs on BOTH read and write: the write side stops new
// damage, and the read side heals the bad values already sitting in farmers' browsers.

test('a price is only usable when both figures are real money', () => {
  assert.equal(isUsablePrice({ retailPerKg: 29, wholesalePerKg: 18 }), true);
});

test('zero, negative and non-finite prices are rejected, which is what restores the default', () => {
  // The exact shape a cleared field produced.
  assert.equal(isUsablePrice({ retailPerKg: 0, wholesalePerKg: 18 }), false);
  assert.equal(isUsablePrice({ retailPerKg: 29, wholesalePerKg: 0 }), false);
  assert.equal(isUsablePrice({ retailPerKg: 0, wholesalePerKg: 0 }), false);
  // No `min` on the inputs meant a negative persisted too.
  assert.equal(isUsablePrice({ retailPerKg: -5, wholesalePerKg: 18 }), false);
  assert.equal(isUsablePrice({ retailPerKg: Number.NaN, wholesalePerKg: 18 }), false);
  assert.equal(isUsablePrice({ retailPerKg: Number.POSITIVE_INFINITY, wholesalePerKg: 18 }), false);
});

test('a half-written or malformed override is rejected rather than half-applied', () => {
  // Storage is JSON a farmer's browser has held across app versions; it can be anything.
  assert.equal(isUsablePrice({ retailPerKg: 29 }), false, 'wholesale missing');
  assert.equal(isUsablePrice({ wholesalePerKg: 18 }), false, 'retail missing');
  assert.equal(isUsablePrice({ retailPerKg: '29', wholesalePerKg: '18' }), false, 'strings are not money');
  assert.equal(isUsablePrice({}), false);
  assert.equal(isUsablePrice(null), false);
  assert.equal(isUsablePrice(undefined), false);
  assert.equal(isUsablePrice('29'), false);
  assert.equal(isUsablePrice(29), false);
});
