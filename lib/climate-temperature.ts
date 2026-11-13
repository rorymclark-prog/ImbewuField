import { isCompassDirection16 } from './local-wind';
import type { LocationData } from './types';
export type MonthlyTemperatureCoverage = {
  source: 'nasa-power';
  status: 'complete' | 'incomplete';
};

export type MonthlyTemperatureStatus = 'complete' | 'incomplete' | 'unknown';

export interface PowerClimatologyPeriod {
  readonly start: string;
  readonly end: string;
  readonly description: string;
}

/** POWER has returned both explicit dates and a human-readable range. Neither
 * the request date nor a cache timestamp tells us which years were averaged. */
export function powerClimatologyPeriod(value: unknown): PowerClimatologyPeriod | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const header = value as Record<string, unknown>;
  const range = typeof header.range === 'string' && header.range.length <= 500
    ? /\(January (\d{4}) - December (\d{4})\)/.exec(header.range) : null;
  const start = typeof header.start === 'string' ? /^JAN(\d{4})$/.exec(header.start) : null;
  const end = typeof header.end === 'string' ? /^DEC(\d{4})$/.exec(header.end) : null;
  if ((header.start !== undefined || header.end !== undefined) && (!start || !end)) return null;
  if (range && start && (range[1] !== start[1] || range[2] !== end![1])) return null;
  const from = range?.[1] ?? start?.[1], through = range?.[2] ?? end?.[1];
  if (!from || !through || Number(from) < 1 || Number(from) > Number(through)) return null;
  return Object.freeze({ start: `${from}-01`, end: `${through}-12`,
    description: range ? header.range as string : `${header.start} – ${header.end}` });
}

export interface PowerMonthlyTemperatureReceipt {
  readonly provider: 'nasa-power';
  readonly parameter: 'T2M';
  readonly units: 'C';
  readonly statistic: 'climatological-monthly-mean';
  readonly monthlyC: readonly (number | null)[];
  readonly period: PowerClimatologyPeriod;
  readonly requestedPoint: Readonly<{ latitude: number; longitude: number }>;
  /** API geometry is a returned point, not proof of the native cell boundary. */
  readonly returnedPoint: Readonly<{ latitude: number; longitude: number }>;
  readonly receivedAt: string;
  readonly apiVersion: string | null;
  readonly sources: readonly string[];
  readonly timeStandard: string | null;
}

/** Retain the original metric alongside legacy display values. Missing months
 * must not inherit the display's 20°C substitute in a future crop comparison.
 * This is evidence retention, not site/country admission or crop suitability. */
export function powerMonthlyTemperatureReceipt(value: unknown,
  requestedPoint: { latitude: number; longitude: number }, receivedAt: string): PowerMonthlyTemperatureReceipt | null {
  const record = (item: unknown): Record<string, unknown> => item && typeof item === 'object' && !Array.isArray(item)
    ? item as Record<string, unknown> : {};
  const pointValid = (lat: unknown, lon: unknown) => typeof lat === 'number' && Number.isFinite(lat) && Math.abs(lat) <= 90
    && typeof lon === 'number' && Number.isFinite(lon) && Math.abs(lon) <= 180;
  const root = record(value), header = record(root.header), geometry = record(root.geometry);
  const period = powerClimatologyPeriod(header), coordinates = geometry.coordinates;
  const metadata = record(record(root.parameters).T2M);
  if (!pointValid(requestedPoint.latitude, requestedPoint.longitude) || !period || metadata.units !== 'C'
    || root.type !== 'Feature' || geometry.type !== 'Point' || !Array.isArray(coordinates)
    || !pointValid(coordinates[1], coordinates[0])
    || Math.abs(coordinates[1] - requestedPoint.latitude) >= 0.00001
    || Math.abs(coordinates[0] - requestedPoint.longitude) >= 0.00001
    || typeof header.fill_value !== 'number' || !Number.isFinite(header.fill_value)
    || typeof receivedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(receivedAt)
    || !Number.isFinite(Date.parse(receivedAt)) || new Date(receivedAt).toISOString() !== receivedAt) return null;
  const measurements = record(record(root.properties).parameter).T2M;
  if (!measurements || typeof measurements !== 'object' || Array.isArray(measurements)) return null;
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const series = measurements as Record<string, unknown>;
  const monthlyC = Object.freeze(months.map(month => !Object.hasOwn(series, month) || series[month] === header.fill_value
    ? null : cleanPowerValue(series[month])));
  const text = (item: unknown) => typeof item === 'string' && item.length > 0 && item.length <= 500 ? item : null;
  return Object.freeze({ provider: 'nasa-power', parameter: 'T2M', units: 'C', statistic: 'climatological-monthly-mean',
    monthlyC, period, requestedPoint: Object.freeze({ ...requestedPoint }),
    returnedPoint: Object.freeze({ latitude: coordinates[1], longitude: coordinates[0] }), receivedAt,
    apiVersion: text(record(header.api).version),
    sources: Object.freeze(Array.isArray(header.sources) ? header.sources.flatMap(item => text(item) ? [item as string] : []) : []),
    timeStandard: text(header.time_standard) });
}

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

/** One evidence gate for report labels: annual rain alone cannot establish seasons,
 * and placeholder temperatures cannot support a climate classification. */
export function reportClimateLabels(location: Pick<LocationData, 'rainfall' | 'climate'>) {
  const rainKnown = sourcedMonthlyRainfall(location.rainfall) !== null;
  const temperaturesKnown = monthlyTemperatureStatus(location.climate) === 'complete';
  return {
    pattern: rainKnown ? location.rainfall.pattern : null,
    wetSeason: rainKnown ? location.rainfall.wetSeason : null,
    drySeason: rainKnown ? location.rainfall.drySeason : null,
    koppen: rainKnown && temperaturesKnown ? location.climate.koppen : null,
    meanTemp: temperaturesKnown && Number.isFinite(location.climate.meanTemp) ? location.climate.meanTemp : null,
  };
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
