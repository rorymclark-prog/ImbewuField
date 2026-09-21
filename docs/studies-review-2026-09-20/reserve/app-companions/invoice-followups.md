# C09 and C10 — Past paperwork, payment review and sharing

Routes: `/student/guides/past-sales` and `/student/guides/payments`. Each has six English steps, source checks, three-choice feedback and an independent practice task. They reuse existing inspected homestead images and the shared printable guide. No animations added or changed. Narration, fluent isiZulu and learner review remain open.

## Current-source evidence

Baseline main `57d0419be2cbc6a77d15c62fe65ae6e849d31eea`.

- `lib/invoice-entry.ts`: real issue/payment dates, required original paper reference, exact existing-sale ownership/identity/amount/kg/date match. No fuzzy matching or invented conversions.
- `app/invoice/page.tsx`: changing entry type/record basis resets the form; past/paper forms require the existing-sale answer; selection locks linked-sale financials. Existing issued date is retained and read-only. `persist()` verifies the durable invoice and synchronises linked sales. Print and Share PDF persist before output; a cancelled share does not undo the save.
- `lib/invoice-sales.ts`: invoice-linked income and kilograms are reconciled; non-kg quantities remain in invoice units. No instalment ledger.
- `lib/invoice-document.ts`, `components/invoice/InvoiceDocument.tsx`, `lib/invoice-pdf.ts`: one document model for preview/Print/PDF.

## Actual sample walkthrough

Fresh production sample tab entered through `/tour` → Record the work and the sale → Try it now. No real records or money changed.

1. Selected paper-copy type and Yes — link the existing sale. Prepared sample had no eligible unlinked kilogram entries. Read the empty chooser and instruction to reopen existing invoices from Saved. The exact linking branch is source-checked, **not newly verified end-to-end** in this UI run.
2. Selected No — record it with this invoice, then entered a fictional paper source. Created sample #0106 during input investigation and #0107 for the completed exercise. Both explicitly marked fictional; nothing sent to a customer.
3. #0107: paper reference `PRACTICE-C09-20260919`, issued 19 September 2026, example buyer Neighbour, existing catalogue product Carrots, **2 bunches × R7.25 = R14.50**. Numbers are arbitrary arithmetic inputs, not farm-gate prices or crop advice. Unpaid, no due date. Save reported success; Saved increased from70 to71, and reopening preserved reference, date, unit and amount.
4. A browser automation fill changed the native date value without committing React state. Normal native date keyboard controls committed the date and the document preview immediately showed19September. This is **not reported as a reproduced app date defect**. The guide instructs checking the document preview before saving.
5. Reopened #0107 with Review payment. Changed the fictional record to paid21September2026, Cash. Saved successfully, remained #0107, Saved count remained71. Reopening retained issue19September and paid21September. Records → Sold showed **Neighbour ·2bunches ·Paid**, **+R14.50**,21September and the same View invoice107 link; no conversion to kilograms. This is an in-memory sample exercise, not a real payment.
6. Share PDF was clicked once. Browser download observation timed out; no corresponding file appeared in Downloads. The app still reported Invoice saved without a PDF error. **Actual share-sheet/download delivery is unverified**; no recipient was selected and no message sent. Do not claim export success from the button press.

## Defect found and corrected

The actual paid invoice preview still labelled R14.50 **Total due** beside a Paid stamp. Both HTML/Print and PDF hardcoded that heading. The shared document model now supplies `totalHeading`: Invoice total for paid, Total due for unpaid. Amounts, payment state, dates, bank details and stored records are unchanged. A regression checks paid/unpaid wording, unchanged invoice value and retained paid stamp; existing renderer coverage requires both outputs to read every document field.

Used the actual PDF renderer directly with the same fictional date/reference/amount and a simplified sample letterhead. Paid and unpaid one-page PDFs were rendered with Poppler and both PNGs inspected: correct headings, amount R14.50, original reference/date, paid stamp only when paid, no clipping or overlap. This verifies PDF output from the renderer, **not browser download delivery**. Probe and rendered copies preserved in the external invoice-followups checkpoint.

## Release checks

Typecheck, full suite (3642 passed / 0 failed / 1 existing TODO), whitespace and release-note gate passed. Preview phone/desktop, both guides' feedback, paid/unpaid live preview, exact-head CI and production verification follow in the release ledger. No PLAN_VERSION, geometry, species, live lesson body, animation or course progress changes.
