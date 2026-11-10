# Crop plan accuracy fixes: calendar choice, sowing months and weekly-target timing — 2026-11-10

- Author: Claude, at Rory's instruction on 10 November 2026: "go ahead and fix the accuracy issues". A Sonnet agent wired the screen wording; I designed the rule, made every farming-data change and reviewed the agent's work.
- Reviewed revision: branch `claude/blissful-pasteur-1c4ne6`, commits `5f92c7ae` and `7e4db70c`, on top of released `29e5516`.
- Deployment inspected: not inspected. The changes were run and looked at on a local development server (the public sample farm).
- Previous audit: [the accuracy audit of the same day](crop-plan-accuracy-claude.md) (CP-073–CP-083). This record says what was done about each finding. IDs continue from CP-086.
- Scope: how a site gets its sowing calendar; the sowing months in the four calendars; the weekly-target timing message. Yields, spacing, durations, fruit trees and animals are unchanged.
- Evidence type: the app's own functions run for 44 real South African places against an independent frost record; comparison with a published regional guide before and after; new tests that fail when the old behaviour is put back; four screens looked at in a browser. No field check and no agronomist review.

## How far off it was, and what it is now

The audit's worst finding was that places whose records show no frost were shown the opposite season to their regional guide. The rule that caused it is fixed. No farm has been checked on the ground. The interior, where most of the country farms, was already close and moved a little.

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

Five things to know before reading those numbers:

- **They are not a pass mark.** The guide is a seed-industry table from 2004. A wide sowing window and a narrow one weigh differently. The numbers show which regions fit their own published advice and which did not.
- **The Western Cape figure is by construction.** Those rows are now taken from the same guide, so agreeing with it proves nothing. Every other region's rows come from other sources, so the guide is an independent check there.
- **The Lowveld is 61%, not 72%, because of two towns.** Komatipoort, Phalaborwa, Musina and Thohoyandou reach 72%. Mbombela and Tzaneen stay at 42%: their readings put them just on the cold side of a line (see CP-073 below).
- **They are overlap with one guide, not accuracy.** They are not a pass rate or field validation. The 13 crop-and-place pairs that still share no month are named one by one in Update 2 below, with the one place the fixes made worse (George, onions) and the reason the Middleveld figure fell.
- **The 44 places can no longer test the rule independently.** They were used to design it. From here on they are regression evidence, and a claim that the rule generalises needs places that were held back.

Calendar choice, over the 44 places: 11 changed calendar. NASA POWER and the independent record now give different calendars at 2 places, down from 9.

## Findings and disposition

