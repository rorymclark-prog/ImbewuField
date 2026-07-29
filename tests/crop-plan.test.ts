import assert from 'node:assert/strict';
import test from 'node:test';

import {
  autoSuggestPlan,
  clusterSowMonths,
  type AutoSuggestAnswers,
} from '@/lib/crop-autosuggest';
import { cropByKey, CROPS, type RainPattern } from '@/lib/crop-catalog';
import { foodGroupOf } from '@/lib/crop-groups';
import {
  bedOverlapFraction,
  buildFieldUtilizationByMonth,
  buildFoodAvailability,
  buildFoodValueByMonth,
  estimatedYieldKgAdjusted,
  harvestMonth,
  isGenuinelyIntercropped,
  nextValidSowMonth,
  seedBoqForPlan,
  tasksForPlan,
  yieldByCrop,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';

const BEDS: PlanBed[] = Array.from({ length: 4 }, (_, index) => ({
  id: `bed-${index + 1}`,
  label: `Bed ${index + 1}`,
  areaM2: 8,
  minDimM: 2,
}));

const ANSWERS: AutoSuggestAnswers = {
  goal: 'family',
  householdSize: 'medium',
  groups: [],
  rhythm: 'steady',
  rotateCrops: true,
  allowVinesInBeds: false,
};

function cropFor(planting: Planting) {
  const crop = cropByKey(planting.cropKey);
  assert.ok(crop, `planner suggested unknown catalog crop "${planting.cropKey}"`);
  return crop;
}

function occupiedMonths(planting: Planting): number[] {
  const crop = cropFor(planting);
  const span = Math.max(1, Math.round(crop.daysToHarvest / 30)) + 1;
  return Array.from({ length: span }, (_, offset) => ((planting.sowMonth + offset - 1) % 12) + 1);
}

function semanticPlan(plantings: Planting[]): string[] {
  return plantings
    .map((p) => `${p.bedId}:${p.cropKey}:${p.sowMonth}:${p.areaFraction ?? 1}`)
    .sort();
}

test('rotation starts each bed with a different crop group from its previous season', () => {
  // Dry beans sown in November finish in March. April is therefore a clean
  // next-season boundary, and the full catalog gives the engine ample
  // non-legume alternatives: repeating legumes here is never necessary.
  const existing: Planting[] = BEDS.map((bed, index) => ({
    id: `previous-${index + 1}`,
    bedId: bed.id,
    cropKey: 'dry-beans',
    sowMonth: 11,
  }));
  const result = autoSuggestPlan(
    { ...ANSWERS, householdSize: 'small', rhythm: 'few-big' },
    'mild-frost',
    BEDS,
    existing,
    4,
  );
  const previousGroup = foodGroupOf(cropFor(existing[0]));

  for (const bed of BEDS) {
    const first = result.plantings.find((planting) => planting.bedId === bed.id);
    assert.ok(first, `${bed.label} received no next-season plan`);
    assert.notEqual(
      foodGroupOf(cropFor(first)),
      previousGroup,
      `${bed.label} repeats ${previousGroup} in consecutive seasons`,
    );
  }
});

test('every design bed receives at least one planting', () => {
  const result = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], 7);
  const plannedBeds = new Set(result.plantings.map((planting) => planting.bedId));

  for (const bed of BEDS) {
    assert.ok(plannedBeds.has(bed.id), `${bed.label} was silently skipped`);
  }
});

test('the year-round plan keeps every bed covered throughout the winter window', () => {
  const result = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], 7);
  const winterMonths = [5, 6, 7, 8];

  for (const bed of BEDS) {
    for (const month of winterMonths) {
      const covered = result.plantings.some(
        (planting) => planting.bedId === bed.id && occupiedMonths(planting).includes(month),
      );
      assert.ok(covered, `${bed.label} is bare in winter month ${month}`);
    }
  }
});

