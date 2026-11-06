# Nepal: Official Source Fit (Documentation Only)

Coordinator public fetches (manifest `8adc780ed015796d75b9807b0f96cb34fab79bc465c490ce1b370b0b2c084080`) evaluated five HTTPS attempts, yielding two available official source families and three transport failures.

### Available Official Sources

1. **DHM-Hosted Weekly Weather Bulletin Index**
   - *URL*: `https://dhm.gov.np/agromet-services/weekly-weather-bulletin` (HTTP 200, fetched 2026-11-05; fetched header displays *Nepal Meteorological Department*).
   - *Capability*: Web index advertising weekly agrometeorological bulletin titles, ASCII upload timestamps, and links to PDF files.
   - *Limits*: Bulletins list Nepali-script title dates alongside ASCII upload timestamps and a displayed page clock; these values do not verify timezone bounds, calendar conversion, validity periods, or bulletin freshness. No bulletin PDF, forecast payload, or API was downloaded. Station coverage, cadence, reuse terms, and API authentication remain unknown.

2. **AITC-Hosted Introduction**
   - *URL*: `https://aitc.gov.np/pages/introduction/` (HTTP 200, fetched 2026-11-05).
   - *Capability*: Public introduction describing agricultural communications, farmer training, media broadcasts, and extension publications.
   - *Limits*: English HTML title (*Agriculture and Information Center Hariharbhawan*) differs from the displayed Nepali header; available sources do not settle current formal legal identity. The material-use notice is only a navigation link, not inspected reuse terms. Reuse license, API authentication, and publication cadence remain UNKNOWN. Institutional history does not establish partnerships, funder eligibility, or country readiness.

### Unavailable Leads (Transport Failures)
Three endpoints yielded curl HTTP 000 no-response indicators, not server responses:
- `https://kms.narc.gov.np/page/about`: Connection failure (curl exit 7).
- `https://kisan.aitc.gov.np/`: Expired SSL certificate (curl exit 60).
- `https://narc.gov.np/`: Connection timed out after 25s (curl exit 28).

These transport failures do not demonstrate permanent outages or legal prohibitions.

### Proposed Verifications & Negative Controls (Not Executed)
- *Next Verification*: Inspect one linked bulletin's full body and relevant public reuse terms via normal HTTPS, after source-rights review, before planning parsers.
- *Proposed Negative Controls*:
  1. Retain unknown validity when calendar conversions or timezone offsets are unverified.
  2. Reject TLS bypass and never fabricate bodies for transport failures.
  3. Reject inheriting reuse rights from a menu navigation link.

No customer testing, fluent/local legal approval, partnership, or API integration exists.

```json
{
  "status": "documentation-only",
  "manifestSha256": "8adc780ed015796d75b9807b0f96cb34fab79bc465c490ce1b370b0b2c084080",
  "review": "unreviewed-ai-draft",
  "commandsRun": false,
  "testsRun": false,
  "validation": "UNKNOWN",
  "workersActive": 0,
  "runtimeActivation": false,
  "countrySupported": false,
  "productApiImplemented": false
}
```
