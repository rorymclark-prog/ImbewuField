# Sowing-calendar rule: held-out test — 2026-11-11

- Auditor: Claude, at Rory's instruction of 11 November 2026 ("you can continue … I want this done accurate and thoroughly once and for all").
- Reviewed revision: main `84e42a24e48932e386eaae58343fc01eb51ded8e`. No application file is changed by this audit.
- Deployment inspected: not inspected. This audit runs the planner's own functions on climate data.
- Previous audit: [crop plan accuracy fixes, 10 November](../2026-11-10/crop-plan-accuracy-fixes-claude.md). Carried forward: CP-073 remaining, CP-078, CP-083, CP-098, CP-099. IDs continue from CP-103.
- Scope: which sowing calendar a real South African place is given by the automatic rule.
- Evidence type: the app's own functions run on places it was not designed on, judged against a second gridded frost record. No field check and no agronomist review.
- Reviewed by: Codex, interim, on `9a5b102e` (tree `fec2aebb`): changes required. What was done about each finding is in [the dispositions record](codex-interim-review-dispositions-claude.md). Two corrections from that review apply throughout this page and are stated first.

## Two corrections to read before the results

**1. "54 of 56" is frost-constraint compliance. It is not calendar or farming accuracy.** The four criteria are one-sided. An answer that gives every place the winter-rainfall calendar passes all four at all 56 held-out places and all 44 development places ([`outputs/criteria-controls.txt`](evidence-calendar-holdout/outputs/criteria-controls.txt)). The criteria forbid certain frost mistakes; they cannot tell whether a place got the right calendar, and they say nothing about sowing months, crops or yields. No accuracy percentage can be taken from this page.

**2. The second record is not "ERA5 only at the nearest cell".** I described it that way. The collector did not send a `models` or `cell_selection` parameter, so the provider's defaults applied. Open-Meteo's documentation says its default "Best Match" combines ECMWF IFS (from 2017), ERA5 and ERA5-Land, picks a land grid cell of similar elevation and adjusts to the point's elevation. The responses do not say which model produced them. The returned cells are 1 to 8 km from each town (median 4.3 km), and no two of the 56 share one. Wherever this page says "ERA5" or "independent record", read "Open-Meteo archive, default model selection, 2001 to 2020". The numbers are unchanged. The same applies to the 44 places of 10 November, collected the same way.

How independent it is: it is a different product from the app's NASA POWER reading, at a finer grid. Both are reanalysis-based and may share observations. Neither is a weather station or a farm.

## Why

The rule that picks a site's sowing calendar was corrected on 10 November using 44 real places. Those places shaped the rule, so they can only show that it still does what it did. They cannot show that it works somewhere new. This audit tests it on places that were held back.

## Written down before any data was fetched

The places, their guide regions and the pass criteria are in [`evidence-calendar-holdout/holdout-places.json`](evidence-calendar-holdout/holdout-places.json). That file was committed and pushed before any climate data for these places was requested, so the commit order shows the criteria were not fitted to the results.

- 56 places, none of them among the 44: 53 across all eight regions of the regional guide and 3 with no clear region. (The first version of this line, the commit message and the pull request said "56 plus 3". The places file has always held 56; the sentence was wrong.)
- The rule under test is frozen at `84e42a24`.
- Four pass criteria, H-A to H-D, are the same frost rules the 44 places are held to in `tests/sa-calendar-real-sites.test.ts`.
- Reported but not judged: whether the two climate datasets agree, close-call flags, and month overlap with the regional guide.
- A failure is recorded by name. No rule is changed in this audit.

## Results

Run on 11 November 2026 at 04:17 UTC, on the frozen rule. All 56 places returned an app reading and an independent record.

**54 of 56 complied with all four frost criteria. 2 did not: Butterworth and Mossel Bay.** See correction 1 above for what that does and does not mean.

