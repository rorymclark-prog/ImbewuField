// Winter coverage regression — the "beds 5-9 rest all May-Aug" hole. Root causes fixed on
// 2026-08-04: backfillWinterGaps refused to commit any sowing >5 months out (a guaranteed no-op
// run Jun-Sep), and fillRemainingGaps spent the shoulder months on quick crops before winter was
// attempted, foreclosing the only long bridgers. The engine is deterministic, so these are exact.
//
// Same afternoon, the owner's next complaint proved coverage alone was not the goal: "september
// is hardly anything and there is no new planting for jun july... i am tired of not seeing a
// full ideal planting!". Coverage had been achieved by every bed bridging winter from the SAME
// early sow month — so the sow-month scarcity tally (SowCounts) now staggers the passes, and the
// tests below pin the audited outcome rather than an invented monthly-food promise: use every
// source-backed sowing opportunity that fits, never double-book mapped area, and disclose the
// winter rest that remains when the farmer's exact crop list has no legal crop for that slot.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  autoSuggestPlan,
  isStandardBedFraction,
  plannedCohortReachesMonth,
  planningWeightBenchmarkScore,
  type AutoSuggestAnswers,
} from '../lib/crop-autosuggest.ts';
import { buildFieldUtilizationByMonth, occupiedMonthsForPlanting, type PlanBed } from '../lib/crop-plan.ts';
import { cropByKey, CROPS, hasAutomaticPlanningBasis, hasVerifiedFieldPlan } from '../lib/crop-catalog.ts';
import { foodGroupOf, rotationFamilyOf } from '../lib/crop-groups.ts';
import { isStapleCrop } from '../lib/staple-crops.ts';

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
  reliableIrrigation: true,
} as AutoSuggestAnswers;

test('auto-suggest refuses to invent a production plan until reliable irrigation is confirmed', () => {
  for (const reliableIrrigation of [undefined, false]) {
    const result = autoSuggestPlan(
      { ...FAMILY, reliableIrrigation },
      'mild-frost',
      NINE_BEDS,
      [],
      8,
    );
    assert.deepEqual(result.plantings, []);
    assert.deepEqual(result.laterThisYear, []);
    assert.match(result.notes.join(' '), /reliable irrigation was not confirmed/i);
    assert.match(result.notes.join(' '), /packs successive crop cycles.*rainfall label.*does not prove/i);
  }
});

test('a crop with unresolved timing or field geometry stays readable but cannot enter auto-suggest', () => {
  // These legacy catalog rows still decode saved records. None has the full
  // duration + field-layout basis needed to generate a new planting schedule.
  for (const key of ['maize', 'dry-beans', 'kale', 'oats']) {
    const crop = cropByKey(key);
    assert.ok(crop, `${key} disappeared from historical crop lookup`);
    assert.ok(crop.name.trim() && crop.note.trim(), `${key} is no longer readable as a named record`);
    assert.equal(hasVerifiedFieldPlan(crop), false, `${key} unexpectedly gained a verified field plan`);
    assert.equal(hasAutomaticPlanningBasis(crop), false, `${key} can still drive automatic planning`);

    const result = autoSuggestPlan({
      ...FAMILY,
      cropKeys: [key],
      groups: [],
    }, 'mild-frost', [NINE_BEDS[0], FOUR_PLOTS[0]], [], 8);
    assert.deepEqual(result.plantings, [], `${key} entered a new automatic schedule`);
    assert.deepEqual(result.laterThisYear, [], `${key} was offered as a later automatic schedule`);
    assert.match(result.notes.join(' '), /crop duration and field-spacing basis/i);
    assert.doesNotMatch(result.notes.join(' '), /widen.*(?:group|selection)/i);
  }
});

test('tomatoes have a verified household-garden basis and can be selected explicitly', () => {
  const tomato = cropByKey('tomatoes');
  assert.ok(tomato);
  assert.equal(hasAutomaticPlanningBasis(tomato), true);
  const result = autoSuggestPlan({ ...FAMILY, cropKeys: ['tomatoes'], groups: [] }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.some((planting) => planting.cropKey === 'tomatoes'));
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'tomatoes'));
});

