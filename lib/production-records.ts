/** Exact monthly records are separate from crop-cycle benchmarks and annual tree assumptions.
 * This leaf module lets saved-plan validation and charts share one record contract without
 * making persistence import the chart's crop-plan runtime. */
export type ProductionUnit = 'kg' | 'litres' | 'eggs' | 'items';
export type PreservedFoodMethod = 'frozen' | 'dried' | 'fermented' | 'processed' | 'stored';
export interface ProductionDate { year: number; month: number }
export interface DatedProductionRecord {
  id: string;
  /** The farm owning this observation. Legacy unassigned records stay outside site totals. */
  siteId?: string;
  sourceIconKey: string;
  label: string;
  date: ProductionDate;
  quantity: number;
  unit: ProductionUnit;
  status: 'expected' | 'actual';
  /** A dated farmer price snapshot, never a new market-price source. */
  pricePerUnit?: number;
  provenance?: 'fictional-example' | 'farm-record';
  note?: string;
}
export interface PreservedFoodRecord {
  id: string;
  siteId?: string;
  label: string;
  sourceIconKey: string;
  method: PreservedFoodMethod;
  /** Explicit stock/use months, never an inferred safe shelf life or a repeating season. */
  dates: ProductionDate[];
  provenance: 'fictional-example' | 'farm-record';
  note: string;
  /** Stock present in this exact month; never another harvest or an amount carried forward. */
  quantities?: (ProductionDate & { kg: number })[];
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown, length: number): string => typeof value === 'string' ? value.trim().slice(0, length) : '';
const recordSiteId = (value: unknown): string | undefined => typeof value === 'string' && value.trim().length > 0
  && value.trim().length <= 240 ? value.trim() : undefined;
const sourceKey = (value: unknown): string => typeof value === 'string' && /^(crop|tree|animal):[a-z0-9][a-z0-9-]{0,179}$/.test(value) ? value : '';
export const isProductionDate = (value: unknown): value is ProductionDate => {
  const date = object(value);
  return !!date && Number.isInteger(date.year) && (date.year as number) >= 1 && (date.year as number) <= 9999
    && Number.isInteger(date.month) && (date.month as number) >= 1 && (date.month as number) <= 12;
};
const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const units = new Set<unknown>(['kg', 'litres', 'eggs', 'items']);
const methods = new Set<unknown>(['frozen', 'dried', 'fermented', 'processed', 'stored']);

/** A monthly summary can be corrected, but saving it twice must not double production. */
export function sanitiseProductionRecords(value: unknown): DatedProductionRecord[] {
  if (!Array.isArray(value)) return [];
  const rows = new Map<string, DatedProductionRecord>();
  const ids = new Map<string, string>();
  for (const candidate of value) {
    const row = object(candidate);
    if (!row) continue;
    const id = text(row.id, 200), label = text(row.label, 200), key = sourceKey(row.sourceIconKey), siteId = recordSiteId(row.siteId);
    if (!id || !label || !key || !isProductionDate(row.date) || !nonNegative(row.quantity)
      || (row.siteId !== undefined && !siteId)
      || !units.has(row.unit) || (row.status !== 'expected' && row.status !== 'actual')
      || (row.pricePerUnit !== undefined && !nonNegative(row.pricePerUnit))
      || (row.provenance !== undefined && row.provenance !== 'farm-record' && row.provenance !== 'fictional-example')) continue;
    const identity = JSON.stringify([siteId ?? null, key, row.date.year, row.date.month, row.status]);
    const scopedId = JSON.stringify([siteId ?? null, id]);
    const previous = ids.get(scopedId);
    if (previous && previous !== identity) rows.delete(previous);
    const previousId = rows.get(identity)?.id;
    if (previousId) ids.delete(JSON.stringify([siteId ?? null, previousId]));
    ids.set(scopedId, identity);
    rows.set(identity, {
      id, label, sourceIconKey: key, date: { year: row.date.year, month: row.date.month },
      ...(siteId ? { siteId } : {}),
      quantity: row.quantity, unit: row.unit as ProductionUnit, status: row.status,
      ...(row.pricePerUnit !== undefined ? { pricePerUnit: row.pricePerUnit } : {}),
      provenance: row.provenance ?? 'farm-record',
      ...(text(row.note, 2000) ? { note: text(row.note, 2000) } : {}),
    });
  }
  return [...rows.values()];
}

/** Keep stock provenance and exact months while refusing guessed or malformed quantities. */
export function sanitisePreservedFoodRecords(value: unknown): PreservedFoodRecord[] {
  if (!Array.isArray(value)) return [];
  const records = new Map<string, PreservedFoodRecord>();
  for (const candidate of value) {
    const row = object(candidate);
    if (!row) continue;
    const id = text(row.id, 200), label = text(row.label, 200), key = sourceKey(row.sourceIconKey), siteId = recordSiteId(row.siteId);
    if (!id || !label || !key || !methods.has(row.method) || !Array.isArray(row.dates)
      || (row.siteId !== undefined && !siteId)
      || (row.provenance !== 'farm-record' && row.provenance !== 'fictional-example')) continue;
    const dates = new Map<string, ProductionDate>();
    for (const date of row.dates) if (isProductionDate(date)) dates.set(`${date.year}-${date.month}`, { year: date.year, month: date.month });
    if (!dates.size) continue;
    const quantities = new Map<string, ProductionDate & { kg: number }>();
    if (Array.isArray(row.quantities)) for (const quantity of row.quantities) {
      const q = object(quantity);
      if (q && isProductionDate(q) && nonNegative(q.kg) && dates.has(`${q.year}-${q.month}`)) {
        quantities.set(`${q.year}-${q.month}`, { year: q.year, month: q.month, kg: q.kg });
      }
    }
    records.set(JSON.stringify([siteId ?? null, id]), { id, label, sourceIconKey: key, method: row.method as PreservedFoodMethod,
      ...(siteId ? { siteId } : {}),
      dates: [...dates.values()], provenance: row.provenance, note: text(row.note, 2000),
      ...(row.quantities !== undefined ? { quantities: [...quantities.values()] } : {}),
    });
  }
  return [...records.values()];
}

/** An account can hold several farms. Neither the map's species nor a shared month identifies
 * which farm produced a quantity, so ambiguous legacy observations cannot enter site totals. */
export function productionRecordsForSite(value: unknown, siteId: string | null): DatedProductionRecord[] {
  return siteId ? sanitiseProductionRecords(value).filter(record => record.siteId === siteId) : [];
}
export function preservedFoodRecordsForSite(value: unknown, siteId: string | null): PreservedFoodRecord[] {
  return siteId ? sanitisePreservedFoodRecords(value).filter(record => record.siteId === siteId) : [];
}

export function replaceProductionRecordsForSite(value: unknown, siteId: string, records: DatedProductionRecord[]): DatedProductionRecord[] {
  return sanitiseProductionRecords([
    ...sanitiseProductionRecords(value).filter(record => record.siteId !== siteId),
    ...records.map(record => ({ ...record, siteId })),
  ]);
}
export function replacePreservedFoodRecordsForSite(value: unknown, siteId: string, records: PreservedFoodRecord[]): PreservedFoodRecord[] {
  return sanitisePreservedFoodRecords([
    ...sanitisePreservedFoodRecords(value).filter(record => record.siteId !== siteId),
    ...records.map(record => ({ ...record, siteId })),
  ]);
}
