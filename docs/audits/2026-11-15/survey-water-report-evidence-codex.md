# Survey water evidence in site reports — 15 November 2026

- Auditor: Codex implementation owner plus separate actual Codex read-only source/output support. Neither is Claude or AGY.
- Revision: `codex/report-survey-water-evidence-20261115`, based on `0ee2e63e1f04f4e7290b9f712e618458de2876f8` (tree `7fe0ab9473a596ca6c330377732ff4f633fc7ead`), plus this commit's changes.
- Previous audit: [Survey roof evidence](survey-roof-report-evidence-codex.md). Parent0ee actual preview/security/render succeeded; fullCI is still running. Accepted actual Claude9c R1/R2/R3 review is retained, not approval of either report successor.
- Scope: actual general site-report prompt/header water evidence attribution, including map/design-only missingness and independent reported survey choices.
- Deployment/CI: successor pending at commit; exact handles/results belong in PR and issue35. No production merge/release.

## Finding and correction

| ID | User-visible problem | Disposition |
| --- | --- | --- |
| SURVEY-REPORT-WATER-01 | Map-only inventory checks said a borehole/river/dam/pond was not recorded in the supplied map/survey even when the supplied survey selected it. Broad Nothing/no-tank copy also ignored surveyjojo/cistern choices | Scope existing inventory/gaps strictly to supplied map/design facts. Carry a separate normalized, source-labelled survey choice summary into actual prompt and deterministic header. No combined inventory, feature identity, capacity addition or silent source precedence. Two baseline assertions reproduced the false scope. |
| SURVEY-REPORT-WATER-01A | Body-only/polygon-only map evidence could still hit the independent universal Nothing branch | Explicitly retain supplied body records and polygon-input flag, qualified as unverified records. A polygon flag supplies no type, dimensions, capacity or access claim. |

The report-only pure helper mirrors existing trim/dedupe string-array validation, preserving missing, explicitnone, unknown and conflictingnone+positive choices. It uses exact existing UI IDs/labels; municipal/rainwater/grey do not become a tank, river or well. Unknown historical entries remain visibly unrecognized, with structural characters safely represented in the new table row. Existing saved arrays/schema/normalization are unchanged. A reported choice establishes no verified access, condition, reliability, count, capacity or available supply.

Mapped tank status/count/capacity and geographic pin scope remain unchanged. Survey records may describe the same feature; do not add their quantities or silently overwrite either source. New copy is explicitly English/translation-pending outside English. Historical source fixtures stay byte-identical; only false map/survey scope expectations are revised, retaining all other translation, number, name and provenance assertions.

## Verification

- Ordered Node24 typecheck passed;360 affected checks across23files passed, zero failures/skips/cancelled/todo. Complete focused-render674/674, likewise zero failures/skips/cancelled/todo. Whitespace/release-note checks pass. New regression file is in the full-suite command. Narrow note stamped0ee2e63e1; previous notes retained.
- Meaningful controls cover survey sources/storage only, indirect sources, mapped tank plus reportednone, mixednone+jojo, unknown/malformed/duplicate entries, table structural characters, unanswered versus explicitnone, body-only/polygon-only map evidence, pending translations and six realPOST cases. Baseline2assertions failed on the original attribution copy.
- Actual POST runs isolate auth/country/provider seams and retain full input/prompt/returned report captures. Model narrative explicitly says it is synthetic, not generated farming advice. No live provider or paid call.
- Actual application buildReportPdf generated three originals (four pages each) for survey resources, mapped2500L tank plus survey-none, and mixednone+jojo. All12 pages inspected: survey choice/source rows readable and complete, map-only gaps properly scoped, known mapped2500L retained once, mixed answers and reconciliation warning visible. Other three route cases have text captures only, not PDFs. Existing general PDF table styling remains, not a typography redesign.
- Independent actual Codex source review found no actionable defect; separately supplied actual captures/pages are inspected in its output review. These bounded checks do not replace currentCI or external successor review.
- Private receipts: `survey-water-report-evidence-20261115` under the existing Imbewu private research root: source audit, plan, baseline assertions, exact commands/logs, LOCAL-VERIFICATION.json, source/output reviews and actual captures/PNGs. No personal records, secrets or raw logs are committed.

## Limits and continuation

No water volume/count/demand/reliability or farming recommendation is invented from a checkbox. No auth/paid/provider/country gate, species, lessons, saved schema/geometry or PLAN_VERSION changes. This changes report text/layout; no claim of live model compliance, physical inventory or agronomic approval.

Full successor CI/security/preview and exact affected external reviews remain separate. Carry original24cases, FIELD-PERIOD-06, PROVISIONAL-PRINT-04, NURSERY-SK-06, P04/G03, source-reuse, local-agronomy and signed-in/device limits. Legacy workers/household observation is not silently fixed by this task.

Next: push this finished stacked branch once, inspect actual CI/hosted build and prepare one combined roof/water manual review delta from accepted9c. Parent review/archive remains immutable; AGY automatic dispatch stays disabled and Rory initiates external manual reviews.
