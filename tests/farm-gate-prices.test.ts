import assert from 'node:assert/strict';
import test from 'node:test';

import { pricedCropList } from '@/components/prices/CropPriceGuide.format';
import { CROPS } from '@/lib/crop-catalog';
import { DEFAULT_CROP_PRICES, UNPRICED_CROPS, type CropPrice } from '@/lib/crop-prices';

// The farm-gate price screen (app/prices/page.tsx) exists to put a real number in front of a
// farmer mid-negotiation — so the crop list it shows must never include a crop that then has no
// price to display (a tap that leads nowhere), and it must never silently drop a crop a farmer
// has themselves corrected. pricedCropList() is the one function both the picker and any future
// caller share for that filter, so it is tested directly rather than through the rendered page.

test('every crop with a researched default price is offered', () => {
  const keys = new Set(pricedCropList({}).map((c) => c.key));
  for (const key of Object.keys(DEFAULT_CROP_PRICES)) {
    assert.ok(keys.has(key), `${key} has a default price but was left off the list`);
  }
});

test('a crop the price book deliberately leaves unpriced is not offered', () => {
  const keys = new Set(pricedCropList({}).map((c) => c.key));
  for (const key of UNPRICED_CROPS) {
    assert.equal(keys.has(key), false, `${key} is in UNPRICED_CROPS and should not appear`);
  }
});

test('a catalog crop with neither a default price nor an override is not offered', () => {
  // oats is in the crop catalog but has no entry in DEFAULT_CROP_PRICES and is not in
  // UNPRICED_CROPS either — the "just missing data" case, distinct from "deliberately unpriced".
  assert.ok(CROPS.some((c) => c.key === 'oats'), 'fixture assumption: oats is a real catalog crop');
  assert.equal(DEFAULT_CROP_PRICES.oats, undefined, 'fixture assumption: oats has no default price');
  const keys = new Set(pricedCropList({}).map((c) => c.key));
  assert.equal(keys.has('oats'), false);
});

test('a farmer override brings an otherwise-unpriced crop onto the list', () => {
  const override: Record<string, CropPrice> = {
    oats: { retailPerKg: 22, wholesalePerKg: 9, confidence: 'estimated' },
  };
  const oats = pricedCropList(override).find((c) => c.key === 'oats');
  assert.ok(oats, 'a usable override should make the crop selectable');
  assert.equal(oats?.price.wholesalePerKg, 9);
});

test('a farmer override for an already-priced crop wins over the researched default', () => {
  // pricedCropList delegates to priceFor(), same as every other price-book caller in this app
  // (NewListingForm, MyRecords, invoice, facilitator/crops) — it trusts the overrides object it is
  // given rather than re-validating it. The isUsablePrice guard against the cleared-field-persists-
  // zero bug (see tests/crop-prices.test.ts) runs one layer up, at the loadCropPriceOverrides()/
  // saveCropPriceOverrides() storage boundary — this test documents the boundary this module sits
  // on, not a second copy of that guard.
  const override: Record<string, CropPrice> = {
    cabbage: { retailPerKg: 20, wholesalePerKg: 3, confidence: 'estimated' },
  };
  const cabbage = pricedCropList(override).find((c) => c.key === 'cabbage');
  assert.ok(cabbage);
  assert.notDeepEqual(cabbage?.price, DEFAULT_CROP_PRICES.cabbage, 'fixture assumption: override differs from the default');
  assert.deepEqual(cabbage?.price, override.cabbage);
});

test('the list is sorted by name, so a farmer can scan rather than hunt', () => {
  const names = pricedCropList({}).map((c) => c.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(names, sorted);
});

test('every entry carries the confidence field a farmer needs before trusting the number', () => {
  for (const crop of pricedCropList({})) {
    assert.ok(
      crop.price.confidence === 'sourced' || crop.price.confidence === 'estimated',
      `${crop.key} has no readable confidence value`,
    );
  }
});
