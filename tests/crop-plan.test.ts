import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  autoSuggestPlan,
  clusterSowMonths,
  type AutoSuggestAnswers,
} from '@/lib/crop-autosuggest';
import { cropByKey, CROPS, MONTHS_SHORT, type RainPattern } from '@/lib/crop-catalog';
import { FOOD_GROUP, GROUP_PRIORITY, foodGroupOf } from '@/lib/crop-groups';
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
  // Sow month through the END OF THE PICKING WINDOW — the same span the
  // planner's own occupancy model uses (holdSpanMonths, 2026-08-04). This
  // helper predated that fix and stopped at maturity, which made the winter
  // test call a bed "bare in month 7" while a cut-and-come-again chard was
  // STANDING IN IT being picked. A bed being harvested is not a bare bed —
  // that principle is the owner's own (task #61, "there is no sowing in bed
  // one after april!"), and coverage must be measured by the same model the
  // planner plans with, or the two disagree forever.
  const span = Math.max(1, Math.round(crop.daysToHarvest / 30)) + 1 + (crop.harvestWindowMonths ?? 0);
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

test('every crop has complete, finite physical data without pinning agronomic values', () => {
  const requiredPositive = ['daysToHarvest', 'spacingCm', 'yieldKgPerM2'] as const;
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
    }
  }
});

test('seed BOQ uses rectangular density when sourced and square density as the fallback', () => {
  const rectangular = seedBoqForPlan([
    { id: 'green-beans', bedId: BEDS[0].id, cropKey: 'green-beans', sowMonth: 10 },
  ], BEDS).find((row) => row.cropKey === 'green-beans');
  const fallback = seedBoqForPlan([
    { id: 'pumpkin', bedId: BEDS[0].id, cropKey: 'pumpkin', sowMonth: 10 },
  ], BEDS).find((row) => row.cropKey === 'pumpkin');

  assert.ok(rectangular);
  assert.equal(rectangular.count, 256, 'green beans must use 45cm × 8cm, plus the existing 15% buffer');
  assert.ok(fallback);
  assert.equal(fallback.count, 6, 'pumpkin has no row/in-row split and must keep its 120cm square fallback');
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

  // Every crop the planner OFFERS must map to a catalog key, or yieldFor returns zeroes. This is
  // what makes the honest no-invented-number fallback safe to leave in place.
  const planSource = readFileSync(new URL('../app/plan/page.tsx', import.meta.url), 'utf8');
  const offered = [...planSource.matchAll(/^\s{2}'?([A-Z][A-Za-z ]*?)'?:\s*\['(?:Winter|Summer|Spring|Autumn)/gm)]
    .map((m) => m[1].trim());
  assert.ok(offered.length > 10, 'expected to find the planner\'s crop list');
  const mappingSource = readFileSync(new URL('../lib/crop-display.ts', import.meta.url), 'utf8');
  for (const crop of offered) {
    assert.ok(
      mappingSource.includes(`${crop}:`) || mappingSource.includes(`'${crop}':`),
      `${crop} is offered by the planner but has no catalog key — it would show a zero harvest`,
    );
  }
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

test('every rain-pattern window is a non-empty, unique calendar subset that clusters losslessly', () => {
  const patterns: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];

  for (const crop of CROPS) {
    for (const pattern of patterns) {
      const months = crop.sowMonths[pattern];
      assert.ok(months.length > 0, `${crop.key} has no ${pattern} sowing window`);
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