| Criterion | Places it applies to | Failed |
| --- | --- | --- |
| H-A: a hot, frost-free calendar needs a frost-free record | 8 | 0 |
| H-B: a light-frost calendar needs fewer than 0.5 frost days a year | 12 | 0 |
| H-C: 1 or more frost days a year needs a frost calendar | 22 | 0 |
| H-D: never froze in 20 years, and the app's own record minimum is above 0 °C, must not be on the hard-frost calendar | 21 | 2 |

Calendars given: Winter frost 32, Light frost at most 12, Hot area, no frost 8, Winter rainfall 4.

The raw daily responses were checked offline after the review ([`outputs/raw-verification.txt`](evidence-calendar-holdout/outputs/raw-verification.txt)): all 56 hold the exact 7,305 days from 1 January 2001 to 31 December 2020, state °C and mm, have no missing value, and give the same frost figures when rebuilt without the collector's code. The collector itself did not check any of that before scoring; the review was right that it would have accepted an incomplete or mislabelled record. The check now refuses five corrupt records, including the review's three ([`outputs/raw-verification-negative-controls.txt`](evidence-calendar-holdout/outputs/raw-verification-negative-controls.txt)). The raw responses are in the repository: [`outputs/raw-responses-2026-11-11.tar.xz`](evidence-calendar-holdout/outputs/raw-responses-2026-11-11.tar.xz).

Raw results for every place: [`outputs/holdout-results.json`](evidence-calendar-holdout/outputs/holdout-results.json). Tables: [`outputs/holdout-summary.txt`](evidence-calendar-holdout/outputs/holdout-summary.txt). Run log: [`outputs/holdout-run.txt`](evidence-calendar-holdout/outputs/holdout-run.txt). Scripts: [`holdout-harness.ts`](evidence-calendar-holdout/holdout-harness.ts), [`summarise.py`](evidence-calendar-holdout/summarise.py).

## Findings and disposition

| ID | Problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-103 | Two places that never froze on either record are given the hard-frost calendar | open, rule unchanged, decision needed | See the next two sections: what happens, the fix that was tried and not adopted, and three options. |
| CP-104 | The winter-rainfall calendar is reached by rain timing alone, with no frost check | open, reported not judged | Calvinia is on the Western Cape calendar with 4.45 frost days a year on the independent record and an app record minimum of -4.1 °C. Its months come from the regional guide's Western Cape and South Coast column; Calvinia is in the Great Karoo. Malmesbury (0.6 frost days a year) and Paarl (0.1) are milder cases. Needs a source for winter-rainfall areas with a frost season before any change. |
| CP-105 | The two climate datasets disagree on the calendar at 9 of 56 places | open, reported not judged | Malelane, Hazyview, Letsitele, Mokopane, Bela-Bela, Makhanda, Butterworth, Mossel Bay, Calvinia. The app uses NASA POWER. The same rule on ERA5 monthly values gives a different calendar. Seven of the nine are places the rule itself marks as close to a line, or have a frost record that differs between the datasets. This is the size of the uncertainty in any gridded reading. It is why the grower's own choice and frost answer take priority. |
| CP-106 | Three pairs of towns share one climate reading | open, reported not judged | eMalahleni and Middelburg; Jozini and Pongola; Paarl and Malmesbury. NASA POWER's grid cell is about 50 km wide, so neighbouring towns get identical readings and the same calendar. Not a defect in the rule; a limit of the data. |
| CP-073 remaining | Tomatoes, butternut and pumpkin share no month with the regional guide on the light-frost calendar at the edge of hot areas | open, now at four more places | Malelane, Barberton (Lowveld column), Port Shepstone, Eshowe (KZN coast column). Same pattern as Mbombela and Tzaneen. Port Shepstone misses the hot-area calendar by 0.4 °C on its hottest month. |
| CP-098 | Peas and watermelon share no month with the guide's Middleveld column on the hard-frost calendar | open, now at five more places | Mokopane, Bela-Bela, Brits, Zeerust, Thabazimbi. Same as Polokwane, Pretoria and Rustenburg. |
| CP-099 | Onions share no month with the guide on the light-frost calendar on the south coast | open, now at two more places | Hermanus, Knysna. Same as George. |

