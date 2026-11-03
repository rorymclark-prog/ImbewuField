/** Curated official links, separate from weather or crop-planning adapters.
 * Advertised calendar labels do not resolve the PDF's unknown time zone or its
 * inconsistent map duration label, so no validity instants/freshness are inferred. */
export interface KmdBulletinReference {
  readonly countryCode: 'KE';
  readonly countyId: 'kiambu';
  readonly countyLabel: 'Kiambu';
  readonly authority: 'Kenya Meteorological Department';
  readonly officialPageUrl: string;
  readonly documentUrl: string;
  readonly indexUrl: string;
  readonly advertisedWindow: Readonly<{ start: '2026-11-03'; end: '2026-11-09' }>;
  /** Exact PDF retrieval receipt fetchedAtUtc, not visual-review, issue or
   * publication time. It cannot establish that the bulletin remains current. */
  readonly checkedAtUtc: string;
  readonly timezone: 'UNKNOWN';
  readonly verifiedFreshness: 'not-assessed';
  readonly licence: 'UNKNOWN';
  readonly referenceOnly: true;
  readonly productionPlanSupported: false;
}
export type KmdBulletinReferenceResult =
  | { readonly status: 'available'; readonly reference: KmdBulletinReference }
  | { readonly status: 'unavailable'; readonly reason: 'unsupported-country' | 'county-not-selected' | 'county-not-verified' };

/** Offer only after explicit KE selection; the resolver enforces that boundary. */
export const KMD_BULLETIN_COUNTIES = Object.freeze([Object.freeze({ id: 'kiambu', label: 'Kiambu' })] as const);
const reference: KmdBulletinReference = Object.freeze({
  countryCode: 'KE', countyId: 'kiambu', countyLabel: 'Kiambu', authority: 'Kenya Meteorological Department',
  officialPageUrl: 'https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-weather-forecast-valid-3rd-to-9th-november-2026/',
  documentUrl: 'https://meteo.go.ke/documents/5545/Kiambu_County_weekly_weather_forecast_valid_3rd_to_9th_November_2026.pdf',
  indexUrl: 'https://meteo.go.ke/our-products/county-forecasts/',
  advertisedWindow: Object.freeze({ start: '2026-11-03', end: '2026-11-09' }),
  checkedAtUtc: '2026-11-03T15:37:56.219846+00:00',
  timezone: 'UNKNOWN', verifiedFreshness: 'not-assessed', licence: 'UNKNOWN', referenceOnly: true, productionPlanSupported: false,
});
const available: KmdBulletinReferenceResult = Object.freeze({ status: 'available', reference });

/** Exact explicit selection only: no aliases, default county, coordinates,
 * geocoding, network, storage or automatic update/expiry classification. */
export function resolveKmdBulletinReference(countryCode: string, countyId: string): KmdBulletinReferenceResult {
  if (countryCode !== 'KE') return Object.freeze({ status: 'unavailable', reason: 'unsupported-country' });
  if (countyId === '') return Object.freeze({ status: 'unavailable', reason: 'county-not-selected' });
  if (countyId !== 'kiambu') return Object.freeze({ status: 'unavailable', reason: 'county-not-verified' });
  return available;
}
