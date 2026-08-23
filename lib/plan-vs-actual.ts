// The measured harvest set beside the crop plan's benchmark, per crop.
//
// Rory asked for "actual production verse estimate verse estimated loss". This is
// the data behind that chart, and it is built on exactly the same
// buildReconciliation() call the Harvest Reconciliation card already prints as
// text — deliberately. Drawing bars from a second, parallel derivation is how two
// cards on one screen end up disagreeing about one farm; the chart is a different
// rendering of the same rows, not a different calculation.
//
// WHY THIS IS YEAR-ONLY, and why that is not a limitation to route around:
//
// The plan's benchmark is a CROP-CYCLE total. lib/crop-plan.ts states it plainly —
// the catalog gives a cycle yield, not a within-window picking curve — so there is
// no honest way to ask "what should I have picked in May". CropRow.intendedKg is
// null for month and season for that reason, and a chart that quietly filled those
// months with benchmark/12 would be inventing the exact curve the rest of this
// codebase refuses to invent. So: at month and season this returns no rows and
// says why, and the UI offers the year instead of drawing something.
//
// AND WHY A SHORT BAR IS NOT AN ACCUSATION. Planting carries no sowing year and no
// completed-cycle marker, so a benchmark of 50 kg beside 8 kg logged does not prove
// a missed harvest: the cycle may not be finished, or the picking may simply not
// have been written down. That is why yieldGap is hardcoded false upstream and why
// the caption this data feeds must call the benchmark a benchmark and never "what
// you should have got by now".

import { buildReconciliation, type Period } from './harvest-reconciliation';
import type { PlanBed, Planting, CashflowSettings } from './crop-plan';
import type { ProductionLog, SalesLog } from './db/types';

export interface PlanVsActualRow {
  cropKey: string;
  cropName: string;
  icon: string;
  /** One complete crop-plan cycle, area-scaled. Always > 0 — a null benchmark is not a row. */
  benchmarkKg: number;
  /**
   * benchmark less the farmer's own loss allowance — the part they told the app
   * they expect to actually get. Null until the sliders are confirmed, because
   * until then 25% is a national literature default and not this farm's figure.
   */
  afterLossKg: number | null;
  harvestedKg: number;
  soldKg: number;
  /** Sold more than was logged picked, so the harvest bar is known to be short. */
  soldExceedsHarvested: boolean;
}

export interface PlanVsActual {
  rows: PlanVsActualRow[];
  /** False for month and season, where no defensible benchmark exists. */
  availableForPeriod: boolean;
  lossPercent: number;
  /** The loss allowance has been reviewed by the farmer. */
  lossConfirmed: boolean;
  /** Crops that were harvested or sold but are not in the plan — charted separately or not at all. */
  offPlanNames: string[];
  /** Planted crops the catalog has no verified yield for. Excluded, never drawn as zero. */
  unbenchmarkedCropNames: string[];
}

const EMPTY: Omit<PlanVsActual, 'availableForPeriod' | 'lossPercent' | 'lossConfirmed'> = {
  rows: [],
  offPlanNames: [],
  unbenchmarkedCropNames: [],
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export function buildPlanVsActual(
  plantings: Planting[],
  beds: PlanBed[],
  production: ProductionLog[],
  sales: SalesLog[],
  period: Period,
  now: Date,
  settings: CashflowSettings,
): PlanVsActual {
  const lossPercent = clampPercent(settings.lossPercent);
  const lossConfirmed = settings.confirmed === true;

  if (period !== 'year') {
    return { ...EMPTY, availableForPeriod: false, lossPercent, lossConfirmed };
  }

  const result = buildReconciliation(plantings, beds, production, sales, period, now);

  // notYetHarvested is where a benchmark crop with no logs lands. Including it is
  // the point: a planned crop with nothing recorded against it is the single most
  // useful bar on this chart, and dropping it would quietly flatter the farm.
  const candidates = [...result.matched, ...result.notYetHarvested];

  const rows: PlanVsActualRow[] = [];
  const unbenchmarked: string[] = [];
  for (const row of candidates) {
    if (row.intendedKg === null || !Number.isFinite(row.intendedKg) || row.intendedKg <= 0) {
      // No verified kg/m² for this crop. Absence of a benchmark is not a
      // benchmark of zero, so it is named rather than plotted at the origin.
      if (!unbenchmarked.includes(row.cropName)) unbenchmarked.push(row.cropName);
      continue;
    }
    rows.push({
      cropKey: row.cropKey,
      cropName: row.cropName,
      icon: row.icon,
      benchmarkKg: row.intendedKg,
      afterLossKg: lossConfirmed ? row.intendedKg * (1 - lossPercent / 100) : null,
      harvestedKg: row.harvestedKg,
      soldKg: row.soldKg,
      soldExceedsHarvested: row.soldExceedsHarvested,
    });
  }

  // Biggest benchmark first: the crops the plan is actually betting the season on
  // are the ones worth reading, and a chart sorted by outcome would reorder itself
  // every time a farmer logged a harvest.
  rows.sort((a, b) => b.benchmarkKg - a.benchmarkKg);

  return {
    rows,
    availableForPeriod: true,
    lossPercent,
    lossConfirmed,
    offPlanNames: result.unplannedActivity.map((row) => row.label),
    unbenchmarkedCropNames: unbenchmarked,
  };
}