| ID | Problem | Status | What was done, evidence, and what is left |
| --- | --- | --- | --- |
| CP-073 | Frost-free Lowveld and Limpopo sites got the hard-frost calendar | fixed for five of seven; two improved | Frost is now read from the site's record minimum temperature, which the app already downloaded and never used for this. It is NASA POWER's "minimum hourly air temperature … in the period of interest": a record low for the grid cell. It matches the independent 20-year lowest daily minimum to a median 0.1 °C. Komatipoort, Phalaborwa, Musina and Thohoyandou now get the hot-area calendar; Lephalale the light-frost one. **Mbombela and Tzaneen get the light-frost calendar, not the hot one.** Mbombela's coldest month reads 15.9 °C against a 16 °C line; Tzaneen's grid cell includes the escarpment and has touched 0.7 °C. The rule leans cold on purpose. Mbombela is told it is close to the line, and a grower there who answers "we have not seen frost here" in the site survey gets the hot-area calendar. Tzaneen is not within reach of that. [`outputs/calendar-choice-matrix.txt`](evidence-crop-plan-accuracy-fixes/outputs/calendar-choice-matrix.txt). |
| CP-074 | No working calendar for hot, frost-free, summer-rainfall places | fixed | The hot-area calendar is now chosen by frost and heat, not by rain timing. Three conditions: no frost on record (record minimum 2 °C or more); a coldest month of 16 °C or more, the bottom of the common bean's optimum range in FAO ECOCROP, because the hot-area calendar sows beans through winter; and a hottest month of 24 °C or more, the top of the optimum range for cabbage, broccoli, carrots and peas in the same table, because that is the summer the calendar closes. Durban and the Mkuze sample farm moved to it. East London, George and Gqeberha, frost-free with mild summers, read the light-frost calendar, where their guide fits better. `lib/koppen-global.ts`. |
| CP-075 | The frost-free calendar did not match its own source | fixed | 16 hot-area rows changed. Fourteen now match the KZN table's hot-area column as transcribed: peas March to May, not January; cabbage February to June; green beans February to September; lettuce February to August. Kale and coriander have no row in any table; they borrow the cabbage and lettuce rows and stay marked as unchecked, so a plan still tells the grower to confirm them. `lib/crop-catalog.ts`; [the 39 changed rows](evidence-crop-plan-accuracy-fixes/outputs/guide-agreement-before-after.txt). |
| CP-076 | The Western Cape calendar was partly a copy of the hard-frost one | fixed with a secondary source | Rows that were copies or empty now follow the regional guide's Western Cape column where it has a row: peas April to August, onions April to May, cabbage November to April, green beans October to February. Sweetcorn, gem squash, baby marrow, spanspek and turnip have months for the first time. Frost-tender crops sown in the ground start in September even where the guide opens in August, for the inland valleys. Kale's row is still borrowed and its comment says so. **The source is secondary** (seed industry, 2004) and each row's comment names it as such. No government table for the Western Cape was found. |
| CP-077 | Six hard-frost rows carried months no source lists | fixed | Peas: July to September, not February and March. Broad beans: April and May. Broccoli: September to February. Potato: September and October, not August. Sweet potato: November only. Each month left is in the KZN cold-area row or in the guide's column for an interior region. Cabbage and onions were checked and left: every month they offer is in one of those. |
| CP-078 | The calendar depended on which climate dataset was asked, and nothing told the grower | fixed | The two records now disagree at 2 of 44 places (Thohoyandou, Springbok), from 9. Ten places are flagged as close to a line. The planner now names the calendar, shows the three readings it rests on and says when the site is close to another calendar. Worcester still gets the hard-frost calendar on both records. Since the later update below, a grower can also choose the calendar for a site themselves, which settles any farm whose ground differs from its grid cell. Screens [`01`](evidence-crop-plan-accuracy-fixes/01-calendar-and-reasons-desktop.png)–[`03`](evidence-crop-plan-accuracy-fixes/03-calendar-and-reasons-phone-dark.png). |
| CP-079 | Weekly targets were matched to the late edge of harvest | fixed as a warning; the arithmetic is unchanged | A target card now says how many linked sowings could be ready before the buyer's window opens, and from which month. The earliest month uses the lower end of the catalogue's own duration range and the shortest nursery period the planner already allows. What is credited to a target did not change: that is Codex's weekly-goals arithmetic and a product decision. Screen [`04`](evidence-crop-plan-accuracy-fixes/04-weekly-target-ready-early-phone.png). |
| CP-080 | The heat check almost never fires | open | Not changed. The hot-area calendar now does the job the heat check could not: it closes midsummer for cool-season crops. A better heat rule still needs a source. |
| CP-081 | September is still a frost month in the coldest places | fixed in part | Potatoes moved a month later (CP-077). A site whose coldest month averages under 9 °C is now told that frost often lasts into September and to plant out tender crops after its own last frost. All seven audited places that frosted in September in 15% of years or more are under 9 °C. August sowing of tomatoes and peppers in trays is unchanged. |
| CP-082 | Whole regions could not plan some of their own crops | cowpea fixed; the rest open | Cowpea has December on the light-frost calendar, from the national Cowpeas Infopak. The other eight traditional and field crops still have no month outside the hard-frost calendar, because no source was found. |
| CP-083 | The source tables could not be re-read | needs verification | Still true. The KZN department's site was unreachable again on 10 November. Every KZN row used here is an earlier transcription, now collected in one file with that status stated. |
| CP-086 | New. With no site climate, a Karoo farm fell back to the frost-free calendar | fixed | The seven-point fallback table records rain timing, and "rain all year" was being read as "frost-free". The fallback now leans cold and never gives the hot-area calendar. `lib/water-calc.ts`. |
| CP-087 | New. One setting answered two questions: which calendar, and when the rain falls | fixed | A hot Lowveld farm on the frost-free calendar would have been labelled "All-year rainfall" and had its water tank sized as if rain came all year. Rain timing is now a separate reading. Labels name the calendar and the rain: "Hot area, no frost · summer rain". |
| CP-088 | New. Plans warned growers to re-check months that were sourced | fixed | The list of cited hot-area rows had 8 crops while the catalogue's own comments cited the table for 8 more (cauliflower and radish among them). It now has 32, and a test keeps the list and the months in step. |
| CP-089 | New. A plan made before these fixes keeps its old sowing months | fixed (see the update below) | Nothing rewrites a saved plan, which is right. But a grower in Komatipoort or Durban whose calendar changed was not told which of their saved sowings were now out of season. The plan now lists them, with the months the calendar does offer, and says nothing was moved. |
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

