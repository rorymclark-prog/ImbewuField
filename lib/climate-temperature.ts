export type MonthlyTemperatureCoverage = {
  source: 'nasa-power';
  status: 'complete' | 'incomplete';
};

export type MonthlyTemperatureStatus = 'complete' | 'incomplete' | 'unknown';

/**
 * Replicates the exact NASA POWER numeric cleaning semantics:
 * finite primitive number > -900 sentinel cutoff, else null.
 * No coercion, clamping, or alternative defaults.
 */
export function cleanPowerValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > -900 ? value : null;
}

/**
 * Validates that an unknown input is a dense array of exactly 12 own present indexed entries,
 * where every entry satisfies cleanPowerValue (finite numbers > -900).
 * Rejects sparse holes, non-arrays, length !== 12, sentinels, and non-numeric types.
 * Does not mutate the input array. Valid cold and zero temperatures remain valid.
 */
export function completeMonthlyTemperatures(values: unknown): values is number[] {
  if (!Array.isArray(values) || values.length !== 12) {
    return false;
  }
  for (let i = 0; i < 12; i++) {
    if (!Object.prototype.hasOwnProperty.call(values, i)) {
      return false;
    }
    if (cleanPowerValue(values[i]) === null) {
      return false;
    }
  }
  return true;
}

/**
 * Evaluates the provenance status of monthly temperature series in a ClimateData-shaped object.
 * - Non-objects, null, or missing/malformed coverage receipts => 'unknown'
 * - Coverage with source !== 'nasa-power' or invalid status string => 'unknown'
 * - Explicit coverage { source: 'nasa-power', status: 'incomplete' } => 'incomplete' regardless of monthlyTemp contents
 * - Explicit coverage { source: 'nasa-power', status: 'complete' } AND completeMonthlyTemperatures(monthlyTemp) => 'complete'
 * - Explicit complete coverage but invalid/missing/corrupted monthlyTemp array => 'unknown' (contradictory)
 * - Legacy no-receipt payloads or minima-only metadata never grant completeness => 'unknown'
 */
export function monthlyTemperatureStatus(climate: unknown): MonthlyTemperatureStatus {
  if (typeof climate !== 'object' || climate === null || Array.isArray(climate)) {
    return 'unknown';
  }

  const coverage = (climate as { monthlyTempCoverage?: unknown }).monthlyTempCoverage;
  if (typeof coverage !== 'object' || coverage === null || Array.isArray(coverage)) {
    return 'unknown';
  }

  const source = (coverage as { source?: unknown }).source;
  const status = (coverage as { status?: unknown }).status;

  if (source !== 'nasa-power') {
    return 'unknown';
  }

  if (status === 'incomplete') {
    return 'incomplete';
  }

  if (status === 'complete') {
    const monthlyTemp = (climate as { monthlyTemp?: unknown }).monthlyTemp;
    if (completeMonthlyTemperatures(monthlyTemp)) {
      return 'complete';
    }
    // Contradictory metadata claim: claims complete but values are missing, sparse, or invalid
    return 'unknown';
  }

  return 'unknown';
}
