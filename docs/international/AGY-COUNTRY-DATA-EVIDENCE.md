# Country evidence and public provider foundation — 1 November 2026

Executor: **Codex delegated agent**, working in the assigned country worktree.
This is the fallback implementation authorised by Rory through the coordinating
Codex chat. It is not an AGY, Sonnet or swarm execution claim. No subagents were
created by this lane. No private grower data or coordinates were used.

## Delivered scope

The four provisional engineering pilots are Kenya, United Kingdom, United States
and Brazil. Their dossiers are source-discovery records, not reviewed production
advice. The registry keeps five distinct purposes: biodiversity/taxonomy,
agricultural extension, weather/frost, soils and plant legality. It imports no
species, planting spacings, crop yields, sowing calendars or farmer geometry.
Country, agricultural region and interface language have independent types.

`/international` lets a reviewer select a pilot or unsupported country, inspect
source gaps and metadata, open the official sources, and explicitly request a
public NASA POWER reference for a fixed coarse demonstration place. There is no
automatic request and no farmer location field. An unsupported country never
falls back to a South African profile. The review interface is English only.

Source pages are not datasets: `content-read` means the linked page was actually
read through the browsing tool on **2026-11-01**. An unavailable page remains
unavailable. Access date does not fabricate publication date. Undated references
remain undated in readiness evaluation; a current copyright footer is not a
publication date. Licence, cadence, resolution, units and access requirements have
explicit known/unknown states on every source record. Public access alone is not
a redistribution licence. API availability does not approve local agronomy.

## Pilot source matrix

All URLs below were attempted on 2026-11-01. The runtime registry records the
exact verified claim, coverage, unknown metadata, access and limitations for
each source. No complete linked publication or dataset was copied.

