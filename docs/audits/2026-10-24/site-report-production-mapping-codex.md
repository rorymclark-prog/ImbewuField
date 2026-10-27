# Site reports, annual production and Record plan — 24 October 2026

- Auditor: Codex, continuing Rory's requests to reuse prior work, include annual animal/food-forest products in the survey and distinguish potential from the assembled site plan.
- Reviewed revision: base `0858cf137` (main, including the organisation/funder report work); checkpoint `256c1beab`; branch `codex/report-map-option-20261023`, plus the changes committed with this record.
- Deployment inspected: local development preview only, `http://localhost:3019/audit-record-plan-preview`. The temporary route is removed before commit. No claim that this branch is deployed to production.
- Previous survey record: [22 October draft recovery and signed-in Ubhejane check](../2026-10-22/survey-draft-recovery-codex.md).
- Previous production record: [10 October re-audit](../2026-10-10/production-reaudit-codex.md), including its earlier product, age and regional-calendar audits.
- Evidence: source/history review, mounted-component tests, Chrome desktop and 390 × 844 emulation, actual PNG/SVG downloads, actual 5-page and 7-page PDF exports rendered and inspected.

## What was already done — read before the next iteration

The crop planner already has whole-year vegetables and storage, placed food-forest
products, explicit animal enterprises, confirmed local seasons, source references
and tree-age gates. This iteration calls `buildFoodAvailability`,
`calendarProduceByMonth`, `planningTreeSeasons` and their existing site-specific
choice stores. It adds a report snapshot and view, rather than another production
model. The underlying species, source figures and farming calculations are retained.

The screenshot Rory supplied was the existing `sitePlanFigure` report diagram.
**Record plan** exposes that same drawing in Preview & export. It uses the existing
PNG rasteriser, file delivery and Saved maps gallery; it adds no paid render path,
geometry changes or parallel map store.

The comprehensive Ubhejane work was recovered from the earlier branch, not redone:

- [Six-report catalogue, 3 October](https://github.com/rorymclark-prog/ImbewuField/blob/716fb585fa43b54fbfbb8d8777a6b8ba75ba4342/docs/audits/2026-10-03/ubhejane-six-report-continuation-codex.md).
- [Coverage and stages audit, 2 October](https://github.com/rorymclark-prog/ImbewuField/blob/716fb585fa43b54fbfbb8d8777a6b8ba75ba4342/docs/audits/2026-10-02/site-report-coverage-and-stages-codex.md).

The six private PDFs remain under
`/Users/roryclark/Documents/ImbewuField App/Reports/2026-10-03/Ubhejane Creche/`.
Its README, index, evidence and editable authoring sources are the starting point
for the next real Ubhejane document edition. Assessment has 3/10 pages,
design/implementation 3/12, and progress/review 2/7. They have not been overwritten,
regenerated or silently imported into app history. Their progress editions are
an evidence baseline, not proof of achieved work or harvests.

Rory's latest instruction refines the earlier three-stage proposal to **two main
site reports**: Site potential, then Complete site plan once the evidence is
assembled. Progress review is a later follow-up. Short/comprehensive questionnaire,
plain/detailed wording, report depth and reading edition remain separate choices.

## Findings and disposition

| ID | Problem or coverage gap | Status | Evidence / continuation |
| --- | --- | --- | --- |
| SS-001 | Unfinished survey recovery | Retain 22 October verification | Draft storage is reused. Purpose also round-trips through recovery without publishing unfinished observations. |
| SS-002 | Fluent isiZulu review | Open | No fluent sign-off is claimed. New annual-product content and the report-purpose guide are explicitly English; short new labels need review. The pinned i18n file is untouched. |
| SS-003 | Real signed-in saved-survey handoff | Retain 22 October verification; paid narrative not checked | This pass uses disposable sample data and automated request capture. It does not replace that signed-in evidence or certify a generated comprehensive narrative. |
| SS-004 | Physical phone / Safari checks | Open | Chrome phone emulation is verified; actual Safari, device share and offline delivery remain to check. |
| SS-008 | Prepared sample could appear comprehensive because unused settings were shown | Implemented and locally verified | Prepared origin is persisted; unused tone/depth/section/bilingual controls are hidden; refresh creates a new example snapshot. Full/summary exports state the limitation. Older unknown origins remain unknown. |
| SS-009 | Report purpose versus detail was unclear | Implemented for two main purposes; historical six reports preserved | Survey welcome and generator select potential/complete. The API receives purpose for each batch. Saved metadata, history and PDF labels use captured settings, not next-report controls. No paid AI call was made in this audit. |
| SS-010 | Structured, current local-economy evidence | Open | Existing notes and evidence remain; this iteration adds no invented buyer demand, prices or economic figures. |
| SS-011 | Annual crop/food-forest/animal picture did not reach the survey and saved report | Implemented and locally verified | Existing builders feed one dated snapshot, survey review, report screen, prompt and PDF. Tree-only sites remain visible. Unknown honey timing stays undated; housing is never turned into animal numbers or output. Reported harvest year and per-product harvest months remain a separate observation section. |
| SS-012 | Requested record diagram was confined to reports | Implemented and locally verified | Open Record plan, download PNG/SVG, add to existing Saved maps, then choose it for the report cover/appendix. Owner checks protect asynchronous image preparation. |

Existing CP findings retain the dispositions in the 10 October register. This pass
reuses those fixes; it does not reopen them or introduce new yield assumptions.

## Visual evidence and limits

These screenshots and PDFs use the **public tour fixture**, with explicitly
synthetic proposed coop/hive rows and test months added for product-display QA.
They are not a fresh audit of the private Ubhejane farm. The fixture climate is
for UI testing, not agronomic validation for those coordinates. None of those
test records, routes or raw exports is committed as farm evidence.

- [Record plan desktop](evidence-record-plan/record-plan-desktop.png) and [phone](evidence-record-plan/record-plan-phone.png): diagram, legend, scale and download/save controls inspected. Both image formats actually downloaded; the saved-map card appeared and could be selected in the report.
- [Two purposes on desktop](evidence-record-plan/survey-purpose-desktop.png) and [phone](evidence-record-plan/survey-purpose-phone.png): purpose is independent of short/comprehensive length; the selected purpose survives draft recovery.
- [Report guide and honest sample controls](evidence-record-plan/report-purpose-desktop.png).
- [Survey production overview](evidence-record-plan/annual-survey-desktop.png), [products](evidence-record-plan/annual-products-desktop.png) and [phone table](evidence-record-plan/annual-products-phone.png). On phone, document width remained 390px while the calendar scrolled (337px viewport, 920px content, measured 80px scroll); product names stay pinned.
- [Actual PDF annual-calendar page](evidence-record-plan/annual-calendar-pdf-page.png): P/R windows, future-year labels, source qualifiers and planned eggs inspected. All seven full-export pages and all five field-guide pages were rendered and viewed. Text-bound checks found no glyph outside page bounds. Scope appeared on every field-guide page; its crop page acknowledges orchard and animal products.

The final local 7-page export is an English prepared example with image plates
excluded. Earlier in this iteration the original 4-page prepared export and its
5-page guide were also rendered and inspected. These checks establish layout and
source labelling, not the adequacy of generated advice or field measurements.
The local preview uses a temporary font response fixture because Google Fonts
fetching is restricted; production font imports were not changed.

## Verification

- Typecheck: `npx tsc --noEmit` clean on Node 24.19 after removing the temporary QA route and its generated Next type.
- Focused regression run: **169 passed, 0 failed** (5.2s), covering report snapshots, purposes, survey drafts, exports, map controls, release notes and the current map/report UI guards.
- Full suite: final Node 24 run is in progress at commit time; read the CI result and issue #35 handover before merging. An earlier superseded local run found one source-guard compatibility failure in DesignGlossy; the map component now reads its own language and the unchanged guard passes. No assertions were deleted or weakened.
- Whitespace: `git diff --check` clean before final verification.
- No paid generation, real-farm writes, production deploy, new species, saved-geometry mutation, lesson changes or `PLAN_VERSION` change. **This changes the picture.**

## Next continuation

1. Review/merge this branch after green typecheck and full-suite CI. Inspect Preview & export → Record plan, Site questionnaire → purpose, and report → crop/production plan on the deployed preview.
2. Use the private 3 October authoring/evidence folder when producing a new real Ubhejane edition. Refresh its evidence deliberately and save under a new date. Keep the old six PDFs and distinguish the new two-purpose organisation from historical progress editions.
3. Check an authorised real generated report for both purposes, including economic/ecological gaps and captured annual products. Missing source data must remain explicit. This audit did not spend tokens on that generation.
4. Continue SS-002, SS-004 and SS-010 with fluent review, physical devices and current local evidence. A mapped plan is not installed work; a product window is not a harvest or a food-adequacy claim.

Both AGENTS.md §5b and CLAUDE.md already require reading the shared audit index.
That index and PROGRESS.md now point here and to the recovered report catalogue,
so the next audit starts from this work rather than recreating it.
