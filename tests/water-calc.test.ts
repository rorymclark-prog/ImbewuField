import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  RUNOFF,
  REGIONAL_RAINFALL,
  STORAGE_SHARE_BY_PATTERN,
  annualHarvestLitres,
  describeHarvest,
  nearestRainfall,
  recommendedTankLitres,
} from '../lib/water-calc.ts';
import { ROOF_MATERIAL_RUNOFF_COEFFICIENTS } from '../lib/roof-runoff.ts';

test('the legacy material coefficients come from the shared runoff authority', () => {
  const source = readFileSync(new URL('../lib/water-calc.ts', import.meta.url), 'utf8');

  assert.equal(RUNOFF, ROOF_MATERIAL_RUNOFF_COEFFICIENTS);
  assert.match(source, /from '@\/lib\/roof-runoff'/);
  assert.doesNotMatch(source, /(?:metal|tile|thatch):\s*0\.\d+/);
});

test('every regional reference point resolves to itself', () => {
  for (const region of REGIONAL_RAINFALL) {
    assert.equal(nearestRainfall(region.lat, region.lon), region);
  }
});

test('nearestRainfall really selects the minimum squared-degree distance', () => {
  const probes = [
    [-30, 31],
    [-34, 18],
    [-24, 29],
    [-32, 24],
  ] as const;

  for (const [lat, lon] of probes) {
    const expected = REGIONAL_RAINFALL.reduce((best, region) => {
      const bestD = (lat - best.lat) ** 2 + (lon - best.lon) ** 2;
      const nextD = (lat - region.lat) ** 2 + (lon - region.lon) ** 2;
      return nextD < bestD ? region : best;
    });
    assert.equal(nearestRainfall(lat, lon), expected);
  }
});

test('harvest preserves the 1 mm × 1 m² dimensional rule for every roof material', () => {
  for (const coefficient of Object.values(RUNOFF)) {
    const unit = annualHarvestLitres(1, 1, coefficient);
    assert.ok(unit > 0 && unit <= 1);
    assert.equal(annualHarvestLitres(200, 800, coefficient), annualHarvestLitres(100, 800, coefficient) * 2);
    assert.equal(annualHarvestLitres(100, 1_600, coefficient), annualHarvestLitres(100, 800, coefficient) * 2);
  }
});

test('recommended storage always reaches its own pattern target and stays monotonic', () => {
  const patterns = ['summer', 'winter', 'all-year'] as const;
  const annualValues = [1, 1_000, 12_500, 50_000, 100_000, 500_000];

  for (const pattern of patterns) {
    let previous = 0;
    for (const annualLitres of annualValues) {
      const recommended = recommendedTankLitres(annualLitres, pattern);
      assert.ok(Number.isFinite(recommended));
      assert.ok(recommended > 0);
      assert.ok(recommended >= annualLitres * STORAGE_SHARE_BY_PATTERN[pattern]);
      assert.ok(recommended >= previous);
      previous = recommended;
    }
  }

  for (const annualLitres of annualValues) {
    assert.ok(recommendedTankLitres(annualLitres, 'winter') >= recommendedTankLitres(annualLitres, 'summer'));
    assert.ok(recommendedTankLitres(annualLitres, 'summer') >= recommendedTankLitres(annualLitres, 'all-year'));
  }
});

test('storage above the single-tank range rounds up and never undershoots', () => {
  for (const pattern of ['summer', 'winter', 'all-year'] as const) {
    for (const annualLitres of [200_000, 500_000, 1_000_000]) {
      const recommendation = recommendedTankLitres(annualLitres, pattern);
      const lowerAnnual = annualLitres - 1;
      assert.ok(recommendation >= recommendedTankLitres(lowerAnnual, pattern));
      assert.equal(recommendation % 10_000, 0);
    }
  }
});

test('describeHarvest reconciles its figures through the exported calculators', () => {
  const roofM2 = 80.4;
  const description = describeHarvest(roofM2, -29.86, 31.02);

  assert.ok(description);
  const region = nearestRainfall(-29.86, 31.02);
  assert.ok(region);
  assert.equal(description.regionName, region.name);
  assert.equal(description.annualLitres, annualHarvestLitres(roofM2, region.annualMm));
  assert.equal(description.recommendedTank, recommendedTankLitres(description.annualLitres, region.pattern));
  assert.equal(description.roofM2, Math.round(roofM2));
  assert.doesNotMatch(description.sentence, /NaN|Infinity/);
});

test('zero, negative, missing-scale, NaN and Infinity inputs never create farmer-facing nonsense', () => {
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(annualHarvestLitres(value, 800), 0);
    assert.equal(annualHarvestLitres(100, value), 0);
    assert.equal(recommendedTankLitres(value, 'summer'), 0);
    assert.equal(describeHarvest(value, -29.86, 31.02), null);
    assert.doesNotMatch(String(annualHarvestLitres(value, 800)), /NaN|Infinity/);
  }

  assert.equal(annualHarvestLitres(100, 800, 0), 0);
  assert.equal(annualHarvestLitres(100, 800, -1), 0);
  assert.equal(annualHarvestLitres(100, 800, Number.NaN), 0);
  assert.equal(annualHarvestLitres(100, 800, Number.POSITIVE_INFINITY), 0);
  assert.equal(nearestRainfall(Number.NaN, 31.02), null);
  assert.equal(nearestRainfall(-29.86, Number.POSITIVE_INFINITY), null);
  assert.equal(describeHarvest(100, Number.NaN, 31.02), null);
  assert.equal(describeHarvest(100, -29.86, Number.NEGATIVE_INFINITY), null);
});