1. **Merging.** The branch holds the page fixes (steps 1 and 2), these farming-data changes and the two features in the update below. Under AGENTS §1 farming data and saved-plan changes need the full suite green before merge.
2. **Should an early-ready sowing still count toward a target (CP-079)?** The warning is in; the credit is unchanged.

3. **Should a mapped site whose climate has not loaded get the out-of-season list (CP-094)?** It does not, since Update 2. The reasoning and the cost are at the end of that section.
4. **Should the sowing calendar page and the Atlas follow the grower's chosen calendar and use the planner's calendar names (CP-097)?** They do neither today.

Decided and done on 10 November, see the updates below: a direct calendar choice for growers, and telling growers which saved sowings are out of season.

Still open and needing sources, not decisions: re-reading the KZN table (CP-083); a Western Cape government source (CP-076); months for the eight crops without a column (CP-082); a heat rule (CP-080); a first-language check of two isiZulu labels; local or primary evidence for the 13 named pairs that share no month with the guide (CP-073 remaining, CP-098, CP-099); and places held back from rule design, with their own frost dates, to test the calendar rule independently.

## Update, later on 10 November 2026: a grower's own calendar choice, and the out-of-season list

Rory: "go ahead with decisions 2 and 3". Commit `f11d5d09`. A Sonnet agent wired the screen; I wrote the shared logic, the sample-farm change and the tests for them, and reviewed and drove the result in a browser.

