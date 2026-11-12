# Codex interim review of the held-out test: dispositions — 2026-11-11

- Auditor: Claude, answering Codex's interim review, relayed by Rory on 11 November 2026 (four files: handoff, review, findings, challenge cases).
- Reviewed revision: the review covers `9a5b102e850ff708d5f0761f8c17eaae4d96b54d`, tree `fec2aebb261a8774d3f132adc76745b49fd1810e`. The changes below are on branch `claude/blissful-pasteur-1c4ne6`, PR #1334.
- Deployment inspected: not inspected for this record.
- Previous audit: [held-out test](calendar-rule-holdout-claude.md) and [the four decisions](crop-plan-decisions-claude.md), same day.
- Scope: the eight findings CBR-01 to CBR-08.
- Evidence type: source review, caller tracing, automated tests, offline checks of archived raw responses. No new live collection.

## What the review established

It reproduced all 56 calendars and both failures from the saved summaries. It then showed that the result means less than I had made it sound, that my collector did not do what I said it did, and that four helpers accept missing values. I accept all of that. Nothing in it is contested.

## Dispositions

| ID | Finding | Disposition | What was done, and what is left |
| --- | --- | --- | --- |
| CBR-01 | An always-winter answer passes all four criteria | **Accepted. Wording corrected, control added. A discriminating validation is still owed.** | Reproduced: always-winter passes 56 of 56 and 44 of 44; the other place-blind answers pass 25 to 35 of 56 ([`criteria-controls.txt`](evidence-calendar-holdout/outputs/criteria-controls.txt)). The held-out record, the audit index, the progress log and the pull request now say "frost-constraint compliance" and state that no accuracy figure can be taken from it. `tests/sa-calendar-real-sites.test.ts` carries the control as a test, so the limit travels with the rules. A rain-timing check that would reject always-winter is reported as post hoc only. **Left:** a new validation with criteria that can tell calendars apart, pre-registered, on places not yet seen. It needs truth labels I do not have: station frost dates and local crop calendars. |
| CBR-02 | The collector did not request ERA5 at the nearest cell | **Accepted. Disclosed; original run preserved; not re-collected.** | The request sent no `models` or `cell_selection`. Provider defaults applied: "Best Match" (ECMWF IFS from 2017, ERA5, ERA5-Land), a land cell of similar elevation, adjusted to the point's elevation. The responses carry no model field, so the model behind each value cannot be recovered. Measured from the raw responses: cells are 1.0 to 8.0 km from the requested point, median 4.3 km, 56 distinct cells. The record, the evidence README and both test fixtures now say so. The raw responses for the 56 places and for the 44 of 10 November are committed with checksums. **Left:** the next collection must pin the model and cell policy and record the request. The exact parameter value for ERA5-only is not shown on the documentation page I could read, so I have not written it into code I cannot run; the README gives the requirement. No re-collection was made, as instructed. |
| CBR-03 | Incomplete or mislabelled daily data could be scored | **Accepted. The observed run is verified from raw data; a refusing check exists; the as-run collector is unchanged.** | [`verify-raw-responses.py`](evidence-calendar-holdout/verify-raw-responses.py) checks the exact 7,305 dates, the stated units, every missing or non-numeric value, and rebuilds the frost figures independently. Result: 56 of 56 complete and identical to the saved figures; 44 of 44 for the 10 November places (to that fixture's one decimal). It refuses the review's three corrupt records and two more. `holdout-harness.ts` is left as it ran, so the record of what produced the results is intact; it must not be reused for a new collection without this admission step. |
| CBR-04 | A rainfall year with a missing month is accepted as site climate | **Accepted. Fixed in the helper. Not reachable from the app before the fix.** | Cause: `Array.prototype.every` skips holes. Reach: the only inputs are `JSON.parse` of device storage and a fetched JSON body, and JSON has no holes (a missing value arrives as `null`, which was rejected). So no stored or fetched reading could trigger it. Fixed anyway with one shared check, `completeMonthlyRainfallMm`, used by the site reading, the driest-months helper and the climate gate. The new test fails on the old code (639 mm, rain "all year") and passes now. |
| CBR-05 | The heat gate accepts -999 and a sparse month | **Accepted. Fixed in the helper. Not reachable from the app before the fix.** | Reach: all four callers in `lib/crop-autosuggest.ts` take their months from the page, which passes only `siteClimate.monthlyTempC` and `monthlyRainMm`. That object exists only after `siteClimateFromLocationData` has applied `completeMonthlyTemperatures`, which already rejects both inputs. `climateGateFrom` now applies the same contract itself. The new test fails on the old code (January lettuce "ok" on a month nobody measured) and passes now. Real cold and zero are kept. |
| CBR-06 | The rain and evaporation screen is not a growing-period model | **Accepted. Relabelled; the 0 ≥ 0 case closed; no thermal rule added.** | A month with no rain no longer passes (it did when evaporation was also zero). No temperature threshold was added. The function's description now says it is the rainfall half of the FAO method with no lower thermal limit, and a test pins that limit (a frozen month with rain still passes). The grower's rain-fed note said "the FAO growing-period rule"; it now says "the rainfall test of the FAO growing-period method". No real South African reading changes: every month of every recorded place has rain or evaporative demand. **Left:** a sourced thermal and soil-water layer before any use outside the supported South African calendars. |
| CBR-07 | Country, crop and candidate coverage are bounded | **Accepted as a standing limit. No change.** | All 100 places are South African. No crop outcome enters the criteria. The regional guide covers 27 of 49 catalogue crops and is secondary. Nothing here supports a claim outside South Africa or about sowing months. The limits are stated in the held-out record and will be in the review packet. |
| CBR-08 | "56 plus 3" wording | Closed in `9a5b102e`, as the review says. | Nothing further. |

## The twelve unexecuted cross-surface cases (G01 to G12)

Not executed by me either. G12 (a generated plan and its export, inspected together) is covered for one South African case by the export files in [`evidence-decisions/artifacts/`](evidence-decisions/artifacts/). G01 to G03 concern countries the planner does not support; the calendar page and planner hold back there, and this branch does not change that. G04 to G11 remain open.

## What changed in the application because of this review

| File | Change |
| --- | --- |
| `lib/climate-temperature.ts` | New `completeMonthlyRainfallMm`: twelve own, present, finite, non-negative months. |
| `lib/site-climate.ts` | The site reading and the driest-months helper use it in place of a check that skipped holes. |
| `lib/crop-climate-gate.ts` | The gate uses the shared temperature and rainfall contracts. A month with no rain never passes the water screen. Description corrected. |
| `lib/crop-autosuggest.ts` | One phrase in the rain-fed note. |

No sowing month, duration, yield, spacing or calendar threshold changed. `lib/crop-catalog.ts` is unchanged from main. (`lib/koppen-global.ts` was changed afterwards for a different review item, in the close-call search only: see [the Argon dispositions](argon-claims-dispositions-claude.md).)

## Verification

- Typecheck: clean.
- New tests: `tests/crop-climate-gate.test.ts` (CBR-04, CBR-05, CBR-06), `tests/climate-temperature.test.ts` (the rainfall contract), `tests/sa-calendar-real-sites.test.ts` (the place-blind control). The three helper tests were run against the code before the fix in a separate checkout and failed there.
- Full test suite: required on the final head; result in the review packet.
- Not done: no live collection, no browser check of these helper changes (they change no screen except one phrase), no review by AGY Argon yet.

## Next continuation

1. A pre-registered validation that a place-blind answer cannot pass (CBR-01), with truth labels from station or local sources.
2. A pinned, admitted collector for the next run (CBR-02, CBR-03).
3. A sourced thermal layer before any use outside South Africa (CBR-06).
