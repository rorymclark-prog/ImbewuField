import { detachJsonData } from '../../lossless-json.ts';
import { isGrowerRecordedAt } from '../grower-planning.ts';

export const DWD_MOSMIX_PROVIDER_ID = 'dwd-mosmix-station-reference' as const;
export const DWD_MOSMIX_NAMESPACE = 'https://opendata.dwd.de/weather/lib/pointforecast_dwd_extension_V1_0.xsd' as const;
export const DWD_KML_NAMESPACE = 'http://www.opengis.net/kml/2.2' as const;

export interface DwdStationRequest {
  readonly stationId: string;
}

export interface DwdMosmixProvenance {
  readonly providerId: typeof DWD_MOSMIX_PROVIDER_ID;
  readonly endpoint: string;
  readonly fetchedAt: string;
  readonly expectedStationId: string;
  readonly kind: 'public-station';
  readonly referenceOnly: true;
}

/**
 * Validates a station ID string against four observed spelling families:
 * - 5 ASCII digits: [0-9]{5}
 * - 1 uppercase ASCII letter followed by 3 digits: [A-Z][0-9]{3}
 * - 1 uppercase ASCII letter followed by 4 digits: [A-Z][0-9]{4}
 * - 2 uppercase ASCII letters followed by 3 digits: [A-Z]{2}[0-9]{3}
 *
 * Why: Leading zeros are part of supplied station ID identity. Format validation
 * enforces an explicit observed spelling grammar based on coordinator-derived observations
 * from one captured directory; it is not a native fetch or check, nor does it verify current
 * catalogue membership, country location, WMO membership, or forecast suitability.
 * Checking primitive string type and exact length (4 or 5) before inlined regex matching,
 * combined with regex.exec(value) and explicit match[0] === value verification, ensures
 * that trailing newlines or multiline matches cannot bypass end-of-string anchors.
 * 4-digit pure numeric inputs (e.g. '1234') remain invalid.
 * No trimming, coercion, lowercase, fullwidth, or station default is permitted.
 */
function isValidStationId(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const len = value.length;
  if (len !== 4 && len !== 5) {
    return false;
  }
  const match = /^(?:[0-9]{5}|[A-Z][0-9]{3}|[A-Z][0-9]{4}|[A-Z]{2}[0-9]{3})$/.exec(value);
  return match !== null && match[0] === value;
}

/**
 * Parses and admits a DWD station request.
 *
 * Why: Detaches the input to avoid ordinary getters, toJSON hooks, and coercion via
 * descriptor copies. Arbitrary Proxy reflection traps may still execute, but reflection
 * and descriptor exceptions are caught and held (returning null). Rejects any extra own keys:
 * request objects must contain exactly one own key ('stationId'). Station IDs are validated
 * against the observed spelling families above, preserving leading zeros.
 */
export function parseDwdStationRequest(input: unknown): Readonly<DwdStationRequest> | null {
  try {
    const detached = detachJsonData(input);
    if (!detached || typeof detached !== 'object' || Array.isArray(detached)) {
      return null;
    }
    const keys = Reflect.ownKeys(detached);
    if (keys.length !== 1 || keys[0] !== 'stationId') {
      return null;
    }
    const stationId = (detached as Record<string, unknown>).stationId;
    if (!isValidStationId(stationId)) {
      return null;
    }
    return Object.freeze({
      stationId,
    });
  } catch {
    return null;
  }
}

/**
 * Derives the canonical MOSMIX_L endpoint for a DWD station request.
 *
 * Why: Reuses parseDwdStationRequest on every call so callers cannot bypass validation
 * with pre-constructed or forged objects. The endpoint template places the identical
 * stationId in both the directory path and the filename, without URL re-encoding or normalization.
 */
export function dwdMosmixStationEndpoint(input: unknown): string | null {
  const parsed = parseDwdStationRequest(input);
  if (!parsed) {
    return null;
  }
  return `https://opendata.dwd.de/weather/local_forecasts/mos/MOSMIX_L/single_stations/${parsed.stationId}/kml/MOSMIX_L_LATEST_${parsed.stationId}.kmz`;
}

/**
 * Validates and records provenance metadata for a fetched DWD MOSMIX station document.
 *
 * Why: Detaches the input without reading original data again. Descriptor copying avoids
 * ordinary getters, toJSON hooks, or coercion, while reflection exceptions are caught and held.
 * Requires exactly the six recognized own keys to prevent payload smuggling.
 * Validates strict ISO 8601 millisecond UTC timestamps via isGrowerRecordedAt.
 * Confirms endpoint matches the canonical endpoint derived from expectedStationId.
 * Returns a newly constructed, frozen object containing only validated primitives.
 *
 * Provenance records caller-supplied source context only; it does not grant or imply provider
 * truth, freshness proof, permission, ownership, station-or-country suitability, licence,
 * or agronomic readiness.
 */
export function parseDwdMosmixProvenance(input: unknown): Readonly<DwdMosmixProvenance> | null {
  try {
    const detached = detachJsonData(input);
    if (!detached || typeof detached !== 'object' || Array.isArray(detached)) {
      return null;
    }
    const keys = Reflect.ownKeys(detached);
    if (keys.length !== 6) {
      return null;
    }

    const expectedKeys = new Set([
      'providerId',
      'endpoint',
      'fetchedAt',
      'expectedStationId',
      'kind',
      'referenceOnly',
    ]);
    for (const key of keys) {
      if (typeof key !== 'string' || !expectedKeys.has(key)) {
        return null;
      }
    }

    const record = detached as Record<string, unknown>;

    if (record.providerId !== DWD_MOSMIX_PROVIDER_ID) {
      return null;
    }
    if (record.kind !== 'public-station') {
      return null;
    }
    if (record.referenceOnly !== true) {
      return null;
    }

    if (!isGrowerRecordedAt(record.fetchedAt)) {
      return null;
    }

    if (!isValidStationId(record.expectedStationId)) {
      return null;
    }

    const canonicalEndpoint = dwdMosmixStationEndpoint({ stationId: record.expectedStationId });
    if (!canonicalEndpoint || record.endpoint !== canonicalEndpoint) {
      return null;
    }

    return Object.freeze({
      providerId: DWD_MOSMIX_PROVIDER_ID,
      endpoint: canonicalEndpoint,
      fetchedAt: record.fetchedAt,
      expectedStationId: record.expectedStationId,
      kind: 'public-station',
      referenceOnly: true,
    });
  } catch {
    return null;
  }
}
