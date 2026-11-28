import { HARVEST_TARGET_WEEK_DAYS, harvestTargetUnit, harvestTargetWeekWindows, validHarvestTargetWeekQuantity,
  type HarvestTarget, type Planting } from '../crop-plan';
import { validRecordQuantity, type RecordUnit } from '../farm-records';
import { addGrowerUtcDays, type GrowerDateEstimate } from './grower-planning';
import type { GrowerCycleContext } from './grower-cycle';
import { projectGrowerCycles } from './grower-cycle-projection';

export interface WeeklyProductionWindow {
  readonly start: string;
  readonly endExclusive: string;
}

export interface WeeklyProductionCycle {
  readonly siteId: string;
  readonly plantingId: string | null;
  readonly targetId: string | null;
  readonly bedId: string;
  readonly cropKey: string;
  readonly basis: 'accepted' | 'worked-example';
  readonly schedule: GrowerDateEstimate;
  readonly wholeCycleKg: number;
}

export interface WeeklyProductionOrder extends WeeklyProductionWindow {
  readonly fullWeek: boolean;
  readonly unit: RecordUnit;
  readonly requested: number | null;
  readonly planned: number | null;
  readonly planningGap: number | null;
  readonly picking: readonly (WeeklyProductionWindow & { readonly bedId: string; readonly basis: WeeklyProductionCycle['basis'] })[];
  readonly daysWithoutPicking: number;
}

export function weeklyAcceptedCycles(
  siteId: string, plantings: readonly Planting[], context: GrowerCycleContext | null, targetSiteId = siteId,
): WeeklyProductionCycle[] {
  if (context?.scope?.kind !== 'mapped-site' || context.scope.siteId !== siteId) return [];
  return projectGrowerCycles(plantings, context).ownCycles.map(cycle => ({
    siteId: targetSiteId, bedId: cycle.bedId, cropKey: cycle.cropKey, plantingId: cycle.plantingId,
    basis: 'accepted', schedule: cycle.assessment.schedule, wholeCycleKg: cycle.totalCycleKg,
    targetId: cycle.origin?.status === 'recorded' && cycle.origin.origin.kind === 'buyer-target'
      ? cycle.origin.origin.harvestTargetId : null,
  }));
}

export function weeklyProductionOrders(
  target: HarvestTarget,
  cycles: readonly WeeklyProductionCycle[],
): WeeklyProductionOrder[] {
  const unit = harvestTargetUnit(target);
  const rate = target.weeklyKg ?? target.weeklyQuantity;
  if (!validRecordQuantity(rate, unit)) return [];
  const relevant = cycles.filter(cycle => cycle.targetId === target.id && cycle.siteId === target.siteId
    && cycle.cropKey === target.cropKey);
  return harvestTargetWeekWindows(target).map(({ start, endExclusive, fullWeek }) => {
    const entries = target.weeklyPlan?.filter(entry => entry.start === start && entry.endExclusive === endExclusive) ?? [];
    const [entry] = entries;
    const planned = entries.length === 1 && entry.unit === unit
      && validHarvestTargetWeekQuantity(entry.quantity, unit) ? entry.quantity : null;
    const picking = relevant.flatMap(cycle => {
      const schedule = cycle.schedule;
      const pickStart = schedule.firstHarvestDate > start ? schedule.firstHarvestDate : start;
      const pickEnd = schedule.harvestEndExclusiveDate < endExclusive ? schedule.harvestEndExclusiveDate : endExclusive;
      return pickStart < pickEnd
        ? [{ start: pickStart, endExclusive: pickEnd, bedId: cycle.bedId, basis: cycle.basis }] : [];
    });
    let daysWithoutPicking = 0;
    for (let offset = 0; offset < HARVEST_TARGET_WEEK_DAYS; offset++) {
      const day = addGrowerUtcDays(start, offset);
      if (!day || day >= endExclusive) break;
      if (!picking.some(interval => interval.start <= day && day < interval.endExclusive)) daysWithoutPicking++;
    }
    return {
      start, endExclusive, fullWeek, unit, requested: fullWeek ? rate : null, planned,
      planningGap: fullWeek && planned !== null ? Math.max(0, rate - planned) : null,
      picking, daysWithoutPicking,
    };
  });
}
