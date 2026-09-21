# C11 — Read Charts and check the evidence

Implemented guide: `/student/guides/charts`, linked from the existing Using ImbewuField guide registry. Six steps, a three-stage zero-based cash-window example, a corrective decision exercise, printing and links to the actual records. It is not an assessed finance module or filmed walkthrough.

## Released source and UI inspected

Baseline main `a6ef09af4d561d83771d3a11dec7419a681fadd4`, 21 September 2026. The F6 main tests and deployment both completed successfully before this companion review. Source: `app/records/page.tsx`, `components/CashflowChart.tsx`, `components/FinanceGraphs.tsx`, and the existing finance-series and plan-source modules.

Opened production `/records?tab=charts` while signed out. Used the visible **Preview with demonstration records** button. The resulting tour workspace named Ubhejane Creche was inspected without adding, editing, exporting or sending a financial record.

- Desktop Financial sheet changed from Year (R15 641 income / R1905 expenses / R13 736 recorded cash margin) to Month (R7791 / R530 / R7261). The cash-flow graph remained on its own 12-month window. These are observed prepared sample values, not recommendations or course promises.
- The Cash flow 6m button changed that graph to six months (R12 325 in, R1305 out, R11 020 surplus). The harvest graph retained its separate 12-month window. Selecting April showed R434 in, R480 out and a −R46 running total starting at that window's zero baseline.
- The 12-month cash graph displayed a cut-mark explanation for a tall October spending bar. Its lower running-total band explicitly states that it is not a bank balance.
- Plan vs actual displayed logged picking this year beside one complete crop-cycle benchmark, with separate orchard and missing-plan explanations. This is not automatically an annual production target.
- Orchard in/out was toggled in the sample and restored to in. The displayed harvest scope changed; the guide does not imply the money totals drop all orchard income. Picked-minus-sold is a remainder, not a measured destination inventory.
- Phone layout was inspected at 390px: the header summary is explicitly this month, and the phone Cash flow component has its own window selection. The guide tells learners to re-read each card's period after resizing or reopening rather than assuming a shared setting.
- Area return notes distinguish assigned costs, shared costs, unassigned costs and today's mapped area. Crop performance can report cost per m² as not attributed. No complete-profit claim is made.

The existing monthly chart rectangles are pointer targets with title text, not labelled form controls. Month selection was tested by clicking the visible rectangle. This walkthrough does not claim full keyboard access to the underlying existing chart. The new guide's example uses ordinary focusable buttons.

## New example and limits

Original practice inputs: Month A R400 receipts / R300 payments; Month B R200 / R350. Three selected windows produce R100, −R50 and −R150. Source amounts stay unchanged; only inclusion changes. Every stage keeps the opening bank balance unknown. The example is manual, with previous/next and direct stage buttons, and reduced-motion styling. It sends no data and changes no records.

The hero reuses `/studies-guides/expense-record.jpg`, already present in the app and visually inspected in full via its source image `docs/media/studies-illustrated-release/art/market-community/true-cost.jpg`. Numeric graphics are authored; no generated screenshots or Flow credits.

Local typecheck, full suite (3641 pass, zero fail, one existing TODO), whitespace and pending-note checks passed. The local development host displayed its first-run data-consent screen; consent to cloud storage was not granted. The guide compiled and its rendered content was inspected, but unobstructed visual and interaction review must be completed on the configured branch preview before merge. Preview/production results, build SHA and final checks belong in issue #35. Do not treat this local observation as completed visual QA.

Bookkeeping/learner review of F7, fluent isiZulu, narration, filmed screen walkthroughs and reserve course integration remain open. The guide does not add stock valuation, account balances, loan ledgers, complete financial statements or partial-payment history to My Records.
