# C12 — Export records and prepare the evidence

Route: `/student/guides/exports`. Six English steps, three-choice feedback and independent practice. Reuses the inspected homestead notebook/calculator illustration and shared printable guide. No animation changes.

## Source verification

Baseline main `0fb0f893f44c03ae5119096a827abaa5c369cc08`.

- `app/records/page.tsx`: wide FinancialSheet exports its selected month/season/year; compact Charts exports current month independently of the graphs. CSV fields are Date, Description, Qty, In, Source, Out, Check; receipt pictures and full invoice documents are not embedded. Paid invoice dates use paidAt, harvest logged_at, sales sold_at and costs spent_at. Existing duplicate heuristic warnings are exported, not silently removed.
- `lib/farm-metrics.ts`: month/year mean current calendar periods; seasons Sep–Nov, Dec–Feb, Mar–May, Jun–Aug. No custom historic date picker.
- `components/MyRecords.tsx`: Picked → Records for a lender → View summary and Export records for a lender. Preview uses the separate sample PDF entry point; real export retains its sample guard.
- `lib/credit-pack.ts`: monthly cash window is up to 12 months ending with current month, clipped to earliest dated ledger sale, paid invoice or expense. No rows before first dated cash record. A zero is a recorded-data total, not independent proof of no activity. Track-record dates can differ.
- `lib/credit-pack-pdf.ts`: cover dates, month table, cash summary, separate harvest/sales track record; sample identity is Example garden. It does not attach source receipts/invoices.
- `lib/file-delivery.ts`: device share sheet or download; cancellation is not evidence of a saved copy. The guide requires opening and inspecting the file.

## Actual released sample walkthrough

Entered fresh production `/tour` → stop4 → Try it now, using only prepared fictional records. Wide Charts showed Financial sheet month/season/year and Export. Selected year; observed updated totals after selection. Picked → View summary opened October2025–September2026 monthly rows. At390px, Charts offered Export CSV separately from the 12m charts. This release renames it Export this month (CSV) without changing the period logic. The wide period buttons gain aria-pressed.

The compact CSV button was exercised once. The browser download-event observer timed out, but the actual new file appeared in Downloads at10:16CEST. Parsed all39rows: headers match, dates2/8/12/13/21September, incomeR7,791.00 and costsR530.00, matching the displayed current-month figures. Dates omit the year; the guide now explicitly requires a full-period filename.

Picked → Export records for a lender produced `ImbewuField-Records-Tour-summary-2026-09-21.pdf` at10:17CEST. Rendered and inspected all four A4pages: cover/example identity, Oct2025–Sept2026 monthly table, cash summary and harvest/sales track record, no clipped text or overlap. PDF September income/costs match the CSV. The annual incomeR19,801.00, costsR8,175.00 and netR11,626.00 agree across pages. This establishes download delivery in this browser for both C12 exports; native phone share-sheet delivery remains untested. It does not retroactively establish the earlier invoice-PDF download.

No real entries changed, no recipient chosen, nothing sent. Actual sample copies and inspection evidence are in the external record-exports checkpoint.

## Acceptance

Verify six steps, loaded art, all feedback, phone width, keyboard response, related-guide/Records routes, and the changed export label. Run typecheck, full suite, whitespace and release-note gate; inspect exact-head preview before merge and production afterwards. Record results and deployment SHA in issue35. Narration, fluent isiZulu and learner review remain open.
