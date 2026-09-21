# C04 — Turn the map into a crop plan

Seven-step English guide at `/student/guides/crop-planning`. Baseline `e65025dff16fea4bb398f540214db9970194d899`. No animation, species, agronomic-constant, saved-geometry or PLAN_VERSION changes.

## Source checks

- `app/facilitator/crops/page.tsx`: site-specific Design Studio beds versus main-site fallback, mapped bed/plot area disclosure, add/edit distinction, existing-crop flag, sowing month and bed share, overlap/readiness warnings, debounced local save result, Undo, optional AutoSuggest irrigation gate, first/current year versus repeated annual year, task/availability/value caveats.
- `lib/crop-plan.ts`: save result reports local storage success; sample mode uses its disposable in-memory store. Editor closure does not establish cloud backup.
- `lib/finance-plan-source.ts`: mapped growing areas are not the whole boundary and forecasts are not actual records.
- The export card explains PDF, quick print and calendar download. Calendar tasks use month placeholders, not an observed date of field work. File generation does not establish import into a calendar account.
- Guide wording uses existing controls without adding crop names, agronomic figures or farm recommendations. Numbers below describe the prepared sample only.

## Actual sample walkthrough — 21 September 2026

Opened Crop plan from the Ubhejane sample Design Studio using its site-specific link. The bed/plot disclosure showed seven beds, four plots and 128.0 square metres of growing area. Checked individual mapped areas and widths. This is sample evidence, not a prescribed farm layout.

Opened the existing Onions row. At the browser's 632-pixel width the long transplant, storage and benchmark detail card extended beyond the viewport: its heading/Close and Edit controls could not all be reached by scrolling. A pointer click on Edit failed; keyboard activation could open the editor. Closed the editor without changing it. Source confirmed the detail card had no height limit or overflow scrolling. This branch bounds its height to the viewport and enables vertical scrolling. Visual verification of that change must be recorded separately from its implementation.

Opened Auto-suggest a plan and inspected the goals/conditions. Reliable irrigation was unchecked and Suggest a plan disabled. Did not assert irrigation, generate/accept a proposal or clear the sample plan.

Edited the sample Green beans planned row from October to November. An initial attempt was followed by a Loading screen and the original value; the cause was not established and this is not counted as a successful save. In a controlled second attempt, Save changes returned the plan with Undo visible. Reopened the row: November sowing and January planned harvest were shown. Closed it, chose Undo and reopened: October sowing and December planned harvest returned. Thus edit/reopen/Undo was actually verified and the sample plan restored. No real farmer records were modified.

## Verification limits

The above establishes the source-area disclosure, automatic-planning gate and actual sample edit/reopen/Undo. Crop-plan browser PDF/calendar delivery and calendar-account import have not yet been verified in this walkthrough. No cloud/cross-device persistence, physical-phone editing or individual crop suitability is claimed. Preview phone scrolling, guide readability, feedback/navigation, CI and production checks are recorded in the release ledger. Narration, translation and learner review remain open.
