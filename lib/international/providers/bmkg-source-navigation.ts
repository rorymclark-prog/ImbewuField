/** Reviewed primary-page links for research navigation, not a checked forecast
 * API or permission clearance. Documentation revision dates are separate from
 * forecast production, retrieval and validity timestamps. */
export const BMKG_SOURCE_NAVIGATION = Object.freeze({
  providerId: 'bmkg-indonesia-source-navigation',
  countryCode: 'ID',
  forecastDocumentationUrl: 'https://data.bmkg.go.id/prakiraan-cuaca/',
  openDataAboutUrl: 'https://data.bmkg.go.id/tentang/',
  generalTermsUrl: 'https://www.bmkg.go.id/ketentuan-penggunaan',
  reviewedOn: '2026-11-05',
  reviewBasis: 'coordinator-primary-web-reader-page-opens',
  forecastDocumentationUpdatedOn: '2025-09-03',
  generalTermsUpdatedOn: '2026-07-08',
  runtimeMode: 'external-links-only',
  originalHttpBodiesCaptured: false,
  forecastApiPayloadInspected: false,
  integrationPermission: 'UNKNOWN',
  reuseLicence: 'UNKNOWN',
  endpointAuthentication: 'UNKNOWN',
  endpointAvailability: 'UNKNOWN',
  verifiedForecastFreshness: 'not-assessed',
  completeGeographicCoverage: 'UNKNOWN',
  attributionCondition: 'BMKG-source-attribution-required',
  writtenPermissionCondition: 'provider-stated-for-republication-third-party-integration-or-commercial-use',
  conditionsApplicability: 'UNRESOLVED',
} as const);

export type BmkgSourceNavigation = typeof BMKG_SOURCE_NAVIGATION;
