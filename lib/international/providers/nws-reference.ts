import { detachJsonData } from '@/lib/lossless-json';

/** Public National Weather Service API forecast reference provider constants.
 * Pure decoder: no network capability, caching, crop advice, or readiness approval. */
export const NWS_REFERENCE_PROVIDER = {
  id: 'nws-forecast-reference',
  name: 'National Weather Service 12-hour forecast reference',
  apiDocsUrl: 'https://www.weather.gov/documentation/services-web-api',
  disclaimerUrl: 'https://www.weather.gov/disclaimer',
  coverage: 'United States meteorological reference; public coarse demonstration points only.',
  units: 'Celsius (units=si query parameter for textual output; numeric values checked independently against C or wmoUnit:degC).',
  licence: 'US Government work in the public domain with specific exceptions/annotations; 17 U.S.C. § 403 notice required for copyrighted third-party works consisting predominantly of NWS material. No official government endorsement or affiliation implied.',
  limits: 'Single forecast endpoint response, maximum 100 periods software bound; no automatic retries.',
} as const;

export type NwsReferenceProvenance = {
  providerId: 'nws-forecast-reference';
  fetchedAt: string;
  endpoint: string;
  demoPlace: string;
  referenceOnly: true;
};

export type NwsReferencePeriod = {
  number: number;
  name: string | null;
  startTime: string;
  endTime: string;
  isDaytime: boolean | null;
  temperatureC: number | null;
  precipitationPercent: number | null;
  shortForecast: string | null;
  detailedForecast: string | null;
};

export type NwsReferenceResult =
  | {
      status: 'failed';
      reason: string;
      provenance: NwsReferenceProvenance;
    }
  | {
      status: 'available' | 'partial';
      units: 'C';
      metadata: {
        generatedAt: string;
        updateTime: string;
        validTimes: string;
        sourceUnits: 'si';
      };
      periods: readonly NwsReferencePeriod[];
      provenance: NwsReferenceProvenance;
    };

/** Software safeguard on max decoded periods to prevent unbounded allocations.
 * Explicitly a software safety bound, not an official NWS quota. */
const MAX_PERIODS_SOFTWARE_BOUND = 100;
const MAX_TEXT_LENGTH = 2000;

const ISO_DATE_TIME_OFFSET_REGEX =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

/** Validates calendar day existence (e.g. leap years, 30 vs 31 days) and timezone offset boundaries. */
function isValidCalendarDateTime(isoString: string): boolean {
  if (typeof isoString !== 'string' || !ISO_DATE_TIME_OFFSET_REGEX.test(isoString)) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(isoString);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  if (!daysInMonth || day < 1 || day > daysInMonth) return false;
  const parsed = Date.parse(isoString);
  return Number.isFinite(parsed);
}

/** ISO8601Interval boundary date-time regex supporting both standard and compact numeric offsets (+0000).
 * Matches: YYYY-MM-DDTHH:MM:SS(Z|[+-]HH:?MM?)
 */
const INTERVAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:Z|([+-])(\d{2}):?(\d{2})?)$/;

function isValidIntervalDateTime(str: string): boolean {
  if (typeof str !== 'string') return false;
  const m = INTERVAL_DATE_TIME_REGEX.exec(str);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;

  const daysInMonth = [
    31,
    (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  if (!daysInMonth || day < 1 || day > daysInMonth) return false;

  if (m[7] !== undefined) {
    const tzHour = Number(m[8]);
    const tzMin = m[9] !== undefined ? Number(m[9]) : 0;
    if (tzHour > 23 || tzMin > 59) return false;
  }

  // Parse time for temporal ordering check
  // Convert compact offset to standard colon format if needed for Date.parse
  let normalizedForParse = str;
  if (m[7] !== undefined && m[9] !== undefined && !str.includes(':', str.length - 5)) {
    // Has compact offset like +0000
    normalizedForParse = `${str.slice(0, str.length - 2)}:${str.slice(str.length - 2)}`;
  }
  const parsed = Date.parse(normalizedForParse);
  return Number.isFinite(parsed);
}

function parseIntervalTimeMs(str: string): number {
  const m = INTERVAL_DATE_TIME_REGEX.exec(str);
  let normalized = str;
  if (m && m[7] !== undefined && m[9] !== undefined && !str.includes(':', str.length - 5)) {
    normalized = `${str.slice(0, str.length - 2)}:${str.slice(str.length - 2)}`;
  }
  return Date.parse(normalized);
}

/** Frozen schema ISO8601Duration pattern:
 * ^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$
 * Only bounded integer components (Y, M, D, H, M, S); no P1W weeks or fractional PT1.5S.
 */
const FROZEN_ISO_DURATION_REGEX =
  /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+S)?)?$/;

