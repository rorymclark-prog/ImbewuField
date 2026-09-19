# Site survey and visual report — 20 September 2026

## Release status

Rory first requested a checkpoint before usage expiry, then explicitly requested
publication and continued work with saves every ten minutes. PR #444 contains the
site survey and report improvements. The task uses Astra with Extra high reasoning.

Branch: `codex/visual-site-survey`.
Worktree: `/Users/roryclark/.codex/worktrees/visual-site-survey/ImbewuField`.
Task: `01a0bbde-0dd6-74e1-992c-fc2848b7e6a8`.
Checkpoint automation: `save-imbewu-survey-work` (every ten minutes while active).

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

## Release verification

Final typecheck and full Node 24 suite passed: 3,630 tests, 3,629 passed, zero
failed, one existing TODO. Whitespace passed. The new reading panel is registered
under the strict 12px farmer text floor; no assertion or allowance was removed.
CI must pass both the test and rules jobs before merging.

Rendered and inspected Chrome layouts at phone (390×844), iPad portrait
(820×1180), iPad landscape (1180×820), and laptop (1440×960). These are browser
viewport checks, not physical-device or Safari certification. The survey review
was inspected in light and dark modes. At 140% scale the survey now fits the
390×844 viewport and Save remains visible (bottom 827px). The narrow header wraps
without overlap, and the active section scrolls into view after rotation.

Report settings fold away below 1100px, giving iPads a full-width document. The
floating Lima launcher no longer obscures report figures. Both chapter menus use
the same heading IDs, and navigating from a short edition opens the full report.

Browser interactions verified:

- Survey selections, manual growing area and both roof areas survive save/reopen.
- Canonical adult range; mutually exclusive None and actual crop/water choices.
- Escape confirmation; cancel retains unsaved answers.
- Simulated storage-write failure keeps the survey open; retry saves successfully.
- 120 eggs/year, 80 used and 41 sold is flagged. With 40 sold it saves exactly,
  including Jan/Dec harvest months and unknown (null) income.
- Switching comprehensive to short retains the detailed production row. Reopening
  shows 120 eggs in the review.
- Full-report chapter navigation opens and focuses its matching section.
- Actual Export PDF downloads: exactly 1-page and 5-page handouts; a 12-page full
  sample report. Handout pages and the full cover, land-use/progress and climate
  chart pages were rendered and visually inspected. The existing full PDF drawing
  pipeline is retained. No paid AI call was made.

Local QA page source and images are under `output/playwright/` and deliberately
untracked. Temporary `app/qa-*` routes must never be committed. The saved harnesses
are `output/playwright/harness/qa-survey` and `qa-report`; the latter uses disposable
sample mode. The dev server is port 4244. Playwright sessions are `survey-final`
and `report-qa`. Inspect a fresh snapshot before continuing. The survey action is
labelled "Save & continue"; its cultivation field is "Area currently under cultivation".

## Further improvement boundaries

- New questionnaire copy uses the existing English fallback. Obtain language review
  before claiming full localisation.
- Persistent draft recovery is not implemented; explicit saves and unsaved-change
  protection retain the existing storage model.
- Continue checking real-device ergonomics and farmer feedback without inventing
  measurements or nutritional scores.
- Publication was authorised on 20 September. Use the existing Vercel deployment
  workflow, verify `/api/build-info`, and record the deployed revision in issue #35.
- Leave PLAN_VERSION untouched. Re-read the remote ledger before integration.

## Follow-up audit observations

The legacy `/survey` Garden Survey and `lib/survey-pdf.ts` are a separate older
workflow. Current navigation opens the parcel questionnaire through
`/farmer?openSurvey=1`. The legacy page has prefilled sample numerical assumptions
and should be audited independently rather than confused with this site report.
Persistent draft recovery is not implemented here; unsaved changes are guarded
until the explicit save. Existing booleans retain their original storage schema.

## Full-size figure follow-up

The survey release is live at main/23fdb01 (PR #444); production and both CI jobs
passed. Follow-up branch `codex/site-report-figure-viewer` extends the existing
report image viewer to overview charts and chapter diagrams. Zoom, keyboard focus
containment, Escape and return focus were exercised at 390×844 and 820×1180.
The viewer uses the original SVG and never redraws or modifies site geometry.
Local typecheck, all 3,630 tests (3,629 pass, one existing TODO), and whitespace
checks pass. No test assertion was changed. Chapter-specific integration and
remote CI remain to be checked before this follow-up is published.
