/** Deep-freeze helper to recursively freeze objects, arrays, and nested structures. */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== 'object' || Object.isFrozen(obj)) {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === 'object') {
      deepFreeze(val);
    }
  }
  return obj;
}

export interface KmdBulletinReference {
  readonly providerId: 'kmd-county-bulletin-links';
  readonly countryCode: 'KE';
  readonly countyId: 'kiambu';
  readonly countyLabel: 'Kiambu';
  readonly sourceTitle: 'Kiambu County weekly weather forecast valid 3rd to 9th November 2026';
  readonly officialIndexUrl: 'https://meteo.go.ke/our-products/county-forecasts/';
  readonly officialSearchUrl: 'https://meteo.go.ke/search/?query=Kiambu';
  readonly officialPageUrl: 'https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-weather-forecast-valid-3rd-to-9th-november-2026/';
  readonly documentUrl: 'https://meteo.go.ke/documents/5545/Kiambu_County_weekly_weather_forecast_valid_3rd_to_9th_November_2026.pdf';
  readonly historicalPageUrl: 'https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-forecast/';
  readonly historicalDocumentUrl: 'https://meteo.go.ke/documents/876/Kiambu_County_weekly_weather_forecast_valid_15th_to_21st_July_2025.pdf';
  readonly advertisedCalendarWindow: {
    readonly startDate: '2026-11-03';
    readonly endDate: '2026-11-09';
    readonly basis: 'source-heading';
    readonly timezone: 'UNKNOWN';
    readonly boundarySemantics: 'not-established';
  };
  readonly inspectedOn: '2026-11-05';
  readonly htmlReceipt: {
    readonly fetchedAtUtc: '2026-11-05T01:47:32.519082+00:00';
    readonly bytes: 89606;
    readonly sha256: '3762b097c120c7e31ad7146a95465c69a879d0c1f085af72cc3d8f95dad93f6a';
  };
  readonly pdfReceipt: {
    readonly fetchedAtUtc: '2026-11-05T01:49:58.417402+00:00';
    readonly bytes: 738997;
    readonly sha256: '6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9';
  };
  readonly referenceOnly: true;
  readonly runtimeMode: 'external-links-only';
  readonly verifiedFreshness: 'not-assessed';
  readonly latestBulletin: 'not-established';
  readonly reuseLicence: 'UNKNOWN';
  readonly apiContract: 'UNKNOWN';
  readonly publishedAt: 'UNKNOWN';
}

export type KmdBulletinReferenceResult =
  | {
      readonly status: 'reference';
      readonly reference: KmdBulletinReference;
    }
  | {
      readonly status: 'unavailable';
      readonly reason: 'unsupported-country' | 'county-not-selected' | 'county-not-verified';
    };

export const KMD_COUNTY_CHOICES: readonly [
  {
    readonly id: 'kiambu';
    readonly label: 'Kiambu';
  }
] = deepFreeze([
  {
    id: 'kiambu',
    label: 'Kiambu',
  },
] as const);

const KMD_KIAMBU_REFERENCE: KmdBulletinReference = deepFreeze({
  providerId: 'kmd-county-bulletin-links',
  countryCode: 'KE',
  countyId: 'kiambu',
  countyLabel: 'Kiambu',
  sourceTitle: 'Kiambu County weekly weather forecast valid 3rd to 9th November 2026',
  officialIndexUrl: 'https://meteo.go.ke/our-products/county-forecasts/',
  officialSearchUrl: 'https://meteo.go.ke/search/?query=Kiambu',
  officialPageUrl: 'https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-weather-forecast-valid-3rd-to-9th-november-2026/',
  documentUrl: 'https://meteo.go.ke/documents/5545/Kiambu_County_weekly_weather_forecast_valid_3rd_to_9th_November_2026.pdf',
  historicalPageUrl: 'https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-forecast/',
  historicalDocumentUrl: 'https://meteo.go.ke/documents/876/Kiambu_County_weekly_weather_forecast_valid_15th_to_21st_July_2025.pdf',
  advertisedCalendarWindow: {
    startDate: '2026-11-03',
    endDate: '2026-11-09',
    basis: 'source-heading',
    timezone: 'UNKNOWN',
    boundarySemantics: 'not-established',
  },
  inspectedOn: '2026-11-05',
  htmlReceipt: {
    fetchedAtUtc: '2026-11-05T01:47:32.519082+00:00',
    bytes: 89606,
    sha256: '3762b097c120c7e31ad7146a95465c69a879d0c1f085af72cc3d8f95dad93f6a',
  },
  pdfReceipt: {
    fetchedAtUtc: '2026-11-05T01:49:58.417402+00:00',
    bytes: 738997,
    sha256: '6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9',
  },
  referenceOnly: true,
  runtimeMode: 'external-links-only',
  verifiedFreshness: 'not-assessed',
  latestBulletin: 'not-established',
  reuseLicence: 'UNKNOWN',
  apiContract: 'UNKNOWN',
  publishedAt: 'UNKNOWN',
});

const RESULT_UNSUPPORTED_COUNTRY: KmdBulletinReferenceResult = deepFreeze({
  status: 'unavailable',
  reason: 'unsupported-country',
} as const);

const RESULT_COUNTY_NOT_SELECTED: KmdBulletinReferenceResult = deepFreeze({
  status: 'unavailable',
  reason: 'county-not-selected',
} as const);

const RESULT_COUNTY_NOT_VERIFIED: KmdBulletinReferenceResult = deepFreeze({
  status: 'unavailable',
  reason: 'county-not-verified',
} as const);

const RESULT_REFERENCE: KmdBulletinReferenceResult = deepFreeze({
  status: 'reference',
  reference: KMD_KIAMBU_REFERENCE,
} as const);

/** Pure synchronous resolution of curated Kenya Meteorological Department (KMD) county bulletin links.
 * Never coerces, trims, infers, or executes input getters.
 * Zero network, storage, clock, or runtime side-effects. */
export function resolveKmdBulletinReference(
  countryCode: unknown,
  countyId: unknown
): KmdBulletinReferenceResult {
  // Exact country check: non-KE is always unsupported-country.
  // Never coerce types or inspect getters.
  if (countryCode !== 'KE') {
    return RESULT_UNSUPPORTED_COUNTRY;
  }

  // Exact county check for KE:
  // undefined, null, or empty string "" -> county-not-selected
  if (countyId === undefined || countyId === null || countyId === '') {
    return RESULT_COUNTY_NOT_SELECTED;
  }

  // Exact match on 'kiambu'
  if (countyId === 'kiambu') {
    return RESULT_REFERENCE;
  }

  // Any other county value -> county-not-verified
  return RESULT_COUNTY_NOT_VERIFIED;
}
