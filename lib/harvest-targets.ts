import { cropByKey, hasAutomaticPlanningBasis } from './crop-catalog';
import {
  benchmarkDatedAreaConflictPlantingIds, datedPlantingSowIndex, estimatedYieldKg,
  harvestTargetMonthIndex, planningMaturityMonths, sanitiseHarvestTargets,
  harvestTargetWeeklyKg, harvestTargetYieldFactor, isMonthlyHarvestTarget, resolveHarvestTargetDateWindow,
  TRANSPLANT_ENTRY_EARLIEST_MONTHS, TRANSPLANT_ENTRY_PLANNED_MONTHS,
  type HarvestTarget, type KgHarvestTarget, type MonthlyHarvestTarget, type PlanBed, type Planting,
} from './crop-plan';
import { COVERAGE_TOLERANCE_KG, type HarvestTargetCoverage } from './harvest-target-coverage';

export const HARVEST_TARGET_BASIS = 'Crop-cycle capacity uses the catalogue’s South African planning yields and picking windows. It does not forecast kilograms each week. Check local suitability, losses and actual harvest records before promising deliveries.';

export interface HarvestTargetAssessment {
  target: MonthlyHarvestTarget;
  demandKg: number | null;
  days: number;
  /** Area summed across crop cycles, not a claim about simultaneous land. */
  cycleAreaM2: number | null;
  allocatedKg: number;
  grossCycleKg: number;
  shortageKg: number | null;
  surplusKg: number | null;
  pickingMonths: string[];
  gapMonths: string[];
  excludedRows: number;
  /**
   * Credited crop cycles that could be READY BEFORE THE WINDOW OPENS, and the earliest
   * month one of them could be (a targetMonthStamp), or null when none could.
   *
   * The picking months above are the LATE edge on purpose: the upper published
   * duration, rounded up to a whole month, after a two-month nursery. That is the right
   * caution for releasing a bed and the wrong one for a delivery date. The 10 November
   * 2026 accuracy audit measured it against the catalogue's own duration ranges: one
   * month later than a typical season for 30 crops, two for six, three for cabbage and
   * cauliflower (CP-079). A cabbage sown in January is credited to an August order and
   * will usually be ready from May.
   *
   * This does not change what is credited. It lets the screen say so.
   */
  earlyCycles: number;
  earliestReadyMonth: string | null;
  /**
   * The same target counted WITHOUT the cycles that could be ready early: the capacity
   * left (after the saleable share), and the requested months whose only linked picking
   * window comes from such a cycle. Nothing here changes what is credited above
   * (Rory, 11 November 2026: keep the credit, say when it rests on a possibly-early crop).
   */
  onTimeAllocatedKg: number;
  earlyOnlyMonths: string[];
  /**
   * One word for the card. 'covered-may-be-early' means the target is met on paper only
   * because of cycles that could be ready before the buyer's window opens: without them
   * it would be short, or a requested month would have no picking window.
   * 'not-assessed' when the basis is missing, so no capacity was worked out.
   */
  coverage: HarvestTargetCoverage;
  missingBasis: boolean;
  missingReasons: ('crop-evidence' | 'unit-weight' | 'zero-saleable-share')[];
}

type KnownMassAssessment = HarvestTargetAssessment & { demandKg: number; shortageKg: number; surplusKg: number };

export function targetMonthStamp(index: number): string {
  return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;
}

export function targetDemand(target: KgHarvestTarget): { demandKg: number; days: number } | null;
export function targetDemand(target: HarvestTarget): { demandKg: number | null; days: number } | null;
export function targetDemand(target: HarvestTarget): { demandKg: number | null; days: number } | null {
  const saved = sanitiseHarvestTargets([target])[0];
  if (!saved) return null;
  const window = resolveHarvestTargetDateWindow(saved);
  if (!window) return null;
  const { days } = window;
  const weeklyKg = harvestTargetWeeklyKg(saved);
  return { days, demandKg: weeklyKg === null ? null : weeklyKg * days / 7 };
}

/** Credit a whole cycle only when its entire planning picking window fits.
 * Prorating an overlapping cycle would invent a within-cycle harvest curve. */
