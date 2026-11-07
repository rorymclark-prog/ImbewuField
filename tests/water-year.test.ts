import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DAYS_IN_MONTH,
  LITRES_PER_PERSON_DAY,
  TANK_SIZES_L,
  WATER_YEAR_ORDER,
  levelAtDay,
  monthStarts,
  waterYear,
} from '../lib/water-year.ts';
import { roofHarvestLitres, WATER_SHEET_ROOF_RUNOFF_COEFFICIENT } from '../lib/roof-runoff.ts';
import { recommendedTankLitres } from '../lib/water-calc.ts';
import { DEMO_LOCATION, DEMO_WATER_DATA } from '../lib/demo-site.ts';

// The Water Year figure on /example animates these numbers, so they have to be the app's own:
// the same catch rule as the Tank Calculator, the same 80 L/person/day as WaterBalance, the same
// month-end clamp as WaterBalance's tank line. These tests hold the module to that.

const MM = DEMO_LOCATION.rainfall.monthly;
const ROOF = DEMO_WATER_DATA.areaM2;

function demo(people: number, tankL: number) {
  const y = waterYear({ monthlyMm: MM, roofM2: ROOF, people, tankL, pattern: 'summer' });
  assert.ok(y, 'demo inputs must simulate');
  return y;
}

test('the year is told October to September and covers 365 days', () => {
  assert.deepEqual([...WATER_YEAR_ORDER].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(WATER_YEAR_ORDER[0], 9);
  assert.equal(monthStarts()[12], 365);
  assert.equal(DAYS_IN_MONTH.reduce((s, d) => s + d, 0), 365);
});

test('roof catch is roofHarvestLitres at the one generic coefficient, month by month', () => {
  const y = demo(4, 20000);
  for (const m of y.months) {
    assert.equal(m.caughtL, roofHarvestLitres(ROOF, MM[m.month], WATER_SHEET_ROOF_RUNOFF_COEFFICIENT));
  }
  const annual = roofHarvestLitres(ROOF, MM.reduce((s, mm) => s + mm, 0), WATER_SHEET_ROOF_RUNOFF_COEFFICIENT);
  assert.ok(Math.abs(y.caughtL - annual) < 1e-6);
});

test('household use is 80 L per person per day over the real month length', () => {
  const y = demo(3, 5000);
  for (const m of y.months) assert.equal(m.useL, 3 * LITRES_PER_PERSON_DAY * m.days);
  assert.equal(y.useL, 3 * 80 * 365);
});

test('each month ends where WaterBalance\'s month-end clamp would put it', () => {
  for (const people of [1, 2, 4]) {
    for (const tankL of TANK_SIZES_L) {
      const y = demo(people, tankL);
      for (const m of y.months) {
        const expected = Math.max(0, Math.min(tankL, m.startL + m.caughtL - m.useL));
        assert.ok(Math.abs(m.endL - expected) < 1e-6, `${people}p ${tankL}L month ${m.month}`);
      }
    }
  }
});

test('the year starts from the level it ends on, not a guessed half tank', () => {
  for (const people of [1, 2, 3, 4]) {
    for (const tankL of TANK_SIZES_L) {
      const y = demo(people, tankL);
      assert.ok(y.settled);
      assert.ok(Math.abs(y.months[11].endL - y.startL) < 0.5, `${people}p ${tankL}L`);
    }
  }
});

test('water is conserved: start + caught = supplied + spilled + end', () => {
  for (const people of [1, 2, 4]) {
    for (const tankL of TANK_SIZES_L) {
      const y = demo(people, tankL);
      const lhs = y.startL + y.caughtL;
      const rhs = y.suppliedL + y.spilledL + y.months[11].endL;
      assert.ok(Math.abs(lhs - rhs) < 1e-6, `${people}p ${tankL}L: ${lhs} vs ${rhs}`);
    }
  }
});

test('levelAtDay meets each month\'s start and end, and empty days add up', () => {
  const y = demo(2, 10000);
  const starts = monthStarts();
  y.months.forEach((m, i) => {
    assert.ok(Math.abs(levelAtDay(y, starts[i]) - m.startL) < 1e-6);
    assert.ok(Math.abs(levelAtDay(y, starts[i + 1] - 1e-9) - m.endL) < 1e-3);
    if (m.emptyAtDay !== null) {
      assert.ok(levelAtDay(y, starts[i] + m.emptyAtDay + 0.01) === 0);
      assert.ok(Math.abs(m.emptyDays - (m.days - m.emptyAtDay)) < 1e-9);
    }
  });
  // Sampling the level hourly must count the same empty days the months report.
  let hoursEmpty = 0;
  for (let h = 0; h < 365 * 24; h += 1) if (levelAtDay(y, (h + 0.5) / 24) <= 1e-9) hoursEmpty += 1;
  assert.ok(Math.abs(hoursEmpty / 24 - y.emptyDays) < 0.1, `${hoursEmpty / 24} vs ${y.emptyDays}`);
});

test('the recommended tank is water-calc\'s own recommendation for this catch', () => {
  const y = demo(4, 5000);
  assert.equal(y.recommendedTankL, recommendedTankLitres(y.caughtL, 'summer'));
});

test('the demo tells two different stories, and the figure depends on both', () => {
  // Four people (WaterBalance's default household) out-use what this roof can catch, so no
  // tank size rescues the dry season: the 10 000 L and 20 000 L years are identical.
  const four10 = demo(4, 10000);
  const four20 = demo(4, 20000);
  assert.ok(four10.useL > four10.caughtL);
  assert.ok(four20.emptyDays > 0);
  assert.equal(four10.emptyDays, four20.emptyDays);
  // Two people use less than the roof catches, and then storage is what decides it.
  const two10 = demo(2, 10000);
  const two20 = demo(2, 20000);
  assert.ok(two20.useL < two20.caughtL);
  assert.ok(two10.emptyDays > 0);
  assert.equal(two20.emptyDays, 0);
});

test('bad input returns null rather than a figure', () => {
  assert.equal(waterYear({ monthlyMm: MM.slice(0, 11), roofM2: ROOF, people: 2, tankL: 5000 }), null);
  assert.equal(waterYear({ monthlyMm: MM, roofM2: 0, people: 2, tankL: 5000 }), null);
  assert.equal(waterYear({ monthlyMm: MM, roofM2: ROOF, people: 2, tankL: 0 }), null);
  assert.equal(waterYear({ monthlyMm: MM.map(() => Number.NaN), roofM2: ROOF, people: 2, tankL: 5000 }), null);
  assert.equal(waterYear({ monthlyMm: MM, roofM2: ROOF, people: 2, tankL: 5000, coefficient: 1.2 }), null);
});
