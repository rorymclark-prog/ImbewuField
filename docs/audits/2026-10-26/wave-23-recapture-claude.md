# Wave 23 rendered re-capture — 26 October 2026

- Auditor: Claude (integrator), re-capturing the live build after wave 22 and Codex's reports work shipped.
- Reviewed revision: `main` at `98c8a22` (rorymclark-prog/imbewufield#1100 on top of wave 22, rorymclark-prog/imbewufield#1102), built with `next build` and served with `next start` in sample mode.
- Deployment inspected: `https://imbewufield.vercel.app/api/build-info` reported `98c8a22` on `main` before the capture.
- Previous audit: [Wave 22 rendered re-capture — 25 October 2026](../2026-10-25/wave-22-recapture-claude.md), which closes `w22-01` to `w22-10` except `w22-09` (with Codex). This record adds `w23-01` to `w23-07`.
- Scope: the wave 22 script and routes (41 routes, phone and desktop, light and dark, English and isiZulu, 492 loads) with the browser clock two days after the build; the new report workspaces from #1100 opened by clicking through (farm production and finance on /records, organisation reports and the MEL evidence report on /ngo, funder reports, the facilitator delivery report on /mentor; 24 loads); and contact sheets of every captured screen read by hand.
- Evidence type: Playwright measurement (page errors, overflow, `html lang`, composited contrast, the Lima launcher's first-view and end-of-page cover) and screenshots read by hand.

## Method note

The automated pass came back clean on every measure: no page errors, no overflow, `lang` correct,
nothing under the launcher at the end of any page, and contrast hits only on the `w22-09` chart.
Every finding below came from reading the screenshots, which is where this wave's attention went.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w23-01 | /home in isiZulu, every role | The header date read "HOMEWEEKDAYWED · 28 HOMEMONTHOCT". A regression from `w22-01`: the date moved into an effect keyed on `[lang]`, which ran before the lazily loaded isiZulu dictionary landed, so `translate()` returned the keys and nothing re-ran. /community, which lands on Home after the dictionary has loaded, showed it correctly | Computed during render behind a mounted flag, so it is still never in the prerendered HTML and now follows the dictionary when it loads. Rendered: "uLwesithathu · 28 Okthoba" | Fixed |
| w23-02 | /funder and /ngo, cohort view | The same figure twice on one page: "Farmer income R262 685" on the card and "R262 686" in "Harvest and income, month by month" | Open — one rounding for both | Open |
| w23-03 | New report previews (farm finance on /records, phone) | Money figures break mid-number: "R9 / 358,00", "R8 / 758,00" (the thousands separator is a plain space in a 133px column). The figures are also in the body sans, where the design system puts numbers in Newsreader | `components/ProgrammeReport.module.css` `.metric strong` | Open |
| w23-04 | New report workspaces in isiZulu | The isiZulu draft note between the report controls and the preview is a bare, unpadded line running edge to edge (`components/ReportComposer.tsx`) | Style it as the workspace's other notes | Open |
| w23-05 | Facilitator delivery report, phone | The partner block wraps "Implemented / by" and "Imbewu / KZN" in narrow label columns | Open | Open |
| w23-06 | Farm finance report | "1 local invoices"; the sample farm name "Demonstration farm" stays English in isiZulu | `lib/farm-report.ts` and `components/FarmReports.tsx` are in Codex's open rorymclark-prog/imbewufield#1121 | Handed to Codex |
| w23-07 | Every route | No page errors (clock two days on), no overflow at 390/768/1024/1280px, `lang` correct, nothing under the launcher at the end of any page | — | Checked |

### Checked and not a defect

- /community and /finances render Home and Records in sample mode, and /facilitator renders /mentor: route aliases, the same screens as before.
- The phone report-type card that is not selected hides its description: a deliberate compact rule in `components/ProgrammeReports.module.css`.
- The /farmer map sheet and blank map areas on /atlas and /network: map tiles do not load in the capture sandbox.

### Still open, not for this wave

- `w22-09` (chart labels in `components/crops/*`) with Codex.
- isiXhosa shows an English, month-first Home date: isiXhosa is still a machine draft in rorymclark-prog/imbewufield#1090.

## Verification

`w23-01`: rebuilt and rendered with the clock on 28 October — isiZulu phone and desktop, farmer and
mentor, show "uLwesithathu · 28 Okthoba"; English shows "Wednesday · 28 October"; no page errors.
The rest is filled in when the open items land.

## Next continuation

Ship `w23-01` alone (it is live for isiZulu users), then `w23-02` to `w23-05` on the same branch.
