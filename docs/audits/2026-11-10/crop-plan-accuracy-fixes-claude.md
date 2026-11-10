# Crop plan accuracy fixes: calendar choice, sowing months and weekly-target timing — 2026-11-10

- Author: Claude, at Rory's instruction on 10 November 2026: "go ahead and fix the accuracy issues". A Sonnet agent wired the screen wording; I designed the rule, made every farming-data change and reviewed the agent's work.
- Reviewed revision: branch `claude/blissful-pasteur-1c4ne6`, commits `5f92c7ae` and `7e4db70c`, on top of released `29e5516`.
- Deployment inspected: not inspected. The changes were run and looked at on a local development server (the public sample farm).
- Previous audit: [the accuracy audit of the same day](crop-plan-accuracy-claude.md) (CP-073–CP-083). This record says what was done about each finding. IDs continue from CP-086.
- Scope: how a site gets its sowing calendar; the sowing months in the four calendars; the weekly-target timing message. Yields, spacing, durations, fruit trees and animals are unchanged.
- Evidence type: the app's own functions run for 44 real South African places against an independent frost record; comparison with a published regional guide before and after; new tests that fail when the old behaviour is put back; four screens looked at in a browser. No field check and no agronomist review.

## How far off it was, and what it is now

The audit's worst finding was that hot, frost-free farms were shown the wrong season. That is fixed. The interior, where most of the country farms, was already close and moved a little.

