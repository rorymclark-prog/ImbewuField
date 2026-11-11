# Codex final review of the crop-plan candidate: dispositions — 2026-11-11

- Auditor: Claude, answering two packages relayed by Rory on 11 November 2026, both opened and read:
  - `CODEX-FINAL-REVIEW-ae5eeb1e.zip`: 112,202 bytes, sha256 `80c0d525e8d58656e264d4f99282443f6316a10bb336f203de026a54602173ad`, 32 entries. Codex's final source and evidence review. Not an approval.
  - `CLAUDE-FDR01-V3-ae5eeb1e.zip`: 333,879 bytes, sha256 `77050b9bad7a7d27e822f84c8700b7059413f4b6e503d1924183eab856df7815`, 15 entries. A local proposal for FDR-01 (revision 3, sha256 `b3080b45efc0c1dac700cc022e95dbfe1b148f898f2ef4ce74e21fc73116dcc0`) with Codex's bounded component review of it. Its base file matches `ae5eeb1e` byte for byte.
- Reviewed revision: both cover `ae5eeb1e1fab09890993970afaf6790103a8f118`, tree `4406df4e947f4ff94c2980ef442485ab754c2e2e`. The change below is commit `7d5eda4d` on branch `claude/blissful-pasteur-1c4ne6`, PR #1334. It makes a new candidate; the exact head and tree are in the PR comment that links this record.
- Deployment inspected: local development server at `7d5eda4d`. No hosted preview for this screen.
- Previous audit: [Codex interim review](codex-interim-review-dispositions-claude.md), [Argon's claims](argon-claims-dispositions-claude.md), [the four decisions](crop-plan-decisions-claude.md), same day.
- Scope: Codex findings FDR-01 to FDR-03; the choice between my guard and the proposal; what I found on the way.
- Evidence type: source review, automated tests (unit and static render, English and isiZulu mode), browser at phone and desktop. The incomplete, unreceipted and untagged cases were produced by changing fields in the local route's real answer; no live provider gap was observed.

## Findings and disposition

| ID | Finding | Status | What was done |
| --- | --- | --- | --- |
| FDR-01, CP-110 | With an incomplete temperature year the Atlas still printed the server's climate type, a "Frost-free" chip and the 20 °C stand-ins as mean, coldest and hottest month. The earlier guard (Argon F-05) covered the calendar chip and the crop list only. | accepted, fixed | Monthly temperatures are printed and classified only when the server's receipt says the provider supplied all twelve and the values bear it out. Otherwise the climate card says "Temperature records for this point are incomplete or could not be checked, so no climate type or sowing calendar is shown." and keeps the rainfall chip; the temperature card says "Not shown. …" and prints no figure. Rainfall, soil and terrain are unchanged. |
| FDR-01, CP-111 | The frost chip was read from the coldest month's **mean**: 5 °C or more read "Frost-free". Underberg (mean 7.4 °C, record low -6.2 °C; Codex's case) and Johannesburg (mean 9.9 °C, record low -4.8 °C; my own screenshot `C-atlas-johannesburg-phone-light.png`, which I did not read closely enough at the time) both showed "Frost-free", Johannesburg beside "Sowing calendar: Winter frost". | accepted, fixed | The chip no longer classifies. It prints the validated, source-tagged gridded record low, "Modelled record low: -4.8°C", or "Record low: not known" for an untagged value or a missing-value marker. A real zero is printed. No threshold was added or moved; two unsourced ones (2 °C and 5 °C on a monthly mean) are gone from this screen. |
| FDR-02, CP-112 | The detailed reference PDF's cover prints "69.1 kg known benchmark" under "November 2026 to October 2027". The same plan's ten-year table gives 11.3 kg for that year, then 69.1 kg a year. | accepted as a label point, open | No arithmetic fault: 69.1 kg counts every planned crop cycle once with no dates (`buildPlanYieldBenchmark`); 11.3 kg counts the cycles whose first picking falls in the first twelve months (`buildProductionProjection`). 21 of the 27 sowings are made in August to October 2027 and first picked after October. Recomputed with the app's own functions; Codex reproduced it independently. The cover does not say that most of the total starts picking after the dated year. Not changed: it is printed farming copy, and outside this candidate. Related: CP-004 (2 October, verified). |
| FDR-03 | The seed for the "local farm" exports was not in the packet, and the saved rows use `demo-bed` ids. | accepted, provenance supplied, wording corrected | A constructed fixture: the repository's published sample farm (design, beds, the place "Ubhejane Crèche" at -27.726231, 31.963044) saved as an ordinary farm in a signed-out browser with sample mode off. Live NASA POWER climate was read for those coordinates and the app's Auto-suggest made the 27 sowings. Not grower-observed data. The as-used seed is reproduced byte for byte by the committed generator plus two time stamps: see [`evidence-decisions/README.md`](evidence-decisions/README.md). The decisions record now says what the farm was. |
| CP-113 | The site data panel (`components/DataPanel.tsx`) makes the same kind of statement: a frost chip from the coldest monthly mean (same 2 °C and 5 °C lines), a "frost-free days" figure counted from months whose mean is 5 °C or more, and a frost sentence from `minTemp`. | open, not changed | Outside the crop plan and the Atlas, and outside this candidate. Not tested here, including for an incomplete year. It belongs with the shared climate-fetch work already deferred (ISS-05, ISS-06, ISS-09). |
| CP-114 | For Johannesburg the Atlas prints the climate note "mild all year from altitude" above "Sowing calendar: Winter frost" and a record low of -4.8 °C. | open here; **fixed later the same day**, see [Atlas climate card](atlas-climate-card-claude.md) | The note is the climate class's standing sentence, not a reading for the point. It is grower-facing farming copy, so it is Rory's to reword. |
| CP-115 | In dark mode the Atlas climate note and the climate code are hard to read, and the chips stay light. | open here; **fixed later the same day**, see [Atlas climate card](atlas-climate-card-claude.md) | The card's colours are fixed values that do not follow the theme. Older than this change; seen in the dark screenshots taken for it. |

