# Annual crops and eight catalogue identities — research closure, 11 October 2026

## Result

The three annual workstreams were already researched. This review found additional **primary South African maturity, product and quantity evidence**, so the old blanket claims of “no SA maturity/yield/variety information” need replacement. The remaining gaps concern applying those references to a particular farm, cultivar and intended product. These crops remain outside automatic `CROPS`; this report does not introduce generic kg defaults, source calendars, new botanical names or changes to saved map IDs.

| Workstream | Closure verdict | Safe use in the production plan |
| --- | --- | --- |
| Pigeon pea | SA cultivar-specific dry-grain maturity and yields verified; newer ARC planting comparison verified. | Cited local trial examples; farmer-selected cultivar, sowing date and intended green-seed/dry-grain product before a forecast. |
| Lablab | Original SA accession trial verifies physiological maturity and **grain**, separately from fodder biomass. | Cited trial examples with accession and irrigation context; purchased forage Rongai cannot inherit early grain-accession performance. |
| Narrow-leaf lupin | SA named sweet-cultivar field yields and actual sowing/harvest dates verified; current seed supplier options verified. | Grain reference with purpose and cultivar; food qualification before human-food availability or kg. |
| Eight existing identities | Three synonym groups verified; peach variants and composite citrus resolved as evidence/selection issues. | Link evidence while preserving each live planting ID. Citrus requires selection of the actual product; cultivar-specific months remain separate. |

No trial number below is an annual national default. Amounts are grain/seed mass per hectare under the cited trial, not fresh pods, prepared food, fodder dry matter, per-tree production or cash value.

## 1. Pigeon pea: local cultivar timing and dry grain are available

Existing authority: [pigeon-pea.json](../../../research/crop-sources/pigeon-pea.json). The retained DAFF Lowveld brochure supports sowing context, frost intolerance and direct seeding. Its ambiguous “interspacing” does not establish two planting axes. Its absence of numerical maturity/yield is a **limitation of that brochure**, rather than a limitation of all SA research.

