# Cost chart gap caption audit — 17 November 2026

- Auditor: Codex; separate bounded Codex source review, distinct from Claude.
- Reviewed revision: parent `ec3017742f7bfe1510d0594845285d2eaec0c223`, branch `codex/report-chart-gap-caption-20261117` plus recorded local changes.
- Deployment inspected: successor not yet inspected; parent acceptance is retained in its own scope.
- Previous audit: [Cost-gap report labels](../2026-11-16/report-cost-gap-labels-codex.md).
- Scope: the cost caption produced by `siteReportVisuals` and displayed by `ReportChartCard`; no farming calculations or persistence changes.
- Evidence type: actual external review, source, regression tests and component output captures; CI and successor review separate.

## What was already done

Claude's actual ec301 source/CI and output addendum accepted the parent's cost-risk
and summary corrections, all eleven PDFs/42 pages and the current cost SVG with
its explicitly historical raster reference. That acceptance remains bounded to
ec301. The addendum noted a pre-existing cost-chart caption (O-1): “1 lines still
need a price or measurement” also misdescribed an unconfirmed mixed-group purchase
count. The actual screen card displays that note, although the product PDF/SVG
do not print it. Correct that remaining user-visible inconsistency.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CLAUDE-EC30-O-1 | Singular chart gaps say “1 lines”; mixed purchase-count gaps mention only price/measurement. | Implemented; local checks pass | Singular and mixed captions explicitly name purchase quantity, measurement or price. Ordinary plural non-mixed copy and all existing translation call-site pairs remain exact. Current component output inspection and successor gates recorded below. |
| CLAUDE-EC30-B-1 | Historical fallback page-map hashes compared empty content. | Corrected in separate private erratum | Root checked a strict decoder that rejects missing/empty content; all42 original/fallback page pairs match nonempty decoded bytes, text, geometry and pixels. Eight controls include a serialized PDF with altered visible title. Original packet/PDFs/manifest/page-map remain immutable; corrected map explicitly supersedes the faulty field. This is Codex repair, not a new Claude disposition. |
| CLAUDE-EC30-B-2 | Intermediate receipt listed9PDF/36pages and missed no-area isiZulu page4 change. | Corrected in separate private erratum | Corrected receipt lists11PDF/42pages, page4 change and two current-only isiZulu summaries with no parent comparison. Historical receipt retained. |
| CLAUDE-EC30-O-2 | Existing chart uses currency suffix while report tables use a prefix. | Retained informational observation | Exact same amount/unit; SVG and currency formatting are unchanged in this correction. |

Existing priced groups, bars, subtotals, unpriced count and source facts remain
unchanged. A mixed inventory group still has no inferred purchase share. New
copy outside English is explicitly English/translation-pending; no translated
safety claim is invented. Frozen translation fixtures and literal pairs remain
unchanged. No species, lessons, geometry, persisted records, thresholds, prices,
security controls or `PLAN_VERSION` change.

## Verification

- Node24 typecheck clean, sequential4GB heap; no local build.
- Four affected files:51tests pass, zero fail/cancel/skip/TODO. Includes singular
  measurement, mixed singular/plural, allfive supported display languages,
  unchanged priced rows/facts, actual card rendering and frozen source pairs.
- B-1/B-2 strict erratum root `--check` passes against immutable originals;
  11PDF/42pages and8controls. No product PDFs regenerated for this screen caption.
- Independent Codex source review found no actionable defect; no suites or visual
  acceptance claimed by that reviewer.
- Parent reproduction fails on the intended new assertion via an in-memory
  parent Git-source hook; no application files swapped, no environment failure.
- Eight actual server-rendered card/CSS captures (four scenarios,360/900px) were
  viewed by root: corrected captions are legible with no observed clipping or
  overlap. All116 loaded tracked source/CSS bindings match current bytes; only
  report-visuals differs from the parent. Facts/BOQ/visual fields except cost.note
  and every SVG remain identical. Harness is independently hash-bound.
- These are explicitly labelled WeasyPrint component-QA surfaces with supplied
  Arial/Georgia font variables, not hydrated browser/mobile/device/account or
  product-PDF evidence; browser width media queries are not supported here.
- Eleven release-note contract tests pass; whitespace and release anchor checks
  pass. No full local suite rerun. Exact successor CI/preview and actual affected
  Claude review remain required; no release approval claimed.

This changes the picture: screen cost-card caption wording. The chart SVG and
product PDF layouts are not changed by the caption. Detailed private output and
source bindings live under `report-chart-gap-caption-20261117`; B-1/B-2 records
under `report-cost-gap-labels-20261116/evidence-erratum-20261117`.

## Next continuation

Inspect actual current component output at narrow and wide widths, bind it to
the committed successor, push the finished branch once and inspect current CI.
Prepare only this caption delta and the evidence erratum for actual Claude
review; leave Send to Rory in official Claude Desktop. Preserve the independent
manual AGY owner's existing work and original G01–G05/P01–P24 scope. AI agreement,
metadata and tests do not establish agricultural accuracy or release approval.
