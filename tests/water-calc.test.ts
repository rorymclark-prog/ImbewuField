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

test('coordinates must describe a real point on Earth before a region is selected', () => {
  for (const lat of [-90, 90]) {
    assert.ok(nearestRainfall(lat, 0));
  }
  for (const lon of [-180, 180]) {
    assert.ok(nearestRainfall(0, lon));
  }
  for (const [lat, lon] of [
    [-90.000_001, 0],
    [90.000_001, 0],
    [0, -180.000_001],
    [0, 180.000_001],
  ]) {
    assert.equal(nearestRainfall(lat, lon), null);
    assert.equal(describeHarvest(100, lat, lon), null);
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
  // Without a per-site reading the description must SAY it fell back to the reference table.
  assert.equal(description.rainfallBasis, 'reference');
  assert.match(description.sentence, /nearest reference: .*\(fallback\)/);
});

test('a per-site rainfall reading overrides the reference table, and says so', () => {
  const roofM2 = 80;
  // The demo farm's live NASA POWER reading (2026-08-19): 768 mm at frost-free Mkuze —
  // where the reference table would have used Durban's 915 mm from 255 km away.
  const site = { annualMm: 768, pattern: 'summer' as const };
  const description = describeHarvest(roofM2, -27.726231, 31.963044, site);

  assert.ok(description);
  assert.equal(description.rainfallBasis, 'site');
  assert.equal(description.annualMm, 768);
  assert.equal(description.annualLitres, annualHarvestLitres(roofM2, 768));
  assert.equal(description.recommendedTank, recommendedTankLitres(description.annualLitres, 'summer'));
  assert.equal(description.regionName, 'This site (satellite climate records)');
  assert.match(description.sentence, /satellite climate records for this site/);
  assert.doesNotMatch(description.sentence, /fallback/);

  // The same call WITHOUT the reading keeps the old nearest-reference behaviour intact
  // — and lands on a different rainfall figure, which is the whole point.
  const fallback = describeHarvest(roofM2, -27.726231, 31.963044, null);
  assert.ok(fallback);
  assert.equal(fallback.rainfallBasis, 'reference');
  assert.equal(fallback.annualMm, nearestRainfall(-27.726231, 31.963044)!.annualMm);
  assert.notEqual(fallback.annualMm, description.annualMm);
});

test('mild-frost is a summer-rainfall subtype for storage sizing', () => {
  // The planner's fourth pattern marks light frost, which is irrelevant to when rain
  // arrives — storage share must follow the summer curve, never crash on the extra value.
  const site = { annualMm: 900, pattern: 'mild-frost' as const };
  const description = describeHarvest(100, -29.7, 30.8, site);
  assert.ok(description);
  assert.equal(description.pattern, 'summer');
  assert.equal(description.recommendedTank, recommendedTankLitres(description.annualLitres, 'summer'));
});

test('an unusable per-site override falls back to the reference table rather than nonsense', () => {
  for (const bad of [
    { annualMm: 0, pattern: 'summer' as const },
    { annualMm: -5, pattern: 'summer' as const },
    { annualMm: Number.NaN, pattern: 'summer' as const },
  ]) {
    const description = describeHarvest(100, -29.86, 31.02, bad);
    assert.ok(description);
    assert.equal(description.rainfallBasis, 'reference');
    assert.equal(description.annualMm, nearestRainfall(-29.86, 31.02)!.annualMm);
  }
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
  assert.equal(
    describeHarvest(Number.EPSILON, -29.86, 31.02),
    null,
    'a description must never print 0 m² beside a positive harvest',
  );
  assert.equal(recommendedTankLitres(Number.MAX_VALUE, 'winter'), 0);
  assert.equal(describeHarvest(Number.MAX_VALUE, -29.86, 31.02), null);
});