**Primary measured trial:** [Mathews, Silim and Saxena, ICRISAT ICPN 8 (2001)](https://oar.icrisat.org/335/1/CO_0013.pdf), printed pp37–38, Tables 1–2; PDF pp43–44, both rendered and visually checked. The 1998/99 Malekutu, Mpumalanga trial was rainfed, planted mid-December, on sandy loam without fertiliser; seasonal rainfall was 576 mm. Quote: “Both the trials were planted during the middle of December”.

| Cultivar | Source duration | Maturity, days after planting | Grain kg/ha |
| --- | --- | ---: | ---: |
| ICPL 88039 | Short | 127 | 1823 |
| ICPL 85010 | Short | 129 | 1525 |
| ICPL 87091 | Short | 140 | 1299 |
| ICPL 87051 | Medium | 193 | 978 |
| ICEAP 00053 | Long | 231 | 918 |

Grain-yield differences within each trial were not significant. These paired observations demonstrate cultivar timing, not a ranking or universal range. The authors required repeated trials before conclusions. Green-seed picking is a different product/stage.

**Newer ARC comparison:** [Bello, Mofokeng and du Toit, SA Graan/Grain October 2021](https://www.arc.agric.za/arc-gci/News%20Articles%20Library/Indigenous%20crops%20can%20help%20with%20food%20security.pdf), printed pp56–57 / PDF pp1–2. Potchefstroom, 2020/21, compared ICEAP01258 and ICEAP01284, 22 October and 25 November planting, and three densities in a good rainfall season. Quote: “Tentatively, Variety 2 (ICEAP01284) can be recommended”. Retain this as a tentative local planting/variety reference; the article itself calls for further agro-ecological testing. Its yield bars have no exact value table, so no amount was read from their height.

**Government product-stage guidance:** [DAFF Legume poster](https://www.nda.gov.za/phocadownloadpap/Brochures_and_Production_Guidelines/Legume%20poster.pdf), pigeon-pea column, Harvesting row: quote “Green pods: Harvest 30-35 days after flowering”. This is measured from flowering, not from sowing. The same row distinguishes grain maturity by brown pods. Marketing-period wording does not establish a continuous picking season for one planting.

**Proposed dossier additions:** paired `productionReferences` for the original cultivar table and tentative ARC trial; revise the false global gap to “no farm-selected cultivar or calibrated local forecast”. Keep generic `daysToHarvestRange` and `yield` unset unless the app can retain cultivar, place, product and trial context. A reference table can present the figures without promoting them to calculations. No invented row/in-row spacing or harvest-window length.

## 2. Lablab: distinguish food grain from fodder dry matter

Existing authority: [lablab.json](../../../research/crop-sources/lablab.json). Its 2–6 t/ha yield is fodder/green-manure dry biomass. Its harvest-before-flowering instruction is a forage operation, not food-grain maturity. That figure must not enter food kg, even though lablab also has food uses.

**Verified original SA trial:** [Ayisi, Bopape and Pengelly, ACIAR Proceedings 115 (2004)](https://www.aciar.gov.au/sites/default/files/legacy/node/555/proc115.pdf), chapter pp44–49; Methods p45, Table 3 p46, Table 5 p49. Tables were rendered and visually checked. Dalmada near Polokwane, 2002/03; sown 10 December on clay loam, 297 mm rain plus 178 mm irrigation. Quote: “physiological maturity was recorded when 90% of the pods within an experimental unit were brown”.

| Accession/type | Physiological maturity, days after planting | Grain kg/ha |
| --- | ---: | ---: |
| CPI 52552 | 99.3 | 576.2 |
| CPI 60795 | 99.0 | 570.5 |
| CQ 3620 | 99.0 | 574.2 |
| Rongai black | 197.0 | 2.6 |
| Rongai brown | 197.0 | 3.3 |
| Rongai white | 197.0 | 7.4 |

The grain column differs from biomass Table 4. The source calls for farmer evaluation of eating qualities; trial accessions are not verified commercial purchase options. Rongai's late maturity and grain results cannot be replaced by early-accession amounts. Irrigated trial evidence cannot establish a rainfed nationwide food calendar.

**Related original publication located, not used for new numbers:** Whitbread et al. (2011), [publisher DOI](https://doi.org/10.2989/10220119.2011.570950), African Journal of Range & Forage Science 28(1), pp21–28. The original publisher endpoint was not accessible during this review. Third-party abstracts point to further Limpopo evaluations, but those additional numbers were not adopted. The official ACIAR paper above supplies directly verified primary evidence.

**Proposed dossier additions:** reference-only paired accession/maturity/grain records; replace “no numeric SA food maturity” with “specific SA trial exists; actual food cultivar, availability, eating quality and farm calibration still required”. Preserve fodder yield under a separate product basis. No single `daysToHarvestRange` should blend the early grain types and Rongai. Confirm mature seed versus immature pods/leaves and processing before modelling household food.

## 3. Lupin: named SA trial plus purpose and cultivar qualification

Existing authority: [lupin.json](../../../research/crop-sources/lupin.json). It combines `Lupinus angustifolius` and `L. albus`, sweet/bitter seed and feed/cover uses. The live mapped identity `lupinus-angustifolius` cannot automatically inherit white-lupin Highveld recommendations or a combined seeding-rate band. This is a product-scope problem, not evidence that no research exists.

**Primary local field records:** [Hardy, Langenhoven, Joubert and Badenhorst, Lupino 19 (September 2004)](https://www.proteinresearch.net/index.php?page=2004-lupino-no-19), Crop Management, Harvesting and Tables 1–2. The 2003 Southern Cape rotation trial used **Tanjil, sweet narrow-leaf lupin**. Quote: “At Riversdale the lupins were harvested directly on 29 October”.

| Site | Actual sowing date in 2003 | Measured harvested grain kg/ha |
| --- | --- | ---: |
| Riversdale | 15 April | 2401–2529 across three camps |
| Swellendam | 12 May | 1003–1289 across three camps |
| Tygerhoek | 24 April | 2584–3058 across four camps |

Swellendam's bracketed 1407–1704 values estimate harvest losses and are **adjusted**, not actual weighed harvest. Riversdale's October date is an observed harvest event; it is not universal physiological maturity or an October window for current cultivars. Suitable soils, seed quality and harvest losses materially affected results.

**Current purchase discussion:** [Agricol sweet narrow-leaf product page](https://www.agricol.co.za/agricol-products/sweet-lupins-narrow-leaf/), Information section, accessed 11 October 2026. Quote: “Cultivars: Mandellup, Lila-Baer”. April–May planting is retained as supplier guidance; uses described include feed and green manure. The supplier's whole-SA claim is not an independent climate-by-climate field validation. Tanjil's old trial cannot supply Mandellup/Lila-Baer maturity or edible yield.

**Identity and food qualification:** the [DAFF Legume poster](https://www.nda.gov.za/phocadownloadpap/Brochures_and_Production_Guidelines/Legume%20poster.pdf), lupin column, distinguishes sweet low-alkaloid and bitter high-alkaloid narrow-leaf types. Its April–May sowing and November–December marketing context are broad guidance, not a cultivar-specific picking range. Its old cultivar-availability statements are not used as current facts. [BfR 2025 primary assessment](https://www.bfr.bund.de/assets/01_Ver%C3%B6ffentlichungen/Stellungnahmen_englisch/alkaloids-and-allergies-current-data-on-health-risks-from-lupin-seeds-in-food.pdf), §3.2.1.1.4, p11, finds home debittering methods lack validated general recommendations. This supports requiring food-qualified seed/product and appropriate processing, not importing German guidance as SA law or giving a household recipe.

[Grain SA Part 17](https://www.grainsa.co.za/integrated-crop-and-pasture-based-livestock-production-systems---part-17?print=1) explicitly treats seed primarily as livestock protein/energy and distinguishes white-lupin cool, moist summer-rainfall context. Its generic optimal grain yield cannot be labelled edible household production.

**Proposed dossier additions:** a Tanjil field-reference point with actual versus adjusted basis; current cultivar purchase context separately; explicit sweet/bitter and food/feed purpose fields. Preserve botanical names and separate narrow-leaf applicability through evidence scope. Generic food kg remains unknown until the intended food product is qualified. An elapsed date difference can be displayed as a derived observation only; it must not become sourced physiological maturity.

## 4. Resolve the eight live catalogue entries without retiring them

The eight IDs are still in `SPECIES`. `lib/species-aliases.ts` owns **retired** IDs; its tests require retired keys to be absent from the live catalogue. Adding these live IDs there would violate that contract and could merge saved season choices or plant counts. Instead extend the existing production-evidence lookup, retaining a separate planting ID and evidence ID. Do not rewrite catalogue names, geometry or saved record keys.

| Existing live ID | Evidence identity and closure | Required behaviour |
| --- | --- | --- |
| `harpephyllum-afrum` | **Accepted current spelling**, linked to the older `harpephyllum-caffrum` dossier. SANBI nomenclature update p90 explicitly associates the older orthographic form with afrum. | Bridge this planting to its existing source dossier, keeping the live ID and label. Afrum is not a typo to fix. |
| `prunus-persica-low-chill-cultivars-200-500-chill-units` | Prunus persica workstream; common name also permits nectarine. Existing peach sheets are references for named peach cultivars. | Show peach evidence with cultivar/product qualification. Do not assert that every 200–500 choice uses all peach windows or that a nectarine is the sheet's peach cultivar. |
| `prunus-persica-low-chill-arc-infruitec-selections` | Same peach research workstream, distinct live planting choice. | Keep saved identity; actual cultivar selects a source window. No combined December–January actual season by default. |
| `citrus-reticulata-citrus-limon` | Composite choice explicitly names mandarin and lemon, each already researched separately. | Require actual product identity to select evidence. One placed object cannot become two fruit-producing plants; never join both months or yields. |
| `olea-europaea-subsp-africana-o-e-subsp-cuspidata` | Wild-olive synonym workstream, as below. | Link to wild-olive evidence only, preserving ID. |
| `olea-europaea-subsp-africana-subsp-cuspidata` | Same wild-olive workstream. | Same rule; do not create another source calendar. |
| `olea-europaea-subsp-cuspidata` | SANBI accepted cuspidata, with africana listed as synonym. | Same rule; never borrow commercial olive output. |
| `salvia-rosmarinus-rosmarinus-officinalis` | Kew accepts Salvia rosmarinus and lists Rosmarinus officinalis as homotypic synonym. | Link to culinary rosemary-leaf evidence; retain saved ID, separate oil/seed output from food leaves. |

**Primary identity sources:**

- [SANBI nomenclature update](https://opus.sanbi.org/sanbiserver/api/core/bitstreams/159ff70a-c505-41fb-b474-3e2ce36ac8a9/content), printed/PDF p90, rendered and checked. Short exact text: “Harpephyllum afrum Bernh. ex C.Krauss”. The full entry equates the older caffrum form under Madrid Code Art.61.6. Existing wild-plum production research was retained under the older name; the farmer's afrum tree should reach it.
- [SANBI Biodiversity Advisor wild-olive record](https://biodiversityadvisor.sanbi.org/search/detail/c8b931d2-29f8-44b0-bc91-c6c556ee08f8), Accepted Name/Synonyms and morphological descriptions. Accepted cuspidata includes africana synonym and source descriptions. Flowering months are not fruit picking months; small wild fruit does not establish cultivated olive kg.
- [Kew rosemary record](https://powo.science.kew.org/taxon/urn%3Alsid%3Aipni.org%3Anames%3A457138-1), Taxonomy/Homotypic Synonyms. Quote: “Rosmarinus officinalis L.”. Synonym evidence does not supply an SA leaf-yield curve.
- [Culdevco Earligold](https://culdevco.co.za/peach-cultivar-info-earligold/), [Cederberg](https://culdevco.co.za/peach-cultivar-info-cederberg/) and [Afrisun](https://culdevco.co.za/peach-cultivar-info-afrisun/), Tree/Fruit Characteristics. Earligold's 200–400 Infruitec units differ from Cederberg/Afrisun's 400–600; their named December/January first picks do not define the two generic catalogue variants. Bien Donne, Simondium conditions are stated and not representative of every area.

## 5. Minimal integration proposal and regression checks

Use one existing authority, `perennialHarvestFor`/the mapped-food evidence lookup in `lib/perennial-harvest.ts`, for same-plant evidence bridges. Return a copy carrying the **requested live planting ID** when the source dossier ID differs, plus its original source context. This prevents reference lookup from rewriting `TreeSeasonChoice`, production-record identity or farmer counts. Keep an explicit unresolved/select-product state for composite citrus. Use existing source-guidance structures for annual references rather than new crop yield defaults.

Checks should prove: the afrum map tree reaches the retained dossier while keeping its ID; all three extra wild-olive IDs reach the same wild evidence without commercial olive kg; rosemary reaches leaf evidence; two distinct saved plantings do not merge counts/records; peach variants preserve cultivar qualification; one composite citrus object stays one unresolved planting until product selection; annual food totals never consume lablab biomass or unqualified feed lupin; actual/expected farmer records remain the quantity authority.

The reference-only calendar should label locality/cultivar and keep unconfirmed months out of actual fresh-food totals and picking jobs. Site survey/purchase report should retain product purpose, exact cultivar/seed supplier, sowing date, rainfed/irrigated conditions, soil and local adviser confirmation. The production plan can show real farm records as soon as available; it need not pretend that a missing applicable forecast is missing research.

All source retrieval was read-only. Downloaded primary PDFs and rendered evidence pages remain temporary files. No species, farming defaults, cash prices or `PLAN_VERSION` were changed by this annual/identity review.
