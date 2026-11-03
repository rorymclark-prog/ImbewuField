# Kiambu dated official link: source review

## Inspected scope and provenance

Evidence from five frozen coordinator files (public HTTP fetch receipts have no repo-head identity; AGY did not fetch network, inspect PDFs, or render images):
- **Dated HTML page** (`2026-11-03T15:36:55Z`, HTTP 200, `89606` bytes, SHA256 `6edf203352719ab3cee09974e29c15a0a1ad16623e4e557619fe6582f3d40acf`): URL `https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-weather-forecast-valid-3rd-to-9th-november-2026/`. Headline: `Kiambu County weekly weather forecast valid 3rd to 9th November 2026`.
- **Linked PDF receipt** (`2026-11-03T15:37:56Z`, HTTP 200, `738997` bytes, SHA256 `6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9`): URL `https://meteo.go.ke/documents/5545/Kiambu_County_weekly_weather_forecast_valid_3rd_to_9th_November_2026.pdf`.
- **First-page visual facts** (only first page visually inspected by coordinator; other pages not visually reviewed; AGY did not inspect PDF/images; PNG SHA256 `c5dde136243471153eb874f2ee6a47acbefdab7755e2eb87695250992d792dc8`): The first-page county heading and map caption advertise Kiambu dates of 3–9 November 2026; the caption has 09am boundaries and the map has a 24Hr duration label.

## Comparison and unresolved boundaries

The historical `CONTRACT-FIT.md` inspected the generic Kiambu landing route which linked an older July 2025 document; that single generic page linked July 2025 but did not prove there were no newer Kiambu posts. This new receipt confirms KMD publishes dated Kiambu permalinks. However:
1. **Unresolved duration discrepancy**: The map heading specifies `24Hr RAINFALL FORECAST`, but the caption gives a multi-day advertised range (`Valid 09am 03NOV to 09am 09NOV 2026`). These conflicting terms must not be silently reconciled or computed into a duration while semantics remain unresolved.
2. **Missing timezone and instants**: Timezone is not printed in the inspected heading or caption; calendar text cannot be normalized into UTC instants.
3. **Freshness and rights**: Headline/date text is an advertised calendar label, not verified provider freshness. Credential-free HTTP 200 fetches establish neither API access, automation rights, nor commercial/republication licences. This is not an agricultural adapter, numerical weather model, or planting recommendation.

## Proposed negative scenarios — NOT EXECUTED

1. **County and jurisdiction mismatch (NOT EXECUTED)**: An opt-in card for Kiambu must never bind non-matching county documents (e.g. Kirinyaga) or cross-border sources.
2. **Stale generic route substitution (NOT EXECUTED)**: When a dated permalink is unavailable or fails, the app must not quietly substitute stale generic archive routes without explicit historical disclosure.
3. **Calendar window and unknown timezone treated as freshness (NOT EXECUTED)**: An advertised calendar date without printed timezone or verified delivery timestamps must never be promoted to verified live freshness, nor used to trigger automated farm tasks.
