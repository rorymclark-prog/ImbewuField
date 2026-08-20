// INTERROGATION, not unit testing.
//
// On 2026-08-04 the owner live-tested a crop plan that 1,799 passing tests had
// cleared, and found five real defects in it. Every one of those tests was
// green BEFORE the fixes and green AFTER them — they pinned the behaviour the
// code intended, and never once asked whether the artefact a farmer reads was
// TRUE. His words: "you really need to check before you deploy things
// interrogate your own work from all angles". This file is that check.
//
// The rule here is different from the rest of tests/: nothing below asserts on
// a function's return shape. Each test GENERATES plans across the real
// parameter space and then interrogates the OUTPUT — the numbers, the prose and
// the printed instructions a farmer would act on — for statements that are
// false, self-contradictory, or physically impossible.
//
// Precedent that earned this approach: tests/benchmark-render-audit.ts (render
// the sheet and LOOK at it) caught three defects 768 unit tests had missed.

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CROPS,
  MONTHS_SHORT,
  cropByKey,
  hasPlanningYield,
  hasVerifiedSchedule,
  plantSpacingRangeCm,
  plantsPerM2Range,
} from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';
import { buildBedPlanRows, positionRangeLabel, sowingInstruction } from '@/lib/crop-export-schedule';
import { buildFieldSheet, buildOccupancyCalendar } from '@/lib/crop-export-benchmark';
import { autoSuggestPlan, planningWeightBenchmarkScore, recomputeLaterThisYear } from '@/lib/crop-autosuggest';
import { suggestIdealYearPlan } from '@/lib/crop-plan-ideal';
import type { IdealYearPlan } from '@/lib/crop-plan-ideal';
import type { AutoSuggestAnswers, GardenGoal, HouseholdSize, HarvestRhythm } from '@/lib/crop-autosuggest';
import {
  buildFieldUtilizationByMonth,
  buildFoodAvailability,
  buildPlanYieldBenchmark,
  buildYearReport,
  existingSowOffset,
  harvestEndMonthForCrop,
  harvestMonthForCrop,
  occupiedMonthsForPlanting,
  seedBoqForPlan,
  tasksForPlan,
  TRANSPLANT_BED_RESERVED_FROM_MONTHS,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { isPlotWinterCover } from '@/lib/staple-crops';
import { rotationFamilyOf } from '@/lib/crop-groups';

/** `AutoSuggestResult.notes` became `{ kind, bedIds?, text }[]` in the Notes
 * Engine v2 change. These assertions are about the farmer-visible sentence, so
 * they read `.text` and are otherwise unchanged. */
const noteText = (r: { notes: readonly { text: string }[] }): string[] => r.notes.map((note) => note.text);


// ── The sweep ───────────────────────────────────────────────────────────────

const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];
const HOUSEHOLDS: HouseholdSize[] = ['small', 'medium', 'large'];
const RHYTHMS: HarvestRhythm[] = ['steady', 'few-big'];

/**
 * Two geometries that matter, both real. The owner's own farm is nine narrow
 * raised beds beside four field-scale staple plots roughly ten times their
 * size — which is exactly why one idle plot drops his whole utilisation figure
 * by twenty points, and why a bug that only shows up on plots was invisible on
 * a beds-only fixture.
 */
