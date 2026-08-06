// Finance metrics are deliberately derived only from records that actually carry
// the relationship they claim. A crop sale and harvest name their crop; a cost
// does not unless the farmer chose to tag it. Never spread an untagged cost across
// crops: a plausible allocation would turn a guess into a reported profit.

import type { PlanBed, Planting } from './crop-plan';
import { cropByKey } from './crop-catalog';
import { buildCropAliasIndex, matchCropKey } from './harvest-reconciliation';
import type { ExpenseLog, ProductionLog, SalesLog } from './db/types';

export type FinancePeriod = 'month' | 'season' | 'year';

export interface CropMetric {
  cropKey: string | null;
  cropName: string;
  areaM2: number | null;
  harvestedKg: number;
  hasHarvest: boolean;
  turnoverZar: number;
  soldKg: number;
  hasSale: boolean;
  taggedCostsZar: number;
  hasTaggedCost: boolean;
  yieldKgPerM2: number | null;
  turnoverZarPerM2: number | null;
  priceZarPerKg: number | null;
  taggedCostZarPerM2: number | null;
}

export interface GardenGrossMargin {
  gardenId: string | null;
  salesZar: number;
  expensesZar: number;
  grossMarginZar: number;
}

export interface FarmMetrics {
  crops: CropMetric[];
  gardenMargins: GardenGrossMargin[];
  unattributedExpensesZar: number;
  hasUnattributedExpenses: boolean;
}

function seasonMonths(month0: number): number[] {
  if (month0 >= 8 && month0 <= 10) return [8, 9, 10];
  if (month0 === 11 || month0 <= 1) return [11, 0, 1];
  if (month0 >= 2 && month0 <= 4) return [2, 3, 4];
  return [5, 6, 7];
}

export function isInFinancePeriod(iso: string | null | undefined, period: FinancePeriod, now: Date): boolean {
  if (!iso || !Number.isFinite(now.getTime())) return false;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return false;
  if (period === 'year') return date.getFullYear() === now.getFullYear();
  if (period === 'month') return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();

  const months = seasonMonths(now.getMonth());
  if (!months.includes(date.getMonth())) return false;
  if (!months.includes(11)) return date.getFullYear() === now.getFullYear();
  const seasonStartYear = now.getMonth() <= 1 ? now.getFullYear() - 1 : now.getFullYear();
  return date.getFullYear() === (date.getMonth() === 11 ? seasonStartYear : seasonStartYear + 1);
}