| ID | Problem | Status | What was done |
| --- | --- | --- | --- |
| CP-078, decision 2 | A grower could not pick their own calendar | fixed | In Auto-suggest a plan there is now "Sowing calendar for this site": the four calendars, each with places a grower can recognise, and "Let the app decide". The choice is saved with the plan, per site, so it cannot leak onto another farm. Order of authority: the grower's choice, then the climate reading moved by their frost answer, then the regional fallback. The screen says the calendar is theirs and what the climate records would give. If they choose a warmer calendar than records that show frost, it says so and asks them to record their frost months. `lib/crop-plan.ts`, `lib/site-climate.ts` `sowingCalendarInUse`. Screens [`05`](evidence-crop-plan-accuracy-fixes/05-choose-calendar-phone-light.png), [`08`](evidence-crop-plan-accuracy-fixes/08-chosen-calendar-header-desktop.png). |
| CP-089, decision 3 | Saved sowings that no longer fit the calendar were not flagged | fixed | Above the bed calendar the plan lists planned sowings the calendar in use does not offer, each with the months it does offer, and says nothing was moved. It gives the real reason: the grower's own calendar choice, or a plan that may predate the 10 November correction. Left out: crops already in the ground, dated sowings in the past, and rows planned on the grower's own estimates. "Hide this list" is remembered on the device; the list returns when it or the calendar changes. `lib/sowing-calendar-review.ts`. Screens [`06`](evidence-crop-plan-accuracy-fixes/06-out-of-season-notice-phone-light.png), [`07`](evidence-crop-plan-accuracy-fixes/07-out-of-season-notice-phone-dark.png). |
| CP-091 | New. The public sample farm's own plan modelled the wrong season | fixed | The sample farm is in the Mkuze valley, now on the hot-area calendar. Its plan was written for the hard-frost calendar the site used to get, so four sowings were out of season and every visitor would have opened it to the new list. Butternut (December), tomatoes and green beans (October) and lettuce (September) now read March, September, February and August: the nearest in-season months that never overbook a bed in any opening month. `lib/demo-farm.ts`. |

Verification for this update:

- Typecheck clean. The 281 test files that touch the plan store, the sample farm or the calendar modules pass (4,081 tests). The full suite runs in CI on the pushed head.
- New tests: `tests/sowing-calendar-choice.test.ts` (the choice survives a real save and reload and an older plan still loads; who wins; the wording; which sowings are listed and which are not; the sample farm is in season in all twelve opening months) and `tests/sowing-calendar-choice-ui.test.ts` (the page uses the one rule, saves through the ordinary autosave, and reads the hidden list only after the page has loaded).
- Existing tests rewritten with reasons: `plan-assurance` and `cropplan-simple` pinned the old derivation and chip order; `report-site-facts` used the sample farm's December butternut to prove December is not dropped, and now does that with its own fixture.
- Driven in a browser on the public sample farm, local server, 390 px light and dark and 1280 px: no list before any choice; the five options and a 44 px control; choosing "Winter frost" changed the header and listed five sowings with the right months; "Hide this list" removed it and stored the choice; "Let the app decide" restored the automatic calendar and the list stayed gone. No horizontal overflow.
- Not checked: a signed-in account on a real device; the first save on a device that has never stored a plan (it uses the same path as adding a crop); the printed plan with a chosen calendar; changing the calendar while a suggested plan is already on screen for review (the control is on the questions step, and the review is not regenerated).
- Limits: the choice is saved on the device with the plan, like the plan itself; it does not travel to another device. A grower can choose a calendar the climate records contradict. That is the point of the feature, and the screen says what the records show, but nothing stops them.

Evidence folder: [`evidence-crop-plan-accuracy-fixes/`](evidence-crop-plan-accuracy-fixes/). Branch `claude/blissful-pasteur-1c4ne6`, PR #1328.

## Update 2, later on 10 November 2026: independent review fixes, the display path, and the remaining mismatches by name

Codex reviewed this branch at `2218228e` and `0c005462` and left nine comments on PR #1328. This section answers them. Code and tests are in commit `9a980a5c`. No sowing month, threshold, yield or species changed. The 44-place calendar matrix and the catalogue dump were regenerated on that commit and are byte-identical to the committed outputs, so the fixes below changed no place's calendar.

### Findings from the review

