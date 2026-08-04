// ── Crop-plan stress harness: generate thousands of farms, check everything ──
//
// "Figure out a way to test the crop plan in so many ways, crunch the numbers
// and code." — the owner, after a defect he had reported for weeks turned out
// to be invisible to 1,800 passing tests.
//
// The unit suite asks whether a function returns what it was written to return.
// tests/crop-plan-interrogation.test.ts asks whether the artefact a farmer
// reads is TRUE, on a small sweep sized to run in a second. This is the third
// thing: a deliberately slow, deliberately huge sweep that builds a real plan
// for thousands of different FARMS — one bed to twenty-four, with and without
// staple plots, every rainfall pattern, every goal, every household size, every
// starting month — and checks a dozen invariants against each one.
//
// It prints a scorecard rather than throwing, because its job is to show WHERE
// a rule holds and where it does not: a failure at 24 beds and 0% at 3 beds is
// a completely different bug from a flat 8% everywhere. Anything it finds that
// matters gets a fast gate in the interrogation suite; this harness is how you
// find out what to gate.
//
//   npm run crops:stress            # the standard sweep
//   npm run crops:stress -- --full  # every combination, several minutes
//
// Precedent: tests/benchmark-render-audit.ts (render the sheet and LOOK at it)
// caught three defects 768 unit tests had missed.

import { CROPS, cropByKey, plantsPerM2 } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal, HarvestRhythm, HouseholdSize } from '@/lib/crop-autosuggest';
import {
  buildFoodValueByMonth,
  buildYearReport,
  occupiedMonthsForPlanting,
  seedBoqForPlan,
  tasksForPlan,
  yieldByCrop,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import { buildBedPlanRows } from '@/lib/crop-export-schedule';
import { buildFieldSheet, buildPlanTableRows } from '@/lib/crop-export-benchmark';

const FULL = process.argv.includes('--full');

const BED_COUNTS = FULL ? [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 20, 24] : [1, 2, 3, 5, 6, 9, 12, 16, 24];
const PLOT_COUNTS = FULL ? [0, 1, 2, 3, 4] : [0, 1, 4];
const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];
const HOUSEHOLDS: HouseholdSize[] = ['small', 'medium', 'large'];
const RHYTHMS: HarvestRhythm[] = ['steady', 'few-big'];
const NOW_MONTHS = FULL ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 4, 8, 11];
const BED_AREAS = [4, 9, 16];

/** The smallest share the planner will ever give a crop — below it, free space is dead. */
const SMALLEST_USABLE_SHARE = 0.25;

interface Site {
  label: string;
  bedCount: number;
  plotCount: number;
  pattern: RainPattern;
  goal: GardenGoal;
  beds: PlanBed[];
  answers: AutoSuggestAnswers;
  nowMonth: number;
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
                beds.push({ id: `b${i}`, label: `Bed ${i}`, areaM2, minDimM: 1.2 });
              }
              for (let i = 1; i <= plotCount; i++) {
                beds.push({ id: `p${i}`, label: `Plot ${i}`, areaM2: 90 + i * 12, minDimM: 11, kind: 'plot' });
              }
              yield {
                label: `${bedCount}b/${plotCount}p ${pattern} ${goal} now=${nowMonth} rot=${rotateCrops ? 'y' : 'n'} ${areaM2}m2`,
                bedCount,
                plotCount,
                pattern,
                goal,
                beds,
                nowMonth,
                answers: {
                  goal,
                  householdSize: HOUSEHOLDS[n % HOUSEHOLDS.length],
                  focusCropCount: (n % 3) + 1,
                  groups: [],
                  rhythm: RHYTHMS[n % RHYTHMS.length],
                  rotateCrops,
                  allowVinesInBeds: n % 5 === 0,
                },
              };
            }
          }
        }
      }
    }
  }
}

// ── Checks ──────────────────────────────────────────────────────────────────

interface Check {
  name: string;
  /** Return one line per violation. Empty = clean. */
  run: (site: Site, plantings: Planting[]) => string[];
}

/** Unclamped share of each bed committed in each month. */
function occupancy(site: Site, plantings: Planting[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const bed of site.beds) out.set(bed.id, Array<number>(13).fill(0));
  for (const p of plantings) {
    const arr = out.get(p.bedId);
    if (!arr || !cropByKey(p.cropKey)) continue;
    for (const m of occupiedMonthsForPlanting(p)) arr[m] += p.areaFraction ?? 1;
  }
  return out;
}

