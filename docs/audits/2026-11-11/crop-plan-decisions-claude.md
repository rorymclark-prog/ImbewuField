# Crop plan: the four open decisions — 2026-11-11

- Auditor: Claude, at Rory's instruction of 11 November 2026 ("all those questions go with your recommendations").
- Reviewed revision: branch `claude/blissful-pasteur-1c4ne6` on main `84e42a24`. Code commits `e5ed0cb0` (the decisions), `13cd622e` (status words in their own module) and `c2220181` (the calendar-page option shortened after the browser check). The exact head is in the review packet on PR #1334.
- Deployment inspected: local development server at that commit; hosted preview, see Verification.
- Previous audit: [crop plan accuracy fixes, 10 November](../2026-11-10/crop-plan-accuracy-fixes-claude.md). Carried forward: CP-079, CP-094, CP-096, CP-097. New IDs from CP-103 are in the [held-out test](calendar-rule-holdout-claude.md).
- Scope: `/facilitator/crops` (weekly target card, Auto-suggest calendar note, header chip), `/calendar`, the Atlas panel.
- Evidence type: source review, automated tests, browser at phone and desktop. No signed-in account, no physical phone, no first-language review.

## What was already done

The 10 November record left five decisions with Rory. Merging was decided that day. The other four were answered on 11 November: take the recommendation in each case.

## Findings and disposition

| ID | Decision | Status | What changed |
| --- | --- | --- | --- |
| CP-079 | Should a sowing that could be ready early still count toward a weekly target? | implemented | The credit is kept. Each assessed target card now has a status line: "Not covered yet", "Covered on paper" or "Covered on paper, may be early". The last means the target is met only because of sowings that could be ready before the buyer's window opens. The card then says what would be missing without them: a shortfall in kilograms, months with no picking window, or both. |
| CP-097 | Should the calendar page and the Atlas use the planner's calendar names and follow the grower's choice? | implemented | Both now use the planner's four names ("Winter frost", "Light frost at most", "Hot area, no frost", "Winter rainfall") from one shared file. The calendar page offers "This farm's crop plan: …" as an explicit option when the selected saved site has a calendar of its own, and a line under the select says which calendar that is and on whose word (the grower's choice, the site's climate records, or the sample farm). Nothing is preselected. A regional fallback is never offered as the farm's calendar. The reference guide and the Atlas take nothing from a plan. |
| CP-096 | What should a signed-out grower be told when the climate records need sign-in? | implemented | Access is unchanged. The note in Auto-suggest and the header chip now give the real reason: still loading, read for signed-in growers only, or could not be read just now. The last two say the grower can choose their own calendar. |
| CP-094 | Should a mapped site whose climate has not loaded get the out-of-season list? | decided, no change | It stays hidden. A list judged against a fallback calendar was wrong in a known direction for hot-area farms. |

## What the target status does and does not say (CP-079)

The plan credits a sowing to the **latest** likely harvest month, so a bed is not released too soon. The earliest month uses the lower end of the catalogue's duration range. Measured on the catalogue at this commit, for the crops that have a planning yield:

| Months between earliest and credited harvest | Crops |
| --- | --- |
| 0 | broad beans |
| 1 | maize, green beans, Swiss chard, potato, groundnuts, garlic, peas, cucumber, spinach, turnip, parsley, sorghum, soybean, baby marrow, sweetcorn, sunflower |
| 2 | dry beans, butternut, pumpkin, carrots, beetroot, tomatoes, peppers, chilli, sweet potato, watermelon, brinjal, gem squash, spanspek, bambara groundnut |
| 3 | onions, lettuce, broccoli |
| 4 | kale, cabbage, cauliflower |

So for every crop except broad beans, the sowing that covers the **first** month of a buyer's window could be ready before that window opens. A fully covered target for those crops will read "Covered on paper, may be early". That is a true statement about how the plan counts, and the card says how early ("as early as April"). It is not a sign that one target is worse planned than another.

The fuller fix is a picking range from earliest to latest month instead of one credited month. That changes what is credited to a target, which Rory decided to keep. It stays open as a product decision, not a defect.

## The isiZulu calendar names are drafts (CP-097)

