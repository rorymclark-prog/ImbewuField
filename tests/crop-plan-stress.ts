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
// It prints a scorecard showing WHERE a rule fails, then exits non-zero when any
// invariant fails. A diagnostic that always exits zero is not a gate: automation
// and a tired human can both miss a red word buried in thousands of lines.
//
//   npm run crops:stress            # the standard sweep
//   npm run crops:stress -- --full  # every combination, several minutes
//
// Precedent: tests/benchmark-render-audit.ts (render the sheet and LOOK at it)
// caught three defects 768 unit tests had missed.

import { CROPS, cropByKey, hasPlanningYield, plantsPerM2Range } from '@/lib/crop-catalog';
import type { RainPattern } from '@/lib/crop-catalog';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { AutoSuggestAnswers, GardenGoal, HarvestRhythm, HouseholdSize } from '@/lib/crop-autosuggest';
import {
  buildPlanYieldBenchmark,
  buildYearReport,
  existingSowOffset,
  occupiedMonthsForPlanting,
  seedBoqForPlan,
  tasksForPlan,
  TRANSPLANT_ENTRY_EARLIEST_MONTHS,
  yieldByCrop,
  type PlanBed,
  type Planting,
} from '@/lib/crop-plan';
import {
  buildBedPlanRows,
  buildBuyingSchedule,
  positionRangeLabel,
} from '@/lib/crop-export-schedule';
import { buildFieldSheet, buildPlanTableRows } from '@/lib/crop-export-benchmark';
import { rotationFamilyOf } from '@/lib/crop-groups';

const FULL = process.argv.includes('--full');

const BED_COUNTS = FULL ? [1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 14, 16, 20, 24] : [1, 2, 3, 5, 6, 9, 12, 16, 24];
const PLOT_COUNTS = FULL ? [0, 1, 2, 3, 4] : [0, 1, 4];
const PATTERNS: RainPattern[] = ['summer', 'winter', 'all-year', 'mild-frost'];
const GOALS: GardenGoal[] = ['family', 'commercial', 'hybrid'];
const HOUSEHOLDS: HouseholdSize[] = ['small', 'medium', 'large'];
const RHYTHMS: HarvestRhythm[] = ['steady', 'few-big'];
const NOW_MONTHS = FULL ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1, 4, 8, 11];
const BED_AREAS = [4, 9, 16];

/**
 * Densest benchmarked food crop by the catalog's area arithmetic. Oats is a
 * zero-food, plot-only cover crop whose broadcast density must not make a
 * vegetable-bed remainder look more useful than it is. This is not a geometry
 * proof: bed shape, access and crop compatibility are outside this oracle.
 */
const MAX_ELIGIBLE_FOOD_PLANTS_PER_M2 = Math.max(
  ...CROPS
    .filter((crop) => hasPlanningYield(crop)
      && crop.timingVerified !== false && crop.fieldSpacingVerified !== false)
    .map((crop) => plantsPerM2Range(crop)[1]),
);

