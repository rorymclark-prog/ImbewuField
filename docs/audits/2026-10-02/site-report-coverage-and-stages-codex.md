# Site report coverage and stages audit 2 October 2026

The completed Ubhejane example demonstrates the questionnaire, saved facts and
prepared sample export. It does not demonstrate a comprehensive live assessment.
Rory's follow-up asks for the climate, ecology, local economy and agricultural
potential already developed, and a clear distinction between assessment and
proposed design. Preserve the existing comprehensive work and extend it.

- Auditor: Codex.
- Reviewed revision: `68443bd3f272ae341712fb7ddf0cc6effdf56217`,
  `codex/site-survey-visual-review-20261002`; this continuation adds documentation.
- Deployment inspected: none in this continuation. No paid generation performed.
- Previous audit: [completed survey and visual review](site-survey-completed-visual-codex.md).
  Findings SS-001 through SS-007 retain their recorded dispositions.
- Scope: prepared sample, comprehensive generator, historical report coverage,
  report editions and recommended stages of work.
- Evidence: source review, historical PDF text and selected rendered pages,
  earlier dated audits, and primary FAO land-evaluation guidance.

## Comprehensive work already present

The current narrative generator has 20 selectable sections, including Site
Conditions, Natural Vegetation and Biome, Animals and Livestock, Economic
Opportunities, water, soil, crop rotation, planting and seasonal calendars,
plant guilds, zones, hazards, the five-year vision and first-year priorities.
See [ReportView](../../../components/ReportView.tsx) and the
[generation route](../../../app/api/generate-report/route.ts).

The [5 September audit](../../SITE-REPORT-AUDIT-2026-09-05.md) documents a supplied
34-page Zululand Lowveld PDF. That exact PDF was not recovered in this search;
its existence and the earlier review are evidenced by the audit.

A different historical comprehensive PDF and a separate farmer visual PDF were
recovered locally under Downloads, in the Imbewu training-report collection.
They are 16 and seven pages respectively. The comprehensive cover dates itself
25 June 2026; its PDF metadata says creation on 26 June. They are historical
references, not current app exports. The recovered originals remain local;
personal site photographs, location details and financial/production assumptions
have not been copied into this shared Git archive.

The 16-page report includes site photographs, climate and water, soil, ecological
planting design, livelihoods, animal discussion, actions, budget and monitoring.
Its final page explicitly recommends a farmer report plus a consultant/mentor
appendix containing raw climate data, soil sources, assumptions, water
calculations, risk reasoning, market notes and field evidence. This supports
building on the established report editions rather than discarding them.

Some historical figures are assumptions or uncalibrated scores. The September
audit subsequently removed unsupported soil defaults and water calculations
from current generation. Do not restore those earlier numbers or treat a long
historical report as verified farming guidance.

The existing [structured report document](../../../lib/report-doc.ts) also
contains an 11-section assessment/design/implementation/monitoring skeleton.
Reuse its relevant structure and the saved-facts pipeline; do not create another
independent authority for the same site measurements.

## Findings and disposition

| ID | User-visible gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SS-008 | The prepared sample cannot demonstrate comprehensive advice, even when Comprehensive is selected. | Verified in source; clarification needed | `sampleFullSiteReport` assembles five summary pages plus inventory and limitations. The sample Generate branch ignores selected sections, wording and advice depth; language is used. Make sample coverage explicit and verify future examples against their advertised scope. |
| SS-009 | Report depth, reading edition and project stage are different choices, but there is no explicit assessment-versus-design stage in the reviewed report controls. | Improvement proposal | The generator mixes baseline conditions with proposed interventions. Add stage identity while retaining simple/full editions; the recommended structure below is not yet implemented. |
| SS-010 | A local Economic Opportunities chapter can read as researched market evidence without a structured verified local economic source. | Verified evidence gap in the narrative generation route | The prompt asks for local buyers, infrastructure, demand and market gaps, using administrative location and model knowledge. Establish dated sources and farmer/market observations; label unsupported opportunities as possibilities to investigate. Do not promise demand, yields, stocking capacity or income. |

Questionnaire route (Short/Comprehensive), report wording (Simple/Detailed),
advice depth (Brief/Standard/Comprehensive) and reading edition (At a glance,
Field guide, Complete report) are separate. A completed comprehensive survey or
a Complete report reading view does not prove comprehensive generated analysis.
Simple wording should remain available for a full report without removing
essential subject areas.

## Recommended stages and content

Use one shared site evidence record with dated report snapshots. Offer three
report types; improve the first assessment through field evidence rather than
requiring another confusing report choice.