`SOWING_CALENDAR_LABEL_ZU` holds four names. Three are wording these screens already carried. "Isithwathwa sasebusika" (winter frost) is composed from the same words. None has been reviewed by a first-language speaker. The planner itself still shows the calendar names in English.

## Cases

| Case | Finding | Inputs | Expected | Actual | Evidence | Result |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | CP-079 | November carrots linked to a March-only target of 3 kg a week | Credit unchanged; status "covered, may be early"; nothing left without the early sowing; March named | As expected | `tests/harvest-targets.test.ts` | passed |
| T-02 | CP-079 | Same sowing, window January to March | Not early; January and February are gaps; "short" | As expected | Same test | passed |
| T-03 | CP-079 | Same sowing, 30 kg a week | "short" | As expected | Same test | passed |
| T-04 | CP-079 | April broad beans, window equal to their picking months | "covered" | As expected | Same test | passed |
| T-05 | CP-079 | A pack target with no pack weight | No status at all | As expected | Same test | passed |
| N-01 | CP-097 | No choice, no sample, no cached climate | No farm calendar offered | As expected | `tests/calendar-page-farm-calendar.test.ts` | passed |
| N-02 | CP-097 | Grower's choice, sample calendar and site climate all present | The grower's choice is offered | As expected | Same test | passed |
| N-03 | CP-097 | Mbombela's recorded reading with the grower's answer "no frost" | Offered as "from this site's climate records and your frost answer" | As expected | Same test | passed |
| N-04 | CP-097 | Source of the calendar page and Atlas | No local name list; no climate request from the calendar page | As expected | Same test | passed |
| N-05 | CP-097 | Calendar page render test: a saved plan's stored pattern | Never selects a site, a reference or a planting window | As expected | `tests/international-calendar-context.test.ts` (label renamed, claims unchanged) | passed |
| N-06 | CP-097 | Calendar page rendered: a farm with no known calendar; then the same farm after a choice in its plan; then the reference guide | No farm option and the "not known" line; then the option offered, not preselected, its months shown when picked and labelled as the farm's; never offered in the reference guide | As expected | Same file, new test | passed |
| N-07 | CP-097 | The option's length | 42 characters or fewer for every calendar, so a phone's closed select shows it whole | As expected | `tests/calendar-page-farm-calendar.test.ts` | passed |
| M-01 | CP-096 | Climate route answers 401 | Reason "sign-in required"; nothing cached | As expected | `tests/monthly-temperature-cache.test.ts` | passed |
| M-02 | CP-096 | 403, 429, 500, 503, a network error, an outage payload, invalid coordinates | Reason "unavailable" | As expected | Same test | passed |
| M-03 | CP-096 | A live reading, then the cached reading | No reason reported | As expected | Same test | passed |
| M-04 | CP-096 | The three notes | Sign-in note never says "loading" or "offline"; outage note never says "sign in"; all name the fallback | As expected | `tests/sowing-calendar-choice.test.ts` | passed |

Browser cases are in the Verification section.

## Browser cases

A real signed-out local farm at the sample farm's coordinates, on a local development server, driven by Playwright (Chromium) at 390 × 844 and 1280 × 800, light and dark. A Sonnet agent ran the scripts; I wrote the checks, read the raw outputs and looked at the screenshots. Evidence: [`evidence-decisions/`](evidence-decisions/README.md).