const CHECKS: Check[] = [
  {
    name: 'no bed is committed past 100% in any month',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const [bedId, months] of occupancy(site, plantings)) {
        for (let m = 1; m <= 12; m++) {
          if (months[m] > 1.0001) out.push(`${bedId} month ${m} at ${(months[m] * 100).toFixed(0)}%`);
        }
      }
      return out;
    },
  },
  {
    name: 'no bed is left a strip too small to plant',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const [bedId, months] of occupancy(site, plantings)) {
        if (site.beds.find((b) => b.id === bedId)?.kind === 'plot') continue;
        for (let m = 1; m <= 12; m++) {
          const free = 1 - months[m];
          if (free > 0.01 && free < SMALLEST_USABLE_SHARE - 0.01) {
            out.push(`${bedId} month ${m} free ${(free * 100).toFixed(0)}%`);
          }
        }
      }
      return out;
    },
  },
  {
    name: 'a staple plot only ever grows one crop at full area',
    run: (site, plantings) => {
      const out: string[] = [];
      const plotIds = new Set(site.beds.filter((b) => b.kind === 'plot').map((b) => b.id));
      for (const p of plantings) {
        if (plotIds.has(p.bedId) && (p.areaFraction ?? 1) < 1) {
          out.push(`${p.bedId} ${p.cropKey} at ${((p.areaFraction ?? 1) * 100).toFixed(0)}%`);
        }
      }
      return out;
    },
  },
  {
    name: 'every planting names a crop in the catalog',
    run: (_site, plantings) => plantings.filter((p) => !cropByKey(p.cropKey)).map((p) => `${p.bedId} ${p.cropKey}`),
  },
  {
    name: 'every planting sits on a bed the site has',
    run: (site, plantings) => {
      const ids = new Set(site.beds.map((b) => b.id));
      return plantings.filter((p) => !ids.has(p.bedId)).map((p) => `${p.cropKey} on ${p.bedId}`);
    },
  },
  {
    name: 'the kg printed beside each bed equal the kg the year total counts',
    run: (site, plantings) => {
      const printed = buildBedPlanRows(plantings, site.beds)
        .reduce((s, r) => s + r.crops.reduce((a, c) => a + c.estimatedKg, 0), 0);
      const counted = buildFoodValueByMonth(plantings, site.beds, {})
        .slice(1, 13).reduce((s, v) => s + v.kg, 0);
      return Math.abs(printed - counted) > 0.01
        ? [`beds print ${printed.toFixed(1)}kg, total counts ${counted.toFixed(1)}kg`] : [];
    },
  },
  {
    name: 'the twelve monthly kg sum to the plan total',
    run: (site, plantings) => {
      const chart = buildFoodValueByMonth(plantings, site.beds, {});
      const plotted = chart.slice(1, 13).reduce((s, v) => s + v.kg, 0);
      const perCrop = yieldByCrop(plantings, site.beds).reduce((s, c) => s + c.kg, 0);
      return Math.abs(plotted - perCrop) > 0.05
        ? [`chart ${plotted.toFixed(2)}kg vs per-crop ${perCrop.toFixed(2)}kg`] : [];
    },
  },
  {
    name: 'the prose quotes the chart\'s own peak month and figure',
    run: (site, plantings) => {
      const prose = buildYearReport(plantings, site.beds);
      const line = prose.find((p) => /peaking around/.test(p));
      if (!line) return [];
      const chart = buildFoodValueByMonth(plantings, site.beds, {});
      let peak = 1;
      for (let m = 2; m <= 12; m++) if (chart[m].kg > chart[peak].kg) peak = m;
      const quoted = Number(/~(\d+)kg that month/.exec(line)?.[1] ?? -1);
      return Math.abs(quoted - chart[peak].kg) > 1 ? [`prose says ${quoted}kg, chart peak ${chart[peak].kg.toFixed(1)}kg`] : [];
    },
  },
  {
    name: 'the staggering sentence never claims more beds than the farm has',
    run: (site, plantings) => {
      const line = buildYearReport(plantings, site.beds).find((p) => p.includes('staggered the same way'));
      if (!line) return [];
      const claimed = Number(/and (\d+) other bed/.exec(line)?.[1] ?? 0) + 1;
      return claimed > site.beds.length ? [`claims ${claimed} staggered beds, farm has ${site.beds.length}`] : [];
    },
  },
  {
    name: 'the seed bill only lists crops the plan actually sows',
    run: (site, plantings) => {
      const sown = new Set(plantings.filter((p) => !p.existing).map((p) => p.cropKey));
      return seedBoqForPlan(plantings, site.beds)
        .filter((r) => !sown.has(r.cropKey))
        .map((r) => `bill lists ${r.cropKey}, never sown`);
    },
  },
  {
    name: 'every seed quantity is reproducible from the crop spacing',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const row of seedBoqForPlan(plantings, site.beds)) {
        const crop = cropByKey(row.cropKey);
        if (!crop || crop.transplant) continue;
        const area = plantings
          .filter((p) => p.cropKey === row.cropKey && !p.existing)
          .reduce((s, p) => s + (site.beds.find((b) => b.id === p.bedId)?.areaM2 ?? 0) * (p.areaFraction ?? 1), 0);
        // The germination allowance is for SEED. Seed potatoes and slips are
        // living planting material bought by the piece — you do not buy 15%
        // spare tubers against ones that fail to come up. (My first version of
        // this check flagged 2,401 "failures" that were the code being right.)
        const buffer = row.unit === 'seeds' ? 1.15 : 1;
        const expected = area * plantsPerM2(crop) * buffer;
        // Per-planting rounding means a few units of slack on a big multi-bed crop.
        if (expected > 0 && Math.abs(row.count - expected) > Math.max(3, expected * 0.02)) {
          out.push(`${row.cropKey}: bill ${row.count}, spacing implies ${expected.toFixed(0)}`);
        }
      }
      return out;
    },
  },
  {
    name: 'every crop planted has a sowing job in the month it goes in',
    run: (site, plantings) => {
      const tasks = tasksForPlan(plantings, site.beds);
      const out: string[] = [];
      for (const p of plantings) {
        if (p.existing || !cropByKey(p.cropKey)) continue;
        const has = tasks.some((t) => t.action === 'sow' && t.cropKey === p.cropKey && t.month === p.sowMonth);
        if (!has) out.push(`${p.bedId} ${p.cropKey} sow ${p.sowMonth} has no sow task`);
      }
      return out;
    },
  },
  {
    name: 'a tray sowing never carries field row spacing',
    run: (site, plantings) => {
      const tasks = tasksForPlan(plantings, site.beds);
      const out: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const sheet = buildFieldSheet(m, tasks, new Date('2026-08-04T00:00:00Z'));
        for (const section of sheet.sections) {
          if (!section.title.startsWith('Nursery')) continue;
          for (const row of section.rows) {
            if (/rows \d+ cm apart/.test(row.work)) out.push(`month ${m}: nursery row quotes field spacing`);
          }
        }
      }
      return out;
    },
  },
  {
    name: 'the full-plan table lists every planting exactly once',
    run: (site, plantings) => {
      const rows = buildPlanTableRows(plantings, site.beds);
      const real = plantings.filter((p) => cropByKey(p.cropKey) && site.beds.some((b) => b.id === p.bedId));
      return rows.length !== real.length ? [`table has ${rows.length} rows for ${real.length} plantings`] : [];
    },
  },
];

