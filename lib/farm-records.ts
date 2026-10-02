/** Counts and packages are observations, never an implied weight conversion. */
export const RECORD_UNITS = ['kg', 'eggs', 'jars', 'bags', 'crates', 'bunches', 'trays', 'each'] as const;
export type RecordUnit = typeof RECORD_UNITS[number];
export interface RecordQuantityRow { kg?: number | null; quantity?: number; unit?: string }

export function normaliseRecordUnit(value: unknown): RecordUnit | null {
  if (typeof value !== 'string') return null;
  const unit = value.trim().toLowerCase();
  return RECORD_UNITS.includes(unit as RecordUnit) ? unit as RecordUnit : null;
}

export function validRecordQuantity(quantity: unknown, unit: unknown): quantity is number {
  const known = normaliseRecordUnit(unit);
  return known !== null && typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0
    && (known !== 'eggs' && known !== 'each' || Number.isSafeInteger(quantity));
}

export function recordUnit(row: RecordQuantityRow): RecordUnit | null {
  // Only rows predating units may use the legacy kg field. A malformed explicit
  // unit must not quietly turn an egg or service record into weight evidence.
  return row.unit === undefined ? (row.quantity === undefined ? 'kg' : null) : normaliseRecordUnit(row.unit);
}

export function recordQuantity(row: RecordQuantityRow): number | null {
  const unit = recordUnit(row);
  if (!unit) return null;
  const quantity = row.quantity === undefined && unit === 'kg' ? row.kg : row.quantity;
  if (!validRecordQuantity(quantity, unit)) return null;
  if (unit === 'kg' && row.kg !== quantity) return null;
  if (unit !== 'kg' && row.kg !== null) return null;
  return quantity;
}

export function recordWeightKg(row: RecordQuantityRow): number | null {
  return recordUnit(row) === 'kg' ? recordQuantity(row) : null;
}

export function recordQuantityPayload(quantity: number, unit: RecordUnit): { kg: number | null; quantity: number; unit: RecordUnit } {
  if (!validRecordQuantity(quantity, unit)) throw Error('Enter a positive quantity in a supported unit. Eggs and items need whole numbers.');
  const known = normaliseRecordUnit(unit)!;
  return { kg: known === 'kg' ? quantity : null, quantity, unit: known };
}

export function recordQuantityLabel(row: RecordQuantityRow): string {
  const quantity = recordQuantity(row);
  const unit = recordUnit(row);
  return quantity === null || !unit ? 'Quantity not recorded' : `${quantity.toLocaleString('en-ZA', { maximumSignificantDigits: 21 })} ${unit === 'each' ? 'items' : unit}`;
}

export function quantityTotals(rows: readonly RecordQuantityRow[]): Array<{ unit: RecordUnit; quantity: number }> {
  const totals = new Map<RecordUnit, number>();
  const unknownTotals = new Set<RecordUnit>();
  for (const row of rows) {
    const quantity = recordQuantity(row), unit = recordUnit(row);
    if (quantity === null || !unit || unknownTotals.has(unit)) continue;
    const total = (totals.get(unit) ?? 0) + quantity;
    if (validRecordQuantity(total, unit)) totals.set(unit, total);
    else {
      // An overflowing sum has no exact representable quantity. Withhold that
      // unit's total rather than display a partial or rounded egg count.
      totals.delete(unit);
      unknownTotals.add(unit);
    }
  }
  return RECORD_UNITS.flatMap(unit => totals.has(unit) ? [{ unit, quantity: totals.get(unit)! }] : []);
}