test('automatic vegetable plantings use only full, half, third or quarter beds', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['tomatoes', 'swiss-chard', 'lettuce', 'carrots', 'green-beans'],
    groups: [],
  }, 'mild-frost', NINE_BEDS, [], 8);
  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => isStandardBedFraction(planting.areaFraction)));
});

test('exact crop choices remain a strict whitelist on veg beds and staple plots', () => {
  const bed = NINE_BEDS[0];
  const plot = FOUR_PLOTS[0];
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['cabbage'],
    groups: ['fruiting_veg'], // stale category state must not override the exact choice
  }, 'mild-frost', [bed, plot], [], 8);

  assert.ok(result.plantings.some((planting) => planting.bedId === bed.id));
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'cabbage'));
  assert.ok(
    result.plantings.every((planting) => planting.bedId !== plot.id),
    'a non-staple exact choice must leave the plot unplanned, not trigger a catalog fallback',
  );
});

test('an exact staple choice does not gain an unchosen winter cover', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['groundnuts'],
    rhythm: 'few-big',
  }, 'mild-frost', [FOUR_PLOTS[0]], [], 8);

  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'groundnuts'));
});

test('no-mixing mode never strands a virtual bed with a fractional tail reservation', () => {
  const bed: PlanBed = { id: 'virtual', label: 'Virtual bed', areaM2: 10, minDimM: 1.2 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['cabbage', 'carrots', 'green-beans'],
    allowMixedCropsInBed: false,
    rotateCrops: true,
  }, 'mild-frost', [bed], [], 8);

  assert.ok(result.plantings.length > 0, 'the only mapped bed was left unplanned');
  assert.ok(
    result.plantings.every((planting) => planting.areaFraction === undefined),
    `no-mixing plan stranded the bed with ${result.plantings
      .map((planting) => `${planting.cropKey} ${(planting.areaFraction ?? 1) * 100}%`)
      .join(', ')}`,
  );
  assert.ok(
    result.plantings.some((planting) => planting.sowMonth === 8),
    'a far-out tail reservation pre-empted a supported crop that can start now',
  );
});

test('an exact crop rest explanation names the whitelist instead of promising group widening', () => {
  const bed: PlanBed = { id: 'home', label: 'Home bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['green-beans'],
    rotateCrops: false,
  }, 'winter', [bed], [], 11);
  const restNote = result.notes.find((note) => note.includes('still rests')) ?? '';

  assert.match(restNote, /chosen crops \(Green beans\)/);
  assert.match(restNote, /supported yield benchmark, duration and field-spacing basis/i);
  assert.doesNotMatch(restNote, /outside your selected groups|widen your selection/i);
});

test('a future September cohort cannot claim the January that occurs before it', () => {
  const cabbage = cropByKey('cabbage')!;
  assert.ok(
    occupiedMonthsForPlanting({ cropKey: cabbage.key, sowMonth: 9 }).includes(1),
    'fixture must wrap through January when reduced to month names',
  );
  assert.equal(
    plannedCohortReachesMonth(11, 9, cabbage, 1),
    false,
    'September +10 was folded backward and treated as reaching January +2',
  );
});

test('one-off existing cabbage does not repeat annually and block next September green beans', () => {
  const bed: PlanBed = { id: 'home', label: 'Home bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    ...FAMILY,
    groups: [],
    cropKeys: ['green-beans'],
    rhythm: 'few-big',
    allowMixedCropsInBed: false,
    rotateCrops: true,
  }, 'mild-frost', [bed], [{
    id: 'observed-cabbage',
    bedId: bed.id,
    cropKey: 'cabbage',
    sowMonth: 8,
    existing: true,
  }], 11);

  assert.deepEqual(
    result.plantings.map((planting) => ({
      cropKey: planting.cropKey,
      sowMonth: planting.sowMonth,
      areaFraction: planting.areaFraction,
    })),
    [{ cropKey: 'green-beans', sowMonth: 9, areaFraction: undefined }],
  );
});

test('commercial ranking compares sourced conservative yield per crop cycle, not an invented annual rate', () => {
  const butternut = cropByKey('butternut')!;
  const pumpkin = cropByKey('pumpkin')!;
  assert.notEqual(butternut.daysToHarvest, pumpkin.daysToHarvest);
  assert.equal(butternut.yieldKgPerM2, pumpkin.yieldKgPerM2);
  assert.equal(planningWeightBenchmarkScore(butternut), planningWeightBenchmarkScore(pumpkin));
});

