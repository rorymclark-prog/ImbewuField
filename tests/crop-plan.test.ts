import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  autoSuggestPlan,
  clusterSowMonths,
  type AutoSuggestAnswers,
} from '@/lib/crop-autosuggest';
import {
  cropByKey,
  CROPS,
  hasAutomaticPlanningBasis,
  hasVerifiedFieldPlan,
  MONTHS_SHORT,
  plantsPerM2,
  type RainPattern,
} from '@/lib/crop-catalog';
import { FOOD_GROUP, GROUP_PRIORITY, foodGroupOf, rotationFamilyOf } from '@/lib/crop-groups';
import { isPlotWinterCover } from '@/lib/staple-crops';
import {
  bedEntryMonth,
  bedOverlapFraction,
  bedHasUnverifiedTiming,
  buildFieldUtilizationByMonth,
  buildFoodAvailability,
  buildPlanYieldBenchmark,
  buildYearReport,
  estimatedYieldKgAdjusted,
  harvestMonth,
  harvestMonthForCrop,
  isGenuinelyIntercropped,
  latestBedEntryMonth,
  plannedBedEntryMonth,
  nextValidSowMonth,
  occupiedMonthsForPlanting,
  plantingBedEntryOffsets,
  plantingIsActiveOrPlanned,
  planningMaturityMonths,
  recurringPlanPlantings,
  restampEditedOnce,
  seedBoqBatchesForPlan,
  seedBoqForPlan,
  settleOnceRows,
  taskMonthsFromNow,
  tasksForPlan,
  totalGrowingAreaM2,
  yieldByCrop,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';

/** `AutoSuggestResult.notes` became `{ kind, bedIds?, text }[]` in the Notes
 * Engine v2 change. These assertions are about the farmer-visible sentence, so
 * they read `.text` and are otherwise unchanged. */
const noteText = (r: { notes: readonly { text: string }[] }): string[] => r.notes.map((note) => note.text);


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
  reliableIrrigation: true,
};

function cropFor(planting: Planting) {
  const crop = cropByKey(planting.cropKey);
  assert.ok(crop, `planner suggested unknown catalog crop "${planting.cropKey}"`);
  return crop;
}

function occupiedMonths(planting: Planting): number[] {
  cropFor(planting); // keep the assertion that the fixture names a real crop
  return occupiedMonthsForPlanting(planting);
}

function semanticPlan(plantings: Planting[]): string[] {
  return plantings
    .map((p) => `${p.bedId}:${p.cropKey}:${p.sowMonth}:${p.areaFraction ?? 1}`)
    .sort();
}

