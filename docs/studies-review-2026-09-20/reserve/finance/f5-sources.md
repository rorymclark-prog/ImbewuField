# F5 sources, app evidence and limits

Reviewed 21 September 2026. All exercise amounts and days are original synthetic inputs, not regional prices or promised returns. The cases are deliberately simplified management-learning models. No tax, fees, real customers, lending recommendations or legal collection conclusions are supplied.

## Primary references

- [FAO: Training manual for village cooperative societies, section 6.2](https://www.fao.org/4/t1675e/t1675e06.htm). Supports retaining source documents and keeping identifiable cash, sales and credit records. We use the evidence-trail principle, not its historic worked examples or local procedures. **Source correction:** the section 6.1.3 expression “Assets - Liabilities = Profit or Loss” must not be taught: assets less liabilities gives equity/net assets at that date, not period profit. No F5 exercise uses that equation.
- [FAO: Record keeping](https://www.fao.org/4/w6864e/w6864e0f.htm). Supports separate production, sales, financial and amounts-owed records. The manuscript supplies original exercises; it does not reproduce the source's tables or historic values.
- [IFRS Foundation: IFRS 15 overview](https://www.ifrs.org/issued-standards/list-of-standards/ifrs-15-revenue-from-contracts-with-customers/). Supports the distinction between receiving money and earning revenue through fulfilling a customer promise. F5 assumes a completed agreed delivery for each invoice case. This is not a declaration that every learner must apply IFRS 15, or a complete treatment of revenue, deposits, returns or tax.

Sources inform principles; the detailed arithmetic is independently derived from `f5-practice.json`. Contract, bookkeeping, VAT, dispute and refund treatment must be reviewed against the actual circumstances and current South African guidance before advanced publication. F7 holds compliance instruction; F5 does not claim that an app document is a compliant tax invoice.

## App inspection

Code baseline: main `3dd2e69950220dcc6a4857462cf4c38369efa20b`. Read `components/MyRecords.tsx`, `app/records/page.tsx`, `app/invoice/page.tsx`, `lib/invoice-entry.ts`, `lib/sale-invoice.ts`, `lib/invoices.ts` and `lib/sample-mode.ts`.

Production sample-tour checks on 21 September:

- Sold exposed New sale & invoice, Past sale / paper invoice and existing invoice links. The new-sale route resolves to Produce already sold after hydration; choose the source before filling details.
- Changing Invoice type or Existing sale record reset entered fields; the guide explicitly puts those choices first.
- A synthetic unpaid invoice #0106 for R25.00 produced “Invoice saved.” and an Unpaid review entry. It was absent after later navigation during the walkthrough. Persistence for this new sample entry was therefore **not established**. No claim is made about the cause; full sample reloads reset its in-memory records by design.
- A subsequent prepared sample invoice #0043, R50.00, was changed from Unpaid to Paid using the exercise's full-payment condition. The UI showed “Invoice saved.” and Saved remained at 69. Sold contained exactly one View invoice 43 link. That link reopened the same #0043, R50.00, 2.5 kg line and Paid status with the selected receipt date/method. This verifies updating and following an existing sample invoice, not new-entry persistence or real cloud sync.
- All interactions used the existing sample tour and synthetic/prepared data. No real payment, customer message, tax submission, PDF send or private receipt upload occurred.

C07 uses these observed labels and preserves source constraints: paid-in-full/unpaid only; separate part-payment schedule; paid kilogram evidence versus other units; device-local invoice documents; save/sync messages; copies are not new sales. `lib/finance-series.ts` also confirms that the whole paid invoice is placed on its single `paidAt` date. The guide therefore preserves each instalment date in the separate supporting record rather than promising a complete instalment cash timeline in Charts. It adds no partial-payment backend and makes no full-profit or tax-compliance claim.

## Media

`public/studies-guides/record-sale.jpg` is an unchanged copy of the previously generated `docs/media/studies-illustrated-release/art/market-community/know-the-customer.jpg`. Visually inspected: warm, lifelike South African rural market scene consistent with Rory's reference. It is a contextual illustration, never evidence of a real transaction. The old flat cartoon alternative was not used.

The payment explainer uses authored labels, totals and four states from P01. It animates a received/owed bar, never fabricated bank UI or financial text inside generated footage. Its displayed order, invoice and receipt references remain linked. Full animation/UI inspection is recorded in `../app-companions/sales.md` before release.

## Verification and remaining review

`verify-f5.py` derives 18 document-event balances using integer cents and exact fractions. It checks the printed answer rows, mixed-unit invoice and independent answers, and rejects 12 deliberate faults including duplicated receipts, advance allocation counted as fresh cash, arbitrary dispute write-off and overpayment counted as revenue. These checks cover arithmetic and stated model invariants, not legal rights or all real-world accounting cases.

Local bookkeeping review, learner trial, fluent isiZulu, narration, filmed app walkthrough and course integration remain open. The reserve manuscript and workbook must not be described as a published or accredited finance course.
