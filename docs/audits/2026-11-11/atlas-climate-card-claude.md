# Atlas climate card: class wording and dark mode (CP-114, CP-115), with a proposal for CP-113 — 2026-11-11

- Auditor: Claude, on a bounded follow-up authorised by Rory on 11 November 2026 after the coordinator opened the original dark and desktop screenshots of candidate `eaa5b98b`.
- Reviewed revision: starts from `eaa5b98b4064b7b376a78f458df9ee65e8110b03`, tree `959c9e9d96d12e07e31be271f2ba47a2bb667cd1`. The change is commit `05105b0b` on branch `claude/blissful-pasteur-1c4ne6`, PR #1334. It makes a new candidate; the exact head and tree are in the PR comment that links this record.
- Deployment inspected: local development server on the working tree that became `05105b0b`. No hosted preview for this screen.
- Previous audit: [Codex final review: dispositions](codex-final-review-dispositions-claude.md), same day. Carried forward: CP-113, CP-114, CP-115.
- Scope: CP-114 and CP-115 only. CP-113 is reported as a proposal and not changed. The complete-only temperature guard and the source-tagged record low are untouched.
- Evidence type: source review, automated tests, browser at phone and desktop in light and dark, contrast measured from screenshot pixels. No first-language review; no physical phone.

## Findings and disposition

| ID | Finding | Status | What changed |
| --- | --- | --- | --- |
| CP-114 | The climate note for class Cwb said "mild all year from altitude — a highland growing pattern". Johannesburg printed it above a record low of -4.8 °C and the "Winter frost" calendar. | fixed | The note now reads "Summer rain, dry winters and summers that stay warm rather than hot. This climate type alone does not tell you whether there is frost." |
| CP-114 (same table, same fault) | Two neighbouring rows made the same kind of claim: Cwa "frost is light, so the dry season is the real limit" and Cfb "Mild and damp year-round — a long, gentle season that rarely gets properly hot". | fixed, **added by me beyond the Cwb row named in the request** | Cwa: "Summer rain, a dry winter and hot summers. This climate type alone …". Cfb: "Rain in every month and summers that stay warm rather than hot. This climate type alone …". Say if these two should be reverted; each is one line. |
| CP-115 | In dark mode the climate code and the class note were dark ink on a dark card, and the chips stayed light pills. | fixed | Code, note, the outage sentence and the chips now paint with tokens that are declared per theme. Layout is unchanged apart from the note's length (below). |
| CP-113 | The site data panel makes frost statements from monthly means and an untagged minimum. | open, proposal only | See "CP-113: proposal". Nothing in `components/DataPanel.tsx` was changed. |

## CP-114: what a class can and cannot say

**Where the sentence lives.** One table, `DESCRIPTIONS` in `lib/koppen-global.ts`, holds a name and a note for each of the 31 classes. `classifyKoppen` returns them. They reach a screen in two ways:

1. `lib/nasa-power.ts` puts the note into the route's answer as `climate.koppenNote`. `components/atlas/AtlasPanel.tsx` prints it under the class name.
2. `components/DataPanel.tsx` (line 1515) uses `koppenNote` only as a fallback sentence for classes that have no hand-written crop text of their own. Cwb, Cwa and Cfb each have hand-written text there, so their notes are not printed on that panel.

There is no translation of these notes in `lib/locales` or `lib/i18n.tsx`; they are English only. No test pinned the old wording.

**What the class defines** (the rules as coded in `classifyKoppen`, after Peel, Finlayson and McMahon 2007):

- "C", temperate: coldest month's mean above 0 °C and hottest above 10 °C.
- "w": dry winter. "f": no dry season.
- "a": hottest month 22 °C or more. "b": cooler than that, with four months at 10 °C or more.

All of it is monthly means. None of it says how cold a night gets. So a C-class note cannot call the year mild or frost light, and the classifier never sees altitude.

**What the saved places show.** `evidence-atlas-climate-card/class-note-check.ts` classifies the 100 saved South African places (the two committed fixtures) and prints each class's range. It judges nothing.

| Class | Places | Record minimum below 0 °C | Coldest record | Frost on the second daily record |
| --- | --- | --- | --- | --- |
| Cwb | 13 | 13 of 13 | Ermelo, Standerton -6.7 °C | 13 of 13 places, 1 to 41 days a year |
| Cfb | 11 | 5 of 11 | Komani -4.1 °C | 3 of 11 places, up to 10 days a year |
| Cwa | 3 | 1 of 3 | Ladysmith -2.3 °C | 1 of 3 places, 5 days a year |

"Mild all year" was false at every Cwb place in the set.

**What the new sentences claim.** The rain season and the summer letter of the class, and that the class alone does not tell you about frost. They add no threshold and call no site frost-free or frosty. The record low chip and the calendar name carry the point's own frost information.

