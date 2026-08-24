import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ageYears,
  yieldFraction,
  maturityStage,
  maturityLabel,
} from '@/lib/perennial-maturity';

const NOW = new Date('2026-08-24T00:00:00Z'); // matches this repo's currentDate convention

const AVOCADO = { yearsToFirstHarvest: 4, yearsToFullBearing: 7 }; // real catalog values

/* ── ageYears ─────────────────────────────────────────────────────────────── */

test('ageYears: undefined plantedYear is unknown, not zero', () => {
  assert.equal(ageYears(undefined, NOW), null);
});

test('ageYears: a future plantedYear (not in the ground yet) is unknown, not negative', () => {
  assert.equal(ageYears(2030, NOW), null);
});

test('ageYears: planted this calendar year is age 0', () => {
  assert.equal(ageYears(2026, NOW), 0);
});

test('ageYears: whole years since planting', () => {
  assert.equal(ageYears(2019, NOW), 7);
});

/* ── yieldFraction ────────────────────────────────────────────────────────── */

test('yieldFraction: no cited maturity window returns null, never a guessed 0', () => {
  assert.equal(yieldFraction({ plantedYear: 2019 }, NOW), null);
});

test('yieldFraction: a maturity window with no known planting year returns null', () => {
  assert.equal(yieldFraction(AVOCADO, NOW), null);
});

test('yieldFraction: before yearsToFirstHarvest is exactly 0', () => {
  // Planted 2 years ago; avocado's first crop is 4 years out — the user's own example.
  assert.equal(yieldFraction({ ...AVOCADO, plantedYear: 2024 }, NOW), 0);
});

test('yieldFraction: at or past yearsToFullBearing is exactly 1', () => {
  assert.equal(yieldFraction({ ...AVOCADO, plantedYear: 2016 }, NOW), 1); // age 10 >= 7
  assert.equal(yieldFraction({ ...AVOCADO, plantedYear: 2019 }, NOW), 1); // age 7 == 7
});

test('yieldFraction: ramps linearly between first harvest and full bearing', () => {
  // Planted 2021 -> age 5. Window is [4, 7], span 3. (5-4)/3 = 1/3.
  const frac = yieldFraction({ ...AVOCADO, plantedYear: 2021 }, NOW);
  assert.ok(frac !== null);
  assert.ok(Math.abs(frac! - 1 / 3) < 1e-9, `expected ~0.333, got ${frac}`);
});

/* ── maturityStage ────────────────────────────────────────────────────────── */

test('maturityStage: unknown input is null, not a default stage', () => {
  assert.equal(maturityStage({}, NOW), null);
});

test('maturityStage: the three stages line up with the fraction boundaries', () => {
  assert.equal(maturityStage({ ...AVOCADO, plantedYear: 2024 }, NOW), 'not yet bearing');
  assert.equal(maturityStage({ ...AVOCADO, plantedYear: 2021 }, NOW), 'first crops');
  assert.equal(maturityStage({ ...AVOCADO, plantedYear: 2016 }, NOW), 'full bearing');
});

/* ── maturityLabel ────────────────────────────────────────────────────────── */

test('maturityLabel: null when the stage can\'t be estimated', () => {
  assert.equal(maturityLabel({}, NOW), null);
});

test('maturityLabel: singular vs plural "yr"/"yrs"', () => {
  assert.equal(maturityLabel({ ...AVOCADO, plantedYear: 2025 }, NOW), 'not yet bearing · 1 yr');
  assert.equal(maturityLabel({ ...AVOCADO, plantedYear: 2021 }, NOW), 'first crops · 5 yrs');
});

test('maturityLabel: no known planting year is null too, even with a cited window', () => {
  assert.equal(maturityLabel(AVOCADO, NOW), null);
});
