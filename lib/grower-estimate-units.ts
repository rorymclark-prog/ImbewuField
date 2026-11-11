import { decimalQuantityProduct, type DecimalQuantity } from './farm-records';
import {
  INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES,
  representableUnitValue,
  parseLengthDecimal,
  type CanonicalUnitSpec,
} from './length-units';
import { AVOIRDUPOIS_POUND_IN_KILOGRAMS } from './mass-units';

export type GrowerEstimateDensityUnit = 'plants/m2' | 'plants/ft2' | 'kg/m2/cycle' | 'lb/ft2/cycle';
export type GrowerEstimateDensityKind = 'plant-density' | 'yield-density';

function densityKind(unit: unknown): GrowerEstimateDensityKind | null {
  return unit === 'plants/m2' || unit === 'plants/ft2'
    ? 'plant-density'
    : unit === 'kg/m2/cycle' || unit === 'lb/ft2/cycle'
      ? 'yield-density'
      : null;
}

/**
 * Convert user-entered density to canonical storage units:
 * - 'plants/m2' (canonical) ↔ 'plants/ft2'
 *   1 plant/ft² = 1 / 0.09290304 plants/m²
 * - 'kg/m2/cycle' (canonical) ↔ 'lb/ft2/cycle'
 *   1 lb/ft² = (1 * 0.45359237 kg) / 0.09290304 m²
 *
 * Exact square foot and avoirdupois pound constants derive from NIST SP 811
 * via lib/length-units and lib/mass-units. No arithmetic constants are duplicated.
 */
