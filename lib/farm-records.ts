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

type DecimalQuantity = { digits: bigint; exponent: number };

function addDecimalQuantity(previous: DecimalQuantity | undefined, quantity: number): DecimalQuantity {
  const [decimal, scientificExponent] = quantity.toString().split('e');
  const [whole, fraction = ''] = decimal.split('.');
  const next = { digits: BigInt(whole + fraction), exponent: Number(scientificExponent ?? 0) - fraction.length };
  if (!previous) return next;
  const exponent = Math.min(previous.exponent, next.exponent);
  return {
    digits: previous.digits * BigInt(10) ** BigInt(previous.exponent - exponent)
      + next.digits * BigInt(10) ** BigInt(next.exponent - exponent),
    exponent,
  };
}

function decimalQuantityNumber(total: DecimalQuantity | undefined): number | null {
  const quantity = total ? Number(`${total.digits}e${total.exponent}`) : 0;
  return Number.isFinite(quantity) ? quantity : null;
}

/** Signed observations can derive a balance without introducing decimal noise.
 * Invalid inputs and an overflowing result cannot prove a known quantity. */
export function decimalQuantitySum(values: readonly number[]): number | null {
  let total: DecimalQuantity | undefined;
  for (const quantity of values) {
    if (typeof quantity !== 'number' || !Number.isFinite(quantity)) return null;
    total = addDecimalQuantity(total, quantity);
  }
  return decimalQuantityNumber(total);
}

export function quantityTotals(rows: readonly RecordQuantityRow[]): Array<{ unit: RecordUnit; quantity: number }> {
  const totals = new Map<RecordUnit, DecimalQuantity>();
  for (const row of rows) {
    const quantity = recordQuantity(row), unit = recordUnit(row);
    if (quantity === null || !unit) continue;
    // The live book printed 1 203,6000000000001 kg after adding valid decimal
    // observations. Sum their canonical decimal strings exactly; rounding labels
    // instead would also discard precision a farmer actually entered.
    totals.set(unit, addDecimalQuantity(totals.get(unit), quantity));
  }
  return RECORD_UNITS.flatMap(unit => {
    const total = totals.get(unit);
    if (!total) return [];
    // Convert once after decimal accumulation. An overflowing mass or unsafe
    // whole count remains unknown rather than a partial or rounded total.
    const quantity = decimalQuantityNumber(total);
    return validRecordQuantity(quantity, unit) ? [{ unit, quantity }] : [];
  });
}
