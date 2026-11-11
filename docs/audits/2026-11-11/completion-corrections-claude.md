# Completion corrections after Codex's review of 00217575 — 2026-11-11

- Auditor: Claude, as author, on Rory's authorisation of 11 November 2026. Packet opened and read: `CLAUDE-COMPLETION-00217575.zip`, 431,083 bytes, sha256 `343d43e1d56e7e5b53143ec3ada196d08464144190f88be6dd69c82a9c79ce2b`, 37 entries (handoff, completion review, source manifest: all 30 listed files match `00217575`).
- Reviewed revision: starts from `00217575a6753d2f89134f6bd46309ba39f6dbaf`, tree `6319e26fce155635bb7492ae6f7ff3ab39d462b4`. The change is commit `7ee356e0` on branch `claude/blissful-pasteur-1c4ne6`, PR #1334. The exact head and tree are in the PR comment that links this record.
- Deployment inspected: local development server on the working tree that became `7ee356e0`.
- Previous audit: [Atlas climate card](atlas-climate-card-claude.md) and [Codex final review: dispositions](codex-final-review-dispositions-claude.md), same day. Carried forward: CP-107, CP-108, CP-109, CP-112, CP-113, CP-116.
- Scope: exactly those six. Calendar thresholds, sowing months, durations, yields, species, `PLAN_VERSION`, saved records and account boundaries are untouched.
- Evidence type: source review, automated tests (unit, whole-component render), browser at phone and desktop, exported PDFs read as text and as page images, contrast measured from screenshot pixels. Two Sonnet agents made the DataPanel and Atlas colour edits to my written specification; I reviewed their reports, ran the tests again and changed what did not hold.
- This patch does not close the historical backlog. See "Still open".

## Findings and disposition

| ID | Finding | Status | What changed |
| --- | --- | --- | --- |
| CP-113 | The site data panel classed frost from the coldest monthly **mean** and from an unvalidated minimum, and printed a frost-free day count, fixed southern months and frost-free class text. | fixed | See "CP-113". |
| CP-108 | A plan could hold frost-tender crops through months with frost and say nothing when the grower had recorded no frost months. | fixed as a qualification | See "CP-108". No month, duration or kilogram changes. |
| CP-112 | The reference PDF cover printed the year-free benchmark total under the dated plan year. | fixed as a label | The tile under the figure reads "every planned crop cycle counted once; not the harvest of the plan year", and "How the totals are calculated" gains one sentence saying the same and pointing to the year-by-year table. 69.1 kg and 11.3 kg are unchanged. |
| CP-107 | The sample farm's PDF printed "This site (satellite climate records)" directly before its fixed sample calendar. | fixed | The location reads "Sample farm". |
| CP-109 | A record minimum of 1.7 °C printed as "2 °C", the calendar rule's own frost-free line. | fixed | The calendar reason prints temperatures to one decimal. No threshold moved. |
| CP-116 | The rest of the Atlas panel used fixed colours; in dark mode the soil caution paragraph and the "Silt" figure were dark on dark. | fixed | Tokens declared per theme. Measured in both themes and both modes. |

## CP-113: what the site data panel now says

`components/DataPanel.tsx`. The validated record low comes from `recordMinimumC`: a number only when the provider tagged it, `null` for an outage default or a missing-value marker, and a real zero stays zero.

| Place on the panel | Before | Now |
| --- | --- | --- |
| Overview, "Frost risk" row | "Likely / Occasional / Rare" from `minTemp` against 2 and 5 | "Modelled record low" with the number, or "Not known" |
| Overview, insight line | "Frost expected … Protect tender crops Aug–Sep", "Light frost risk", or "Frost-free year-round … tropical food trees are viable" | "Modelled record low: X°C. This is a gridded figure for the wider area, not a frost record for your land.", or "not known" |
| Site summary sentence | "Protect against frost in winter." when `minTemp < 2`, validated or not | The same sentence and the same 2 °C line, on the validated value only |
| Overview, calendar strip | A "Frost" class for months with a mean below 3 °C, and a "Frost" legend entry | No frost class. Such a month reads "Rest", as other cool months did |
| Climate, chip | "Frost expected / Light frost risk / Frost-free" from the coldest mean | "Modelled record low: X°C" or "Record low: not known" |
| Climate, class summary (Cw, Cf, Cs) | Translated text promising "mild, dry winters … a long frost-free season", "mild temperatures", "wet, mild winters" | The current neutral class note, read from the table by code, so a note stored before 11 November is not printed |
| Climate, crop text | Cwb and Cwa: "warm, frost-free conditions also carry bananas, avocado…"; Cfb: "Mild winters keep frost-tender crops viable" | Those clauses and the fruit lists that rested on them are removed. Nothing was added or renamed |
| Climate, temperature footer | "Winter low ≈ X° (Jun–Jul)", "Summer high ≈ X°" | "Coldest month mean ≈ X° (month)" and "Hottest month mean ≈ X° (month)", the month taken from the data |
| Climate, "Frost & growing season" card | A twelve-box strip coloured from means, "Frost-free ≈ N days", "Light frost: Jun–Jul valleys", "Plant tender from mid-Aug" | The record low, and: "Frost months are not shown. Monthly averages cannot show frost, and this record has no daily frost history for your land. The record low is a gridded figure for the wider area." |
| Climate, wind advice | "Windiest Aug–Oct — site a windbreak … before spring." | "Prevailing wind is from the X — site a windbreak along that edge." |

