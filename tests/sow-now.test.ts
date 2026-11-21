import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_SOWING_CALENDAR, buildDemoCropPlan } from '../lib/demo-farm.ts';
import { recurringPlanPlantings } from '../lib/crop-plan.ts';
import {
  SOW_NOW_CROPS,
  bestSowMonth,
  demoPlanBeds,
  plannerSowingsFor,
  sowArc,
  sowNowBaseline,
  sowOutcome,
} from '../lib/sow-now.ts';
import { cropByKey } from '../lib/crop-catalog.ts';

// Values pinned after a first run of the lib on the sample farm's plan (lib/demo-farm.ts
// buildDemoCropPlan, the "established year": repeating plantings only, January to December).

test('the sample farm: which months have no fresh vegetable, and how many kinds in the others', () => {
  const { year, beds, plantings } = sowNowBaseline();
  assert.equal(DEMO_SOWING_CALENDAR, 'all-year');
  assert.equal(beds.length, 7);
  assert.equal(plantings.length, recurringPlanPlantings(buildDemoCropPlan().plantings).length);
  assert.deepEqual(year.vegGapMonths, [5, 6, 9, 10, 11, 12]);
  assert.deepEqual(year.months.map((m) => m.freshVeg.length), [1, 1, 3, 3, 0, 0, 2, 3, 0, 0, 0, 0]);
  assert.deepEqual(year.months.map((m) => m.month), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test('the planner’s own gap fills, over the five crops offered', () => {
  const pairs = (m: number) => plannerSowingsFor(m).map((s) => `${s.cropKey}@${s.sowMonth}`);
  assert.deepEqual(pairs(5), ['swiss-chard@2', 'beetroot@2', 'tomatoes@12', 'sweet-potato@11']);
  assert.deepEqual(pairs(9), ['swiss-chard@4', 'tomatoes@2', 'beetroot@5', 'broccoli@3', 'sweet-potato@3']);
  assert.deepEqual(pairs(12), ['swiss-chard@7', 'tomatoes@7', 'beetroot@8', 'broccoli@6']);
  // The figure and the planner agree: every sowing the planner offers for a month really fills it.
  for (const g of sowNowBaseline().suggestions) {
    for (const s of g.suggestions) {
      const o = sowOutcome(s.crop.key, s.sowMonth);
      assert.equal(o.status, 'fills', `${s.crop.key} sown in ${s.sowMonth}`);
      assert.ok(o.filled.includes(g.targetMonth), `${s.crop.key} sown in ${s.sowMonth} reaches ${g.targetMonth}`);
    }
  }
});

test('chard sown in April fills June and September, and not August (August is already covered)', () => {
  const o = sowOutcome('swiss-chard', 4);
  assert.equal(o.status, 'fills');
  assert.deepEqual(o.pickMonths, [6, 7, 8, 9]);
  assert.deepEqual(o.filled, [6, 9]);
  assert.deepEqual(o.alreadyCovered, [7, 8]);
  assert.deepEqual(o.gapsAfter, [5, 10, 11, 12]);
  assert.deepEqual(o.steps.map((s) => `${s.month}:${s.stage}`), ['4:sow', '5:bed', '6:pick', '7:pick', '8:pick', '9:pick']);
});

test('chard sown in July fills four hungry months in a row; that is the best month for chard', () => {
  const o = sowOutcome('swiss-chard', 7);
  assert.deepEqual(o.filled, [9, 10, 11, 12]);
  assert.deepEqual(o.gapsAfter, [5, 6]);
  assert.deepEqual(bestSowMonth('swiss-chard'), { sowMonth: 7, filled: [9, 10, 11, 12] });
});

test('beetroot sown in April picks only months that are already covered', () => {
  const o = sowOutcome('beetroot', 4);
  assert.equal(o.status, 'adds-nothing-new');
  assert.deepEqual(o.pickMonths, [7, 8]);
  assert.deepEqual(o.filled, []);
  assert.deepEqual(o.gapsAfter, [5, 6, 9, 10, 11, 12]);
});

test('tomatoes: a tray crop spends two months in the nursery, and April is not a sourced sowing month here', () => {
  const march = sowOutcome('tomatoes', 3);
  assert.deepEqual(march.steps.map((s) => `${s.month}:${s.stage}`), ['3:sow', '4:tray', '5:bed', '6:bed', '7:bed', '8:pick', '9:pick', '10:pick']);
  assert.equal(march.transplant, true);
  assert.deepEqual(march.filled, [9, 10]);
  const april = sowOutcome('tomatoes', 4);
  assert.equal(april.inSeason, false);
  assert.equal(april.status, 'out-of-season');
  assert.deepEqual(april.filled, [], 'an unsourced sowing month fills nothing');
  assert.deepEqual(april.wouldFill, [9, 10, 11], 'but the picking it would give is still computed');
});

test('a sowing that picks over New Year wraps to January', () => {
  const o = sowOutcome('tomatoes', 12);
  assert.deepEqual(o.pickMonths, [5, 6, 7]);
  const nov = sowOutcome('beetroot', 9);
  assert.deepEqual(nov.pickMonths, [12, 1]);
  assert.deepEqual(nov.filled, [12]);
});

test('arc arithmetic is the planner’s: first pick = maturity (+2 for a tray crop), last = window', () => {
  for (const key of SOW_NOW_CROPS) {
    const crop = cropByKey(key)!;
    const arc = sowArc(crop, 1);
    assert.equal(arc[0].stage, 'sow');
    assert.ok(arc.slice(-1)[0].stage === 'pick');
    assert.equal(arc.filter((s) => s.stage === 'tray').length, crop.transplant ? 1 : 0);
  }
});

test('every outcome stays inside the baseline: filled ⊆ gaps, would-fill ⊆ gaps, none invented', () => {
  const gaps = sowNowBaseline().year.vegGapMonths;
  for (const key of SOW_NOW_CROPS) {
    for (let m = 1; m <= 12; m++) {
      const o = sowOutcome(key, m);
      assert.ok(o.filled.every((g) => gaps.includes(g)));
      assert.ok(o.wouldFill.every((g) => gaps.includes(g)));
      assert.ok(o.filled.every((g) => o.pickMonths.includes(g)));
      assert.equal(o.gapsAfter.length, gaps.length - o.filled.length);
    }
  }
});

test('the plan’s beds are the design’s: six beds and one hügel', () => {
  assert.deepEqual(demoPlanBeds().map((b) => b.label), ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4', 'Bed 5', 'Bed 6', 'Hügel 1']);
});
