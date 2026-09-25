# Farmer-facing English chrome audit and isiZulu draft proposals

**Review basis:** `origin/main` at `2c15ac6cc943574f8a348cccc66721bc421a368c` (2026-09-25). This is a source audit, not a fluent-language review. No app code, tests, or assets were changed.

**Scope checked:** shared Back/Menu controls; `/farmer` and `DataPanel`; `SiteSurveySheet` and `SiteSurveyReview`; `ReportComposer`; `MyRecords`; `/facilitator/crops` and crop-plan labels; `/design` UI. The 30 proposals below are Agy drafts for short, fixed-source labels. They exclude user-authored data, species names, and farming numbers.

## Draft proposals

Each proposal came from the signed-in Agy CLI in one request. Risk notes below combine Agy's stated caveats with a conservative review of meaning and context. Statements Agy made about universal usage are not treated as independently verified. None of these strings is approved for production; ask a first-language isiZulu reviewer, ideally a smallholder farmer familiar with the screen, to review them in context.

| File / key | Exact English source | Agy isiZulu proposal | Risk / review note |
|---|---|---|---|
| `components/BackButton.tsx` · button label | Back | Emuva | Straightforward navigation label; check that it reads as returning to the previous screen in this app. |
| `components/BackButton.tsx` · `aria-label` | Go back | Buyela emuva | Accessibility phrase; check naturalness and consistency with the visible label. |
| `components/MenuButton.tsx` · title | Menu | Imenyu | Borrowed term; check it is familiar to the intended users. |
| `components/MenuButton.tsx` · `aria-label` | Open navigation | Vula ukuzulazula | Agy flags “ukuzulazula” as potentially abstract; consider a simpler menu-specific wording after user review. |
| `components/MenuButton.tsx` · sample title | Tour — open choices and exit | Uhambo lokuqondisa — vula izinketho bese uphuma | “Tour” is a software walkthrough here; review whether the longer phrase is clear in a title. |
| `components/MenuButton.tsx` · sample label | Tour | Uhambo lokuqondisa | Agy notes this may be long for the button. |
| `lib/i18n.tsx` · `surveyPromptTitle` | Want a sharper report? | Ingabe ufuna umbiko ocacile kakhudlwana? | Idiomatic “sharper” rendered as “clearer”; check whether “more useful/detailed” better matches the prompt. |
| `lib/i18n.tsx` · `surveyCardHint` | Choose a short or comprehensive survey. Review your answers before using them in your site report. | Khetha inhlolovo emfushane noma ephelele. Buyekeza izimpendulo zakho ngaphambi kokuzisebenzisa embikweni wesiza sakho. | Check “comprehensive” and “site” against the survey’s established isiZulu terms. |
| `lib/i18n.tsx` · `surveyNotRecorded` | Not recorded | Akubhalwanga | Used for unknown/unentered values; confirm it cannot be read as a confirmed negative. |
| `lib/i18n.tsx` · `surveyNoneReported` | None reported | Akukho okubikiwe | Keep distinct from “Not recorded”; reviewers should confirm this distinction. |
| `lib/i18n.tsx` · `surveyYourSiteAtGlance` | Your site at a glance | Isiza sakho kafushane | Overview heading; check that “site” means the farmer’s land here. |
| `lib/i18n.tsx` · `surveyEditSection` | Edit section | Hlela isigaba | Short action label; check it describes returning to change answers. |
| `lib/i18n.tsx` · `surveyHarvestOverview` | Your reported harvest calendar | Ikhalenda lakho lesivuno elibikiwe | Refers to reported harvest months, not a planting schedule; confirm the distinction is clear. |
| `lib/i18n.tsx` · `surveyNoProductionYet` | No detailed production recorded. You can add it later in the comprehensive survey. | Akukho ukukhiqiza okunemininingwane okubhalwe phansi. Ungakwengeza kamuva enhlolovweni ephelele. | Check the production vocabulary and whether the second sentence clearly refers to optional later entry. |
| `lib/i18n.tsx` · `surveyEditProduction` | Review production records | Buyekeza amarekhodi okukhiqiza | Check it means inspect/change the entered production section, not certify records. |
| `lib/i18n.tsx` · `surveyStepHouseholdInfo` | Household Info | Imininingwane yomndeni | “Household” includes people who may not be family; Agy itself flags this scope ambiguity. |
| `lib/i18n.tsx` · `surveyStepLandLocation` | Land & Location | Umhlaba Nendawo | Check that this covers both land characteristics and location. |
| `lib/i18n.tsx` · `surveyStepCurrentProduction` | Current Production | Ukukhiqiza Kwamanje | Check that “current” is understood as what is produced now. |
| `lib/i18n.tsx` · `surveyStepLivestockPoultry` | Livestock & Poultry | Imfuyo Nezinkukhu | The draft may narrow poultry to chickens; review if the form includes other birds. |
| `lib/i18n.tsx` · `surveyStepIncomeSales` | Income & Sales | Ingeniso Nokuthengisa | Financial heading; review against the income/sales distinction in the held text below before use. |
| `lib/i18n.tsx` · `surveyStepResourcesInputs` | Resources & Inputs | Izinsiza-kusebenza Nezinsiza-kufaka | Agy flags this as formal and potentially unclear. Review terminology before use. |
| `lib/i18n.tsx` · `surveyCloseAriaLabel` | Close | Vala | Short accessibility label; confirm it clearly closes the sheet. |
| `lib/i18n.tsx` · `surveyDiscardBtn` | Discard answers | Lahla izimpendulo | Data-loss action. Require explicit first-language review in the confirmation flow before use. |
| `lib/i18n.tsx` · `surveyReviewTitle` | Review your survey | Buyekeza inhlolovo yakho | Check the established wording for “survey” and “review.” |
| `lib/i18n.tsx` · `surveyContinue` | Continue survey | Qhubeka nenhlolovo | Short navigation label; check consistency with the survey’s other actions. |
| `lib/i18n.tsx` · `surveyBegin` | Start survey | Qala inhlolovo | Short navigation label; check consistency with the survey’s other actions. |
| `lib/i18n.tsx` · `cropPlanTitle` | Crop plan | Uhlelo lwezitshalo | Check the app’s terminology for crop versus plant. |
| `lib/i18n.tsx` · `cropPlanAddGrowingAreas` | Add your growing areas | Engeza izindawo zakho zokutshala | Check that “growing areas” includes both beds and field plots in this screen. |
| `lib/i18n.tsx` · `cropPlanLoading` | Loading your plan… | Kulayishwa uhlelo lwakho… | Agy uses a software loanword; check familiarity and retain the ellipsis. |
| `lib/i18n.tsx` · `cropPlanStartAction` | Start crop plan | Qala uhlelo lwezitshalo | Check consistency with the title and action elsewhere. |
| `lib/i18n.tsx` · `navDesignMap` | Map | Imephu | Familiar borrowed term according to Agy; still validate with users. |