test('every suggestion stays inside that crop’s sowing window for the site pattern', () => {
  const patterns: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];

  for (const pattern of patterns) {
    const result = autoSuggestPlan(ANSWERS, pattern, BEDS, [], 7);
    for (const planting of result.plantings) {
      assert.ok(
        cropFor(planting).sowMonths[pattern].includes(planting.sowMonth),
        `${planting.cropKey} was suggested in month ${planting.sowMonth} for ${pattern}`,
      );
    }
  }
});

test('the rotation toggle changes the plan, and turning it back on restores it', () => {
  const existing: Planting[] = BEDS.map((bed, index) => ({
    id: `previous-${index + 1}`,
    bedId: bed.id,
    cropKey: 'dry-beans',
    sowMonth: 11,
  }));
  const inputs = ['mild-frost', BEDS, existing, 4] as const;

  const rotationOn = semanticPlan(autoSuggestPlan({ ...ANSWERS, rotateCrops: true }, ...inputs).plantings);
  const rotationOff = semanticPlan(autoSuggestPlan({ ...ANSWERS, rotateCrops: false }, ...inputs).plantings);
  const rotationRestored = semanticPlan(autoSuggestPlan({ ...ANSWERS, rotateCrops: true }, ...inputs).plantings);

  assert.notDeepEqual(rotationOff, rotationOn, 'rotation toggle had no effect on the proposed plan');
  assert.deepEqual(rotationRestored, rotationOn, 'turning rotation back on did not restore the rotation-aware plan');
});

test('auto-suggest is fully deterministic, including stable semantic planting ids', () => {
  const first = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], 7);
  const second = autoSuggestPlan(
    structuredClone(ANSWERS),
    'mild-frost',
    structuredClone(BEDS),
    [],
    7,
  );

  assert.deepEqual(second, first);
  assert.equal(new Set(first.plantings.map((planting) => planting.id)).size, first.plantings.length);
  for (const planting of first.plantings) {
    assert.equal(
      planting.id,
      `auto:${encodeURIComponent(planting.bedId)}:${encodeURIComponent(planting.cropKey)}:${planting.sowMonth}:${planting.areaFraction ?? 1}`,
    );
  }
});

test('sowing-window clustering ignores corrupt months, deduplicates, wraps, and never mutates input', () => {
  const input = [12, 2, 1, 11, 2, 0, 13, Number.NaN, Number.POSITIVE_INFINITY, 3.5];
  const before = [...input];
  const clusters = clusterSowMonths(input);

  assert.deepEqual(input, before);
  assert.deepEqual(clusters, [{ start: 11, end: 2, months: [11, 12, 1, 2] }]);
  assert.ok(clusters.flatMap((cluster) => cluster.months).every(
    (month) => Number.isInteger(month) && month >= 1 && month <= 12,
  ));
});

test('unusable and duplicate beds never receive crop recommendations', () => {
  const beds: PlanBed[] = [
    BEDS[0],
    { ...BEDS[0], label: 'Duplicate id' },
    { id: 'zero', label: 'Zero area', areaM2: 0 },
    { id: 'negative', label: 'Negative area', areaM2: -1 },
    { id: 'nan', label: 'Bad area', areaM2: Number.NaN },
    { id: 'infinite', label: 'Infinite area', areaM2: Number.POSITIVE_INFINITY },
    { id: 'bad-width', label: 'Bad width', areaM2: 8, minDimM: Number.NaN },
  ];
  const before = structuredClone(beds);
  const result = autoSuggestPlan(ANSWERS, 'mild-frost', beds, [], 7);

  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => planting.bedId === BEDS[0].id));
  assert.match(result.notes.join(' '), /unusable|duplicate/i);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  assert.deepEqual(beds, before);
});

test('invalid calendar input falls back explicitly without changing January’s plan', () => {
  const january = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], 1);

  for (const invalidMonth of [0, 13, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], invalidMonth);
    assert.deepEqual(result.plantings, january.plantings);
    assert.deepEqual(result.laterThisYear, january.laterThisYear);
    assert.match(result.notes.join(' '), /current month.*January/i);
  }
});