| ID | Problem | Status | What was done |
| --- | --- | --- | --- |
| CP-092 | New (review comment 6762553064). A missing-value marker could be read as a record low temperature | fixed | `recordMinimumC` checked the provenance tag and then accepted any finite number, so NASA POWER's missing marker (-999; the cleaning rule's cutoff is -900) came back as a record low of -999 °C. Reproduced with the published helper. On the 44-place fixture a marker put -999 on every place's reason line and moved four places (Durban, Richards Bay, Komatipoort, Phalaborwa) off the calendar their no-minimum reading gives ([`outputs/missing-marker-effect.txt`](evidence-crop-plan-accuracy-fixes/outputs/missing-marker-effect.txt)). The helper now passes a tagged value through `cleanPowerValue`, the one cleaning rule. Real frost readings and exactly 0 °C are kept. This is a fault in how a stored payload is read; it is not a claim that NASA sends these markers today. `lib/climate-temperature.ts`. |
| CP-093 | New (6762918246). A hidden out-of-season list stayed hidden when the recommended months changed | fixed | Each line of the list ends "This calendar sows it Feb–Jun", but the stored signature left those months out. A later correction to a crop's months changed what the list says and a grower who had hidden it was never shown the new one. The signature now carries each row's recommended months in one fixed form (valid months, each once, in calendar order). Row order and month listing order still do not count as a change. `lib/sowing-calendar-review.ts`. |
| CP-094 | New (6762970071). The out-of-season list judged a saved plan against a fallback guess | fixed | A mapped site whose own climate has not been read (first visit, offline with nothing cached, provider down) is on the nearest reference region. That fallback is labelled and is never the hot-area calendar. The list then told a hot-area grower that in-season sowings were wrong, and took it back when the climate loaded. The reviewer saw exactly this on the hosted preview: sample farm, fresh browser, Durban light-frost fallback, March butternut and February green beans listed. Saved sowings are now listed only when the calendar comes from the site's own climate, the grower's frost answer or the grower's choice, or when no site is mapped at all (the fallback is then the only calendar the plan ever had). The header still says the calendar is a fallback and the crop picker still offers the fallback's months. Why the hosted preview had no climate reading was not established. `lib/sowing-calendar-review.ts` `calendarCanJudgeSavedSowings`. |
| CP-095 | New (found while checking every surface the choice reaches). The printed plan did not say the grower chose the calendar | fixed | The PDF printed a chosen calendar after "This site (satellite climate records)" and nothing more, so a calendar the records do not give read as if they gave it. It now ends "(sowing calendar chosen by the grower)", matching the screen's "chosen by you". Read back from a downloaded PDF: [`outputs/pdf-calendar-lines.txt`](evidence-crop-plan-accuracy-fixes/outputs/pdf-calendar-lines.txt). `lib/sowing-calendar-label.ts` `printedSowingCalendarLine`. |
| CP-096 | New (6762593993). Two frost statements claimed more than a grid can show | fixed, wording only | The accuracy audit and both evidence READMEs said every ERA5 frost figure is a lower bound. The evidence shows grid estimates. They can miss frost in a cold hollow; nothing here establishes the size or direction of the difference at any one farm. The comment on `FROST_FREE_RECORD_MIN_C` said "no frost at screen height or in hollows"; it now says the 2 °C line is the rule's working line on grid evidence, not an assurance about a farm. Reworded in the audit record, two READMEs, the harness and its one output sentence, and three code comments. No count and no threshold changed. |
| CP-097 | New, open. The sowing calendar page and the Atlas do not follow the grower's choice and name the calendars differently | open | Found by reading the code, not exercised in a browser. `/calendar` shows a reference pattern the visitor picks on that page and never reads the plan. The Atlas shows the automatic reading for whichever map point is clicked, without the frost answer or the choice. Both still name the hard-frost and light-frost calendars by rain ("Summer-rainfall pattern", "Summer rainfall, light frost") where the planner says "Winter frost" and "Light frost at most". A grower who chose a calendar can therefore see a different name, or a different calendar, for their own site on those two screens. Not changed here: it needs a decision on whether those screens should follow the plan, and new isiZulu wording that a first-language speaker should check. |

Also noted, no change needed: the reviewer fetched NASA POWER's own definition of `T2M_MIN` and it supports how `recordMinimumC` reads the field (6763186529). The KZN table could not be re-read again at 09:31 UTC (6763875421), so CP-083 stays open.

### Every surface the calendar reaches

