import test from 'node:test';
import assert from 'node:assert/strict';

import { planValue } from '@/lib/plan-value';
import { DEFAULT_CROP_PRICES } from '@/lib/crop-prices';
import type { CashflowSettings } from '@/lib/crop-plan';

const confirmed = (over: Partial<CashflowSettings> = {}): CashflowSettings =>
  ({ sellPercent: 100, lossPercent: 0, confirmed: true, ...over });

const CHARD = DEFAULT_CROP_PRICES['swiss-chard'];

test('plan value: the loss allowance and the sell share are each applied exactly once', () => {
  const rows = [{ cropKey: 'swiss-chard', name: 'Swiss chard', kg: 100 }];
  const v = planValue(rows, {}, 'retail', confirmed({ lossPercent: 25, sellPercent: 60 }));
  // 100 kg → 75 kg harvestable → 60% sold at retail, 40% kept at retail.
  assert.ok(Math.abs(v.cash - 75 * 0.6 * CHARD.retailPerKg) < 1e-9, `cash ${v.cash}`);
  assert.ok(Math.abs(v.home - 75 * 0.4 * CHARD.retailPerKg) < 1e-9, `home ${v.home}`);
  assert.ok(Math.abs(v.pricedKg - 75) < 1e-9, `pricedKg ${v.pricedKg}`);
});

test('plan value: produce kept at home is valued at RETAIL even when selling wholesale', () => {
  // It replaces a shop purchase whichever channel the rest is sold through.
  // Reusing the wholesale toggle here understated the home side and made one
  // label describe two different calculations.
  const rows = [{ cropKey: 'swiss-chard', name: 'Swiss chard', kg: 100 }];
  const v = planValue(rows, {}, 'wholesale', confirmed({ sellPercent: 50 }));
  assert.ok(Math.abs(v.cash - 50 * CHARD.wholesalePerKg) < 1e-9, 'the sold half is wholesale');
  assert.ok(Math.abs(v.home - 50 * CHARD.retailPerKg) < 1e-9, 'the kept half is retail');
  assert.ok(CHARD.retailPerKg > CHARD.wholesalePerKg, 'fixture sanity: the two prices differ');
});

test('plan value: an unpriced crop is EXCLUDED and named, never valued at zero', () => {
  const rows = [
    { cropKey: 'swiss-chard', name: 'Swiss chard', kg: 10 },
    { cropKey: 'coriander', name: 'Coriander', kg: 999 }, // in UNPRICED_CROPS
  ];
  const v = planValue(rows, {}, 'retail', confirmed());
  assert.deepEqual(v.unpricedCropNames, ['Coriander']);
  assert.ok(Math.abs(v.cash - 10 * CHARD.retailPerKg) < 1e-9, 'the unpriced kg contribute nothing');
  assert.equal(v.pricedKg, 10, 'and are not counted as priced kilograms either');
});

test('plan value: confirmed rides in the result so no caller can forget to check it', () => {
  const rows = [{ cropKey: 'swiss-chard', name: 'Swiss chard', kg: 10 }];
  assert.equal(planValue(rows, {}, 'retail', { sellPercent: 100, lossPercent: 25 }).confirmed, false);
  assert.equal(planValue(rows, {}, 'retail', { sellPercent: 100, lossPercent: 25, confirmed: false }).confirmed, false);
  assert.equal(planValue(rows, {}, 'retail', confirmed()).confirmed, true);
  // The figures are still computed while unconfirmed — the sliders show a live
  // preview — they are simply not printable as a headline.
  assert.ok(planValue(rows, {}, 'retail', { sellPercent: 100, lossPercent: 25 }).cash > 0);
});

test('plan value: a hand-edited store cannot push a percentage outside 0-100', () => {
  const rows = [{ cropKey: 'swiss-chard', name: 'Swiss chard', kg: 100 }];
  const wild = planValue(rows, {}, 'retail', { sellPercent: 400, lossPercent: -50, confirmed: true });
  assert.ok(Math.abs(wild.cash - 100 * CHARD.retailPerKg) < 1e-9, 'clamped to 100% sold, 0% lost');
  assert.equal(wild.home, 0);
  const nan = planValue(rows, {}, 'retail', { sellPercent: Number.NaN, lossPercent: Number.NaN, confirmed: true });
  assert.equal(nan.cash, 0, 'a NaN sell share sells nothing rather than producing NaN rand');
  assert.ok(Number.isFinite(nan.home));
});

test('plan value: a farmer price override beats the guide price', () => {
  const rows = [{ cropKey: 'swiss-chard', name: 'Swiss chard', kg: 10 }];
  const v = planValue(
    rows,
    { 'swiss-chard': { retailPerKg: 100, wholesalePerKg: 50, confidence: 'estimated' } },
    'retail',
    confirmed(),
  );
  assert.equal(v.cash, 1000);
});

test('plan value: no rows is zero rand and no invented exclusions', () => {
  const v = planValue([], {}, 'retail', confirmed());
  assert.equal(v.cash, 0);
  assert.equal(v.home, 0);
  assert.deepEqual(v.unpricedCropNames, []);
});
