# CP-117 and the plan table's frost caveat, after Codex's successor review of b11c3e7e — 2026-11-11

- Auditor: Claude, as author, on Rory's authorisation of 11 November 2026. Packet opened and read: `CODEX-SUCCESSOR-REVIEW-b11c3e7e.zip`, 4,665,752 bytes, sha256 `fcc6abe5567d4ef62a91e746a2540cea3e77a8e2838dc52e0d5a9622d80bcdff`, 99 entries (`SUCCESSOR-REVIEW.txt`, `CP117-CORRECTION-HANDOFF.txt`, `SUCCESSOR-DISPOSITION.json`, the source and evidence manifests).
- Reviewed revision: starts from `b11c3e7ee3d9a1b7e8cd7f7aa7356ea9656504b4`, tree `07b5ca6e9f07ad753268d671e078cba74039a759`. Codex: CHANGES REQUIRED on it; the six earlier corrections supported. The change is commit `25612c28` on branch `claude/blissful-pasteur-1c4ne6`, PR #1334. The exact head and tree are in the PR comment that links this record.
- CI on `b11c3e7e` itself, for the record: `rules`, `focused-render`, `preview` and both full `test` jobs passed (finished 15:35 and 16:11 UTC). That result does not cover the new head.
- Deployment inspected: local development server on the working tree that became `25612c28`; the app's PDF builder run offline.
- Previous audit: [completion corrections](completion-corrections-claude.md), same day.
- Scope: the two retained items in the handoff, in its order (site data panel first, then the frost caveat), and the four Atlas page errors. Global resolver work is not touched.
- Evidence type: source review, automated tests including the real panel rendered whole with the real dictionary, browser at phone in light and dark, PDFs built by the app's own builder. One Sonnet agent made the site data panel edits to my written specification; I reviewed its report, changed what did not hold and re-ran everything.

## Findings and disposition

| ID | Finding | Status |
| --- | --- | --- |
| CP-117 | The site data panel printed monthly sun and wind made from fixed multipliers, sun and wind advice, a Grow / Dry / Rest month strip, "mist belt", class-only crop lists and wind advice from missing data. | fixed by removal |
| CP-108, retained window | The printed table's frost caveat came from the calendar name and a fixed June–July window; it ignored the grower's months and stood after a "no". | fixed |
| Atlas page errors | Four errors on the Atlas screenshots, with no message recorded. | identified; not an app fault on the evidence here; see below |
| CP-118 (new) | Other unsourced statements left on the site data panel (listed under "Still open"). | open |

## CP-117: what was removed, and what the panel now says

`components/DataPanel.tsx`. Nothing was replaced with a new figure, multiplier, threshold or season.

| Place | Before | Now |
| --- | --- | --- |
| Climate, sunlight card | Twelve monthly "hours / day" bars from the annual solar mean ÷ 0.82 × a fixed seasonal multiplier, "≈ N h avg", "Sunniest in the dry winter …" | "Monthly sunshine is not shown. This record holds no monthly sunshine hours for this site." The solar figure is not printed |
| Climate, wind card | Twelve monthly bars from the annual mean × a fixed profile ("windiest Aug–Oct"), "Prevailing … in winter", windbreak advice | "Monthly wind is not shown. …"; "Modelled annual mean wind: ≈ N km/h." only when a speed above 0 was supplied, else "Annual mean wind: not available."; "December to February: from the X." and "June to August: from the Y." for each direction supplied, else "Wind direction: not available." The compass draws only a supplied December–February direction; with none, no rose and no arrow |
| Overview, month strip | Grow / Dry / Rest per month from 12 °C, 30 mm, 20 mm and 22 °C | Removed |
| Climate, class name and text | "Humid subtropical · mist belt" for every Cwb site and other regional names; translated class summaries; crop lists from the class code alone ("Year-round vegetables …", "… thrive") | The class name and neutral note from the one class table; "No crops are suggested from the climate type alone. A climate type does not know your water, frost or soil. Use the crop plan for sowing months checked against this site." |
| Overview, wind line | "High wind exposure … Windbreaks on the X side are your highest-return first investment" above 18 km/h, else hedge-row advice; a missing speed read as 0 | "Modelled annual mean wind: ≈ N km/h." when one was supplied; otherwise no wind line |
| Overview, site summary | "Protect against frost in winter." when the record low was below 2 °C | Removed. The record low is still on the row and the insight line |
| Source | An unused per-biome advice table (`PERMA_CONTEXT`) with windbreak and year-round text | Removed (no references anywhere) |