## English held for first-language and domain review

These exact strings carry financial, measurement, rainfall, or crop-timing meaning. They are deliberately recorded as English source strings without an Agy translation proposal in this packet. Translate only with a first-language reviewer who can check the underlying agricultural/financial meaning in screen context.

| Source | Exact English held | Why it needs domain review |
|---|---|---|
| `lib/i18n.tsx` · `surveyGuideProduction` | A notebook, harvest record or sales record can help. Do not add kilograms to bunches. Leave figures blank when your records do not cover a full year. | Unit mixing and incomplete-year figures could produce misleading production totals. |
| `lib/i18n.tsx` · `surveyGuideIncome` | Enter the amount earned from sales, before costs. The survey records income; it does not calculate profit. | Confusing income with profit changes financial interpretation. |
| `lib/i18n.tsx` · `surveyRoofInputs` | Uses your entered or traced roof area and rainfall from the site analysis. Collection efficiency is an assumption: 80% with gutters, 60% without. Actual collection varies. | The assumptions and percentages affect estimated water collection. Keep figures exact and preserve that these are estimates. |
| `app/facilitator/crops/page.tsx` · crop check | confirm spacing first | Spacing is a planting instruction. |
| `app/facilitator/crops/page.tsx` · crop check | packet rate needed | Seed packet rate influences how much seed is used; preserve the specific warning. |
| `app/facilitator/crops/page.tsx` · crop check | finish timing not verified, so its months cannot be checked | Prevents a false claim that the crop calendar has validated harvest timing. |
| `app/facilitator/crops/page.tsx` · climate source | Derived from satellite climate records for this site. You do not need to choose a rainfall type. | This states the source and limits of a climate-derived recommendation. |
| `components/MyRecords.tsx` · finance chart | Monthly income and costs | Financial categories must remain distinct. |
| `components/MyRecords.tsx` · finance chart | Month | Date grouping for the adjacent financial values. |
| `components/MyRecords.tsx` · finance chart | Income | Must not be confused with profit. |
| `components/MyRecords.tsx` · finance chart | Costs | Must remain distinct from income. |
| `components/MyRecords.tsx` · finance chart | Balance | Could be interpreted as cash balance or net profit; needs its surrounding definition. |

