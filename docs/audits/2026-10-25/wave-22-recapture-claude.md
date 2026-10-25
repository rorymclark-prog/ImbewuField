# Wave 22 rendered re-capture — 25 October 2026

- Auditor: Claude (integrator), re-capturing the live build after waves 19–21 shipped.
- Reviewed revision: `main` at `8d2e1a9` (rorymclark-prog/imbewufield#1091), built with `next build` and served with `next start` in sample mode. The local build was made a day before the capture, which is how `w22-01` and `w22-02` showed up: the same thing happens on Vercel from the day after every deploy.
- Deployment inspected: `https://imbewufield.vercel.app/api/build-info` reported `8d2e1a9` on `main` before the capture.
- Previous audit: [Wave 21 rendered re-capture — 24 October 2026](../2026-10-24/wave-21-recapture-claude.md), which closes `w21-01` to `w21-11` except `w21-10` (with Codex). This record adds `w22-01` to `w22-10`.
- Scope: 41 routes at 390×844 and 1280×800, light and dark, English and isiZulu (328 page loads), plus 768×1024 and 1024×768 in both languages (164 loads). Sample mode, with `sessionStorage.imbewu_sample_lang` set.
- Evidence type: Playwright measurement of horizontal overflow, the `html` `lang` attribute, uncaught page errors, text contrast, and what the floating Lima button covers on first view and with every scroller at its end. Screenshots read by hand.

## Method changes since wave 21

- The contrast pass now composites translucent and `color-mix()` backgrounds (and the first colour of a gradient) instead of stopping at the first opaque ancestor, so the 1.24:1 and ~2.6:1 false positives listed in wave 21 no longer appear. Text over photos, disabled controls and anything under `opacity < 1` is skipped.
- New: page errors are collected per load, which is how the React hydration errors were found.
- New: a floating-button pass. For every small `position: fixed` control (in practice the 56px Lima launcher), it samples the points under it and records any text or control beneath, once on first view and once with the window and every scroll container scrolled to the end. "End" hits are content that can never be uncovered.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w22-01 | /home, every role and language | React error #425 on load. `getDayDate()` ran during render, and /home is prerendered, so the HTML carried the build day ("Saturday") and every visit on a later day re-rendered the whole page in the browser | The date is computed after mount; a non-breaking space holds its line until then | Fixed |
| w22-02 | /invoice | React error #425 on load. The issue date starts as `new Date()` in state, so the prerendered invoice reads "Issued" plus the build day and the date input's `max` is the build day | Track C | Open |
| w22-03 | Weather card (/home, /community, /community/profile) | Fixed colours: rain totals in water blue `#235E86` on the dark card (2.67:1), the "no rain" dash in `#C4BAA4` on the light card (1.91:1), a light divider `#F0E9D8` in dark, hazard banner text in fixed `#235E86` / `#B83A18` | Track B | Open |
| w22-04 | Weather card in isiZulu | English only: day labels ("Today", "Mon"), the frost, heat and heavy-rain warnings, the "Crops will lose about … mm" line and the weather descriptions. Only the error state had an isiZulu draft | Track B | Open |
| w22-05 | /calendar, light, isiZulu | "isiZulu translation pending — English source:" in `--text-muted` on the tinted draft box: 4.16:1 | `--text-secondary` | Fixed |
| w22-06 | /student/design, dark, isiZulu | "English source:" lines in `--text-muted` on the dark Study notice: 4.37:1 | `components/studies/DesignDraftCopy.module.css` uses `--text-secondary` | Fixed |
| w22-07 | Lima button at the end of the page | Covers content that scrolling can never uncover: "Send message" and the practice notice on /contact (phone), "Open people & gardens" on /mentor and /facilitator (phone), the last farmer rows on /network (desktop list), the last crop chips on /prices, the last site's links on /reports, the footer on /samples/production. Each page's scroll area ends with 8–120px of padding against the 180px (desktop) or 202px (phone) that `--lima-fab-clearance` publishes | Track A | Open |
| w22-08 | Lima button on first view, desktop | At 1280px it sits over the left edge of the content column on most staff and Study pages (/assessments cycle cards, /exchange chips, /mentor, /network, /reports, /tips, /tour). It parks bottom-left by design (see `components/ChatWidget.tsx`) | A design call for Rory: keep, or move to the bottom-right at `lg` | Asked |
| w22-09 | /samples/production, dark | Still as `w21-10`, plus chart axis titles ("Production in kilograms", "Crop growing space", "Fresh food", "Fresh + kept food") in `#EEE4D0` on the near-white chart card: 1.25:1 | `components/crops/*` is Codex's | Handed to Codex, unchanged |
| w22-10 | Every route | No horizontal overflow at 390, 768, 1024 or 1280px in either language; `html lang` matches on every load; no failed loads | — | Checked |

### Checked and not a defect

- /updates prerenders "24 October 2026": the hand-written release-note date, not a clock.
- First-view Lima overlap on phones: the launcher floats over the page as it scrolls by design. Only the end-of-page cases (`w22-07`) are content a farmer cannot reach.

### Still open, not for this wave

- `w21-10` / `w22-09` with Codex.
- Mentor and facilitator follow-up labels in `lib/i18n-pending.ts`, waiting on the isiZulu translator.

## Tracks

- **A — Lima clearance (`w22-07`).** Give each listed page's own scroll container `padding-bottom: var(--lima-fab-clearance, …)` the way `app/mentor/page.tsx`, `app/assessments/page.tsx` and `components/exchange/ExchangeBoard.tsx` already do (see `tests/lima-fab-clearance.test.ts`). /contact uses the shared `Workspace` main, so fix it there. Guard each in `tests/lima-fab-clearance.test.ts`.
- **B — Weather card (`w22-03`, `w22-04`).** Theme tokens for every colour in `components/WeatherWidget.tsx`. isiZulu drafts for its strings using the `IsiZuluDraftSource` pattern its error state already uses, marked unreviewed, and added to the translator list.
- **C — Invoice hydration (`w22-02`).** The invoice must render identically on the server and on first client render, then take today's date after mount, without flashing a wrong validation hint or changing what is saved.

## Verification

Filled in after the fixed build is re-measured.

## Next continuation

Re-capture after this wave is live.
