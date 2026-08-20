import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PRICE_SNAPSHOT_DATE,
  PRICE_SNAPSHOT_MONTHS,
  priceDateLabel,
  pricedCropList,
} from '@/components/prices/CropPriceGuide.format';
import { CROPS } from '@/lib/crop-catalog';
import { asFarmerOwnPrice, DEFAULT_CROP_PRICES, UNPRICED_CROPS, type CropPrice } from '@/lib/crop-prices';

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

// A DATE PRINTED UNDER A NUMBER IS A FRESHNESS CLAIM ABOUT THAT NUMBER.
//
// CropPriceDetail prints "Priced <date> — always check today's real price before you agree."
// directly beneath the crop's own wholesale figure, and that line is the only freshness signal the
// negotiation screen gives. The book began as one research pass, so a single shared date was true
// on every card — and the code said so as an invariant. The moment one crop is researched on a
// later day (turnip: 19 August 2026 Joburg Market trade, five weeks after the shared pass) that
// shared date becomes a false statement on exactly one screen, silently, with nothing failing.
// These two tests are the thing that fails instead.
test('a crop researched after the shared pass shows its own date, not the book’s', () => {
  const turnip = DEFAULT_CROP_PRICES.turnip;
  assert.ok(turnip, 'fixture assumption: turnip is priced');
  assert.equal(turnip.pricedAt, '19 August 2026', 'fixture assumption: turnip carries its own research date');
  assert.equal(priceDateLabel(turnip), '19 August 2026');
  assert.notEqual(priceDateLabel(turnip), PRICE_SNAPSHOT_DATE);
});

test('a crop from the shared research pass still shows the shared snapshot date', () => {
  const carrots = DEFAULT_CROP_PRICES.carrots;
  assert.ok(carrots, 'fixture assumption: carrots is priced');
  assert.equal(carrots.pricedAt, undefined, 'fixture assumption: carrots came from the shared pass');
  assert.equal(priceDateLabel(carrots), PRICE_SNAPSHOT_DATE);
});

// The value tab describes the whole book in one sentence ("an editable South African snapshot from
// <months>"), which goes stale the same silent way the moment any entry is researched outside the
// months it names. Pinning the copy to the book's real dates is what stops the next crop priced in,
// say, September from quietly making that sentence false too.
test('the bulk snapshot copy names every month the price book was actually researched in', () => {
  const dates = [
    PRICE_SNAPSHOT_DATE,
    ...Object.values(DEFAULT_CROP_PRICES)
      .map((price) => price.pricedAt)
      .filter((date): date is string => typeof date === 'string'),
  ];
  for (const date of dates) {
    const [, month, year] = date.split(' ');
    assert.ok(
      PRICE_SNAPSHOT_MONTHS.includes(month) && PRICE_SNAPSHOT_MONTHS.includes(year),
      `a price dated "${date}" is outside the farmer-visible span "${PRICE_SNAPSHOT_MONTHS}"`,
    );
  }
});

// The price editor builds an override by spreading the researched default, so a farmer correcting
// turnip would otherwise keep the book's 19 August research date on a number they typed today.
test('a farmer’s own price does not inherit the book’s research date', () => {
  const edited = asFarmerOwnPrice({ ...DEFAULT_CROP_PRICES.turnip, wholesalePerKg: 8, confidence: 'estimated' });
  assert.equal('pricedAt' in edited, false);
  assert.equal(priceDateLabel(edited), PRICE_SNAPSHOT_DATE);
  assert.equal(edited.wholesalePerKg, 8, 'the farmer’s own numbers must survive the provenance reset');
});

test('every entry carries the confidence field a farmer needs before trusting the number', () => {
  for (const crop of pricedCropList({})) {
    assert.ok(
      crop.price.confidence === 'sourced' || crop.price.confidence === 'estimated',
      `${crop.key} has no readable confidence value`,
    );
  }
});