**Left as they are.** The class names ("Subtropical highland, dry winter" is the conventional name for Cwb). Notes that mention frost in the cautious direction (BSk "real winters", BWk "bounded by frost", the D classes). Csb's "dry, mild summer", which is its summer letter. These were not in scope; BSk and BWk make statements a class cannot strictly support either, and are noted here for Rory.

## CP-115: tokens used

| Element | Was | Now |
| --- | --- | --- |
| Climate code | `#1F4D2B` | `var(--color-forest-800)` |
| Class note, outage sentence | `#4A4030` | `var(--text-secondary)` |
| Rainfall chip | fill `#E7EEF4`, ink `#3A6E92` | fill `color-mix(in srgb, var(--blue) 14%, transparent)`, ink `var(--blue)` |
| Calendar chip, record-low chip | fill `#EDE7DA`, ink `#7A6A48` | fill `var(--bg-2)`, ink `var(--text-secondary)` |
| Chip outline | none | `inset 0 0 0 1px var(--border)` as a shadow, so the chip's size is the same |

Each token is declared in both columns of both themes in `app/globals.css`.

**Contrast, measured from pixels.** Method in `evidence-atlas-climate-card/scripts/contrast-from-pixels.cjs`: background is the commonest colour in the element's box; ink is the median of the 3% of pixels farthest from it. A measurement of these screenshots, not a certification.

| Element | Dark, before (original `eaa5b98b` screenshot) | Dark, after | Light, after |
| --- | --- | --- | --- |
| Climate code | 1.91 | 9.12 | 9.61 |
| Class note | 1.83 | 6.09 phone, 4.98 desktop | 7.34 phone, 5.48 desktop |
| Rainfall chip | 4.69, as a light pill | 5.48 | 5.58 |
| Calendar chip | 4.28, as a light pill | 5.66 | 6.74 |
| Record-low chip | not measured | 5.66 | 6.74 |
| Incomplete-year note | not measured | 6.09 | 7.34 |

The desktop figures for the note are lower than the phone ones although the computed colour is the same token: at one device pixel per CSS pixel the thin italic strokes do not reach full ink, so the method reads them paler.

**Layout.** Structure, spacing and chip size are unchanged. The Cwb note is longer than the old one, so at 390 px it runs to three lines instead of two and the card is one text line taller. No sideways overflow at 390 px or 1280 px.

**Seen and left alone on the same panel** (outside "code, note and chips"): the card's left accent stripe, the section labels, the soil percentages and bars, the month letters and the small stat tiles still use fixed colours. In dark mode the "Silt" percentage (`#1F4D2B`) is dark on dark. Logged as CP-116, open.

## CP-113: proposal (separately scoped; nothing changed)

`components/DataPanel.tsx` at `05105b0b`. Each line is quoted from the file.

| Lines | What it prints | Read from | Problem |
| --- | --- | --- | --- |
| 835 | "frost likely / occasional / rare" label | `data.climate.minTemp` against 2 and 5 | `minTemp` is used without its source tag, so an outage default or a missing-value marker is judged as a reading |
| 849–850 | A frost-protection sentence in the site summary | `minTemp < 2`, untagged | same |
| 1136 | Colour of the minimum temperature | `minTemp < 2`, untagged | same |
| 1157–1161 | "Frost expected / Light frost risk / **Frost-free year-round** ({tempC}°C min)" | `minTemp` against 2 and 6, untagged | A frost-free guarantee from a gridded minimum, and from an unverified one when untagged |
| 1465, 1520–1521, 1604 | Chip "Frost expected / Light frost risk / **Frost-free**" | coldest monthly **mean** against 2 and 5 | The fault fixed on the Atlas: Johannesburg-like means read "Frost-free" |
| 1538, 1748 | "**Frost-free ≈ N days**" | months whose **mean** is 5 °C or more, × 365 / 12 | A day count manufactured from monthly means. No daily record is behind it |
| 1752 | "plant tender crops mid-August" chip | coldest mean below 5 | Planting advice keyed to a mean |
| 1640, 1655 | Temperature range and "winter low … (Jun–Jul)" | monthly means | Prints the coldest **mean** as a winter low, with fixed months that are wrong north of the equator |
| 1498–1500 | Hand-written crop text: Cwb "mild, dry winter … warm, frost-free conditions also carry bananas, avocado & subtropical fruit"; Cwa "warm, frost-free conditions"; Cfb "Mild winters keep frost-tender crops viable" | the class code | The CP-114 fault in stronger form: it recommends frost-tender crops for a class in which all 13 saved places have sub-zero record lows |

The panel already computes `temperatureStatus = monthlyTemperatureStatus(data.climate)` at line 816; I did not trace how far that guard reaches.

Proposed treatment, to be confirmed before any edit:

