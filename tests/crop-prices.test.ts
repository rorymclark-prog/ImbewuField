import assert from 'node:assert/strict';
import test from 'node:test';

import { CROPS, hasPlanningYield } from '@/lib/crop-catalog';
import { DEFAULT_CROP_PRICES, isUsablePrice, UNPRICED_CROPS } from '@/lib/crop-prices';

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

// The value-view flag at app/facilitator/crops/page.tsx ("Subtotal excludes
// ... because a verified yield or usable per-kg price is missing") fires
// silently, per crop, forever, whenever a catalog food crop has neither a
// priced default nor a documented UNPRICED_CROPS exclusion — e.g. true-spinach
// and turnip landed in neither list the day they were added to the catalog.
// This guards every future food crop the same way: priced or explicitly,
// deliberately excluded — never silently unpriced.
//
// BOUNDARY: hasPlanningYield means yieldKgPerM2 > 0, so a food crop shipped with
// yieldKgPerM2: 0 or null (the oats/cover-crop shape) is invisible to this test.
// That is intentional — with no planning yield there are no kg to value, so the
// subtotal flag above cannot fire for it — but it does mean this is not a
// whole-catalog price census; give such a crop a yield and this test starts
// covering it.
test('every catalog crop with a planning yield is priced or deliberately excluded', () => {
  const gaps = CROPS.filter(hasPlanningYield)
    .filter((crop) => !DEFAULT_CROP_PRICES[crop.key] && !UNPRICED_CROPS.has(crop.key))
    .map((crop) => crop.key);
  assert.deepEqual(gaps, []);
});

// The invoice screen printed "guide price, July 2026." as a hardcoded literal,
// so when turnip arrived carrying its own 19 August trading date the sentence
// went false on that screen while the price card and the value tab were fixed.
// Any surface that prints a price's date must derive it (priceDateLabel /
// PRICE_SNAPSHOT_MONTHS), never restate it — this guards the one screen that
// slipped, by construction rather than by value.
test('the invoice guide-price line derives its date instead of hardcoding one', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../app/invoice/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /priceDateLabel\(guide\)/, 'invoice must print the per-price date');
  assert.doesNotMatch(
    source,
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+20\d\d/,
    'no month-year date literal may appear in the invoice source',
  );
});
