import { resolveHarvestTargetDateWindow, type HarvestTarget } from '../crop-plan';
import { validRecordQuantity, type RecordUnit } from '../farm-records';
import { GROWER_BUYER_PICKING_PERIOD_DAYS } from './grower-harvest-demand';
import { addGrowerUtcDays, type GrowerDateEstimate } from './grower-planning';

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

/** An entered plan for this buyer's exact period and unit. It is independent
 * of the crop-cycle estimate and says nothing about actual delivery. */
export interface WeeklyProductionAllocation extends WeeklyProductionWindow {
  readonly siteId: string;
  readonly targetId: string;
  readonly cropKey: string;
  readonly unit: RecordUnit;
  readonly quantity: number;
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

export function weeklyOrderUnit(target: HarvestTarget): RecordUnit {
  return target.weeklyKg !== undefined ? 'kg' : target.unit;
}

export function weeklyProductionOrders(
  target: HarvestTarget,
  cycles: readonly WeeklyProductionCycle[],
  allocations: readonly WeeklyProductionAllocation[],
): WeeklyProductionOrder[] {
  const window = resolveHarvestTargetDateWindow(target);
  if (!window) return [];
  const unit = weeklyOrderUnit(target);
  const rate = target.weeklyKg ?? target.weeklyQuantity;
  if (!validRecordQuantity(rate, unit)) return [];
  const relevant = cycles.filter(cycle => cycle.targetId === target.id && cycle.siteId === target.siteId
    && cycle.cropKey === target.cropKey);
  const orders: WeeklyProductionOrder[] = [];
  for (let start = window.start; start < window.endExclusive;) {
    const nextWeek = addGrowerUtcDays(start, GROWER_BUYER_PICKING_PERIOD_DAYS);
    if (!nextWeek) return [];
    const fullWeek = nextWeek <= window.endExclusive;
    const endExclusive = fullWeek ? nextWeek : window.endExclusive;
    const entries = allocations.filter(entry => entry.targetId === target.id && entry.siteId === target.siteId
      && entry.cropKey === target.cropKey && entry.start === start && entry.endExclusive === endExclusive);
    const [entry] = entries;
    const planned = entries.length === 1 && entry.unit === unit
      && (entry.quantity === 0 || validRecordQuantity(entry.quantity, unit)) ? entry.quantity : null;
    const picking = relevant.flatMap(cycle => {
      const schedule = cycle.schedule;
      const pickStart = schedule.firstHarvestDate > start ? schedule.firstHarvestDate : start;
      const pickEnd = schedule.harvestEndExclusiveDate < endExclusive ? schedule.harvestEndExclusiveDate : endExclusive;
      return pickStart < pickEnd
        ? [{ start: pickStart, endExclusive: pickEnd, bedId: cycle.bedId, basis: cycle.basis }] : [];
    });
    let daysWithoutPicking = 0;
    for (let offset = 0; offset < GROWER_BUYER_PICKING_PERIOD_DAYS; offset++) {
      const day = addGrowerUtcDays(start, offset);
      if (!day || day >= endExclusive) break;
      if (!picking.some(interval => interval.start <= day && day < interval.endExclusive)) daysWithoutPicking++;
    }
    orders.push({
      start, endExclusive, fullWeek, unit, requested: fullWeek ? rate : null, planned,
      planningGap: fullWeek && planned !== null ? Math.max(0, rate - planned) : null,
      picking, daysWithoutPicking,
    });
    start = endExclusive;
  }
  return orders;
}