test('an August plan under mild-frost covers winter on every bed — Ubhejane’s exact shape', () => {
  // Bed-by-bed uninterrupted occupancy requires overlapping crop cohorts in
  // some beds. Make that farmer choice explicit; default no-mixing mode may
  // honestly leave a short rotation gap rather than invent intercropping.
  const res = autoSuggestPlan(
    { ...FAMILY, allowMixedCropsInBed: true },
    'mild-frost',
    NINE_BEDS,
    [],
    8,
  );
  for (const bed of NINE_BEDS) {
    const months = new Set(
      res.plantings
        .filter((p) => p.bedId === bed.id)
        .flatMap((p) => occupiedMonthsForPlanting(p)),
    );
    // Jun and Jul were the permanent hole. KZN DARD's light-frost windows include
    // source-backed winter options such as cabbage, beetroot, lettuce, peas and
    // broccoli, so an empty winter under confirmed irrigation is an engine regression.
    assert.ok(months.has(6), `${bed.label} has nothing growing in June`);
    assert.ok(months.has(7), `${bed.label} has nothing growing in July`);
  }
});

test('the winter bridger commits far-out sowings instead of narrating a rest it could fix', () => {
  const res = autoSuggestPlan(
    { ...FAMILY, allowMixedCropsInBed: true },
    'mild-frost',
    NINE_BEDS,
    [],
    8,
  );
  for (const note of res.notes) {
    assert.doesNotMatch(note, /too far out to plant now/, 'the dropped-bridge note was removed with the gate');
    // A "rests over winter" claim while the same result plants that very stretch was the
    // self-contradiction class — reportStillRestingBeds, computed against FINAL occupancy,
    // is the only voice allowed to say "rests", and after the fixes it should have no
    // winter rest to report under this profile.
    assert.doesNotMatch(note, /rests? (all|over|in) .*(Jun|Jul)/i, `contradictory or stale rest note: "${note}"`);
  }
});

test('winter production stays source-backed and every resting bed is disclosed without a sowing quota', () => {
  // "No new planting in June/July" originally exposed genuinely bare beds.
  // Once conservative crop durations are used, a bed can be fully productive
  // through winter from an earlier source-backed sowing. Requiring a new sowing
  // in each named month would now be the bug: it rewards calendar decoration,
  // not land use, and can double-book a crop that is still in the ground.
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  for (const m of [6, 7]) {
    const active = res.plantings.filter((planting) => occupiedMonthsForPlanting(planting).includes(m));
    const activeBedIds = new Set(active.map((planting) => planting.bedId));
    assert.ok(activeBedIds.size > 0, `month ${m} has no mapped-bed production`);
    assert.ok(
      active.every((planting) => hasAutomaticPlanningBasis(cropByKey(planting.cropKey)!)),
      `month ${m} is covered by a crop without complete automatic-planning evidence`,
    );
    for (const bed of NINE_BEDS.filter((candidate) => !activeBedIds.has(candidate.id))) {
      assert.ok(
        res.notes.some((note) => note.startsWith(`${bed.label} still rests in`)),
        `${bed.label}'s month ${m} rest is hidden from the farmer`,
      );
    }
  }
});

test('an established year uses mapped land every month without calling occupancy a harvest', () => {
  const res = autoSuggestPlan(FAMILY, 'mild-frost', NINE_BEDS, [], 8);
  // Conservative upper durations keep land occupied for longer, but an occupied
  // growing month is not automatically a fresh-food month. This pins the real
  // production objective — use the mapped area — without inventing storage or
  // moving a harvest merely to make all twelve chart columns non-empty.
  const utilization = buildFieldUtilizationByMonth(res.plantings, NINE_BEDS);
  for (let m = 1; m <= 12; m++) {
    assert.ok(
      utilization[m] > 0,
      `month ${m} leaves all mapped veg-bed area idle in the established year`,
    );
  }
});