## My guard and the proposal: what was chosen

I had already written a guard (commit `911aa31e`, never pushed) when the proposal arrived. I compared the two and merged them into one commit, `7d5eda4d`. Nothing of the proposal was applied as a patch.

| Point | My first guard | Proposal, revision 3 | Chosen |
| --- | --- | --- | --- |
| Which years are printed | All but "incomplete" | Only "complete" | **Only "complete".** The route's fresh answers always carry a receipt (`lib/nasa-power.ts`), so a payload without one is an outage default or an old shape. Neither is a reading. |
| Frost chip | Removed | Record low from `recordMinimumC`, or unavailable | **Record low.** It is a sourced number the grower can use, and it classifies nothing. |
| Chip wording | n/a | "Modelled record low: X°C" / "Frost record unavailable" | "Modelled record low: X°C" / "Record low: not known". It is a temperature record, not a frost record. |
| isiZulu mode | n/a | English, marked "isiZulu translation pending" | As proposed. No new isiZulu wording. |
| Outage (climate label "?") | Existing warning kept | Replaced by "Climate classification is unavailable" or the incomplete note | **Existing warning kept.** In an outage the rainfall figures are placeholders too, and only the existing sentence says so. |
| Incomplete year, climate card | Note plus the rainfall chip | Note only | Note plus the rainfall chip. |
| New text colour | Theme token | Fixed `#4A4030` | Theme token, so the notes are readable in dark mode. |
| Where the rule lives | `atlasTemperaturesRecorded` in `lib/atlas.ts` | In the component | The helper, so it has a unit test. `atlasRainPattern` keeps its own narrower refusal, as the proposal intended. |
| Tests in the repository | Yes | None (external runner) | Yes, extended with the proposal's cases. |

## Scope of the ISS-06 closure, corrected

My Argon ledger disposition read as if the Atlas stand-ins were guarded. At `ae5eeb1e` only the calendar chip and the crop list were. At `7d5eda4d` the Atlas panel prints nothing read from the monthly temperatures of a year it cannot verify. Still not covered:

- The server still classifies a climate type from the stand-ins and sends it. The Atlas panel no longer shows it; the route is unchanged.
- The site data panel (CP-113) and any other reader of the same payload.
- Rainfall and temperature come from one shared fetch. An incomplete temperature year says nothing about the rainfall months, and the panel does not claim it does.
- "Modelled record low" is a gridded value for the wider area. It is not a station record, not a frost date and not a statement that a site is or is not frost-free.

## Codex's other dispositions

I agree with each as Codex wrote it: CBR-01 to CBR-08, F-07 (joint close call), F-09 (one-time share, old harness), ISS-05/06/09, ISS-11/12. Two points in plain words:

- **Eshowe.** The base calendar is unchanged at all 100 saved places. For Eshowe alone, a grower who answers "no frost" now gets "Hot area, no frost" where they got "Light frost at most". "No calendar changes" in my earlier record is true of the rule's own answer, not of that grower's path. Sensitivity to one degree is not evidence that the warmer calendar is right there.
- **54 of 56** is compliance with four frost constraints that a place-blind answer also passes. It is not an accuracy figure.

## Cases

