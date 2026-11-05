# Kiambu official bulletin links — source review

Coordinator inspection on 5 November 2026 found a dated Kiambu bulletin that was outside the three-page scope of the earlier 3 November handoff. That earlier handoff remains historical evidence; it did not fetch this document. This delivery makes a separately labelled source-discovery path in the Kenya review workspace, with explicit county selection and ordinary outbound links.

## Sources actually inspected

- [Dated Kiambu bulletin page](https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-weather-forecast-valid-3rd-to-9th-november-2026/) and its actual linked [KMD document](https://meteo.go.ke/documents/5545/Kiambu_County_weekly_weather_forecast_valid_3rd_to_9th_November_2026.pdf). The coordinator fetched both and visually read all three PDF pages. The heading advertises 3–9 November 2026. The map component has its own printed morning-time interval; no explicit timezone was established and that interval is not applied to the whole document. No weather values or tables are copied into the app.
- [County index](https://meteo.go.ke/our-products/county-forecasts/) and its [fifth page](https://meteo.go.ke/our-products/county-forecasts/?page=5). The actual fifth-page body linked the dated Kiambu page at retrieval. Pagination changes and cached search/open views disagreed about which entries occupied that page, so page number is not used as an enduring county identity or latest-source guarantee.
- [Official search for Kiambu](https://meteo.go.ke/search/?query=Kiambu), derived from the actual official search form. It is a user-followed discovery link, not an app fetcher or promise of chronological results.
- [Generic Kiambu page](https://meteo.go.ke/our-products/county-forecasts/kiambu-county-weekly-forecast/). It still linked the historical July 2025 document on inspection. That older PDF body was not fetched in this check and is labelled separately; it is never presented as a current replacement for the dated page.

The [six sanitized fetch receipts](pilots/kenya-kiambu-bulletin-receipts-2026-11-05.json) record actual requested/effective URLs, UTC retrieval/completion, HTTP/curl results, bytes and SHA256. All six actual bodies were independently matched to these values. The new PDF was 738,997 bytes with SHA256 `6d05a3f29a1fbf9f3643a91a5bf1a117170ec5fae1dd3e0b4f658dd1e4a5a4f9`. Raw bodies, contact details, signatures, map imagery and logs remain excluded from publication.

## Product contract

The pure resolver accepts only exact country KE and explicitly selected county kiambu. Unsupported or unselected inputs produce no selected source. Import and calls perform no network, storage or clock access. Curated returned evidence and choices are immutable. Country, agricultural-region text and county reference stay distinct; changing country withdraws and resets the card.

The card offers protected external anchors for the inspected dated page, linked document, index and county search. It does not fetch, parse, embed, cache or copy the PDF at runtime. There is no fake refresh action, automatic latest-document selection, site lookup, farmer-coordinate disclosure, persistence migration or crop-plan input. Existing country readiness remains the authority and is unchanged.

Source calendar headings, retrieval timestamps and source publication time are different evidence. No live freshness, latest-bulletin guarantee, timezone/UTC validity instant, inclusive/exclusive boundary interpretation, reuse licence or API contract is established. Public HTML/PDF access was observed for these exact requests only. A copyright footer is not a reuse licence. This source inspection does not approve commercial reuse, crop suitability, plant legality, country launch or funder eligibility.

## Verification and remaining gates

Ordered coordinator verification passed on the final source tree: Node 24 typecheck, 180 affected tests across 15 files (zero failures, skips or TODOs), whitespace and release-note checks. The two new registered suites include nine independent pure-model cases and five actual component/parent cases. Runtime-access controls can fail on prohibited access; returned evidence is checked against the separate frozen contract. These are affected checks, not a full-suite claim.

Actual local desktop and 390-pixel phone review verified explicit county selection, region-text independence, dated links and source-date wording, separate technical/historical details, and country-away/back reset. The dated publisher link opened the expected official page with an empty referrer. All six external anchors have 44-pixel targets. The existing floating Lima control overlaps some lower-left phone text; no app-wide overlay repair is claimed. Temporary preview resources were released after review.

Full current-head CI and exact hosted/account review remain required before a production release claim. This advances official source discovery; it does not complete the region dossier or add a numerical weather adapter. PLAN_VERSION, species, calibrated lessons and saved measurements remain unchanged.
