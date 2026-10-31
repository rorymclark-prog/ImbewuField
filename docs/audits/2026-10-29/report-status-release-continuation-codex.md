# Production status release continuation - 29 October 2026

- Auditor: Codex.
- Reviewed source: #1137 on `codex/production-legacy-status-20261027`, integrating map parent `966aff785` and current main `2d2ce46da`.
- Deployment: correction not yet published; actual before table captured privately on29October.
- Previous audit: [Legacy plants/housing status](../2026-10-27/report-production-status-codex.md); carries REP-S01 forward.
- Scope: existing/proposed grouping, report/crop-plan eligibility and release integration.
- Evidence: prior full local suite, source comparison and actual-site before capture.

## Findings and disposition

REP-S01 is implemented, with current combined verification pending. All three grouping readers still use the design's `statusOf`; their bytes are unchanged from the earlier tested correction. No new crop season, quantity or animal number is introduced. The visible real-site before table retains32rows and still illustrates the false existing defaults. Its corrected live comparison follows publication.

## Current-main integration - 29 October

The prior integrated source `2d14bdaff` completed the full local suite:6122pass,0fail,1existingTODO, exit0. Main then advanced to paid-composition release `2d2ce46da`. This follow-up integrates the finished map parent `966aff785`, retaining every paid-render change and the new verification policy. The plant/housing correction is unchanged. Because it changes derived existing/proposed production eligibility, this follow-up conservatively retains the full current-head test gate; the focused map/UI exception is not used for it. The explanatory report table is released separately so its static guidance need not wait for this stock correction. New combined full results belong on #1137 and issue#35; prior green results remain historical evidence only.

## Verification and next continuation

Run the ordered typecheck/full suite/whitespace and wait for the full exact-head `test`, focused-render and rules jobs plus successful preview. No known failure is ignored and no test is weakened. Record terminal results on #1137 and issue35. Merge the map parent before this correction; the separate report chooser may publish in between. Actual maps and the annual-production sample remain private; verify production source and all corrected row notes before calling the new sample final. PLAN_VERSION and saved geometry are unchanged; this changes report eligibility, not the stored drawing.

## Final branch topology

The independent chooser source is included in this correction before its full run so that publishing the UI first cannot create a metadata-only merge conflict afterwards. The plant/housing reader bytes remain unchanged. The short-lived78b6 local full run was stopped and preserved as superseded; it is not passed. The final combined source gets a fresh full local/CI run, with no further optional changes during that gate.

## Full-run failure and coverage correction

The `a91f8c313` local run finished with 6,128 passes, one failure and one longstanding TODO (exit 1). [REP-V01](simple-plant-label-coverage-codex.md) records the sole failure: a Simple-mode regex pinned the old plant-label condition and rejected the additional Whole/individual naming guard. Both the old test and component are identical to main `b8a4d11`; no runtime change is needed. The assertion is rewritten upward into the actual visibility obligations, with mutation checks proving that lost guards fail. This necessary correction ends the failed-source freeze and requires a fresh full run on the amended source. REP-S01 remains unpublished until that gate passes.