All in `tests/atlas-panel-temperature-claims.test.ts`, which renders the real panel to static markup.

| Case | Inputs | Expected and actual | Result |
| --- | --- | --- | --- |
| R-01 | The rule on: complete; incomplete; no receipt; a "complete" receipt with 11 values; with a NaN; null; a year containing real zeros | true; false; false; false; false; false; true | passed |
| R-02 | `atlasRainPattern` without a receipt, and with "incomplete" | A calendar; none. Its other callers are unaffected | passed |
| R-03 | Every month 20 °C, "incomplete", a non-empty climate label from the server | Both notes; no climate type, no word "frost", no calendar, no crop list, no temperature, no record low; rainfall kept | passed |
| R-04 | One month substituted, "incomplete" | The real-looking months are withheld too | passed |
| R-05 | No receipt | Withheld like an incomplete year | passed |
| R-06 | Johannesburg-like means, complete, tagged low -4.8 | "Cwb", "Sowing calendar: Winter frost", temperatures, "Modelled record low: -4.8°C"; no frost class | passed |
| R-07 | Underberg: coldest mean 7.37, tagged low -6.2 | "Modelled record low: -6.2°C"; no "Frost-free" | passed |
| R-08 | Low untagged (8); tagged -999; tagged 0; tagged 3.4 | "Record low: not known" and no 8; "not known" and no -999; "0°C"; "3.4°C" | passed |
| R-09 | isiZulu mode, complete and incomplete | Chip in English with "isiZulu translation pending"; the incomplete year withheld | passed |
| R-10 | Climate label "?" (outage) | The existing placeholder warning; no temperature | passed |
| R-11 | Panel source | No frost chip; neither the coldest mean nor the record low is compared with a number | passed |
| before | The first version of this file against the panel at `ae5eeb1e` | 5 of 7 failed | as expected |

## Browser cases

Local development server at `7d5eda4d`, Playwright (Chromium), Johannesburg. The place search was answered by a stub because there is no map token locally; the climate request and the panel were the app's own. Script `evidence-decisions/scripts/f.cjs`, output `evidence-decisions/outputs/F.txt`, screenshots `evidence-decisions/F-atlas-*.png`. I read the output and looked at the complete phone screenshots, light and dark; the incomplete ones I looked at on the first guard, whose notes differ only in the words "or could not be checked".

| Case | What was shown | Result |
| --- | --- | --- |
| Complete: phone light, phone dark, desktop | "Cwb", "Sowing calendar: Winter frost", "Modelled record low: -4.8°C", 17.1 °C mean, 10 °C coldest, 22 °C hottest, the crop list. The only lines containing "frost" are the calendar chip and the crop-list sentence. Three chips wrap onto two rows at 390 px. No sideways overflow. | passed |
| Incomplete: phone light, phone dark, desktop | Both notes at 14 px inside the card. No climate type, no line containing "frost", no "°C", no calendar chip, no crop list. "≈ 641 mm/yr", the rainfall bars and the wet and dry seasons shown. No sideways overflow. | passed |
| No receipt, phone light | The same as incomplete. | passed |
| Complete with the low's source tag removed, phone light | "Record low: not known"; everything else as complete. | passed |

Console errors in every case are the missing map token and its "Invalid LngLat" follow-on, as in the earlier Atlas run.

## Verification

- Typecheck (`tsc --noEmit`, whole project): clean. Codex's review of the proposal could not run one; this is the semantic check it asked the implementer for.
- Affected tests, locally: `atlas-explorer`, `atlas-panel-temperature-claims`, `calendar-page-farm-calendar`, `community-contact-datapanel-theme`, `report-assurance-localization`, `type-floor`, `theme-token-coverage`, `climate-temperature`: 88 of 88.
- Full suite and `rules` on `ae5eeb1e`: both passed (two `test` jobs, finished 07:18 and 07:46 UTC), with `focused-render` and `preview`. That result is for `ae5eeb1e` only. The new head needs its own run before merge under AGENTS §1; the result is on PR #1334.
- Not checked: a real provider gap; the hosted preview; the Atlas with a real map token; a signed-in account; a physical phone; a screen reader; isiZulu wording by a first-language speaker.

## Next continuation

1. Affected-delta review of the new head by Codex and a final pass by Argon. Argon's final review of `ae5eeb1e` was refused for quota before any output, and its interim review of `9a5b102e` approves neither.
2. CP-112: a clearer line beside the reference cover's total, if Rory wants the copy changed.
3. CP-113: the site data panel's frost statements, with the shared climate-fetch work.
4. CP-114 and CP-115: the climate note wording and the Atlas card in dark mode.