function finiteNonNegative(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function cropIdentity(label: string, aliases: ReturnType<typeof buildCropAliasIndex>): { key: string | null; label: string } {
  const key = matchCropKey(label, aliases);
  return key ? { key, label: cropByKey(key)?.name ?? label.trim() } : { key: null, label: label.trim() || 'Unnamed crop' };
}

function cropMapKey(identity: { key: string | null; label: string }): string {
  return identity.key ? `crop:${identity.key}` : `written:${identity.label.toLocaleLowerCase()}`;
}

function dateFor(row: ProductionLog | SalesLog | ExpenseLog): string {
  return 'logged_at' in row ? row.logged_at : 'sold_at' in row ? row.sold_at : row.spent_at;
}

/**
 * Measured crop and garden figures for the Finance screen.
 *
 * `areaM2` comes only from PlanBeds produced by design-beds-bridge. A crop that
 * was logged but is not assigned to one of those beds returns null, rather than
 * making the whole garden a denominator. Expenses are grouped by crop only when
 * their optional crop tag is present; the remaining costs stay visibly unassigned.
 */
export function buildFarmMetrics(
  plantings: Planting[],
  beds: PlanBed[],
  production: ProductionLog[],
  sales: SalesLog[],
  expenses: ExpenseLog[],
  period: FinancePeriod,
  now: Date,
): FarmMetrics {
  const aliases = buildCropAliasIndex();
  const rows = new Map<string, Omit<CropMetric, 'yieldKgPerM2' | 'turnoverZarPerM2' | 'priceZarPerKg' | 'taggedCostZarPerM2'>>();
  const ensure = (identity: { key: string | null; label: string }) => {
    const key = cropMapKey(identity);
    const current = rows.get(key);
    if (current) return current;
    const created = {
      cropKey: identity.key,
      cropName: identity.label,
      areaM2: null,
      harvestedKg: 0,
      hasHarvest: false,
      turnoverZar: 0,
      soldKg: 0,
      hasSale: false,
      taggedCostsZar: 0,
      hasTaggedCost: false,
    };
    rows.set(key, created);
    return created;
  };

  const bedsById = new Map(beds.map((bed) => [bed.id, bed]));
  for (const planting of plantings) {
    const bed = bedsById.get(planting.bedId);
    const fraction = planting.areaFraction ?? 1;
    const area = bed?.areaM2;
    if (!bed || typeof area !== 'number' || !Number.isFinite(area) || area <= 0 || !Number.isFinite(fraction) || fraction <= 0 || fraction > 1) continue;
    const row = ensure({ key: planting.cropKey, label: cropByKey(planting.cropKey)?.name ?? planting.cropKey });
    row.areaM2 = (row.areaM2 ?? 0) + area * fraction;
  }

  for (const harvest of production) {
    if (!isInFinancePeriod(dateFor(harvest), period, now)) continue;
    const row = ensure(cropIdentity(harvest.crop, aliases));
    row.hasHarvest = true;
    row.harvestedKg += finiteNonNegative(harvest.kg);
  }
  for (const sale of sales) {
    if (!isInFinancePeriod(dateFor(sale), period, now)) continue;
    const row = ensure(cropIdentity(sale.crop, aliases));
    row.hasSale = true;
    row.soldKg += finiteNonNegative(sale.kg);
    row.turnoverZar += finiteNonNegative(sale.amount);
  }

  let unattributedExpensesZar = 0;
  let hasUnattributedExpenses = false;
  for (const expense of expenses) {
    if (!isInFinancePeriod(dateFor(expense), period, now)) continue;
    const tag = expense.crop?.trim();
    if (!tag) {
      hasUnattributedExpenses = true;
      unattributedExpensesZar += finiteNonNegative(expense.amount);
      continue;
    }
    const row = ensure(cropIdentity(tag, aliases));
    row.hasTaggedCost = true;
    row.taggedCostsZar += finiteNonNegative(expense.amount);
  }

  const margins = new Map<string, GardenGrossMargin>();
  const garden = (id: string | null) => {
    const key = id ?? '__unassigned__';
    const current = margins.get(key);
    if (current) return current;
    const created = { gardenId: id, salesZar: 0, expensesZar: 0, grossMarginZar: 0 };
    margins.set(key, created);
    return created;
  };
  for (const sale of sales) {
    if (isInFinancePeriod(dateFor(sale), period, now)) garden(sale.garden_id).salesZar += finiteNonNegative(sale.amount);
  }
  for (const expense of expenses) {
    if (isInFinancePeriod(dateFor(expense), period, now)) garden(expense.garden_id).expensesZar += finiteNonNegative(expense.amount);
  }

  return {
    crops: [...rows.values()]
      .map((row) => ({
        ...row,
        yieldKgPerM2: row.areaM2 !== null && row.hasHarvest ? row.harvestedKg / row.areaM2 : null,
        turnoverZarPerM2: row.areaM2 !== null && row.hasSale ? row.turnoverZar / row.areaM2 : null,
        priceZarPerKg: row.hasSale && row.soldKg > 0 ? row.turnoverZar / row.soldKg : null,
        taggedCostZarPerM2: row.areaM2 !== null && row.hasTaggedCost ? row.taggedCostsZar / row.areaM2 : null,
      }))
      .sort((a, b) => a.cropName.localeCompare(b.cropName)),
    gardenMargins: [...margins.values()]
      .map((margin) => ({ ...margin, grossMarginZar: margin.salesZar - margin.expensesZar }))
      .sort((a, b) => (a.gardenId ?? '').localeCompare(b.gardenId ?? '')),
    unattributedExpensesZar,
    hasUnattributedExpenses,
  };
}