function geometries(): { label: string; beds: PlanBed[] }[] {
  const owner: PlanBed[] = [];
  for (let i = 1; i <= 9; i++) owner.push({ id: `bed-${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
  for (let i = 1; i <= 4; i++) owner.push({ id: `plot-${i}`, label: `Plot ${i}`, areaM2: 123, minDimM: 11, kind: 'plot' });

  const bedsOnly: PlanBed[] = [];
  for (let i = 1; i <= 4; i++) bedsOnly.push({ id: `b-${i}`, label: `Bed ${i}`, areaM2: 12, minDimM: 1.2 });

  return [
    { label: "owner's farm (9 beds + 4 plots)", beds: owner },
    { label: 'four beds, no plots', beds: bedsOnly },
  ];
}

interface Run {
  label: string;
  beds: PlanBed[];
  plantings: Planting[];
}

/** Every plan the sweep produces, labelled well enough to reproduce a failure. */
function sweep(nowMonths: number[] = [1, 4, 8, 11]): Run[] {
  const runs: Run[] = [];
  for (const geo of geometries()) {
    for (const pattern of PATTERNS) {
      for (const goal of GOALS) {
        for (const rotateCrops of [true, false]) {
          for (const nowMonth of nowMonths) {
            const answers: AutoSuggestAnswers = {
              goal,
              householdSize: HOUSEHOLDS[nowMonth % HOUSEHOLDS.length],
              focusCropCount: 2,
              groups: [],
              rhythm: RHYTHMS[nowMonth % RHYTHMS.length],
              rotateCrops,
              allowVinesInBeds: false,
              reliableIrrigation: true,
            };
            const { plantings } = autoSuggestPlan(answers, pattern, geo.beds, [], nowMonth);
            runs.push({
              label: `${geo.label} · ${pattern} · ${goal} · rotate=${rotateCrops} · now=${nowMonth}`,
              beds: geo.beds,
              plantings,
            });
          }
        }
      }
    }
  }
  return runs;
}

/** Unclamped share of each bed committed in each calendar month. */
function occupancyByBed(run: Run): Map<string, number[]> {
  const perBed = new Map<string, number[]>();
  for (const p of run.plantings) {
    const bed = run.beds.find((b) => b.id === p.bedId);
    if (!bed || !cropByKey(p.cropKey)) continue;
    let arr = perBed.get(bed.id);
    if (!arr) { arr = Array<number>(13).fill(0); perBed.set(bed.id, arr); }
    for (const m of occupiedMonthsForPlanting(p)) arr[m] += p.areaFraction ?? 1;
  }
  return perBed;
}

// ── 1. No bed is ever sold twice ────────────────────────────────────────────

test('no bed is ever committed past 100% in any month of any plan', () => {
  const offenders: string[] = [];
  for (const run of sweep()) {
    for (const [bedId, arr] of occupancyByBed(run)) {
      for (let m = 1; m <= 12; m++) {
        if (arr[m] > 1.0001) {
          const bed = run.beds.find((b) => b.id === bedId)!;
          const on = run.plantings
            .filter((p) => p.bedId === bedId && occupiedMonthsForPlanting(p).includes(m))
            .map((p) => `${p.cropKey}(sow ${p.sowMonth}, ${((p.areaFraction ?? 1) * 100).toFixed(0)}%)`)
            .join(' + ');
          offenders.push(`${run.label} — ${bed.label} month ${m} at ${(arr[m] * 100).toFixed(0)}%: ${on}`);
        }
      }
    }
  }
  // The owner's Bed 1 sat at 167% while the chart drew it at 100%, and the
  // planner — believing the bed full — stopped sowing into it after April.
  assert.deepEqual(offenders.slice(0, 8), [], `${offenders.length} over-committed bed-months`);
});

// ── 2. The utilisation chart must not need its own safety clamp ─────────────

test('the utilisation chart draws the true occupancy — its clamp is a no-op', () => {
  const mismatches: string[] = [];
  for (const run of sweep()) {
    const totalArea = run.beds.reduce((s, b) => s + b.areaM2, 0);
    const drawn = buildFieldUtilizationByMonth(run.plantings, run.beds);
    const perBed = occupancyByBed(run);
    for (let m = 1; m <= 12; m++) {
      let unclamped = 0;
      for (const bed of run.beds) unclamped += (perBed.get(bed.id)?.[m] ?? 0) * bed.areaM2;
      const truth = unclamped / totalArea;
      if (Math.abs(truth - drawn[m]) > 0.005) {
        mismatches.push(`${run.label} — month ${m}: chart ${(drawn[m] * 100).toFixed(0)}%, truth ${(truth * 100).toFixed(0)}%`);
      }
    }
  }
  // Math.min(arr[m], bed.areaM2) is defensive armour, and armour that is
  // LOAD-BEARING is a hidden bug: it is what let 47 over-committed bed-months
  // present as a reassuring flat 78-81% line.
  assert.deepEqual(mismatches.slice(0, 8), [], `${mismatches.length} months where the chart hid the real figure`);
});

test('automatic plans use food crops with full evidence or declared covers with a sourced field rate', () => {
  const offenders: string[] = [];
  for (const run of sweep([8])) {
    for (const planting of run.plantings) {
      const crop = cropByKey(planting.cropKey);
      const supportedFood = crop && hasPlanningYield(crop)
        && crop.timingVerified !== false && crop.fieldSpacingVerified !== false;
      const supportedCover = crop && isPlotWinterCover(crop)
        && crop.yieldKgPerM2 === 0 && hasVerifiedSchedule(crop)
        && crop.seedRateKgPerHaRange !== undefined;
      if (!supportedFood && !supportedCover) {
        offenders.push(`${run.label} — ${planting.cropKey}`);
      }
    }
  }
  // A cover is allowed only through the explicit plot-cover route and never
  // becomes food kg. Missing evidence on an ordinary crop still excludes it.
  assert.deepEqual(offenders.slice(0, 8), [], `${offenders.length} unsupported crops entered auto-suggest`);
});

test('different crops never overlap in one bed unless mixed-crop sharing was explicitly enabled', () => {
  const beds = geometries()[0].beds;
  const answers: AutoSuggestAnswers = {
    goal: 'family', householdSize: 'medium', groups: [], rhythm: 'steady',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
    // Deliberately omit allowMixedCropsInBed: false is the safety default.
  };
  const { plantings } = autoSuggestPlan(answers, 'mild-frost', beds, [], 8);
  const conflicts: string[] = [];
  for (const bed of beds.filter((candidate) => candidate.kind !== 'plot')) {
    const rows = plantings.filter((planting) => planting.bedId === bed.id);
    for (let i = 0; i < rows.length; i++) {
      const months = new Set(occupiedMonthsForPlanting(rows[i]));
      for (const other of rows.slice(i + 1)) {
        if (rows[i].cropKey === other.cropKey) continue;
        if (occupiedMonthsForPlanting(other).some((month) => months.has(month))) {
          conflicts.push(`${bed.label}: ${rows[i].cropKey} overlaps ${other.cropKey}`);
        }
      }
    }
  }
  assert.deepEqual(conflicts, []);
});

test('commercial focus chooses the highest sourced conservative kg per m² per crop cycle from viable household choices', () => {
  const cabbage = cropByKey('cabbage')!;
  const lettuce = cropByKey('lettuce')!;
  assert.ok(planningWeightBenchmarkScore(cabbage) > planningWeightBenchmarkScore(lettuce));
  const bed: PlanBed = { id: 'focus', label: 'Focus bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    goal: 'commercial', focusCropCount: 1, cropKeys: ['lettuce', 'cabbage'], groups: [],
    rhythm: 'few-big', rotateCrops: false, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'mild-frost', [bed], [], 8);
  assert.ok(result.plantings.length > 0);
  assert.ok(result.plantings.every((planting) => planting.cropKey === 'cabbage'));
});

test('the regular-harvest choice gives more fresh-picking windows without inventing a monthly yield curve', () => {
  const beds = geometries()[0].beds;
  const vegBeds = beds.filter((bed) => bed.kind !== 'plot');
  const vegIds = new Set(vegBeds.map((bed) => bed.id));
  const planFor = (rhythm: HarvestRhythm) => autoSuggestPlan({
    goal: 'family', householdSize: 'medium', groups: [], rhythm,
    rotateCrops: true, allowVinesInBeds: false,
    reliableIrrigation: true, allowMixedCropsInBed: false,
  }, 'mild-frost', beds, [], 8);
  // Staple plots are intentionally seasonal field crops; the steady-supply
  // promise applies to the succession vegetable beds.
  const freshMonthsFor = (rhythm: HarvestRhythm) => buildFoodAvailability(
    planFor(rhythm).plantings.filter((planting) => vegIds.has(planting.bedId)),
    vegBeds,
  ).slice(1).filter((month) => month.some((item) => item.status === 'fresh')).length;

  const steadyMonths = freshMonthsFor('steady');
  const fewBigMonths = freshMonthsFor('few-big');
  // A fresh harvest in all twelve named months is not a defensible invariant:
  // source-backed maturity and picking windows can leave a real gap, and the
  // planner must not move harvests or invent storage to paint that gap green.
  // The choice we actually offer is comparative — regular opportunities versus
  // deliberately fewer, larger flushes — so pin that rule instead.
  assert.ok(steadyMonths > fewBigMonths, `regular mode covered ${steadyMonths} fresh months versus ${fewBigMonths} in few-big mode`);
});

// ── 3. The quantity on the page matches the spacing on the page ─────────────

function cmRangeLabel(range: readonly [number, number]): string {
  return range[0] === range[1] ? String(range[0]) : `${range[0]}–${range[1]}`;
}

test('every farmer-facing spacing line prints the published bounds that define its density range', () => {
  const broken: string[] = [];
  for (const crop of CROPS.filter((candidate) => candidate.fieldSpacingVerified !== false)) {
    const printed = sowingInstruction(crop);
    const spacing = plantSpacingRangeCm(crop);
    const expectedRow = `rows ${cmRangeLabel(spacing.rowCm)}cm apart`;
    const expectedInRow = `${cmRangeLabel(spacing.inRowCm)}cm apart in the row`;
    const bothExactAndSquare = spacing.rowCm[0] === spacing.rowCm[1]
      && spacing.inRowCm[0] === spacing.inRowCm[1]
      && spacing.rowCm[0] === spacing.inRowCm[0];
    const showsPublishedBounds = bothExactAndSquare
      ? printed.includes(`plant spacing ${cmRangeLabel(spacing.rowCm)}cm each way`)
      : printed.includes(expectedRow) && printed.includes(expectedInRow);
    if (!showsPublishedBounds) {
      broken.push(`${crop.key}: printed "${printed}" instead of ${expectedRow} / ${expectedInRow}`);
      continue;
    }

    const independentlyDerived = [
      1 / ((spacing.rowCm[1] / 100) * (spacing.inRowCm[1] / 100)),
      1 / ((spacing.rowCm[0] / 100) * (spacing.inRowCm[0] / 100)),
    ] as const;
    const catalogRange = plantsPerM2Range(crop);
    if (Math.abs(independentlyDerived[0] - catalogRange[0]) > 1e-9
      || Math.abs(independentlyDerived[1] - catalogRange[1]) > 1e-9) {
      broken.push(`${crop.key}: printed bounds and density range disagree`);
    }
  }
  // The printed plan read "Dry beans ~11362 seeds · 15cm apart in the row" —
  // 11362 came from a 10cm square. Both halves of that line were on the page.
  assert.deepEqual(broken, []);

  // Internal geometry estimates may remain for reading legacy records, but
  // the farmer-facing line must suppress the exact values the source audit
  // rejected rather than laundering them through the generic formatter.
  assert.equal(
    sowingInstruction(cropByKey('tomatoes')!),
    'rows 90–120cm apart · 30–60cm apart in the row · sow 1cm deep',
  );
  assert.doesNotMatch(sowingInstruction(cropByKey('garlic')!), /(?:^|· )10cm apart in the row/i);
  assert.doesNotMatch(sowingInstruction(cropByKey('oats')!), /6cm|100 days?/i);
});

test('primary-source spacing regressions stay ranges instead of becoming midpoint prescriptions', () => {
  // KZN DARD Plant Establishment Table 5. These two examples make this check
  // capable of catching a catalog edit that changes the evidence itself; the
  // broad sweep above catches formatter drift for every other crop without
  // pinning the whole agronomy catalog in a test.
  assert.deepEqual(plantSpacingRangeCm(cropByKey('cabbage')!), {
    rowCm: [50, 60], inRowCm: [35, 45],
  });
  assert.equal(
    sowingInstruction(cropByKey('cabbage')!),
    'rows 50–60cm apart · 35–45cm apart in the row · sow 1.5–2cm deep',
  );

  assert.deepEqual(plantSpacingRangeCm(cropByKey('coriander')!), {
    rowCm: [30, 35], inRowCm: [8, 10],
  });
  assert.equal(
    sowingInstruction(cropByKey('coriander')!),
    'rows 30–35cm apart · 8–10cm apart in the row · sow 1–1.5cm deep',
  );
});

test('the material bill reconciles to spacing ranges without inventing packet seed or midpoint pieces', () => {
  // The original defect was three separate copies of one formula (crop-plan.ts,
  // app/plan/page.tsx, and the instruction builder), which drifted. Checking the
  // printed line against plantsPerM2 does not catch a BOQ that quietly uses a
  // fourth formula — so measure the bill itself, one crop at a time.
  const bed: PlanBed = { id: 'b1', label: 'Bed 1', areaM2: 20, minDimM: 1.2 };
  const wrong: string[] = [];
  for (const crop of CROPS) {
    const planting: Planting = { id: `p:${crop.key}`, bedId: 'b1', cropKey: crop.key, sowMonth: 3 };
    const row = seedBoqForPlan([planting], [bed])[0];
    if (crop.timingVerified === false) {
      if (row) wrong.push(`${crop.key}: an unverified legacy schedule created a new purchase line`);
      continue;
    }
    if (crop.seedRateKgPerHaRange !== undefined) {
      // This BOQ is a piece/packet model. A field cover's sourced kg/ha rate
      // belongs in its sowing task; the legacy plant-grid placeholder must not
      // be converted into a fake shopping count merely to force a bill row.
      if (row) wrong.push(`${crop.key}: a kg/ha field rate became a final-position purchase line`);
      continue;
    }
    if (!row) { wrong.push(`${crop.key}: no bill line at all`); continue; }
    const density = plantsPerM2Range(crop);
    const expectedRange = [
      Math.max(1, Math.floor(bed.areaM2 * density[0])),
      Math.max(1, Math.ceil(bed.areaM2 * density[1])),
    ] as const;
    if (row.finalPlantPositionsRange[0] !== expectedRange[0]
      || row.finalPlantPositionsRange[1] !== expectedRange[1]) {
      wrong.push(`${crop.key}: bill range ${positionRangeLabel(row.finalPlantPositionsRange)}, spacing implies ${positionRangeLabel(expectedRange)}`);
    }
    if (crop.fieldSpacingVerified === false) {
      if (row.quantityStatus !== 'spacing-confirmation-required'
        || row.count !== null || row.countRange !== null) {
        wrong.push(`${crop.key}: unverified spacing still produced an order quantity`);
      }
    } else if (row.unit === 'seeds') {
      if (row.quantityStatus !== 'packet-rate-required'
        || row.count !== null || row.countRange !== null) {
        wrong.push(`${crop.key}: mature positions became a botanical seed-buy quantity`);
      }
    } else if (expectedRange[0] !== expectedRange[1]) {
      if (row.quantityStatus !== 'counted-piece-range' || row.count !== null
        || row.countRange?.[0] !== expectedRange[0] || row.countRange?.[1] !== expectedRange[1]) {
        wrong.push(`${crop.key}: living material used a midpoint instead of ${positionRangeLabel(expectedRange)} ${row.unit}`);
      }
    } else if (row.quantityStatus !== 'counted-pieces'
      || row.count !== expectedRange[0] || row.countRange !== null) {
      wrong.push(`${crop.key}: exact living-piece count does not match its exact spacing`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('every published spacing pair resolves to a finite ordered density range', () => {
  const invalid = CROPS.filter((crop) => crop.fieldSpacingVerified !== false)
    .flatMap((crop) => {
      const [minimum, maximum] = plantsPerM2Range(crop);
      return Number.isFinite(minimum) && Number.isFinite(maximum)
        && minimum > 0 && maximum >= minimum
        ? [] : [`${crop.key}: ${minimum}–${maximum}/m²`];
    });
  assert.deepEqual(invalid, []);
});

// ── 4. One quantity, one number ─────────────────────────────────────────────

test('the year-ahead prose gives only the crop-cycle total and never invents a monthly peak', () => {
  const disagreements: string[] = [];
  for (const run of sweep([8])) {
    const prose = buildYearReport(run.plantings, run.beds);
    const first = prose[0] ?? '';
    const quoted = Number(/total about (\d+)kg/.exec(first)?.[1] ?? Number.NaN);
    const benchmark = buildPlanYieldBenchmark(run.plantings.filter((p) => !p.existing), run.beds);
    if (benchmark.knownKg === null) {
      disagreements.push(`${run.label} — auto-suggest created conflicting bed shares`);
    } else if (benchmark.knownKg > 0 && (!Number.isFinite(quoted) || Math.abs(quoted - benchmark.knownKg) > 1)) {
      disagreements.push(`${run.label} — prose ${quoted}kg, crop-cycle benchmark ${benchmark.knownKg.toFixed(1)}kg`);
    }
    if (/peaking around|\b\d+(?:\.\d+)?\s*kg\s+(?:in|that)\s+month|\bR\s*\d+(?:\.\d+)?\s+(?:in|that)\s+month/i.test(prose.join(' '))) {
      disagreements.push(`${run.label} — prose still assigns a crop-cycle benchmark to a month`);
    }
  }
  assert.deepEqual(disagreements.slice(0, 6), [], `${disagreements.length} unsupported monthly claims`);
});

test('a reported fresh-picking gap agrees with the timing-only availability windows', () => {
  const lies: string[] = [];
  for (const run of sweep([8])) {
    const prose = buildYearReport(run.plantings, run.beds);
    const quiet = prose.find((p) => p.startsWith('No verified fresh-picking window is scheduled around'));
    if (!quiet) continue;
    const label = quiet.match(/around ([\w-]+)\./)?.[1];
    if (!label) continue;
    const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const named = label.split('-').map((s) => SHORT.indexOf(s) + 1).filter((m) => m > 0);
    if (!named.length) continue;
    const availability = buildFoodAvailability(run.plantings.filter((p) => !p.existing), run.beds);
    for (const m of named) {
      if (availability[m].some((item) => item.status === 'fresh')) lies.push(`${run.label} — "${label}" claims a timing gap but month ${m} has a fresh window`);
    }
  }
  assert.deepEqual(lies.slice(0, 6), [], `${lies.length} false quiet-stretch claims`);
});

// ── 5. Nothing on the seed bill a farmer cannot act on ──────────────────────

test('every material line names a real crop and never disguises final positions as seed to buy', () => {
  const bad: string[] = [];
  for (const run of sweep([8])) {
    for (const row of seedBoqForPlan(run.plantings, run.beds)) {
      if (!cropByKey(row.cropKey)) bad.push(`${run.label} — unknown crop ${row.cropKey}`);
      if (!Number.isFinite(row.finalPlantPositionsRange[0])
        || !Number.isFinite(row.finalPlantPositionsRange[1])
        || row.finalPlantPositionsRange[0] < 1
        || row.finalPlantPositionsRange[1] < row.finalPlantPositionsRange[0]) {
        bad.push(`${run.label} — ${row.cropKey} final-position range ${positionRangeLabel(row.finalPlantPositionsRange)}`);
      }
      if (row.unit === 'seeds' && (row.count !== null || row.countRange !== null)) {
        bad.push(`${run.label} — ${row.cropKey} invented botanical seed quantity`);
      }
      if (row.quantityStatus === 'counted-piece-range'
        && (row.count !== null || row.countRange === null
          || row.countRange[0] < 1 || row.countRange[1] < row.countRange[0])) {
        bad.push(`${run.label} — ${row.cropKey} unusable living-piece range`);
      }
      if (row.quantityStatus === 'counted-pieces'
        && (row.count === null || !Number.isFinite(row.count) || row.count < 1 || row.countRange !== null)) {
        bad.push(`${run.label} — ${row.cropKey} unusable exact piece count ${row.count}`);
      }
      // KZN DARD identifies garlic as vegetatively propagated from separated
      // cloves, just as potatoes use seed tubers and sweet potatoes use slips.
      if (!['seeds', 'seedlings', 'slips', 'seed potatoes', 'cloves', 'corms'].includes(row.unit)) bad.push(`${run.label} — ${row.cropKey} unit "${row.unit}"`);
    }
  }
  assert.deepEqual(bad.slice(0, 6), []);
});

test('the seed bill never asks for seed of a crop the plan does not sow', () => {
  const phantom: string[] = [];
  for (const run of sweep([8])) {
    const sown = new Set(run.plantings.filter((p) => !p.existing).map((p) => p.cropKey));
    for (const row of seedBoqForPlan(run.plantings, run.beds)) {
      if (!sown.has(row.cropKey)) phantom.push(`${run.label} — bill lists ${row.cropKey}, plan never sows it`);
    }
  }
  assert.deepEqual(phantom.slice(0, 6), []);
});

// ── 6. The totals close ─────────────────────────────────────────────────────

test('the crop-cycle total equals its crop breakdown without passing through monthly buckets', () => {
  const drift: string[] = [];
  for (const run of sweep()) {
    const benchmark = buildPlanYieldBenchmark(run.plantings, run.beds);
    const summed = benchmark.knownKg;
    const perCrop = benchmark.byCrop.reduce((sum, crop) => sum + crop.kg, 0);
    if (summed === null) {
      drift.push(`${run.label} — auto-suggest created conflicting bed shares`);
    } else if (Math.abs(summed - perCrop) > 0.01) {
      drift.push(`${run.label} — total ${summed.toFixed(2)}kg, crop breakdown ${perCrop.toFixed(2)}kg`);
    }
  }
  assert.deepEqual(drift.slice(0, 6), []);
});

// ── 7. The bed rows and the headline are the same food ──────────────────────

/**
 * The owner exported his plan on 2026-08-04 and page 1 said 840kg while the
 * bed-by-bed rows on pages 1-2 summed to 866kg. Neither number was wrong on
 * its own: the year total asks estimatedYieldKgAdjusted (which discounts a
 * planting that genuinely shares its bed with another crop), and the printed
 * bed row multiplied the yield out by hand and skipped the discount. A fourth
 * copy of the same formula, drifting from the other three.
 */
test('every kg printed beside a bed is a kg the year total counted', () => {
  const gaps: string[] = [];
  for (const run of sweep([8])) {
    const rows = buildBedPlanRows(run.plantings, run.beds);
    const printed = rows.reduce((s, r) => s + r.crops.reduce((a, c) => a + c.estimatedKg, 0), 0);
    const counted = buildPlanYieldBenchmark(run.plantings, run.beds).knownKg;
    if (counted === null) {
      gaps.push(`${run.label} — auto-suggest created conflicting bed shares`);
    } else if (Math.abs(printed - counted) > 0.01) {
      gaps.push(`${run.label} — beds print ${printed.toFixed(1)}kg, headline counts ${counted.toFixed(1)}kg`);
    }
  }
  assert.deepEqual(gaps.slice(0, 6), []);
});

// ── 8. The plan never claims more beds than the farm has ────────────────────

/**
 * "Swiss chard is staggered 2 times on one bed - and 11 other beds are
 * staggered the same way" printed on a farm with NINE beds. The count was of
 * bed+crop pairings, not beds, so one bed staggering three crops counted three
 * times. A farmer can disprove this one by looking out of the window.
 */
test('the multi-month cohort sentence counts real beds without promising continuous harvest', () => {
  const wrong: string[] = [];
  let checked = 0;
  for (const run of sweep([8])) {
    const line = buildYearReport(run.plantings, run.beds)
      .find((l) => l.includes('crops in multiple sowing months'));
    if (!line) continue;
    checked++;
    const claimed = Number(/; (\d+) other bed/.exec(line)?.[1] ?? 0);
    if (/few weeks|harvests keep coming|continuous harvest/i.test(line)
      && !/not a guarantee of uninterrupted harvest/i.test(line)) {
      wrong.push(`${run.label} — month-level rows overclaim cadence: ${line}`);
    }

    const perPair = new Map<string, Set<number>>();
    for (const p of run.plantings) {
      const k = `${p.bedId}::${p.cropKey}`;
      const months = perPair.get(k) ?? new Set<number>();
      months.add(p.sowMonth);
      perPair.set(k, months);
    }
    const staggeredBeds = new Set(
      [...perPair.entries()].filter(([, months]) => months.size >= 2).map(([k]) => k.split('::')[0]),
    );
    if (claimed + 1 > run.beds.length) {
      wrong.push(`${run.label} — claims ${claimed + 1} staggered beds, farm has ${run.beds.length}`);
    } else if (claimed + 1 !== staggeredBeds.size) {
      wrong.push(`${run.label} — claims ${claimed + 1} staggered beds, actually ${staggeredBeds.size}`);
    }
  }
  assert.ok(checked > 0, 'the sweep never exercised a multi-month cohort sentence');
  assert.deepEqual(wrong.slice(0, 6), []);
});

// ── 9. Area-arithmetic remainder check ───────────────────────────────────────

/**
 * "Why does bed one still show so little planting towards the end of the year -
 * I feel like I have been trying to correct this for weeks?"
 *
 * Tracing the fill loop showed February leaving 0.17 of a bed. The earlier
 * gate declared any share below 0.25 "unplantable" regardless of bed area —
 * but 17% of a 16m² bed is 2.7m² and can hold many plants. Percentage alone is
 * not an agronomic rule. This limited oracle asks whether the remaining area
 * can hold one planting position at the densest benchmarked food-crop spacing.
 * It does not prove that the bed geometry, access or crop pairing works.
 */
test('a bed never leaves less than one eligible food-crop position by catalog area arithmetic', () => {
  const maxDensity = Math.max(...CROPS
    .filter((crop) => hasPlanningYield(crop)
      && crop.timingVerified !== false && crop.fieldSpacingVerified !== false)
    .map((crop) => plantsPerM2Range(crop)[1]));
  const slivers: string[] = [];
  for (const run of sweep()) {
    for (const [bedId, months] of occupancyByBed(run)) {
      const bed = run.beds.find((candidate) => candidate.id === bedId);
      if (!bed || bed.kind === 'plot') continue;
      for (let m = 1; m <= 12; m++) {
        const free = 1 - months[m];
        if (free > 0.001 && free * bed.areaM2 * maxDensity < 1) {
          slivers.push(`${run.label} — ${bed.label} month ${m}, ${(free * bed.areaM2).toFixed(3)}m² free`);
        }
      }
    }
  }
  assert.deepEqual(slivers.slice(0, 8), [], `${slivers.length} sub-position bed-month remainders`);
});

// ── 10. The same guarantee at every farm size ───────────────────────────────

/**
 * "It must be for any site no matter the number of beds."
 *
 * The area-arithmetic rule is not allowed to be a nine-bed special case. Sweep
 * one to forty beds, with and without staple plots, and require zero remainder
 * smaller than one benchmarked food-crop position at every size.
 */
test('no farm size leaves a sub-position area remainder, from one bed to forty', () => {
  const worst: string[] = [];
  const maxDensity = Math.max(...CROPS
    .filter((crop) => hasPlanningYield(crop)
      && crop.timingVerified !== false && crop.fieldSpacingVerified !== false)
    .map((crop) => plantsPerM2Range(crop)[1]));

  for (const bedCount of [1, 2, 3, 5, 9, 16, 24, 40]) {
    let sizeSlivers = 0;
    for (const pattern of ['summer', 'mild-frost'] as RainPattern[]) {
      for (const plotCount of [0, 2]) {
        for (const rotateCrops of [true, false]) {
          const beds: PlanBed[] = [];
          for (let i = 1; i <= bedCount; i++) beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
          for (let i = 1; i <= plotCount; i++) beds.push({ id: `p${i}`, label: `Plot ${i}`, areaM2: 110, minDimM: 11, kind: 'plot' });

          const answers: AutoSuggestAnswers = {
            goal: 'family', householdSize: 'large', focusCropCount: 2, groups: [],
            rhythm: 'steady', rotateCrops, allowVinesInBeds: false, reliableIrrigation: true,
          };
          const { plantings } = autoSuggestPlan(answers, pattern, beds, [], 8);
          const run: Run = { label: `${bedCount} beds + ${plotCount} plots · ${pattern}`, beds, plantings };

          for (const [bedId, months] of occupancyByBed(run)) {
            const bed = beds.find((candidate) => candidate.id === bedId);
            if (!bed || bed.kind === 'plot') continue;
            for (let m = 1; m <= 12; m++) {
              const free = 1 - months[m];
              if (free > 0.001 && free * bed.areaM2 * maxDensity < 1) sizeSlivers++;
            }
          }
        }
      }
    }
    if (sizeSlivers > 0) worst.push(`${bedCount} beds: ${sizeSlivers} sub-position bed-months`);
  }

  assert.deepEqual(worst, []);
});

// ── 11. The field sheet scales with the catalog, not the farm ───────────────

/**
 * "We will probably go from 1 bed to 1000." At 1,000 beds the field sheets
 * used to run one row per bed per job — ~22,600 lines a year, a ~900-page
 * document. Identical work now merges into one row naming its beds ("Beds 3,
 * 7, 12"), so a month's sheet is bounded by the number of DISTINCT jobs (a
 * function of the 25-crop catalog), not by how many beds the farm has.
 * Measured after the merge: worst month 45 rows at 40 beds, 49 at 100, 50 at
 * 1,000 — the plateau IS the point. 80 is generous headroom over all three.
 */
test('a month\'s field sheet stays printable at any farm size', () => {
  const now = new Date('2026-08-04T00:00:00Z');
  for (const bedCount of [40, 100, 400]) {
    const beds: PlanBed[] = [];
    for (let i = 1; i <= bedCount; i++) beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
    const answers: AutoSuggestAnswers = {
      goal: 'family', householdSize: 'large', focusCropCount: 2, groups: [],
      rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
    };
    const { plantings } = autoSuggestPlan(answers, 'summer', beds, [], 8);
    const tasks = tasksForPlan(plantings, beds);
    for (let m = 1; m <= 12; m++) {
      const sheet = buildFieldSheet(m, tasks, now);
      assert.ok(
        sheet.workRows <= 80,
        `${bedCount} beds, month ${m}: ${sheet.workRows} rows — the per-bed explosion is back`,
      );
    }
  }
});

// ── 12. A family bed is never left completely bare ──────────────────────────

/**
 * The regression the strip gates were blind to. The 5b7d3b5 fraction rules cut
 * strips at 25-75 beds — and on the owner's own nine-bed farm quietly undid the
 * morning's marquee fix: "the rest" outbid a clean third by 0.001 (floored
 * remainder vs a 0.5 ask), one peas planting swallowed 0.666 of Bed 1 where
 * peas-then-chard used to stand, and the chard was what covered July. Bed 1
 * went back to a bare winter month the same evening it was fixed; every strip
 * and yield gate stayed green because a fully-bare month is not a strip and
 * the kg change was noise. His next message was the Gantt again: "It's worse".
 *
 * So pin the artefact itself when the farmer has explicitly confirmed both
 * reliable irrigation AND mixed-crop bed sharing: on the reference family
 * farm every VEGETABLE bed has something growing in every month. Without
 * those answers, a dry-season or between-crop rest is honest and the optimizer
 * must not assume water or an intercrop merely to satisfy this gate.
 */
test('no vegetable bed on the reference family farm is completely bare in any month', () => {
  const beds: PlanBed[] = [];
  for (let i = 1; i <= 9; i++) beds.push({ id: `bed-${i}`, label: `Bed ${i}`, areaM2: 9, minDimM: 1.2 });
  for (let i = 1; i <= 4; i++) beds.push({ id: `plot-${i}`, label: `Plot ${i}`, areaM2: 123, minDimM: 11, kind: 'plot' });
  const answers: AutoSuggestAnswers = {
    goal: 'family', householdSize: 'large', groups: [],
    rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false,
    reliableIrrigation: true, allowMixedCropsInBed: true,
  };
  const { plantings } = autoSuggestPlan(answers, 'mild-frost', beds, [], 8);

  const occ = new Map<string, number[]>();
  for (const p of plantings) {
    const months = occ.get(p.bedId) ?? Array(13).fill(0);
    for (const m of occupiedMonthsForPlanting(p)) months[m] += p.areaFraction ?? 1;
    occ.set(p.bedId, months);
  }

  const bare: string[] = [];
  for (const bed of beds) {
    if (bed.kind === 'plot') continue;
    const months = occ.get(bed.id) ?? Array(13).fill(0);
    for (let m = 1; m <= 12; m++) {
      if (months[m] <= 0.01) bare.push(`${bed.label} month ${m}`);
    }
  }
  assert.deepEqual(bare, [], `bare bed-months on the reference farm: ${bare.join(', ')}`);
});

// ── Rotation must hold on the real timeline, including mixed beds ───────────
//
// 2026-08-19 audit finding: BedRotation.wouldRepeat compared a candidate only
// with the nearest previous and next course by time. Two holes followed:
//   1. Overlap-blindness — with mixed beds ON (the guided-flow default), a
//      same-family course whose occupancy OVERLAPS the candidate was in
//      neither the "previous" nor the "next" set, so potato and tomatoes
//      (both Solanaceae) could hold one bed at the same time with rotation ON.
//   2. Shadowing — any unrelated course ending inside the gap hid an earlier
//      same-family course: green beans sailed past a peas history because a
//      lettuce merely ENDED later than the peas, without a full different-
//      family course standing between peas and the beans.
// The gate now checks the candidate against EVERY course whose occupancy
// overlaps it, and on each side compares against the full CO-OCCUPANT SET of
// the nearest neighbouring course: a same-family course only stops counting
// as the immediate predecessor once a different course has fully succeeded
// it (started at-or-after it ended) before the candidate. Same
// immediate-chronological-neighbour semantics the audit doc documents — no
// new agronomy, no invented gap length.

interface RotationCourseUnderTest {
  cropKey: string;
  family: ReturnType<typeof rotationFamilyOf>;
  start: number;
  end: number;
  sourceIds: Set<string>;
  plotCover: boolean;
}

/** Bed-hold courses on the rolling timeline: existing rows once at their
 * observed offset, proposed rows at +0 and +12 (the saved annual template
 * repeats). Overlapping cohorts of ONE crop merge into one standing course,
 * exactly as the planner's ledger treats staggered sowings. */
function rotationCoursesUnderTest(
  beds: readonly PlanBed[],
  existing: readonly Planting[],
  proposed: readonly Planting[],
  bedId: string,
  nowMonth: number,
): RotationCourseUnderTest[] {
  const course = (planting: Planting, shift: number): RotationCourseUnderTest | null => {
    const crop = cropByKey(planting.cropKey);
    if (!crop) return null;
    const sowOffset = planting.existing
      ? existingSowOffset(planting.sowMonth, nowMonth)
      : ((planting.sowMonth - nowMonth + 12) % 12) + shift;
    const start = sowOffset + (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
    const span = occupiedMonthsForPlanting(planting).length;
    if (span === 0) return null;
    return {
      cropKey: crop.key,
      family: rotationFamilyOf(crop),
      start,
      end: start + span - 1,
      sourceIds: new Set([planting.id]),
      plotCover: beds.find((bed) => bed.id === bedId)?.kind === 'plot' && isPlotWinterCover(crop),
    };
  };
  const raw = [
    ...existing.filter((planting) => planting.bedId === bedId)
      .map((planting) => course(planting, 0)),
    ...proposed.filter((planting) => planting.bedId === bedId)
      .flatMap((planting) => [course(planting, 0), course(planting, 12)]),
  ].filter((candidate): candidate is RotationCourseUnderTest => candidate !== null)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  // Merge PER CROP, transitively: in a mixed bed another crop's course can sit
  // between two staggered cohorts of one crop in the sorted order, so a
  // last-course-only merge would falsely split one standing course in two.
  const courses: RotationCourseUnderTest[] = [];
  for (const next of raw) {
    const standing = courses.find((candidate) =>
      candidate.cropKey === next.cropKey
      && next.start <= candidate.end && candidate.start <= next.end);
    if (standing) {
      standing.start = Math.min(standing.start, next.start);
      standing.end = Math.max(standing.end, next.end);
      for (const sourceId of next.sourceIds) standing.sourceIds.add(sourceId);
    } else {
      courses.push({ ...next, sourceIds: new Set(next.sourceIds) });
    }
  }
  return courses;
}

/** Same-family course pairs that either overlap in time or follow each other
 * with the earlier course still part of the later course's immediate-
 * predecessor tenure: the earlier course only stops being "the previous
 * course" once some other course has fully succeeded it (started at or after
 * its end) before the later course begins. */
function sameFamilyRotationViolations(
  beds: readonly PlanBed[],
  existing: readonly Planting[],
  proposed: readonly Planting[],
  nowMonth: number,
  /** Plot winter covers are their own documented course sequence, so the
   *  vegetable-rotation gates below skip them. The oats maize-lands gate needs
   *  the opposite view — it exists precisely to find the covers that ARE a
   *  family repeat — so it opts back in. */
  includePlotCovers = false,
): string[] {
  const out: string[] = [];
  for (const bed of beds) {
    const courses = rotationCoursesUnderTest(beds, existing, proposed, bed.id, nowMonth);
    for (let i = 0; i < courses.length; i++) {
      for (let j = i + 1; j < courses.length; j++) {
        const a = courses[i];
        const b = courses[j];
        if (a.family !== b.family) continue;
        // A course is never a rotation conflict with a set containing itself:
        // the +12 row is the same annual template drawn again, and merged
        // staggered cohorts already share ids with their own copies.
        if ([...a.sourceIds].some((sourceId) => b.sourceIds.has(sourceId))) continue;
        // The plot-only zero-food winter cover is a documented soil-cover
        // exception (docs/CROP-PLAN-TRUTH-AUDIT: staple plots carry their own
        // course sequence), not a vegetable rotation course.
        if (!includePlotCovers && (a.plotCover || b.plotCover)) continue;
        const overlap = a.start <= b.end && b.start <= a.end;
        if (overlap) {
          out.push(`${bed.id}: ${a.cropKey}[${a.start}..${a.end}] overlaps ${b.cropKey}[${b.start}..${b.end}] (${a.family})`);
          continue;
        }
        const [earlier, later] = a.end < b.start ? [a, b] : [b, a];
        // Window semantics, mirroring the gate: find the nearest-ending
        // course L that finished before the later course started (the later
        // course's immediate predecessor tenure). The earlier same-family
        // course is a violation iff it is L itself, or it was still in the
        // ground when L's tenure began (earlier.end > L.start) — i.e. no
        // distinct course fully succeeded it before the later one entered.
        // Ties on end prefer the LARGER start (most lenient), so the oracle
        // is never stricter than the planner's own gate.
        const predecessorPool = courses.filter((other) =>
          other !== later && other.end < later.start
          && (includePlotCovers || !other.plotCover)
          && ![...other.sourceIds].some((sourceId) => later.sourceIds.has(sourceId)));
        const nearest = predecessorPool.reduce<RotationCourseUnderTest | null>(
          (best, other) => {
            if (!best) return other;
            if (other.end !== best.end) return other.end > best.end ? other : best;
            return other.start > best.start ? other : best;
          }, null);
        if (nearest && (nearest === earlier || earlier.end > nearest.start)) {
          out.push(`${bed.id}: ${earlier.cropKey}[${earlier.start}..${earlier.end}] -> ${later.cropKey}[${later.start}..${later.end}] (${a.family}) with no full course between`);
        }
      }
    }
  }
  return out;
}

test('rotation ON blocks a same-family course that OVERLAPS another in the same mixed bed (potato + tomatoes)', () => {
  // Reproduces the audited live bug: family goal, rotation ON, mixed beds ON
  // (the guided-flow default), exact whitelist spanning two families so the
  // one-family fallback cannot excuse anything. Before the fix this planted
  // potato and tomatoes — both Solanaceae — overlapping in one bed.
  const beds: PlanBed[] = [
    { id: 'b1', label: 'Bed 1', areaM2: 16, minDimM: 1.2 },
    { id: 'b2', label: 'Bed 2', areaM2: 16, minDimM: 1.2 },
  ];
  const offenders: string[] = [];
  for (const nowMonth of [4, 8, 9]) {
    const { plantings } = autoSuggestPlan({
      goal: 'family', groups: [], cropKeys: ['potato', 'tomatoes', 'carrots'],
      rhythm: 'steady', rotateCrops: true, allowVinesInBeds: false,
      allowMixedCropsInBed: true, reliableIrrigation: true,
    }, 'mild-frost', beds, [], nowMonth);
    offenders.push(...sameFamilyRotationViolations(beds, [], plantings, nowMonth)
      .map((violation) => `now=${nowMonth} ${violation}`));
  }
  assert.deepEqual(offenders, []);
});

test('rotation ON is not fooled by an overlapping course that merely ends later (peas history shadowed by lettuce)', () => {
  // Reproduces the audited shadowing hole: the peas history ends two months
  // before the green-beans candidate, and the lettuce OVERLAPS the peas but
  // ends one month later. Nearest-course-by-end-time called lettuce "the
  // previous course" and licensed a Fabaceae -> Fabaceae succession with no
  // full different-family course between peas and beans.
  const beds: PlanBed[] = [{ id: 'b1', label: 'Bed 1', areaM2: 9, minDimM: 1.2 }];
  const history: Planting[] = [
    { id: 'h-peas', bedId: 'b1', cropKey: 'peas', sowMonth: 7, existing: true },
    { id: 'h-lettuce', bedId: 'b1', cropKey: 'lettuce', sowMonth: 6, existing: true },
  ];
  const { plantings } = autoSuggestPlan({
    goal: 'family', groups: [], cropKeys: ['green-beans', 'carrots'],
    rhythm: 'few-big', rotateCrops: true, allowVinesInBeds: false,
    allowMixedCropsInBed: false, reliableIrrigation: true,
  }, 'mild-frost', beds, history, 12);
  assert.deepEqual(sameFamilyRotationViolations(beds, history, plantings, 12), []);
  // The gate must veto the shadowed December sowing specifically — not merely
  // happen to rank something else first.
  const decemberBeans = plantings.find((planting) =>
    planting.cropKey === 'green-beans' && (planting.sowMonth === 12 || planting.sowMonth === 1));
  assert.equal(decemberBeans, undefined,
    'green beans may not enter the bed straight after the peas history behind the lettuce shadow');
});

test('with mixing ON and rotation ON, no bed ever holds two same-family courses that overlap or break the gap', () => {
  // The permanent population gate the 2026-08-19 audit asked for: the same
  // farm sweep the other interrogations use, with allowMixedCropsInBed forced
  // ON (the guided-flow default) and rotation ON.
  const offenders: string[] = [];
  for (const geo of geometries()) {
    for (const pattern of PATTERNS) {
      for (const goal of GOALS) {
        for (const nowMonth of [1, 4, 8, 11]) {
          const answers: AutoSuggestAnswers = {
            goal,
            householdSize: HOUSEHOLDS[nowMonth % HOUSEHOLDS.length],
            focusCropCount: 2,
            groups: [],
            rhythm: RHYTHMS[nowMonth % RHYTHMS.length],
            rotateCrops: true,
            allowVinesInBeds: false,
            allowMixedCropsInBed: true,
            reliableIrrigation: true,
          };
          const { plantings } = autoSuggestPlan(answers, pattern, geo.beds, [], nowMonth);
          offenders.push(...sameFamilyRotationViolations(geo.beds, [], plantings, nowMonth)
            .map((violation) => `${geo.label} · ${pattern} · ${goal} · now=${nowMonth} — ${violation}`));
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 10), [],
    `${offenders.length} same-family rotation violations under mixed beds`);
});

// ── Planner honesty: a note must name the real cause ────────────────────────
//
// Three defects found by the 2026-08-19 multi-site audit, each of which passed
// every existing test because every existing test asked what the engine
// RETURNED and none asked whether the sentence the farmer reads is TRUE.

test('a plot-only farm is told its real problem, not blamed on vines that were never placed', () => {
  // Repro: the only mapped growing area is a staple plot and the household
  // chose a veg crop, so `sharedBeds` is empty before the vine pre-pass has
  // even run — and the plan said space-hungry vines had taken the beds.
  const result = autoSuggestPlan({
    goal: 'family', groups: [], cropKeys: ['cabbage'], rhythm: 'steady',
    rotateCrops: false, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'winter', [{ id: 'p1', label: 'Plot 1', areaM2: 120, minDimM: 11, kind: 'plot' }], [], 3);
  assert.equal(result.plantings.length, 0, 'the fixture is the empty-plan case the note has to explain');
  assert.ok(!noteText(result).some((note) => /space-hungry vines were placed/.test(note)),
    `no vine was placed, so no note may blame one: ${JSON.stringify(noteText(result))}`);
  assert.ok(noteText(result).some((note) => /staple plot/.test(note) && /veg bed/.test(note)),
    `the real cause — every mapped area is a plot — must be named: ${JSON.stringify(noteText(result))}`);
});

test('the vine-blame sentence only ever appears on a farm that actually has veg beds', () => {
  // Population gate: the wording is legal only when the pre-pass could have
  // taken a bed at all, i.e. at least one non-plot bed was mapped.
  const offenders: string[] = [];
  const plotsOnly: PlanBed[] = [
    { id: 'po-1', label: 'Plot 1', areaM2: 110, minDimM: 11, kind: 'plot' },
    { id: 'po-2', label: 'Plot 2', areaM2: 130, minDimM: 11, kind: 'plot' },
  ];
  for (const pattern of PATTERNS) {
    for (const goal of GOALS) {
      for (const nowMonth of [1, 4, 8, 11]) {
        for (const allowVinesInBeds of [true, false]) {
          for (const beds of [plotsOnly, [] as PlanBed[]]) {
            const result = autoSuggestPlan({
              goal, focusCropCount: 2, groups: [], rhythm: 'steady', rotateCrops: true,
              allowVinesInBeds, allowMixedCropsInBed: true, reliableIrrigation: true,
            }, pattern, beds, [], nowMonth);
            if (noteText(result).some((note) => /space-hungry vines were placed/.test(note))) {
              offenders.push(`${pattern} · ${goal} · now=${nowMonth} · vines=${allowVinesInBeds} · ${beds.length} plots`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 8), [],
    `${offenders.length} plans blamed vines on a farm with no veg bed to take`);
});

test('a "few big harvests" commercial plan never leaves a bed empty in silence', () => {
  // Repro (Springbok): 14 beds, focus on 2 crops, few-big — the engine placed
  // exactly 2 plantings and abandoned 12 beds for the whole year with no note.
  const beds: PlanBed[] = [];
  for (let i = 1; i <= 14; i++) {
    beds.push({ id: `sb-${i}`, label: `Bed ${String(i).padStart(2, '0')}`, areaM2: 4 + (i % 9), minDimM: 1.2 });
  }
  const result = autoSuggestPlan({
    goal: 'commercial', focusCropCount: 2, groups: [], rhythm: 'few-big',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'winter', beds, [], 7);
  const planted = new Set(result.plantings.map((planting) => planting.bedId));
  const silent = beds.filter((bed) => !planted.has(bed.id)
    && !noteText(result).some((note) => note.includes(bed.label)));
  assert.deepEqual(silent.map((bed) => bed.label), [],
    `beds left out of a 12-month plan without a word: ${JSON.stringify(noteText(result))}`);
  // And the fix must be real capacity, not a note papering over two plantings.
  assert.ok(result.plantings.length >= beds.length / 2,
    `only ${result.plantings.length} plantings across ${beds.length} beds`);
});

test('every bed a commercial plan sets aside is either planted or named — at any farm size', () => {
  const offenders: string[] = [];
  for (const pattern of PATTERNS) {
    for (const bedCount of [1, 3, 7, 14, 22]) {
      for (const focusCropCount of [1, 2, 3]) {
        for (const nowMonth of [2, 5, 7, 10]) {
          for (const rhythm of RHYTHMS) {
            const beds: PlanBed[] = [];
            for (let i = 1; i <= bedCount; i++) {
              beds.push({ id: `c-${i}`, label: `Bed ${String(i).padStart(2, '0')}`, areaM2: 4 + (i % 9), minDimM: 1.2 });
            }
            const result = autoSuggestPlan({
              goal: 'commercial', focusCropCount, groups: [], rhythm,
              rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
            }, pattern, beds, [], nowMonth);
            const planted = new Set(result.plantings.map((planting) => planting.bedId));
            for (const bed of beds) {
              if (planted.has(bed.id)) continue;
              if (noteText(result).some((note) => note.includes(bed.label))) continue;
              offenders.push(`${pattern} · ${bedCount} beds · focus=${focusCropCount} · ${rhythm} · now=${nowMonth} — ${bed.label}`);
            }
          }
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 8), [],
    `${offenders.length} bed-years left empty and unexplained`);
});

test('a bed a rotation veto emptied is never described as full', () => {
  // Repro (Mbombela): one 6 m² bed carrying a cabbage record, commercial focus
  // on cabbage. The bed is free eleven months of twelve; the only obstacle is a
  // correct cabbage-after-cabbage rotation veto. The plan said the bed was full.
  const bed: PlanBed = { id: 'mb-1', label: 'Bed 1', areaM2: 6, minDimM: 1.2 };
  const history: Planting[] = [
    { id: 'mb-hist', bedId: 'mb-1', cropKey: 'cabbage', sowMonth: 2, existing: true },
  ];
  const result = autoSuggestPlan({
    goal: 'commercial', focusCropCount: 1, groups: [], rhythm: 'few-big',
    rotateCrops: true, allowVinesInBeds: false, reliableIrrigation: true,
  }, 'winter', [bed], history, 9);
  assert.equal(result.plantings.length, 0, 'the fixture is the empty-plan case the note has to explain');
  assert.ok(!noteText(result).some((note) => /beds are full for now|full for now/.test(note)),
    `the bed is empty eleven months of twelve: ${JSON.stringify(noteText(result))}`);
  assert.ok(noteText(result).some((note) => /rotation/i.test(note) && /family/i.test(note)),
    `the real cause is the rotation veto and must be named: ${JSON.stringify(noteText(result))}`);
  assert.ok(noteText(result).some((note) => note.includes(bed.label)),
    `the bed itself must be named: ${JSON.stringify(noteText(result))}`);
});

test('a stranded bed note never blames rotation for a focus crop that was only space-blocked', () => {
  // Adversarial-verifier repro (2026-08-19): 240 of 3,792 stranded-bed note
  // appearances (6.3%) claimed "shares a botanical family with EVERY crop in
  // your commercial focus" even when one focus crop was never rotation-
  // blocked at all — stopped purely by occupancy. Ground truth on Bed 02:
  // cabbage is rotation-blocked (same family recently grown there) AND
  // space-blocked (the bed is full of it); tomatoes is only space-blocked
  // (a different family — rotation never touched it). "Rotate crops blocked
  // all of them" is false for tomatoes and directly contradicts tomatoes'
  // own B3 note in the same plan.
  const beds: PlanBed[] = [
    { id: 'b1', label: 'Bed 01', areaM2: 5, minDimM: 1.2 },
    { id: 'b2', label: 'Bed 02', areaM2: 6, minDimM: 1.2 },
    { id: 'b3', label: 'Bed 03', areaM2: 7, minDimM: 1.2 },
  ];
  const history: Planting[] = [
    { id: 'h0', bedId: 'b1', cropKey: 'tomatoes', sowMonth: 1, existing: true },
    { id: 'h1', bedId: 'b2', cropKey: 'cabbage', sowMonth: 6, existing: true },
  ];
  const result = autoSuggestPlan({
    goal: 'commercial', focusCropCount: 2, groups: [], rhythm: 'few-big',
    rotateCrops: true, allowVinesInBeds: false, allowMixedCropsInBed: true,
    reliableIrrigation: true,
  }, 'summer', beds, history, 6);
  const bed02Note = noteText(result).find((note) => note.includes('Bed 02') && note.includes('has nothing planted'));
  assert.ok(bed02Note, `Bed 02 must be named as stranded: ${JSON.stringify(noteText(result))}`);
  assert.ok(!/shares a botanical family with every crop in your commercial focus/.test(bed02Note!),
    `tomatoes was only space-blocked in Bed 02, so rotation cannot be blamed for both crops: ${bed02Note}`);
  // The honest middle case: some focus crops would repeat the family, the
  // rest simply could not fit — not a single pooled cause.
  assert.ok(/would repeat this bed's recent family/.test(bed02Note!) && /could not fit around what is already in the ground/.test(bed02Note!),
    `expected the mixed-cause sentence, got: ${bed02Note}`);
});

test('the rotation-claiming stranded-bed sentence only ever appears when every focus crop is genuinely family-blocked (population gate)', () => {
  // Extends the single-fixture rotation-veto check above into a sweep. The
  // oracle here is independent of strandedBedNote: rotationFamilyOf compared
  // directly against what the test itself put in each bed's history. A
  // family MISMATCH is unconditionally proof the crop was never rotation-
  // blocked in that bed (the engine's own rotation gate can only fire on a
  // family match) — so any "blocked all of them" sentence naming a bed where
  // one focus crop's family has no match in that bed's history is a
  // confirmed false claim, regardless of the engine's internal timing rules.
  const PAIRS: [string, string][] = [['tomatoes', 'cabbage'], ['cabbage', 'tomatoes']];
  const NOW_MONTHS = [1, 4, 6, 8, 11];
  const familyMatchesBedHistory = (bedId: string, cropKey: string, history: Planting[]): boolean => {
    const crop = cropByKey(cropKey);
    if (!crop) return false;
    const family = rotationFamilyOf(crop);
    return history.some((h) => h.bedId === bedId
      && cropByKey(h.cropKey) !== undefined
      && rotationFamilyOf(cropByKey(h.cropKey)!) === family);
  };
  const offenders: string[] = [];
  let rotationClaimsSeen = 0;
  let mixedOrSpaceClaimsSeen = 0;
  for (const pattern of PATTERNS) {
    for (const nowMonth of NOW_MONTHS) {
      for (const [cropA, cropB] of PAIRS) {
        const beds: PlanBed[] = [
          { id: 'b1', label: 'Bed 01', areaM2: 5, minDimM: 1.2 },
          { id: 'b2', label: 'Bed 02', areaM2: 6, minDimM: 1.2 },
          { id: 'b3', label: 'Bed 03', areaM2: 7, minDimM: 1.2 },
        ];
        const history: Planting[] = [
          { id: 'h0', bedId: 'b1', cropKey: cropA, sowMonth: 1, existing: true },
          { id: 'h1', bedId: 'b2', cropKey: cropB, sowMonth: 6, existing: true },
        ];
        const result = autoSuggestPlan({
          goal: 'commercial', focusCropCount: 2, groups: [], cropKeys: ['tomatoes', 'cabbage'],
          rhythm: 'few-big', rotateCrops: true, allowVinesInBeds: false,
          allowMixedCropsInBed: true, reliableIrrigation: true,
        }, pattern, beds, history, nowMonth);
        for (const bed of beds) {
          for (const note of noteText(result)) {
            if (!note.includes(bed.label) || !note.includes('has nothing planted')) continue;
            if (/shares a botanical family with every crop in your commercial focus/.test(note)) {
              rotationClaimsSeen++;
              const allMatch = ['tomatoes', 'cabbage'].every((key) => familyMatchesBedHistory(bed.id, key, history));
              if (!allMatch) {
                offenders.push(`${pattern} · now=${nowMonth} · history=${cropA}/${cropB} · ${bed.label}: ${note}`);
              }
            } else if (/would repeat this bed's recent family|fills the bed through every sowing window/.test(note)) {
              mixedOrSpaceClaimsSeen++;
            }
          }
        }
      }
    }
  }
  // The sweep must actually exercise the stranded-bed path, or a green
  // result here would prove nothing.
  assert.ok(mixedOrSpaceClaimsSeen > 0, 'the sweep never produced a mixed- or space-cause stranded-bed note');
  assert.deepEqual(offenders.slice(0, 8), [],
    `${offenders.length} rotation-blocked-all claims where a focus crop's family never matched that bed's history`);
});

// ── The winter cover a plot gets must be the rotation-preferred one ──────────

test('a plot carrying a cereal takes the rotation-clean cover while one is available', () => {
  // Repro (Bloemfontein family): Plot 2 already carries a maize record, and
  // broad beans — rotation-clean after a cereal — passes there. The old
  // sow-scarcity/crop-spread tiebreaks handed that plot OATS, which is legal
  // only through the KZN DARD maize-lands exception, and sent broad beans
  // elsewhere. lib/crop-groups.ts describes the opposite pairing, and it is the
  // one the covers exist for.
  const beds: PlanBed[] = [
    { id: 'bf-b1', label: 'Bed 1', areaM2: 9, minDimM: 1.4 },
    { id: 'bf-b2', label: 'Bed 2', areaM2: 9, minDimM: 1.4 },
    { id: 'bf-b3', label: 'Bed 3', areaM2: 9, minDimM: 1.4 },
    { id: 'bf-p1', label: 'Plot 1', areaM2: 105, minDimM: 11, kind: 'plot' },
    { id: 'bf-p2', label: 'Plot 2', areaM2: 110, minDimM: 11, kind: 'plot' },
    { id: 'bf-p3', label: 'Plot 3', areaM2: 115, minDimM: 11, kind: 'plot' },
  ];
  const history: Planting[] = [
    { id: 'bf-h1', bedId: 'bf-p1', cropKey: 'maize', sowMonth: 6, existing: true },
    { id: 'bf-h2', bedId: 'bf-p2', cropKey: 'maize', sowMonth: 6, existing: true },
  ];
  const result = autoSuggestPlan({
    goal: 'family', focusCropCount: 2, groups: [],
    cropKeys: ['maize', 'pumpkin', 'oats', 'broad-beans', 'potato'],
    rhythm: 'steady', rotateCrops: true, allowVinesInBeds: true,
    allowMixedCropsInBed: true, reliableIrrigation: true,
  }, 'mild-frost', beds, history, 2);
  const onPlot2 = result.plantings.filter((planting) => planting.bedId === 'bf-p2').map((p) => p.cropKey);
  assert.ok(!onPlot2.includes('oats'),
    `the maize plot took the cover that is a cereal repeat: ${JSON.stringify(onPlot2)}`);
  assert.ok(onPlot2.includes('broad-beans'),
    `the rotation-clean cover was available and must be the one used: ${JSON.stringify(onPlot2)}`);
});

test('an all-cereal farm can still take oats, and the plan cites the practice that allows it', () => {
  // The exception is SOURCED and must survive: KZN DARD documents oats as a
  // winter cover in maize lands. What must not survive is silence about it.
  const beds: PlanBed[] = [
    { id: 'mz-p1', label: 'Plot 1', areaM2: 105, minDimM: 11, kind: 'plot' },
    { id: 'mz-p2', label: 'Plot 2', areaM2: 120, minDimM: 11, kind: 'plot' },
  ];
  const history: Planting[] = [
    { id: 'mz-h1', bedId: 'mz-p1', cropKey: 'maize', sowMonth: 6, existing: true },
  ];
  const result = autoSuggestPlan({
    goal: 'family', groups: [], rhythm: 'steady', rotateCrops: true,
    allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
  }, 'summer', beds, history, 2);
  const oatsPlots = result.plantings.filter((planting) => planting.cropKey === 'oats');
  assert.ok(oatsPlots.length > 0, 'the sourced exception must remain reachable');
  const citation = noteText(result).find((note) => /KZN DARD/.test(note));
  assert.ok(citation, `an exception placement must be explained: ${JSON.stringify(noteText(result))}`);
  assert.ok(/broad beans/i.test(citation!), 'the note must offer the manual swap');
  assert.ok(oatsPlots.some((planting) => {
    const bed = beds.find((candidate) => candidate.id === planting.bedId)!;
    return citation!.includes(bed.label);
  }), `the note must name a plot that actually received oats: ${citation}`);
});

test('an oats cover is never left unexplained on ground that just carried a cereal', () => {
  // Population gate with an INDEPENDENT oracle: sameFamilyRotationViolations
  // re-derives the courses from the plantings themselves and knows nothing
  // about the engine's exception, so every oats cover that really is a
  // grass-family repeat shows up here. Each one must be disclosed by name in
  // the KZN DARD note. Rotation-clean oats — after a legume course, or on
  // ground with no cereal near it — is ordinary and is not listed.
  const offenders: string[] = [];
  for (const pattern of PATTERNS) {
    for (const plotCount of [1, 2, 3, 4]) {
      for (const nowMonth of [1, 3, 6, 9]) {
        for (const cereals of [0, 1, plotCount]) {
          const beds: PlanBed[] = [];
          for (let i = 1; i <= plotCount; i++) {
            beds.push({ id: `ox-p${i}`, label: `Plot ${i}`, areaM2: 100 + i * 5, minDimM: 11, kind: 'plot' });
          }
          const history: Planting[] = [];
          for (let i = 1; i <= cereals; i++) {
            history.push({ id: `ox-h${i}`, bedId: `ox-p${i}`, cropKey: 'maize', sowMonth: 6, existing: true });
          }
          const result = autoSuggestPlan({
            goal: 'family', groups: [], rhythm: 'steady', rotateCrops: true,
            allowVinesInBeds: false, allowMixedCropsInBed: true, reliableIrrigation: true,
          }, pattern, beds, history, nowMonth);
          const citation = noteText(result).find((note) => /KZN DARD/.test(note)) ?? '';
          const repeats = sameFamilyRotationViolations(beds, history, result.plantings, nowMonth, true)
            .filter((violation) => violation.includes('oats'));
          for (const violation of repeats) {
            const bed = beds.find((candidate) => violation.startsWith(`${candidate.id}:`));
            if (bed && citation.includes(bed.label)) continue;
            offenders.push(`${pattern} · ${plotCount} plots · cereals=${cereals} · now=${nowMonth} — ${violation}`);
          }
        }
      }
    }
  }
  assert.deepEqual(offenders.slice(0, 8), [],
    `${offenders.length} cereal-on-cereal covers with no sourced explanation`);
});

// ── The whole-year plan tells the truth against its own plantings ───────────
//
// suggestIdealYearPlan runs the engine TWELVE times per call, so this file's
// usual matrix (2 geometries × 4 patterns × 3 goals × 2 rotations × 4
// now-months) would cost ~2,300 engine runs here. TRIMMED, deliberately: the
// claims below are month-relative bookkeeping re-derived from the emitted
// plantings, and that arithmetic does not vary by rain pattern or rotation
// the way placement does — so each axis keeps two representative values
// (≈220 engine runs) instead of all of them. Placement itself is already
// interrogated at full width above; every whole-year winner is an ordinary
// autoSuggestPlan result those tests cover.

interface IdealRun {
  label: string;
  answers: AutoSuggestAnswers;
  pattern: RainPattern;
  beds: PlanBed[];
  realNow: number;
  ideal: IdealYearPlan;
}

const idealFwd = (from: number, to: number): number => ((to - from) % 12 + 12) % 12;

let idealRunsCache: IdealRun[] | null = null;
function idealRuns(): IdealRun[] {
  if (idealRunsCache) return idealRunsCache;
  const [owner, fourBeds] = geometries();
  const cases: { geo: { label: string; beds: PlanBed[] }; pattern: RainPattern; goal: GardenGoal; rhythm: HarvestRhythm; realNow: number }[] = [];
  for (const pattern of ['summer', 'mild-frost'] as RainPattern[]) {
    for (const goal of ['family', 'commercial'] as GardenGoal[]) {
      for (const rhythm of ['steady', 'few-big'] as HarvestRhythm[]) {
        for (const realNow of [3, 8]) {
          cases.push({ geo: fourBeds, pattern, goal, rhythm, realNow });
        }
      }
    }
  }
  // Two owner-farm runs keep the plot/staple machinery inside the net.
  cases.push({ geo: owner, pattern: 'summer', goal: 'family', rhythm: 'steady', realNow: 8 });
  cases.push({ geo: owner, pattern: 'all-year', goal: 'commercial', rhythm: 'few-big', realNow: 3 });
  const runs: IdealRun[] = cases.map((c, i) => {
    const answers: AutoSuggestAnswers = {
      goal: c.goal,
      focusCropCount: 2,
      groups: [],
      // Half the runs pick crops by name, so the waiting panel has explicit
      // crops to be honest ABOUT (it is empty by design without a whitelist).
      cropKeys: i % 2 === 0 ? ['cabbage', 'carrots', 'peas', 'chard'] : undefined,
      rhythm: c.rhythm,
      rotateCrops: true,
      allowVinesInBeds: false,
      reliableIrrigation: true,
    };
    return {
      label: `${c.geo.label} · ${c.pattern} · ${c.goal} · ${c.rhythm} · now=${c.realNow}${answers.cropKeys ? ' · picked crops' : ''}`,
      answers,
      pattern: c.pattern,
      beds: c.geo.beds,
      realNow: c.realNow,
      ideal: suggestIdealYearPlan(answers, c.pattern, c.geo.beds, [], c.realNow, 2026),
    };
  });
  idealRunsCache = runs;
  return runs;
}

test('the whole-year headline is literally true: no other starting month has fewer months without a fresh harvest', () => {
  const offenders: string[] = [];
  for (const run of idealRuns()) {
    run.ideal.perAnchor.forEach((score, i) => {
      if (score.anchorMonth !== i + 1) offenders.push(`${run.label} — perAnchor[${i}] is anchor ${score.anchorMonth}`);
    });
    const counts = run.ideal.perAnchor.map((score) => score.zeroFreshMonths.length);
    const minimum = Math.min(...counts);
    if (run.ideal.best.score.zeroFreshMonths.length !== minimum) {
      offenders.push(`${run.label} — kept a plan with ${run.ideal.best.score.zeroFreshMonths.length} zero-fresh months while an anchor with ${minimum} existed`);
    }
  }
  assert.deepEqual(offenders, [], 'the review card promises "fewest months without a fresh harvest"');
});

test('sameAsToday means exactly that: the winner IS this month\'s own plan, plantings and all', () => {
  const offenders: string[] = [];
  for (const run of idealRuns()) {
    const claims = run.ideal.sameAsToday;
    const is = run.ideal.best.anchorMonth === run.realNow;
    if (claims !== is) {
      offenders.push(`${run.label} — sameAsToday=${claims} but anchor is ${run.ideal.best.anchorMonth} vs now=${run.realNow}`);
      continue;
    }
    if (!claims) continue;
    // "Starting this month already gives the best whole-year result" is only
    // honest if the CYCLE handed over is the from-now plan, byte for byte.
    // One-time starters (`once`) ride alongside — a from-now-optimal cycle
    // has the same first-year holes as any other and gets the same bridging —
    // so they are flagged extras, never silent mutations of the cycle rows.
    const fromNow = autoSuggestPlan(run.answers, run.pattern, run.beds, [], run.realNow);
    const cycleRows = run.ideal.best.result.plantings.filter((p) => typeof p.once !== 'string');
    if (JSON.stringify(cycleRows) !== JSON.stringify(fromNow.plantings)) {
      offenders.push(`${run.label} — sameAsToday cycle differs from the from-now plan`);
    }
    for (const p of run.ideal.best.result.plantings) {
      if (typeof p.once === 'string' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.once)) {
        offenders.push(`${run.label} — starter row ${p.id} carries a malformed once stamp "${p.once}"`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('every start-now, ramp-in and full-cycle statement re-derives from the plantings themselves', () => {
  const offenders: string[] = [];
  for (const run of idealRuns()) {
    const { ideal, realNow } = run;
    const plantings = ideal.best.result.plantings.filter((p) => cropByKey(p.cropKey));
    // "To begin: sow X this month or next" — exactly the crops with a sowing
    // 0-1 months ahead of REAL today, no more and no less.
    const startNow = new Set(plantings.filter((p) => idealFwd(realNow, p.sowMonth) <= 1).map((p) => p.cropKey));
    for (const key of ideal.startNowCropKeys) {
      if (!startNow.has(key)) offenders.push(`${run.label} — told to sow ${key} now but its sowings are further out`);
    }
    for (const key of startNow) {
      if (!ideal.startNowCropKeys.includes(key)) offenders.push(`${run.label} — ${key} sows within a month but the card omits it`);
    }
    // "N sowing months have already passed this year" — re-derived. Ramp and
    // full-cycle lines describe the repeating CYCLE, so one-time starters
    // (first-season extras, `once`) stay out of this derivation — while the
    // start-now list above deliberately includes them: a starter sowing this
    // month IS an instruction to sow this month.
    const sowMonths = [...new Set(plantings.filter((p) => typeof p.once !== 'string').map((p) => p.sowMonth))].sort((a, b) => a - b);
    const expectedRamp = sowMonths.filter((month) => month < realNow);
    if (JSON.stringify(ideal.rampInMonths) !== JSON.stringify(expectedRamp)) {
      offenders.push(`${run.label} — rampInMonths ${JSON.stringify(ideal.rampInMonths)} != passed sow months ${JSON.stringify(expectedRamp)}`);
    }
    // "All of this plan's sowings will have started by <month>" — the month
    // printed must be the real last first-sowing, and within the coming year.
    const expectedFull = sowMonths.length ? Math.max(...sowMonths.map((month) => idealFwd(realNow, month))) : 0;
    if (ideal.monthsUntilFullCycle !== expectedFull) {
      offenders.push(`${run.label} — monthsUntilFullCycle ${ideal.monthsUntilFullCycle} != ${expectedFull}`);
    }
    if (ideal.monthsUntilFullCycle < 0 || ideal.monthsUntilFullCycle > 11) {
      offenders.push(`${run.label} — monthsUntilFullCycle ${ideal.monthsUntilFullCycle} outside 0..11`);
    }
    const expectedByMonth = ((realNow - 1 + ideal.monthsUntilFullCycle) % 12) + 1;
    if (ideal.fullCycleByMonth !== expectedByMonth) {
      offenders.push(`${run.label} — fullCycleByMonth ${ideal.fullCycleByMonth} != ${expectedByMonth}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the whole-year card speaks from today, not from its anchor month', () => {
  const offenders: string[] = [];
  for (const run of idealRuns()) {
    const { ideal, realNow } = run;
    const notes = ideal.best.result.notes.map((note) => note.text);
    // The waiting panel must describe THIS plan from THIS month — the anchor
    // run wrote it from a month that may not be today.
    const honest = recomputeLaterThisYear(
      run.answers, run.pattern, run.beds, ideal.best.result.plantings, [], realNow,
    );
    if (JSON.stringify(ideal.best.result.laterThisYear) !== JSON.stringify(honest)) {
      offenders.push(`${run.label} — waiting panel differs from a recompute at the real month`);
    }
    if (ideal.best.result.plantings.length) {
      const basisMentions = notes.filter((text) => text.includes('plans starting in each of the 12 months'));
      if (basisMentions.length !== 1) {
        offenders.push(`${run.label} — ${basisMentions.length} whole-year basis notes, expected exactly 1`);
      } else if (!basisMentions[0].includes(`from ${MONTHS_SHORT[realNow - 1]}.`)) {
        offenders.push(`${run.label} — basis note does not name the real month ${MONTHS_SHORT[realNow - 1]}: "${basisMentions[0]}"`);
      }
    }
    // With an empty bed history nothing can be "already growing" — the
    // overlap warning appearing here would be a fabricated hazard.
    for (const text of notes) {
      if (text.includes('already growing')) offenders.push(`${run.label} — overlap warning on an empty farm: "${text}"`);
    }
    // The transition year may only ever be LEANER than the repeating year the
    // scores describe — with ONE precise exception: a one-time starter
    // sowing (`once`) can feed a year-one month the repeating cycle never
    // covers. A steady-state gap month claimed fresh in year one must
    // therefore be justified by a specific starter whose own first-year
    // fresh window covers it, recomputed here independently; anything else
    // means one of the two disclosures is lying.
    const starterFreshMonths = new Set<number>();
    for (const p of ideal.best.result.plantings) {
      if (typeof p.once !== 'string') continue;
      const crop = cropByKey(p.cropKey);
      if (!crop || crop.timingVerified === false || crop.yieldKgPerM2 === 0) continue;
      const first = harvestMonthForCrop(p.sowMonth, crop);
      const last = harvestEndMonthForCrop(p.sowMonth, crop);
      const span = ((last - first) % 12 + 12) % 12;
      const sowOffset = ((p.sowMonth - realNow) % 12 + 12) % 12;
      const freshDelta = ((first - p.sowMonth) % 12 + 12) % 12;
      for (let i = 0; i <= span; i++) {
        if (sowOffset + freshDelta + i <= 11) starterFreshMonths.add(((first - 1 + i) % 12) + 1);
      }
    }
    for (const month of ideal.best.score.zeroFreshMonths) {
      if (!ideal.firstYearZeroFreshMonths.includes(month) && !starterFreshMonths.has(month)) {
        offenders.push(`${run.label} — month ${month} is zero-fresh in the repeating year, claimed fresh in year one, and no one-time starter feeds it`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('one-time starters stand only on ground the cycle leaves bare, at full width, and only ever reduce idle ground', () => {
  // The same calendar the farmer's PDF prints, before and after the starters
  // join. A starter intruding on an occupied cell would be a double-booking
  // the printed sheet cannot survive; a starter that fails to reduce idle
  // ground would be decoration. Abbreviation codes are position-dependent
  // (a new crop can renumber the taken set), so cells compare on substance.
  const substance = (cells: { cropKey: string; share: string; harvesting: boolean }[]) =>
    JSON.stringify(cells.map(({ cropKey, share, harvesting }) => ({ cropKey, share, harvesting })));
  const idleCells = (calendar: ReturnType<typeof buildOccupancyCalendar>) =>
    calendar.reduce((total, row) => total + row.cells.filter((cell) => !cell.length).length, 0);
  const offenders: string[] = [];
  let startersSeen = 0;
  for (const run of idealRuns()) {
    const { ideal, realNow } = run;
    const final = ideal.best.result.plantings;
    const starters = final.filter((p) => typeof p.once === 'string');
    if (!starters.length) continue;
    startersSeen += starters.length;
    const cycleRows = final.filter((p) => typeof p.once !== 'string');
    const before = buildOccupancyCalendar(cycleRows, run.beds, realNow);
    const after = buildOccupancyCalendar(final, run.beds, realNow);
    for (let rowIndex = 0; rowIndex < before.length; rowIndex++) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
        const cycleCell = before[rowIndex].cells[monthIndex];
        const finalCell = after[rowIndex].cells[monthIndex];
        if (cycleCell.length) {
          if (substance(finalCell) !== substance(cycleCell)) {
            offenders.push(`${run.label} — ${before[rowIndex].label} offset ${monthIndex}: a starter intruded on occupied ground`);
          }
        } else if (finalCell.some((entry) => entry.share !== 'Full')) {
          offenders.push(`${run.label} — ${before[rowIndex].label} offset ${monthIndex}: starter cell not full-width`);
        }
      }
    }
    if (idleCells(after) >= idleCells(before)) {
      offenders.push(`${run.label} — starters failed to reduce idle ground (${idleCells(before)} -> ${idleCells(after)})`);
    }
  }
  assert.deepEqual(offenders, []);
  assert.ok(startersSeen > 0, 'the parameter space must exercise the starter path at least once');
});
