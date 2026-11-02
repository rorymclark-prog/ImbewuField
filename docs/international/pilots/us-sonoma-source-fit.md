# US pilot — reviewed Sonoma source-fit handoff

AGY's bounded draft was independently reviewed on 2 November 2026 against **four
actual primary responses across three source families**. Sonoma County,
California is a provisional engineering investigation target, not an approved
farming region. [Four coordinator fetch receipts](us-sonoma-fetch-receipts.json)
match actual body bytes and SHA256. Raw bodies and private working material are
excluded from this bundle.

| Official source | Supported use and boundary | Remaining gap |
| --- | --- | --- |
| [NOAA NCEI product documentation](https://www.ncei.noaa.gov/products/land-based-station/us-climate-normals), plus [Quick Access shell](https://www.ncei.noaa.gov/access/us-climate-normals/) | Product article documents station and gridded climate normals, several time steps, search tools and CSV download routes. The separate access response is an empty JavaScript application shell. Official 30-year normals are generated every decade; the article also records a May 2021 release and 2023 reissues. | No selected Sonoma station/grid result, data file, export schema, product access requirement or reuse licence verified. Climate statistics do not establish crop-specific frost thresholds, a planting calendar or operational alerts. |
| [NRCS Web Soil Survey resource page](https://www.nrcs.usda.gov/resources/data-and-reports/web-soil-survey) | Documents full survey reports and spatial, tabular and thematic GIS downloads, with application/help/availability links. Annual Soils Refresh is explicitly once a year. A citation template is listed. | No Sonoma area-of-interest result, survey completeness, local map units, scale, units, dataset terms or data endpoint verified. A listed citation template does not establish legally required attribution or commercial reuse rights. |
| [APHIS plant-health contacts](https://www.aphis.usda.gov/contact/plant-health) | Contact-routing directory for reporting issues and asking about programmes and movement restrictions. California is a selector option; the dependent section shows a loading placeholder in the static response. | An actual California director contact was not obtained. No Sonoma-specific applicable rule or clearance was verified; the directory does not itself establish permission. No conclusion about the agency's enforcement remit follows from this page. |

[Structured source fields](us-sonoma-sources.json) retain the unknowns. NCEI's
article publication date **25 February 2021** and modification date **16 October
2025** come from article metadata, separately from dataset releases. Decadal
normal generation does not exclude interim corrections. APHIS's page publication
and modification dates are **7 November 2023** and **2 October 2026**. NRCS's
related-news date is not a dataset vintage or the resource page's own update date.

This review corrects the draft's three-response count, incomplete NRCS capability
description, implied California contact retrieval, citation-as-legal-requirement
claim and unsupported typical map scales. It removes assertions about local-law
enforcement and keeps product licence/authentication/units unresolved where the
selected product has not been checked.

Documentation fetched, a tested product-data endpoint and an implemented adapter
are distinct. **No product-data endpoint was tested, no adapter was implemented
and no region or local farming guidance is approved.** Next work must choose a
specific product and verify its local coverage, metadata, units, access, reuse
terms, missingness and version before proposing integration.