| Report | When and purpose | Required content |
| --- | --- | --- |
| Site assessment and potential | Before committing to a design. Begin with available desk data and farmer goals; issue an updated field-checked assessment after the visit. | Site and regional description; climate and seasons; terrain, soils and water; biome, actual vegetation and biodiversity; bioresource information where available; current land uses and infrastructure; crop and animal possibilities; household food/livelihood priorities; access, tenure, labour, skills and budget; local economy and markets; constraints, unknowns and field checks. |
| Design and implementation | Once the baseline supports specific choices. State which dated assessment and design are being used. | Options and why the chosen design fits the evidence; zones and sectors; maps; water, soil and habitat systems; crop/animal integration; existing versus proposed works; quantities, quoted and unpriced costs, labour, dependencies, phasing, maintenance, monitoring and matters needing specialist review. |
| Progress and review | After implementation starts and at later dated reviews. | Actual completed work, expenditure and recorded production; water/soil/ecological observations; maintenance and problems; comparison with the baseline and proposal; justified changes for the next iteration. Proposed items and expected benefits remain separate from recorded outcomes. |

The assessment must describe how conditions affect each possible use. A single
site-potential score cannot establish suitability for every crop, livestock
system or restoration option. Identify limiting factors and what evidence would
change the conclusion. Modelled climate and soils, mapped ecological context,
farmer statements, observations and laboratory measurements need distinct source
and date labels.

Climate coverage should explain rainfall distribution, dry-season reliability,
temperature, frost, heat, wind and observed microclimates rather than displaying
an annual number alone. Ecology coverage should explain natural habitat,
disturbance, watercourses, conservation needs and opportunities for soil cover,
habitat connections and crop diversity. Agricultural potential must consider
soil/rooting/drainage, reliable water, available area and management capacity.

Animal potential starts in the assessment with feed, seasonal water, space,
management and access to animal-health support. Detailed housing, integration
and operating requirements belong in the chosen design. Drawing an animal
structure does not establish its carrying capacity or enterprise suitability.

Economic context belongs before design: current local production, household
needs, actual buyers, access and transport, input availability, seasonal demand,
labour and capital constraints. Enterprise selection and sourced budgets then
belong in the design report. Actual sales and costs belong in progress records.

The app already has SANBI vegetation lookup and KZN BRU polygon data. The latter
provides an actual mapped BRU code only within its coverage. Its nearest named
Bioresource Group is explicitly a climate-similarity approximation, not a verified
BRU-to-BRG crosswalk. Retain that distinction and show unavailable data honestly
outside coverage. A biome or BRU alone is insufficient for a site recommendation.

Each report can offer a concise farmer edition and a full edition with source
notes and appendices. A combined dossier may assemble assessment, design and
progress for a mentor or funder, preserving their separate dates and baselines.
Do not silently rewrite an earlier assessment when a later design changes.

This is a proposed product structure, informed by
[FAO land evaluation](https://www.fao.org/4/u1980e/u1980e03.htm): assess particular
land uses against physical, environmental and socioeconomic conditions, refine
detail through stages, and identify limitations of the underlying evidence.
It is not a newly generated agronomic assessment of the example site.

## Verification

- Node 24 typecheck: clean. Full suite: 4,484 tests, 4,483 pass, zero failures
  and one existing shape-sync TODO. No test was added or changed for this
  documentation continuation. All 111 local audit links resolve.
- Source and export scope were checked against the reviewed commit.
- Historical comprehensive PDF pages 1, 8, 12 and 16 were rendered and inspected;
  all text was searched for coverage. This was not a complete layout or agronomic
  audit of that historical PDF. The separate farmer PDF's page count was checked.
- Temporary rendered personal-site pages are excluded from Git.
- No new app UI, report narrative, measurements or farming recommendations were
  generated. This documentation does not change the picture; `PLAN_VERSION`
  remains unchanged. Live comprehensive output and saved account history were
  not inspected in this continuation.

## Next continuation

1. Resolve SS-008 with clear sample scope and accurate report identity. Preserve
   the current concise export as an example of its actual coverage.
2. Build assessment/design/progress identity into the existing report workspace,
   saved snapshot and export. Confirm an assessment can be created before a
   design exists, and that later work retains the earlier dated version.
3. Check comprehensive coverage against Rory's requested domains, especially
   ecology, BRU limits, livestock potential and local economic evidence. Preserve
   existing verified data and remove no established chapter merely to simplify
   wording. Mark missing facts and sources instead of filling them with guesses.
4. Exercise short and full editions against the same saved site and inspect the
   actual browser/PDF outputs. Use saved comprehensive reports where available;
   a paid generation is unnecessary for checking identity and evidence handling.

Implementation remains dependent on the review sequence for PR #883 followed by
PR #885. This documentation continuation rides with PR #885 and does not claim
the proposed report stages have shipped.