test('damaged existing rows are accounted for conservatively and inputs are never mutated', () => {
  const existing: Planting[] = [
    { id: 'bad-fraction', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 7, areaFraction: Number.NaN },
    { id: 'bad-month', bedId: BEDS[1].id, cropKey: 'cabbage', sowMonth: 99 },
    { id: 'missing-bed', bedId: 'retired-bed', cropKey: 'cabbage', sowMonth: 7 },
  ];
  const answers = structuredClone(ANSWERS);
  const beds = structuredClone(BEDS);
  const before = {
    answers: structuredClone(answers),
    beds: structuredClone(beds),
    existing: structuredClone(existing),
  };
  const result = autoSuggestPlan(answers, 'mild-frost', beds, existing, 7);

  assert.match(result.notes.join(' '), /existing planting record/i);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  assert.deepEqual({ answers, beds, existing }, before);
  const cabbage = cropByKey('cabbage');
  assert.ok(cabbage);
  const blockedMonths = occupiedMonths({ ...existing[0], areaFraction: 1 });
  assert.ok(result.plantings
    .filter((planting) => planting.bedId === BEDS[0].id)
    .every((planting) => !occupiedMonths(planting).some((month) => blockedMonths.includes(month))));
});

test('every suggestion has a real bed, catalog crop, valid month, bounded fraction and sowing window', () => {
  const patterns: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
  const goals: AutoSuggestAnswers['goal'][] = ['family', 'commercial', 'hybrid'];

  for (const pattern of patterns) {
    for (const goal of goals) {
      const result = autoSuggestPlan({
        ...ANSWERS,
        goal,
        focusCropCount: goal === 'family' ? undefined : 2,
      }, pattern, BEDS, [], 7);
      const bedIds = new Set(BEDS.map((bed) => bed.id));

      for (const planting of result.plantings) {
        assert.ok(bedIds.has(planting.bedId));
        const crop = cropFor(planting);
        assert.ok(crop.sowMonths[pattern].includes(planting.sowMonth));
        assert.ok(Number.isInteger(planting.sowMonth) && planting.sowMonth >= 1 && planting.sowMonth <= 12);
        assert.ok((planting.areaFraction ?? 1) > 0 && (planting.areaFraction ?? 1) <= 1);
      }
      assert.equal(new Set(result.plantings.map((planting) => planting.id)).size, result.plantings.length);
      assert.equal(new Set(result.laterThisYear.map((entry) => entry.cropKey)).size, result.laterThisYear.length);
      assert.ok(result.laterThisYear.every(
        (entry) => cropByKey(entry.cropKey) && entry.nextWindowMonth >= 1 && entry.nextWindowMonth <= 12,
      ));
    }
  }
});

test('harvest and next-sowing month arithmetic stays inside the calendar and wraps across year end', () => {
  for (let sowMonth = 1; sowMonth <= 12; sowMonth++) {
    for (const days of [1, 30, 90, 365]) {
      const month = harvestMonth(sowMonth, days);
      assert.ok(month >= 1 && month <= 12);
    }
  }

  for (const crop of CROPS) {
    for (const pattern of ['summer', 'winter', 'all-year', 'mild-frost'] as RainPattern[]) {
      for (let fromMonth = 1; fromMonth <= 12; fromMonth++) {
        const month = nextValidSowMonth(crop, pattern, fromMonth);
        assert.ok(crop.sowMonths[pattern].includes(month));
        const sameYear = crop.sowMonths[pattern].filter((candidate) => candidate >= fromMonth);
        assert.equal(month, sameYear.length ? Math.min(...sameYear) : Math.min(...crop.sowMonths[pattern]));
      }
    }
  }
});

test('already-growing crops produce only future harvest work and task ids remain stable', () => {
  const existing: Planting = {
    id: 'already-there',
    bedId: BEDS[0].id,
    cropKey: 'cabbage',
    sowMonth: 11,
    existing: true,
  };
  const first = tasksForPlan([existing], BEDS);
  const second = tasksForPlan([structuredClone(existing)], structuredClone(BEDS));

  assert.deepEqual(second, first);
  assert.deepEqual(first.map((task) => task.action), ['harvest']);
  assert.deepEqual(first.map((task) => task.id), ['already-there:harvest']);
});

