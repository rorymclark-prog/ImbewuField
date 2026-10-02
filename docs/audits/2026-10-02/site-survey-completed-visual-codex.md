# Completed Site Survey visual audit — 2 October 2026

- Auditor: Codex, continuing the shared Site Survey archive.
- Reviewed implementation: `e64604a02a1b0f5cbb977c65ff14d83e65252a46`.
- Branch: `codex/site-survey-visual-review-20261002`, based on draft-recovery
  branch `7eb453bf722a807216e421a346153b483937c60e` / PR #883.
- App inspected: `http://localhost:4269/farmer?openSurvey=1&force-update=1`,
  using the existing Ubhejane tour workspace and real DataPanel → survey → report
  components. Local browser verification, not a production release claim.
- Previous audit: [unfinished survey recovery](site-survey-draft-recovery-codex.md).
- Related: [crop/production register](crop-production-audit.md).
- Evidence: completed form, independent saved-answer read-back, headed Chromium,
  hit-testing, actual PDF export/rendering and the full test suite.

## What was already done

The September rebuild and recovery iteration remain in place. This iteration
follows Rory's request to create a survey and actually view it. It uses the real
`/farmer` route rather than the previous temporary isolated QA page.

Codex entered the existing sample assessment choices, kept the sample's traced
144 m² roof, entered its existing 128 m² growing-area example, left production
figures unknown, completed the review, saved it and opened the prepared site
report. [The completed example](site-survey-completed-example.md) preserves the
answers and links the exact saved JSON and 12-page PDF.

Temporary rain-fed, no-water/no-storage and partial-production choices were
used as validation probes. They were restored or cleared before the final save.
The retained example has hand-watered delivery and no detailed production rows.
No private farmer record, Firebase sign-in or paid render was used. The local
browser's onboarding/consent flags were initialized for this disposable QA
session; that setup is not verification of the production consent journey.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SS-001 | Unfinished answers disappear after reopening. | Prior implementation retained | Recovery is in PR #883; this example verifies explicit final save. Sample mode deliberately does not persist drafts. Do not claim tour restart tests prove real-account recovery. |
| SS-002 | Consequential language needs fluent/local farming review. | Open, carried forward | Reused existing question labels; no new translations or fluent sign-off. Include the recovery wording in the existing review process. |
| SS-003 | Integrated signed-in saved-farm → survey → report check is missing. | Partially advanced; signed-in verification still open | The actual app route, saved-site selection, comprehensive review, local save and sample report export now work in the tour. Firebase account sync and live report generation were not exercised. |
| SS-004 | Physical phone/iPad and Safari ergonomics are not established. | Open, carried forward | Desktop, 390×844 and dark 320×640 Chromium inspected; no physical-device or Safari claim. |
| SS-005 | Update pill covers survey error instructions. | Implemented and visually verified locally | Both compact and expanded notices now stay below sheets/dialogs. Hit-testing the survey warning and notifier centres confirmed the survey wins; see evidence below. The notice remains available after returning to normal page content. |
| SS-006 | “Rain-fed only” becomes “None reported” at review. Other explicit “none” answers also lose their question's meaning. | Implemented and verified locally | Review reuses each question's existing label for rain-fed delivery, no water, no storage, no livestock, no preparation and no soil inputs. Browser probes checked rain-fed, no-water, no-storage and no-livestock meanings; saved choice IDs were not changed. |
| SS-007 | Opening an untouched optional Other row produces a red warning. | Implemented and verified locally | One `productionHasAnswers` rule now serves review and the form's recorded-row filter. Empty/whitespace-only rows stay quiet. A recorded zero or other partial answer still requires a name; quantity entries still require units. The browser confirmed a nameless zero disables final Save, then clearing it enables Save again. |

## Output inspected

