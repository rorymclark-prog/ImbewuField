# Mixed inventory and purchase quantities — 16 November 2026

- Auditor / implementation owner: Command Centre Codex. A separate Codex
  subagent reviewed the seven implementation/test files; it was not Claude or AGY.
- Branch: `codex/report-mixed-purchase-quantity-20261116`.
- Starting commit: `05d08bb123b0cfbcbb15f00bee89305c7657d564`, stacked on PR1387.
- Reviewed revision: that parent plus the change committed with this record;
  exact final source/output bindings and Git identity are retained privately.
- Previous audit: [Water record reconciliation](report-water-source-disagreement-codex.md).
- Trigger: actual Claude review of 05d, informational finding N-1. Source review
  confirms already-existing items were excluded before this change; the defect
  is specifically the unknown purchase share in historical `mixed` groups.
  Rory's manually initiated AGY package3 adds the separate existing-count defect
  AGY-05D-BOQ-02; that review applies to the parent, not this successor.
- Scope: deterministic bill of quantities, full/one/five-page cost displays,
  prepared reports, cost chart and report-route rate-gap risk input.
- Deployment inspected: none for this successor at preparation time. Parent
  preview and parent external reviews do not establish successor acceptance.

## What was already done

The parent retains source-labelled roof and water evidence, historical delivery
answers, qualified tank/survey disagreement and decimal display corrections.
Those records, saved inventory, geometry, species, lessons and `PLAN_VERSION`
remain unchanged. Price-book values and their dated source disclaimer also remain
unchanged; this change adds no farming number or current-price claim.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CLAUDE-05D-N-1 / BOQ-MIXED-PURCHASE-01 | A legacy tank or structure group combining existing and proposed units had only a combined inventory count. Pricing the whole group charged for an unknown purchase quantity. | Implemented; local checks and actual outputs verified | Mixed lines retain count, known capacity and provenance, but rate/amount are null with an explicit split-needed reason. Proposed priced lines remain; already-existing exclusion is retained, not newly fixed. Exact successor external review and CI remain open. |
| BOQ-MIXED-PURCHASE-02 | An entirely unpriced bill could display a zero subtotal or empty cost chart. | Implemented; local checks and actual outputs verified | Renderers distinguish no priced lines from an actual stated zero. No-price full/short reports show unknown cost; charts require a priced group. The internal numeric accumulator remains compatible. |
| BOQ-MIXED-PURCHASE-03 | Passing every unknown purchase line into the older rate-gap risk rule would add a High cost-overrun rating without a known purchase quantity. | Implemented; route capture verified | The existing rate-gap count excludes the new mixed-quantity hold; actual missing measurement/rate lines and the older risk rule are otherwise retained. This does not validate the older risk model. |
| AGY-05D-BOQ-02 | The collector repeats the same catalogue tank group in water and design views; the exclusion count counted both copies. | Implemented; baseline failure, affected checks and actual report verified | Consume matching known-catalogue ID/name/count/existing-status mirrors once. Preserve design-only records, unequal counts, different labels, unknown/missing IDs and unmatched repeated groups. Existing beds retain their separate count. No legacy name-only identity is inferred. |

Mixed counts are explicitly labelled inventory, not quantities to buy. The subtotal
note does not claim that the unknown purchase share must make the total higher.
Regulated-plant priority remains ahead of the mixed structure hold; duplicate
tank/bed groups remain excluded. No installed/proposed fraction is inferred.

## Verification

- Node24.22.3 typecheck: clean, after the final implementation/test changes.
- Thirteen affected test files: **208/208** pass; zero failures, cancelled,
  skipped or TODO. Three initial mixed regressions fail on the parent; an added
  existing-mirror control also fails before its corresponding correction.
- Historical localization fixtures remain byte unchanged. The mixed fixture's
  superseded expectation is corrected independently: its known route/bed subtotal
  remains R23,266, mixed inventory remains unpriced, and all unrelated fixture
  outputs and the translation AST negative controls retain their prior scope.
  Five matching existing catalogue tanks correct the separate historical
  exclusion count from 87 to 82, without changing its ten bill lines or prices.
- Separate proposed/existing/mixed tank controls retain the known proposed cost
  and exclude existing inventory. A stated zero remains different from no price.
- Release-note check and `git diff --check`: pass before commit.
- **Three actual report POST captures, five app-written PDFs, 19 rendered pages
  and one cost-chart PNG** inspected by root Codex. Mixed-only outputs omit R0
  and the empty chart; the proposed/mixed example retains only its R5,500 priced
  tank. Changed English/isiZulu rows and short-report notes are legible without
  observed clipping. New non-English copy is visibly English/translation-pending;
  this is not fluent-language acceptance.
- Separate Codex source review found no actionable defect in its seven-file
  scope. It read the existing check logs and inspected one changed PDF page and
  the chart; it did not rerun suites or inspect all 19 pages itself.
  That earlier review precedes the added existing-count fix. A fresh independent
  Codex review of the completed seven-file delta found no actionable defect,
  read the 208-pass evidence and inspected four final PDF pages plus the chart.
  Its exact file hashes are retained separately; it is not external acceptance.
- Full local suite not repeated. Required exact-successor full CI, rules,
  preview and external-review outcomes remain separate and must be recorded
  before any release decision. No prior CI result is relabelled.

This changes the picture: cost rows, subtotal wording and cost-chart availability
change. Raw counts, capacities and saved records do not. Synthetic captures use
isolated narrative/auth/country/provider seams; no paid generation, real account,
physical device, applicable-price validation or field validation is claimed.

Private inputs, original logs, source hashes and visual/review receipts are under
`/Users/roryclark/.codex/imbewu-private-research/global-provisional-adoption-20261113/report-mixed-purchase-quantity-20261116`.

## Next continuation

Bind the reviewed source and outputs to the committed candidate, push once,
observe its actual CI/preview and prepare a finite successor delta review packet.
Do not modify the in-progress manual AGY assignment pinned to 05d or describe
that parent review as review of this change. No AGY invocation is authorized.

Original P01–P24/G01–G05, P03/P09 evidence breadth, prospective P22 validation,
FIELD-PERIOD-06, PROVISIONAL-PRINT-04 and NURSERY-SK-06 remain open as applicable.
Existing qualitative risk/cost rules outside this correction are not approved.
No production merge or release is authorized by this record.
