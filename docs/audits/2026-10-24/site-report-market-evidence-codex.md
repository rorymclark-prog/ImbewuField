# Site report continuation: market evidence and soil source — 24 October 2026

- Auditor: Codex, continuing Rory's goal to improve the two main site reports from existing work.
- Branch: `codex/report-market-evidence-20261024`, based on PR #1099 head `45d3dabe1932e2d367b71f5811f5f229defce8c6`. **Merge #1099 first.** This is a stacked continuation, not a second implementation of its mapping or production work.
- Previous: [production/mapping implementation](site-report-production-mapping-codex.md) and [CI readability-register correction](site-report-ci-followup-codex.md).
- Real-site evidence: signed-in production workspace, actual five-page native export, the private 3 October evidence/content sources and six-report collection.
- Implementation evidence: source review, storage/draft/capture tests, Chrome desktop and 390 × 844 emulation, actual short and full PDF generation, rendered pages and bounds checks.

## Prior work retained

The [six-report catalogue](https://github.com/rorymclark-prog/ImbewuField/blob/716fb585fa43b54fbfbb8d8777a6b8ba75ba4342/docs/audits/2026-10-03/ubhejane-six-report-continuation-codex.md)
was read along with the private README, evidence JSON and authored page content.
The comprehensive assessment already covers people, climate, terrain, soil,
water, nature/biome, approximate bioresource context, agriculture/animal potential,
economy and decisions. The comprehensive design already contains the saved map,
crop-summary rows, quantities, implementation and maintenance. The progress
edition is an evidence baseline. None was overwritten or presented as a new visit.

The current direction remains **Site potential** and **Complete site plan**,
with progress as a later review. Purpose, questionnaire length, wording, depth
and reading edition are distinct choices. The live production field guide was
checked as a short handout, not treated as the earlier comprehensive assessment.

PR #1099 already reuses the existing whole-year crop, food-forest and animal
calculations and choice stores. Its Record plan is the existing report drawing
exposed as a mapping option. This pass does not add another calendar or drawing
engine. The production site inspected still precedes that unmerged branch.

## Findings carried forward

| ID | Finding | Disposition and evidence |
| --- | --- | --- |
| SS-010 | Structured current local-economy evidence was missing; the prompt demanded genuine market gaps and named buyers even without evidence | **Collection and source handling implemented; current field evidence remains open.** Optional notes, source and observation/discussion date now use the existing survey/draft and captured report facts. The economic prompt no longer demands unsupported buyers, undersupply, current infrastructure, distances or funding. Notes remain farmer-reported, even when dated. No local buyer claims were invented for Ubhejane. |
| SS-014 | Full report header printed generic soil values when no source was recorded | **Implemented and rendered.** Only `lab` and `soilgrids` source values permit the soil figures in this header, matching the existing summary/narrative rule. Unsourced/estimated placeholders become “Not measured; arrange a soil test.” Confirmed source values remain visible with their source. |
| SS-001 | Draft recovery | Retained and extended. Market notes and their date survive close/resume. Drafts remain outside saved report facts. Damaged non-text fields cannot crash recovery or get silently erased. |
| SS-002 | Fluent language review | Still open. New market questions and report source labels remain explicitly English. The pinned translation file and lessons are untouched. No fluent sign-off is claimed. |
| SS-003 | Real saved-site/report handoff | Read-only production audit and actual native export completed; no new paid narrative or field verification. The earlier signed-in handoff evidence remains. |
| SS-004 | Physical phone/Safari delivery | Still open. Chrome phone emulation is evidence of responsive layout only. |
| SS-008 / SS-009 / SS-011 / SS-012 / SS-013 | Prepared origin, two purposes, annual products, mapping and strict readability registry | Retained from #1099. Its full CI checks are still running at this checkpoint; the original missing-registry failure was corrected without weakening assertions. Read the live check result before merging. |

Existing crop-plan CP findings retain the latest production-register dispositions.

## Implementation and checks that can fail

`normaliseMarketEvidence` in the existing pure fact module is the shared authority
for typed notes, bounded text and a real ISO calendar date. Impossible dates and
timestamps are not truncated into valid observations. Partial notes survive;
missing metadata stays missing. The survey save/export date is never substituted
for an observation date. The existing account/site-scoped loaders and draft
compare-and-set rules are reused; there is no parallel evidence store.

The report collector reads the site's saved survey. Capture and normalisation
copy the evidence, so editing current notes cannot rewrite an older saved report.
The prompt receives one source block per generation batch, including when the
Economic Opportunities section is not selected. Administrative context is not
proof of buyer demand. Opportunities without supporting evidence are questions
to investigate; no current sales, price, surplus or profit is inferred.

The full report's deterministic front matter and the five-page handout show the
note, source, observation date and reported-evidence qualification. In the
questionnaire, the optional section is available in both short and comprehensive
routes; switching the selling toggle does not erase the notes. The review shows
all three fields before Save. User text cannot create extra Markdown headings.

The regression checks exercise invalid dates, damaged drafts, unsaved/saved
separation, site isolation, frozen capture, absent source/date, prompt wiring and
both known/unknown soil-source cases. They fail if the collector uses another
site, the save date becomes the observation date, or a placeholder soil number is
printed as a supported measurement. No existing test was deleted or weakened.

## Visual/PDF evidence and limits

The committed images below use **disposable synthetic notes and a public fixture**,
not private Ubhejane buyer records. No fabricated note was written into the real
site. The local harness was isolated from account onboarding and removed after
inspection; it used fallback Arial/Georgia fonts because font downloads are
restricted. Production font configuration was retained.

- [Desktop fields](evidence-market/market-desktop.png) and [phone fields](evidence-market/market-phone.png): optional notes/source/date, focus and caution inspected. Computed field text was 16px, single-line fields 48px high, page/viewport both 390px. A first inspection caught inherited 14px field text; explicit 16px was applied and rechecked.
- Closing/resuming the draft retained the changed source. The review displayed the same note, source and ISO observation date. No real-farm Save or paid generation was used.
- [Actual five-page export, page 5](evidence-market/market-field-guide-page-5.png): source/date and the reported-demand qualification remain readable alongside next actions. The PDF text was also checked for each label.
- [Actual full export, page 1](evidence-market/market-full-page-1.png): source/date remain visible; unsourced soil figures are absent. All three full-export pages were rendered and inspected. Bounds checks found no off-page text. The five-page fixture export was generated; its changed final page was rendered/inspected. The other four reuse the previously verified layout.
- The actual real-site field guide has five pages, all rendered and inspected, with zero off-page glyphs. A new three-page private continuation audit was rendered and all pages inspected, also with zero off-page glyphs. It explains how the two purposes reuse the earlier comprehensive work, and lists evidence still needed. It is an audit, not a replacement comprehensive site report.

Private outputs are under
`/Users/roryclark/Documents/ImbewuField App/Reports/2026-10-24/Ubhejane Creche audit/`.
The original six reports remain under the 3 October folder. Private records,
precise site coordinates and actual exports are not committed here.

## Verification and handover

- Final source typecheck: `npx tsc --noEmit` clean on Node 24 after removing the temporary harness and restoring generated `next-env.d.ts`.
- Final focused regression run: **211 passed, 0 failed** (12.9s), covering survey/storage, report facts, immutable saved reports, source/purpose prompts, summary language, PDF/document structure, labels, strict type floor and release/UI guards.
- Full `npm test`: running at this checkpoint. Read its completion and the CI result before merge; focused checks are not a full-suite result. The suite has an existing shape-sync TODO documented in the prior audit.
- `git diff --check`: clean.
- No new species or farming figures, geometry mutation, paid calls, lesson/translation changes, secrets, production deployment or `PLAN_VERSION` change. **This changes the picture.**

Next: finish full-suite/CI verification, review #1099 then this continuation, and
retain SS-002/SS-004 plus current market/field evidence as open. Check the deployed
questionnaire Income & sales → Local market notes and full/field-guide exports.
Do not certify a generated comprehensive narrative from these deterministic
source and layout tests.
