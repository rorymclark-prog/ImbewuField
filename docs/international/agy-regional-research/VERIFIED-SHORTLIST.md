# Verified Shortlist (provisional)

**Coordinator review, 2 November 2026:** accepted for limited publication as a dated
source-discovery handoff. Source fit, current service status, dataset reuse and
local agronomy still require separate review before implementation. The original
researcher's first-person provenance below records that research pass.

Seven public official sources whose primary page, or for one source an API response, was fetched on **2026-11-01 at about 20:06 UTC**. Fetch facts (HTTP status, bytes, SHA-256, requested and effective URL) come **only** from the coordinator's machine-written [`verified-receipts.json`](verified-receipts.json), which I did not write. Capability, licence, authentication and cadence come from the page bodies referenced by those receipts. The relevant fetched bodies were inspected during research; temporary local paths have been omitted from the publication receipts. Anything the fetched page does not state is **UNKNOWN**.

## What "verified" means here

| Level | Meaning | Achieved |
|---|---|---|
| Documentation or status page fetched | The page body was retrieved and its text inspected | All 7 |
| Actual API response fetched | A real API request returned data | 1 only: the GBIF occurrence count, with no records read |
| Integration implemented | Product code calls it | **None.** No code was written or run |

Receipts show HTTP 200 with curl exit code 0 for every entry below. Bodies are not stored in the repository. This is not legal advice. Whether a "not for commercial use" term affects ImbewuField is a question for a qualified person, and this file does not answer it.

## Ranked shortlist

The ranking reflects how clearly the fetched text states open terms and usable access. It is not a product-priority or country-priority claim.

| # | Source | URL fetched (receipt id) | Receipt: SHA-256 prefix, bytes | Capability (from fetched text) | Licence | Authentication | Rate limit / cadence |
|---|---|---|---|---|---|---|---|
| 1 | US National Weather Service API | `https://www.weather.gov/documentation/services-web-api` (`nws-doc`) | `fb7e7f87…`, 50,423 | Forecasts, alerts and observations. Formats include JSON-LD and DWML. Forecast grid is about 2.5 km by 2.5 km | Page says the information is open data, free to use for any purpose, no fees | No key. A User-Agent identifying the application is required; contact details inside it are optional | Rate limit not public (page says typical use is allowed); exceeding it returns an error, typically retryable within about 5 seconds. Update cadence: UNKNOWN |
| 2 | GBIF API | `https://techdocs.gbif.org/en/openapi/` (`gbif-openapi-doc`) and `https://api.gbif.org/v1/occurrence/search?limit=0` (`gbif-count-endpoint`) | `9d5744bd…`, 23,511; endpoint `3b9de439…`, 87 | JSON API with registry, species, occurrence, maps and related services. The count request returned a total of about 3.89 billion occurrence records at fetch time. It returned no records and no coordinates | UNKNOWN for data use. The docs page lists a licence enumeration endpoint but states no user licence. Dataset licences vary and were not read | Most read requests need no authentication. Writes and some other requests use HTTP Basic | Page says search may be rate-limited under load with no guaranteed rate; supports paging. Update cadence: UNKNOWN |
| 3 | DWD Climate Data Center (open data) | `https://opendata.dwd.de/climate_environment/CDC/` (`dwd-cdc-directory`) and `https://opendata.dwd.de/climate_environment/CDC/Terms_of_use.txt` (`dwd-terms`) | `5e560211…`, 2,744; terms `85a0a576…`, 143 | A directory tree with observation, derived, gridded, regional-average and event-catalogue folders (German and Europe-wide grids among them). The listing infers nothing about units or coverage | CC BY 4.0 per the terms file (status May 2024), which points to `dwd.de/copyright`. That page was **not** fetched | UNKNOWN (page does not say; the fetch was anonymous) | UNKNOWN. The listing shows file dates only |
| 4 | Environment and Climate Change Canada MSC GeoMet | `https://eccc-msc.github.io/open-data/msc-geomet/readme_en/` (`msc-geomet-doc`) | `cccd1ff8…`, 17,421 | Real-time and archived weather, climate and water products through WMS, WCS and OGC API (Features, Coverages) | The page is titled "MSC Open Data". The specific licence text is UNKNOWN on this page | Page says access is anonymous and free of charge | Page says the services are operational 24/7. Rate limit: UNKNOWN |
| 5 | USDA NRCS Soil Data Access | `https://sdmdataaccess.nrcs.usda.gov/WebServiceHelp.aspx` (`nrcs-help`) | `7c5716a9…`, 69,300 | Real-time tabular and spatial queries over the Soil Data Mart via POST at `post.rest`, returning XML or JSON. Also OGC WMS 1.1.1 and WFS 1.1.0 | UNKNOWN (not on this page) | None stated on this page: UNKNOWN | The Post.Rest Query Service states a maximum of 100,000 returned rows. Request-rate limit and update cadence: UNKNOWN |
| 6 | ISRIC SoilGrids | `https://isric.org/explore/soilgrids` (`soilgrids-status`) | `b5ac6828…`, 279,995 | Global soil property maps at 250 m resolution with per-pixel uncertainty. **The page states the REST API is temporarily paused, with no restoration estimate.** Maps are a separate reference product; application suitability was not tested | The maps are linked to CC-BY 4.0 | UNKNOWN | UNKNOWN. No uptime commitment is stated. Do not plan on the API |
| 7 | Australian Bureau of Meteorology data feeds | `https://www.bom.gov.au/catalogue/data-feeds.shtml` (`bom-data-feeds`) | `57236097…`, 58,336 | Real-time forecast, warning and observation products via the web and Anonymous FTP | Page says the products are free to access and **not for commercial use**; default terms are the Bureau's Copyright Notice. Any broad "commercial-ready" claim is contradicted | Anonymous FTP; no credentials stated | The page says availability is not guaranteed. Update cadence: UNKNOWN |

## Corrections to earlier files

- The BoM feeds are not licensed for commercial use. This overrides the Asia-Pacific draft's BoM milestone, which treats them as ready to integrate.
- SoilGrids' REST API is paused. The Europe-MENA draft's suggestion of SoilGrids as a soil fallback for Morocco and Jordan must not assume the API. Only the downloadable maps are described as CC-BY 4.0 by the page, and none of that was fetched.
- Earlier researcher notes were corrected against the receipted bodies: NWS contact details are optional, the DWD licence is CC BY 4.0, and SoilGrids is CC-BY 4.0 with a paused API. A nightly SDA update window the researcher reported is not in the receipted page, so it is UNKNOWN here.

## Not fetched, so unknown

- `dwd.de/copyright`, the GBIF data-user terms, the NWS OpenAPI document, the GeoMet licence page, the SDA homepage, and the Anonymous FTP user guide that BoM links to.
- Any quota, licence or term for a source not listed above. All of it remains in the quarantined drafts as unreviewed leads.
- Whether any listed source covers an area ImbewuField supports, at a useful resolution, with usable accuracy. Fetching the documentation says nothing about that.

## Provenance limits

- The researcher notes came from flash-tier subagents (exact Gemini model unconfirmed). Their statements were kept only where the receipted bodies confirm them.
- I spot-checked the NWS, GeoMet and SDA text in the coordinator's body files, and the BoM text from my own earlier fetch. I did not re-fetch anything after the receipts were written.
- The three region drafts remain **quarantined research leads**. Nothing in them is promoted by this file.
