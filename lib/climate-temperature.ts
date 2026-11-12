import { isCompassDirection16 } from './local-wind';
import type { LocationData } from './types';
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
 * Twelve own, present, finite, non-negative monthly rainfall totals (mm), Jan..Dec.
 *
 * The rainfall twin of completeMonthlyTemperatures above. `Array.prototype.every` skips
 * holes, so `[ , 100, ...]` passed the old "length 12 and every finite" checks in
 * lib/site-climate.ts and lib/crop-climate-gate.ts: a year with January missing became a
 * site calendar with the wrong annual total and the wrong rain season (independent review
 * of 11 November 2026, CBR-04). A JSON round trip turns a hole into null, which those
 * checks did reject, so no stored or fetched payload could reach it; this closes the
 * helper itself. A missing month stays missing: nothing is filled in.
 */
export function completeMonthlyRainfallMm(values: unknown): values is number[] {
  if (!Array.isArray(values) || values.length !== 12) return false;
  for (let i = 0; i < 12; i++) {
    if (!Object.prototype.hasOwnProperty.call(values, i)) return false;
    const value: unknown = values[i];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
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

/**
 * The lowest hourly 2 m air temperature in the site's NASA POWER record, °C, or null.
 *
 * `climate.minTemp` is the minimum of POWER's twelve climatology T2M_MIN values, and
 * POWER defines T2M_MIN as "the minimum hourly air (dry bulb) temperature at 2 meters
 * above the surface of the earth in the period of interest" — a record low for the
 * grid cell, not an average night. Checked on 10 November 2026 against 20 years of
 * ERA5 daily minima at 44 South African places: the two agree to a median 0.1 °C and
 * within 2 °C at 31 of the 44 (docs/audits/2026-11-10/crop-plan-accuracy-fixes-claude.md).
 *
 * /api/location-data returns a generic figure during a NASA outage, and only a real
 * reading carries the provenance tag. An untagged number must never certify a site
 * as frost-free, so it reads as "not known".
 *
 * A tagged value still goes through cleanPowerValue, the one cleaning rule for POWER
 * numbers. Until 10 November 2026 this helper accepted any finite number, so a stored
 * payload carrying POWER's missing-value marker (-999, and anything at or below the
 * -900 cutoff) came back as a record low of -999 °C: the calendar read it as frost,
 * the reasons line printed it to the grower, and tree hardiness was judged against
 * it. A missing marker is "not known", exactly as an untagged number is. Real cold
 * and zero readings are kept (independent review of PR #1328, comment 6762553064).
 */
export function recordMinimumC(climate: unknown): number | null {
  if (typeof climate !== 'object' || climate === null || Array.isArray(climate)) return null;
  const { minTemp, minTempSource } = climate as { minTemp?: unknown; minTempSource?: unknown };
  return minTempSource === 'nasa-power' ? cleanPowerValue(minTemp) : null;
}


/** Display defaults are not site evidence. Keep annual and monthly coverage independent:
 * a supported annual zero is useful even when no complete monthly series is available. */
export function annualRainfallMm(rain: { annual?: unknown; rainfallSource?: unknown } | null | undefined): number | null {
  return rain && typeof rain.rainfallSource === 'string' && ['nasa-power', 'open-meteo', 'grower-entered'].includes(rain.rainfallSource)
    && typeof rain.annual === 'number' && Number.isFinite(rain.annual) && rain.annual >= 0
    ? rain.annual : null;
}

export function sourcedMonthlyRainfall(rain: { monthly?: unknown; rainfallSource?: unknown } | null | undefined): number[] | null {
  return rain && typeof rain.rainfallSource === 'string' && ['nasa-power', 'open-meteo', 'grower-entered'].includes(rain.rainfallSource)
    && completeMonthlyRainfallMm(rain.monthly) ? rain.monthly : null;
}

export function modelledWindSpeed(climate: { windSpeed?: unknown; windSource?: unknown } | null | undefined): number | null {
  return climate?.windSource === 'nasa-power' && typeof climate.windSpeed === 'number'
    && Number.isFinite(climate.windSpeed) && climate.windSpeed >= 0 ? climate.windSpeed : null;
}


/** Shared report facts: a record low is not a winter mean or a frost-frequency forecast.
 * No threshold here diagnoses crop damage from wind speed, climate class or record minimum. */
export function reportClimateEvidence(location: Partial<Pick<LocationData, 'rainfall' | 'climate'>>): string {
  const rain = annualRainfallMm(location.rainfall);
  const months = sourcedMonthlyRainfall(location.rainfall);
  const climate: Partial<LocationData['climate']> = location.climate ?? {};
  const complete = monthlyTemperatureStatus(climate) === 'complete';
  const low = recordMinimumC(climate);
  const wind = modelledWindSpeed(climate);
  const high = climate.maxTempSource === 'nasa-power' ? cleanPowerValue(climate.maxTemp) : null;
  const solar = climate.solarSource === 'nasa-power' && typeof climate.solarRadiation === 'number' && Number.isFinite(climate.solarRadiation) && climate.solarRadiation >= 0 ? climate.solarRadiation : null;
  const direction = (value: string | undefined) => climate.windDirectionSource === 'nasa-power' && typeof value === 'string' && isCompassDirection16(value) ? value : 'not known';
  return [
    `Annual rainfall: ${rain === null ? 'not known' : `${rain} mm (${location.rainfall?.rainfallSource})`}.`,
    `Monthly rainfall (January–December): ${months ? months.join(', ') + ' mm' : 'not known'}.`,
    `Monthly mean temperatures (January–December): ${complete ? climate.monthlyTemp!.join(', ') + ' °C (NASA POWER)' : 'not known; incomplete or unrecorded model coverage'}.`,
    `Lowest temperature on record: ${low === null ? 'not known' : `${low} °C (NASA POWER grid record low)`}. This is not a winter mean, frost frequency or a planting date.`,
    `Modelled maximum temperature value: ${high === null ? 'not known' : `${high} °C (NASA POWER)`}.`,
    `Wind speed estimate: ${wind === null ? 'not known' : `${wind} m/s (NASA POWER; time coverage not recorded)`}. Wind damage and windbreak need are not established by a universal speed cutoff.`,
    `Modelled seasonal mean wind directions (not siting recommendations): December–February ${direction(climate.windFromSummer)}; June–August ${direction(climate.windFromWinter)}. Confirm local observations before siting a windbreak.`,
    `Solar radiation: ${solar === null ? 'not known' : `${solar} kWh/m²/day (NASA POWER)`}; no panel yield or irrigation deficit has been calculated.`,
    'Use grower-reported frost, water, wind and other farm observations separately. Unknown values are not evidence of safe conditions. A climate class alone does not establish crop suitability, frost occurrence or required amendments.',
  ].join('\n');
}
