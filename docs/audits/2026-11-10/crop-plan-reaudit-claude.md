# Crop plan re-audit and fix, improve and polish plan — 2026-11-10

- Auditor: Claude, at Rory's request ("scan through all the previous audits and reaudit and put together a fix and improve and polish plan specifically for the crop plan"). Codex reviewed the method during the audit (two handoff notes on [PR #1327](https://github.com/rorymclark-prog/ImbewuField/pull/1327#issuecomment-6754934165)); its corrections are applied below.
- Reviewed revision: `8a4d1fd26b326d4469ee60d9eaf4c956ed9f4372` (`main`, released PR #1327). A first pass ran on `84219245`; every finding below was measured again on `8a4d1fd`. No app, library or test file is changed by this record.
- Deployment inspected: not inspected. All browser evidence is a local dev server of `8a4d1fd` with the public sample farm. Codex's handoff says production serves the same commit; I did not check that.
- Previous audit: [Production plan re-audit — 10 October](../2026-10-10/production-reaudit-codex.md) (CP-030–CP-046) and its lineage back to the [6 August truth audit](../../CROP-PLAN-TRUTH-AUDIT-2026-08-06.md); the crop rows of the [16 October visual and UX audit](../2026-10-16/visual-ux-audit-claude.md) (dark-13, desk-19, sdesk-15, staff-19, zu-12, nav-17, nav-18); the 1 November [harvest target](../2026-11-01/harvest-target-planning.md), [market-garden](../2026-11-01/market-garden-sales-targets.md) and [nursery](../2026-11-01/nursery-source-and-verification.md) records (NUR-001–NUR-009); Codex's 3–9 November grower records indexed in the README.
- Scope: `/facilitator/crops` (Production plan) as a farmer sees it, Simple and All tools, with the country hold and after it; `components/crops/*`; the three pop-up sheets. Not in scope: PDFs and calendar files, `/samples/production`, signed-in sync, Firestore rules, farming figures.
- Evidence type: source review; headless Chromium at 390×844, 320×568, 1280×800 and 640×400, earth light and dark, English and isiZulu, app text size 1.0 and 1.4; measured contrast, target size, type size, clipping and keyboard behaviour; 162 targeted guard tests. Viewport emulation is not a physical phone.

## What was already done

The calculation work is retained and not reopened: the truth rules (6 August), CP-001–CP-046, the weekly harvest targets with sales units, the nursery forecast and Codex's own-estimate grower workflow. Codex reports both full suites at 10,542/10,542 on this exact tree; I did not repeat them.

What no earlier record had done is look at the page. From wave 13 to wave 28 the crop rows of the visual audit were carried as "Codex-owned, reported only" and never assigned. Wave 28's dialog check excluded `/plan` and `components/crops/*` by name. Codex's own recent records say the same in their words: "This changes the picture. The current visual result is unverified." This audit fills that gap.

Two earlier claims are superseded by measurement here:

- The wave 16–20 re-captures counted "158 contrast rows and 456 sub-12px instances" on `/plan`. On `8a4d1fd` the measured figures are in the table below, per view.
- My first pass reported 15 unnamed controls and treated every control under 44px as a failure. Both were wrong. The 15 were summaries inside closed sections that are not rendered. WCAG 2.2 AA asks for 24px (SC 2.5.8), and 44px is this repo's own rule. The table keeps the two apart.

## How to read the findings

Each row says what kind of finding it is:

- **WCAG**: a measured failure of a WCAG 2.2 AA criterion, named in the row.
- **House rule**: breaks a rule this repo already enforces elsewhere (44px taps, the 12px farmer type floor, theme tokens, dialog focus, one h1 per page).
- **Defect**: visibly wrong on screen; reproducible.
- **Decision**: released on purpose; the question is whether Rory wants it this way.
- **Proposal**: an improvement, not a fault.

Measurements for every row are in [`evidence-crop-plan-reaudit/measurements/`](evidence-crop-plan-reaudit/measurements/): one JSON per view with selector, text, colours after blending, pixel sizes and the exception that applied. [`measure-page.cjs`](evidence-crop-plan-reaudit/measure-page.cjs) and [`measure-keyboard.cjs`](evidence-crop-plan-reaudit/measure-keyboard.cjs) reproduce them.

## Findings and disposition

### Decisions for Rory

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-047 | **Decision.** A mapped site with no confirmed country now shows "Confirm the site country before crop planning" instead of the calendar, tasks and exports. This covers every existing South African site until its farmer confirms, and the public sample farm on every visit. No country is pre-selected although the site has KwaZulu-Natal coordinates. The form asks for "Jurisdiction reference" and "Agricultural region reference". In isiZulu, 33 of its 40 text runs are English. | open, needs Rory | Released on purpose (`dfa7ac49`, release note of 3 November). `lib/international/site-context.ts:150` allows the planner only for a grower-confirmed `ZA`; `app/facilitator/crops/page.tsx:2678` swaps the page. Nothing backfills older sites. Browser: three actions bring the calendar back; the sample loses it again on reload. [01](evidence-crop-plan-reaudit/01-gate-first-screen-phone.png), [02](evidence-crop-plan-reaudit/02-gate-hold-text-phone.png), [03](evidence-crop-plan-reaudit/03-gate-isizulu-phone.png). Options in the plan, step 0. |
| CP-048 | **Decision.** In Simple mode on a phone the bed calendar now starts 1,136px down a 549px scroll area: two screens below the first one. Above it sit three collapsed market-garden panels, a nursery-batch card, the country card, Auto-suggest, a second harvest-targets panel and the nursery planner. | open, needs Rory | Measured at 390×844 after confirming the country. Before PR #1327 the calendar was on the first screen. [04](evidence-crop-plan-reaudit/04-after-confirm-first-screen-phone.png), [05](evidence-crop-plan-reaudit/05-after-confirm-second-screen-phone.png), [06](evidence-crop-plan-reaudit/06-calendar-phone-light.png). |
| CP-049 | **Decision.** Two panels are both titled "Harvest targets" with the same icon: "Your buyer-demand records" (own estimates) and "Plan from weekly demand" (catalogue). A South African farmer in Simple mode gets both, with near-identical forms. The own-estimate path asks for seven numbers per crop and shows "Exact UTC dates" and a "Search work limit … 1–10,000 checks". | open, needs Rory | [04](evidence-crop-plan-reaudit/04-after-confirm-first-screen-phone.png), [16](evidence-crop-plan-reaudit/16-own-estimates-form-phone.png). Both systems are correct by their contracts; the question is which one a South African site should see, and under what name. |

### Measured WCAG 2.2 AA failures

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-050 | **WCAG 1.4.3.** Crop names on the calendar bars are white 11px text: 2.57:1 on the planned green, 3.71:1 on the already-growing olive, and 1.55:1 on the faded year-two repeat. 4.5:1 is required. 19 labels in the default phone view. Carries dark-13. | open | `page.tsx:5234–5262`. Codex's independent figures agree (2.567, 2.376, 3.715, 2.873). Fix keeps every fill colour and switches the label to ink: 6.78, 7.32, 4.68 and 6.05:1. Year two keeps its quieter look by fading the fill, not the text (9.67–11.41:1). [06](evidence-crop-plan-reaudit/06-calendar-phone-light.png), [09](evidence-crop-plan-reaudit/09-calendar-desktop-1280.png). |
| CP-051 | **WCAG 1.4.3, dark mode.** The current month label is `#1F4D2B` on the dark header: 1.72:1. Month strips under "Check your farm conditions" put white on the leaf fill: 2.04:1. Year-two month labels are 4.43:1. Dark has 43 failing labels in the default phone view against 23 in light. | open | `page.tsx:2898` hardcodes the forest hex. The tokens already exist: `--color-forest-800` gives 8.23:1, `--on-forest-800` gives 9.68:1. [08](evidence-crop-plan-reaudit/08-calendar-phone-dark.png). |
| CP-052 | **WCAG 1.4.3.** "1 plants need age groups" is `--gold` on the tinted card: 3.85:1. The "check / transplant" note is 2.09:1 at 9px and 3.85:1 at 10px. | open | `--gold-dim` on the same card is 5.78:1. |
| CP-053 | **WCAG 2.5.8.** The "check / transplant" chips are 100×16px and sit against a crop bar, so the spacing exception does not apply. Five in All tools. | open | The only target-size failures on the page. Every other control under 24px passed through the spacing exception; see CP-063 for the house rule. |
| CP-054 | **WCAG 4.1.2 and 2.4.3; house dialog rule.** The crop picker, planting detail and Auto-suggest sheets have no dialog role or name. Escape closes none of them. Two do not take focus, so Tab keeps moving through the page behind. In the picker, focus leaves after 93 presses. Close buttons are 16–18px. | open | `page.tsx` has no `role="dialog"` and no Escape handler. `lib/use-dialog-focus.ts` does this for 13 other components. [14](evidence-crop-plan-reaudit/14-sheet-crop-picker-phone.png), [15](evidence-crop-plan-reaudit/15-sheet-planting-detail-phone.png), `measurements/keyboard-*.json`. |

### Defects

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-056 | The pinned month header is see-through in the default theme. Bed names, "+ crop" buttons and section bands show behind "BED", "YEAR ONE" and the month names as the farmer scrolls. | open | Root cause: earth light declares `--bg-2: rgba(236,227,201,0.35)` (`app/globals.css:267`) and the header and its corner cell paint it (`page.tsx:2849`, `:2858`). Dark and slate are opaque, so only the default theme shows it. [07](evidence-crop-plan-reaudit/07-sticky-header-bleed-and-clipped-notes-phone.png), [11](evidence-crop-plan-reaudit/11-text-scale-140-isizulu-phone.png). |
| CP-057 | A weekly target shows "Total demand 260.714286 kg" and "212.714286 kg still unallocated". On `84219245` the same target read 260.7 kg. | open, regression | `components/crops/HarvestTargetsPanel.tsx:36–37` now formats derived totals with the entry formatter. Typed values should stay exact; totals should round. [12](evidence-crop-plan-reaudit/12-weekly-target-card-phone.png), [13](evidence-crop-plan-reaudit/13-weekly-target-review-phone.png). |
| CP-058 | On a phone the notes in the fruit and animal rows run off the right edge mid-sentence ("…picking months to confirm", "No locally confirmed production month"). | open | The notes sit in the 1,520px grid without the width limit the section notes have. [07](evidence-crop-plan-reaudit/07-sticky-header-bleed-and-clipped-notes-phone.png). |
| CP-059 | Wording slips: "1 plants need age groups" (carries staff-19); "hover or tap a bar" on a phone; "0 existing, 1 proposed" on every plant. | open | [17](evidence-crop-plan-reaudit/17-plant-list-repeated-phone.png). |
| CP-060 | One-month bars cut the crop name to "Oni…" (30px shown, 36–77px needed). Longer bars lose their name when the calendar is panned, leaving an unlabelled colour. | open | The fruit rows already keep their label in view; bed bars do not. `measurements/phone-light-simple.json` → `clippedText`. |
| CP-061 | In All tools on a phone the page title is cut off ("Plants and housing from yo…") and the beds, Learn and climate chips are off-screen: the header is 1,157px wide in a 390px window. In isiZulu the subtitle is clipped in Simple mode too (220px of 243px). | open | Header is `overflow-x: auto` with no cue that it scrolls. |
| CP-062 | Pinned chrome leaves little room for the plan. The scroll area is 65% of a 390×844 phone, 44% at 320×568 and 35% (141px) on a desktop at 200% zoom, where no bed row is visible. | open | The intro paragraph and the notices are pinned above the scroll area, with the help bar below it. No content is lost, so this is not claimed as a WCAG 1.4.4 failure. [10](evidence-crop-plan-reaudit/10-desktop-200-percent-zoom.png), [11](evidence-crop-plan-reaudit/11-text-scale-140-isizulu-phone.png). |

### House rules

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-063 | 41 controls in Simple and 61 in All tools are under the 44px tap rule: every crop bar (26px tall), eleven "+ crop" buttons (56×26), Home (34×34), sheet close buttons (16–18px). | open | Every control measured in the page views passes WCAG's 24px minimum or its spacing exception; the sheet close buttons were not checked against that exception. This is the repo's own rule (CP-042 applied it to the export card only). |
| CP-064 | 96 text runs in Simple and 191 in All tools are under the 12px farmer floor, down to 8.5px. | open | `tests/type-floor.test.ts:86` lists this page as a staff route and `:354` allows it 146 sub-12px lines as "legacy debt", although its own comment says growers open it from Home. A readability rule, not a WCAG one. |
| CP-065 | At 1,280px the bars, bed labels and bands stay at phone sizes (10–12px). Carries desk-19 and sdesk-15. | open | [09](evidence-crop-plan-reaudit/09-calendar-desktop-1280.png). |
| CP-066 | The page has 94 hardcoded colours and 34 `font-mono` uses, and sits outside the contrast, tap-target, dialog and token guards that cover other farmer pages. `tests/stale-paper-hex.test.ts:110` asserts the page must still contain the retired `#F7F2E9`. | open | Static counts on `8a4d1fd`. That assertion has to be rewritten with its reason when the page moves to tokens, not deleted. |
| CP-055 | The planner has no h1 (the country hold has one). Card titles are mostly not headings, and the first heading a screen reader meets is an h4. Carries nav-17. | open | Not a WCAG failure by itself. `tests/page-heading.test.ts` passes because an h1 is reachable from the file (the site picker and the country hold), not because the planner view has one. |

### Language

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-067 | In isiZulu, 91% of the text runs in the default Simple view are English (84% by characters), and 98% with every section open. Sesotho, Xitsonga, Tshivenda and the other locales get 100% English. Carries zu-12. | open | The page uses a two-language helper (`cropUi`, 56 calls) and never the locale files; 14 of the older crop components have no language hook. Sourced farming copy must stay English until reviewed (AGENTS §4); interface labels need not. New wording goes through AGY's source-paired review, not straight into runtime dictionaries. |

### Proposals

| ID | Improvement | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-068 | Weekly targets tell the farmer what matters in the hardest way: nine uncovered months as a comma list, "130.4 m²" needed with no mention of the 42 m² of beds on the map, and labels such as "Unallocated volume" and "Benchmark before allowance". | proposal | Show twelve month cells per target, needed against mapped area, and separate "too soon to harvest" from a real gap. All from figures the panel already computes. Then put the weekly goal beside recorded harvests ("goal 5 kg · recorded 3 kg") from the existing records, with no new forecast. |
| CP-069 | Four "how much" figures share one page: 56.7 kg, about 49 kg, 48.8 kg and 29.7 kg. Each is correctly scoped (CP-015), but a farmer sees four answers. | proposal | One headline with its scope in plain words; the others reconciled against it. |
| CP-070 | The same four fruit plants appear three to five times each in the default view: calendar row, picking months, projection and farm conditions. | proposal | One row per plant holding its season, months, age and care. |
| CP-071 | The ten-year projection prints nine identical rows ("48.8 kg *") and an asterisk on each. | proposal | Collapse unchanged years into one line. |
| CP-072 | The nursery planner shows "Unknown" 68 times in Simple (136 in All tools) before any equipment is entered. Form fields are painted in the page's paper colour and read as disabled. | proposal | Summarise what is missing once; give inputs the themed input surface. |

### Carried forward, unchanged

CP-012 and SS-003 (signed-in save and reopen never verified), SS-002 (fluent language review), SS-004 (physical devices), nav-18 (`/facilitator/crops` in the address bar), cultivar coverage (28 of 49 crops), NUR-006 (forecast is not stock). CP-042 and the 28 October chart fix were not re-tested.

## Verification

- Typecheck: `npx tsc --noEmit` clean on `8a4d1fd`.
- Tests: 162 of 162 passed across the thirteen guard files that touch this page (type floor, tap targets, contrast, dialog focus, headings, tokens, language coverage, crop page UX). Full suite not run: no code changed, and Codex's two 10,542-case runs cover this tree.
- Whitespace: `git diff --check` clean.
- Output inspected: 17 screenshots in [`evidence-crop-plan-reaudit/`](evidence-crop-plan-reaudit/) and 19 measurement files, all from `8a4d1fd`. Views: phone 390×844 light and dark, Simple and All tools, collapsed and fully opened; isiZulu Simple; the country hold in light, dark and isiZulu; 320×568; app text size 1.4 in English and isiZulu; desktop 1280×800 light and dark; desktop 640×400 as 200% zoom. Keyboard: three sheets and the first 45 tab stops at both widths. Every tab stop showed a focus ring.
- Weekly targets flow: saved a 5 kg/week carrot target, suggested sowings and reviewed four proposals on `8a4d1fd`. Accepting the proposals onto the calendar was exercised on `84219245` only.
- Counts move slightly with the site climate. The sample's climate comes from `/api/location-data`, which allows 20 requests an hour locally. The default light, dark, All tools and desktop views ran with it loaded; the later runs (isiZulu, fully opened, 320px, text size 1.4, 200% zoom) ran without it and lack the two fruit reference bars, which removes 4 controls and 13 small text runs. Each measurement file records this as `siteClimateLoaded`. The figures quoted above come from runs with the climate loaded, except the isiZulu shares and the fully opened counts.
- Other limits: the sample farm, not a private farm; emulated viewports, not a phone; no screen reader; no signed-in account; no PDF or calendar export; isiZulu wording counted, not judged. "Country details are available from this device" is the sample's notice and may differ for a signed-in farmer.

This record changes no picture. `PLAN_VERSION` is untouched.

## Next continuation

Ownership before any edit. Codex has said it is no longer changing crop or nursery code and that AGY's translation queue does not overlap. On that basis the steps below would touch, by Claude: `app/facilitator/crops/page.tsx`, the older presentation components in `components/crops/` (not the `Grower*` or `Nursery*Observation*` files), `app/globals.css` for one added token, and the guard tests named in each step. They would not touch `lib/crop-*.ts` calculations, `lib/international/*`, locale dictionaries, Firestore rules, species, lessons or `PLAN_VERSION`. Anything in a `Grower*` file is offered to Codex first.

Each step is one branch and one PR, verified to match its scope (AGENTS §1): presentation-only steps need typecheck, affected tests, the measurement scripts, screenshots and the `rules` job. Step 6 changes what a calculation displays and needs the full suite.

0. **Three decisions (Rory).** No code.
   - CP-047: keep the explicit confirmation but make it one tap for a site whose coordinates are in South Africa ("This site is in South Africa" with the country pre-filled as a suggestion, optional fields folded away, the saved calendar visible behind it), and give the sample farm a confirmed country. Or keep the full form. A silent default is not recommended: Codex's contract treats a missing confirmation as unknown on purpose.
   - CP-048: in Simple mode, calendar first, with the market-garden panels below it or behind one "Selling to a buyer?" entry.
   - CP-049: one "Harvest targets" entry for a South African site, with the own-estimate path named differently or shown only where the catalogue does not apply.
1. **Make the calendar readable.** CP-050, CP-051, CP-052, CP-056, CP-057, CP-058, CP-059, CP-060. Accept when: zero contrast failures in the four default views; no text visible through the pinned header at 390px and at text size 1.4; target totals show one decimal; no clipped sentence in the fruit or animal rows; year two still reads as a repeat and already-growing crops still differ from planned ones. Add the page to `component-text-contrast`.
2. **Touch and keyboard.** CP-053, CP-054, CP-063, CP-055. Accept when: all three sheets have a dialog role and name, take focus, hold Tab, close on Escape and return focus; no control under 24px without an exception; "+ crop", bar hit areas, Home and close buttons reach 44px on touch screens; one h1. Add the page to the dialog and tap-target guards.
3. **Give the plan the screen.** CP-061, CP-062, and CP-048 once decided. Accept when: the scroll area is at least 70% of 390×844 and at least 50% of 640×400; the title is never clipped at 320px, at text size 1.4 or in isiZulu; five months show on a 390px phone.
4. **Type and tokens.** CP-064, CP-065, CP-066. Accept when: no farmer text under 12px; the type-floor budget for this page is 0 and it is listed as a farmer surface; no hardcoded themed colour; the stale-hex assertion is rewritten with its reason.
5. **Language.** CP-067, with AGY. Accept when: interface labels come from locale keys; no sentence is half English and half isiZulu; sourced farming copy keeps its English and its draft notice; long isiZulu labels fit at 390px and at text size 1.4.
6. **Weekly goals a farmer can read and track.** CP-068, CP-069. Full suite. No new yield, timing or weekly forecast.
7. **Declutter All tools.** CP-070, CP-071, CP-072.

Branch `claude/blissful-pasteur-1c4ne6`; the PR and issue #35 carry the link. Steps 1 and 2 need no decision and can start as soon as Rory says go.
