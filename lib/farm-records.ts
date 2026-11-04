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

export type DecimalQuantity = { digits: bigint; exponent: number };

export function addDecimalQuantity(previous: DecimalQuantity | undefined, quantity: number): DecimalQuantity {
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

export function decimalQuantityNumber(total: DecimalQuantity | undefined): number | null {
  const quantity = total ? Number(`${total.digits}e${total.exponent}`) : 0;
  return Number.isFinite(quantity) ? quantity : null;
}

/** Compare before conversion so a real tiny excess is not rounded into capacity. */
export function compareDecimalQuantities(a: DecimalQuantity | undefined, b: DecimalQuantity | undefined): number {
  const left = a ?? { digits: BigInt(0), exponent: 0 };
  const right = b ?? { digits: BigInt(0), exponent: 0 };
  const exponent = Math.min(left.exponent, right.exponent);
  const difference = left.digits * BigInt(10) ** BigInt(left.exponent - exponent)
    - right.digits * BigInt(10) ** BigInt(right.exponent - exponent);
  return difference < 0 ? -1 : difference > 0 ? 1 : 0;
}

/** Multiply entered decimal quantities, converting only the final product. */
export function decimalQuantityProduct(values: readonly number[]): number | null {
  let product: DecimalQuantity = { digits: BigInt(1), exponent: 0 };
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    const factor = addDecimalQuantity(undefined, value);
    product = { digits: product.digits * factor.digits, exponent: product.exponent + factor.exponent };
  }
  const quantity = decimalQuantityNumber(product);
  return quantity === 0 && product.digits !== BigInt(0) ? null : quantity;
}

/** Software work ceilings for exact decimal arithmetic, not farm measurements.
 * Finite Number factors fit these bounds; explicit coefficients also need a
 * digit/exponent budget before multiplication or raising ten to an exponent. */
export const DECIMAL_QUANTITY_FLOOR_MAX_FACTORS = 64;
export const DECIMAL_QUANTITY_FLOOR_MAX_WORK = 32_768;
export type DecimalQuantityFloorResult =
  | { readonly status: 'ready'; readonly whole: number; readonly hasFraction: boolean }
  | { readonly status: 'held'; readonly reason: 'invalid-factor' | 'invalid-divisor' | 'missing-factors' | 'unsafe-whole-count' | 'work-limit' };
type DecimalQuantityFloorHold = Extract<DecimalQuantityFloorResult, { status: 'held' }>;
const decimalFloorHold = (reason: DecimalQuantityFloorHold['reason']): DecimalQuantityFloorHold => ({ status: 'held', reason });
// A bounded comparison rejects huge caller-owned BigInts before serialising their
// decimal digits. This fixed ceiling never grows with an untrusted exponent.
const DECIMAL_FLOOR_COEFFICIENT_LIMIT = BigInt(10) ** BigInt(DECIMAL_QUANTITY_FLOOR_MAX_WORK);

function decimalFloorOperands(input: unknown): { factors: unknown[]; divisors: unknown[] } | DecimalQuantityFloorHold {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return decimalFloorHold('missing-factors');
  const factorProperty = Object.getOwnPropertyDescriptor(input, 'factors');
  if (!factorProperty) return decimalFloorHold('missing-factors');
  if (!('value' in factorProperty) || !Array.isArray(factorProperty.value)) return decimalFloorHold('invalid-factor');
  const divisorProperty = Object.getOwnPropertyDescriptor(input, 'divisors');
  if (divisorProperty && !('value' in divisorProperty)) return decimalFloorHold('invalid-divisor');
  if (divisorProperty?.value !== undefined && !Array.isArray(divisorProperty.value)) return decimalFloorHold('invalid-divisor');
  const factors = factorProperty.value as unknown[], divisors = (divisorProperty?.value ?? []) as unknown[];
  const factorCount = factors.length, divisorCount = divisors.length;
  if (!Number.isSafeInteger(factorCount) || factorCount < 0) return decimalFloorHold('invalid-factor');
  if (!Number.isSafeInteger(divisorCount) || divisorCount < 0) return decimalFloorHold('invalid-divisor');
  if (!factorCount) return decimalFloorHold('missing-factors');
  if (factorCount + divisorCount > DECIMAL_QUANTITY_FLOOR_MAX_FACTORS) return decimalFloorHold('work-limit');
  const copy = (values: unknown[], count: number): unknown[] | null => {
    const result: unknown[] = [];
    for (let index = 0; index < count; ++index) {
      // A hole, inherited value or getter is not supplied numeric evidence.
      const property = Object.getOwnPropertyDescriptor(values, index);
      if (!property || !('value' in property)) return null;
      result.push(property.value);
    }
    return result;
  };
  const factorCopy = copy(factors, factorCount), divisorCopy = copy(divisors, divisorCount);
  if (!factorCopy) return decimalFloorHold('invalid-factor');
  if (!divisorCopy) return decimalFloorHold('invalid-divisor');
  return { factors: factorCopy, divisors: divisorCopy };
}

