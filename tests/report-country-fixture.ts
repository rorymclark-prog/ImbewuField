// Formatting/localisation fixtures already replace authentication and metering.
// Supply their explicit supported-country boundary too; the real server lookup,
// account isolation and pre-spend rejection run in international-report-country-policy.test.ts.
export const SUPPORTED_REPORT_COUNTRY_FIXTURE_URL = 'data:text/javascript,' + encodeURIComponent(`
export async function resolveReportCountryPolicy(_request, _auth, location) {
  return { allowed: true, mode: 'confirmed-south-african-site', fingerprint: 'supported-formatting-fixture',
    siteId: 'site:' + location.lat.toFixed(5) + ',' + location.lon.toFixed(5) };
}
`);