| Pilot / purpose | Official source | What was actually established |
| --- | --- | --- |
| Kenya / biodiversity | [KEFRI](https://www.kefri.org/home.html) | Full page read: forestry/biodiversity programmes, eco-region programmes and GBIF publishing link. Not planting permission. |
| Kenya / extension | [KALRO eCitizen introduction](https://kalro.ecitizen.go.ke/) | Full page read: research/information role and eCitizen service access. No crop guide reviewed. The separate KALRO homepage timed out. |
| Kenya / weather | [Kenya Meteorological Department](https://meteo.go.ke/) | Full page read: forecasts, climate, agrometeorology, stations. Frost contract not verified. |
| Kenya / soils | [NRF Rongo University facility record](https://risp.nrf.go.ke/facility/1) | Full page read: a soil-analysis facility lead in Kisii; no equipment listed. This is not a national soil raster. |
| Kenya / legality | [KEPHIS](https://kephis.go.ke/) | Full page read: plant-health regulatory role, seed certification and phytosanitary services. No complete propagation/invasive-law register reviewed. |
| UK / biodiversity | [JNCC](https://jncc.gov.uk/) | Full page read: conservation evidence/advice role. |
| UK / biodiversity candidate | [NBN Atlas candidate page](https://nbn.org.uk/the-nbn-atlas/) | Unavailable through browsing; no dataset or licence claim. |
| UK / extension candidate | [Farming Advice Service candidate](https://www.gov.uk/guidance/farming-advice-service) | Unavailable through browsing; current service and devolved equivalents remain open research. |
| UK / weather | [Met Office services](https://www.metoffice.gov.uk/services/data) | Full page read: distinguishes open, licensed and API products. No single licence, units, resolution or frost model transferred across products. |
| UK / soils | [UKCEH web applications](https://www.ceh.ac.uk/data/web-based-apps) | Full page read: links a Great Britain soil-health tool. Dataset terms/resolution and Northern Ireland coverage not inferred. |
| UK / legality | [Plant Health Information Portal](https://planthealthportal.defra.gov.uk/) | Full page read: links plant-health legislation, seeds and import checks. Great Britain links do not settle Northern Ireland rules. |
| US / taxonomy | [ITIS](https://www.itis.gov/) | Full page read: taxonomic names/relationships for North America and world. Taxonomy is not occurrence completeness or legal status. |
| US / extension | [USDA NIFA Cooperative Extension](https://www.nifa.usda.gov/about-nifa/how-we-work/extension) | Full page read: federal, land-grant and local extension roles. Local production guide review absent. |
| US / weather | [NOAA Climate Normals](https://www.ncei.noaa.gov/access/us-climate-normals/) | Public portal content read; dynamic product details and frost interpretation not verified. |
| US / soils | [NRCS Web Soil Survey](https://www.nrcs.usda.gov/resources/data-and-reports/web-soil-survey) | Full page read: downloadable survey data, annual refresh and citation. Survey availability and local sampling remain separate. |
| US / legality | [APHIS plant-health contacts](https://www.aphis.usda.gov/contact/plant-health) | Full page read, last modified 2026-10-02: state directors and interstate plant movement questions. Not all federal/state/tribal/local law. |
| Brazil / biodiversity candidate | [SiBBr](https://sibbr.gov.br/) | Browsing restriction; full content, API and licence not verified. |
| Brazil / extension candidate | [Embrapa](https://www.embrapa.br/) | HTTP 403 to browsing; no production guidance imported. |
| Brazil / weather | [INMET](https://portal.inmet.gov.br/) | Full page read: links forecasts, normals, stations and frost maps. No crop threshold or API contract inferred. |
| Brazil / soils | [Embrapa soil information](https://www.sisolos.cnptia.embrapa.br/) | Full page read: links Redape DOI 10.48432/DDBVFO and states CC BY-NC 4.0 for soil-profile data. No dataset copied; commercial use needs review. |
| Brazil / legality | [MAPA Sanidade Vegetal](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/sanidade-vegetal) | Full page read: federal plant-health role, risk analysis, import/export links. Published 2016-11-18, updated 2026-05-13. State and other legal scopes still need review. |

The dossiers are intentionally unequal: Brazil extension/biodiversity and UK
extension/NBN have access gaps. Neither a source lead nor the word “pilot” means
launch suitability, funding eligibility or locally validated crop support.

## NASA POWER executable reference and live proof

Primary documentation read on 2026-11-01:

- [Climatology endpoint](https://power.larc.nasa.gov/docs/services/api/temporal/climatology/): point requests and JSON support. The adapter requests one T2M parameter, well within the documented point-parameter ceiling.
- [Meteorological methodology](https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/): MERRA-2 modelled meteorology and its native 0.5° latitude by 0.625° longitude grid. This is not a farmer’s thermometer or a frost-date guarantee.
- [Data FAQ](https://power.larc.nasa.gov/docs/faqs/data/): community-specific units and model/grid interpretation. Climatology refresh cadence and a specific reuse licence were not established; both remain explicitly unknown.

Public live request, 2026-11-01, coordinated by the root Codex chat after the
sandbox DNS failure:

`https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M&community=AG&longitude=36.8&latitude=-1.3&format=JSON`

These are a public **Nairobi coarse demo point**, rounded to 0.1°, not a farmer
location. One unauthenticated HTTPS request succeeded. The actual payload was
read locally from a temporary file and is not committed as a log. It identifies
API **v2.10.1**, source **MERRA2**, unit **C**, time standard **LST**, fill value
**-999**, and a **January 2001–December 2025** climatological period. January T2M
was **20.51 °C**. This single returned value is a network/decoder proof, not
farming advice or a claim of local instrument accuracy.

The current response uses `header.range`, unlike older responses with explicit
`header.start`/`header.end`. The decoder retains the actual period, source,
version and time standard rather than pinning an older 2001–2020 period. The
separate reproducible tests use synthetic fixtures and no live network.

The adapter accepts only fixed public demonstration codes: Nairobi, London,
Washington and Brasília, all rounded to 0.1°. It has injected fetch, one request,
a 12-second total deadline including body reads, a 64-KiB response ceiling,
explicit JSON/unit/point/period checks and no automatic retries. Those numeric
limits are engineering safeguards, not agricultural figures or provider quota
claims. Missing/fill measurements remain missing; measured zero is retained.
Partial monthly data is labelled partial. Timeout, rate limit, transport error,
server error, malformed response, wrong units, all-missing data and oversized
body are separate outcomes. There are no replacement numbers or fallback crop
recommendations. Dataset-level reuse permission needs confirmation before
redistribution beyond this reference demonstration.

## Broader research queue

| Group | National dossiers to research | Depth today |
| --- | --- | --- |
| East Africa | Kenya, Uganda, Tanzania, Rwanda, Ethiopia | Kenya source-discovery pilot only; others unreviewed queue. |
| South / Southeast Asia | India, Nepal, Bangladesh, Indonesia | Unreviewed queue. |
| Latin America | Brazil, Colombia, Peru, Mexico | Brazil partial source-discovery pilot only; others unreviewed queue. |
| Additional national dossiers | United Kingdom, United States, Canada, Australia, New Zealand | UK/US source-discovery pilots only; others unreviewed queue. |
| Europe | Separate national and subnational dossiers to be chosen | Europe is not one legal jurisdiction, country or agricultural region. No European aggregate approval. |

Global FAO, GBIF and raster layers may later complement local authorities. None
has been connected as a proxy for local extension, frost interpretation, soil
measurement or plant law in this milestone.

## Verification and limits

Historical lane checks are superseded by the integrated verification record in
[INTEGRATION-REVIEW.md](INTEGRATION-REVIEW.md). The coordinator owns full-suite/CI/rules
and visual integration. No sandbox production build, paid render, legal acceptance,
account creation, catalogue edit, saved-data migration or production deployment
was performed by this lane. The route and its API controls need browser review
at `/international` on port 4250; visual success will be claimed only after an
actual rendered inspection.
