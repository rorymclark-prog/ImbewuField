/** The review establishes official links, not an inspected feed or live alerts. */
const reference = Object.freeze({
  providerId: 'inmet-weather-alert-links',
  countryCode: 'BR',
  portalUrl: 'https://portal.inmet.gov.br/',
  alertsAppUrl: 'https://avisos.inmet.gov.br/',
  rssFeedUrl: 'https://apiprevmet3.inmet.gov.br/avisos/rss',
  reviewedOn: '2026-11-05',
  reviewBasis: 'official-primary-page-text-and-links',
  runtimeMode: 'external-links-only',
  referenceOnly: true,
  feedPayloadInspected: false,
  directFetchOutcome: 'connection-reset',
  feedSchema: 'UNKNOWN',
  feedTimestamps: 'UNKNOWN',
  geographicCoverage: 'UNKNOWN',
  updateCadence: 'UNKNOWN',
  authentication: 'UNKNOWN',
  reuseLicence: 'UNKNOWN',
  verifiedFreshness: 'not-assessed',
} as const);

export type InmetAlertReference = typeof reference;
export type InmetAlertReferenceResult =
  | Readonly<{ status: 'reference'; reference: InmetAlertReference }>
  | Readonly<{ status: 'unavailable'; reason: 'unsupported-country' }>;

// Every reference property is primitive; these two flat freezes cover the
// whole result without another recursive interpretation of the source facts.
const available: InmetAlertReferenceResult = Object.freeze({ status: 'reference', reference });
const unavailable: InmetAlertReferenceResult = Object.freeze({ status: 'unavailable', reason: 'unsupported-country' });

/** Deliberately exact: objects, aliases and padded strings grant no reference. */
export function resolveInmetAlertReference(countryCode: unknown): InmetAlertReferenceResult {
  return countryCode === 'BR' ? available : unavailable;
}