interface Site {
  label: string;
  bedCount: number;
  plotCount: number;
  pattern: RainPattern;
  goal: GardenGoal;
  beds: PlanBed[];
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
                // Real mapped beds are heterogeneous. Alternating narrow,
                // standard and wide dimensions catches crop/bed assignment
                // failures that a farm made entirely of 1.2m beds cannot see.
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
                  // Seven months back is a completed, relevant prior course for
                  // these crops rather than phantom current occupancy.
                  sowMonth: wrapMonth(nowMonth - 7),
                  existing: true,
                });
              }
              yield {
                label: `${bedCount}b/${plotCount}p ${pattern} ${goal} now=${nowMonth} rot=${rotateCrops ? 'y' : 'n'} ${areaM2}m2`,
                bedCount,
                plotCount,
                pattern,
                goal,
                beds,
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

/** Unclamped share in the real now..+11 horizon. Existing rows are one-off
 * observed cohorts; proposed rows start at their next future occurrence. */
function occupancy(site: Site, plantings: Planting[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const bed of site.beds) out.set(bed.id, Array<number>(13).fill(0));
  for (const p of [...site.existingPlantings, ...plantings]) {
    const arr = out.get(p.bedId);
    const crop = cropByKey(p.cropKey);
    if (!arr || !crop) continue;
    const start = (p.existing
      ? existingSowOffset(p.sowMonth, site.nowMonth)
      : ((p.sowMonth - site.nowMonth + 12) % 12))
      + (crop.transplant ? TRANSPLANT_ENTRY_EARLIEST_MONTHS : 0);
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

/** Proposed rows become the saved annual template. Check that recurrence on
 * its own as well, without folding one-off crop history into every year. */
function annualPlanOccupancy(site: Site, plantings: Planting[]): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const bed of site.beds) out.set(bed.id, Array<number>(13).fill(0));
  for (const planting of plantings) {
    const arr = out.get(planting.bedId);
    if (!arr || !cropByKey(planting.cropKey)) continue;
    for (const month of occupiedMonthsForPlanting(planting)) {
      arr[month] += planting.areaFraction ?? 1;
    }
  }
  return out;
}

interface RotationCourse {
  cropKey: string;
  family: ReturnType<typeof rotationFamilyOf>;
  start: number;
  end: number;
  planned: boolean;
  sourceIds: Set<string>;
}

function rotationCourses(site: Site, bedId: string, plantings: Planting[]): RotationCourse[] {
  const slot = (planting: Planting, shift = 0): RotationCourse | null => {
    const crop = cropByKey(planting.cropKey);
    if (!crop) return null;
    const sowOffset = planting.existing
      ? existingSowOffset(planting.sowMonth, site.nowMonth)
      : ((planting.sowMonth - site.nowMonth + 12) % 12) + shift;
    const start = sowOffset + (crop.transplant ? 1 : 0);
    return {
      cropKey: crop.key,
      family: rotationFamilyOf(crop),
      start,
      end: start + occupiedMonthsForPlanting(planting).length - 1,
      planned: !planting.existing,
      sourceIds: new Set([planting.id]),
    };
  };
  const raw = [
    ...site.existingPlantings.filter((planting) => planting.bedId === bedId)
      .map((planting) => slot(planting))
      .filter((course): course is RotationCourse => course !== null),
    ...plantings.filter((planting) => planting.bedId === bedId)
      .flatMap((planting) => [slot(planting), slot(planting, 12)])
      .filter((course): course is RotationCourse => course !== null),
  ].sort((a, b) => a.start - b.start || a.end - b.end);

  // Overlapping cohorts of one crop are one standing course. Adjacency is a
  // new course: harvesting one crop and planting the same family next month
  // is exactly the immediate-repeat risk this oracle must detect.
  const courses: RotationCourse[] = [];
  for (const course of raw) {
    const previous = courses[courses.length - 1];
    if (previous && previous.cropKey === course.cropKey && course.start <= previous.end) {
      previous.end = Math.max(previous.end, course.end);
      previous.planned ||= course.planned;
      for (const sourceId of course.sourceIds) previous.sourceIds.add(sourceId);
    } else {
      courses.push({ ...course, sourceIds: new Set(course.sourceIds) });
    }
  }
  return courses;
}

const CHECKS: Check[] = [
  {
    name: 'no bed is committed past 100% in the real twelve-month horizon',
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
    name: 'the proposed annual template remains wrap-safe without overbooking',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const [bedId, months] of annualPlanOccupancy(site, plantings)) {
        for (let month = 1; month <= 12; month++) {
          if (months[month] > 1.0001) {
            out.push(`${bedId} month ${month} at ${(months[month] * 100).toFixed(0)}%`);
          }
        }
      }
      return out;
    },
  },
  {
    name: 'no bed leaves a remainder smaller than one benchmarked food-crop position by area arithmetic',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const [bedId, months] of occupancy(site, plantings)) {
        const bed = site.beds.find((b) => b.id === bedId);
        if (!bed || bed.kind === 'plot') continue;
        for (let m = 1; m <= 12; m++) {
          const free = 1 - months[m];
          // Fractions are stored at 0.001 precision. IEEE arithmetic renders
          // that exact accepted remainder as 0.0010000000000000009.
          if (free > 0.001 + 1e-9 && free * bed.areaM2 * MAX_ELIGIBLE_FOOD_PLANTS_PER_M2 < 1) {
            out.push(`${bedId} month ${m} free ${(free * bed.areaM2).toFixed(3)}m²`);
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
    name: 'automatic plantings, work and purchases exclude every unsupported crop',
    run: (site, plantings) => {
      const unsupported = (cropKey: string): boolean => {
        const crop = cropByKey(cropKey);
        return !crop || !hasPlanningYield(crop)
          || crop.timingVerified === false || crop.fieldSpacingVerified === false;
      };
      const out = plantings
        .filter((planting) => unsupported(planting.cropKey))
        .map((planting) => `${planting.cropKey} entered the automatic plan`);
      out.push(...tasksForPlan(plantings, site.beds)
        .filter((task) => unsupported(task.cropKey))
        .map((task) => `${task.cropKey} produced an automatic field instruction`));
      out.push(...seedBoqForPlan(plantings, site.beds)
        .filter((row) => unsupported(row.cropKey))
        .map((row) => `${row.cropKey} produced an automatic purchase line`));
      return out;
    },
  },
  {
    name: 'every planting sits on a bed the site has',
    run: (site, plantings) => {
      const ids = new Set(site.beds.map((b) => b.id));
      return plantings.filter((p) => !ids.has(p.bedId)).map((p) => `${p.cropKey} on ${p.bedId}`);
    },
  },
  {
    name: 'an exact crop list never gains an unchosen crop',
    run: (site, plantings) => {
      if (!site.answers.cropKeys?.length) return [];
      const allowed = new Set(site.answers.cropKeys);
      return plantings
        .filter((planting) => !allowed.has(planting.cropKey))
        .map((planting) => `${planting.bedId} got ${planting.cropKey}`);
    },
  },
  {
    name: 'rotation-on plans have no chronological same-family crop neighbours',
    run: (site, plantings) => {
      if (!site.answers.rotateCrops) return [];
      const exactFamilies = new Set(
        (site.answers.cropKeys ?? [])
          .flatMap((key) => {
            const crop = cropByKey(key);
            return crop ? [rotationFamilyOf(crop)] : [];
          }),
      );
      // A one-family exact list invokes the explicit, narrated fallback.
      if (site.answers.cropKeys?.length && exactFamilies.size === 1) return [];
      const out: string[] = [];
      for (const bed of site.beds) {
        const courses = rotationCourses(site, bed.id, plantings);
        for (let index = 1; index < courses.length; index++) {
          const previous = courses[index - 1];
          const current = courses[index];
          if (!current.planned) continue;
          // The +12 row is the same annual template drawn again, not a second
          // stored rotation. Keep it for distinct boundary neighbours, but do
          // not compare a planting with its own synthetic copy.
          if (previous.sourceIds.size === current.sourceIds.size
            && [...previous.sourceIds].every((sourceId) => current.sourceIds.has(sourceId))) continue;
          if (previous.family === current.family) {
            out.push(`${bed.id}: ${previous.cropKey} -> ${current.cropKey} (${current.family})`);
          }
        }
      }
      return out;
    },
  },
  {
    name: 'the kg printed beside each bed equal the kg the year total counts',
    run: (site, plantings) => {
      const printed = buildBedPlanRows(plantings, site.beds)
        .reduce((s, r) => s + r.crops.reduce((a, c) => a + c.estimatedKg, 0), 0);
      const benchmark = buildPlanYieldBenchmark(plantings, site.beds);
      if (benchmark.areaConflictBedLabels.length) {
        return [`auto plan produced an area conflict on ${benchmark.areaConflictBedLabels.join(', ')}`];
      }
      const counted = benchmark.knownKg;
      if (counted === null) return ['conflict-free auto plan withheld its crop-cycle total'];
      return Math.abs(printed - counted) > 0.01
        ? [`beds print ${printed.toFixed(1)}kg, total counts ${counted.toFixed(1)}kg`] : [];
    },
  },
  {
    name: 'the crop-cycle total equals the per-crop benchmark breakdown',
    run: (site, plantings) => {
      const benchmark = buildPlanYieldBenchmark(plantings, site.beds);
      if (benchmark.areaConflictBedLabels.length) {
        return [`auto plan produced an area conflict on ${benchmark.areaConflictBedLabels.join(', ')}`];
      }
      const plotted = benchmark.knownKg;
      if (plotted === null) return ['conflict-free auto plan withheld its crop-cycle total'];
      const perCrop = yieldByCrop(plantings, site.beds).reduce((s, c) => s + c.kg, 0);
      return Math.abs(plotted - perCrop) > 0.05
        ? [`total ${plotted.toFixed(2)}kg vs per-crop ${perCrop.toFixed(2)}kg`] : [];
    },
  },
  {
    name: 'the prose never invents a monthly kg peak from a crop-cycle benchmark',
    run: (site, plantings) => {
      const prose = buildYearReport(plantings, site.beds);
      const claim = prose.find((p) => /peaking around|\b\d+(?:\.\d+)?\s*kg\s+(?:in|that)\s+month|\bR\s*\d+(?:\.\d+)?\s+(?:in|that)\s+month/i.test(p));
      return claim ? [`unsupported monthly claim: ${claim}`] : [];
    },
  },
  {
    name: 'the multi-month cohort sentence never overclaims beds or harvest continuity',
    run: (site, plantings) => {
      const line = buildYearReport(plantings, site.beds).find((p) => p.includes('crops in multiple sowing months'));
      if (!line) return [];
      const claimed = Number(/; (\d+) other bed/.exec(line)?.[1] ?? 0) + 1;
      const out: string[] = [];
      if (claimed > site.beds.length) out.push(`claims ${claimed} multi-month beds, farm has ${site.beds.length}`);
      if (/few weeks|harvests keep coming|continuous harvest/i.test(line)
        && !/not a guarantee of uninterrupted harvest/i.test(line)) {
        out.push('month-level rows claim continuous harvest');
      }
      return out;
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
    name: 'every final-stand range is reproducible without inventing seed or midpoint pieces',
    run: (site, plantings) => {
      const out: string[] = [];
      for (const row of seedBoqForPlan(plantings, site.beds)) {
        const crop = cropByKey(row.cropKey);
        if (!crop) continue;
        const density = plantsPerM2Range(crop);
        const rawByMonth = new Map<number, { minimum: number; maximum: number }>();
        for (const planting of plantings.filter((p) => p.cropKey === row.cropKey && !p.existing)) {
          const area = (site.beds.find((b) => b.id === planting.bedId)?.areaM2 ?? 0) * (planting.areaFraction ?? 1);
          const month = wrapMonth(planting.sowMonth);
          const prior = rawByMonth.get(month) ?? { minimum: 0, maximum: 0 };
          rawByMonth.set(month, {
            minimum: prior.minimum + area * density[0],
            maximum: prior.maximum + area * density[1],
          });
        }
        const expectedRange = [...rawByMonth.values()].reduce<[number, number]>(
          (sum, raw) => [
            sum[0] + Math.max(1, Math.floor(raw.minimum)),
            sum[1] + Math.max(1, Math.ceil(raw.maximum)),
          ],
          [0, 0],
        );
        if (row.finalPlantPositionsRange[0] !== expectedRange[0]
          || row.finalPlantPositionsRange[1] !== expectedRange[1]) {
          out.push(`${row.cropKey}: bill ${positionRangeLabel(row.finalPlantPositionsRange)}, spacing implies ${positionRangeLabel(expectedRange)}`);
        }
        if (row.quantityStatus === 'counted-pieces') {
          if (row.unit === 'seeds') out.push(`${row.cropKey}: botanical seed was mislabeled as counted planting pieces`);
          if (expectedRange[0] !== expectedRange[1] || row.count !== expectedRange[0] || row.countRange !== null) {
            out.push(`${row.cropKey}: exact piece quantity disagrees with exact spacing`);
          }
        } else if (row.quantityStatus === 'counted-piece-range') {
          if (row.unit === 'seeds') out.push(`${row.cropKey}: botanical seed was mislabeled as a planting-piece range`);
          if (row.count !== null || row.countRange?.[0] !== expectedRange[0]
            || row.countRange?.[1] !== expectedRange[1] || expectedRange[0] === expectedRange[1]) {
            out.push(`${row.cropKey}: living material used a midpoint instead of ${positionRangeLabel(expectedRange)}`);
          }
        } else if (row.quantityStatus === 'packet-rate-required') {
          if (row.unit !== 'seeds') out.push(`${row.cropKey}: a non-seed material was sent to the packet-rate path`);
          if (row.count !== null || row.countRange !== null) out.push(`${row.cropKey}: mature spacing was misreported as seed to buy`);
        } else {
          if (crop.fieldSpacingVerified !== false) out.push(`${row.cropKey}: a verified spacing was incorrectly withheld`);
          if (row.count !== null || row.countRange !== null) out.push(`${row.cropKey}: unverified spacing produced an order quantity`);
        }
      }

      for (const item of buildBuyingSchedule(plantings, site.beds, site.nowMonth)
        .flatMap((month) => month.items)) {
        if (item.quantityStatus !== 'spacing-confirmation-required'
          && !item.note.includes(positionRangeLabel(item.finalPlantPositionsRange))) {
          out.push(`${item.cropKey}: buying note omits its ${positionRangeLabel(item.finalPlantPositionsRange)} position range`);
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
            if (/rows\s+\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?cm\s+apart/.test(row.work)) {
              out.push(`month ${m}: nursery row quotes field spacing`);
            }
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

/** A deliberately narrow maximality oracle. With one supported, year-round
 * crop, one bed, reliable water, no rotation constraint and a commercial
 * whole-bed goal, leaving the only bed wholly or partly unallocated has no
 * competing-crop explanation. Passing this does NOT prove a global annual
 * optimum across crops, labour, nutrition, markets or irregular geometry. */
function oneCropOneBedAllocationFailures(): string[] {
  const failures: string[] = [];
  for (const areaM2 of BED_AREAS) {
    for (const nowMonth of NOW_MONTHS) {
      const bed: PlanBed = { id: 'only-bed', label: 'Only bed', areaM2, minDimM: 1.2 };
      const result = autoSuggestPlan({
        goal: 'commercial',
        focusCropCount: 1,
        groups: [],
        cropKeys: ['cabbage'],
        rhythm: 'few-big',
        rotateCrops: false,
        allowVinesInBeds: false,
        reliableIrrigation: true,
      }, 'mild-frost', [bed], [], nowMonth);
      if (result.plantings.length === 0) {
        failures.push(`${areaM2}m² now=${nowMonth}: supported one-crop fixture left empty`);
      } else if (result.plantings.some((planting) => (planting.areaFraction ?? 1) < 0.999)) {
        failures.push(`${areaM2}m² now=${nowMonth}: only crop was assigned a partial bed`);
      }
    }
  }
  return failures;
}

/** Existing history is one absolute cohort, not an annual template. This
 * fixture is the boundary case that month-of-year folding got wrong. */
function historicalCohortOffsetFailures(): string[] {
  const bed: PlanBed = { id: 'history-bed', label: 'History bed', areaM2: 9, minDimM: 3 };
  const result = autoSuggestPlan({
    goal: 'family',
    groups: [],
    cropKeys: ['green-beans'],
    rhythm: 'few-big',
    rotateCrops: true,
    allowVinesInBeds: false,
    allowMixedCropsInBed: false,
    reliableIrrigation: true,
  }, 'mild-frost', [bed], [{
    id: 'observed-cabbage',
    bedId: bed.id,
    cropKey: 'cabbage',
    sowMonth: 8,
    existing: true,
  }], 11);
  return result.plantings.some((planting) =>
    planting.cropKey === 'green-beans'
      && planting.sowMonth === 9
      && planting.areaFraction === undefined)
    ? []
    : [`expected full-bed green-beans in September; got ${result.plantings
      .map((planting) => `${planting.cropKey}@${planting.sowMonth}:${planting.areaFraction ?? 1}`)
      .join(', ') || 'nothing'}`];
}

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
    plantings = autoSuggestPlan(
      site.answers,
      site.pattern,
      site.beds,
      site.existingPlantings,
      site.nowMonth,
    ).plantings;
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
console.log(`mean veg-bed utilisation (descriptive; not an optimality proof): ${(usedBedMonths / bedMonths * 100).toFixed(1)}%`);
console.log('');

let failed = 0;
for (const check of CHECKS) {
  const t = byCheck.get(check.name)!;
  const ok = t.violations === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${pad(check.name, 58)} ${ok ? '' : `${t.violations.toLocaleString()} in ${t.sites.toLocaleString()} farms`}`);
  for (const s of t.sample) console.log(`        ${s}`);
}

const localAllocationFailures = oneCropOneBedAllocationFailures();
if (localAllocationFailures.length) failed++;
console.log(`${localAllocationFailures.length === 0 ? 'PASS' : 'FAIL'}  ${pad('a supported one-crop fixture allocates its only bed', 58)} ${localAllocationFailures.length === 0 ? '' : `${localAllocationFailures.length} fixtures`}`);
for (const failure of localAllocationFailures.slice(0, 3)) console.log(`        ${failure}`);

const historicalOffsetFailures = historicalCohortOffsetFailures();
if (historicalOffsetFailures.length) failed++;
console.log(`${historicalOffsetFailures.length === 0 ? 'PASS' : 'FAIL'}  ${pad('one-off crop history does not repeat into next September', 58)} ${historicalOffsetFailures.length === 0 ? '' : `${historicalOffsetFailures.length} fixtures`}`);
for (const failure of historicalOffsetFailures.slice(0, 3)) console.log(`        ${failure}`);

if (byBedCount.size) {
  console.log('\nviolations by farm size:');
  for (const [n, m] of [...byBedCount].sort((a, b) => a[0] - b[0])) {
    const total = [...m.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${String(n).padStart(2)} beds: ${String(total).padStart(6)}   ${[...m].map(([k, v]) => `${k.slice(0, 28)}=${v}`).join('  ')}`);
  }
}

console.log('');
console.log(failed === 0 ? 'ALL CHECKS CLEAN' : `${failed} of ${CHECKS.length + 2} checks found something`);
process.exit(failed === 0 ? 0 : 1);