The existing guard that withholds the whole Climate tab unless the monthly temperatures are complete is unchanged. New wording is English, marked `lang="en"`; no translation was written or activated. The old translated strings stay in the dictionaries, unused by this panel.

## CP-108: frost the plan cannot see

- **When it shows.** The plan holds at least one crop the catalogue already marks frost-tender, and the grower has not given frost months: no survey, no answer, or "yes" with no month ticked.
- **When it does not.** The grower answered "We have not seen frost here" (their observation stands, with the existing line that it does not promise future winters). Or they ticked months: then the existing check lists each crop against the months it holds ground, picking months included.
- **Where.** The production guide, which the plan page shows in the open beside its "Update site survey" button and the plan PDF prints under "What you reported about this farm". The printed bed-by-bed table marks each frost-tender row.
- **Wording.** "Frost-tender crops: frost months not confirmed", the crop names, then: "Planned picking can extend into frost. Confirm your local frost months; tender crops may stop producing when frost arrives." and "This plan has no frost dates for your farm. Record the months you see frost in the site survey, and the plan will check these crops against them." Table rows: "Frost-tender: picking may stop when frost arrives. Confirm your frost months."
- **What it does not do.** It names no month, shortens no crop and changes no kilogram. The older mild-frost table caveat, with its June and July window, is left exactly as it was (its own test still passes); that window is an unsourced figure and is listed under "Still open".

**One thing for Rory.** The notice is not limited by calendar, because unknown frost must not read as no frost. So it also shows on a plan whose calendar is "Hot area, no frost" from the climate records, as both browser runs here did. Answering the frost question in the survey removes it. If it should be hidden on that calendar, that is one condition to add.

## Existing tests whose claim changed

Nothing was skipped or weakened. Each change has its reason written beside it in the test.

| Test | Was | Now | Why |
| --- | --- | --- | --- |
| `production-guide.test.ts`, unknown frost | Three observations in every case | Four when frost is unanswered or unknown and a tender crop is planned; three for "no" | CP-108 adds the notice. The title's claim (no guarantee, no planned conflict) is still asserted, and widened |
| `sowing-calendar-label.test.ts`, the always-shown reason | "16 °C", "27 °C", "4 °C" | "16.4 °C", "26.6 °C", "4.2 °C" | CP-109. The fixture values are unchanged |
| `sowing-calendar-choice.test.ts`, the frost warning | "lowest on record -5 °C" | "-4.8 °C" | CP-109 |
| `report-assurance-translation/source-cases.json`, four soil caution snapshots | Fixed colours in the recorded markup | Token colours | CP-116. The visible text of each snapshot is identical: `outputs/soil-snapshot-text-check.txt` |

The first run of the affected tests failed five times on exactly these and one pinned key list; the full output of that run is kept as `logs/04a-…`. The key list is satisfied without editing its test: the guide's new field is absent when empty.

## Cases

| Case | Finding | Inputs | Expected and actual | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| D-a to D-i | CP-113 | The real panel rendered whole, Overview and Climate, on nine fixtures: complete with a tagged -4.8; Underberg -6.2; a real 0; an untagged 8; a tagged -999; incomplete; no receipt; contradictory receipt; a northern site | No frost class, mildness or fixed-month text; the right record low or "not known"; Climate withheld for the three unverified years; northern coldest month named "Jan"; rainfall kept | `tests/data-panel-frost-claims.test.ts`; text of each render in `outputs/datapanel-renders/` | passed |
| D-summary | CP-113 | Site summary sentence | Frost sentence for -4.8 and 0; none for the untagged 8 or -999 | Same file | passed |
| D-strip | CP-113 | Overview strip on three fixtures | No "Frost" label; a cold month reads "Rest" | Same file | passed |
| F-1 | CP-108 | No survey; no frost answer; "yes" with no month | The notice, the crop named, both sentences; no month name, digit or assurance in the wording | `tests/frost-uncertainty.test.ts` | passed |
| F-2 | CP-108 | "no"; a plan with no tender crop | No notice; the existing lines unchanged | Same file | passed |
| F-3 | CP-108 | A frost month only in the tomato's last held month | A conflict, and the guide lists the crop against that month | Same file | passed |
| F-4 | CP-108 | The bed-by-bed table with and without the flag | Caveat on the tender row only; every other field identical; the mild-frost caveat keeps its text | Same file | passed |
| F-5 | CP-108 | Count of frost-tender crops in the catalogue | 27, unchanged | Same file | passed |
| T-1 | CP-112 | The benchmark tile and the explanation | Time basis beside the figure and in the explanation; no digit in either line | Same file | passed |
| S-1 | CP-107 | Sample farm with each climate source | "Sample farm · … (sowing calendar set for the sample farm)", no "satellite"; other cases as before | Same file | passed |
| R-1 | CP-109 | Record minimum 1.7, coldest mean 15.9 | "1.7 °C" and "15.9 °C", never "2 °C" or "16 °C" | Same file | passed |
| A-1 | CP-116 | Atlas panel source | No fixed text colour; the old literals gone; every colour token declared per theme | `tests/atlas-panel-temperature-claims.test.ts` | passed |