test('staple plots use every supported field-crop group before repeating one at full area', () => {
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
  // Grain maize and dry beans currently lack a complete schedule basis. The
  // optimiser must exhaust the supported staple groups before repeating one;
  // it must not revive an unsupported crop just to manufacture four labels.
  const supportedGroups = new Set(
    CROPS.filter((crop) => isStapleCrop(crop) && hasAutomaticPlanningBasis(crop)).map(foodGroupOf),
  );
  assert.deepEqual(
    new Set(firstGroupByPlot),
    supportedGroups,
    `plots opened on [${firstGroupByPlot.join(', ')}] instead of every supported staple group`,
  );
});

test('a supplied prior crop record prevents an immediate same-family repeat when an alternative fits', () => {
  const plot = FOUR_PLOTS[0];
  const priorGroundnuts = [{
    id: 'prior-groundnuts', bedId: plot.id, cropKey: 'groundnuts', sowMonth: 10, existing: true,
  }];
  const choices: AutoSuggestAnswers = {
    ...FAMILY,
    cropKeys: ['sweet-potato', 'groundnuts'],
    rhythm: 'few-big',
  };
  const withRotation = autoSuggestPlan({ ...choices, rotateCrops: true }, 'mild-frost', [plot], priorGroundnuts, 8);
  const withoutRotation = autoSuggestPlan({ ...choices, rotateCrops: false }, 'mild-frost', [plot], priorGroundnuts, 8);

  assert.equal(withRotation.plantings[0]?.cropKey, 'sweet-potato');
  assert.equal(withoutRotation.plantings[0]?.cropKey, 'groundnuts');
  assert.notEqual(
    rotationFamilyOf(cropByKey(withRotation.plantings[0].cropKey)!),
    rotationFamilyOf(cropByKey('groundnuts')!),
  );
});

test('real green-bean history outranks a synthetic previous-year copy of a future proposal', () => {
  const bed: PlanBed = { id: 'stress-bed', label: 'Stress bed', areaM2: 4, minDimM: 0.8 };
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'summer', [bed], [{
    id: 'existing-green-beans',
    bedId: bed.id,
    cropKey: 'green-beans',
    sowMonth: 4,
    existing: true,
  }], 11);

  const first = [...result.plantings]
    .sort((a, b) => ((a.sowMonth - 11 + 12) % 12) - ((b.sowMonth - 11 + 12) % 12))[0];
  assert.ok(first, 'a different-family crop should remain available after the supplied history');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('green-beans')!),
    'a future proposal copied to -12 shadowed the real prior green-bean course',
  );
});

test('a fictional previous-year cabbage copy cannot license peas after real green beans', () => {
  const beds: PlanBed[] = Array.from({ length: 3 }, (_, index) => ({
    id: `rotation-stress-${index + 1}`,
    label: `Rotation stress ${index + 1}`,
    areaM2: 4,
    minDimM: index === 0 ? 0.8 : index === 1 ? 1.2 : 3,
  }));
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    groups: [],
    cropKeys: undefined,
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'winter', beds, [{
    id: 'existing-green-beans',
    bedId: beds[0].id,
    cropKey: 'green-beans',
    sowMonth: 9,
    existing: true,
  }], 4);

  const first = result.plantings
    .filter((planting) => planting.bedId === beds[0].id)
    .sort((a, b) => ((a.sowMonth - 4 + 12) % 12) - ((b.sowMonth - 4 + 12) % 12))[0];
  assert.ok(first, 'the bed should take a legal different-family crop');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('green-beans')!),
    'peas repeated the supplied bean family after a synthetic cabbage copy hid the real predecessor',
  );
});