## CP-103: Butterworth and Mossel Bay

| Place | Calendar given | Coldest month | App record minimum (NASA POWER) | Independent record (ERA5, 2001-2020) |
| --- | --- | --- | --- | --- |
| Butterworth | Winter frost | 12.9 °C | 1.4 °C | no frost day; lowest 2.2 °C |
| Mossel Bay | Winter frost | 12.5 °C | 1.7 °C | no frost day; lowest 4.0 °C |

Why it happens. The rule treats a record minimum of 2 °C or more as frost-free. Below that, a place is cleared of a frost season only if its coldest month averages 13 °C or more. A place whose record minimum is between 0 and 2 °C and whose coldest month is under 13 °C falls through to the hard-frost calendar, although its own record never reached freezing.

What a grower there sees today. The plan says the site is close to the line for the "Light frost at most" calendar, and that a grower who has never seen frost can say so in the site survey. The answer "no frost" moves both places to the light-frost calendar. So the miss is flagged and correctable, and it errs toward caution. It is still a miss: the automatic answer is wrong for a place both records call frost-free.

One wording slip found on the way: Mossel Bay's reason line rounds its record minimum to "2 °C", the same number as the frost-free line it falls below.

All places from both sets (100) whose app record minimum is between 0 and 2 °C:

| Place | Set | Record minimum | Coldest month | Calendar today | ERA5 frost days a year | ERA5 lowest |
| --- | --- | --- | --- | --- | --- | --- |
| Lephalale | 44 | 0.1 | 15.3 | Light frost at most | 0 | 1.1 |
| Pietermaritzburg | 44 | 0.6 | 12.9 | Winter frost | 0.2 | -0.4 |
| Tzaneen | 44 | 0.7 | 13.8 | Light frost at most | 0 | 2.8 |
| Ulundi | held-out | 1.2 | 13.8 | Light frost at most | 0 | 2.0 |
| Makhado | held-out | 1.2 | 14.8 | Light frost at most | 0 | 1.7 |
| Butterworth | held-out | 1.4 | 12.9 | Winter frost | 0 | 2.2 |
| Paarl | held-out | 1.4 | 11.5 | Winter rainfall | 0.1 | -2.2 |
| Malmesbury | held-out | 1.4 | 11.5 | Winter rainfall | 0.6 | -1.7 |
| Mossel Bay | held-out | 1.7 | 12.5 | Winter frost | 0 | 4.0 |

No place in this band has a frost season on the independent record. The most is Malmesbury's 0.6 days a year, and it is on the winter-rainfall calendar.

### The obvious fix was tried and not adopted