export function growerEstimateDensityToCanonical(value: number, unit: GrowerEstimateDensityUnit): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const kind = densityKind(unit);
  if (!kind) return null;
  if (value === 0) return 0;

  if (kind === 'plant-density') {
    if (unit === 'plants/m2') return value;
    // 1 plant/ft2 = 1 / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES plants/m2
    return representableUnitValue(value, value / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
  }

  // yield-density
  if (unit === 'kg/m2/cycle') return value;
  // lb/ft2/cycle -> kg/m2/cycle: (lb * lb_in_kg) / sqft_in_sqm
  const poundsInKg = decimalQuantityProduct([value, AVOIRDUPOIS_POUND_IN_KILOGRAMS]);
  if (poundsInKg === null) return null;
  return representableUnitValue(value, poundsInKg / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
}

/**
 * Convert canonical density to display units:
 * - 'plants/m2' -> 'plants/ft2': plants/m2 * 0.09290304
 * - 'kg/m2/cycle' -> 'lb/ft2/cycle': (kg/m2 * 0.09290304) / 0.45359237
 */
export function growerEstimateDensityFromCanonical(value: number, unit: GrowerEstimateDensityUnit): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const kind = densityKind(unit);
  if (!kind) return null;
  if (value === 0) return 0;

  if (kind === 'plant-density') {
    if (unit === 'plants/m2') return value;
    return representableUnitValue(value, value * INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
  }

  // yield-density
  if (unit === 'kg/m2/cycle') return value;
  // kg/m2/cycle -> lb/ft2/cycle: (kg/m2 * sqft_in_sqm) / lb_in_kg
  const kgInSqft = decimalQuantityProduct([value, INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES]);
  if (kgInSqft === null) return null;
  return representableUnitValue(value, kgInSqft / AVOIRDUPOIS_POUND_IN_KILOGRAMS);
}

/**
 * Closed unit facade for commercial grower density and yield estimates.
 * Thin spec over existing CanonicalUnitDraft/create/edit/read/switch/format helpers.
 * - Prevents switching plant density into yield density (different kinds).
 * - Allows optional blanks and explicit zero.
 * - Enforces non-negative values.
 * - Allows pristine blank switches without fabricating numbers.
 */
export const GROWER_ESTIMATE_DENSITY_SPEC = Object.freeze<
  CanonicalUnitSpec<GrowerEstimateDensityUnit, GrowerEstimateDensityKind>
>({
  kind: densityKind,
  toCanonical: growerEstimateDensityToCanonical,
  fromCanonical: growerEstimateDensityFromCanonical,
  optional: kind => kind === 'plant-density' || kind === 'yield-density',
  nonnegative: kind => kind === 'plant-density' || kind === 'yield-density',
  pristineBlankSwitch: kind => kind === 'plant-density' || kind === 'yield-density',
});

export type GrowerEstimateSourceField = 'plantsPerM2' | 'yieldKgPerM2';
export interface GrowerEstimateSourceOwner {
  readonly scopeKey: string;
  readonly profileId: string;
  readonly cropKey: string;
  readonly field: GrowerEstimateSourceField;
}
/** An input-origin claim, never account authority or verified agronomy. */
export interface GrowerEstimateSourceReceipt extends GrowerEstimateSourceOwner {
  readonly version: 1;
  readonly conversion: 'density-si-v1';
  readonly decimal: string;
  readonly unit: GrowerEstimateDensityUnit;
}

// This is a text/BigInt work bound, not a growing limit. Existing numeric entry
// still owns its grammar; source capture must not truncate a long valid token.
const MAX_SOURCE_DECIMAL_CHARACTERS = 1024;
const sourceQuantities = new WeakMap<GrowerEstimateSourceReceipt, Readonly<DecimalQuantity>>();
const sourceKeys = ['scopeKey', 'profileId', 'cropKey', 'field', 'version', 'conversion', 'decimal', 'unit'];

/** Recompute the established numeric projection with no tolerance. A matching
 * number alone cannot supply the profile/scope/field binding or source digits. */
export function normaliseGrowerEstimateSourceReceipt(
  value: unknown,
  owner: GrowerEstimateSourceOwner,
  canonicalValue: number,
): GrowerEstimateSourceReceipt | null {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isFinite(canonicalValue) || canonicalValue < 0) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(descriptors).length !== sourceKeys.length
      || !sourceKeys.every(key => descriptors[key]?.enumerable && 'value' in descriptors[key])) return null;
    const row = Object.fromEntries(sourceKeys.map(key => [key, descriptors[key].value]));
    const identity = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(v);
    if (!['scopeKey', 'profileId', 'cropKey'].every(key => identity(row[key]) && row[key] === owner[key as 'scopeKey' | 'profileId' | 'cropKey'])
      || row.field !== owner.field || !['plantsPerM2', 'yieldKgPerM2'].includes(owner.field)
      || row.version !== 1 || row.conversion !== 'density-si-v1' || typeof row.decimal !== 'string'
      || row.decimal.length > MAX_SOURCE_DECIMAL_CHARACTERS) return null;
    const unit = row.unit as GrowerEstimateDensityUnit;
    if (densityKind(unit) !== (owner.field === 'plantsPerM2' ? 'plant-density' : 'yield-density')) return null;
    const parsed = parseLengthDecimal(row.decimal);
    if (parsed.status !== 'ready' || parsed.value < 0 || growerEstimateDensityToCanonical(parsed.value, unit) !== canonicalValue) return null;

    // Grammar has already been admitted by the shared parser. Decompose its
    // original decimal digits instead of reconstructing them from Number.
    const token = row.decimal.trim().replace(',', '.');
    const unsigned = token.replace(/^[+-]/, '');
    const [whole, fraction = ''] = unsigned.split('.');
    const digits = BigInt((whole || '0') + fraction);
    if (token.startsWith('-') && digits !== BigInt(0)) return null;
    const receipt = Object.freeze({ scopeKey: owner.scopeKey, profileId: owner.profileId, cropKey: owner.cropKey, field: owner.field,
      version: 1 as const, conversion: 'density-si-v1' as const, decimal: row.decimal, unit });
    sourceQuantities.set(receipt, Object.freeze({ digits, exponent: -fraction.length }));
    return receipt;
  } catch { return null; }
}

/** Only a freshly validated receipt has a quantity. JSON reload must pass the
 * current canonical/owner comparison again; a cast or copied flag grants none. */
export function growerEstimateSourceQuantity(receipt: GrowerEstimateSourceReceipt): Readonly<DecimalQuantity> | null {
  return sourceQuantities.get(receipt) ?? null;
}