| Region (regional guide's column) | Before: months the guide also lists | After | Crops sharing no month with the guide, before → after |
| --- | --- | --- | --- |
| Lowveld | 35% | 61% | 48 → 6 of 162 |
| KwaZulu-Natal and Coast | 47% | 72% | 6 → 0 of 81 |
| Eastern Cape and Little Karoo | 64% | 69% | 4 → 0 of 135 |
| KwaZulu-Natal Midlands | 70% | 72% | 5 → 0 of 135 |
| Northern Cape and Great Karoo | 71% | 72% | 1 → 0 of 189 |
| Highveld | 75% | 78% | 0 → 0 of 162 |
| Middleveld | 79% | 76% | 8 → 6 of 108 |
| All regions except the Western Cape | 63% | 71% | 72 → 12 of 972 |
| Western Cape and South Coast | 67% | 86% | not an independent figure: see below |

Three things to know before reading those numbers:

- **They are not a pass mark.** The guide is a seed-industry table from 2004. A wide sowing window and a narrow one weigh differently. The numbers show which regions fit their own published advice and which did not.
- **The Western Cape figure is by construction.** Those rows are now taken from the same guide, so agreeing with it proves nothing. Every other region's rows come from other sources, so the guide is an independent check there.
- **The Lowveld is 61%, not 72%, because of two towns.** Komatipoort, Phalaborwa, Musina and Thohoyandou reach 72%. Mbombela and Tzaneen stay at 42%: their readings put them just on the cold side of a line (see CP-073 below).

Calendar choice, over the 44 places: 11 changed calendar. NASA POWER and the independent record now give different calendars at 2 places, down from 9.

## Findings and disposition

| ID | Problem | Status | What was done, evidence, and what is left |
| --- | --- | --- | --- |
| CP-073 | Frost-free Lowveld and Limpopo sites got the hard-frost calendar | fixed for five of seven; two improved | Frost is now read from the site's record minimum temperature, which the app already downloaded and never used for this. It is NASA POWER's "minimum hourly air temperature … in the period of interest": a record low for the grid cell. It matches the independent 20-year lowest daily minimum to a median 0.1 °C. Komatipoort, Phalaborwa, Musina and Thohoyandou now get the hot-area calendar; Lephalale the light-frost one. **Mbombela and Tzaneen get the light-frost calendar, not the hot one.** Mbombela's coldest month reads 15.9 °C against a 16 °C line; Tzaneen's grid cell includes the escarpment and has touched 0.7 °C. The rule leans cold on purpose. Mbombela is told it is close to the line, and a grower there who answers "we have not seen frost here" in the site survey gets the hot-area calendar. Tzaneen is not within reach of that. [`outputs/calendar-choice-matrix.txt`](evidence-crop-plan-accuracy-fixes/outputs/calendar-choice-matrix.txt). |
| CP-074 | No working calendar for hot, frost-free, summer-rainfall places | fixed | The hot-area calendar is now chosen by frost and heat, not by rain timing. Three conditions: no frost on record (record minimum 2 °C or more); a coldest month of 16 °C or more, the bottom of the common bean's optimum range in FAO ECOCROP, because the hot-area calendar sows beans through winter; and a hottest month of 24 °C or more, the top of the optimum range for cabbage, broccoli, carrots and peas in the same table, because that is the summer the calendar closes. Durban and the Mkuze sample farm moved to it. East London, George and Gqeberha, frost-free with mild summers, read the light-frost calendar, where their guide fits better. `lib/koppen-global.ts`. |
| CP-075 | The frost-free calendar did not match its own source | fixed | 16 hot-area rows changed. Fourteen now match the KZN table's hot-area column as transcribed: peas March to May, not January; cabbage February to June; green beans February to September; lettuce February to August. Kale and coriander have no row in any table; they borrow the cabbage and lettuce rows and stay marked as unchecked, so a plan still tells the grower to confirm them. `lib/crop-catalog.ts`; [the 39 changed rows](evidence-crop-plan-accuracy-fixes/outputs/guide-agreement-before-after.txt). |
| CP-076 | The Western Cape calendar was partly a copy of the hard-frost one | fixed with a secondary source | Rows that were copies or empty now follow the regional guide's Western Cape column where it has a row: peas April to August, onions April to May, cabbage November to April, green beans October to February. Sweetcorn, gem squash, baby marrow, spanspek and turnip have months for the first time. Frost-tender crops sown in the ground start in September even where the guide opens in August, for the inland valleys. Kale's row is still borrowed and its comment says so. **The source is secondary** (seed industry, 2004) and each row's comment names it as such. No government table for the Western Cape was found. |
| CP-077 | Six hard-frost rows carried months no source lists | fixed | Peas: July to September, not February and March. Broad beans: April and May. Broccoli: September to February. Potato: September and October, not August. Sweet potato: November only. Each month left is in the KZN cold-area row or in the guide's column for an interior region. Cabbage and onions were checked and left: every month they offer is in one of those. |
| CP-078 | The calendar depended on which climate dataset was asked, and nothing told the grower | fixed in part | The two records now disagree at 2 of 44 places (Thohoyandou, Springbok), from 9. Ten places are flagged as close to a line. The planner now names the calendar, shows the three readings it rests on and says when the site is close to another calendar. Worcester still gets the hard-frost calendar on both records. A grower cannot yet pick a calendar directly; see "Next continuation". Screens [`01`](evidence-crop-plan-accuracy-fixes/01-calendar-and-reasons-desktop.png)–[`03`](evidence-crop-plan-accuracy-fixes/03-calendar-and-reasons-phone-dark.png). |
| CP-079 | Weekly targets were matched to the late edge of harvest | fixed as a warning; the arithmetic is unchanged | A target card now says how many linked sowings could be ready before the buyer's window opens, and from which month. The earliest month uses the lower end of the catalogue's own duration range and the shortest nursery period the planner already allows. What is credited to a target did not change: that is Codex's weekly-goals arithmetic and a product decision. Screen [`04`](evidence-crop-plan-accuracy-fixes/04-weekly-target-ready-early-phone.png). |
| CP-080 | The heat check almost never fires | open | Not changed. The hot-area calendar now does the job the heat check could not: it closes midsummer for cool-season crops. A better heat rule still needs a source. |
| CP-081 | September is still a frost month in the coldest places | fixed in part | Potatoes moved a month later (CP-077). A site whose coldest month averages under 9 °C is now told that frost often lasts into September and to plant out tender crops after its own last frost. All seven audited places that frosted in September in 15% of years or more are under 9 °C. August sowing of tomatoes and peppers in trays is unchanged. |
| CP-082 | Whole regions could not plan some of their own crops | cowpea fixed; the rest open | Cowpea has December on the light-frost calendar, from the national Cowpeas Infopak. The other eight traditional and field crops still have no month outside the hard-frost calendar, because no source was found. |
| CP-083 | The source tables could not be re-read | needs verification | Still true. The KZN department's site was unreachable again on 10 November. Every KZN row used here is an earlier transcription, now collected in one file with that status stated. |
| CP-086 | New. With no site climate, a Karoo farm fell back to the frost-free calendar | fixed | The seven-point fallback table records rain timing, and "rain all year" was being read as "frost-free". The fallback now leans cold and never gives the hot-area calendar. `lib/water-calc.ts`. |
| CP-087 | New. One setting answered two questions: which calendar, and when the rain falls | fixed | A hot Lowveld farm on the frost-free calendar would have been labelled "All-year rainfall" and had its water tank sized as if rain came all year. Rain timing is now a separate reading. Labels name the calendar and the rain: "Hot area, no frost · summer rain". |
| CP-088 | New. Plans warned growers to re-check months that were sourced | fixed | The list of cited hot-area rows had 8 crops while the catalogue's own comments cited the table for 8 more (cauliflower and radish among them). It now has 32, and a test keeps the list and the months in step. |
| CP-089 | New. A plan made before these fixes keeps its old sowing months | open | Nothing rewrites a saved plan, which is right. But a grower in Komatipoort or Durban whose calendar changed is not told which of their saved sowings are now out of season. The release note says to make a new plan. A one-time notice on affected plans is a product decision. |
| CP-090 | New. A crop grown three years ago on one bed can change what a different bed is given | open, recorded | Found when the corrected Western Cape pea months made an existing test fail. Old chard on Bed 2 stops Bed 2 taking beetroot (same rotation family, by design); Bed 2 takes peas; the planner then gives Bed 4 something else. It is one real change rippling outward, not a wrong reading of dates, and it was already present on the light-frost calendar. The test now asserts what is true and counts the cases. Whether a three-year-old crop should still steer rotation is not decided here. `tests/crop-plan-ideal.test.ts`. |

## What a grower sees that is different

- In a hot area with no frost, most vegetables are sown from February to September. Midsummer is closed for cabbage, lettuce, peas, broccoli, kale and coriander.
- In frost areas, peas are sown from July to September.
- In the Western Cape, peas and onions are sown in autumn and winter.
- The planner names the calendar in plain words and shows the temperatures behind it.
- A weekly target says when a sowing could be ready early.
- The calendar and Atlas pages name the hot-area calendar correctly. Two new isiZulu labels ("Izindawo ezishisayo, asikho isithwathwa", "Kuyashisa, asikho isithwathwa") have not been checked by a first-language speaker.

## Verification

- Typecheck: `npx tsc --noEmit` clean.
- Tests: the 212 test files that touch the changed modules were run locally (3,660 tests). The last run had one failure, a house rule against adding text under 12px; the new reasons text was raised to 13px and that file passes. The full suite was not run locally; it runs in CI on the pushed head and its result is not known at the time of writing.
- New tests: `tests/crop-calendar-sources.test.ts` holds each calendar to the transcribed tables; `tests/sa-calendar-real-sites.test.ts` holds the rule to the 44 real readings and their independent frost record; `tests/sowing-calendar-label.test.ts` covers the wording, the grower's frost answer, the fallback and tank sizing. With the old rule and old months put back, 9 of the first 17 fail.
- Existing tests rewritten, each with the reason beside it, none loosened into saying nothing: six pinned the old months, labels or calendar (`sa-rain-pattern`, `koppen-global`, `crop-climate-gate`, `sample-production-plan`, `crop-plan-notes`, `plan-assurance`); one test harness needed the new export; one (`crop-plan-ideal`) asserted something that was only true by luck (CP-090).
- Looked at in a browser, public sample farm, local server: the calendar name in the page header at 1280 px; the calendar name, readings and close-call sentence in the Auto-suggest pop-up at 1280 px and at 390 px in light and dark; the weekly-target warning on a cabbage order at 390 px. No horizontal overflow at 390 px. The app's own "Update ready" banner was dismissed before the pictures were taken. Not looked at: the printed plan and PDF, the calendar page, the Atlas panel, any site other than the sample farm, and the deployed site.
- Limits:
  - Every climate input is a gridded estimate for a cell tens of kilometres wide. A farm in a hollow, or on a slope above one, can differ from its cell.
  - The thresholds were set from published crop temperature ranges and then checked on 44 places. They were not tuned to make the numbers look better, but 44 places is still a small set, and they are all in South Africa.
  - The KZN rows are second-hand and the regional guide is secondary. Both are stated where they are used.
  - No farm was visited and no agronomist has reviewed this.

`PLAN_VERSION` is untouched. No species name was changed. Every month added has a row or a quote in the comment above it.

## Next continuation

Decisions for Rory:

1. **Merging.** The branch now holds the page fixes (steps 1 and 2) and these farming-data changes. Under AGENTS §1 farming data needs the full suite green before merge.
2. **Let a grower choose their calendar.** Today only their frost answer can move a close call one step. A direct choice would settle Mbombela, Tzaneen and Worcester, and any farm whose valley differs from its grid cell. It changes saved plan data, so it is a product decision.
3. **Tell growers whose calendar changed (CP-089).**
4. **Should an early-ready sowing still count toward a target (CP-079)?** The warning is in; the credit is unchanged.

Still open and needing sources, not decisions: re-reading the KZN table (CP-083); a Western Cape government source (CP-076); months for the eight crops without a column (CP-082); a heat rule (CP-080); a first-language check of two isiZulu labels.

Evidence folder: [`evidence-crop-plan-accuracy-fixes/`](evidence-crop-plan-accuracy-fixes/). Branch `claude/blissful-pasteur-1c4ne6`, PR #1328.
