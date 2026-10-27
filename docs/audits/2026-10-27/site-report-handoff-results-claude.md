# Codex handoff results: site report PRs #1099 and #1101

- **From:** Claude (integrator), 27 October 2026.
- **Repository:** rorymclark-prog/ImbewuField.
- **Request:** review and merge #1099, then #1101; integrate current `main` while preserving the four-language work; verify the production build and the report controls after deployment.
- **Full record in issue #35:**
  - Review: https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-6429813641
  - #1099 merge, Reports-tab crash, release gate: https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-6432431406
  - #1101 merge and production verification: https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-6435010935

## Outcome

| PR | Reviewed head | Final tested head | Squash commit on `main` | Production |
| --- | --- | --- | --- | --- |
| #1099 | `6bf5396b` | `d288423b100d67597f87ecfc3855472015e16c25` | `eab699fb17076a6e96d6cdebccb2be4b5e1dd205` | verified serving `eab699f` |
| #1101 | `508aafcc` | `018801e2b4fde535f2aef136e42ab37198341f45` | `16bca46691201ac75692fdbab85be818747955c8` | verified serving `16bca46` |

**Rollback:** revert `16bca466` (#1101), then `eab699fb` (#1099) if needed.

## Review findings (existing work)

No defects against the brief:

- **Report purpose:** Site potential and Complete site plan are independent of questionnaire length and depth. A missing purpose defaults to Complete site plan.
- **Annual plan:** crop, food-forest and animal-product windows keep their planned/reference/unknown labels. Observed harvests stay separate. There are no food-adequacy, yield or income claims.
- **Origin labels:**
  - Prepared examples are labelled `prepared-example` and cannot acquire AI settings on save.
  - Older reports show "Origin not recorded".
  - Originals and history are not rewritten.
- **Market evidence (#1101):** keeps its source and observation date, and a save date is never treated as an observation date. Selling intent is never shown as achieved sales or income.
- **Prompt guidance:** asks to investigate market gaps, prices and buyers instead of asserting them.
- **Soil (#1101):** the header prints values only from a lab test or SoilGrids. Otherwise it says "Not measured; arrange a soil test".
- **Record plan:** drawn locally, with no network or paid call. DesignGlossy has only #1099's four-line Record plan hook; Claude made no DesignGlossy edits.
- **`PLAN_VERSION`:** unchanged.

## Integration and fixes made

`main` had moved to `55526909` (the four-language stack, #1122), so both heads changed.

### #1099 (`d288423b`)

- **Merge conflicts:** six manual conflicts (ReportView, ReportVersionDetails, ReportPreparation, ReportCropPlan, report-summary, release notes). Main's localisation is kept and #1099's purpose, origin, prepared-example and annual-production additions sit on top.
- **New controls:** 11 report controls are registered as pending translations (REPORT_UI_KEYS, `lib/i18n-pending.ts`, `report-viewer-drafts.json`), and the translator CSV is regenerated. The locale files are untouched, so the byte-hash chains hold.
- **Release lines:** zu/st/ts/ve drafts added.
- **Prompt hash pins:** re-pinned. A dump of main reproduced the old pins, and the only change is the purpose instruction.

### #1101 (`018801e2`)

- **Market block:** the header market-evidence labels follow the report language (seven strings with drafts). The farmer's own notes, source and date are kept as recorded, and English output is byte-identical.
- **Soil assertions:** three `report-header-localization` assertions now encode the lab/SoilGrids-only rule.
- **"(English…)" labels:** apply only to zu/st/ts/ve. Previously `af` wrongly got them.
- **`tour-practice-localization`:** now checks that the four-language practice entry stays in history with its `/samples` tour.
- **Production crash fix:** the map page's Reports tab crashed with React #130. The `land_legal` evidence group, added on 6 October, had no icon in `EVIDENCE_GROUP_ICON`.
  - The crash was already present on `55526909`; it did not come from the report PRs.
  - Fix: the `Landmark` icon, in `lib/evidence-catalogue.ts`.
  - Test: `tests/evidence-catalogue.test.ts` requires an icon for every group.
- **Release-notes gate:** #1099's entry was stamped with a branch sha that the squash made unreachable, so `main` at `eab699fb` failed "Pending release notes". #1101 stamps its entry `eab699fb`, and a simulated squash passes.

## CI on the final heads (all green, including "Pending release notes")

- **#1099 `d288423b`:** runs [40420085512](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40420085512) and [40420090706](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40420090706). `test` and `rules` passed in both; the preview passed.
- **#1101 `018801e2`:** runs [40439992393](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40439992393) and [40439998592](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40439998592). `test` and `rules` passed in both; preview [40439992403](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40439992403).
- **Deploy of `16bca466`:** [40457213091](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40457213091) succeeded.
- **`main`'s own Tests run on `16bca466`** ([40457212559](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40457212559)): still in progress when this was written. `rules` passed; `test` was running.

## Production verification (https://imbewufield.vercel.app, `16bca46`)

Sample mode only: `/samples` → Open Farmer → `/farmer?site=demo-place-ubhejane`. Every generation endpoint was blocked in the browser and none was called. Nothing was saved, and no geometry, species or farming numbers were changed.

| Check | Result |
| --- | --- |
| Reports tab on the map page | Renders all evidence groups, including Land & legal. 0 page errors over 2 runs (crashed before) |
| Generate full report → viewer | Opens the prepared example with no generation call; clearly labelled "Prepared example … No new AI analysis" |
| Report origin label | Shown in en and st; isiZulu viewer copy translated |
| Report language in sample mode | English / isiZulu only (as #1099 intends) |
| Annual production plan | Present, with planned/reference wording and "a planned sowing is not proof of planting" |
| Local market evidence | The demo site has no market record. The report says "buyer demand and prices are not recorded. Check buyers and selling costs before planning sales"; no sales or income are shown. In isiZulu this line is English, marked "(English)" |
| Languages and layouts | English 1280 light, isiZulu 390 dark, Sesotho 1280 light: no raw `reportUi*` keys, no page errors |
| Design Studio → Preview & export → Record plan | To-scale plan (10 m bar, north arrow), existing vs proposed marks, legend, "no AI charge", PNG/SVG download and Add to maps. No AI request |

### Not observable on production without a sign-in or a paid generation

These are covered by tests on the tested heads instead:

- **Report purpose select:** hidden in sample mode by design (`!sampleMode` in ReportView).
- **Soil row "Not measured; arrange a soil test":** it lives in the generated full-report header ("Site at a Glance"); the prepared example has no such header. `report-header-localization` pins the rule.

## Left for Codex

- **#1131 legend work and DesignGlossy:** left untouched as requested.
- **DesignGlossy (13 sites) and `components/crops/CropPlanExportCard.tsx` (2):** still print a raw `error.message`. The shared helper `lib/user-facing-error.ts` is available once Claude's #1125 lands.
- **Fluent review still needed:** the new zu/st/ts/ve drafts. These include the 11 report controls, the 7 header market strings and the release lines.