| Evidence | What was actually seen |
| --- | --- |
| [Welcome before](site-survey-visual-evidence/01-welcome-before.png) → [after](site-survey-visual-evidence/04-welcome-after.png) | At 390×844, the update pill covered the comprehensive route card; the card is now unobstructed. |
| [Empty Other before](site-survey-visual-evidence/02-empty-other-before.png) → [after](site-survey-visual-evidence/05-empty-other-after.png) | A blank optional row initially raised a red validation message; it now shows blank inputs without an error. |
| [Rain-fed review before](site-survey-visual-evidence/03-rainfed-review-before.png) → [after](site-survey-visual-evidence/06-rainfed-review-after-mobile.png) | “None reported” is replaced by the selected answer, “Rain-fed only.” This is a probe, not the final example's saved delivery. |
| [Real validation after](site-survey-visual-evidence/07-validation-after.png) | A nameless zero still blocks Save. Its warning stays readable with the update notification forced open behind the survey. Expanded notification state was triggered programmatically for this overlap probe. |
| [Update still available after closing](site-survey-visual-evidence/12-update-available-after-closing.png) | After closing the report and details sheet and following Home, the compact notice remained visible and was the topmost element at its centre. The update was deferred by layering, not discarded. |
| [Completed desktop review](site-survey-visual-evidence/08-completed-review-desktop.png) · [dark 320×640](site-survey-visual-evidence/09-completed-review-dark-320.png) | Readable cards, explicit unknown production and usable final actions. No horizontal overflow was observed in these views. |
| [Report at 390×844](site-survey-visual-evidence/10-report-mobile.png) | Actual saved survey → prepared sample report, with visible Save/Export buttons and sourced quantities. Save and Export controls measured 44 px high. |
| [All 12 PDF pages](site-survey-visual-evidence/11-report-pages.png) · [PDF](Ubhejane-Example-Site-Survey-Report-2026-10-02.pdf) | Cover/site plan, quantity charts, water budget, advice, inventory and seasonal calendar rendered and inspected. The same report text survived the UI corrections; this is not a crop-print re-audit. |

The report's 144 m² traced roof and the entered 128 m² growing area matched the
saved answer read-back. Secondary roofs and production quantities remained
unknown. The report's boundary and tank capacity come from the saved design;
they are not additional farmer survey answers.

## Verification

- Typecheck: clean on Node 24.19.0.
- Full suite: 4,392 tests, 4,391 pass, zero failures and one existing shape-sync
  TODO. All 26 survey tests pass, including the new empty-versus-partial row case.
- Whitespace: clean. No existing assertion was deleted or weakened.
- Final PDF: 12 A4 pages, SHA-256
  `c747790620838235b90d60103e6e148de9dc68c3d104050d8e1a49025ca9697d`.
  Its extracted text matches the pre-correction export exactly. The page contact
  sheet was rendered from that equivalent earlier export.
- The development service worker briefly served an older survey chunk after
  edits. Only this disposable localhost origin's caches were cleared; the final
  empty-row, partial-row, label and save checks used the updated code.
- This changes the questionnaire picture and update-notice layering.
  `PLAN_VERSION`, saved geometry, plant names and course content are unchanged.
- Live authentication, account sync, paid AI output and physical Safari remain
  outside this verification. The example is not verified agricultural evidence.
- The local map has no Mapbox token, so its interactive basemap was unavailable.
  The existing saved sample pin, questionnaire and deterministic report/PDF
  could still be exercised; no map editing or live satellite inspection is claimed.

## Next continuation

1. Merge/integrate PR #883 before this dependent branch. Then integrate the crop
   follow-up in [PR #879](https://github.com/rorymclark-prog/ImbewuField/pull/879).
   Its added site/poultry answers must survive the existing normalizer and draft
   format; retain the schema-migration check from the prior audit.
2. Finish SS-003 with a disposable signed-in saved farm on the deployed build:
   edit, reopen/recover, explicitly save, and read that same site's report facts.
   Do not spend on paid generation merely to repeat these storage checks.
3. Finish SS-002 and SS-004 through fluent review and a physical phone/iPad/Safari
   session. Save the next iteration separately and update the shared index.