test('rotation follows the crop still holding the bed, not an older row with a nearer wrapped month number', () => {
  const bed = NINE_BEDS[0];
  const suppliedRows = [
    // Last year's cabbage is long finished. The March carrots still hold the
    // bed through July, and a July cabbage tray enters the bed in August.
    // Rotation must therefore follow the carrots, not let the older cabbage
    // row shadow the crop that is the candidate's chronological predecessor.
    { id: 'old-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 8, existing: true },
    { id: 'active-carrots', bedId: bed.id, cropKey: 'carrots', sowMonth: 3, existing: true },
  ];
  const result = autoSuggestPlan({
    ...FAMILY,
    cropKeys: ['cabbage', 'carrots'],
    rhythm: 'steady',
    allowVinesInBeds: true,
    rotateCrops: true,
  }, 'mild-frost', [bed], suppliedRows, 7);

  const first = result.plantings[0];
  assert.ok(first, 'the active carrots should leave a legal next crop slot');
  assert.equal(first.cropKey, 'cabbage');
  assert.notEqual(
    rotationFamilyOf(cropByKey(first.cropKey)!),
    rotationFamilyOf(cropByKey('carrots')!),
  );
});

test('rotation checks chronological neighbours even when planner passes generate months out of order', () => {
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'large',
    cropKeys: ['green-beans', 'beetroot', 'swiss-chard'],
    groups: [],
    rotateCrops: true,
  }, 'summer', NINE_BEDS, [], 11);

  const violations: string[] = [];
  for (const bed of NINE_BEDS) {
    const chronological = result.plantings
      .filter((planting) => planting.bedId === bed.id)
      .sort((a, b) => ((a.sowMonth - 11 + 12) % 12) - ((b.sowMonth - 11 + 12) % 12))
      .filter((planting, index, all) => index === 0 || planting.cropKey !== all[index - 1].cropKey);
    for (let index = 1; index < chronological.length; index++) {
      const previous = cropByKey(chronological[index - 1].cropKey)!;
      const current = cropByKey(chronological[index].cropKey)!;
      if (rotationFamilyOf(previous) === rotationFamilyOf(current)) {
        violations.push(`${bed.label}: ${previous.key} -> ${current.key}`);
      }
    }
  }

  assert.deepEqual(violations, [], `same-family chronological transitions: ${violations.join(', ')}`);
});

test('an exact one-family choice falls back truthfully instead of returning an unexplained empty plan', () => {
  const bed = NINE_BEDS[0];
  const prior = [{
    id: 'finished-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 1, existing: true,
  }];
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['broccoli'],
    groups: [],
    rotateCrops: true,
  }, 'mild-frost', [bed], prior, 8);

  assert.ok(result.plantings.length > 0, 'rotation silently vetoed the only exact crop choice');
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'broccoli'));
  assert.match(result.notes.join(' '), /every exact crop.*Cabbage family.*kept your chosen crop/i);
});

test('a completed crop followed next month is a new rotation course, not an overlapping cohort', () => {
  const bed = NINE_BEDS[0];
  const prior = [{
    // With the conservative 1-3 month nursery range and audited 125-day upper
    // field duration, a November cabbage tray reserves the bed through July.
    // August carrots therefore
    // begin in the immediately following month, not as an overlapping cohort.
    id: 'finished-cabbage', bedId: bed.id, cropKey: 'cabbage', sowMonth: 11, existing: true,
  }];
  const result = autoSuggestPlan({
    ...FAMILY,
    householdSize: 'small',
    cropKeys: ['cabbage', 'carrots'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: true,
  }, 'mild-frost', [bed], prior, 8);

  const planned = result.plantings.filter((planting) => !planting.existing);
  assert.ok(planned.length > 0, 'rotation discarded every legal different-family choice');
  assert.equal(
    planned[0].cropKey,
    'carrots',
    'the just-finished cabbage course was followed immediately by the same botanical family',
  );
});

test('commercial concentration does not invent a universal plants-across cutoff for a narrow hand bed', () => {
  const beds: PlanBed[] = [
    { id: 'narrow', label: 'Narrow bed', areaM2: 9, minDimM: 0.8 },
    { id: 'wide', label: 'Wide bed', areaM2: 9, minDimM: 3 },
  ];
  const result = autoSuggestPlan({
    goal: 'commercial',
    focusCropCount: 2,
    cropKeys: ['cabbage', 'carrots'],
    groups: [],
    rhythm: 'few-big',
    rotateCrops: false,
    allowVinesInBeds: false,
    reliableIrrigation: true,
    allowMixedCropsInBed: false,
  }, 'mild-frost', beds, [], 1);

  assert.ok(
    result.plantings.some((planting) => planting.bedId === 'narrow' && planting.cropKey === 'cabbage'),
    'a legitimate single-row cabbage bed was rejected by an invented two-plants-across rule',
  );
  assert.ok(result.plantings.some((planting) => planting.bedId === 'wide'));
  assert.doesNotMatch(result.notes.join(' '), /too narrow|measured width/i);
});
