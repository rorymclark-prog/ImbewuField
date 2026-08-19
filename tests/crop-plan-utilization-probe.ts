// PROBE, not a test — run directly:
//   npm run crops:probe
//   node --import ./tests/register-alias.mjs tests/crop-plan-utilization-probe.ts
//
// Report-only instrument (no assertions, always exits 0): prints how hard the
// auto-suggest engine actually works the land across the SAME synthetic farm
// population tests/crop-plan-stress.ts sweeps. The 2026-08-19 deep-research
// audit found the headline utilisation number alone hides where the slack
// lives (most idle ground was on plots, not beds), and its measurement
// probes were never committed — re-baselining meant rebuilding instruments.
// This file IS that instrument, kept in-repo so before/after comparison of
// any future packing change is one command.
//
// The site generator below deliberately MIRRORS tests/crop-plan-stress.ts's
// standard (non --full) population — same bed counts, areas, plots, patterns,
// goals, months, rotation toggles, crop whitelists and existing-history rows —
// so probe numbers are directly comparable with stress-run scorecards. If the
// stress population changes, change this in the same commit.

import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal, HarvestRhythm, HouseholdSize } from '@/lib/crop-autosuggest';
import {
  buildFoodAvailability,
  existingSowOffset,
  occupiedMonthsForPlanting,
  TRANSPLANT_BED_RESERVED_FROM_MONTHS,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';

const BED_COUNTS = [1, 2, 3, 5, 6, 9, 12, 16, 24];
const PLOT_COUNTS = [0, 1, 4];
const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];
const HOUSEHOLDS: HouseholdSize[] = ['small', 'medium', 'large'];
const RHYTHMS: HarvestRhythm[] = ['steady', 'few-big'];
const NOW_MONTHS = [1, 4, 8, 11];
const BED_AREAS = [4, 9, 16];

interface Site {
  beds: PlanBed[];
  pattern: RainPattern;
  answers: AutoSuggestAnswers;
  existingPlantings: Planting[];
  nowMonth: number;
}

function wrapMonth(month: number): number {
  return ((month - 1) % 12 + 12) % 12 + 1;
}

function* sites(): Generator<Site> {
  let n = 0;
  for (const bedCount of BED_COUNTS) {
    for (const plotCount of PLOT_COUNTS) {
      for (const pattern of PATTERNS) {
        for (const goal of GOALS) {
          for (const nowMonth of NOW_MONTHS) {
            for (const rotateCrops of [true, false]) {
              n++;
              const areaM2 = BED_AREAS[n % BED_AREAS.length];
              const beds: PlanBed[] = [];
              for (let i = 1; i <= bedCount; i++) {
                const minDimM = i % 3 === 1 ? 0.8 : i % 3 === 2 ? 1.2 : 3;
                beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2, minDimM });
              }
              for (let i = 1; i <= plotCount; i++) {
                beds.push({ id: `p${i}`, label: `Plot ${i}`, areaM2: 90 + i * 12, minDimM: 11, kind: 'plot' });
              }
              const cropKeys = n % 7 === 0
                ? ['green-beans', 'beetroot', 'swiss-chard']
                : n % 5 === 0
                  ? ['cabbage', 'carrots']
                  : undefined;
              const existingPlantings: Planting[] = [];
              if (rotateCrops && beds.length && n % 3 === 0) {
                existingPlantings.push({
                  id: `existing-${n}`,
                  bedId: beds[0].id,
                  cropKey: n % 2 === 0 ? 'cabbage' : 'green-beans',
                  sowMonth: wrapMonth(nowMonth - 7),
                  existing: true,
                });
              }
              yield {
                beds,
                pattern,
                existingPlantings,
                nowMonth,
                answers: {
                  goal,
                  householdSize: HOUSEHOLDS[n % HOUSEHOLDS.length],
                  focusCropCount: (n % 3) + 1,
                  groups: [],
                  cropKeys,
                  rhythm: RHYTHMS[n % RHYTHMS.length],
                  rotateCrops,
                  allowVinesInBeds: n % 5 === 0,
                  reliableIrrigation: true,
                } as AutoSuggestAnswers,
              };
            }
          }
        }
      }
    }
  }
}

/** Per-bed share held in each of the twelve real months (now..now+11),
 * transplant rows reserved from TRANSPLANT_BED_RESERVED_FROM_MONTHS — the
 * same accounting tests/crop-plan-stress.ts's occupancy() uses. */
