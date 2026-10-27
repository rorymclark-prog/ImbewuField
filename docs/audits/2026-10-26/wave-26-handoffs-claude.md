# Wave 26 Codex hand-offs closed, #1121 screens checked — 26 October 2026

- Auditor: Claude (integrator).
- Reviewed revision: `main` at `201d57f` (Codex's rorymclark-prog/imbewufield#1121, report history and donor indicators), merged locally with the wave 24 and 25 work, built with `next build` and served with `next start` in sample mode.
- Previous audit: [Wave 25 forms, offline and keyboard capture — 26 October 2026](wave-25-forms-offline-keyboard-claude.md). This record adds `w26-01` to `w26-04`.
- Why now: `w23-02` and `w23-06` were handed to Codex because its open #1121 was changing the same files. #1121 merged without them, and no other open Codex PR touches `lib/cohort-series.ts`, `lib/farm-report.ts` or `lib/programme-report.ts`, so they are closed here.
- Scope: the two hand-offs, then #1121's new report screens (the organisation, MEL, funder, farm and facilitator report workspaces with the new comparison and donor-reference controls). These were opened by clicking through at 390 and 1280px, light English and dark isiZulu, with the clock two days on (24 loads), plus screenshots read by hand.

## Findings and disposition

| ID | Where | What the render showed | Fix | Status |
| --- | --- | --- | --- | --- |
| w26-01 (`w23-02`) | /funder and /ngo, cohort view | "Farmer income R262 685" on the card, "R262 686" in "Harvest and income, month by month". `lib/cohort-series.ts` rounded each month to whole rand, then summed the rounded months | Money totals (income and costs) are summed from the months before their whole-rand rounding, to the cent; both labels round once with `randLabel`. Rendered: R262 685 in both places on /funder and /ngo | Fixed |
| w26-02 (`w23-06`) | Farm reports (production and finance) | "1 local invoices", and the same slip in four other count phrases ("1 entries have future dates", "1 harvest or sale entries have…", "1 available records have…", "0 sale entries + 24 paid invoices" agreed only by luck) | `countOf(n, one, many)` in `lib/farm-report.ts`; three `tests/farm-report.test.ts` pins that quoted the old wording re-pinned to the agreeing form. "Demonstration farm" stays English: the report body is English by design, and its own note says so | Fixed |
| w26-03 | Programme reports | Kilograms and percentages with a decimal point ("32 707.1 kg") beside money with a decimal comma ("R262 684,93"); Records uses "427,2 kg" | `lib/programme-report.ts` formats with a decimal comma (the shared `numberLabel` is left alone: it is used app-wide) | Fixed |
| w26-04 | #1121's report workspaces | No page errors, overflow, low-contrast text or launcher cover in any of the 24 loads; the new comparison and donor fields render in both themes | — | Checked |

## Verification

All four rows were measured on the merged local build described above. `tests/w26-handoffs.test.ts`
pins the three fixes. `farm-report`, `programme-report`, `mel-report`, `staff-report`,
`sample-programme`, `cohort-chart-honesty`, `cohort-view` and Codex's `report-history-donor`
pass. `npx tsc --noEmit` is clean.

## Next continuation

Ship with wave 25 once wave 24 is on `main`. Still with Codex: `w22-09` (chart labels in
`components/crops/*`).
