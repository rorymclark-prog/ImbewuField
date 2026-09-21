# Using ImbewuField: companion learning pathway

Rory requested companion sections covering the app from mapping through financial records and invoices on 20 September 2026. These are 14 tutorial specifications, with the invoice guide drafted separately. They are not all filmed, tested end-to-end or published.

## One guide format

Each guide answers: what you will achieve; what to have ready; where to open the task; the steps shown on the actual screen; how to verify the saved result; a common mistake and recovery; a small independent practice task; and a link back to the relevant course lesson. Provide an accessible text version, matching narration, real app captures and a printable quick card. Keep both a beginner route and optional detail. Screen captures must use approved sample data and never expose a farmer's private finances or exact home location.

Teach with the existing `/tour` and sample workspace before the learner works on their own farm. Explain which workspace they are using. Do not invent a separate training sandbox or silently populate a real farm with practice invoices. Export exercises stop at preview/download; sending an invoice to a real customer is a separate learner action.

## Tutorial sequence

| ID | Companion section | Learner's finished task | Course links | Current evidence |
| --- | --- | --- | --- | --- |
| C01 | Start, find your way and keep work safe | Identify sample versus own workspace; return to a saved item; understand save/sync messages | All modules, F1 | `lib/sample-tour.ts`, `lib/sample-mode.ts`; tour entry observed live |
| C02 | Find and map your site | Find the correct place, check the boundary and distinguish measured information from a sketch | Reading the Landscape; F8 | `/farmer`, saved-place/design source; full recording still needed |
| C03 | Build and review a design | Work through Base, Sectors, Water, Earthworks, Zones, Planting, Structures, Review and Glossy; move an item and use Undo | Water, soil, guilds, forest; F8 | `components/design/DesignWizard.tsx`, `StepGuide.tsx`, `lib/sample-tour.ts` |
| C04 | Turn the map into a crop plan | Check actual growing areas, choose plantings, inspect the calendar and distinguish planned harvests from records | Vegetables, seasonal planning; F3–F4 | `/facilitator/crops`, `lib/finance-plan-source.ts`; finance uses the main saved site's mapped beds |
| C05 | Record what you picked and where it went | Record the crop and kilograms; understand entry-date limits and the picked-minus-sold remainder; keep detailed destinations separately | Vegetables, postharvest; F2 | `/records`, Picked; `HarvestReconciliation` |
| C06 | Record expenses and keep the receipt | Save and find a cost, retain evidence and its original date, and distinguish tagged costs from unallocated costs | Farm money; F2–F4 | `/records`, Spent; `components/records/ReceiptPreview.tsx` |
| C07 | Record a sale once | Check produce, kilograms, amount, buyer and date; find the related invoice or existing sale | Market; F2, F5 | `/records`, Sold; `lib/sale-invoice.ts` |
| C08 | Create, check and save an invoice | Choose the correct invoice type, check seller/buyer, units, agreed price, dates and payment status; reopen Saved | F5, F7 | `/invoice`; live entry and paid/unpaid choices observed; [draft guide](invoice.md) |
| C09 | Bring paper and past sales into the app | Preserve the old reference/date and link an existing recorded sale when applicable | F2, F5 | `/invoice`, Invoice type and Existing sale record; `lib/invoice-entry.ts` |
| C10 | Review payment and share the right document | Reopen the correct invoice; check payment evidence; preview PDF/Print; avoid a duplicate sale | F2, F5 | `/invoice`, Saved, Review payment, Share PDF, Print; full save/export exercise still needed |
| C11 | Read Charts and compare plan with actual | Select the period, check units and included costs, explain uncertainty and investigate a difference | F3–F4, F7–F8 | `/records?tab=charts`, `lib/finance-plan-source.ts`, `lib/finance-series.ts` |
| C12 | Export records and prepare for help or finance | Produce a checked CSV/summary and supporting evidence; explain what the export does not prove | F7–F8 | `/records`, Export/Export CSV, Records for a lender; no bank connection or automatic approval claim |
| C13 | Keep field evidence and make a report | Connect photos, assessment and tests to the correct site; inspect the resulting report before sharing | Landscape, land/water, capstone; F8 | `/samples/farm#evidence`, `/samples/farm#report`, `lib/sample-tour.ts` |
| C14 | Study offline, practise and get guidance | Save a module with its stated size, reopen its text/audio/video, find the linked lesson and ask for help | All modules | `/student`, Study offline and deck player; role-specific mentor/training guides follow as extensions |

## Verified app boundaries

Code baseline: main `046592061bdae05ce00f334b488847bf25aa30c6`. Invoice entry and a saved unpaid invoice inspected in the production sample tour on 20 September 2026. The reopened invoice exposed Quantity, Unit, Price each, Add line item, Payment due, Save invoice, Share PDF and Print. No entry was saved or sent during this read-only walkthrough. Source reading verifies mechanisms below; it does not substitute for recording the complete workflow.

