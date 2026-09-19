# Site survey and visual report — 20 September 2026

## Checkpoint requested by Rory

Rory asked to preserve the work before usage expires. This branch is a reviewable
checkpoint, not a claim that all device checks are complete. Build on the existing
report illustrations and saved data. Do not replace or merge this work blindly.

Branch: `codex/visual-site-survey`.
Worktree: `/Users/roryclark/.codex/worktrees/visual-site-survey/ImbewuField`.
Task: `01a0bbde-0dd6-74e1-992c-fc2848b7e6a8`.
The task is on `gpt-6-astra`, reasoning `xhigh` (confirmed from its turn metadata).

## Implemented

- Illustrated questionnaire entry with short and comprehensive routes sharing
  the existing saved survey. Short has five sections plus review; comprehensive
  has seven plus review. Switching does not discard detailed answers.
- Desktop navigation, horizontal mobile navigation, field guidance, larger touch
  targets, illustrated soil choices, and a roof-to-rainwater diagram.
- Review cards for all saved observations, source labels for areas, and reported
  harvest months. Empty months remain unreported, not food gaps.
- Optional production accordions, consistent yearly units, validation of missing
  units, negative quantities and used-plus-sold exceeding the recorded total.
- Unsaved-change confirmation, keyboard focus management, body scroll lock, and
  visible storage-failure feedback that keeps the survey open.
- Exclusive None choices and normalised adult ranges. Legacy manual areas are
  retained. Roof diagrams accept the site's rainfall instead of treating a worked
  example as a site estimate. Missing rainfall remains missing.
- Farmer-reported production now reaches `surveyToPrompt`, including missing
  quantities and income. Income is not labelled profit. Survey groups do not
  constitute a dietary-diversity score: FAO's household dietary diversity tool
  concerns foods consumed during the preceding 24 hours, not annual production:
  https://www.fao.org/nutrition/assessment/tools/household-dietary-diversity/en/
- Report reading cards: At a glance, Field guide, Complete report. Short screen
  editions use existing typed charts; their established fixed-page ink-saving PDF
  remains clearly distinguished from the full visual PDF.
- Full-report chapter navigation, more legible summary sections, and a refined
  report cover. Existing maps, diagrams, figures and full PDF generation remain.
- The site-data survey card uses the existing shared completeness calculation.

This changes the picture. `PLAN_VERSION` was deliberately left untouched.
No saved geometry, species, lesson bodies, or paid-render paths were changed.

## Verification already completed

Before the final report-reading additions, typecheck and the full Node 24 suite
passed: 3,630 tests, 3,629 passed, zero failed, one existing TODO. Whitespace passed.
Typecheck also passed after the report-reading additions.

Browser checks on the local questionnaire included:

- Existing selections, manual cultivation area and roof areas survive saving.
- Adult range is saved in its canonical form.
- Explicit None is deselected when an actual crop or water source is chosen.
- Escape opens the unsaved-change confirmation; cancelling retains answers.
- A simulated local-storage write failure leaves the questionnaire open with an
  error. Restoring storage allows a successful save.
- Short to comprehensive navigation preserves the production/cultivation state.
- Desktop soil and water layouts were rendered and inspected. Missing rainfall
  displays an unknown result rather than an invented site estimate.

No live paid AI call was made. No production deployment was requested or performed.

## Resume here

1. Run the required final checks in order: `npx tsc --noEmit`, `npm test` under
   Node 24, then `git diff --check`. The system Node is 26; the verified test command
   is `npm exec --yes --package=node@24 -- npm test`. Dependencies were installed
   in this worktree with `npm ci`; do not re-symlink stale main dependencies.
2. Complete the production browser case: 120 eggs/year, 80 used and 41 sold must
   warn; changing sold to 40 must clear it. Add Jan and Dec, switch to short,
   review, save, reopen, and confirm blank income is still unknown.
3. Inspect questionnaire entry, soil, water, review and production on phone
   (390×844), iPad portrait (820×1180), landscape (1180×820) and laptop (1440×960).
   Check overflow, sticky footer, keyboard focus, touch targets, dark mode and
   enlarged type. Inspect the actual screenshots, not only DOM dimensions.
4. Inspect all three report reading editions at those sizes. Check the chapter
   jumps, source notices and horizontal figure scrolling. Confirm the 1/5-page
   handouts and full visual PDF still export correctly. New report visual changes
   have not yet been visually signed off.
5. New questionnaire copy uses the established English fallback. Review isiZulu
   presentation and obtain language review before claiming full localisation.
6. Finish the PR, report branch/SHA and checks in issue #35. Read remote queue and
   ledger before integration. Do not assume the old August self-merge window is
   active in September. Do not bump PLAN_VERSION.

Local QA helpers and images are under `output/playwright/` and are deliberately
untracked; no QA routes, logs, credentials or screenshots are in this commit.
The temporary page source is preserved locally under
`output/playwright/harness/qa-survey` and `qa-report`; copy back into `app/` only
for QA, then remove before committing. The report harness uses disposable sample
mode. Local dev server is port 4244. Playwright sessions are `survey-final` and
`report-qa` using the installed Playwright skill wrapper. Reinspect a snapshot
before continuing, since the final production automation had not completed when
this checkpoint was requested. A test locator must use the actual label
"Area currently under cultivation", not "Cultivation area".

## Follow-up audit observations

The legacy `/survey` Garden Survey and `lib/survey-pdf.ts` are a separate older
workflow. Current navigation opens the parcel questionnaire through
`/farmer?openSurvey=1`. The legacy page has prefilled sample numerical assumptions
and should be audited independently rather than confused with this site report.
Persistent draft recovery is not implemented here; unsaved changes are guarded
until the explicit save. Existing booleans retain their original storage schema.