function monthlyShares(site: Site, plantings: Planting[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const bed of site.beds) out.set(bed.id, Array<number>(13).fill(0));
  for (const p of [...site.existingPlantings, ...plantings]) {
    const arr = out.get(p.bedId);
    const crop = cropByKey(p.cropKey);
    if (!arr || !crop) continue;
    const start = (p.existing
      ? existingSowOffset(p.sowMonth, site.nowMonth)
      : ((p.sowMonth - site.nowMonth + 12) % 12))
      + (crop.transplant ? TRANSPLANT_BED_RESERVED_FROM_MONTHS : 0);
    const span = occupiedMonthsForPlanting(p).length;
    for (let index = 0; index < span; index++) {
      const offset = start + index;
      if (offset >= 0 && offset < 12) {
        arr[wrapMonth(site.nowMonth + offset)] += p.areaFraction ?? 1;
      }
    }
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[index];
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

// ── Sweep ────────────────────────────────────────────────────────────────────

const started = Date.now();
let farms = 0;
let plantingCount = 0;

// Veg beds.
let bedMonths = 0;
let usedBedMonths = 0; // sum of min(1, share)
let bareBedMonths = 0; // share === 0
const perFarmBedUtil: number[] = [];

// Staple plots.
let plotMonths = 0;
let usedPlotMonths = 0;
let barePlotMonths = 0;
const perFarmPlotUtil: number[] = [];

// Fresh-harvest feeders: for each offset 0..11 from the planning month, how
// many distinct fresh-status items feed the farm that month (population mean),
// and how many farms have NO fresh feeder at all that month.
const feederTotals = Array<number>(12).fill(0);
const feederZeroFarms = Array<number>(12).fill(0);

for (const site of sites()) {
  farms++;
  const { plantings } = autoSuggestPlan(
    site.answers, site.pattern, site.beds, site.existingPlantings, site.nowMonth);
  plantingCount += plantings.length;

  const shares = monthlyShares(site, plantings);
  let farmBedMonths = 0;
  let farmUsedBedMonths = 0;
  let farmPlotMonths = 0;
  let farmUsedPlotMonths = 0;
  for (const bed of site.beds) {
    const months = shares.get(bed.id)!;
    for (let m = 1; m <= 12; m++) {
      const used = Math.min(1, months[m]);
      if (bed.kind === 'plot') {
        plotMonths++;
        farmPlotMonths++;
        usedPlotMonths += used;
        farmUsedPlotMonths += used;
        if (months[m] === 0) barePlotMonths++;
      } else {
        bedMonths++;
        farmBedMonths++;
        usedBedMonths += used;
        farmUsedBedMonths += used;
        if (months[m] === 0) bareBedMonths++;
      }
    }
  }
  if (farmBedMonths) perFarmBedUtil.push(farmUsedBedMonths / farmBedMonths);
  if (farmPlotMonths) perFarmPlotUtil.push(farmUsedPlotMonths / farmPlotMonths);

  const availability = buildFoodAvailability(
    [...site.existingPlantings, ...plantings], site.beds);
  for (let offset = 0; offset < 12; offset++) {
    const month = wrapMonth(site.nowMonth + offset);
    const feeders = availability[month].filter((item) => item.status === 'fresh').length;
    feederTotals[offset] += feeders;
    if (feeders === 0) feederZeroFarms[offset]++;
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);

console.log('\nCROP PLAN UTILIZATION PROBE (report only — no assertions)');
console.log('='.repeat(78));
console.log(`${farms.toLocaleString()} farms planned in ${secs}s — ${plantingCount.toLocaleString()} plantings`);
console.log('');
console.log('Vegetable beds');
console.log(`  pooled utilisation:            ${pct(usedBedMonths / bedMonths)}  (${Math.round(usedBedMonths).toLocaleString()} of ${bedMonths.toLocaleString()} bed-months)`);
console.log(`  per-farm utilisation p10/p50/p90: ${pct(percentile(perFarmBedUtil, 0.1))} / ${pct(percentile(perFarmBedUtil, 0.5))} / ${pct(percentile(perFarmBedUtil, 0.9))}`);
console.log(`  bed-months fully bare:         ${pct(bareBedMonths / bedMonths)}  (${bareBedMonths.toLocaleString()})`);
console.log('');
console.log('Staple plots');
if (plotMonths) {
  console.log(`  pooled utilisation:            ${pct(usedPlotMonths / plotMonths)}  (${Math.round(usedPlotMonths).toLocaleString()} of ${plotMonths.toLocaleString()} plot-months)`);
  console.log(`  per-farm utilisation p10/p50/p90: ${pct(percentile(perFarmPlotUtil, 0.1))} / ${pct(percentile(perFarmPlotUtil, 0.5))} / ${pct(percentile(perFarmPlotUtil, 0.9))}`);
  console.log(`  plot-months fully bare:        ${pct(barePlotMonths / plotMonths)}  (${barePlotMonths.toLocaleString()})`);
} else {
  console.log('  (population contains no plots)');
}
console.log('');
console.log('Fresh-harvest feeders by month offset from planning day');
console.log('  offset   mean feeders/farm   farms with zero fresh');
for (let offset = 0; offset < 12; offset++) {
  console.log(`  +${String(offset).padEnd(6)} ${(feederTotals[offset] / farms).toFixed(2).padStart(8)}          ${String(feederZeroFarms[offset]).padStart(6)} (${pct(feederZeroFarms[offset] / farms)})`);
}
console.log('');
console.log('Descriptive only: high utilisation is not an optimality proof, and');
console.log('rotation/evidence gates legitimately keep some ground resting.');
