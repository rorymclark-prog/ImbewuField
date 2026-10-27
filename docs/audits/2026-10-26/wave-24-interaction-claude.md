# Wave 24 interaction capture — 26 October 2026

- Auditor: Claude (integrator).
- Reviewed revision: `main` at `72434e1` (wave 23, rorymclark-prog/imbewufield#1123), built with `next build` and served with `next start` in sample mode.
- Deployment inspected: `https://imbewufield.vercel.app/api/build-info` reported `72434e1` on `main`.
- Previous audit: [Wave 23 rendered re-capture — 26 October 2026](wave-23-recapture-claude.md), which closes `w23-01` and `w23-03` to `w23-05`; `w23-02` and `w23-06` are with Codex. This record adds `w24-01` to `w24-12`.
- Scope: the screens a first-paint capture never reaches. 31 click paths (navigation drawer, settings, the Lima bar and chat panel, the exchange Post form, the Records Sold and Spent tabs, Add a note, Record a field visit and every /mentor tab, every /ngo and /funder tab, a lesson, a crop price, a manual chapter, the tour, assessments, surveys, offline preparation), each at 390×844 and 1280×800, light English and dark isiZulu, browser clock two days after the build. 148 loads.
- Evidence type: Playwright measurement after each click (page errors, overflow, composited text contrast, what the Lima launcher covers at the end of the scroll) and screenshots read by hand.

## Why this lens

Waves 22 and 23 came back clean on every automated measure at first paint. Every finding below sits
behind a click, mostly in dark mode, where a colour written for the light page was never seen on the
dark one.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w24-01 | Navigation drawer, dark | The current role chip ("Umlimi" / "Farmer") is leaf `#A8E860` on a pale pill: 1.27:1. The active item ("Ikhaya" / "Home") is fixed `#1F4D2B` forest on the dark drawer: 1.84:1 (`components/NavDrawer.tsx` hardcodes the active colour) | `--cat-foundation-text` (brand forest in light, leaf in dark) for the active item; the role chip's pale fill is a per-theme `--role-chip-bg` (rorymclark-prog/imbewufield#1127) | Fixed |
| w24-02 | Record a field visit (/mentor), dark | The meeting-place and GPS panel ("Location, map & directions", "Arrived? Tap GPS…") is light `#EEE4D0` text on a light `#F3F7F1` panel: 1.16:1 | `components/VenueLocation.tsx` uses `--bg-1`, `--border` and `--text-primary` (#1127) | Fixed |
| w24-03 | Exchange Post form, dark | The quantity validation message is fixed `#B83A18`: 3.24:1 | `EX.red` in `components/exchange/theme.ts` is `--orange` (the `:root` `--danger` never followed dark); also lifts the Delete button in dark (#1127) | Fixed |
| w24-04 | Records Sold and Spent tabs | "Log harvest" is `#2E64B5` on the tinted tab panel: 3.72:1 (light). The Invoice link is forest `#315939` on the dark page: 2.32:1 (dark) | `--blue` on a lighter tint for Log harvest; `--cat-foundation-text` for the invoice links (#1127) | Fixed |
| w24-05 | Prices, a crop's detail, dark | The wholesale price card keeps white text on the leaf fill, which in dark is the light `#82C844`: the price "R8" 1.83:1, "Wholesale" 1.6:1 (`components/prices/CropPriceGuide.tsx`) | The card's text uses `--on-forest-800`, the per-theme ink for the forest fill (cream in light, near-black on the light dark-mode fill) (rorymclark-prog/imbewufield#1126) | Fixed |
| w24-06 | Messages (/mentor, /ngo) | The practice-mode note "Replies stay in this tour session…" is fixed water blue `#235E86`: 2.66:1 in dark, 4.33:1 in light. The date and subject of a selected message are muted on its tint: 4.43:1 (`components/ContactInbox.tsx`) | The note is `--text-primary` on a `--blue` tint of `--bg-1`; the row's date, subject and preview use `--text-secondary` (#1126) | Fixed |
| w24-07 | Lima chat panel | "Lima · guided conversation" is emerald on the panel tint at 12px: 4.23:1 (`components/SampleLimaConversation.tsx`) | The tag uses `--text-primary` (#1126) | Fixed |
| w24-08 | /ngo and /funder Gardens tab, light | The "demo sample" chip is ochre `#9E5C08` on its tint at 13px: 3.43:1 (`components/NgoDashboard.tsx`) | `--gold-dim` (#1126) | Fixed |
| w24-09 | Manual chapter pages, phone | At the end of a chapter the Lima launcher covers "Next" and the "Compiled by…" footer (`app/manual/[lang]/[slug]`): the page does not read `--lima-fab-clearance` | The chapter's `<main>` pads `max(64px, var(--lima-fab-clearance))` like the manual index (rorymclark-prog/imbewufield#1128) | Fixed |
| w24-10 | Desktop, Home → "Ask for help" | The link opens `/farmer?chat=1`. Navigating there in-app with the pointer over where the map mounts throws `Invalid LngLat object: (NaN, NaN)` from Mapbox's mouseover handler (`Map.unproject`); a direct load does not. Reproduced without the shifted clock | Only in builds without `NEXT_PUBLIC_MAPBOX_TOKEN` (the capture sandbox; production has a token): the `mapbox://` style made the Map constructor throw after its mouse handlers were attached and before the transform was sized, so a resting pointer hit a 0×0 transform. A missing token now uses the token-free offline canvas (#1128) | Fixed (sandbox-only) |
| w24-12 | /farmer offline canvas, dark | Found by the verification pass once `w24-10` let the offline canvas render: its status note ("Offline canvas · saved drawings and pins…", shown to anyone offline) is fixed `#203127` on the themed panel: 1.36:1 | `components/Map.tsx` uses `--text-primary` | Fixed |
| w24-11 | Every click path | No horizontal overflow; no other page errors | — | Checked |

### Checked and not a defect

- Settings on phone /records: the button is in the drawer there, not the header.
- The unselected phone report card without a description, the route aliases and the blank map tiles are as recorded in wave 23.

## Tracks

- **A — dark-mode navigation and forms (`w24-01` to `w24-04`).**
- **B — prices, messages, chat and chips (`w24-05` to `w24-08`).**
- **C — manual clearance and the map error (`w24-09`, `w24-10`).**

## Verification

The three swarm PRs were reviewed and merged into the integration branch, rebuilt, and the same 35
click paths re-run at both widths, light English and dark isiZulu (140 loads, clock two days on).

- Every finding above is gone from the measurements: no low-contrast text on the drawer, the field
  visit panel, the Post form, the Records tabs, the crop price card, Messages, the chat header or
  the Gardens chip; nothing under the launcher at the end of a manual chapter; no page errors.
- The pass surfaced `w24-12` (the offline-canvas note), fixed and pinned in
  `tests/w24-manual-map.test.ts`.
- Light-mode looks are unchanged: each fix uses a token whose light value is the colour it
  replaces, or changes text only where it failed.
- Tests: `tests/w24-dark-forms.test.ts`, `tests/w24-cards-chips.test.ts`, `tests/w24-manual-map.test.ts`
  and `tests/lima-fab-clearance.test.ts` pin the fixes; every test that reads a changed file passes
  locally apart from the known sandbox-only failures.

## Next continuation

Re-run the click paths after this wave is live, then extend them to the remaining forms (invoice
fill, survey answer, assessment answer, site survey).