| Surface | Which calendar it shows | Follows the grower's choice | How it was checked |
| --- | --- | --- | --- |
| Production plan: header, Auto-suggest, crop picker months, out-of-season list | The calendar in use | Yes | Browser: real local farm and sample farm |
| A saved plan from before the choice existed (old storage key, 15 sowings) | The calendar in use | Yes | Browser: loaded, choice made, reloaded, list hidden, reloaded, choice cleared, reloaded |
| A farm with no saved plan at all | The calendar in use | Yes | Browser: the first save keeps the choice across a reload |
| The plan PDF from the page | The calendar in use, now with "(sowing calendar chosen by the grower)" | Yes | PDF downloaded and its text read |
| The PDF's variety shortlist ("Research climate group") | The site's climate reading | No, by design: it is variety guidance from the climate | Seen in the PDF text with the light-frost calendar chosen |
| Notes on a suggested plan ("Sowing calendar chosen by the grower: …") | The calendar in use | Yes | Source assertion in a test only; no plan was suggested in the browser this round |
| The PDF's frost-tender harvest flag | The calendar in use | Yes | Code reading only |
| Calendar file (.ics) export | The saved sowings' own months | Not applicable | Not checked |
| Sowing calendar page (`/calendar`) | A reference pattern picked on that page | No (CP-097) | Code reading only |
| Atlas panel | The automatic reading for the clicked point | No (CP-097) | Code reading only |
| Design report print page | Reads rain season for tank sizing only | Not applicable | Code reading only |
| No climate reading (cold cache, offline, provider down) | The labelled regional fallback; a choice still wins | Yes | Browser with the climate endpoint aborted, and tests |
| Sample farm | In memory only: every edit, including a choice, is forgotten on reload. That is how sample mode works for all data | Within the visit | Browser |
| Signed-in account, cloud sync, a second device, a physical phone, the hosted preview at this head | | | Not checked |

### Cases run for this update

Commit `9a980a5c`, local development server, 10 November 2026. "Passed" means the observed result matched the expected one on that commit; it says nothing about a farm.

| Case | Finding | Inputs | Expected, and why | Observed | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | CP-092 | -999, -900, -901, -899.9, -4, 0, 2, NaN, ±Infinity, "3", null; tagged and untagged | Same answer as `cleanPowerValue` when tagged `nasa-power`, null otherwise | As expected. With the old helper put back the test fails | `tests/climate-temperature.test.ts` | passed |
| R-02 | CP-092 | The 44-place fixture with a marker as each record minimum | Identical to the same place with no minimum; no marker in the reason line; real minimums unchanged | As expected. With the old helper put back the test fails | `tests/sa-calendar-real-sites.test.ts` | passed |
| R-03 | CP-093 | January cabbage told Feb–Jun, then Mar–May | Different signatures; same signature for reordered rows or months | As expected. Before: both `all-year\|p1:cabbage:1` | `tests/sowing-calendar-choice.test.ts` | passed |
| R-04 | CP-094 | Sample farm, climate endpoint aborted, 390 px light and dark, 1280 px | Fallback calendar, labelled; no out-of-season list | "Light frost at most · summer rain · nearest reference: Durban / KZN coast & hinterland (fallback)"; list absent | [`outputs/sample-farm-cold-cache-check.txt`](evidence-crop-plan-accuracy-fixes/outputs/sample-farm-cold-cache-check.txt), screens `09`–`11` | passed locally; the hosted preview at this head was not checked |
| R-05 | CP-094 | Same session; the visitor chooses "Winter frost", then "Let the app decide" | A choice is judged even with no climate: five sowings listed; then none | Five listed; then none | Same file | passed |
| R-06 | CP-094 | Sample plan against the fallback calendar itself | Butternut (March) and green beans (February) would be listed: the reviewer's observation, kept as a pinned case | Those two | `tests/sowing-calendar-choice.test.ts` | passed |
| R-07 | Decision 2 | Real local farm, no saved plan; choose light frost; reload; clear; reload | The choice is saved by the first save and survives; clearing survives | As expected | [`outputs/saved-plan-path-check.txt`](evidence-crop-plan-accuracy-fixes/outputs/saved-plan-path-check.txt) R1 | passed |
| R-08 | Decisions 2 and 3 | Real local farm, a 15-sowing plan in the old storage key with no choice field | Loads; no list on its hot-area calendar; light frost lists two; reload keeps both; hide survives a reload; a different calendar brings the list back; clearing survives | As expected | Same file R2, screen `12` | passed |
| R-09 | CP-095 | The plan PDF with light frost chosen, and with the automatic calendar | First ends "(sowing calendar chosen by the grower)"; second unchanged | As expected | [`outputs/pdf-calendar-lines.txt`](evidence-crop-plan-accuracy-fixes/outputs/pdf-calendar-lines.txt) | passed |
| R-10 | All | The 44-place matrix and catalogue dump regenerated | Byte-identical to the committed outputs: these fixes change no calendar and no month | Identical | `outputs/calendar-choices.json`, `calendar-choice-matrix.txt`, `catalog-after.json` | passed |
| R-11 | CP-073, CP-098, CP-099 | Guide comparison regenerated with every no-overlap pair named | 13 pairs, 12 outside the Western Cape, matching the reviewer's independent count | 13 and 12; the same six rows | [`outputs/guide-agreement-before-after.txt`](evidence-crop-plan-accuracy-fixes/outputs/guide-agreement-before-after.txt) | reproduced; the pairs themselves are open (below) |

