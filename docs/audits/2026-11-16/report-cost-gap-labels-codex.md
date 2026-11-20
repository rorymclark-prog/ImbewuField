# Cost-gap report labels - 16 November 2026

- Auditor / implementation owner: Command Centre Codex.
- Starting revision: `49bf1a359de541b9a2dbbf5e28fb6052e6b64cee`, tree
  `e3fca9a745249192e0396449b6ab7c93af6456dc`.
- Branch: `codex/report-cost-gap-labels-20261116`, stacked on PR1389.
- Reviewed revision: parent plus this committed display-copy correction;
  final source/output bindings retained privately.
- Deployment inspected: none for this successor before push.
- Previous audit: [Entirely unpriced report wording](report-unpriced-subtotal-wording-codex.md).
- Evidence: actual Claude parent output review, baseline regressions, affected
  tests, controlled report POST/PDF outputs and Codex visual/source inspection.

## What was already done

Claude `claude-opus-5-5` actually received three parent PDFs, including the
36-page combined document. It read all 36 pages as text and inspected eight
pages as images. It confirmed C-1 and the mixed-purchase corrections in those
outputs, while leaving ZIP/commit/source bindings, chart and finished CI
unverified. Its prose report subtotals were inconsistent; the original page
map establishes nine originals: seven full reports and two short summaries.
This bounded acceptance is not successor or release approval.

The parent preserves unknown purchase quantities, known partial prices, a
stated zero and exact existing-tank mirror handling. Original G01-G05/P01-P24
and the applicable external gates remain in scope. No agricultural accuracy is
inferred from an AI review or software test result.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CLAUDE-49BF-R-1 | An unmeasured greenhouse is called a measured line awaiting a rate; the mitigation presumes a priced subtotal exists. | Implemented and locally verified | Cost-gap rows now explain an unconfirmed measurement or rate, ask for missing quantities/measurements and quotes, and avoid implying an established full cost. Existing counts, triggers and qualitative ratings stay unchanged. Actual successor review/CI remain separate. |
| CLAUDE-49BF-SUMMARY-COPY | A short summary calls unknown calculated cost "Not recorded" and labels mixed purchase-count gaps as price/measurement gaps only. | Implemented and locally verified | Unknown priced subtotals say "Not established". Mixed-group count labels explicitly include purchase quantity. Other missing-record labels and ordinary non-mixed count labels remain unchanged. |
| CLAUDE-49BF-PAGINATION | The isiZulu mixed note and bill table can occupy separate pages. | Retained non-blocking observation | The note and all rows remain present; Claude reported no clipping/data loss. This correction changes no pagination engine or imposed page limit. |

New copy outside English is visibly English/translation-pending. The historical
translation corpus remains unchanged; strict snapshot tests project only the
identified superseded wording while retaining every other row, source number,
figure, rating, identity and field. No prices, calculations, saved records,
species, lessons, geometry, security controls or `PLAN_VERSION` change.

## Verification

- Node 24.22.3 typecheck: clean. A 2 GB heap attempt exhausted memory; the
  successful 4 GB incremental check ran sequentially, without a local build.
- Two new tests fail on the parent for the actual incorrect risk text and
  unestablished-subtotal label. An environment failure is not the baseline.
- Thirteen affected files: **193/193** checks pass; zero failures, cancellations,
  skips or TODOs. Two historical cost-corpus projections initially exposed the
  changed empty-subtotal label and were updated explicitly; no fixture bytes,
  numeric controls or unrelated assertions were removed.
- Whitespace and release-note checks pass. No full local suite repeated;
  exact successor full CI, rules, render and preview remain required.
- Seven fresh controlled actual report POSTs; eleven application-written PDFs,
  42 pages, including English and isiZulu one/five-page summaries. Auth/country,
  provider and narrative seams are isolated; no live provider generation.
- Root inspected two 36-page montages and seven individual changed pages:
  no-area English4, no-rate English4, no-area isiZulu4, and English/isiZulu
  one-page summary1 and five-page summary4. The new copy is legible in those
  pages with no observed clipping. This is not fluent-language acceptance or
  a claim to have read every body line at full size.
- All 17 retained input/BOQ/visual model files match the parent byte-for-byte;
  the current partial-cost SVG is also byte-identical. Existing chart raster
  reuse remains explicit, not a newly rendered current PNG claim.
- 820 tracked runtime/package/country-fixture paths are hashed immediately
  before/after capture, then compared with final committed source. This does
  not bind dependency bytes or establish a live account/device test.
- Independent Codex seven-file source/test/note review found no actionable
  remaining defect. Its cost-corpus finding was corrected. It ran no suites
  and made no visual or Claude/AGY acceptance claim.

This changes the picture: cost-risk row text and short cost labels change.
Detailed captures, logs, visual receipts and exact commit bindings stay private
under `report-cost-gap-labels-20261116` in the programme evidence root.

## Next continuation

Push this finished branch once, inspect exact successor CI and prepare one
affected-delta review with actual outputs and source bindings. Preserve the
parent's scoped acceptance; do not repeat its source audit. Leave Send to Rory
in official Claude Desktop. The manual AGY task remains pinned to05d unchanged;
automatic AGY calls/UI/auth/account/key/polling remain disabled. Retain original
source/runtime limits and the prospective P22 protocol without inventing a
worldwide field-trial release requirement.
