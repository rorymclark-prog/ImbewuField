import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeTankSizing,
  suggestJojoTanks,
  type TankSizingInput,
} from '../lib/tank-sizing.ts';
import { TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT } from '../lib/roof-runoff.ts';

const seasonalRain = [150, 150, 100, 60, 20, 10, 10, 20, 50, 80, 80, 70];

function sizing(overrides: Partial<TankSizingInput> = {}) {
  return computeTankSizing({
    monthlyRainfallMm: seasonalRain,
    roofAreaM2: 100,
    dailyUseL: 100,
    ...overrides,
  });
}

function suggestionCapacity(suggestion: string): { capacityL: number; count: number } {
  let capacityL = 0;
  let count = 0;
  for (const match of suggestion.matchAll(/(\d+)× (10 000|5 000|2 500) ℓ/g)) {
    const n = Number(match[1]);
    capacityL += n * Number(match[2].replace(/\s/g, ''));
    count += n;
  }
  return { capacityL, count };
}

test('a water-positive year with a real dry run still recommends storage', () => {
  const result = sizing();

  assert.equal(result.ok, true);
  assert.equal(result.waterNegative, false);
  assert.ok(result.dryMonths > 0);
  assert.ok(result.dryRunShortfallL > 0);
  assert.equal(result.recommendedStorageL, result.dryRunShortfallL);
  assert.match(result.summary, /\bstore\b/);
  assert.doesNotMatch(result.summary, /no real dry gap/);
});