test('rotation starts each bed with a different botanical family from its previous season', () => {
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
  const previousFamily = rotationFamilyOf(cropFor(existing[0]));

  for (const bed of BEDS) {
    const first = result.plantings.find((planting) => planting.bedId === bed.id);
    assert.ok(first, `${bed.label} received no next-season plan`);
    assert.notEqual(
      rotationFamilyOf(cropFor(first)),
      previousFamily,
      `${bed.label} repeats ${previousFamily} in consecutive seasons`,
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

test('a no-mixing plan discloses every winter rest instead of painting the chart full', () => {
  // Confirmed water permits succession; it does not prove that every sourced
  // crop duration can tile every whole bed without a gap. With mixed-crop
  // geometry deliberately disabled, the honest result may include rest. The
  // farmer must be shown each resting bed rather than given a cosmetic fill.
  const result = autoSuggestPlan({ ...ANSWERS, reliableIrrigation: true }, 'mild-frost', BEDS, [], 7);
  const winterMonths = [5, 6, 7, 8];
  let coveredBedMonths = 0;

  for (const bed of BEDS) {
    for (const month of winterMonths) {
      const covered = result.plantings.some(
        (planting) => planting.bedId === bed.id && occupiedMonths(planting).includes(month),
      );
      if (covered) {
        coveredBedMonths++;
      } else {
        assert.ok(
          // Per-bed rest notes were collapsed into one grouped gap note per
          // cause ("3 growing areas have a stretch with no new sowing: Bed 1
          // (Aug), ..."), so the bed is now named inside that list.
          noteText(result).some((note) => note.includes('no new sowing') && note.includes(`${bed.label} (`)),
          `${bed.label}'s winter month ${month} rest is hidden`,
        );
      }
    }
  }
  assert.ok(coveredBedMonths > 0, 'the irrigated plan abandoned every bed for the whole winter');
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
  assert.match(noteText(result).join(' '), /unusable|duplicate/i);
  assert.doesNotMatch(JSON.stringify(result), /NaN|Infinity/);
  assert.deepEqual(beds, before);
});

test('invalid calendar input falls back explicitly without changing January’s plan', () => {
  const january = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], 1);

  for (const invalidMonth of [0, 13, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = autoSuggestPlan(ANSWERS, 'mild-frost', BEDS, [], invalidMonth);
    assert.deepEqual(result.plantings, january.plantings);
    assert.deepEqual(result.laterThisYear, january.laterThisYear);
    assert.match(noteText(result).join(' '), /current month.*January/i);
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

  assert.match(noteText(result).join(' '), /existing planting record/i);
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

test('the crop catalogue has stable unique identities and a complete lookup', () => {
  const keys = CROPS.map((crop) => crop.key);

  assert.ok(keys.length > 0);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(keys.every((key) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(key)), 'a crop key is unsafe for saved plans');
  for (const crop of CROPS) {
    assert.equal(cropByKey(crop.key), crop);
  }
  for (const unknown of ['', 'unknown-crop', ' CABBAGE ']) {
    assert.equal(cropByKey(unknown), undefined);
  }
});

test('audited duration ranges reserve beds through their conservative upper endpoint', () => {
  // These are published crop/cultivar ranges, not generic constants. Planning
  // uses the upper supported endpoint so slow-but-still-normal crops do not get
  // a successor placed on top of them.
  const auditedRanges = {
    cabbage: [65, 125],
    lettuce: [45, 80],
    garlic: [180, 210],
    groundnuts: [150, 160],
  } as const;

  for (const [key, expectedRange] of Object.entries(auditedRanges)) {
    const crop = cropByKey(key);
    assert.ok(crop);
    assert.deepEqual(crop.daysToHarvestRange, expectedRange, `${key} lost its audited duration range`);
    assert.equal(crop.daysToHarvest, expectedRange[1], `${key} no longer plans to the conservative endpoint`);
  }
});

test('legacy crop records remain named while unresolved timing or spacing blocks auto-scheduling', () => {
  for (const key of ['kale']) {
    const crop = cropByKey(key);
    assert.ok(crop, `${key} can no longer be read from a saved record`);
    assert.ok(crop.name.trim() && crop.icon.trim() && crop.note.trim());
    assert.equal(hasVerifiedFieldPlan(crop), false, `${key} unexpectedly has a verified timed field plan`);
    assert.equal(hasAutomaticPlanningBasis(crop), false, `${key} can still enter automatic planning`);
  }
});

test('every crop has complete physical data and an honest yield state without pinning agronomic values', () => {
  const requiredPositive = ['daysToHarvest', 'spacingCm'] as const;
  const optionalPositive = [
    'rowSpacingCm',
    'inRowSpacingCm',
    'sowDepthCm',
    'harvestWindowMonths',
    'storageMonths',
  ] as const;

  for (const crop of CROPS) {
    assert.ok(crop.name.trim(), `${crop.key} has no farmer-facing name`);
    assert.ok(crop.icon.trim(), `${crop.key} has no icon`);
    assert.ok(crop.note.trim(), `${crop.key} has no planting guidance`);
    assert.doesNotMatch(`${crop.name} ${crop.note}`, /NaN|Infinity/);
    for (const field of requiredPositive) {
      assert.ok(Number.isFinite(crop[field]) && crop[field] > 0, `${crop.key}.${field} is unusable`);
    }
    // Yield has three intentionally different states: positive sourced
    // planning figure; zero for a non-food cover; null when no defensible
    // number was found. A zero-yield legacy cover may stay in the catalog so
    // saved records retain their identity, but without verified timing it must
    // be excluded from the automatic cover list.
    if (crop.yieldKgPerM2 === 0) {
      assert.ok(isPlotWinterCover(crop) || crop.timingVerified === false, `${crop.key} is zero-yield without being a declared or legacy cover`);
      if (crop.timingVerified === false) assert.equal(isPlotWinterCover(crop), false, `${crop.key} has unverified timing but can still be auto-planned`);
    } else if (crop.yieldKgPerM2 !== null) {
      assert.ok(Number.isFinite(crop.yieldKgPerM2) && crop.yieldKgPerM2 > 0, `${crop.key}.yieldKgPerM2 is unusable`);
    }
    if (crop.yieldRangeKgPerM2 !== undefined) {
      const [low, high] = crop.yieldRangeKgPerM2;
      assert.ok(Number.isFinite(low) && Number.isFinite(high) && low > 0 && high >= low, `${crop.key} has an invalid published yield range`);
      assert.ok(
        crop.yieldKgPerM2 !== null && crop.yieldKgPerM2 >= low && crop.yieldKgPerM2 <= high,
        `${crop.key}'s planning point falls outside its published range`,
      );
    }
    for (const field of optionalPositive) {
      const value = crop[field];
      if (value !== undefined) {
        assert.ok(Number.isFinite(value) && value > 0, `${crop.key}.${field} is unusable`);
      }
    }
    if (crop.harvestWindowMonths !== undefined) {
      assert.ok(Number.isInteger(crop.harvestWindowMonths), `${crop.key} has a fractional harvest window`);
    }
    if (crop.storageMonths !== undefined) {
      assert.ok(Number.isInteger(crop.storageMonths), `${crop.key} has a fractional storage life`);
      assert.ok(crop.storageSourceUrl?.startsWith('https://'), `${crop.key} has a storage duration without a source`);
      assert.ok(crop.storageConditions?.trim(), `${crop.key} has a storage duration without named conditions`);
    }
  }
});

test('seed BOQ reports final field positions without inventing a botanical-seed buy count', () => {
  const rectangular = seedBoqForPlan([
    { id: 'green-beans', bedId: BEDS[0].id, cropKey: 'green-beans', sowMonth: 10 },
  ], BEDS).find((row) => row.cropKey === 'green-beans');
  const seedlings = seedBoqForPlan([
    { id: 'cabbage', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 4 },
  ], BEDS).find((row) => row.cropKey === 'cabbage');

  assert.ok(rectangular);
  assert.equal(rectangular.count, null, 'mature field spacing is not an exact direct-seed buying rate');
  assert.equal(
    rectangular.finalPlantPositions,
    Math.round(BEDS[0].areaM2 * plantsPerM2(cropByKey('green-beans')!)),
  );
  assert.ok(seedlings);
  assert.equal(seedlings.count, null, 'a published spacing range must not collapse into one exact seedling order');
  assert.deepEqual(seedlings.countRange, seedlings.finalPlantPositionsRange);
  assert.equal(seedlings.quantityStatus, 'counted-piece-range');
  assert.ok(seedlings.countRange![0] <= seedlings.finalPlantPositions);
  assert.ok(seedlings.countRange![1] >= seedlings.finalPlantPositions);
});

test('no page carries its own rival yield table — the sourced catalog is the only answer', () => {
  // /plan used to hold hardcoded kgPerBed figures that over-promised against the cited catalog on
  // EVERY crop: maize 8.3x, pumpkin 3.3x, green beans 2.8x. A farmer plans food security on that
  // screen. Two rival answers to "how much will I get" is a correctness problem, not tidiness.
  for (const page of ['../app/plan/page.tsx', '../app/calendar/page.tsx']) {
    const source = readFileSync(new URL(page, import.meta.url), 'utf8');
    // The defect is a per-crop RECORD of literal yields, not any mention of the field — a single
    // derived value and an honest zero fallback are fine, and the point is that no page keeps its
    // own table to drift from the catalog.
    assert.doesNotMatch(
      source,
      /Record<string,\s*\{[^}]*kgPerBed/,
      `${page} must derive yield from lib/crop-catalog.ts, not a literal per-crop yield table`,
    );
    const literalYields = [...source.matchAll(/kgPerBed:\s*[1-9]/g)].length;
    assert.equal(literalYields, 0, `${page} still has ${literalYields} hardcoded kgPerBed figures`);
  }

  // `/plan` used to be a second calculator with a guessed bed size and season
  // table. The stronger rule is one planning authority, not a better-maintained
  // duplicate: the legacy route must delegate to the mapped bed-by-bed plan.
  const planSource = readFileSync(new URL('../app/plan/page.tsx', import.meta.url), 'utf8');
  assert.match(planSource, /redirect\(['"]\/facilitator\/crops['"]\)/);
  assert.doesNotMatch(planSource, /BED_AREA_M2|CROP_SEASONS|kgPerBed|plantsPerBed/);
});

test('calendar sowing marks come from the catalog window, not a rival month table', () => {
  const calendarSource = readFileSync(new URL('../app/calendar/page.tsx', import.meta.url), 'utf8');
  assert.match(calendarSource, /sowMarksForPattern/);
  assert.match(calendarSource, /CALENDAR_RAIN_PATTERN\s*=\s*['"]summer['"]/);
  assert.doesNotMatch(
    calendarSource,
    /marks:\s*\[['"]/,
    'calendar must not carry a literal sow-month mark array',
  );
});

test('every sourced row/in-row spacing pair keeps in-row spacing no wider than row spacing', () => {
  for (const crop of CROPS) {
    if (crop.rowSpacingCm === undefined || crop.inRowSpacingCm === undefined) continue;
    assert.ok(
      crop.inRowSpacingCm <= crop.rowSpacingCm,
      `${crop.key}: in-row spacing ${crop.inRowSpacingCm}cm exceeds row spacing ${crop.rowSpacingCm}cm`,
    );
  }
});

test('every recorded rain-pattern window is a unique calendar subset that clusters losslessly', () => {
  const patterns: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];

  for (const crop of CROPS) {
    for (const pattern of patterns) {
      const months = crop.sowMonths[pattern];
      // Empty is an honest state: a nationally known crop can lack a verified
      // automatic window for one rainfall pattern. Guessing a month to satisfy
      // this structural test would turn missing evidence into farm advice.
      assert.equal(new Set(months).size, months.length, `${crop.key} repeats a ${pattern} month`);
      assert.ok(months.every((month) =>
        Number.isInteger(month) && month >= 1 && month <= MONTHS_SHORT.length));

      const clustered = clusterSowMonths(months).flatMap((cluster) => cluster.months);
      assert.deepEqual(
        [...clustered].sort((a, b) => a - b),
        [...months].sort((a, b) => a - b),
        `${crop.key} ${pattern} window changed during clustering`,
      );
    }
  }
});

test('every catalog crop belongs explicitly to one advertised food group', () => {
  const advertisedGroups = new Set(GROUP_PRIORITY);

  assert.equal(advertisedGroups.size, GROUP_PRIORITY.length, 'food-group priority repeats a group');
  for (const crop of CROPS) {
    assert.ok(Object.hasOwn(FOOD_GROUP, crop.key), `${crop.key} fell through to a guessed food group`);
    assert.ok(advertisedGroups.has(foodGroupOf(crop)), `${crop.key} belongs to a group the planner never offers`);
  }
  for (const group of GROUP_PRIORITY) {
    assert.ok(CROPS.some((crop) => foodGroupOf(crop) === group), `${group} has no selectable crops`);
  }
});

test('variety advice is unique and complete wherever the catalogue offers it', () => {
  for (const crop of CROPS) {
    if (!crop.varieties) continue;
    assert.ok(crop.varieties.length > 0, `${crop.key} exposes an empty variety list`);
    assert.equal(
      new Set(crop.varieties.map((variety) => variety.name.trim().toLowerCase())).size,
      crop.varieties.length,
      `${crop.key} repeats a variety`,
    );
    for (const variety of crop.varieties) {
      assert.ok(variety.name.trim(), `${crop.key} has an unnamed variety`);
      assert.ok(variety.bestFor.trim(), `${crop.key}/${variety.name} does not say when it suits`);
      assert.ok(variety.note.trim(), `${crop.key}/${variety.name} has no explanation`);
    }
  }
});

test('month labels are a complete, unique calendar in display order', () => {
  assert.equal(MONTHS_SHORT.length, 12);
  assert.equal(new Set(MONTHS_SHORT).size, MONTHS_SHORT.length);
  assert.ok(MONTHS_SHORT.every((label) => label.trim().length > 0));
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
        if (crop.sowMonths[pattern].length === 0) {
          assert.equal(month, fromMonth, 'an unknown regional window should not invent a different month');
          continue;
        }
        assert.ok(crop.sowMonths[pattern].includes(month));
        const sameYear = crop.sowMonths[pattern].filter((candidate) => candidate >= fromMonth);
        assert.equal(month, sameYear.length ? Math.min(...sameYear) : Math.min(...crop.sowMonths[pattern]));
      }
    }
  }
});

test('coarse maturity planning rounds supported day counts up instead of freeing a bed early', () => {
  assert.equal(planningMaturityMonths(30), 1);
  assert.equal(planningMaturityMonths(31), 2);
  assert.equal(planningMaturityMonths(70), 3);
});

test('a tray crop keeps its readiness window separate from actual bed occupancy', () => {
  // KZN DARD gives a 4–6 week warm-condition nursery period that may double
  // in cold conditions. The month plan may start checking at one month, and
  // 2026-08-19 (see TRANSPLANT_BED_RESERVED_FROM_MONTHS): the bed is RESERVED
  // from that earliest check month, because that is the month the farmer-
  // facing surfaces (transplant task, buying schedule, occupancy bar) tell
  // the farmer to be ready to plant — a bed the farmer may plant into cannot
  // be offered to another crop. Harvest timing stays anchored to the planned
  // (conservative, later) transplant month.
  const lettuce = cropByKey('lettuce');
  assert.ok(lettuce?.transplant);
  const planting: Planting = {
    id: 'nursery-window',
    bedId: BEDS[0].id,
    cropKey: lettuce.key,
    sowMonth: 8,
  };

  assert.equal(bedEntryMonth(planting.sowMonth, lettuce), 9);
  assert.equal(plannedBedEntryMonth(planting.sowMonth, lettuce), 10);
  assert.equal(latestBedEntryMonth(planting.sowMonth, lettuce), 11);
  assert.equal(harvestMonthForCrop(planting.sowMonth, lettuce), 1);
  // Occupancy runs from the earliest transplant month (9), not the planned
  // one (10) — the same month the 'transplant' task below dates. Before the
  // 2026-08-19 fix this was [10, 11, 12, 1] while the farmer was told to
  // plant in month 9: the stress harness measured 2,003 double-bookings
  // across 891 farms from exactly this one-month mismatch.
  assert.deepEqual(occupiedMonthsForPlanting(planting), [9, 10, 11, 12, 1]);
  assert.equal(
    tasksForPlan([planting], BEDS).find((task) => task.action === 'transplant')?.month,
    9,
    'the dated marker and the start of reserved bed time now agree',
  );
});

test('already-growing crops keep current and future harvests but never resurrect a finished one next year', () => {
  const existing: Planting[] = [
    // The audited 125-day field endpoint plus the conservative nursery window
    // puts these three tray sowings at July / August / September respectively.
    { id: 'finished', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 12, existing: true },
    { id: 'due-now', bedId: BEDS[1].id, cropKey: 'cabbage', sowMonth: 1, existing: true },
    { id: 'still-ahead', bedId: BEDS[2].id, cropKey: 'cabbage', sowMonth: 2, existing: true },
  ];
  const first = tasksForPlan(existing, BEDS, 8);
  const second = tasksForPlan(structuredClone(existing), structuredClone(BEDS), 8);

  assert.deepEqual(second, first);
  assert.deepEqual(first.map((task) => task.id), ['due-now:harvest', 'still-ahead:harvest']);
  assert.deepEqual(first.map((task) => task.plantingId), ['due-now', 'still-ahead']);
  assert.ok(first.every((task) => task.action === 'harvest'));
});

test('an existing picking window keeps this month but drops its already-eaten first month', () => {
  // KZN DARD supports a tomato picking period through February. Viewed in
  // January, December is history while January and February are actionable;
  // each subsequent view drops only work that has actually passed.
  const tomato: Planting = {
    id: 'existing-tomato',
    bedId: BEDS[0].id,
    cropKey: 'tomatoes',
    sowMonth: 7,
    existing: true,
  };

  assert.deepEqual(
    tasksForPlan([tomato], BEDS, 1).map((task) => task.id),
    ['existing-tomato:harvest:1', 'existing-tomato:harvest:2'],
  );
  assert.deepEqual(
    tasksForPlan([tomato], BEDS, 2).map((task) => task.id),
    ['existing-tomato:harvest:2'],
  );
  assert.deepEqual(tasksForPlan([tomato], BEDS, 3), []);
});

test('task generation skips unknown crops, names an absent bed honestly, and stays calendar-sorted', () => {
  const plantings: Planting[] = [
    { id: 'unknown-crop', bedId: 'missing', cropKey: 'not-in-catalogue', sowMonth: 5 },
    { id: 'known-crop', bedId: 'missing', cropKey: 'green-beans', sowMonth: 1 },
  ];
  const tasks = tasksForPlan(plantings, []);

  assert.ok(tasks.length > 0);
  assert.ok(tasks.every((task) => task.cropKey === 'green-beans'));
  assert.ok(tasks.every((task) => task.bedLabel === 'Unknown bed'));
  assert.deepEqual(tasks.map((task) => task.month), [...tasks.map((task) => task.month)].sort((a, b) => a - b));
  assert.equal(new Set(tasks.map((task) => task.id)).size, tasks.length);
});

test('a next-September cohort cannot put its following harvest into the current November', () => {
  const currentMonth = 11;
  const tasks = tasksForPlan([{
    id: 'next-september-beans',
    bedId: BEDS[0].id,
    cropKey: 'green-beans',
    sowMonth: 9,
  }], BEDS, currentMonth);

  assert.deepEqual(
    tasks.map((task) => [task.id, taskMonthsFromNow(task, currentMonth)]),
    [
      ['next-september-beans:prep', 9],
      ['next-september-beans:sow', 10],
      ['next-september-beans:harvest', 12],
    ],
  );
  assert.equal(
    tasks.some((task) => task.month === currentMonth),
    false,
    'the November harvest is next year, not work due this November',
  );
  assert.equal(tasks.find((task) => task.action === 'harvest')?.month, 23);
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
  assert.equal(
    bedOverlapFraction('bed-1', 6, 7, plantings),
    0.25,
    'a December cabbage may still hold the bed in June when nursery readiness took the conservative three months',
  );
  assert.equal(
    bedOverlapFraction('bed-1', 7, 8, plantings),
    0.25,
    'the audited 125-day field endpoint keeps a December cabbage through August',
  );
  assert.equal(bedOverlapFraction('bed-1', 9, 10, plantings), 0);

  const withLegacy: Planting[] = [...plantings, { id: 'legacy-kale', bedId: 'bed-1', cropKey: 'kale', sowMonth: 4 }];
  assert.equal(bedHasUnverifiedTiming('bed-1', withLegacy), true);
  assert.equal(bedHasUnverifiedTiming('bed-1', withLegacy, 'legacy-kale'), false);
  assert.equal(bedOverlapFraction('bed-1', 4, 8, [withLegacy.at(-1)!]), 0, 'unverified timing must not be converted into a legacy overlap');
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

test('crop-cycle benchmark counts each planting once without inventing monthly kg or Rand', () => {
  const crop = CROPS.find((candidate) => (candidate.harvestWindowMonths ?? 0) > 0);
  assert.ok(crop, 'catalogue must contain a repeat-harvest crop');
  const planting: Planting = {
    id: 'repeat-harvest',
    bedId: BEDS[0].id,
    cropKey: crop.key,
    sowMonth: 11,
  };
  const benchmark = buildPlanYieldBenchmark([planting], BEDS);
  const expectedKg = estimatedYieldKgAdjusted(planting, BEDS[0].areaM2, [planting]);

  assert.notEqual(benchmark.knownKg, null);
  assert.ok(Math.abs(benchmark.knownKg! - expectedKg) < 1e-9);
  assert.ok(Math.abs(benchmark.byCrop.reduce((sum, row) => sum + row.kg, 0) - expectedKg) < 1e-9);
  assert.equal('byMonth' in benchmark, false);
  assert.equal('retailValue' in benchmark, false);
  assert.equal('wholesaleValue' in benchmark, false);
  assert.doesNotMatch(
    readFileSync(new URL('../lib/crop-plan.ts', import.meta.url), 'utf8'),
    /buildFoodValueByMonth|kgPerMonth/,
    'production must not recreate an even monthly split from a crop-cycle benchmark',
  );
});

test('a plan\'s benchmark density is the SAME knownKg divided by the SAME growing area, not a third estimate', () => {
  const totalArea = totalGrowingAreaM2(BEDS);
  assert.equal(totalArea, BEDS.reduce((sum, bed) => sum + bed.areaM2, 0));

  const planting: Planting = { id: 'density-carrots', bedId: BEDS[0].id, cropKey: 'carrots', sowMonth: 3 };
  const benchmark = buildPlanYieldBenchmark([planting], BEDS);

  assert.equal(benchmark.growingAreaM2, totalArea);
  assert.notEqual(benchmark.knownKg, null);
  assert.notEqual(benchmark.kgPerM2, null);
  assert.ok(Math.abs(benchmark.kgPerM2! - benchmark.knownKg! / totalArea) < 1e-9);

  // A crop with no verified catalog yield contributes 0, same as knownKg
  // already does for this case — kgPerM2 must match that existing behaviour
  // exactly rather than invent its own "unknown" state. The screen's "No
  // verified kg total" message comes from hasKnownYield/byCrop.length, not
  // from knownKg or kgPerM2 being null — this field never distinguished the
  // two before this metric, and it must keep not distinguishing them now.
  const noYield = buildPlanYieldBenchmark(
    [{ id: 'density-unknown', bedId: BEDS[0].id, cropKey: 'coriander', sowMonth: 3 }],
    BEDS,
  );
  assert.equal(noYield.knownKg, 0);
  assert.equal(noYield.kgPerM2, 0);
  assert.equal(noYield.byCrop.length, 0, 'still the signal a screen must use to withhold the figure');

  // An area conflict blocks knownKg — it must block the density figure the
  // exact same way, not silently divide by a total that includes the
  // disputed bed.
  const conflict = buildPlanYieldBenchmark(
    [
      { id: 'conflict-a', bedId: BEDS[0].id, cropKey: 'carrots', sowMonth: 3 },
      { id: 'conflict-b', bedId: BEDS[0].id, cropKey: 'beetroot', sowMonth: 3 },
    ],
    BEDS,
  );
  assert.equal(conflict.knownKg, null);
  assert.equal(conflict.kgPerM2, null);
  // growingAreaM2 itself is unaffected by a share conflict — it is a fact
  // about the beds, not about what is planted in them.
  assert.equal(conflict.growingAreaM2, totalArea);

  // No growing area at all (a plan with beds removed) must not divide by
  // zero into Infinity/NaN.
  const noBeds = buildPlanYieldBenchmark([planting], []);
  assert.equal(noBeds.growingAreaM2, 0);
  assert.equal(noBeds.kgPerM2, null);
});

test('overlapping manual bed shares withhold every kg and value benchmark instead of double-counting land', () => {
  const conflict: Planting[] = [
    { id: 'whole-a', bedId: BEDS[0].id, cropKey: 'carrots', sowMonth: 3 },
    { id: 'whole-b', bedId: BEDS[0].id, cropKey: 'beetroot', sowMonth: 3 },
  ];
  const benchmark = buildPlanYieldBenchmark(conflict, BEDS);

  assert.equal(benchmark.knownKg, null);
  assert.deepEqual(benchmark.byCrop, [], 'an inflated crop breakdown could still leak into Rand totals');
  assert.deepEqual(benchmark.areaConflictBedLabels, [BEDS[0].label]);
  assert.match(buildYearReport(conflict, BEDS).join(' '), /No kilogram or value total.*overlapping/i);
});

test('a one-off existing crop does not become an annual benchmark conflict with next season', () => {
  const oneBed = [BEDS[0]];
  const activeCabbage: Planting = {
    id: 'existing-cabbage', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 8, existing: true,
  };
  const nextSeptemberBeans: Planting = {
    id: 'next-beans', bedId: BEDS[0].id, cropKey: 'green-beans', sowMonth: 9,
  };

  const benchmark = buildPlanYieldBenchmark([activeCabbage, nextSeptemberBeans], oneBed, 11);
  assert.deepEqual(benchmark.areaConflictBedLabels, []);
  assert.notEqual(benchmark.knownKg, null);

  const finishedCabbage = { ...activeCabbage, sowMonth: 1 };
  const afterFinish = buildPlanYieldBenchmark([finishedCabbage, nextSeptemberBeans], oneBed, 11);
  const beansOnly = buildPlanYieldBenchmark([nextSeptemberBeans], oneBed, 11);
  assert.equal(afterFinish.knownKg, beansOnly.knownKg, 'a stale existing cohort must not return as yield next year');
});

test('timeline offsets anchor field entry to sowing and never repeat an existing cohort', () => {
  const existingTrayCrop: Planting = {
    id: 'existing-tray', bedId: BEDS[0].id, cropKey: 'cabbage', sowMonth: 11, existing: true,
  };
  const nextOctoberTrayCrop: Planting = {
    ...existingTrayCrop, id: 'planned-tray', sowMonth: 10, existing: undefined,
  };

  // Bed-entry offsets use the RESERVED edge (sow + 1 for a tray crop) since
  // 2026-08-19 — the month the transplant task tells the farmer to be ready,
  // not the later planned month. Cabbage sown month 11 viewed from month 11:
  // reserved from month 12 = offset 1 (was offset 2 when the planned edge
  // leaked in here while every farmer-facing surface printed sow + 1).
  assert.deepEqual(plantingBedEntryOffsets(existingTrayCrop, 11, 24), [1]);
  assert.deepEqual(plantingBedEntryOffsets(nextOctoberTrayCrop, 11, 24), [12]);
  assert.equal(plantingIsActiveOrPlanned({ ...existingTrayCrop, sowMonth: 1 }, 11), false);
  assert.deepEqual(recurringPlanPlantings([existingTrayCrop, nextOctoberTrayCrop]), [nextOctoberTrayCrop]);
});

test('positive-yield legacy timing makes a shared-bed benchmark unknown instead of double-counting the bed', () => {
  const legacyAndKnown: Planting[] = [
    { id: 'legacy-maize', bedId: BEDS[0].id, cropKey: 'maize', sowMonth: 11, existing: true },
    { id: 'carrots', bedId: BEDS[0].id, cropKey: 'carrots', sowMonth: 3 },
  ];
  const blocked = buildPlanYieldBenchmark(legacyAndKnown, BEDS);

  assert.equal(blocked.knownKg, null);
  assert.deepEqual(blocked.byCrop, []);
  assert.deepEqual(blocked.areaConflictBedLabels, [BEDS[0].label]);

  const legacyAlone = buildPlanYieldBenchmark([legacyAndKnown[0]], BEDS);
  assert.notEqual(legacyAlone.knownKg, null, 'unknown timing alone does not erase a sourced crop-cycle yield');
  assert.deepEqual(legacyAlone.areaConflictBedLabels, []);
});

test('availability shows fresh picking windows without inventing an unsourced storage life', () => {
  // Deliberately requires storageMonths === undefined too: several crops with
  // a harvestWindowMonths now also carry a sourced storageMonths (2026-08-20
  // storage wave), and this test's whole point is that a crop with NO sourced
  // storage life never grows a 'stored' tail.
  const freshCrop = CROPS.find((candidate) => (candidate.harvestWindowMonths ?? 0) > 0 && candidate.storageMonths === undefined);
  assert.ok(freshCrop);
  const plantings: Planting[] = [
    { id: 'fresh', bedId: BEDS[0].id, cropKey: freshCrop.key, sowMonth: 11 },
  ];
  const availability = buildFoodAvailability(plantings, BEDS);

  assert.equal(availability.length, 13);
  assert.ok(availability.flat().some((item) => item.cropKey === freshCrop.key && item.status === 'fresh'));
  assert.equal(availability.flat().some((item) => item.status === 'stored'), false);
  for (const month of availability) {
    assert.equal(new Set(month.map((item) => item.cropKey)).size, month.length);
  }
});

test('availability grows a stored tail only for a crop with a sourced storage duration, and it never extends bed occupancy', () => {
  // 2026-08-20: the storage wave gave real crops a sourced storageMonths for
  // the first time — this machinery (buildFoodAvailability's storage span,
  // buildFieldUtilizationByMonth's storage-excluded occupancy) existed since
  // the 2026-08-06 audit but had zero crops to actually exercise it.
  const storedCrop = CROPS.find((candidate) => (candidate.storageMonths ?? 0) > 0);
  assert.ok(storedCrop, 'the storage wave should have left at least one crop with a sourced storageMonths');
  assert.ok(storedCrop!.storageSourceUrl?.startsWith('https://'));
  assert.ok(storedCrop!.storageConditions?.trim());

  const plantings: Planting[] = [
    { id: 'stored', bedId: BEDS[0].id, cropKey: storedCrop!.key, sowMonth: 3 },
  ];
  const availability = buildFoodAvailability(plantings, BEDS);
  const utilization = buildFieldUtilizationByMonth(plantings, BEDS);

  const monthsWithThisCrop = availability
    .map((items, month) => ({ month, item: items.find((it) => it.cropKey === storedCrop!.key) }))
    .filter((row) => row.item);
  assert.ok(monthsWithThisCrop.some((row) => row.item!.status === 'fresh'), 'a stored crop must still show its fresh harvest month');
  assert.ok(monthsWithThisCrop.some((row) => row.item!.status === 'stored'), 'a sourced storageMonths must produce a stored tail');

  // The stored tail happens off the bed (shed/pantry) — it must never keep
  // the bed itself occupied in the field-utilization chart, per
  // buildFieldUtilizationByMonth's own documented contract.
  const storedOnlyMonths = monthsWithThisCrop.filter((row) => row.item!.status === 'stored').map((row) => row.month);
  assert.ok(storedOnlyMonths.length > 0);
  for (const month of storedOnlyMonths) {
    const freshElsewhereThisMonth = availability[month].some((it) => it.cropKey === storedCrop!.key && it.status === 'fresh');
    if (!freshElsewhereThisMonth) {
      assert.equal(utilization[month], 0, `month ${month} is a pure storage tail for ${storedCrop!.key} and must not occupy the bed`);
    }
  }
});

test('an existing transplanted crop remains available and occupied in its current harvest month', () => {
  const cabbage: Planting = {
    id: 'existing-cabbage',
    bedId: BEDS[0].id,
    cropKey: 'cabbage',
    sowMonth: 1,
    existing: true,
  };
  const oneBed = [BEDS[0]];

  const availability = buildFoodAvailability([cabbage], oneBed, 8);
  const utilization = buildFieldUtilizationByMonth([cabbage], oneBed, 8);

  assert.deepEqual(availability[8].map((item) => item.cropKey), ['cabbage']);
  assert.ok(availability[8].every((item) => !('kg' in item) && !('retailValue' in item)), 'fresh windows carry timing only');
  assert.equal(utilization[8], 1);
  assert.ok(utilization.slice(1, 8).every((fraction) => fraction === 0), 'finished nursery/field months are history');
});

test('a long existing amadumbe crop resolves to last April rather than inventing next April', () => {
  const amadumbe: Planting = {
    id: 'existing-amadumbe',
    bedId: BEDS[0].id,
    cropKey: 'amadumbe',
    sowMonth: 4,
    existing: true,
  };
  const utilization = buildFieldUtilizationByMonth([amadumbe], [BEDS[0]], 11);

  assert.deepEqual(
    Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => utilization[month] > 0),
    [1, 2, 11, 12],
    'DAFF gives 8–10 months; the conservative 10-month endpoint keeps February occupied too',
  );
});

test('a finished existing crop does not occupy the next annual plan when rotation is off', () => {
  const bed = [BEDS[0]];
  const finishedCabbage: Planting = {
    id: 'finished-cabbage',
    bedId: BEDS[0].id,
    cropKey: 'cabbage',
    sowMonth: 1,
    existing: true,
  };
  const answers: AutoSuggestAnswers = {
    ...ANSWERS,
    cropKeys: ['garlic'],
    rotateCrops: false,
  };
  const baseline = autoSuggestPlan(answers, 'mild-frost', bed, [], 11);
  const afterFinishedCrop = autoSuggestPlan(answers, 'mild-frost', bed, [finishedCabbage], 11);
  const shape = (plantings: Planting[]) => plantings.map((planting) => ({
    cropKey: planting.cropKey,
    sowMonth: planting.sowMonth,
    areaFraction: planting.areaFraction ?? 1,
  }));

  assert.ok(baseline.plantings.length > 0);
  assert.deepEqual(shape(afterFinishedCrop.plantings), shape(baseline.plantings));
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

test('planting-material rows round once per sowing cohort, exclude existing crops, and distinguish seed packets from pieces', () => {
  const plantings: Planting[] = [
    { id: 'new-a', bedId: BEDS[0].id, cropKey: 'dry-beans', sowMonth: 4, areaFraction: 0.5 },
    { id: 'new-b', bedId: BEDS[1].id, cropKey: 'dry-beans', sowMonth: 8, areaFraction: 0.5 },
    { id: 'existing', bedId: BEDS[2].id, cropKey: 'cabbage', sowMonth: 5, existing: true },
  ];
  const together = seedBoqForPlan(plantings, BEDS);
  const beans = together.find((row) => row.cropKey === 'dry-beans');

  assert.ok(beans);
  const crop = cropByKey('dry-beans')!;
  const expectedPositions = Math.round(BEDS[0].areaM2 * 0.5 * plantsPerM2(crop))
    + Math.round(BEDS[1].areaM2 * 0.5 * plantsPerM2(crop));
  assert.equal(beans.count, null, 'the app must not derive a packet quantity from mature spacing');
  assert.equal(beans.finalPlantPositions, expectedPositions);
  assert.equal(together.some((row) => row.cropKey === 'cabbage'), false);
  assert.ok(together.every((row) => row.finalPlantPositions > 0 && row.unit.trim().length > 0));
});

// ── one-time starters: the `once` life cycle ─────────────────────────────────

test('a one-time starter stays planned until its stamped month passes, then settles as an existing cohort', () => {
  const starter: Planting = {
    id: 'auto:starter:bed-1:kale:9', bedId: 'bed-1', cropKey: 'kale', sowMonth: 9, once: '2026-09',
  };
  // Before and during its month: untouched, byte for byte.
  assert.deepEqual(settleOnceRows([starter], 2026, 8), [starter]);
  assert.deepEqual(settleOnceRows([starter], 2026, 9), [starter]);
  // The month after (including across a year boundary for a December stamp):
  // it becomes an ordinary existing row — `once` gone, never annual.
  const settled = settleOnceRows([starter], 2026, 10)[0];
  assert.equal(settled.existing, true);
  assert.ok(!('once' in settled), 'the stamp is consumed on settling');
  const december = { ...starter, sowMonth: 12, once: '2026-12' };
  assert.deepEqual(settleOnceRows([december], 2026, 12), [december]);
  assert.equal(settleOnceRows([december], 2027, 1)[0].existing, true);
});

test('a corrupt once stamp settles immediately — a one-off row must never fall back to recurring-annual semantics', () => {
  for (const bad of ['2026-13', '2026-9', 'next month', '', '2026-00']) {
    const row: Planting = { id: 'x', bedId: 'b', cropKey: 'kale', sowMonth: 9, once: bad };
    const settled = settleOnceRows([row], 2026, 1)[0];
    assert.equal(settled.existing, true, `stamp "${bad}" must settle, not recur`);
    assert.ok(!('once' in settled));
  }
  // Rows without a stamp pass through untouched, planned and existing alike.
  const planned: Planting = { id: 'p', bedId: 'b', cropKey: 'kale', sowMonth: 9 };
  const existing: Planting = { id: 'e', bedId: 'b', cropKey: 'kale', sowMonth: 3, existing: true };
  assert.deepEqual(settleOnceRows([planned, existing], 2030, 6), [planned, existing]);
});

test('a pending starter occupies one single forward stretch — no annual repeat, no phantom past', () => {
  const starter: Planting = {
    id: 's', bedId: 'bed-1', cropKey: 'green-beans', sowMonth: 11, once: '2026-11',
  };
  const offsets = plantingBedEntryOffsets(starter, 8, 24);
  assert.equal(offsets.length, 1, 'exactly one occurrence inside any horizon');
  assert.equal(offsets[0], 3, 'anchored FORWARD at its coming sow month');
  // And it never joins the recurring annual view.
  assert.deepEqual(recurringPlanPlantings([starter]), []);
});

test('editing a starter to a later month restamps it, so it does not settle on the month the farmer abandoned', () => {
  // The bug this pins: a September starter moved to November kept its
  // September stamp, so the October load settled it to `existing` — and an
  // existing row whose sow month reads as November is resolved BACKWARD, to
  // last November. The crop the farmer had just scheduled vanished from tasks,
  // the seed list and the timeline, eleven months in the past.
  const starter: Planting = {
    id: 'auto:starter:bed-1:true-spinach:9', bedId: 'bed-1', cropKey: 'true-spinach', sowMonth: 9, once: '2026-09',
  };
  const moved = restampEditedOnce({ ...starter, sowMonth: 11 }, 2026, 10);
  assert.equal(moved.once, '2026-11', 'the stamp follows the edited sow month');
  assert.equal(moved.existing, undefined, 'still a planned one-time sowing, not an observation');
  // The month it used to be stamped for now passes harmlessly.
  assert.deepEqual(settleOnceRows([moved], 2026, 10), [moved], 'still pending in October');
  assert.deepEqual(settleOnceRows([moved], 2026, 11), [moved], 'still pending during its real month');
  assert.equal(settleOnceRows([moved], 2026, 12)[0].existing, true, 'settles only after November');
  // And it stays a single forward cohort the whole time — never an annual row.
  assert.deepEqual(plantingBedEntryOffsets(moved, 10, 24), [1]);
  assert.deepEqual(recurringPlanPlantings([moved]), []);
});

test('editing a starter into next year, or marking it already growing, both stay honest', () => {
  const starter: Planting = { id: 's', bedId: 'b', cropKey: 'kale', sowMonth: 9, once: '2026-09' };
  // Moved to a month that has already passed this year: the next occurrence is
  // next year, not a stamp in the past that would settle it on sight.
  const backwards = restampEditedOnce({ ...starter, sowMonth: 3 }, 2026, 10);
  assert.equal(backwards.once, '2027-03');
  assert.deepEqual(settleOnceRows([backwards], 2026, 12), [backwards]);
  // Edited onto the current month: still live, because settleOnceRows treats
  // the stamped month itself as current rather than past.
  const thisMonth = restampEditedOnce({ ...starter, sowMonth: 10 }, 2026, 10);
  assert.equal(thisMonth.once, '2026-10');
  assert.deepEqual(settleOnceRows([thisMonth], 2026, 10), [thisMonth]);
  // Ticking "already growing" ends the one-time life: `existing` is the
  // terminal state, and a row carrying both flags has no agreed meaning —
  // rotation reads `once` and anchors forward, occupancy reads `existing` and
  // anchors backward, putting one row twelve months apart.
  const nowGrowing = restampEditedOnce({ ...starter, existing: true }, 2026, 10);
  assert.equal(nowGrowing.existing, true);
  assert.ok(!('once' in nowGrowing), 'the stamp is dropped, never carried alongside existing');
  // Rows that were never starters are untouched, whatever the edit.
  const plain: Planting = { id: 'p', bedId: 'b', cropKey: 'kale', sowMonth: 4 };
  assert.deepEqual(restampEditedOnce(plain, 2026, 10), plain);
  assert.deepEqual(restampEditedOnce({ ...plain, existing: true }, 2026, 10), { ...plain, existing: true });
});

// ── settled nursery cohorts: `inNursery` closes the sow+1 gap ───────────────
//
// A settled `once` transplant row (existing:true) loses its transplant job
// and its seedling purchase in exactly the month it needs them, because
// `existing` was overloaded to mean both "the sowing is done" and "every
// establishment job is done". `inNursery` splits that second meaning off:
// the tray sowing is history, the field entry is not, for exactly one month.

const NURSERY_BED: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 20 }];

test('a settled transplant starter keeps the transplant job it settles ON, and loses it the month after', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };

  const oct = settleOnceRows([starter], 2026, 10)[0];
  assert.equal(oct.existing, true);
  assert.equal(oct.inNursery, '2026-09');
  assert.ok(!('once' in oct), 'the once stamp is still consumed on settling');

  const t = tasksForPlan([oct], NURSERY_BED, 10);
  assert.deepEqual(t.map((x) => x.action), ['transplant', 'harvest'], 'BEFORE this fix: [\'harvest\'] alone');
  assert.equal(t[0].month, 10);
  assert.equal(taskMonthsFromNow(t[0], 10), 0);

  // And it is gone the month after — no overdue state anywhere in this app.
  const nov = settleOnceRows([starter], 2026, 11)[0];
  assert.equal(nov.inNursery, undefined);
  assert.ok(!tasksForPlan([nov], NURSERY_BED, 11).some((x) => x.action === 'transplant'));
});

test('the transplant job keeps its identity across the settle boundary, so a completion tick survives it', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const sep = tasksForPlan(settleOnceRows([starter], 2026, 9), NURSERY_BED, 9).find((x) => x.action === 'transplant')!;
  const oct = tasksForPlan(settleOnceRows([starter], 2026, 10), NURSERY_BED, 10).find((x) => x.action === 'transplant')!;
  assert.equal(sep.id, oct.id);
  assert.equal(sep.id, 's1:transplant');
  assert.equal(sep.month, oct.month);
  assert.equal(taskMonthsFromNow(sep, 9), 1);
  assert.equal(taskMonthsFromNow(oct, 10), 0);
});

test('a direct-sown starter\'s settle boundary does not move — no inNursery state exists for it', () => {
  const direct: Planting = { id: 'd1', bedId: 'b1', cropKey: 'carrots', sowMonth: 9, once: '2026-09' };
  assert.deepEqual(
    settleOnceRows([direct], 2026, 10),
    [{ id: 'd1', bedId: 'b1', cropKey: 'carrots', sowMonth: 9, existing: true }],
  );
  assert.deepEqual(
    tasksForPlan(settleOnceRows([direct], 2026, 9), NURSERY_BED, 9).map((x) => x.action),
    ['prep', 'sow', 'harvest'],
  );
  assert.deepEqual(
    tasksForPlan(settleOnceRows([direct], 2026, 10), NURSERY_BED, 10).map((x) => x.action),
    ['harvest'],
  );
});

test('a farmer-declared already-growing tray crop gains nothing — the assertion that rejects a year-free flag', () => {
  const grown: Planting = { id: 'g', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, existing: true };
  for (const now of [9, 10, 11]) {
    assert.deepEqual(settleOnceRows([grown], 2026, now), [grown]);
    assert.ok(!tasksForPlan([grown], NURSERY_BED, now).some((x) => x.action === 'transplant'));
  }
});

test('the nursery stamp is dead a year later — the anti-phantom-recurrence guard', () => {
  const persisted: Planting = {
    id: 'p', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, existing: true, inNursery: '2026-09',
  };
  assert.equal(settleOnceRows([persisted], 2026, 10)[0].inNursery, '2026-09', 'still live in its own sow+1 month');
  for (const [y, m] of [[2026, 11], [2027, 9], [2027, 10], [2028, 9]] as const) {
    const row = settleOnceRows([persisted], y, m)[0];
    assert.ok(!('inNursery' in row), `${y}-${m} must not resurrect the nursery state`);
    assert.ok(!tasksForPlan([row], NURSERY_BED, m).some((x) => x.action === 'transplant'));
  }
});

test('the two flags can never disagree — inNursery is normalised at the load boundary', () => {
  // No `existing` alongside inNursery: the farmer un-ticked "already growing".
  assert.deepEqual(
    settleOnceRows([{ id: 'x', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, inNursery: '2026-09' }], 2026, 10),
    [{ id: 'x', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9 }],
  );
  // The stamp's month no longer matches sowMonth: a hand edit moved the sowing.
  const persisted: Planting = {
    id: 'p', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, existing: true, inNursery: '2026-09',
  };
  assert.deepEqual(
    settleOnceRows([{ ...persisted, sowMonth: 11 }], 2026, 10),
    [{ id: 'p', bedId: 'b1', cropKey: 'cabbage', sowMonth: 11, existing: true }],
  );
  // A corrupt stamp never resurrects the nursery state.
  for (const bad of ['garbage', '2026-13', '2026-9', '', 42 as unknown as string]) {
    assert.ok(!('inNursery' in settleOnceRows([{ ...persisted, inNursery: bad }], 2026, 10)[0]), `bad stamp "${bad}"`);
  }
});

test('the settle boundary still holds across the year end', () => {
  const dec: Planting = { id: 'd', bedId: 'b1', cropKey: 'cabbage', sowMonth: 12, once: '2026-12' };
  assert.equal(settleOnceRows([dec], 2027, 1)[0].inNursery, '2026-12');
  const jan = tasksForPlan(settleOnceRows([dec], 2027, 1), NURSERY_BED, 1);
  assert.ok(jan.some((x) => x.action === 'transplant' && x.month === 1), 'not 13, not next January');
  assert.ok(!('inNursery' in settleOnceRows([dec], 2027, 2)[0]));
});

test('a farmer who opens the app late settles plain, with no stale transplant', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  assert.ok(!('inNursery' in settleOnceRows([starter], 2026, 12)[0]));
  assert.deepEqual(
    tasksForPlan(settleOnceRows([starter], 2026, 12), NURSERY_BED, 12).map((x) => x.action),
    ['harvest'],
  );
});

test('a nursery row leaves every occupancy/rotation consumer byte-identical to the pre-fix reading', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const nur = settleOnceRows([starter], 2026, 10)[0];
  assert.deepEqual(plantingBedEntryOffsets(nur, 10, 24), [0]);
  assert.deepEqual(occupiedMonthsForPlanting(nur), [10, 11, 12, 1, 2, 3, 4]);
  assert.equal(plantingIsActiveOrPlanned(nur, 10), true);
  assert.equal(recurringPlanPlantings([nur]).length, 0);
});

test('a nursery cohort is never merged with a planned cohort of the same crop and month', () => {
  const starter: Planting = { id: 's1', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, once: '2026-09' };
  const nur = settleOnceRows([starter], 2026, 10)[0];
  const planned: Planting = { id: 'q', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9 };
  const batches = seedBoqBatchesForPlan([nur, planned], NURSERY_BED);
  assert.equal(batches.length, 2, 'BEFORE this fix: 1 batch, 74-115 doubled to 148-230');
  assert.equal(batches.filter((b) => b.inNursery).length, 1);
});

test('the undated cohort list still excludes established rows with no nursery stamp', () => {
  const grown: Planting = { id: 'g', bedId: 'b1', cropKey: 'cabbage', sowMonth: 9, existing: true };
  assert.deepEqual(seedBoqForPlan([grown], NURSERY_BED), []);
});
