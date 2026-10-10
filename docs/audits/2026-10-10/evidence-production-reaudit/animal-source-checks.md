# Animal guidance source checks — 10 October 2026

Reviewed by Codex from `origin/main` `cc4187244b03c69f6f2297a33b473cdeb12cfb8a`.
Previous production research: [4 October product guidance](../../2026-10-04/production-products-codex.md).
The parent audit records final integration, app/PDF visual checks and publication.

## Verified legal correction

The Department of Agriculture's [current legislation index](https://www.nda.gov.za/index.php/component/content/article/349-legislation-and-regulations?Itemid=437&catid=19) identifies R.858 of 15 November 2013 as amended by R.1511 of 22 November 2019 and links the [consolidated honey-bee control measures](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/PlantProductionHealth/PlantHealth/Legislation-and-Regulations/Regulations/Control-Measures-Honey-Bees/Consolidated%20Control%20Measures%20relating%20to%20honey-bees.pdf). The official PDF was downloaded and its full text read on 10 October 2026. The download was temporary and is not included in the repository.

- PDF pages 3–4, control measures 2(1) and 2(4): everyone conducting beekeeping must register; registration lasts 24 months from registration or renewal and is renewable on expiry.
- PDF page 4, 2(5): failure to renew on expiry causes deregistration and penalties under the Act.
- PDF page 5, 2(8) and 2(9): a valid certificate is required for carrying out beekeeping and for a beekeeper whose services someone hires.
- PDF page 5, 4(1): records include colonies, apiary locations, disease, disease-control measures, and colony losses with their reasons.
- PDF pages 5–6: marking, inspection, disease notification and Cape-bee movement duties remain in the consolidated source. Existing summaries now link this version.

The old source was the original 2013 legislation. The still-hosted [2017 registration form](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/PlantProductionHealth/PlantHealth/Inspection-Services/Beekeepers/170306%20Beekeeper%20Registration%20Form.pdf) repeats the superseded annual January–March rule. The amended statutory text is the authority used here; the form is dated historical material.

`research/animal-sources/bees.json` carries the verified summaries and statutory quotations. The unchanged `scripts/build-animal-enterprises.mjs` generated the matching `lib/animal-enterprises-data.ts` update. The bee record changed for those verified points; the subsequent dairy season correction below changes wording only. No animal output, timing, feed, water or space figure was changed.

## Verified siting advice

[FAO, Beekeeping in Africa — Site selection](https://www.fao.org/4/t0104e/T0104E08.htm) was read on 10 October 2026. Its apiary checklist identifies playground separation, fresh water and dry ground. The bee welfare record now gives those points and asks a registered beekeeper to check safe local placement. This matters for a school/creche setting.

This is general African apiary guidance. No exact safe distance, South African municipal bylaw, automatic placement approval or local honey season is inferred. The mapped hive geometry is unchanged. The same welfare record reaches the app and printed product guidance.

## Existing numeric meanings made visible

Animal facts retained their checked values but previously discarded `SourcedRange.note` in the displayed card. The new qualifier and expandable source-note wording expose essential distinctions:

- Dairy feed is dry matter for lactating cows, rather than the weight of fresh feed. Source: [Western Cape Department of Agriculture, Dairy Farming Handbook](https://www.elsenburg.com/wp-content/uploads/2022/01/The-Dairy-Farming-Handbook-2017-Web-version_0.pdf), existing dossier page 10. Web extraction exceeded its size limit; the official PDF was subsequently downloaded, and this dry-matter passage was re-read along with the season passage below. Its existing checked quantities are unchanged.
- Layer space is indoor housing with perches, not outdoor range. Source: [SAPA commercial-layer code](https://www.sapoultry.co.za/pdf-docs/code-practice-commercial-layers.pdf), existing dossier page 1.
- First eggs are age from hatch, rather than time after buying point-of-lay birds; per-cycle strain egg counts remain distinct from eggs per year.
- Rabbit productive-life reference is from French intensive commercial rabbitries; it is not a backyard lifespan.
- Live/weaning weights, young animals, milk per lactation and harvested products retain their original units. National/trial references do not become expected quantities for the mapped farm.

These are qualifications from existing source notes. Numerical benchmarks remain research context, with no animal count inferred from structures and no multiplication into vegetable-bed kg or per-square-metre yield.

## Dairy herd supply is not an individual cow's calendar

The [Western Cape Department of Agriculture, Dairy Farming Handbook](https://www.elsenburg.com/wp-content/uploads/2022/01/The-Dairy-Farming-Handbook-2017-Web-version_0.pdf) was downloaded on 10 October 2026 after web extraction exceeded its size limit. PDF page 239 (printed page 232, continuing page 231) discusses pasture-based dairy systems and processor capacity. Its processor requirement for even year-round supply does not establish year-round lactation of each cow, actual milk months for every smallholder herd or a processor contract for this farm.

`research/animal-sources/cattle-dairy.json` now qualifies the season as commercial herd supply and requires confirming local calving and milking months. The existing commercial-reference months and all numerical facts are unchanged. The production-window source note carries the same scope. Regeneration changed only the dairy `seasonalPattern` compared with the generated table immediately before that correction; the earlier bee changes were preserved. A regression checks that the source's commercial requirement cannot become a universal cow/herd promise. Animal farm calendars still require locally confirmed months.

## Persistence and targeted verification

`saveEnterpriseChoices` and `saveAnimalSeasonChoices` return actual save success. A quota failure, corrupt existing store or security-blocked storage returns false; sample memory returns true without touching real storage. Blocked storage loads return empty choices rather than crashing before the UI can explain a failure. The parent owns visible save-status wiring.

Twenty-one animal tests passed after the final dairy wording edit (0.82 seconds). New coverage checks account/site isolation; blocked, corrupt and full storage; sample isolation; visible numeric qualifications and full notes; amended certificate period and sourced playground/water/dry-ground advice. The source-table/dossier exact-match check passed. A TS-target-incompatible dot-all regex in the new test was replaced with its equivalent `[\s\S]` expression, preserving the assertion.

No private farmer data, paid report call, signed-in save/reopen session, farm-specific feed plan, current livestock disease-zone permit determination, or actual local cultivar trial was performed by this source-check subtask. The parent audit records broader verification.
