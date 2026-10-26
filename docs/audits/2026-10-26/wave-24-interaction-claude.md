# Wave 24 interaction capture — 26 October 2026

- Auditor: Claude (integrator).
- Reviewed revision: `main` at `72434e1` (wave 23, rorymclark-prog/imbewufield#1123), built with `next build` and served with `next start` in sample mode.
- Deployment inspected: `https://imbewufield.vercel.app/api/build-info` reported `72434e1` on `main`.
- Previous audit: [Wave 23 rendered re-capture — 26 October 2026](wave-23-recapture-claude.md), which closes `w23-01` and `w23-03` to `w23-05`; `w23-02` and `w23-06` are with Codex. This record adds `w24-01` to `w24-11`.
- Scope: the screens a first-paint capture never reaches. 31 click paths (navigation drawer, settings, the Lima bar and chat panel, the exchange Post form, the Records Sold and Spent tabs, Add a note, Record a field visit and every /mentor tab, every /ngo and /funder tab, a lesson, a crop price, a manual chapter, the tour, assessments, surveys, offline preparation), each at 390×844 and 1280×800, light English and dark isiZulu, browser clock two days after the build. 148 loads.
- Evidence type: Playwright measurement after each click (page errors, overflow, composited text contrast, what the Lima launcher covers at the end of the scroll) and screenshots read by hand.

## Why this lens

Waves 22 and 23 came back clean on every automated measure at first paint. Every finding below sits
behind a click, mostly in dark mode, where a colour written for the light page was never seen on the
dark one.

## Findings and disposition

| ID | Where | What the render showed | Track | Status |
| --- | --- | --- | --- | --- |
| w24-01 | Navigation drawer, dark | The current role chip ("Umlimi" / "Farmer") is leaf `#A8E860` on a pale pill: 1.27:1. The active item ("Ikhaya" / "Home") is fixed `#1F4D2B` forest on the dark drawer: 1.84:1 (`components/NavDrawer.tsx` hardcodes the active colour) | A | Open |
| w24-02 | Record a field visit (/mentor), dark | The meeting-place and GPS panel ("Location, map & directions", "Arrived? Tap GPS…") is light `#EEE4D0` text on a light `#F3F7F1` panel: 1.16:1 | A | Open |
| w24-03 | Exchange Post form, dark | The quantity validation message is fixed `#B83A18`: 3.24:1 | A | Open |
| w24-04 | Records Sold and Spent tabs | "Log harvest" is `#2E64B5` on the tinted tab panel: 3.72:1 (light). The Invoice link is forest `#315939` on the dark page: 2.32:1 (dark) | A | Open |
| w24-05 | Prices, a crop's detail, dark | The wholesale price card keeps white text on the leaf fill, which in dark is the light `#82C844`: the price "R8" 1.83:1, "Wholesale" 1.6:1 (`components/prices/CropPriceGuide.tsx`) | B | Open |
| w24-06 | Messages (/mentor, /ngo) | The practice-mode note "Replies stay in this tour session…" is fixed water blue `#235E86`: 2.66:1 in dark, 4.33:1 in light. The date and subject of a selected message are muted on its tint: 4.43:1 (`components/ContactInbox.tsx`) | B | Open |
| w24-07 | Lima chat panel | "Lima · guided conversation" is emerald on the panel tint at 12px: 4.23:1 (`components/SampleLimaConversation.tsx`) | B | Open |
| w24-08 | /ngo and /funder Gardens tab, light | The "demo sample" chip is ochre `#9E5C08` on its tint at 13px: 3.43:1 (`components/NgoDashboard.tsx`) | B | Open |
| w24-09 | Manual chapter pages, phone | At the end of a chapter the Lima launcher covers "Next" and the "Compiled by…" footer (`app/manual/[lang]/[slug]`): the page does not read `--lima-fab-clearance` | C | Open |
| w24-10 | Desktop, Home → "Ask for help" | The link opens `/farmer?chat=1`. Navigating there in-app with the pointer over where the map mounts throws `Invalid LngLat object: (NaN, NaN)` from Mapbox's mouseover handler (`Map.unproject`); a direct load does not. Reproduced without the shifted clock | C | Open |
| w24-11 | Every click path | No horizontal overflow; no other page errors | — | Checked |

### Checked and not a defect

- Settings on phone /records: the button is in the drawer there, not the header.
- The unselected phone report card without a description, the route aliases and the blank map tiles are as recorded in wave 23.

## Tracks

- **A — dark-mode navigation and forms (`w24-01` to `w24-04`).**
- **B — prices, messages, chat and chips (`w24-05` to `w24-08`).**
- **C — manual clearance and the map error (`w24-09`, `w24-10`).**

## Verification

Filled in after the fixed build is re-measured with the same click paths.

## Next continuation

Re-run the click paths after this wave is live, then extend them to the remaining forms (invoice
fill, survey answer, assessment answer, site survey).