function floorDecimalCoefficients(factors: readonly unknown[], divisors: readonly unknown[]): DecimalQuantityFloorResult {
  let work = 0;
  const copy = (values: readonly unknown[], positive: boolean): DecimalQuantity[] | DecimalQuantityFloorHold => {
    const result: DecimalQuantity[] = [], invalid = positive ? 'invalid-divisor' : 'invalid-factor';
    for (const value of values) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return decimalFloorHold(invalid);
      const digitsProperty = Object.getOwnPropertyDescriptor(value, 'digits');
      const exponentProperty = Object.getOwnPropertyDescriptor(value, 'exponent');
      if (!digitsProperty || !('value' in digitsProperty) || !exponentProperty || !('value' in exponentProperty)) return decimalFloorHold(invalid);
      const digits: unknown = digitsProperty.value, exponent: unknown = exponentProperty.value;
      if (typeof digits !== 'bigint' || (positive ? digits <= BigInt(0) : digits < BigInt(0))
        || typeof exponent !== 'number' || !Number.isSafeInteger(exponent)) return decimalFloorHold(invalid);
      if (Math.abs(exponent) > DECIMAL_QUANTITY_FLOOR_MAX_WORK || digits >= DECIMAL_FLOOR_COEFFICIENT_LIMIT) return decimalFloorHold('work-limit');
      work += Math.abs(exponent) + digits.toString().length;
      if (work > DECIMAL_QUANTITY_FLOOR_MAX_WORK) return decimalFloorHold('work-limit');
      result.push({ digits, exponent });
    }
    return result;
  };
  const numeratorDecimals = copy(factors, false);
  if (!Array.isArray(numeratorDecimals)) return numeratorDecimals;
  const denominatorDecimals = copy(divisors, true);
  if (!Array.isArray(denominatorDecimals)) return denominatorDecimals;
  // Validate every divisor first: zero times unknown, or zero divided by zero,
  // must not turn an invalid request into a known count of zero.
  if (numeratorDecimals.some(value => value.digits === BigInt(0))) return { status: 'ready', whole: 0, hasFraction: false };
  let numerator = BigInt(1), denominator = BigInt(1), exponent = 0;
  for (const value of numeratorDecimals) { numerator *= value.digits; exponent += value.exponent; }
  for (const value of denominatorDecimals) { denominator *= value.digits; exponent -= value.exponent; }
  if (exponent >= 0) numerator *= BigInt(10) ** BigInt(exponent);
  else denominator *= BigInt(10) ** BigInt(-exponent);
  const whole = numerator / denominator;
  if (whole > BigInt(Number.MAX_SAFE_INTEGER)) return decimalFloorHold('unsafe-whole-count');
  return { status: 'ready', whole: Number(whole), hasFraction: numerator % denominator !== BigInt(0) };
}

/** Floor declared nonnegative Number decimals divided by positive divisors.
 * Number.toString supplies each declared decimal, just as the existing sum and
 * product helpers do. This cannot recover an entered unit from a rounded
 * conversion result, authenticate its source, or invent missing measurements.
 *
 * Converting the product to Number before flooring loses both sides of a whole
 * count boundary: 0.58 * 100 falls below 58, while 0.75 * 1.3333333333333333
 * rounds up to 1 despite its exact declared decimal product being less than 1.
 * The shared integer quotient/remainder precedes every Number conversion. */
export function floorDecimalQuantityRatio(input: {
  readonly factors: readonly number[];
  /** Omitted or empty divisors explicitly mean division by one. */
  readonly divisors?: readonly number[];
}): DecimalQuantityFloorResult {
  try {
    const operands = decimalFloorOperands(input);
    if ('status' in operands) return operands;
    const copy = (values: readonly unknown[], positive: boolean): DecimalQuantity[] | null => {
      const decimals: DecimalQuantity[] = [];
      for (const value of values) {
        if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) return null;
        decimals.push(addDecimalQuantity(undefined, value));
      }
      return decimals;
    };
    const factors = copy(operands.factors, false), divisors = copy(operands.divisors, true);
    if (!factors) return decimalFloorHold('invalid-factor');
    if (!divisors) return decimalFloorHold('invalid-divisor');
    return floorDecimalCoefficients(factors, divisors);
  } catch { return decimalFloorHold('invalid-factor'); }
}

/** Exact coefficient/exponent input for already validated source decimals.
 * This is arithmetic, not a text parser or a live source receipt. Required own
 * data properties are copied and checked before arithmetic; callers still own
 * unit/source binding, grammar, freshness and preservation through storage. */
export function floorExactDecimalQuantityRatio(input: {
  readonly factors: readonly Readonly<DecimalQuantity>[];
  /** Omitted or empty divisors explicitly mean division by one. */
  readonly divisors?: readonly Readonly<DecimalQuantity>[];
}): DecimalQuantityFloorResult {
  try {
    const operands = decimalFloorOperands(input);
    return 'status' in operands ? operands : floorDecimalCoefficients(operands.factors, operands.divisors);
  } catch { return decimalFloorHold('invalid-factor'); }
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
