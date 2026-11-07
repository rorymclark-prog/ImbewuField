import { cropByKey, hasAutomaticPlanningBasis } from './crop-catalog';
import {
  benchmarkDatedAreaConflictPlantingIds, datedPlantingSowIndex, estimatedYieldKg,
  harvestTargetMonthIndex, planningMaturityMonths, sanitiseHarvestTargets,
  harvestTargetWeeklyKg, harvestTargetYieldFactor, isMonthlyHarvestTarget, resolveHarvestTargetDateWindow,
  TRANSPLANT_ENTRY_PLANNED_MONTHS,
  type HarvestTarget, type KgHarvestTarget, type MonthlyHarvestTarget, type PlanBed, type Planting,
} from './crop-plan';

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
  let grossCycleKg = 0;
  let excludedRows = 0;
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
  }
  const start = harvestTargetMonthIndex(target.startMonth)!;
  const end = harvestTargetMonthIndex(target.endMonth)!;
  const months = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  const allocatedKg = grossCycleKg * factor;
  return {
    target, ...demand, missingBasis, missingReasons,
    cycleAreaM2: missingBasis ? null : demand.demandKg! / (crop.yieldKgPerM2! * factor),
    allocatedKg, grossCycleKg,
    shortageKg: demand.demandKg === null ? null : Math.max(0, demand.demandKg - allocatedKg),
    surplusKg: demand.demandKg === null ? null : Math.max(0, allocatedKg - demand.demandKg), excludedRows,
    pickingMonths: months.filter((m) => picking.has(m)).map(targetMonthStamp),
    gapMonths: months.filter((m) => !picking.has(m)).map(targetMonthStamp),
  };
}