export function targetPickingWindow(planting: Planting, target: HarvestTarget): number[] {
  // Month-based catalogue windows cannot establish an exact dated buyer window.
  if (!isMonthlyHarvestTarget(target)) return [];
  const crop = cropByKey(planting.cropKey);
  const start = harvestTargetMonthIndex(target.startMonth);
  const end = harvestTargetMonthIndex(target.endMonth);
  if (!crop || !hasAutomaticPlanningBasis(crop) || start === null || end === null
    || planting.cropKey !== target.cropKey || planting.awaitingSowingConfirmation
    || planting.finishedOnceSowing || !(planting.once ?? planting.confirmedOnceSowing)) return [];
  const sow = datedPlantingSowIndex(planting, start);
  if (sow === null) return [];
  const first = sow + planningMaturityMonths(crop.daysToHarvest)
    + (crop.transplant ? TRANSPLANT_ENTRY_PLANNED_MONTHS : 0);
  const last = first + (crop.harvestWindowMonths ?? 0);
  if (first < start || last > end) return [];
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

/**
 * The earliest month a sowing could plausibly give its first harvest: the LOWER end of
 * the published duration counted in whole months already elapsed, after the shortest
 * nursery period the planner allows. Seed sown on the first of a month with a 60-day
 * crop is ready two months later, so the offset rounds DOWN, where the planning month
 * rounds up. Null for a row that is not a dated sowing of a known crop.
 */
export function earliestReadyMonthIndex(planting: Planting, originIndex: number): number | null {
  const crop = cropByKey(planting.cropKey);
  const sow = datedPlantingSowIndex(planting, originIndex);
  if (!crop || sow === null) return null;
  const shortestDays = crop.daysToHarvestRange?.[0] ?? crop.daysToHarvest;
  if (!Number.isFinite(shortestDays) || shortestDays <= 0) return null;
  return sow + Math.floor(shortestDays / 30) + (crop.transplant ? TRANSPLANT_ENTRY_EARLIEST_MONTHS : 0);
}

export function assessHarvestTarget(
  target: KgHarvestTarget, beds: PlanBed[], plantings: Planting[], now?: { year: number; month: number },
): KnownMassAssessment | null;
export function assessHarvestTarget(
  target: HarvestTarget, beds: PlanBed[], plantings: Planting[], now?: { year: number; month: number },
): HarvestTargetAssessment | null;
export function assessHarvestTarget(
  target: HarvestTarget, beds: PlanBed[], plantings: Planting[],
  now = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
): HarvestTargetAssessment | null {
  if (!isMonthlyHarvestTarget(target)) return null;
  const demand = targetDemand(target);
  if (!demand) return null;
  const crop = cropByKey(target.cropKey)!;
  const factor = harvestTargetYieldFactor(target);
  const missingReasons: HarvestTargetAssessment['missingReasons'] = [];
  if (!hasAutomaticPlanningBasis(crop)) missingReasons.push('crop-evidence');
  if (demand.demandKg === null) missingReasons.push('unit-weight');
  if (factor === 0) missingReasons.push('zero-saleable-share');
  const missingBasis = missingReasons.length > 0;
  const bedById = new Map(beds.map((bed) => [bed.id, bed]));
  const originIndex = now.year * 12 + now.month - 1;
  const linked = plantings.filter((p) => p.harvestTargetId === target.id);
  const startIndex = Math.min(harvestTargetMonthIndex(target.startMonth)!,
    ...linked.filter((p) => targetPickingWindow(p, target).length > 0)
      .map((p) => datedPlantingSowIndex(p, originIndex)).filter((n): n is number => n !== null));
  const conflicts = benchmarkDatedAreaConflictPlantingIds(plantings, beds, {
    startIndex, endIndex: harvestTargetMonthIndex(target.endMonth)! + 1, originIndex,
  });
  const picking = new Set<number>();
  const windowStart = harvestTargetMonthIndex(target.startMonth)!;
  const onTimePicking = new Set<number>();
  let grossCycleKg = 0;
  let onTimeGrossKg = 0;
  let excludedRows = 0;
  let earlyCycles = 0;
  let earliestReady: number | null = null;
  for (const row of linked) {
    const bed = bedById.get(row.bedId);
    const window = targetPickingWindow(row, target);
    const fraction = row.areaFraction ?? 1;
    if (!bed || !Number.isFinite(bed.areaM2) || bed.areaM2 <= 0
      || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1
      || (bed.kind === 'plot' && fraction !== 1) || conflicts.has(row.id) || !window.length) {
      excludedRows++;
      continue;
    }
    const kg = estimatedYieldKg(row, bed.areaM2);
    if (!Number.isFinite(kg) || !Number.isFinite(grossCycleKg + kg)) { excludedRows++; continue; }
    grossCycleKg += kg;
    window.forEach((month) => picking.add(month));
    const ready = earliestReadyMonthIndex(row, windowStart);
    if (ready !== null && ready < windowStart) {
      earlyCycles++;
      earliestReady = earliestReady === null ? ready : Math.min(earliestReady, ready);
    } else {
      onTimeGrossKg += kg;
      window.forEach((month) => onTimePicking.add(month));
    }
  }
  const start = harvestTargetMonthIndex(target.startMonth)!;
  const end = harvestTargetMonthIndex(target.endMonth)!;
  const months = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const allocatedKg = grossCycleKg * factor;
  const onTimeAllocatedKg = onTimeGrossKg * factor;
  const gapMonths = months.filter((m) => !picking.has(m));
  const earlyOnlyMonths = months.filter((m) => picking.has(m) && !onTimePicking.has(m));
  const shortageKg = demand.demandKg === null ? null : Math.max(0, demand.demandKg - allocatedKg);
  const coverage: HarvestTargetCoverage = missingBasis || shortageKg === null ? 'not-assessed'
    : shortageKg > COVERAGE_TOLERANCE_KG || gapMonths.length > 0 ? 'short'
      : demand.demandKg! - onTimeAllocatedKg > COVERAGE_TOLERANCE_KG || earlyOnlyMonths.length > 0 ? 'covered-may-be-early'
        : 'covered';
  return {
    target, ...demand, missingBasis, missingReasons,
    cycleAreaM2: missingBasis ? null : demand.demandKg! / (crop.yieldKgPerM2! * factor),
    allocatedKg, grossCycleKg,
    shortageKg,
    surplusKg: demand.demandKg === null ? null : Math.max(0, allocatedKg - demand.demandKg), excludedRows,
    earlyCycles, earliestReadyMonth: earliestReady === null ? null : targetMonthStamp(earliestReady),
    onTimeAllocatedKg, earlyOnlyMonths: earlyOnlyMonths.map(targetMonthStamp), coverage,
    pickingMonths: months.filter((m) => picking.has(m)).map(targetMonthStamp),
    gapMonths: gapMonths.map(targetMonthStamp),
  };
}
