// Winter coverage regression — the "beds 5-9 rest all May-Aug" hole. Root causes fixed on
// 2026-08-04: backfillWinterGaps refused to commit any sowing >5 months out (a guaranteed no-op
// run Jun-Sep), and fillRemainingGaps spent the shoulder months on quick crops before winter was
// attempted, foreclosing the only long bridgers. The engine is deterministic, so these are exact.
//
// Same afternoon, the owner's next complaint proved coverage alone was not the goal: "september
// is hardly anything and there is no new planting for jun july... i am tired of not seeing a
// full ideal planting!". Coverage had been achieved by every bed bridging winter from the SAME
// early sow month — so the sow-month scarcity tally (SowCounts) now staggers the passes, and the
// tests below pin the OUTCOME Rory asked for, not the mechanism: winter months get fresh
// sowings, and the established year (the plan repeated annually, folded mod-12) has food on the
// table every single month.
import test from 'node:test';
import assert from 'node:assert/strict';

import { autoSuggestPlan, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { occupiedMonthsForPlanting, buildFoodAvailability, type PlanBed } from '../lib/crop-plan.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { foodGroupOf } from '../lib/crop-groups.ts';

const NINE_BEDS: PlanBed[] = Array.from({ length: 9 }, (_, i) => ({
  id: `bed-${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3,
}));

// Ubhejane's real staple ground: four ~21 m² plots traced as staple-garden zones.
const FOUR_PLOTS: PlanBed[] = Array.from({ length: 4 }, (_, i) => ({
  id: `zone-staple-${i + 1}`, label: `Plot ${i + 1}`, areaM2: 21, minDimM: 3.5, kind: 'plot' as const,
}));

const FAMILY: AutoSuggestAnswers = {
  goal: 'family',
  householdSize: 'medium',
  groups: ['staple_grain', 'legume', 'leafy_green', 'root_tuber', 'allium_aromatic', 'fruiting_veg'],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
} as AutoSuggestAnswers;

test('an August plan under mild-frost covers winter on every bed — Ubhejane’s exact shape', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const bed of NINE_BEDS) {
    const months = new Set(
      res.plantings
        .filter((p) => p.bedId === bed.id)
        .flatMap((p) => occupiedMonthsForPlanting(p)),
    );
    // Jun and Jul were the permanent hole. The catalogue genuinely covers them under
    // mild-frost (chard, kale, peas, broccoli, garlic…), so an empty winter now means the
    // engine regressed, not the season.
    assert.ok(months.has(6), `${bed.label} has nothing growing in June`);
    assert.ok(months.has(7), `${bed.label} has nothing growing in July`);
  }
});

test('the winter bridger commits far-out sowings instead of narrating a rest it could fix', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const note of res.notes) {
    assert.doesNotMatch(note, /too far out to plant now/, 'the dropped-bridge note was removed with the gate');
    // A "rests over winter" claim while the same result plants that very stretch was the
    // self-contradiction class — reportStillRestingBeds, computed against FINAL occupancy,
    // is the only voice allowed to say "rests", and after the fixes it should have no
    // winter rest to report under this profile.
    assert.doesNotMatch(note, /rests? (all|over|in) .*(Jun|Jul)/i, `contradictory or stale rest note: "${note}"`);
  }
});

test('winter gets NEW sowings, not just coverage — June and July each see a fresh planting', () => {
  // The catalog genuinely sows 10 crops in June and 9 in July under mild-frost; a plan with
  // zero winter sowings was the engine clustering, not the season ("there is no new planting
  // for jun july"). Guard the premise first so a future catalog edit fails loudly here rather
  // than making the engine assertion below silently unfair.
  for (const m of [6, 7]) {
    assert.ok(
      CROPS.some((c) => (c.sowMonths['mild-frost'] ?? []).includes(m)),
      `catalog premise broken: nothing sowable in month ${m} under mild-frost`,
    );
  }
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const m of [6, 7]) {
    assert.ok(
      res.plantings.some((p) => p.sowMonth === m),
      `no planting is sown in month ${m} — winter succession regressed to bridging-only`,
    );
  }
});

test('an established year eats every month — the mod-12 fold has food on the table Jan-Dec', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  // No nowMonth: the builders fold every planting mod-12 — the "this plan repeated every
  // year" steady state the charts' Established-year view shows. September was the complaint
  // ("september is hardly anything"), but the promise is all twelve months.
  const availability = buildFoodAvailability(res.plantings, NINE_BEDS);
  for (let m = 1; m <= 12; m++) {
    assert.ok(
      availability[m].length > 0,
      `month ${m} has neither fresh harvest nor storage in the established year`,
    );
  }
});

test('four staple plots get four different full-area field crops in one pass', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', [...NINE_BEDS, ...FOUR_PLOTS], [], 8);
  const firstGroupByPlot: string[] = [];
  for (const plot of FOUR_PLOTS) {
    const onPlot = res.plantings.filter((p) => p.bedId === plot.id);
    assert.ok(onPlot.length > 0, `${plot.label} got no planting at all`);
    for (const p of onPlot) {
      assert.equal(p.areaFraction, undefined, `${plot.label} got a fractional planting — a plot takes one crop at FULL area`);
    }
    const firstCrop = CROPS.find((c) => c.key === onPlot[0].cropKey)!;
    firstGroupByPlot.push(foodGroupOf(firstCrop));
  }
  // The classic four-course layout: no two plots open the season on the same group.
  assert.equal(new Set(firstGroupByPlot).size, 4, `plots opened on groups [${firstGroupByPlot.join(', ')}] — expected 4 distinct courses`);
});

test('re-running next season with rotation on turns every plot to a different group', () => {
  const first = autoSuggestPlan(FAMILY, 'mild-frost', [...NINE_BEDS, ...FOUR_PLOTS], [], 8);
  // The documented "planning next year" flow: last season's accepted plantings come back as
  // existingPlantings and the engine plans the next turn of the wheel around them.
  const second = autoSuggestPlan(FAMILY, 'mild-frost', [...NINE_BEDS, ...FOUR_PLOTS], first.plantings, 8);
  for (const plot of FOUR_PLOTS) {
    const before = first.plantings.filter((p) => p.bedId === plot.id);
    const after = second.plantings.filter((p) => p.bedId === plot.id);
    if (!before.length || !after.length) continue; // absence is covered by the test above
    const groupOf = (key: string) => foodGroupOf(CROPS.find((c) => c.key === key)!);
    assert.notEqual(
      groupOf(after[0].cropKey),
      groupOf(before[0].cropKey),
      `${plot.label} repeated its food group two seasons running despite rotation`,
    );
  }
});
