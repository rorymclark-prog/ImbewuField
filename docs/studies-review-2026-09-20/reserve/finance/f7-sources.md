# F7 source notes and limits

Primary sources read 21 September 2026. All amounts, dates, document cards, exercises, explanations and illustrations of transactions are original teaching material. They are not prices, forecasts, tax rates, financial advice or actual business records.

- [IFRS Foundation: IAS 1 overview](https://www.ifrs.org/issued-standards/list-of-standards/ias-1-presentation-of-financial-statements/) supports distinguishing a position at a date from period performance and cash flows, and the fact that a complete set of statements requires more than these three simplified views. F7 does not claim IFRS compliance or prescribe which reporting framework a South African smallholder must apply. Current applicable standards and transition requirements require separate professional assessment; the exercise's January 2027 dates imply no choice of standard.
- [FAO: Record keeping](https://www.fao.org/4/w6864e/w6864e0f.htm) supports linked financial, sales, production, stock and amounts-owed records. We use the evidence-trail idea, not its old worked figures or simplified descriptions of profit, liabilities and owner pay. The new case reconciles explicitly and distinguishes equity from liabilities.
- [SARS: Starting a business and tax](https://www.sars.gov.za/businesses-and-employers/small-businesses-taxpayers/starting-a-business-and-tax/) is the starting point for questions about business form and tax responsibilities. The course does not determine a learner's status or registration requirements.
- [SARS: Record keeping](https://www.sars.gov.za/client-segments/record-keeping/) supports checking applicable duties, keeping orderly and safe evidence, and checking electronic-record requirements. Its retention table is not reproduced. No universal destruction period is taught; exact duties and continuing obligations must be checked against current applicable law and circumstances with suitable help.
- [SARS: Tax invoices](https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/) supports checking the relevant invoice requirements rather than assuming an app field proves compliance. The course does not reproduce thresholds, rates, deadlines or a purported exhaustive compliance checklist.

## Exercise boundary

The case is a market stall buying finished goods for resale. It does not account for biological assets, home-grown harvests, land, grants, manufacturing or whole-farm production. Opening values, delivered sales, costs of goods supplied, equipment qualification, the period depreciation charge, service timing and a reviewed stock loss are supplied assumptions. No useful life, depreciation rate, tax allowance, inventory policy or market value is inferred. The original complete case is sufficient only for its stated model; it cannot establish a real business's full profit or accounts.

Amounts use integer cents. `verify-f7.py` reconciles the transaction sequence, then separately checks closing balances by source category and checks the manuscript's answer rows. The accounting equation alone cannot detect all misclassifications. Nineteen deliberate faults exercise duplicate sources, wrong-period cash, duplicate sales, borrowing treated as revenue, omitted accrual/depreciation, wrong equipment and prepayment balances, and missing values made numeric. The missing-stock case retains supported balances but withholds the complete result and position.

The source dates for A01 deliberately differ: work on 28 January, invoice on 2 February. The supplied work record supports its January recognition. F01 is wholly for February, so it remains a prepayment in this exercise. X01 is outside January receipts. Neither exercise is a substitute for reviewing real contract terms.

## App and media boundary

Source-code baseline `a6ef09af4d561d83771d3a11dec7419a681fadd4`. The current app guides and My Records can explain supported records; they do not supply this stock valuation, equipment schedule, accrued expense ledger, complete statement of position or tax computation. Hypothetical entries stay in the workbook. Invoice payment status cannot represent a full instalment ledger. A guide to Charts must state the periods and evidence actually shown by each component.

The hero reuses `docs/media/studies-illustrated-release/art/market-community/true-cost.jpg`, viewed in full: a lifelike woman reviewing costs with a notebook and calculator in a warm South African homestead garden. It is context illustration, not evidence about the resale exercise or a photographed learner's finances. All numeric labels are authored from verified source cards. No Flow credits are used to generate accounting figures or imaginary app screens.

Bookkeeping review, practical learner trial, fluent isiZulu, narration and integration remain open. Visual/interaction evidence belongs in `f7-review.json`; do not describe the reserve artifacts as published or accredited lessons.