### The 13 crop-and-place pairs that still share no month with the guide

The totals above hide which farms and crops are left. These are all of them. Each is a disagreement with a secondary seed-industry guide from 2004 under my own assignment of places to its regions. None is proof that the app's months are wrong, and none was "fixed" by moving months toward the guide. The 72 pairs before the fixes are listed by name in the same output file.

| ID | Places | Crop | The app sows (calendar) | The guide sows (its column) | Where the app's months come from | Disposition, and what would settle it |
| --- | --- | --- | --- | --- | --- | --- |
| CP-073, remaining | Mbombela, Tzaneen | Butternut | Oct–Dec (light frost) | Feb–Aug (Lowveld) | KZN Table 6 warm column, "Aug - Jan/Feb" for cucurbits, second-hand | Open. The automatic rule keeps both towns on the light-frost calendar: Mbombela's coldest month is 15.9 °C against a 16 °C line, Tzaneen's record minimum is 0.7 °C against a 2 °C line. Both are flagged as close calls, and a grower who has not seen frost gets the hot-area calendar from their survey answer or their own choice. A grower override does not show the automatic default is right. Needs frost records from a station or farms in each town, or a Mpumalanga or Limpopo sowing table. |
| CP-073, remaining | Mbombela, Tzaneen | Pumpkin | Sep–Nov (light frost) | Feb–Aug (Lowveld) | As above | As above |
| CP-073, remaining | Mbombela, Tzaneen | Tomatoes | Aug–Dec (light frost) | Jan–Jul (Lowveld) | The warm-column text for tomato is not held in the repository | As above |
| CP-098 | Polokwane, Pretoria, Rustenburg | Peas | Jul–Sep (hard frost) | Apr–Jun (Middleveld) | KZN Table 6 cold column, "Jun/Jul - Sept", second-hand | Open. Two sources disagree for the Middleveld; the guide's own Highveld column is Jul–Sep. Unchanged by the fixes in effect: the old row (Feb, Mar, Aug) shared no month either. Needs the KZN table re-read (CP-083) and a Gauteng, Limpopo or North West source. |
| CP-098 | Polokwane, Pretoria, Rustenburg | Watermelon | Oct–Dec (hard frost) | Aug–Sep (Middleveld) | Inside KZN Table 6's cold-column window for cucurbits, "Sept - Dec/Jan", second-hand | Open. The hard-frost calendar waits for frost to pass; the guide's Middleveld column sows earlier. Whether these three places belong on the hard-frost calendar at all is the same boundary question as CP-078. Needs local frost dates and a regional source. |
| CP-099 | George | Onions | Feb–Mar (light frost) | Apr–May (Western Cape and South Coast) | The light-frost onion row; the warm-column text for onion is not held in the repository | Open, and **introduced by these fixes**: George moved from the frost-free calendar (which shared a month) to the light-frost one. George has rain all year and is scored against the Western Cape column by my assignment, which may not suit it. Needs a southern Cape source for onion sowing dates. |