## Audit findings

- `/farmer` loads the large `DataPanel`, which presents survey, report, records, and map information. Much of its screen copy is routed through `t(...)`; the survey’s newer keys have English source values in `lib/i18n.tsx`, and the route’s unreviewed isiZulu notice explicitly tells users to switch to English if wording is unclear. This makes the survey labels a high-impact first batch, while its instruction text remains held above.
- `SiteSurveySheet` and `SiteSurveyReview` use those survey keys for the step labels, answers, and review headings. Names, notes, and free-text answers are farmer-authored content and were excluded.
- The shared Back/Menu controls still contain fixed English accessibility/title strings, so one translation pass reaches many screens. The drawer itself mostly uses shared locale keys; its remaining English fallbacks should be audited as part of broader locale completion.
- The crop planner has a mix of shared keys and direct English strings. The direct crop checks and climate-source statements need agricultural review; more generic month and view controls remain candidates for a later batch.
- `/design` already has isiZulu step labels and a handful of conditional isiZulu messages. Remaining direct English UI includes photo actions and warnings, canvas controls, item-state labels, and geometry labels (for example “Storage full — your design is NOT being saved. Free up space, then re-open.”, “Remove photo”, “Part of my design”, “Already here”, “Width (m)”, and “Size (m)”). The photo/storage warnings describe whether edits persist, and dimensions are measurements; do not treat them as cosmetic labels.
- `ReportComposer` has fixed English report controls such as “Screen”, “Print · full colour”, “Print · save ink”, “Download report PDF”, “Brief summary”, and “Full report”. They affect report output and are worth localizing after a reviewer checks the generated PDF labels and print options. Report section bodies and farmer-provided titles were not proposed here.
- `MyRecords` has a larger English surface than the shared record tab: invoice actions and the finance chart remain English. Financial labels are listed as held above. This packet samples key remaining chrome rather than claiming every source string was exhaustively inventoried.

## Agy usage and cost record

- Executable: signed-in local `agy` CLI (`agy --print`, JSON output).
- One translation request; Agy conversation ID: `31937470-cbbc-4d79-b392-2c8dc51ef7d5`.
- Agy reported usage: **16,799 input tokens; 14,543 output tokens; 11,592 thinking tokens; 31,342 total tokens**.
- Monetary cost was not exposed by the CLI response, so it is unknown.
- Agy disclaimed native fluency and recommended local-speaker validation. No fluent review is claimed here.
