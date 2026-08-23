// Coming up — what the plan says is due to be picked, and when.
//
// WHY THIS SHAPE AND NOT A MONTHLY KG CURVE. The obvious thing to build for a
// finance screen is a bar per month: "March 40 kg, April 55 kg". The app cannot
// honestly draw that. Every kilogram in this system comes from a crop-CYCLE
// benchmark (kg/m² for one growing of the crop), and lib/crop-plan.ts says so
// in as many words where PlanYieldBenchmark.knownKg is defined: it is
// "deliberately not assigned to calendar months … the source gives a crop-cycle
// yield, not a within-window picking curve". Spreading a cycle yield across its
// picking window would be inventing that curve, and the invention would look
// exactly like data.
//
// So this book is a list of HARVESTS, not a timeline of kilograms. Each row is
// one crop on one bed, with the whole cycle's kilograms attached to the month
// its picking STARTS, and the picking window stated beside it. A month's total
// therefore means "the pickings that begin this month come to about X kg in
// total", which is true, rather than "you will pick X kg during this month",
// which nobody can know. The card that renders this has to say that in words.
//
// It is a plan, not a promise, and the numbers are already conservative
// benchmarks — see the truth-audit note in docs/ and every yield comment in
// lib/crop-catalog.ts.

import type { CropDef } from '@/lib/crop-catalog';
import { cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import {
  benchmarkAreaConflictDetails,
  estimatedYieldKgAdjusted,
  harvestEndMonthForCrop,
  harvestMonthForCrop,
  nonFoodCropNames,
  plantingIsActiveOrPlanned,
  unverifiedYieldCropNames,
} from '@/lib/crop-plan';

export interface ForwardHarvest {
  /** Stable across rebuilds — the planting it came from. */
  plantingId: string;
  cropKey: string;
  name: string;
  icon: string;
  bedLabel: string;
  /** True when the ground is a field-scale staple plot rather than a worked bed. */
  onPlot: boolean;
  /** 1-12. The month picking starts, and the month this row's kilograms sit in. */
  startMonth: number;
  /** 1-12. The last month of the picking window; equals startMonth for a single-pick crop. */
  endMonth: number;
  /** Calendar year the picking starts in — this book is dated, not a 12-month wheel. */
  startYear: number;
  /** 0 = this month, 1 = next month, … Never negative. */
  monthsAhead: number;
  /** The whole cycle's benchmark kilograms, attached to startMonth. See the module note. */
  kg: number;
}

export interface ForwardHarvestMonth {
  month: number;
  year: number;
  /** "Sep 2026" */
  label: string;
  monthsAhead: number;
  harvests: ForwardHarvest[];
  /** Sum of the cycle kilograms whose picking STARTS this month. */
  kg: number;
}

export interface ForwardHarvestBook {
  horizonMonths: number;
  months: ForwardHarvestMonth[];
  /** Every row, soonest first. */
  harvests: ForwardHarvest[];
  totalKg: number;
  /**
   * Food crops in the plan whose catalog entry has no verified kg/m². They are
   * EXCLUDED from every kilogram above — absence of a benchmark is not 0 kg —
   * and named so the screen can say what it left out.
   */
  excludedCropNames: string[];
  /** Soil covers, which correctly contribute no food kilograms. */
  nonFoodCropNames: string[];
  /**
   * Beds whose saved crop shares overlap. While this is non-empty EVERY kg here
   * is withheld (zeroed rows, empty months), matching buildPlanYieldBenchmark's
   * refusal to total a plan it cannot divide — guessing which crop loses the
   * land would turn a draft layout into a false forecast.
   */
  areaConflictBedLabels: string[];
}

const wrap12 = (m: number): number => ((m - 1) % 12 + 12) % 12 + 1;

/**
 * How many months from `now` until the next occurrence of calendar month `m`.
 * 0 when it is this month. The plan is an annual cycle, so "the next March" is
 * always within twelve months.
 */
function monthsUntil(m: number, nowMonth: number): number {
  return ((m - nowMonth) % 12 + 12) % 12;
}

/**
 * Build the forward book.
 *
 * `now` is a real Date because this book is DATED — a 12-month wheel was the
 * thing it had to stop being. `horizonMonths` counts inclusive months from the
 * current one (3 = this month and the next two); anything past twelve would
 * start repeating the annual cycle, so it is capped there.
 */
export function buildForwardHarvests(
  plantings: readonly Planting[],
  beds: readonly PlanBed[],
  now: Date,
  horizonMonths: number,
): ForwardHarvestBook {
  const horizon = Math.max(1, Math.min(12, Math.floor(horizonMonths)));
  const nowMonth = now.getMonth() + 1;
  const nowYear = now.getFullYear();

  const bedById = new Map(beds.map((b) => [b.id, b]));
  const mapped = plantings.filter(
    (p) => bedById.has(p.bedId) && plantingIsActiveOrPlanned(p, nowMonth),
  );
  const areaConflictBedLabels = benchmarkAreaConflictDetails(
    mapped as Planting[], beds as PlanBed[], nowMonth,
  ).map((c) => c.bedLabel);

  const harvests: ForwardHarvest[] = [];
  if (areaConflictBedLabels.length === 0) {
    for (const p of mapped) {
      const crop = cropByKey(p.cropKey);
      const bed = bedById.get(p.bedId);
      if (!crop || !bed) continue;
      // The same two gates buildFoodAvailability applies: a cover crop is not
      // food, and a crop whose timing the catalog does not vouch for cannot be
      // put on a date at all.
      if (crop.timingVerified === false) continue;
      if (crop.yieldKgPerM2 === null || crop.yieldKgPerM2 === 0) continue;

      const kg = estimatedYieldKgAdjusted(p, bed.areaM2, mapped as Planting[]);
      if (!(kg > 0)) continue;

      const startMonth = harvestMonthForCrop(p.sowMonth, crop as Pick<CropDef, 'daysToHarvest' | 'transplant'>);
      const monthsAhead = monthsUntil(startMonth, nowMonth);
      if (monthsAhead >= horizon) continue;

      harvests.push({
        plantingId: p.id,
        cropKey: p.cropKey,
        name: crop.name,
        icon: crop.icon ?? '🌱',
        bedLabel: bed.label,
        onPlot: bed.kind === 'plot',
        startMonth,
        endMonth: harvestEndMonthForCrop(p.sowMonth, crop),
        // The plan repeats annually, so the next occurrence of a month earlier in
        // the year than today's is next year's.
        startYear: nowYear + (startMonth < nowMonth ? 1 : 0),
        monthsAhead,
        kg,
      });
    }
  }

  harvests.sort((a, b) => a.monthsAhead - b.monthsAhead || b.kg - a.kg || a.name.localeCompare(b.name));

  const months: ForwardHarvestMonth[] = [];
  for (let ahead = 0; ahead < horizon; ahead++) {
    const month = wrap12(nowMonth + ahead);
    const year = nowYear + (month < nowMonth ? 1 : 0);
    const rows = harvests.filter((h) => h.monthsAhead === ahead);
    months.push({
      month,
      year,
      label: `${MONTHS_SHORT[month - 1]} ${year}`,
      monthsAhead: ahead,
      harvests: rows,
      kg: rows.reduce((sum, r) => sum + r.kg, 0),
    });
  }

  return {
    horizonMonths: horizon,
    months,
    harvests,
    totalKg: harvests.reduce((sum, h) => sum + h.kg, 0),
    excludedCropNames: unverifiedYieldCropNames(mapped as Planting[]),
    nonFoodCropNames: nonFoodCropNames(mapped as Planting[]),
    areaConflictBedLabels,
  };
}

/** The crop-kg rows this book implies, for lib/plan-value.ts. Aggregated by crop. */
export function forwardValueRows(book: ForwardHarvestBook): Array<{ cropKey: string; name: string; kg: number }> {
  const totals = new Map<string, { name: string; kg: number }>();
  for (const h of book.harvests) {
    const cur = totals.get(h.cropKey);
    if (cur) cur.kg += h.kg;
    else totals.set(h.cropKey, { name: h.name, kg: h.kg });
  }
  return [...totals.entries()]
    .map(([cropKey, v]) => ({ cropKey, name: v.name, kg: v.kg }))
    .sort((a, b) => b.kg - a.kg);
}
