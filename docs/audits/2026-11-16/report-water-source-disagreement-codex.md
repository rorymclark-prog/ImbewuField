# Report water record reconciliation — 16 November 2026

- Auditor / implementation owner: Command Centre Codex.
- Branch: `codex/report-water-source-disagreement-20261116`.
- Starting commit: `b8dbdc6264378c2bb681d3bc3df5136765dbbdff`, stacked on PR1386.
- Previous audit: [Legacy watering methods](legacy-water-delivery-codex.md).
- Triggers: actual manually initiated Claude d48 output review O-1/O-2 and I-3;
  actual manually initiated AGY d48 programme review PROG-01/02/03.
- Evidence: exact-source regressions, actual report POSTs, app-written PDFs,
  independent Codex source review, and retained original external reports.

## Findings and corrections

| ID | Problem / correction | State |
| --- | --- | --- |
| CLAUDE-D48-O-2 | Existing mapped/design tank and explicit survey storage `none` appeared without a disagreement note. One pure rule now serves prompt and deterministic table. A legacy mixed existing/proposed group gets qualified reconciliation wording, without assigning installed quantity. Proposed-only or unknown-status tanks, pins, source/delivery none and unanswered storage do not establish this disagreement. Counts, capacities and records are unchanged. | Implemented; affected checks and actual output verified; final external review pending |
| CLAUDE-D48-O-1 / AGY-D48-PROG-03 | Earlier roof outputs belonged to parent0ee. All three retained roof cases and the water cases were regenerated from this correction's source, plus a fractional roof and mixed-status tank case. Source byte bindings must match the final candidate before packet admission. Original artifacts are preserved, not relabelled. | Current-code artifacts inspected; exact Git binding recorded privately after commit |
| CLAUDE-D48-I-3 | Table introduction denied generator-authored wording despite deterministic survey summaries. It now describes records, calculated summaries and gaps truthfully. New copy is visibly English/translation-pending outside English, retaining native headings and historical translation packets. | Implemented and checked in all five report languages; no translation acceptance claimed |
| AGY-D48-PROG-02 | The older SITE SURVEY prompt section filtered `none` out of mixed storage answers. It now retains both recorded IDs; sole none and unanswered remain distinct. The separate shared block keeps its conflict explanation. | Actual baseline failure and route capture verify correction |
| AGY-D48-PROG-01 | Fractional component sums could print binary addition tails. Display-only canonical-decimal addition removes those tails in both subtotal displays. Numeric subtotal, saved components and harvest arithmetic remain untouched. | Verified actual failing pairs and precision/overflow controls |

The AGY report's claimed `60.1 + 15.2` counterexample does **not** reproduce on
Node24: it already prints `75.3`. Real controls include `60.2 + 15.4` printing
`75.60000000000001`, `60.3 + 15.1`, and `0.1 + 0.2`. The original review is kept
unchanged with this erratum. Display uses the two recorded canonical decimal
representations, not arbitrary fixed precision. Very small exponent values and
large finite values remain visible; native overflowing sums remain withheld.
This display convention must never feed agronomic calculations or imply extra
measurement accuracy.

## Verification

- Node24.22.3 typecheck: clean.
- Eight affected files: **156/156** checks pass, zero fail/cancelled/skipped/todo.
  Existing roof, site facts, survey persistence, localization and label assertions
  remain; historical fixtures are byte intact. Two historical comparisons change
  only the superseded introductory sentence, retaining every other exact row.
- Baseline controls: five actual Claude expectation failures; two independently
  reproduced AGY storage/fraction failures before correction.
- Release notes and `git diff --check`: pass.
- **16 actual POST captures; eight actual app PDFs, 32 rendered pages** inspected
  by Codex. The new reconciliation rows wrap on page2 without clipping; separate
  roof sources, decimal components and retained map/design gap wording are legible.
- This changes the picture: report introduction and evidence rows change.
  Geometry, species, lessons and `PLAN_VERSION` do not.
- Current successor CI and external review are separate gates; no pass or approval
  on the accepted d48 parent is relabelled as approval of this correction.

Private originals, exact source hashes, logs and visual receipts are under
`/Users/roryclark/.codex/imbewu-private-research/global-provisional-adoption-20261113/report-water-source-disagreement-20261116`.

## Scope and continuation

Narrative, auth and country/provider boundaries are isolated in the synthetic
capture harness. There is no live paid generation, signed-in/account/device
acceptance, reviewed translation or agricultural validation. Existing monitoring
uses plan capacity independently; the new note is record reconciliation, not a
water-adequacy assessment or a change to monitoring/BOQ arithmetic. Existing
qualitative risk/cost rows are not approved by this correction.

The legacy-delivery b8 fix remains intact. Original P01–P24/G01–G05, prospective
P22 validation, production P03/P09 source breadth, FIELD-PERIOD-06,
PROVISIONAL-PRINT-04 and NURSERY-SK-06 limits remain. AGY's automatic dispatcher is
disabled; external continuation requires Rory's manual initiation. No production
merge or release is authorized by this record.