test('task generation skips unknown crops, names an absent bed honestly, and stays calendar-sorted', () => {
  const plantings: Planting[] = [
    { id: 'unknown-crop', bedId: 'missing', cropKey: 'not-in-catalogue', sowMonth: 5 },
    { id: 'known-crop', bedId: 'missing', cropKey: 'dry-beans', sowMonth: 1 },
  ];
  const tasks = tasksForPlan(plantings, []);

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.cropKey === 'dry-beans'));
  assert.ok(tasks.every((task) => task.bedLabel === 'Unknown bed'));
  assert.deepEqual(tasks.map((task) => task.month), [...tasks.map((task) => task.month)].sort((a, b) => a - b));
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
});

test('genuine intercropping requires a fractional, different crop sharing one bed at the same time', () => {
  const subject: Planting = {
    id: 'beans',
    bedId: 'bed-1',
    cropKey: 'dry-beans',
    sowMonth: 11,
    areaFraction: 0.5,
  };
  const overlappingOther: Planting = {
    id: 'cabbage',
    bedId: 'bed-1',
    cropKey: 'cabbage',
    sowMonth: 12,
    areaFraction: 0.5,
  };

  assert.equal(isGenuinelyIntercropped(subject, [subject, overlappingOther]), true);
  assert.equal(
    isGenuinelyIntercropped({ ...subject, areaFraction: 1 }, [subject, overlappingOther]),
    false,
  );
  assert.equal(
    isGenuinelyIntercropped(subject, [subject, { ...overlappingOther, bedId: 'bed-2' }]),
    false,
  );
  assert.equal(
    isGenuinelyIntercropped(subject, [subject, { ...overlappingOther, cropKey: subject.cropKey }]),
    false,
  );
});

test('bed overlap is wrap-safe, additive by occupied fraction, and excludes the edited planting', () => {
  const plantings: Planting[] = [
    { id: 'first', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
    { id: 'second', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 12, areaFraction: 0.25 },
    { id: 'other-bed', bedId: 'bed-2', cropKey: 'cabbage', sowMonth: 12, areaFraction: 1 },
  ];

  assert.equal(bedOverlapFraction('bed-1', 12, 2, plantings), 0.75);
  assert.equal(bedOverlapFraction('bed-1', 12, 2, plantings, 'first'), 0.25);
  assert.equal(bedOverlapFraction('bed-1', 6, 7, plantings), 0);
});

test('crop totals reconcile exactly with adjusted per-planting yields, including existing crops', () => {
  const plantings: Planting[] = [
    { id: 'beans-a', bedId: 'bed-1', cropKey: 'dry-beans', sowMonth: 11, areaFraction: 0.5 },
    { id: 'beans-b', bedId: 'bed-2', cropKey: 'dry-beans', sowMonth: 4, existing: true },
    { id: 'cabbage', bedId: 'bed-1', cropKey: 'cabbage', sowMonth: 12, areaFraction: 0.5 },
    { id: 'orphan', bedId: 'missing', cropKey: 'cabbage', sowMonth: 5 },
  ];
  const rows = yieldByCrop(plantings, BEDS);
  const expected = plantings
    .filter((planting) => BEDS.some((bed) => bed.id === planting.bedId))
    .reduce((sum, planting) => {
      const bed = BEDS.find((candidate) => candidate.id === planting.bedId)!;
      return sum + estimatedYieldKgAdjusted(planting, bed.areaM2, plantings);
    }, 0);

  assert.ok(rows.length > 0);
  assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.kg, 0) - expected) < 1e-9);
  assert.ok(rows.every((row, index) => index === 0 || rows[index - 1].kg >= row.kg));
});