## Browser and export cases

Local development server, Playwright (Chromium). The "local farm" is the published sample farm saved as an ordinary farm in a signed-out browser (a constructed fixture, not grower data); no survey is seeded, so frost months are not recorded. Scripts in `evidence-completion/scripts/`.

| Case | Observed | Result |
| --- | --- | --- |
| Plan page, local farm, after accepting the suggested 27 sowings | The notice with ten crop names and both sentences, the "Update site survey" button beside it, no sideways overflow at 390 px. The calendar reason reads "16.8 °C … 24.7 °C … 5.4 °C". | passed |
| Plan PDF, local farm | The notice under "What you reported about this farm", after "Local frost observations are not recorded…" (page 12) | passed |
| Reference PDF, local farm | Cover tile: "69.1 kg / known benchmark total / every planned crop cycle counted once; not the harvest of the plan year"; the new sentence in "How the totals are calculated"; the bed-by-bed table marks 22 frost-tender rows (page 18) | passed |
| Future-harvest PDF, local farm | "Nov 2026 - Oct 2027 11.3 kg", then 69.1 kg a year, with its own "counted in the year of first picking" line: a different, stated time basis | passed |
| Sample farm | Plan PDF cover: "Sample farm - Hot area, no frost - summer rain (sowing calendar set for the sample farm)". The frost notice shows here too. | passed |
| Atlas, phone, earth and slate themes, light and dark, scrolled to the soil card and to the crop list | Every measured element between 4.70 and 16.66 to 1 (`outputs/H-atlas-contrast.txt`). The soil caution paragraph measures 12.2 in earth dark and 11.9 in slate dark | passed |

Opened by me: the dark earth soil screenshot, the reference cover page image and the bed-by-bed page image. The other screenshots and page images were produced by the runs and not opened. Earlier evidence of the dark soil card before this change: `evidence-decisions/F-atlas-incomplete-phone-dark-temperature-card.png` (captured 09:02 UTC, those cards unchanged until now), where "30%" beside "Silt" is dark green on the dark card.

## Verification

- Typecheck: `npx tsc --noEmit -p .`, exit 0, no output (`logs/03-…`).
- Affected tests, 98 files, full output and file list: 1,338 of 1,338, exit 0 (`logs/04b-…`). The first run, with five failures, is `logs/04a-…`.
- Release-note tests, the focused render group and a final typecheck after the release note was restamped: see the evidence README.
- Full suite and `rules`: one run on the final head, required before merge under AGENTS §1. Result on PR #1334.
- Inherited, not re-run: everything in the review packet for `00217575` on paths this change does not touch.
- Not checked: the site data panel in a browser (it needs a map and a token; it is checked by whole-component render); the hosted preview; a signed-in account; a physical phone; a screen reader; any translation.

## Still open

Not closed by this patch, and not to be read as closed:

- **CP-117 (new).** The site data panel prints monthly wind and sunshine series made from fixed multipliers, a "Sunniest in the dry winter" line, a Grow / Dry / Rest strip with unsourced lines (12 °C, 30 mm, 20 mm, 22 °C), the label "mist belt" for every Cwb site, and "Year-round vegetables" for Cwb and Cwa. None is a frost statement, so none was in scope; each is a figure or claim without a source.
- **The mild-frost table caveat's June and July window** (`SA_WINTER_FROST_MONTHS`). Unsourced; left as it was.
- **CP-103, CP-104, CP-105** (calendar rule at the two failing places; frost at winter-rainfall places; dataset disagreement): thresholds retained, as the review recommends.
- **CP-080, CP-082, CP-083**, the shared climate fetch (ISS-04, ISS-05), page work CP-047 to CP-049, CP-061 to CP-072, CP-090.
- BSk and BWk class notes; the class names.
- No field or agronomist check. 54 of 56 remains compliance with four frost constraints, not accuracy.

## Next continuation

1. Codex's review of the changed paths on the new head, with the Flash challenge the parent session is running.
2. Rory: whether the frost notice should be hidden on the "Hot area, no frost" calendar.
3. CP-117, as its own change.
