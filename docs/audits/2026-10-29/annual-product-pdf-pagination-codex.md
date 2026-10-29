# Annual product PDF pagination audit — 29 October 2026

- Auditor: Codex.
- Reviewed revision: production `977ea31b4d9ac10ae3787f548a41bc77d253dde5`, followed by `codex/annual-production-pdf-rows-20261029`.
- Deployment inspected: `https://imbewufield.vercel.app`, verified build `977ea31`; the new PDF pagination is locally verified and awaits its own release gates.
- Previous audits: [Report heading pagination](../2026-10-27/report-pdf-pagination-codex.md), [status release](report-status-release-continuation-codex.md), [Simple control coverage](simple-plant-label-coverage-codex.md). Carry REP-L01, REP-S01 and REP-V01 forward.
- Scope: native annual-production PDF row placement; source data and calendars remain unchanged.
- Evidence type: actual signed-in report, native PDF export, rendered pages, emitted-PDF regressions and source preservation.

## What was already done

#1137 source `a07866238276416835eab8958880b9cc7a629012` completed local typecheck/full suite/whitespace and both full current-head CI test/rules/focused jobs plus preview. It merged normally as `977ea31`; deploy `40916809768` succeeded and the production build endpoint served that source. The actual site was refreshed through the app's normal update control. No farmer Save or paid generation was performed.

All 32 visible annual rows were captured privately. Names, products, months and all calendar cells match the earlier capture. Eight perennial notes change through the shared proposed status: three undated rows now state proposed counts; five sourced-reference rows also display the existing formatter's proposed/maturity reminders. The formatter, reference-data files and source seasons are unchanged. Housing remains housing, missing product choices remain missing and no first-year quantity is introduced. Personal source records and raw logs remain outside Git.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| REP-S01 | Legacy plants/housing were counted as existing despite proposed design status. | Verified in production `977ea31` | Actual undated rows show 0 existing and the saved proposed counts, with all picking months still unknown. Native export preserves all 32 visible rows. |
| REP-V01 | The Simple plant-label regex rejected the legitimate Whole grouping guard. | Verified | The amended source passed 6,131 full tests with zero failures and one longstanding shape-sync TODO, exit 0, locally and in both CI runs. |
| REP-L01 | Report headings became separated from opening text. | Previously verified; retained | The preserved nine-page comprehensive format preview is unchanged. |
| REP-L02 | A native annual table broke a product qualification across pages: the next page began with “first-year crop promised”, separated from “No food quantity or”. | Implemented and locally rendered; release pending | Measure the complete heading/calendar row and its wrapped notes before placement. Keep rows together when they fit a fresh page. Retain labelled continuation for a genuinely overlong note. The actual before/after export now places the complete product row and qualification on one page. |

## Verification

- Typecheck: clean before affected tests.
- Affected PDF/export/update-notice checks: 99 pass / 0 fail. The new complete-row regression fails against the original renderer after six synthetic preceding rows, then passes after correction. It varies 18 row positions. A second regression preserves the final supplied text and product identity when a note genuinely exceeds a page.
- Shared rendering suite: 572 pass / 0 fail on the same amended renderer.
- Whitespace: clean. Release notice has additive [unreviewed source/draft pairs](annual-product-pdf-release-drafts.json); no fluent review claimed.
- Output inspected: actual four-page native annual export, especially pages 3–4. The affected product moves intact to page 4; all wording and dates survive. The final review pack retains original narrative and map page sizes/content. Re-export the finished pack with the released source after deployment.
- This changes PDF pagination, not the map picture. `PLAN_VERSION`, stored drawings, plant identities, farming figures, season calculations and existing lesson content are unchanged.
- Full suite on the new presentation-only head runs separately under AGENTS §1; pending is not passed. This narrow native PDF layout change requires affected tests, current rules/focused checks and successful preview before normal merge.

## Next continuation

Record exact source/checks on the PR and issue #35. After its current-head focused/rules/preview gates pass, merge normally, verify production and export the final actual-site sample pack. Inspect all new pages, preserve evidence dates, deliver the samples and remove the temporary release heartbeat. The original narrative evidence remains 3 October, drawing 2 October and comprehensive format preview 27 October; a newly assembled review pack does not imply a new field visit.