test('monthly food value counts each harvest kilogram exactly once and reconciles crop breakdowns', () => {
  const crop = CROPS.find((candidate) => (candidate.harvestWindowMonths ?? 0) > 0);
  assert.ok(crop, 'catalogue must contain a repeat-harvest crop');
  const planting: Planting = {
    id: 'repeat-harvest',
    bedId: BEDS[0].id,
    cropKey: crop.key,
    sowMonth: 11,
  };
  const price = { retailPerKg: 10, wholesalePerKg: 4, confidence: 'sourced' as const };
  const values = buildFoodValueByMonth([planting], BEDS, { [crop.key]: price });
  const expectedKg = estimatedYieldKgAdjusted(planting, BEDS[0].areaM2, [planting]);
  const total = values.reduce(
    (sum, month) => ({
      kg: sum.kg + month.kg,
      retail: sum.retail + month.retailValue,
      wholesale: sum.wholesale + month.wholesaleValue,
    }),
    { kg: 0, retail: 0, wholesale: 0 },
  );

  assert.ok(Math.abs(total.kg - expectedKg) < 1e-9);
  assert.ok(Math.abs(total.retail - expectedKg * price.retailPerKg) < 1e-9);
  assert.ok(Math.abs(total.wholesale - expectedKg * price.wholesalePerKg) < 1e-9);
  assert.ok(values.every((month) =>
    Math.abs(Object.values(month.byCrop).reduce((sum, kg) => sum + kg, 0) - month.kg) < 1e-9));
});

test('availability distinguishes fresh food from stored food without double-labelling a crop', () => {
  const freshCrop = CROPS.find((candidate) => (candidate.harvestWindowMonths ?? 0) > 0);
  const storedCrop = CROPS.find((candidate) => (candidate.storageMonths ?? 0) > 0);
  assert.ok(freshCrop && storedCrop);
  const plantings: Planting[] = [
    { id: 'fresh', bedId: BEDS[0].id, cropKey: freshCrop.key, sowMonth: 11 },
    { id: 'stored', bedId: BEDS[1].id, cropKey: storedCrop.key, sowMonth: 11, existing: true },
  ];
  const availability = buildFoodAvailability(plantings, BEDS);

  assert.equal(availability.length, 13);
  assert.ok(availability.flat().some((item) => item.cropKey === freshCrop.key && item.status === 'fresh'));
  assert.ok(availability.flat().some((item) => item.cropKey === storedCrop.key && item.status === 'stored'));
  for (const month of availability) {
    assert.equal(new Set(month.map((item) => item.cropKey)).size, month.length);
  }
});

test('field utilisation is physically bounded per bed even when saved plantings over-commit it', () => {
  const plantings: Planting[] = [
    { id: 'whole-a', bedId: BEDS[0].id, cropKey: 'dry-beans', sowMonth: 11 },
    { id: 'whole-b', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 11 },
  ];
  const utilisation = buildFieldUtilizationByMonth(plantings, [BEDS[0]]);

  assert.equal(utilisation.length, 13);
  assert.equal(utilisation[0], 0);
  assert.ok(utilisation.slice(1).every((fraction) => fraction >= 0 && fraction <= 1));
  assert.ok(utilisation.slice(1).some((fraction) => fraction === 1));
  assert.deepEqual(buildFieldUtilizationByMonth(plantings, []), Array<number>(13).fill(0));
});

test('seed quantities aggregate successions, exclude existing crops, and use positive material units', () => {
  const plantings: Planting[] = [
    { id: 'new-a', bedId: BEDS[0].id, cropKey: 'dry-beans', sowMonth: 4, areaFraction: 0.5 },
    { id: 'new-b', bedId: BEDS[1].id, cropKey: 'dry-beans', sowMonth: 8, areaFraction: 0.5 },
    { id: 'existing', bedId: BEDS[2].id, cropKey: 'cabbage', sowMonth: 5, existing: true },
  ];
  const together = seedBoqForPlan(plantings, BEDS);
  const separately = [
    ...seedBoqForPlan([plantings[0]], BEDS),
    ...seedBoqForPlan([plantings[1]], BEDS),
  ];
  const beans = together.find((row) => row.cropKey === 'dry-beans');

  assert.ok(beans);
  assert.equal(beans.count, separately.reduce((sum, row) => sum + row.count, 0));
  assert.equal(together.some((row) => row.cropKey === 'cabbage'), false);
  assert.ok(together.every((row) => row.count > 0 && row.unit.trim().length > 0));
});
