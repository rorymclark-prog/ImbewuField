/**
 * Pure display conversion from explicit source Kelvin (K) to supported display units.
 *
 * Source equations from NIST SI Units - Temperature ("Temperature Conversion (Exact)"):
 * https://www.nist.gov/pml/owm/si-units-temperature (inspected 6 Nov 2026).
 *
 * Conversion factors:
 * - K to K: identity (K)
 * - K to C: K - 273.15
 * - K to F: (K - 273.15) * 1.8 + 32
 *
 * Constants are exact scale definitions; JavaScript arithmetic remains standard IEEE 754 floating point.
 * This helper performs display conversion only; it does not round, format, mutate inputs,
 * infer plausible weather ranges, or modify raw stored measurements or provenance.
 */

export const TEMPERATURE_DISPLAY_UNITS = Object.freeze(['K', 'C', 'F'] as const);

export type TemperatureDisplayUnit = typeof TEMPERATURE_DISPLAY_UNITS[number];

/**
 * Validates whether an untrusted value is a supported temperature display unit.
 * Accepts ONLY exact primitive strings 'K', 'C', or 'F'.
 * Rejects whitespace, degree symbols, case differences, coercion, or country defaults.
 */
export function isTemperatureDisplayUnit(value: unknown): value is TemperatureDisplayUnit {
  return value === 'K' || value === 'C' || value === 'F';
}

/**
 * Converts a numeric source temperature in Kelvin to the requested display unit.
 *
 * Why:
 * 1. Requires value to be a primitive finite number (typeof value === 'number' && Number.isFinite(value)).
 * 2. Requires unit to satisfy isTemperatureDisplayUnit.
 * 3. Never calls getters, toString, or valueOf on non-primitive inputs.
 * 4. K returns the identical numeric value without alteration (preserving signed zero or 0).
 * 5. C returns value - 273.15.
 * 6. F returns (value - 273.15) * 1.8 + 32.
 * 7. Non-finite arithmetic results are rejected as null.
 * 8. Does not round or format; rounding and presentation belong to consumer UI.
 * 9. Input is explicitly Kelvin; never infers or guesses alternative source units.
 */
export function kelvinToDisplayTemperature(value: unknown, unit: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  if (!isTemperatureDisplayUnit(unit)) {
    return null;
  }

  let result: number;
  if (unit === 'K') {
    return value;
  } else if (unit === 'C') {
    result = value - 273.15;
  } else {
    result = (value - 273.15) * 1.8 + 32;
  }

  return Number.isFinite(result) ? result : null;
}
