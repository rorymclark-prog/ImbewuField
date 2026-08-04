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

import { CROPS, cropByKey, plantsPerM2 } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';
import { sowingInstruction } from '@/lib/crop-export-schedule';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal, HouseholdSize, HarvestRhythm } from '@/lib/crop-autosuggest';
import {
  buildFieldUtilizationByMonth,
  buildFoodValueByMonth,
  buildYearReport,
  occupiedMonthsForPlanting,
  seedBoqForPlan,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';

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

// ── 3. The quantity on the page matches the spacing on the page ─────────────

test('every printed seed quantity is reproducible from the spacing printed beside it', () => {
  const broken: string[] = [];
  for (const crop of CROPS) {
    const printed = sowingInstruction(crop);
    const square = printed.match(/plant spacing ~([\d.]+)cm each way/);
    const row = printed.match(/rows ([\d.]+)cm apart/);
    const inRow = printed.match(/([\d.]+)cm apart in the row/);
    const implied = square
      ? 1 / ((Number(square[1]) / 100) ** 2)
      : row && inRow
        ? 1 / ((Number(row[1]) / 100) * (Number(inRow[1]) / 100))
        : NaN;
    if (!Number.isFinite(implied) || Math.abs(implied - plantsPerM2(crop)) > 0.01) {
      broken.push(`${crop.key}: printed "${printed}" implies ${implied.toFixed(1)}/m², counted ${plantsPerM2(crop).toFixed(1)}/m²`);
    }
  }
  // The printed plan read "Dry beans ~11362 seeds · 15cm apart in the row" —
  // 11362 came from a 10cm square. Both halves of that line were on the page.
  assert.deepEqual(broken, []);
});

test('no catalog crop declares a spacing the seed count then ignores', () => {
  const ignored = CROPS.filter((c) => {
    const printed = sowingInstruction(c);
    if (c.rowSpacingCm !== undefined && !printed.includes(`rows ${c.rowSpacingCm}cm`)) return true;
    if (c.inRowSpacingCm !== undefined
      && !printed.includes(`${c.inRowSpacingCm}cm apart in the row`)
      && !printed.includes(`~${c.inRowSpacingCm}cm each way`)) return true;
    return false;
  }).map((c) => c.key);
  assert.deepEqual(ignored, []);
});

test('the seed bill counts every crop at exactly the shared density, not its own copy of it', () => {
  // The original defect was three separate copies of one formula (crop-plan.ts,
  // app/plan/page.tsx, and the instruction builder), which drifted. Checking the
  // printed line against plantsPerM2 does not catch a BOQ that quietly uses a
  // fourth formula — so measure the bill itself, one crop at a time.
  const bed: PlanBed = { id: 'b1', label: 'Bed 1', areaM2: 20, minDimM: 1.2 };
  const wrong: string[] = [];
  for (const crop of CROPS) {
    const planting: Planting = { id: `p:${crop.key}`, bedId: 'b1', cropKey: crop.key, sowMonth: 3 };
    const row = seedBoqForPlan([planting], [bed])[0];
    if (!row) { wrong.push(`${crop.key}: no bill line at all`); continue; }
    const raw = bed.areaM2 * plantsPerM2(crop);
    const buffered = row.unit === 'seeds' ? raw * 1.15 : raw; // SEED_GERMINATION_BUFFER
    if (Math.abs(row.count - Math.max(1, Math.round(buffered))) > 1) {
      wrong.push(`${crop.key}: bill says ${row.count} ${row.unit}, shared density gives ${Math.round(buffered)}`);
    }
  }
  assert.deepEqual(wrong, []);
});

test('no crop is counted at an impossible planting density', () => {
  // 200/m² is 7cm each way — denser than anything in this catalog is grown,
  // and a deliberately loose bound: it is a trap for a formula that has gone
  // wrong by an order of magnitude, not an agronomic opinion.
  const absurd = CROPS.filter((c) => plantsPerM2(c) > 200 || plantsPerM2(c) <= 0)
    .map((c) => `${c.key} at ${plantsPerM2(c).toFixed(0)}/m²`);
  assert.deepEqual(absurd, []);
});

// ── 4. One quantity, one number ─────────────────────────────────────────────

test('the year-ahead prose quotes the same monthly kg the chart draws', () => {
  const disagreements: string[] = [];
  for (const run of sweep([8])) {
    const prose = buildYearReport(run.plantings, run.beds);
    const peak = prose[0]?.match(/peaking around (\w+) \(~([\d.]+)kg that month\)/);
    if (!peak) continue;
    const chart = buildFoodValueByMonth(run.plantings.filter((p) => !p.existing), run.beds, {});
    const monthIdx = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(peak[1]) + 1;
    const drawn = chart[monthIdx].kg;
    // Both sides round to whole kg for display; a whole-kg tolerance is display
    // rounding, anything beyond it is a second model.
    if (Math.abs(drawn - Number(peak[2])) > 1) {
      disagreements.push(`${run.label} — prose says ${peak[2]}kg in ${peak[1]}, chart draws ${drawn.toFixed(1)}kg`);
    }
    // And the peak the prose names must actually BE the chart's peak month.
    const chartPeak = Array.from({ length: 12 }, (_, i) => i + 1)
      .reduce((best, m) => (chart[m].kg > chart[best].kg ? m : best), 1);
    if (chartPeak !== monthIdx) {
      disagreements.push(`${run.label} — prose peaks in month ${monthIdx}, chart peaks in month ${chartPeak}`);
    }
  }
  assert.deepEqual(disagreements.slice(0, 6), [], `${disagreements.length} screens showing two numbers for one quantity`);
});

test('the prose never calls a month quiet while the chart shows food coming in', () => {
  const lies: string[] = [];
  for (const run of sweep([8])) {
    const prose = buildYearReport(run.plantings, run.beds);
    const quiet = prose.find((p) => p.startsWith('Quietest stretch is around'));
    if (!quiet) continue;
    const label = quiet.match(/around ([\w-]+) —/)?.[1];
    if (!label) continue;
    const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const named = label.split('-').map((s) => SHORT.indexOf(s) + 1).filter((m) => m > 0);
    if (!named.length) continue;
    const chart = buildFoodValueByMonth(run.plantings.filter((p) => !p.existing), run.beds, {});
    // "nothing due to harvest then" is a claim of zero. Any real weight in a
    // month the sentence names makes the sentence false.
    for (const m of named) {
      if (chart[m].kg > 0.05) lies.push(`${run.label} — "${label}" claims nothing due, chart draws ${chart[m].kg.toFixed(1)}kg in month ${m}`);
    }
  }
  assert.deepEqual(lies.slice(0, 6), [], `${lies.length} false quiet-stretch claims`);
});

// ── 5. Nothing on the seed bill a farmer cannot act on ──────────────────────

test('every seed line names a real crop, a real unit and a buyable quantity', () => {
  const bad: string[] = [];
  for (const run of sweep([8])) {
    for (const row of seedBoqForPlan(run.plantings, run.beds)) {
      if (!cropByKey(row.cropKey)) bad.push(`${run.label} — unknown crop ${row.cropKey}`);
      if (!Number.isFinite(row.count) || row.count < 1) bad.push(`${run.label} — ${row.cropKey} count ${row.count}`);
      if (!['seeds', 'seedlings', 'slips', 'seed potatoes'].includes(row.unit)) bad.push(`${run.label} — ${row.cropKey} unit "${row.unit}"`);
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

test('the twelve monthly kg figures sum to the plan total, every time', () => {
  const drift: string[] = [];
  for (const run of sweep()) {
    const chart = buildFoodValueByMonth(run.plantings, run.beds, {});
    const summed = chart.slice(1, 13).reduce((s, v) => s + v.kg, 0);
    const perCrop = chart.slice(1, 13).reduce((s, v) => s + Object.values(v.byCrop).reduce((a, b) => a + b, 0), 0);
    // byCrop is what the hover breakdown shows; if it drifts from the plotted
    // total the tooltip and the point disagree.
    if (Math.abs(summed - perCrop) > 0.01) {
      drift.push(`${run.label} — plotted ${summed.toFixed(2)}kg, breakdown ${perCrop.toFixed(2)}kg`);
    }
  }
  assert.deepEqual(drift.slice(0, 6), []);
});