After the results above were committed and pushed (`9a5b102e`), I tried the direct fix in a working copy: treat a record minimum above 0 °C as "light frost at most". I measured what it does and then put the rule back. The thresholds and the calendar each place gets are the same in this branch as on main. (Later the same day the close-call search gained two trials after independent review; that changes what one place, Eshowe, is told and no place's calendar. See [the Argon dispositions](argon-claims-dispositions-claude.md).)

What the change would do, measured on all 100 places:

- It moves exactly three: Butterworth, Mossel Bay and **Pietermaritzburg** (record minimum 0.6 °C). All four criteria then pass at all 100 places.
- Pietermaritzburg's independent record has four frost days in twenty years: 24 May 2007, 16 June 2010, 9 July 2014 and **22 August 2003**. The light-frost calendar adds August sowings of potato, watermelon, gem squash, baby marrow, spanspek and sweetcorn.
- **Eight crops have no months on the light-frost calendar at all** (CP-082, open since 10 November): amaranth, sorghum, soybean, bambara groundnut, sunflower, mung bean, spider plant and African nightshade. A place moved to that calendar loses them from its plan.
- Against the regional guide, the moved places are offered more of the guide's months and more months the guide does not list:

| Place (guide column) | Calendar | Share of the app's months the guide lists | Share of the guide's months the app offers |
| --- | --- | --- | --- |
| Pietermaritzburg (KZN Midlands) | Winter frost, today | 73% | 76% |
| | Light frost at most | 55% | 89% |
| Butterworth (E Cape) | Winter frost, today | 78% | 75% |
| | Light frost at most | 61% | 90% |
| Mossel Bay (W Cape and South Coast) | Winter frost, today | 74% | 66% |
| | Light frost at most | 65% | 90% |

So the change fixes the frost label and has real costs. It takes eight crops away at the moved places, it moves a large town that does see an occasional late frost, and nothing I have shows the light-frost months suit these three places better than the hard-frost ones. That is a farming judgement, not a bug fix, and it is not mine to make alone.

### Options for CP-103

1. **Leave the rule as it is (what this branch does).** The two places stay on the cautious calendar. The grower is told the site is close to the light-frost line and can move it with one answer or by choosing a calendar. `tests/sa-calendar-real-sites.test.ts` now pins that advice at both places by name.
2. **Change the rule after CP-082 is closed.** Once the eight crops have sourced light-frost months, moving a place no longer takes crops away. Then make the change and test it on a new held-back set. This is my recommendation.
3. **Change the rule now.** Accept the loss of the eight crops at moved places until CP-082 is closed.

## What these results are and are not

- They are a check of four frost constraints on places that did not shape the rule, against a second gridded dataset. They are not weather-station records, farm observations or an agronomist's judgement.
- They are not an accuracy score. A place-blind answer passes all four constraints (correction 1). A real validation needs criteria that can tell calendars apart, written down before new places are looked at.
- One such criterion was tried **after** the results were known, so it is a description, not a result: whether the app's winter / not-winter answer agrees with the rain timing of the second record. It agrees at 55 of 56 places; Calvinia differs (CP-104). An always-winter answer would be wrong at 53 of 56. It uses the app's own 0.35 line and places already seen, so it is a candidate for the next pre-registered validation and nothing more.
- All 56 places are in South Africa, between 34.4°S and 23.0°S. Nothing here applies to another country or hemisphere.
- 19 of the 56 lie within 55 km of one of the 44 development places (the review's count). The app's reading is a grid cell about 50 km wide: three pairs of held-out towns share one reading, leaving 53 distinct readings. I have not measured how many held-out places share an app grid cell with a development place, so no independent sample size is claimed.
- The frost constraints say nothing about whether the sowing months inside a calendar are right for a place.
- Month overlap with the regional guide is reported in the summary file, by place, by region and by named crop-and-place pair. It is overlap with one secondary guide from 2004 under my own assignment of places to its regions. It is not an accuracy figure. The app's Western Cape rows are taken from that guide, so overlap there is by construction.
- Coordinates were typed from memory to two decimals. A wrong town centre by a few kilometres selects the same or a neighbouring grid cell.
- These 56 places have now been seen. From here they are regression evidence. Any change to the rule needs a new held-back set.

## Verification

- Typecheck: not relevant to this step; no application file changed.
- Full test suite: not run for this step.
- Output inspected: the raw results file and the summary, in full.
- Other limits: no station data, no field check, no agronomist.

## Next continuation

1. Decide CP-103 from the three options above. My recommendation is option 2.
2. CP-082 (months for the eight crops) now blocks a clean fix for CP-103. It needs sources.
3. CP-104 needs a source before any change.
4. The 56 places are now a regression fixture, `tests/fixtures/sa-climate-holdout-2026-11-11.json`. Criteria H-A to H-C run over all 100 places in `tests/sa-calendar-real-sites.test.ts`.
