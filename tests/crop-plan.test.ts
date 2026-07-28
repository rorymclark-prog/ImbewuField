import assert from 'node:assert/strict';
import test from 'node:test';

import { autoSuggestPlan, type AutoSuggestAnswers } from '@/lib/crop-autosuggest';
import { cropByKey, type RainPattern } from '@/lib/crop-catalog';
import { foodGroupOf } from '@/lib/crop-groups';
import type { PlanBed, Planting } from '@/lib/crop-plan';

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