Kept as they were: rainfall, monthly temperature and its footer, the record low, the guard that withholds the Climate tab for an unverified temperature year, soil and terrain.

**What a missing value now does.** A wind speed of 0, a NaN or a missing value prints "not available", never "0 km/h" or "calm". A direction of "—" (the adapter's mark for none) prints no direction and no arrow. Solar radiation is not printed at all, so a zero fill cannot read as darkness.

## Frost caveat on the printed table

`lib/crop-export-benchmark.ts`, `lib/crop-export-pdf.ts`, `lib/crop-export-schedule.ts`, `lib/frost-uncertainty.ts`.

| What the grower has said | Table caveat | Guide |
| --- | --- | --- |
| Nothing (no survey, no answer, or "yes" with no month) | Every active frost-tender row: "Frost-tender: picking may stop when frost arrives. Confirm your frost months." | The unknown-frost notice, as before |
| "We have not seen frost here" | None | Their observation, with the existing line that it promises nothing about future winters |
| Frost months | A frost-tender row whose crop holds ground in one of them over its whole occupancy from now, picking months included: "Frost-tender: still in the ground in Apr, when you recorded frost." Only recorded months are named | "Planned crops to check for frost", the same crops |

- **A calendar name is not consulted.** "Hot area, no frost" does not hide the unknown-frost caveat; the table function cannot see the calendar.
- **One source.** The PDF reads the grower's answer from the production guide (`planTableFrost`), so page, guide and table follow one answer. A caller with no guide marks nothing, as before.
- **Not marked.** A sowing awaiting confirmation, a finished one-time sowing and the grower's own dated records, as the guide's check already excludes them.
- **Unchanged.** Every other field on every row: tested for each frost state, and in the builder run below.
- **Removed.** `SA_WINTER_FROST_MONTHS` (June and July) and its caveat text.

**A limit of the existing occupancy check, not changed here.** The check looks twelve months ahead from today. A recurring sowing whose next frost-month occupancy falls after that, such as squash sown in September and picked in December next year, is not marked against a recorded December until it comes within the year. The guide uses the same check, so the two agree. Changing that horizon is a planner decision.

## The four Atlas page errors

Captured once with their messages and stacks (`outputs/I.txt`, part A):

| Count | Kind | Message | Where it is raised |
| --- | --- | --- | --- |
| 1 | console error | "An API access token is required to use Mapbox GL" | `mapbox-gl` `normalizeStyleURL`: no map token is configured on the local server |
| 3 | page error | "Invalid LngLat object: (NaN, NaN)" | `mapbox-gl` `Map.unproject` → `coordinateLocation`: converting a pointer position on a map that never received a style or size |
| 1 | aborted request | `/atlas?_rsc=…` `net::ERR_ABORTED` | the client navigation request, cancelled by the next one; not counted as a page error |

So the four on the screenshots are one token error and three LngLat errors. The first six frames of each stack are inside `mapbox-gl`; frames deeper than that were not captured. A load with no pointer movement raised none (`outputs/I2.txt`, part A). **Not established:** whether the LngLat error also occurs with a real token. That needs a token, which this environment does not have.

## Cases

| Case | Inputs | Expected and actual | Evidence | Result |
| --- | --- | --- | --- | --- |
| D-j | Northern complete (48.2° N), wind 4 m/s, W and SW | "December to February: from the W.", "June to August: from the SW.", "≈ 14 km/h"; no season word on a direction | `tests/data-panel-frost-claims.test.ts` | passed |
| D-k | Southern Cwb, tagged record low -6.2 | Neutral Cwb note, record low shown, no "mist belt", no crop list | Same | passed |
| D-l | Sun 0, wind 0, both directions "—" | "not available" for speed and direction; no "0 km/h"; no rose; no Overview wind line | Same | passed |
| D-m | Sun -999, wind NaN, only June–August direction | No NaN or -999; only the June–August line; no rose | Same | passed |
| D-n | Cfb, no survey or water data | No year-round or thrive promise; the withheld-crops sentence | Same | passed |
| D-all | Fixtures a to n, English and isiZulu dictionaries | No banned wording; exactly two twelve-month series (rain, temperature) on Climate, none where withheld | Same | passed |
| T-1 | Three plantings, frost recorded June and July, now November | Each crop marked with the months it holds; nothing for "no"; nothing for a hardy crop; old source gone | `tests/crop-export-schedule.test.ts` | passed |
| T-2 | Mixed plan, every frost state: none, "no", "yes" with no month, April, July, December, all three | Table marks exactly the crops the planner's own check finds; guide names the same crops; only recorded months named; other fields unchanged | `tests/frost-uncertainty.test.ts` | passed |
| T-3 | Picking tail only | A frost month only in the last held month is marked | Same | passed |

## Existing tests whose claim changed

Nothing was skipped. The reason is written beside each in the test.

| Test | Change | Why |
| --- | --- | --- |
| `crop-export-schedule.test.ts`, frost caveat | June–July on a mild-frost calendar becomes the grower's recorded months | The retained-window finding |
| `monthly-temperature-ui.test.ts`, Overview strip | "withheld for unverified temperatures" becomes "the strip cannot be produced at all" | CP-117 removes the strip |
| `community-contact-datapanel-theme.test.ts` | Clamped captions: at least 3 becomes at least 2 | The third was the strip's legend |
| `type-floor.test.ts` | DataPanel's sub-12px budget: 5 becomes 4, as the test's own failure message asks | The strip's 11px month letter is gone |
| `data-panel-frost-claims.test.ts` | The summary's frost sentence, the old wind sentence and the strip's "Rest" | Removed by CP-117 |

## Browser and export evidence

| Case | Observed | Evidence |
| --- | --- | --- |
| Site data panel, real browser, real dictionary, phone light and dark, `/farmer?site=demo-place-ubhejane&panel=Climate` | Class Cfa, the withheld-crops sentence, record low 5.4 °C, coldest and hottest month means with their months, both "not shown" sentences, "≈ 10 km/h", "December to February: from the ESE.", "June to August: from the SW.", no page errors, no sideways overflow. Overview: the record-low row and line, the wind line, the summary without a frost sentence | `outputs/I3.txt`, `screenshots/I3-*.png` (six) |
| Bed-by-bed table, built offline by the app's own PDF builder from the 27 sowings Auto-suggest made for the local fixture farm (now 11 November) | Not recorded: 22 tender rows marked, no month named. "No": none marked. April, July and December recorded: 6 rows marked, all "Apr". Every other field identical to the unmarked table in all three | `outputs/frost-table-cases.txt`, `artifacts/builder-frost-*.pdf` with text, `screenshots/builder-frost-*-table-*.png` |
| Reference PDF from the browser, frost not recorded | Same table caveats as the builder run | `artifacts/reference-frost-not-recorded.pdf` |

Opened by me: the dark sun-and-wind screenshot and the recorded-months table page. In dark mode the site data panel's cards keep a light surface; this is the panel's existing card style and is readable.

**Not done in a browser.** Recording frost months through the site survey: the survey opened, but its frost options were not reachable by my script (`outputs/I.txt`, `I2.txt`). The recorded-months case is shown by the app's own builder instead, with constructed survey answers.

## Verification

- Typecheck: exit 0, no output (`logs/04-typecheck.txt`).
- Affected tests, 100 files, full output: 1,378 of 1,378, exit 0 (`logs/05-…`). The helper's earlier runs, including its two expected failures before the two count checks were restated, are kept as `logs/01-…` to `03-…`.
- Release-note tests, focused render group and the release-note check after the restamp: see the evidence README.
- Full suite and `rules`: one run on the final head. Result on PR #1334.
- Not checked: the Atlas with a real map token; the hosted preview; a signed-in account; a physical phone; a screen reader; isiZulu wording by a first-language speaker (new sentences are English, marked `lang="en"`).

## Still open

- **CP-118 (new): the rest of the site data panel's unsourced statements.**
  - The "Good fit / Fair site / Challenging" badge from 500 mm, 300 mm, 15° and 25°.
  - The rainfall advice lines and bands at 400 and 700 mm, and "before planning year-round crops".
  - The organic-carbon line at 1.5 %.
  - The wet-month colouring at 90 % of the monthly mean.
  - The biome "challenges" text, which includes "Frost can damage plants at higher ground".
  Each is a figure or claim without a source, outside this handoff.
- The twelve-month horizon of the frost occupancy check, above.
- The Atlas LngLat error with a real token.
- Carried: CP-103, CP-104, CP-105, CP-080, CP-082, CP-083, the shared climate fetch, the page and presentation backlog, the BSk and BWk class notes. No field or agronomist check.

## Next continuation

1. Codex's review of the changed paths on the new head, with the source-bound Flash challenge.
2. CP-118, as its own change, if Rory wants it.
