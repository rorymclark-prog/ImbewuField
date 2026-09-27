import test from 'node:test';
import assert from 'node:assert/strict';

import { autoSuggestPlan, type AutoSuggestAnswers } from '../lib/crop-autosuggest.ts';
import { CROPS, hasVerifiedSchedule } from '../lib/crop-catalog.ts';
import { occupiedMonthsForPlanting, type PlanBed } from '../lib/crop-plan.ts';
import { ECOCROP_HEAT_LIMITS_C, rainFedGrowingMonths, thornthwaitePetMm } from '../lib/crop-climate-gate.ts';

const BEDS: PlanBed[] = Array.from({ length: 6 }, (_, i) => ({ id: `b${i + 1}`, label: `Bed ${i + 1}`, areaM2: 9, minDimM: 3 }));
const base: AutoSuggestAnswers = {
  goal: 'family', householdSize: 'medium', groups: [], rhythm: 'steady',
  rotateCrops: true, allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
};
const texts = (r: { notes: readonly { text: string }[] }) => r.notes.map((n) => n.text);

test('every schedulable crop has a sourced ECOCROP heat limit', () => {
  const missing = CROPS.filter(hasVerifiedSchedule).filter((crop) => !ECOCROP_HEAT_LIMITS_C[crop.key]).map((c) => c.key);
  assert.deepEqual(missing, []);
  for (const [key, limit] of Object.entries(ECOCROP_HEAT_LIMITS_C)) {
    assert.ok(limit.optimalMax < limit.absoluteMax, `${key}: optimum must sit below the absolute limit`);
  }
});

test('no site temperatures means the regional calendar is used unchanged', () => {
  const a = autoSuggestPlan(base, 'summer', BEDS, [], 3);
  const b = autoSuggestPlan({ ...base, siteMonthlyTempC: undefined }, 'summer', BEDS, [], 3);
  assert.deepEqual(a.plantings, b.plantings);
});

test('a month hotter than the ECOCROP limit rules out a crop that grows through it', () => {
  // Spinach tops out at 27 °C in ECOCROP; lettuce at 30. A site averaging
  // 28 °C every month keeps lettuce and loses spinach — with the reason said.
  const answers = { ...base, cropKeys: ['true-spinach', 'lettuce'] };
  const cool = autoSuggestPlan({ ...answers, siteMonthlyTempC: Array(12).fill(18) }, 'mild-frost', BEDS, [], 3);
  assert.ok(cool.plantings.some((p) => p.cropKey === 'true-spinach'), 'fixture: spinach must place at 18 °C');
  const hot = autoSuggestPlan({ ...answers, siteMonthlyTempC: Array(12).fill(28) }, 'mild-frost', BEDS, [], 3);
  assert.ok(!hot.plantings.some((p) => p.cropKey === 'true-spinach'));
  assert.ok(hot.plantings.some((p) => p.cropKey === 'lettuce'));
  assert.ok(texts(hot).some((t) => /Spinach.*left out.*hotter than the crop's upper limit in FAO ECOCROP/i.test(t)), texts(hot).join('\n'));
  assert.ok(texts(hot).some((t) => /warmer than the crop's ideal range in FAO ECOCROP.*Lettuce/.test(t)), 'lettuce above its 21 °C optimum is disclosed');
});

test('a hot summer skips only the sowing months that grow into it', () => {
  // 31 °C Dec–Feb, 20 °C otherwise: lettuce (limit 30) must avoid those months.
  const temps = [31, 31, 20, 20, 20, 20, 20, 20, 20, 20, 20, 31];
  const r = autoSuggestPlan({ ...base, cropKeys: ['lettuce'], siteMonthlyTempC: temps }, 'mild-frost', BEDS, [], 3);
  assert.ok(r.plantings.length, 'lettuce still fits the cool months');
  for (const p of r.plantings) {
    const hotMonths = occupiedMonthsForPlanting(p).filter((m) => temps[m - 1] > 30);
    assert.deepEqual(hotMonths, [], `lettuce sown ${p.sowMonth} grows through ${hotMonths}`);
  }
});

test('Thornthwaite PET is zero at or below freezing and rises with temperature', () => {
  const pet = thornthwaitePetMm([-2, 0, 5, 10, 15, 20, 25, 28, 30, 20, 10, 5], -29);
  assert.equal(pet[0], 0);
  assert.equal(pet[1], 0);
  assert.ok(pet[2] < pet[3] && pet[3] < pet[4] && pet[4] < pet[5] && pet[5] < pet[6] && pet[6] < pet[7]);
  // Sanity band only: Durban-like normals should give a humid-subtropical
  // annual PET of roughly a metre, not tens of mm or several metres.
  const durban = thornthwaitePetMm([24.5, 24.8, 24, 22, 19.5, 17.5, 17, 18, 19.5, 20.5, 22, 23.5], -29.9)
    .reduce((s, v) => s + v, 0);
  assert.ok(durban > 1000 && durban < 1400, `Durban annual PET ${durban.toFixed(0)} mm`);
});

test('rain-fed growing months need rain of at least half the PET', () => {
  const temps = Array(12).fill(20);
  const wet = rainFedGrowingMonths(Array(12).fill(300), temps, -29);
  assert.ok(wet.every(Boolean));
  const dry = rainFedGrowingMonths(Array(12).fill(0), temps, -29);
  assert.ok(dry.every((v) => !v));
});

test('without irrigation and without site climate the planner still refuses', () => {
  const r = autoSuggestPlan({ ...base, reliableIrrigation: false }, 'summer', BEDS, [], 10);
  assert.equal(r.plantings.length, 0);
  assert.ok(texts(r).some((t) => /reliable irrigation was not confirmed/.test(t)));
});

test('a rain-fed plan only grows crops through the wet months', () => {
  // Summer-rain site: wet Oct–Mar, bone dry Apr–Sep.
  const rain = [130, 110, 90, 0, 0, 0, 0, 0, 0, 80, 110, 130];
  const temps = [23, 23, 22, 19, 16, 13, 13, 15, 18, 20, 21, 22];
  const r = autoSuggestPlan({
    ...base, reliableIrrigation: false, siteMonthlyRainMm: rain, siteMonthlyTempC: temps, siteLatitude: -29,
  }, 'summer', BEDS, [], 9);
  assert.ok(r.plantings.length, 'a wet summer must still get a rain-fed plan');
  const wet = rainFedGrowingMonths(rain, temps, -29);
  for (const p of r.plantings) {
    const dryMonths = occupiedMonthsForPlanting(p).filter((m) => !wet[m - 1]);
    assert.deepEqual(dryMonths, [], `${p.cropKey} sown ${p.sowMonth} grows through dry months ${dryMonths}`);
  }
  assert.ok(texts(r).some((t) => /^Rain-fed plan:/.test(t)));
});

test('a frost-free plan names the crops whose frost-free months are not sourced', () => {
  const cited = autoSuggestPlan({ ...base, cropKeys: ['swiss-chard', 'onions'] }, 'all-year', BEDS, [], 3);
  assert.ok(cited.plantings.length);
  assert.ok(!texts(cited).some((t) => /not yet from a published local table/.test(t)));
  const mixed = autoSuggestPlan({ ...base, cropKeys: ['swiss-chard', 'lettuce'] }, 'all-year', BEDS, [], 3);
  assert.ok(mixed.plantings.some((p) => p.cropKey === 'lettuce'), 'fixture: lettuce must place');
  const note = texts(mixed).find((t) => /not yet from a published local table/.test(t));
  assert.ok(note && /Lettuce/.test(note) && !/Swiss chard/.test(note), note);
});
