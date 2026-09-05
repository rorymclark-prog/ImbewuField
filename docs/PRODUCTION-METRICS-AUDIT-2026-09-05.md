# Production area and recorded returns — 5 September 2026

## Decisions implemented

The farmer gets three cards: vegetable beds, staple plots and combined. The measure is **recorded sales minus assigned costs / current mapped physical area**, in rand per square metre for the selected month, season or calendar year. It is a recorded contribution indicator, not a full economic-profit claim. Unpaid invoices are excluded, paid invoices are counted once including non-kg lines, and unknown costs remain visible.

Sales, expenses and invoices have an optional growing-area assignment. Crop names are not enough to infer an enterprise: beans can be a vegetable or a staple. Shared crop costs reduce the combined figure once and are not arbitrarily divided between enterprises. Orchard/other entries stay outside these three cards. Missing assignments and unmapped areas show no ratio, not zero profit. Combined is total contribution / total area, not the average of two ratios. Calendar cropping cycles do not duplicate physical area.

The NGO and funder platforms now include Production area. NGOs register a stable physical-garden code, actual vegetable and staple area, observation date, optional boundary area, measurement evidence and an explicit publication choice. Updates replace that site's current observation and retain an audit history. The NGO confirms no duplicate site code or overlapping crop area. Code uniqueness prevents repeated updates from adding hectares; it cannot automatically detect one garden entered under two different codes. The register explains that limitation and excludes paths, buildings, fallow and orchard areas from these two categories.

Funders receive selected area totals only, with number of sites and observation-date range. No private site notes, names or staff IDs are returned. Existing organisation grants and the NGO's master funder-access switch apply on the server. A scoped NGO manager can write; an analyst can read; direct browser database reads/writes are denied. The original cohort tile now says **Reported plot area** and explains that reports may overlap through shared gardens. It is not presented as verified production.

## Interpretation and remaining limits

- The farmer denominator is today's mapped area. Comparing past years after changing a map requires saved period-specific area observations; the cards do not manufacture a historical denominator.
- Funders do not get an automatic farm-income / registered-area ratio. The income rows are not yet linked to the same measured sites and dates with complete cost attribution. Such a ratio would look precise while comparing different populations. The new farmer cards and area register establish the required records first.
- Latest observations can have different dates. The funder view displays this range and asks for a fresh common-period review. NGO-checked means an NGO observation, not independent verification.
- No live measurements, assignments or publication decisions were invented or entered for the NGO.
- Existing invoices have no growing-area tag until edited. Generated kg-sale rows inherit an explicitly assigned invoice enterprise; unknown weights are never converted to kg.
- All changes are outside Design Studio. No render, geometry, asset or PLAN_VERSION changes.

## Next funder deliverables supported by the data model

Publish period, baseline, target, actual, source, coverage and review date alongside each metric. Useful measures include unique active gardens and participants; checked productive hectares; harvest kg by crop; kg sold, eaten, donated and lost; recorded sales and costs; training attendance and practical skill completion; support visits and issues resolved; reliable-water days; survival of actual planted cohorts (with replacements separately); assessment assignment/completion rates and matched baseline-to-closeout change. Do not infer meals, household consumption, jobs, carbon or causally attributable impact from harvest or survey totals alone. Sensitive participant feedback stays in the NGO analysis view.

## Research used

- [NMSU: enterprise budgets](https://pubs.nmsu.edu/_z/Z121/index.html): separate income and relevant costs before interpreting returns; distinguish an enterprise result from full farm profitability.
- [University of Minnesota: crop budgets](https://extension.umn.edu/agriculture/farm-operations-and-systems/agricultural-business-management/farm-finance/crop-budgets): budget assumptions and enterprise costs matter to comparisons.
- [FAO CropGrids](https://www.fao.org/agroinformatics/training-and-resources/data-sets/data-set-detail/cropgrids-data-on-harvested-and-crop-areas/en): physical crop area and harvested area are different concepts when land is cropped more than once.
- [IFRC evaluation framework](https://www.ifrc.org/sites/default/files/2024-06/IFRC%20Framework%20for%20Evaluations%202024.pdf): use evaluative evidence for learning and accountability, with transparent limitations.
- [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): server-side checks on each request, default denial and least privilege.

## Verification

Regression cases cover weighted combined returns, shared costs, unknowns, paid-invoice duplication and discounts, cross-year seasons, invalid area/date inputs, duplicate garden observations, withdrawal from funder totals, organisation boundaries and publication permissions. Firestore emulator checks cover direct access to both current observations and history. Preview and CI results are recorded in the pull request and deployment runs.

## Browser-review corrections

The adjoining site overview claimed rainfall alone ensured year-round production and compost would double yield within two seasons. Those promises have been removed. Generic soil-carbon defaults no longer trigger a measured-soil assessment there. Short report choices now open the reading pane directly on phones; long translated controls wrap instead of clipping.

The funder headline no longer presents a blanket R15/kg residual as household benefit. Its replacement reports actual training-record coverage. Cohort charts, CSV and farmer-detail labels call harvest minus sales an unmatched balance; it may reflect storage, consumption, donation, losses or incomplete logging. The older per-farmer value calculation remains available only as an explicitly labelled hypothetical scenario, never revenue or profit.