| Case | Finding | What was done | Observed | Result |
| --- | --- | --- | --- | --- |
| A1 | CP-096 | Climate route answers 401 | Header chip ends "(fallback)". Its title and the Auto-suggest note read "Climate records for this site are read for signed-in growers only … Sign in, or choose your own sowing calendar." Neither says "offline" or "loading". Choosing a calendar changes the chip to "… · chosen by you". | passed |
| A2 | CP-096 | Climate request aborted | "could not be read just now (no connection, or the climate service did not answer) … You can choose your own sowing calendar." No "Sign in". | passed |
| A3 | CP-096 | Climate answer delayed 20 seconds | "still loading" at about one second; the note changes to the real climate when it arrives, in the same open dialog. | passed |
| A4 | CP-096 | No interference | "Hot area, no frost · summer rain · satellite records for this site". | passed |
| B1 | CP-097 | `/calendar`, saved site, crop plan never given a climate | Four calendars only, nothing preselected, the "not known on this device yet" line, no month grid. | passed |
| B2 | CP-097 | After the crop plan has read the site's climate | The farm option is offered, not preselected. Picking it draws the grid and labels it "Hot area, no frost · this farm's crop plan". Phone light, phone dark, desktop. | passed |
| B3 | CP-097 | After choosing "Light frost at most" in the crop plan | The farm option names that calendar, as the grower's choice. | passed |
| B4 | CP-097 | The reference guide context | No farm option, no "not known" line, four calendars. | passed |
| B5 | CP-097 | Visible text in every state | None of the old names. | passed |
| C | CP-097 | Atlas, Durban and Johannesburg | Chip "Sowing calendar: Hot area, no frost" and "Sowing calendar: Winter frost"; the sentence below uses the same names; the chip stays inside its card at 390 px. **Limit:** there is no map token locally, so the place search was answered by a stub; the climate request and the panel were the app's own. | passed, with that limit |
| D1 | CP-079 | Carrots, 3 kg a week, May to August 2027, six suggested sowings accepted | "Not covered yet": 0 kg unallocated, but May has no picking window. The early-sowing line appears without a "Without them" sentence, as designed for a target that is not covered. | as designed |
| D2 | CP-079 | Cabbage, 2 kg a week, August 2027 | "Not covered yet"; no sowing could be suggested in the next twelve months. | as designed |
| D3 | CP-079 | Carrots, 3 kg a week, June to August 2027, six suggested sowings accepted | "Covered on paper, may be early". "4 linked sowings could be ready before Jun 2027, as early as Apr 2027 … Without them, this target would be 32.4 kg short and Jun 2027, Jul 2027 would have no picking window." | passed |
| E | all | Auto-suggest accepted, plan exported | The plan PDF, the future-harvest PDF, the detailed reference PDF and the saved plan, for the local farm; the plan PDF for the sample farm. The calendar line reads "Sowing calendar from satellite climate records for this site: Hot area, no frost - summer rain." and, for the sample, "Sowing calendar set for the sample farm: Hot area, no frost - summer rain." | produced; see the README for checksums |

The first browser pass found one fault of mine: at 390 px the closed select cut the farm option off after "(from". The option now names the calendar only and the reason has its own line (commit `c2220181`). B1 to B4 and the exports were run again on the final code; the README says which files those runs replaced.

Seen and left alone:

- A target can read "Not covered yet" with 0 kg unallocated, because one month without a picking window is enough. The card names the month on the next line. This is the status rule as written; say if "Not covered yet" should be reserved for a kilogram shortfall.
- The sample farm's PDF prints "This site (satellite climate records) - Hot area, no frost - summer rain (sowing calendar set for the sample farm)" in two places: it names the climate records and the sample's fixed calendar in one line. This is from the 10 November change, not this one. Logged as CP-107, open.
- "Covered on paper" on its own was not seen in a browser. Broad beans are the only crop that can reach it; it is covered by a unit test.

## Verification

- Typecheck: clean on the final code.
- Affected tests, locally: 309 test files, 3,988 tests, 3,985 passed. The 3 that failed are course-media tests that read old commits and cannot pass in this shallow checkout; they touch nothing in this change and pass in CI.
- The `focused-render` group, locally: 674 of 674. It failed once in CI on `9a5b102e`, on a release-note line four characters too long; fixed in `3b987c5c`.
- Full test suite and `rules` on the final head: required before merge under AGENTS §1. The result is in the review packet on PR #1334.
- Output inspected: the browser cases above, the screenshots, and the exported PDFs' text.
- Not checked: a signed-in account; a real switch between two accounts; cloud sync; a second device; a physical phone; a screen reader; the Atlas with a real map token; the hosted preview for these screens; a first-language review of the isiZulu calendar names.

## Next continuation

1. Page work from the 10 November re-audit: CP-047(b), CP-048(b), CP-049(b), steps 3, 4, 6 and 7. Not started. It will be a separate change so that it does not alter the revision under three-way review.
2. A first-language review of the isiZulu calendar names.
3. A picking range for weekly targets, if Rory wants the credit itself changed.
