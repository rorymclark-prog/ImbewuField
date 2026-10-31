# Simple plant-label coverage audit — 29 October 2026

- Auditor: Codex.
- Reviewed revision: `a91f8c31374b85d70bcc36ddccc1772093e1edab`, branch `codex/production-legacy-status-20261027`; test-only follow-up described below.
- Deployment inspected: production `b8a4d11d06e5f79f2e35774ad9d2f989062d6237` was visually inspected earlier today; no new visual change is introduced here.
- Previous audits: [Paid map composition](ai-map-composition-fixes-codex.md), [status release continuation](report-status-release-continuation-codex.md). REP-S01 remains subject to full verification.
- Scope: the existing Simple-mode plant-label assertion and its relationship to the grouped Whole-map controls.
- Evidence type: full local test run, source comparison, actual conditional execution and negative mutation checks.

## What was already done

The paid composition release deliberately restricts individual label controls to sheets using individual naming. Whole retains its grouped legend and explains that Planting provides individual names or codes. The new `sheetElementNaming(filter) === 'individual'` guard retains `!simple`. The actual Whole guidance was already observed in the live workspace. Neither that behaviour nor the production-status readers are changed by this follow-up.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| REP-V01 | The full-suite Simple-mode check rejected a legitimate extra naming guard, blocking the pending production-status release despite unchanged Simple behaviour. | Implemented; full verification pending | The component and old test at the failed source are byte-identical to current main `b8a4d11`. Replace the obsolete two-clause source regex with execution of the actual heading's enclosing condition. Preserve the original Simple-hidden obligation, check Planting remains available in All tools, Whole remains grouped and empty sheets hide the controls. Four mutations prove the check detects lost Simple, availability, content and naming guards. |
| REP-S01 | Legacy placed items are falsely counted as existing by production readers. | Unpublished; full gate remains | Reader implementation unchanged. The failed run does not grant a merge exception; rerun the required full suite on the amended source. |

## Verification

- Typecheck: clean before the focused run.
- Focused checks: 49 pass / 0 fail, including Simple controls, paid-map controls and gallery/workspace regressions.
- Full local suite at the superseded `a91f8c313` source: 6,130 tests; 6,128 pass, 1 fail, 1 longstanding shape-sync TODO; exit 1. The only failure is REP-V01. This is a failed run, not a passing baseline.
- Whitespace: clean after the test change.
- Output inspected: no new rendered output; application source and existing live visual behaviour are unchanged. This does not change the picture. `PLAN_VERSION` remains unchanged.
- Other limits: amended-source full local/CI results, normal merge, production-status comparison and final annual-production sample remain pending. Terminal evidence belongs on #1137 and issue #35.

## Next continuation

Push the amended #1137 branch once after the verification record is complete. Preserve the failed run privately, start one new ordered typecheck/full-suite/whitespace run, and wait for full current-head test and rules jobs plus the applicable focused/preview checks. Do not waive the farming-related gate or alter the application to satisfy an obsolete regex. Then verify the actual saved-site annual rows and finish the private Ubhejane sample pack.