test('an annual catchment shortfall is never described as sufficient storage', () => {
  const result = sizing({ roofAreaM2: 10, dailyUseL: 500 });

  assert.equal(result.ok, true);
  assert.equal(result.waterNegative, true);
  assert.ok(result.annualHarvestL < result.annualUseL);
  assert.match(result.summary, /can't close the gap/);
  assert.doesNotMatch(result.summary, /out-catches|no real dry gap|meets/);
});

test('the longest dry run can wrap across December to January', () => {
  // Nov, Dec, Jan and Feb are dry; every other month catches comfortably more than demand.
  const rain = [0, 0, 100, 100, 100, 100, 100, 100, 100, 100, 0, 0];
  const result = sizing({ monthlyRainfallMm: rain });

  assert.equal(result.ok, true);
  assert.equal(result.dryMonths, 4);
  assert.equal(result.dryRunShortfallL, (30 + 31 + 31 + 28) * 100);
  assert.equal(result.recommendedStorageL, result.dryRunShortfallL);
});

test('a barely-surplus month reduces a deficit but does not pretend to refill the tank', () => {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const roofAreaM2 = 100;
  const dailyUseL = 100;
  const netByMonth = [-1_000, -1_000, 1, -1_000, -1_000, 10_000, 1_000, 1_000, 1_000, 1_000, 1_000, 10_000];
  const rainfall = netByMonth.map(
    (net, month) =>
      (days[month] * dailyUseL + net)
      / (roofAreaM2 * TANK_CALCULATOR_ROOF_RUNOFF_COEFFICIENT),
  );
  const result = sizing({ monthlyRainfallMm: rainfall, roofAreaM2, dailyUseL });

  assert.equal(result.waterNegative, false);
  assert.equal(result.dryMonths, 2);
  assert.equal(result.dryRunShortfallL, 2_000);
  assert.equal(result.recommendedStorageL, 4_000);
  assert.ok(result.recommendedStorageL > result.dryRunShortfallL);
});

test('equal annual rainfall with different seasonality does not collapse to one storage answer', () => {
  const uniform = Array(12).fill(seasonalRain.reduce((sum, mm) => sum + mm, 0) / 12);
  const seasonal = sizing();
  const even = sizing({ monthlyRainfallMm: uniform });

  assert.equal(seasonal.annualHarvestL, even.annualHarvestL);
  assert.notEqual(seasonal.dryMonths, even.dryMonths);
  assert.notEqual(seasonal.recommendedStorageL, even.recommendedStorageL);
});

test('every positive finite JoJo suggestion reaches the requested litres', () => {
  const requirements = [
    1, 2_499, 2_500, 2_501, 4_999, 5_000, 7_501, 9_999, 10_000, 10_001,
    12_501, 22_501, 30_001, 97_501, 123_456,
  ];

  for (const requiredL of requirements) {
    const suggestion = suggestJojoTanks(requiredL);
    const parsed = suggestionCapacity(suggestion);
    assert.ok(parsed.capacityL >= requiredL, `${suggestion} must cover ${requiredL} L`);
    assert.ok(parsed.count > 0);
    assert.doesNotMatch(suggestion, /NaN|Infinity/);
  }
});

test('suggested capacity is the smallest available 2 500 L step that reaches demand', () => {
  for (const requiredL of [1, 2_500, 2_501, 10_001, 32_501, 123_456]) {
    const { capacityL } = suggestionCapacity(suggestJojoTanks(requiredL));
    assert.ok(capacityL >= requiredL);
    assert.ok(capacityL - requiredL < 2_500);
  }
});

test('JoJo selection is exact across many denominations and rejects unsafe magnitudes', () => {
  for (let requiredL = 1; requiredL <= 250_000; requiredL += 1_337) {
    const { capacityL, count } = suggestionCapacity(suggestJojoTanks(requiredL));
    const minimumCapacity = Math.ceil(requiredL / 2_500) * 2_500;
    const units = minimumCapacity / 2_500;
    const remainder = units % 4;
    const minimumCount = Math.floor(units / 4) + (remainder === 3 ? 2 : remainder > 0 ? 1 : 0);
    assert.equal(capacityL, minimumCapacity);
    assert.equal(count, minimumCount);
  }
  assert.match(suggestJojoTanks(Number.MAX_VALUE), /exceeds calculator range/);
});

test('zero, negative, missing, NaN and Infinity inputs return a finite honest no-result', () => {
  const cases: TankSizingInput[] = [
    { monthlyRainfallMm: [], roofAreaM2: 100, dailyUseL: 100 },
    { monthlyRainfallMm: Array(11).fill(50), roofAreaM2: 100, dailyUseL: 100 },
    { monthlyRainfallMm: Array(12).fill(0), roofAreaM2: 100, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 0, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: -1, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: Number.NaN, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: Number.POSITIVE_INFINITY, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 100, dailyUseL: 0 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 100, dailyUseL: -1 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 100, dailyUseL: Number.NaN },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 100, dailyUseL: Number.POSITIVE_INFINITY },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: Number.MAX_VALUE, dailyUseL: 100 },
    { monthlyRainfallMm: seasonalRain, roofAreaM2: 100, dailyUseL: Number.MAX_VALUE },
  ];

  for (const input of cases) {
    const result = computeTankSizing(input);
    assert.equal(result.ok, false);
    assert.deepEqual(result, {
      ok: false,
      annualHarvestL: 0,
      wetSeasonHarvestL: 0,
      annualUseL: 0,
      dryMonths: 0,
      dryRunShortfallL: 0,
      recommendedStorageL: 0,
      waterNegative: false,
      jojoSuggestion: '',
      summary: '',
    });
    assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  }
});

test('bad individual month values are losses, never NaN in farmer-facing output', () => {
  const monthlyRainfallMm = [...seasonalRain];
  monthlyRainfallMm[2] = Number.NaN;
  monthlyRainfallMm[5] = Number.POSITIVE_INFINITY;
  monthlyRainfallMm[8] = -20;
  const result = sizing({ monthlyRainfallMm });

  assert.equal(result.ok, true);
  for (const value of [
    result.annualHarvestL,
    result.wetSeasonHarvestL,
    result.annualUseL,
    result.dryRunShortfallL,
    result.recommendedStorageL,
  ]) {
    assert.ok(Number.isFinite(value));
    assert.ok(value >= 0);
  }
  assert.doesNotMatch(`${result.summary} ${result.jojoSuggestion}`, /NaN|Infinity/);
});

test('recommended storage never exceeds annual use', () => {
  for (const dailyUseL of [1, 50, 200, 2_000]) {
    for (const roofAreaM2 of [1, 20, 100, 1_000]) {
      const result = sizing({ dailyUseL, roofAreaM2 });
      assert.equal(result.ok, true);
      assert.ok(result.recommendedStorageL <= result.annualUseL);
      assert.ok(result.recommendedStorageL >= 0);
    }
  }
});
