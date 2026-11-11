import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GATE_FIGURE_CROP_KEYS,
  GATE_YEAR_ORDER,
  climateYear,
  dryMonthsOf,
  gateFigureCrops,
  heatHeadroom,
  sowingYear,
  type GateYearSite,
} from '../lib/crop-gate-year.ts';
import {
  ECOCROP_HEAT_LIMITS_C,
  climateGateFrom,
  judgeFieldMonths,
  rainFedGrowingMonths,
  thornthwaitePetMm,
} from '../lib/crop-climate-gate.ts';
import { CROPS, cropByKey } from '../lib/crop-catalog.ts';
import { bedEntryMonth, harvestEndMonthForCrop, occupiedMonthsForPlanting, type PlanBed } from '../lib/crop-plan.ts';
import { autoSuggestPlan, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { siteClimateFromLocationData } from '../lib/site-climate.ts';
import { WATER_YEAR_ORDER } from '../lib/water-year.ts';
import { DEMO_COORDS, DEMO_LOCATION } from '../lib/demo-site.ts';

// The example farm exactly as the planner would read it: site-climate.ts's own bridge from the
// location payload, so the pattern, rain and temperatures are the planner's, not a copy.
const climate = siteClimateFromLocationData(DEMO_LOCATION, DEMO_COORDS.lat);
assert.ok(climate, 'fixture: the demo payload must resolve to a per-site climate');
const SITE: GateYearSite = {
  monthlyRainMm: climate.monthlyRainMm,
  monthlyTempC: climate.monthlyTempC,
  latDeg: DEMO_COORDS.lat,
  pattern: climate.pattern,
};

const wrap = (m: number) => ((((m - 1) % 12) + 12) % 12) + 1;
function monthRun(a: number, b: number): number[] {
  const out = [a];
  for (let m = a; m !== b && out.length < 12;) { m = wrap(m + 1); out.push(m); }
  return out;
}

test('the figure crops all exist, are plannable and carry a sourced heat limit', () => {
  const crops = gateFigureCrops();
  assert.deepEqual(crops.map((c) => c.key), [...GATE_FIGURE_CROP_KEYS]);
  for (const c of crops) assert.ok(ECOCROP_HEAT_LIMITS_C[c.key], c.key);
});

test('the year is told in the Water Year\'s column order', () => {
  assert.deepEqual([...GATE_YEAR_ORDER], WATER_YEAR_ORDER.map((i) => i + 1));
});

test('climateYear is the gate\'s own evaporation and wet-month test, nothing more', () => {
  const year = climateYear(SITE)!;
  const pet = thornthwaitePetMm(SITE.monthlyTempC, SITE.latDeg);
  const wet = rainFedGrowingMonths(SITE.monthlyRainMm, SITE.monthlyTempC, SITE.latDeg);
  year.forEach((m, i) => {
    assert.equal(m.month, i + 1);
    assert.equal(m.petMm, pet[i]);
    assert.equal(m.halfPetMm, pet[i] / 2);
    assert.equal(m.rainFed, wet[i]);
    assert.equal(m.rainFed, m.rainMm >= m.halfPetMm);
  });
});

test('at the example farm rain meets half the evaporation September to April, not May to August', () => {
  assert.equal(SITE.pattern, 'summer');
  const year = climateYear(SITE)!;
  assert.deepEqual(dryMonthsOf(year), [5, 6, 7, 8]);
});

test('at the example farm heat never binds for any figure crop', () => {
  for (const crop of gateFigureCrops()) {
    const h = heatHeadroom(crop, SITE)!;
    assert.equal(h.hottestMonth, 1);
    assert.equal(h.hottestC, 22.72);
    assert.equal(h.binds, false, crop.key);
    for (const v of sowingYear(crop, SITE, true)!) assert.deepEqual(v.hotMonths, [], `${crop.key} sown ${v.sowMonth}`);
  }
});

test('every verdict is judgeFieldMonths on the planner\'s own bed months', () => {
  for (const rainFed of [true, false]) {
    const gate = climateGateFrom({ siteMonthlyTempC: SITE.monthlyTempC as number[], siteMonthlyRainMm: SITE.monthlyRainMm as number[], siteLatitude: SITE.latDeg }, rainFed)!;
    for (const crop of gateFigureCrops()) {
      for (const v of sowingYear(crop, SITE, rainFed)!) {
        const field = occupiedMonthsForPlanting({ cropKey: crop.key, sowMonth: v.sowMonth });
        assert.deepEqual(v.fieldMonths, field);
        assert.equal(v.verdict, judgeFieldMonths(crop, field, gate));
        // The bed hold is bed entry through the end of the harvest (year-of-food.ts reads it so).
        assert.deepEqual([...field].sort((a, b) => a - b), monthRun(bedEntryMonth(v.sowMonth, crop), harvestEndMonthForCrop(v.sowMonth, crop)).sort((a, b) => a - b));
        // The reason the figure states is the reason the gate used.
        if (v.verdict === 'too-dry') assert.ok(v.dryMonths.length > 0 && v.hotMonths.length === 0);
        if (v.verdict === 'too-hot') assert.ok(v.hotMonths.length > 0);
        if (v.verdict === 'ok') assert.deepEqual(rainFed ? [...v.dryMonths, ...v.hotMonths] : v.hotMonths, []);
        assert.ok(v.harvestMonths.length > 0 && v.harvestMonths.every((m) => field.includes(m)));
      }
    }
  }
});

test('with reliable irrigation the rain check is off, and only heat can refuse', () => {
  for (const crop of gateFigureCrops()) {
    for (const v of sowingYear(crop, SITE, false)!) assert.notEqual(v.verdict, 'too-dry', `${crop.key} sown ${v.sowMonth}`);
  }
});

test('a transplanted crop\'s tray month is not a bed month', () => {
  const tomato = cropByKey('tomatoes')!;
  const v = sowingYear(tomato, SITE, true)![7];
  assert.equal(v.sowMonth, 8);
  assert.equal(v.trayMonth, 8);
  assert.equal(v.fieldMonths[0], 9);
  const maize = sowingYear(cropByKey('maize')!, SITE, true)![9];
  assert.equal(maize.trayMonth, null);
  assert.equal(maize.fieldMonths[0], 10);
});

test('the example farm\'s verdicts, rain-fed, for the figure crops', () => {
  const okIn = (key: string) => sowingYear(cropByKey(key)!, SITE, true)!.filter((v) => v.inCalendar && v.verdict === 'ok').map((v) => v.sowMonth);
  const refusedIn = (key: string) => sowingYear(cropByKey(key)!, SITE, true)!.filter((v) => v.inCalendar && v.verdict !== 'ok').map((v) => v.sowMonth);
  assert.deepEqual(okIn('cabbage'), [8, 9]);
  assert.deepEqual(refusedIn('cabbage'), [1, 2, 3]);
  assert.deepEqual(okIn('broad-beans'), []);
  assert.deepEqual(refusedIn('broad-beans'), [3, 4, 5, 6, 7]);
  assert.deepEqual(okIn('maize'), [10, 11]);
  assert.deepEqual(refusedIn('maize'), []);
});

test('the planner never places a sowing month the figure shows as refused', () => {
  const beds: PlanBed[] = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3 }));
  let placedRainFed = 0;
  for (const crop of gateFigureCrops()) {
    for (const rainFed of [true, false]) {
      const answers: AutoSuggestAnswers = {
        goal: 'family', groups: [], cropKeys: [crop.key], rhythm: 'steady', rotateCrops: true,
        allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: !rainFed,
        siteMonthlyRainMm: [...SITE.monthlyRainMm], siteMonthlyTempC: [...SITE.monthlyTempC], siteLatitude: SITE.latDeg,
      };
      const allowed = new Set(sowingYear(crop, SITE, rainFed)!.filter((v) => v.inCalendar && v.verdict === 'ok').map((v) => v.sowMonth));
      const placed = autoSuggestPlan(answers, SITE.pattern, beds, [], 10).plantings.filter((p) => p.cropKey === crop.key);
      for (const p of placed) assert.ok(allowed.has(p.sowMonth), `${crop.key} ${rainFed ? 'rain-fed' : 'irrigated'} placed in ${p.sowMonth}`);
      if (allowed.size === 0) assert.equal(placed.length, 0, `${crop.key}: nothing allowed, nothing placed`);
      if (rainFed) placedRainFed += placed.length;
    }
  }
  assert.ok(placedRainFed > 0, 'fixture: the rain-fed planner must place something, or the check above proves nothing');
});

test('bad site input gives no year rather than a guess', () => {
  assert.equal(climateYear({ ...SITE, monthlyRainMm: [1, 2, 3] }), null);
  assert.equal(climateYear({ ...SITE, monthlyRainMm: SITE.monthlyRainMm.map((v, i) => (i ? v : -1)) }), null);
  assert.equal(climateYear({ ...SITE, latDeg: Number.NaN }), null);
  assert.equal(sowingYear(CROPS[0], { ...SITE, monthlyTempC: [] }, true), null);
});

test('a hot site refuses for heat, and says so before the rain', () => {
  const lettuce = cropByKey('lettuce')!;
  const hot: GateYearSite = { ...SITE, monthlyTempC: SITE.monthlyTempC.map((t, i) => (i === 0 ? 31 : t)) };
  const v = sowingYear(lettuce, hot, true)!.find((x) => x.fieldMonths.includes(1))!;
  assert.equal(v.verdict, 'too-hot');
  assert.deepEqual(v.hotMonths, [1]);
  assert.equal(heatHeadroom(lettuce, hot)!.binds, true);
});
