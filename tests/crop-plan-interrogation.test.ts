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
  cropByKey,
  hasPlanningYield,
  hasVerifiedSchedule,
  plantSpacingRangeCm,
  plantsPerM2Range,
} from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';
import { buildBedPlanRows, positionRangeLabel, sowingInstruction } from '@/lib/crop-export-schedule';
import { buildFieldSheet } from '@/lib/crop-export-benchmark';
import { autoSuggestPlan, planningWeightBenchmarkScore } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal, HouseholdSize, HarvestRhythm } from '@/lib/crop-autosuggest';
import {
  buildFieldUtilizationByMonth,
  buildFoodAvailability,
  buildPlanYieldBenchmark,
  buildYearReport,
  occupiedMonthsForPlanting,
  seedBoqForPlan,
  tasksForPlan,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { isPlotWinterCover } from '@/lib/staple-crops';

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