- **One financial book:** `/finances` redirects to `/records`. Use the visible Picked, Sold, Spent and Charts labels, not an obsolete separate Finance page.
- **Invoice types:** A new invoice; Produce already sold; An invoice already written on paper. Past/paper entries ask whether the sale already exists. Existing-sale linking is limited to the available recorded kilogram sales; reopen an already invoiced sale from Saved.
- **Payment status:** paid in full or unpaid only. Deposits, instalments and partial balances need the finance workbook and a future supported payment ledger; do not fake them by marking the full invoice paid.
- **Units:** paid invoice kilogram lines can create crop-sale evidence. Bags, bunches and other units retain their stated quantities; the app does not infer kilograms. Never teach an invented conversion.
- **Duplicate prevention:** invoice-linked sale rows and paid invoice totals are reconciled by `lib/invoice-sales.ts`. A learner should reopen or link the source record instead of manually entering the same income again.
- **Tax:** `lib/invoice-document.ts` prints the entered VAT/tax reference; it derives no VAT arithmetic. A reference field alone does not establish tax-invoice compliance. Compliance teaching needs current SARS guidance and local bookkeeping review.
- **Saving:** `app/invoice/page.tsx` can report a device save with crop-sale synchronisation pending. Invoice documents are currently device-local/account-scoped; do not promise the complete document will appear on another device because crop-sale rows synchronise.
- **Maps and metrics:** the current finance source prefers the main saved site's Design Studio beds, with a legacy fallback. Planned area and forecast harvest are not measurements of actual harvested production. Review the selected site before comparing performance.
- **Boundaries and documents:** a map, farm report, invoice PDF or lender summary does not itself establish land rights, legal compliance, profitability or loan eligibility.

## App placement and media acceptance

Add a **Using ImbewuField** section beside the main course and the deeper **Farm finance** pathway. Each practical lesson should expose “Try it in the app” and “Read the steps”, with the relevant safe entry route. Keep the existing product tour as orientation and these companions as repeatable task instruction. A link to a route is not evidence that a complete guided tutorial exists.

Capture the released UI at a phone-friendly scale. Use warm homestead images for context and real screen recordings for app tasks; no AI-generated screenshots. Animate focus, cursor/tap and calculations deliberately. A learner must be able to pause, read, replay and perform the task independently. Verify narration against the on-screen action and preserve the current recording's app revision. Update a guide when a relevant route, label or save behaviour changes.

Open work: full tutorial scripts and practice cards for C01/C03–C04/C09–C10/C12–C14; live end-to-end saves/exports in the sample workspace; all screen recordings; translated narration; companion-section UI and course links. No real customer messages were sent during this review.

## First app implementation

The first readable/printable invoice companion is implemented at `/student/guides/invoices`, linked from a Using ImbewuField section on Studies. It reuses the reviewed harvest-record illustration, names the live controls, checks duplicate-sale reasoning interactively, and links to Invoice and the existing sample tour. It does not add assessed module progress or promise a recorded walkthrough. Local typecheck and the full suite passed; branch preview and production visual/link checks are recorded in the release ledger after verification. A local onboarding overlay prevented unobstructed visual review there, so the release must be inspected in its preview before merge.

## Harvest and expense companions — 21 September 2026

C05 and C06 now have five-step English guides at `/student/guides/harvest` and `/student/guides/expenses`, with a decision exercise, work checks, printing and related-guide links. These reuse the invoice companion layout; they are not narrated screen recordings or assessed farming modules.

The released sample workflow was inspected on main `5eabb25`. A sample-only 1.5 kg harvest saved and appeared in Recent harvests; a sample cost of R12.50 saved and reopened in Edit with 12.5 intact. The ledger wrongly displayed R13, so this branch switches it to the existing exact invoice formatter. Editing the same sample cost retained its amount and changed its description without adding a second row; View slip opened the prepared receipt with R12.50. Returning to Picked retained the 1.5 kg harvest. Preview verification must confirm the changed display and phone layout.

Corrections to the original specifications: the harvest and cost forms have no date picker and stamp the entry date; late entries belong to the entry month. The harvest list has no Edit action. The chart's kept amount is a subtraction, not a measured destination ledger. Neither guide claims otherwise. Optional receipt-photo persistence is supported in code; this walkthrough used no uploaded personal receipt and does not claim that an original-photo upload was tested.

The expense hero reuses the already-generated and inspected `docs/media/studies-illustrated-release/art/market-community/true-cost.jpg`, copied unchanged to `public/studies-guides/expense-record.jpg`. It is an illustration, not a farmer's evidence. The other guide reuses the existing harvest notebook illustration. Final preview/production results belong in the release ledger.

## Mapping companion — 21 September 2026

C02 is implemented at `/student/guides/mapping`: six English steps and a user-controlled animated schematic separate a place pin, a land boundary and growing beds. [Walkthrough evidence and release checks](mapping.md) record the sample save/reopen, duplicate-place prompt, parcel tracing, Undo and naming. Four of 14 companions now have readable implementations; ten remain to develop. Published through [PR466](https://github.com/rorymclark-prog/ImbewuField/pull/466); the preview walkthrough is recorded in mapping.md and the production release checks in issue35. Narration and filmed walkthroughs remain open.

## Sales companion — 21 September 2026

C07 is implemented at `/student/guides/sales`, published in PR471 and production checked, with release evidence in issue #35: six steps, a four-stage authored invoice/payment explanation and a part-payment decision exercise. It reuses the reviewed lifelike market illustration. It does not add part-payment bookkeeping to the app. Five of 14 companions now have readable implementations; nine remain. [Walkthrough and release evidence](sales.md) distinguish verified existing-invoice updates from unverified new-entry persistence. Narration and filmed walkthroughs remain open.


## Charts companion — 21 September 2026

C11 is implemented at `/student/guides/charts`: six English steps and a three-stage practice window explain periods, the running total, harvest remainders, plan benchmarks, area returns and source tracing. It reuses the reviewed homestead cost illustration. This brings readable implementations to six of 14; eight remain. [Source and walkthrough evidence](charts.md) records the released sample controls and distinguishes local checks from branch/production release checks in issue #35. Narration and filmed walkthroughs remain open.