1. **Frost chip (1520–1521, 1604):** replace the class with the Atlas chip, "Modelled record low: X°C" from `recordMinimumC`, or "Record low: not known".
2. **"Frost-free ≈ N days" (1538, 1748):** remove. Nothing in the payload can support a day count. If Rory wants one, it needs a daily record and a stated definition; that is a data decision, not a wording one.
3. **The `minTemp` sentences and label (835, 849–850, 1136, 1157–1161):** read the value through `recordMinimumC`; when it is not known, say so and print no frost sentence. Reword "Frost-free year-round" so that it reports the number and guarantees nothing. The wording is farming copy in eleven languages (`lib/i18n.tsx` and ten locale files), so it needs Rory's text and a translation pass.
4. **"Winter low" and the mid-August chip (1640, 1655, 1752):** label the figure as the coldest month's mean and drop the fixed months; hold the planting chip until its basis is sourced.
5. **Hand-written class text (1498–1500):** remove the frost and mildness clauses, keeping the crop lists that the class's rain season supports. The banana and avocado lines need a source or should go.
6. **Kept as they are:** rainfall, soil, terrain, the temperature chart for a verified year, and everything that does not depend on frost.
7. **Tests:** render the real panel on the Atlas test's fixtures (incomplete year, untagged minimum, missing-value marker, real zero, Underberg, Johannesburg) and assert no frost class and no day count.

Size: one component, about 25 lines of logic, eight interface strings across eleven language files, and one new test file. It changes farming copy, so it should be its own change with its own review.

## Cases

| Case | Finding | Inputs | Expected and actual | Evidence | Result |
| --- | --- | --- | --- | --- | --- |
| K-01 | CP-114 | Each of the 100 saved places with a record minimum below 0 °C (58 places; all 13 Cwb among them) | Its class note does not match "mild" (other than "mild summer"), "gentle", "frost is light", "frost-free", "no frost" or "altitude" | `tests/koppen-global.test.ts` | passed |
| K-02 | CP-114 | Synthetic Cwb, Cwa and Cfb inputs | The three new sentences exactly; each ends with the frost sentence | Same file | passed |
| K-03 | CP-114 | The panel rendered for Johannesburg-like complete data | New note present; "mild all year" and "from altitude" absent | `tests/atlas-panel-temperature-claims.test.ts` | passed |
| K-04 | CP-115 | Source of the climate card | No fixed text colour, no fixed chip fill, four token chips, each token declared at least four times in `globals.css`, no border on the chip | Same file | passed |
| before | both | The same two files against the source at `eaa5b98b` | K-01, K-02, K-03 and K-04 fail; the other 23 pass | `evidence-atlas-climate-card/logs/01-…` | as expected |

The number 58 is what the fixtures contain; the test asserts "at least 50" and "exactly 13 Cwb" so that it cannot pass by checking nothing.

## Browser cases

Local development server, Playwright (Chromium), Johannesburg. The place search is stubbed (no map token locally). `/api/location-data` is the app's own local route with its live provider calls: 200, "Cwb", coverage "complete", tagged minimum -4.8 °C, and the **new** note in the route's own answer. Script `scripts/g.cjs`, output `outputs/G.json`, screenshots `screenshots/G-atlas-*.png`.

| Case | Kind | Result |
| --- | --- | --- |
| Complete: phone light, phone dark, desktop light, desktop dark | live answer, unaltered | New note shown; old wording absent; all six elements found; no sideways overflow |
| Incomplete: phone light, phone dark | synthetic (temperature fields replaced with the incomplete-year contract) | The guard holds: note and rainfall chip only |

I opened three of the six screenshots: complete phone dark, complete phone light and complete desktop dark. The run was on the working tree; the two application files were last written before the run and committed unchanged as `05105b0b`.

## Verification

- Typecheck: `npx tsc --noEmit -p .`, exit status 0, no output (`logs/03-typecheck.txt`).
- The two changed test files: 27 of 27, exit 0 (`logs/02-…`, full output).
- Affected tests, 23 files: 287 of 287, exit 0 (`logs/04-…`, full output with the file list).
- Release-note tests: 355 of 355, exit 0 (`logs/06-…`). Focused render group: 674 of 674, exit 0 (`logs/07-…`). Typecheck again after the release note was restamped: exit 0 (`logs/08-…`).
- Full suite and `rules`: one run on the final head, required before merge under AGENTS §1. The result is on PR #1334. The run on `eaa5b98b` was superseded by this push before it finished.
- Not checked: the hosted preview; a real map token; a signed-in account; a physical phone; a screen reader; the slate theme in a browser (its tokens are checked in source only); any translation.

## Next continuation

1. Affected-delta review of the new head by Codex; Argon's final pass is still owed and still blocked by quota.
2. CP-113 as its own change, once Rory confirms the treatment and supplies or approves the wording.
3. CP-116: the rest of the Atlas panel's fixed colours in dark mode.
4. Open and unchanged: CP-112 (reference cover label), CP-103 (calendar rule decision).
