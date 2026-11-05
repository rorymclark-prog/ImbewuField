# England pilot — reviewed source-fit handoff

AGY's bounded draft was independently reviewed on 2 November 2026 against actual
primary response bodies. Somerset is an engineering investigation target, not
an approved farming region. [Four public fetch receipts](uk-england-fetch-receipts.json)
match body bytes and SHA256, including a new independent fetch of the linked legal
page. Raw bodies, broad drafts and private conversations are excluded.

| Official source | Supported use and boundary | Remaining gap |
| --- | --- | --- |
| [Met Office historical directory](https://www.metoffice.gov.uk/research/climate/maps-and-data/historic-station-data) | Selected historical monthly series, documented variables/flags and monthly updates. General-interest reference; not the full current network, daily frost dates or a farm calendar. | Station files, precise units, download access and product reuse terms are unverified. A linked station does not establish local farm suitability. |
| [BGS licensing](https://www.bgs.ac.uk/information-hub/licensing/) | Dataset-specific open/licensed framework. Restrictions for licensable datasets extend to AI-related use beyond training, unless permitted by the agreement or separate authorisation. | No Somerset soil layer, resolution, endpoint or dataset licence has been verified. A viewer is not extraction or redistribution permission. |
| [GOV.UK plant-health controls](https://www.gov.uk/guidance/plant-health-controls) | Introductory guidance for England and the stated Wales remit, with separate Scotland/NI pathways. Controlled-import registration and passport-issuer authorisation have specific scopes. | No farm-specific planting/propagation permission or automated compliance integration. Cadence unknown; visible content update and CMS dates differ. |
| [Met Office legal policy](https://www.metoffice.gov.uk/policies/legal) | Conditional website OGL terms with exceptions. Independently fetched by the coordinator after the initial AGY handoff. | A separate product's licence and attribution still require its own check. |

[Structured source fields](uk-england-sources.json) retain unknowns. The coordinator
removed the draft's training-only restriction, broad grower-registration claim,
unsupported file units/authentication, inferred cadence and long quotation.
Retrieval timestamps are not publication dates. Documentation fetched, a tested
product endpoint and an implemented adapter are distinct: no product-data endpoint
was tested and no adapter, crop approval or language launch is implemented here.

Next work must name a specific product/use case and verify its coverage, units,
terms, access, missingness and dates before proposing any integration.