function isValidFrozenDuration(dur: string): boolean {
  return (
    typeof dur === 'string' &&
    FROZEN_ISO_DURATION_REGEX.test(dur) &&
    dur !== 'P' &&
    dur !== 'PT'
  );
}

/** ISO 8601 interval validation supporting all three concrete forms from frozen schema:
 * 1. <start>/<end>
 * 2. <start>/<duration>
 * 3. <duration>/<end>
 * Retains exact raw validTimes string unchanged.
 */
function isValidValidTimesInterval(interval: string): boolean {
  if (typeof interval !== 'string' || interval.length > 200) return false;
  const slashIdx = interval.indexOf('/');
  if (slashIdx <= 0 || slashIdx >= interval.length - 1) return false;
  const first = interval.slice(0, slashIdx);
  const second = interval.slice(slashIdx + 1);

  if (first.startsWith('P')) {
    // Form 3: <duration>/<end>
    if (!isValidFrozenDuration(first)) return false;
    return isValidIntervalDateTime(second);
  }

  // First must be valid interval date-time
  if (!isValidIntervalDateTime(first)) return false;

  if (second.startsWith('P')) {
    // Form 2: <start>/<duration>
    return isValidFrozenDuration(second);
  }

  // Form 1: <start>/<end>
  if (!isValidIntervalDateTime(second)) return false;
  return parseIntervalTimeMs(second) > parseIntervalTimeMs(first);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Safely read own data property without invoking getters or prototype inheritance. */
function getOwn(obj: Record<string, unknown>, key: string): unknown {
  const desc = Object.getOwnPropertyDescriptor(obj, key);
  return desc && Object.hasOwn(desc, 'value') ? desc.value : undefined;
}

function hasOwnProp(obj: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(obj, key);
}

/** PURE decoder for National Weather Service 12h forecast payloads.
 * No clock reads, network fetches, cached storage, or agricultural advice. */
export function decodeNwsReference(
  value: unknown,
  provenance: NwsReferenceProvenance
): NwsReferenceResult {
  // Safely audit and detach provenance to avoid caller getters or throwing traps
  let detachedProvenance: unknown;
  try {
    detachedProvenance = detachJsonData(provenance);
  } catch {
    return {
      status: 'failed',
      reason: 'Reflection or unsafe object structure in provenance',
      provenance: {
        providerId: 'nws-forecast-reference',
        fetchedAt: '',
        endpoint: '',
        demoPlace: '',
        referenceOnly: true,
      },
    };
  }

  if (!isPlainObject(detachedProvenance)) {
    return {
      status: 'failed',
      reason: 'Invalid provenance object supplied',
      provenance: {
        providerId: 'nws-forecast-reference',
        fetchedAt: '',
        endpoint: '',
        demoPlace: '',
        referenceOnly: true,
      },
    };
  }

  const prov = detachedProvenance as Record<string, unknown>;
  const providerId = getOwn(prov, 'providerId');
  const fetchedAt = getOwn(prov, 'fetchedAt');
  const endpoint = getOwn(prov, 'endpoint');
  const demoPlace = getOwn(prov, 'demoPlace');
  const referenceOnly = getOwn(prov, 'referenceOnly');

  if (
    providerId !== 'nws-forecast-reference' ||
    referenceOnly !== true ||
    typeof fetchedAt !== 'string' ||
    !isValidCalendarDateTime(fetchedAt) ||
    typeof endpoint !== 'string' ||
    typeof demoPlace !== 'string'
  ) {
    return {
      status: 'failed',
      reason: 'Invalid provenance supplied',
      provenance: {
        providerId: 'nws-forecast-reference',
        fetchedAt: typeof fetchedAt === 'string' ? fetchedAt : '',
        endpoint: typeof endpoint === 'string' ? endpoint : '',
        demoPlace: typeof demoPlace === 'string' ? demoPlace : '',
        referenceOnly: true,
      },
    };
  }

  const safeProvenance: NwsReferenceProvenance = {
    providerId: 'nws-forecast-reference',
    fetchedAt,
    endpoint,
    demoPlace,
    referenceOnly: true,
  };

  // Safely detach untrusted input to avoid invoking caller getters/traps
  let detached: unknown;
  try {
    detached = detachJsonData(value);
  } catch {
    return {
      status: 'failed',
      reason: 'Reflection or unsafe object structure in input',
      provenance: safeProvenance,
    };
  }

  if (!isPlainObject(detached)) {
    return {
      status: 'failed',
      reason: 'Root must be a GeoJSON Feature object',
      provenance: safeProvenance,
    };
  }

  if (getOwn(detached, 'type') !== 'Feature') {
    return {
      status: 'failed',
      reason: 'Envelope type must be Feature',
      provenance: safeProvenance,
    };
  }

  const properties = getOwn(detached, 'properties');
  if (!isPlainObject(properties)) {
    return {
      status: 'failed',
      reason: 'Properties object is missing or invalid',
      provenance: safeProvenance,
    };
  }

  // Validate source units declared in properties
  if (getOwn(properties, 'units') !== 'si') {
    return {
      status: 'failed',
      reason: 'Source units must be si',
      provenance: safeProvenance,
    };
  }

  // Validate envelope metadata and timestamps
  const generatedAt = getOwn(properties, 'generatedAt');
  const updateTime = getOwn(properties, 'updateTime');
  const validTimes = getOwn(properties, 'validTimes');

  if (typeof generatedAt !== 'string' || !isValidCalendarDateTime(generatedAt)) {
    return {
      status: 'failed',
      reason: 'Invalid or missing generatedAt timestamp',
      provenance: safeProvenance,
    };
  }

  if (typeof updateTime !== 'string' || !isValidCalendarDateTime(updateTime)) {
    return {
      status: 'failed',
      reason: 'Invalid or missing updateTime timestamp',
      provenance: safeProvenance,
    };
  }

  if (typeof validTimes !== 'string' || !isValidValidTimesInterval(validTimes)) {
    return {
      status: 'failed',
      reason: 'Invalid or missing validTimes interval',
      provenance: safeProvenance,
    };
  }

  const rawPeriods = getOwn(properties, 'periods');
  if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
    return {
      status: 'failed',
      reason: 'Periods list must be a non-empty array',
      provenance: safeProvenance,
    };
  }

  if (rawPeriods.length > MAX_PERIODS_SOFTWARE_BOUND) {
    return {
      status: 'failed',
      reason: 'Periods count exceeds software bound of 100',
      provenance: safeProvenance,
    };
  }

  const decodedPeriods: NwsReferencePeriod[] = [];
  let prevNumber = 0;
  let prevEndTimeMs = -Infinity;
  let anyFieldMissing = false;

  for (let i = 0; i < rawPeriods.length; i++) {
    const period = rawPeriods[i];
    if (!isPlainObject(period)) {
      return {
        status: 'failed',
        reason: 'Period item is not an object',
        provenance: safeProvenance,
      };
    }

    // Period number: positive safe integer, strictly increasing (not required to start at 1 or be contiguous)
    const num = getOwn(period, 'number');
    if (
      typeof num !== 'number' ||
      !Number.isInteger(num) ||
      !Number.isSafeInteger(num) ||
      num <= 0 ||
      num <= prevNumber
    ) {
      return {
        status: 'failed',
        reason: 'Period number must be a strictly increasing positive safe integer',
        provenance: safeProvenance,
      };
    }
    prevNumber = num;

    // Period times: valid calendar ISO timestamps with offset
    const startTime = getOwn(period, 'startTime');
    const endTime = getOwn(period, 'endTime');
    if (typeof startTime !== 'string' || !isValidCalendarDateTime(startTime)) {
      return {
        status: 'failed',
        reason: 'Invalid period startTime',
        provenance: safeProvenance,
      };
    }
    if (typeof endTime !== 'string' || !isValidCalendarDateTime(endTime)) {
      return {
        status: 'failed',
        reason: 'Invalid period endTime',
        provenance: safeProvenance,
      };
    }

    const startMs = Date.parse(startTime);
    const endMs = Date.parse(endTime);
    if (endMs <= startMs) {
      return {
        status: 'failed',
        reason: 'Period endTime is not after startTime',
        provenance: safeProvenance,
      };
    }

    // Sequence check: cannot overlap prior period
    if (startMs < prevEndTimeMs) {
      return {
        status: 'failed',
        reason: 'Period overlaps prior period time',
        provenance: safeProvenance,
      };
    }
    prevEndTimeMs = endMs;

    // Optional name: if absent or explicit null, output is null and marked partial
    let name: string | null = null;
    if (hasOwnProp(period, 'name')) {
      const val = getOwn(period, 'name');
      if (val === null) {
        name = null;
        anyFieldMissing = true;
      } else if (typeof val === 'string' && val.length <= MAX_TEXT_LENGTH) {
        name = val;
      } else {
        return {
          status: 'failed',
          reason: 'Invalid period name',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    // Optional isDaytime: if absent or explicit null, output is null and marked partial
    let isDaytime: boolean | null = null;
    if (hasOwnProp(period, 'isDaytime')) {
      const val = getOwn(period, 'isDaytime');
      if (val === null) {
        isDaytime = null;
        anyFieldMissing = true;
      } else if (typeof val === 'boolean') {
        isDaytime = val;
      } else {
        return {
          status: 'failed',
          reason: 'Invalid isDaytime boolean',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    // Independent unit presence validation:
    // If temperatureUnit is present on the object, it MUST be string 'C'.
    // A present null, undefined, wrong type, or non-'C' string is an invalid unit and must fail.
    if (hasOwnProp(period, 'temperatureUnit')) {
      const tUnit = getOwn(period, 'temperatureUnit');
      if (tUnit !== 'C') {
        return {
          status: 'failed',
          reason: 'Unsupported, null, or conflicting legacy temperatureUnit',
          provenance: safeProvenance,
        };
      }
    }

    // Temperature: Accepts integer with temperatureUnit: "C" OR QuantitativeValue with unitCode: "wmoUnit:degC"
    let temperatureC: number | null = null;
    if (hasOwnProp(period, 'temperature')) {
      const rawTemp = getOwn(period, 'temperature');
      if (rawTemp === null) {
        temperatureC = null;
        anyFieldMissing = true;
      } else if (typeof rawTemp === 'number') {
        // Legacy branch: must be a strict integer
        if (!Number.isInteger(rawTemp)) {
          return {
            status: 'failed',
            reason: 'Legacy temperature without QuantitativeValue must be an integer',
            provenance: safeProvenance,
          };
        }
        if (getOwn(period, 'temperatureUnit') !== 'C') {
          return {
            status: 'failed',
            reason: 'Legacy integer temperature requires explicit C unit',
            provenance: safeProvenance,
          };
        }
        // Normalise finite negative zero to 0
        temperatureC = Object.is(rawTemp, -0) ? 0 : rawTemp;
      } else if (isPlainObject(rawTemp)) {
        if (!hasOwnProp(rawTemp, 'unitCode') || getOwn(rawTemp, 'unitCode') !== 'wmoUnit:degC') {
          return {
            status: 'failed',
            reason: 'QuantitativeValue temperature requires exact wmoUnit:degC unitCode',
            provenance: safeProvenance,
          };
        }
        if (!hasOwnProp(rawTemp, 'value')) {
          temperatureC = null;
          anyFieldMissing = true;
        } else {
          const val = getOwn(rawTemp, 'value');
          if (val === null) {
            temperatureC = null;
            anyFieldMissing = true;
          } else if (typeof val === 'number' && Number.isFinite(val)) {
            temperatureC = Object.is(val, -0) ? 0 : val;
          } else {
            return {
              status: 'failed',
              reason: 'Invalid QuantitativeValue temperature value',
              provenance: safeProvenance,
            };
          }
        }
      } else {
        return {
          status: 'failed',
          reason: 'Invalid temperature field structure',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    // Probability of precipitation: QuantitativeValue with wmoUnit:percent
    let precipitationPercent: number | null = null;
    if (hasOwnProp(period, 'probabilityOfPrecipitation')) {
      const rawPop = getOwn(period, 'probabilityOfPrecipitation');
      if (rawPop === null) {
        precipitationPercent = null;
        anyFieldMissing = true;
      } else if (isPlainObject(rawPop)) {
        if (!hasOwnProp(rawPop, 'unitCode') || getOwn(rawPop, 'unitCode') !== 'wmoUnit:percent') {
          return {
            status: 'failed',
            reason: 'Precipitation QuantitativeValue requires exact wmoUnit:percent unitCode',
            provenance: safeProvenance,
          };
        }
        if (!hasOwnProp(rawPop, 'value')) {
          precipitationPercent = null;
          anyFieldMissing = true;
        } else {
          const val = getOwn(rawPop, 'value');
          if (val === null) {
            precipitationPercent = null;
            anyFieldMissing = true;
          } else if (typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 100) {
            precipitationPercent = Object.is(val, -0) ? 0 : val;
          } else {
            return {
              status: 'failed',
              reason: 'Precipitation percentage value out of 0..100 bounds or non-numeric',
              provenance: safeProvenance,
            };
          }
        }
      } else {
        return {
          status: 'failed',
          reason: 'Invalid probabilityOfPrecipitation structure',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    // Optional shortForecast text: if absent or explicit null, output is null and marked partial
    let shortForecast: string | null = null;
    if (hasOwnProp(period, 'shortForecast')) {
      const val = getOwn(period, 'shortForecast');
      if (val === null) {
        shortForecast = null;
        anyFieldMissing = true;
      } else if (typeof val === 'string' && val.length <= MAX_TEXT_LENGTH) {
        shortForecast = val;
      } else {
        return {
          status: 'failed',
          reason: 'Invalid shortForecast',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    // Optional detailedForecast text: if absent or explicit null, output is null and marked partial
    let detailedForecast: string | null = null;
    if (hasOwnProp(period, 'detailedForecast')) {
      const val = getOwn(period, 'detailedForecast');
      if (val === null) {
        detailedForecast = null;
        anyFieldMissing = true;
      } else if (typeof val === 'string' && val.length <= MAX_TEXT_LENGTH) {
        detailedForecast = val;
      } else {
        return {
          status: 'failed',
          reason: 'Invalid detailedForecast',
          provenance: safeProvenance,
        };
      }
    } else {
      anyFieldMissing = true;
    }

    decodedPeriods.push({
      number: num,
      name,
      startTime,
      endTime,
      isDaytime,
      temperatureC,
      precipitationPercent,
      shortForecast,
      detailedForecast,
    });
  }

  return {
    status: anyFieldMissing ? 'partial' : 'available',
    units: 'C',
    metadata: {
      generatedAt,
      updateTime,
      validTimes,
      sourceUnits: 'si',
    },
    periods: Object.freeze(decodedPeriods),
    provenance: safeProvenance,
  };
}