// ── Run ─────────────────────────────────────────────────────────────────────

interface Tally { sites: number; violations: number; sample: string[] }

const byCheck = new Map<string, Tally>();
const byBedCount = new Map<number, Map<string, number>>();
let siteCount = 0;
let plantingCount = 0;
let bedMonths = 0;
let usedBedMonths = 0;
const started = Date.now();

for (const check of CHECKS) byCheck.set(check.name, { sites: 0, violations: 0, sample: [] });

for (const site of sites()) {
  siteCount++;
  let plantings: Planting[];
  try {
    plantings = autoSuggestPlan(site.answers, site.pattern, site.beds, [], site.nowMonth).plantings;
  } catch (err) {
    const t = byCheck.get(CHECKS[0].name)!;
    t.violations++;
    if (t.sample.length < 3) t.sample.push(`THREW on ${site.label}: ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  plantingCount += plantings.length;

  for (const [bedId, months] of occupancy(site, plantings)) {
    if (site.beds.find((b) => b.id === bedId)?.kind === 'plot') continue;
    for (let m = 1; m <= 12; m++) { bedMonths++; usedBedMonths += Math.min(1, months[m]); }
  }

  for (const check of CHECKS) {
    const found = check.run(site, plantings);
    const tally = byCheck.get(check.name)!;
    if (found.length) {
      tally.sites++;
      tally.violations += found.length;
      if (tally.sample.length < 3) tally.sample.push(`${site.label} -> ${found[0]}`);
      let perBed = byBedCount.get(site.bedCount);
      if (!perBed) { perBed = new Map(); byBedCount.set(site.bedCount, perBed); }
      perBed.set(check.name, (perBed.get(check.name) ?? 0) + found.length);
    }
  }
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
const pad = (s: string, n: number) => s.padEnd(n);

console.log(`\nCROP PLAN STRESS SWEEP${FULL ? ' (full)' : ''}`);
console.log('='.repeat(78));
console.log(`${siteCount.toLocaleString()} farms planned in ${secs}s - ${plantingCount.toLocaleString()} plantings, ${bedMonths.toLocaleString()} bed-months`);
console.log(`mean veg-bed utilisation: ${(usedBedMonths / bedMonths * 100).toFixed(1)}%`);
console.log('');

let failed = 0;
for (const check of CHECKS) {
  const t = byCheck.get(check.name)!;
  const ok = t.violations === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${pad(check.name, 58)} ${ok ? '' : `${t.violations.toLocaleString()} in ${t.sites.toLocaleString()} farms`}`);
  for (const s of t.sample) console.log(`        ${s}`);
}

if (byBedCount.size) {
  console.log('\nviolations by farm size:');
  for (const [n, m] of [...byBedCount].sort((a, b) => a[0] - b[0])) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${String(n).padStart(2)} beds: ${String(total).padStart(6)}   ${[...m].map(([k, v]) => `${k.slice(0, 28)}=${v}`).join('  ')}`);
  }
}

console.log('');
console.log(failed === 0 ? 'ALL CHECKS CLEAN' : `${failed} of ${CHECKS.length} checks found something`);
process.exit(0);