### What the before-and-after figures are, and are not

- **They are month overlap with one secondary guide.** They are not an accuracy figure, a pass rate or field validation, and this record should not be quoted as if they were.
- **The Middleveld fell from 79% to 76%, and the cause is one place.** Lephalale moved from the hard-frost to the light-frost calendar. Its share of offered months that the guide also lists fell from 79% to 67%, because the light-frost calendar offers more months than the guide's Middleveld column. The share of the guide's months it now covers rose from 68% to 87%, and its two no-overlap crops went to none. Polokwane, Pretoria and Rustenburg went from 79% to 80%. Lephalale is bushveld; the guide has no bushveld column and "Middleveld" is my assignment. Whether Lephalale is better served is not known.
- **The 44 places are no longer an independent check.** They were used to design the rule, so from here on they are regression evidence: they show the rule still does what it did. Saying the rule generalises needs places that were held back. None exist yet. New cases should come from extension officers or growers, with their own frost dates.
- **Three kinds of evidence are kept apart.** Source alignment: `tests/crop-calendar-sources.test.ts` holds each sowing month inside its transcribed source row, with every exception named. Real-site classification: `tests/sa-calendar-real-sites.test.ts` holds the 44 places to their audited calendars and to an independent gridded frost record. Independent validation by station, farm or agronomist: none.
- **The baseline is kept.** The audit's outputs in `evidence-crop-plan-accuracy/outputs/` are the "before" and are not regenerated. The fixes' outputs are separate files beside them. A later run should compare against both and keep the failures listed here, including the ones it fixes.

### Verification for this update

- Typecheck `npx tsc --noEmit` clean.
- Tests: the 284 test files that touch the changed modules, the plan store, the sample farm or the page pass locally (4,125 tests, no failures). The full suite was not run locally. It runs in CI on the pushed head and its result is not known at the time of writing; no earlier full-suite pass covers these farming-data changes.
- Each new test for CP-092 fails with the old helper put back (checked by restoring it), and R-03 was reproduced on the published function before the fix.
- Browser, local development server: the sample farm with the climate endpoint aborted at 390 px light and dark and 1280 px; a real local farm (signed out, not sample mode, built from the sample farm's design) through a fresh plan, an old saved plan, reloads, hide, a different calendar, clearing, and two PDF downloads. Scripts are in the evidence folder.
- Not checked: the hosted preview at this head; a signed-in account, cloud sync or a second device; a physical phone; a screen reader; the calendar page and the Atlas in a browser; the calendar file export; changing the calendar while a suggested plan is on screen for review; whether the first-run consent and goal prompts, which the real-farm script clicks through, read well. The two isiZulu labels are still unreviewed.

### One call in this update that is Rory's to reverse

CP-094 narrows decision 3: a mapped site whose climate has not loaded gets no out-of-season list. The alternative is to keep listing against the fallback with a sentence saying it is a guess. I chose silence because the fallback is never the hot-area calendar, so for hot-area farms the list was wrong in a known direction, and it appeared and disappeared as the climate loaded. The cost: a mapped site that never gets a climate reading never gets the list; its header says "fallback" throughout.
