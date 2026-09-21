# Connected finance project — source and review record

21 September 2026. These are original synthetic classroom cases, not actual farm records, market prices, yield expectations, recommended spacings or financial advice. All dates and numerical inputs are explicitly invented and supplied in `lib/course-finance-project.json`, the authority for the rendered source cards. The source file includes separately authored worked answers. No existing farming species, lesson bodies or real geometry were changed.

## Teaching basis

Primary references re-opened on 21 September 2026:

- FAO, [Record keeping](https://www.fao.org/4/w6864e/w6864e0f.htm): separate linked production, sales, cash and amounts-owed records; preserve references and distinguish invoice from payment dates. Do not import its historical examples or its imprecise historical statement labels.
- Iowa State University Extension, [Your Farm Income Statement](https://www.extension.iastate.edu/agdm/wholefarm/html/c3-25.html), updated April 2025: income for a period differs from cash movement and may need noncash/period adjustments. US tax rules and worked examples are not used.

The course specification and F8 capstone require a mapped growing area, budget, dated cash forecast, harvest destinations, source-linked costs, invoice/payment reconciliation, comparison with another enterprise, an unknown cost and a plan-versus-actual review. This project supplies one connected source set per case rather than merging the unrelated opening positions in F1–F8.

## Case scope and intended evidence

Guided: opening R250; original two quoted payments R80/R210; assumed 30kg at R12. The forecast falls to -R40 before its assumed receipt and closes R320. Actual 38kg harvest: 26kg sold, 5kg household food, 1kg loss, 6kg counted stock. Sales R312; R200 received in March; R112 received only in April. Owner contributes R100, actual paid expenses R80/R230, household cash withdrawal R30. Actual closing cash R210, a -R110 difference from the original forecast. The bridge is +R100 owner funds, -R30 withdrawal, -R48 sales-quantity difference, -R112 collection timing and -R20 higher paid costs.

Independent: opening R320; original included payments R110/R260; 24kg at R15 assumed. Early gap -R50, closing R310. Actual 32kg harvest: 22kg sold, 4kg household, 2kg loss, 4kg stock. Sales R330; R250 received in May and R80 in June. R140 loan received, R110/R250 paid costs, R40 withdrawal. Actual closing R310 deliberately matches the original forecast despite different events. Bridge +R140 borrowing, -R40 withdrawal, -R30 quantity, -R80 timing, +R10 lower paid costs = zero. Loan terms/interest are not supplied, so no recommendation or claim of free borrowing is made.

Retry: opening R180; original payments R60/R160; 20kg at R18 assumed. Early gap -R40, closing R320. Actual 29kg harvest: 18kg sold, 5kg household, 2kg loss, 4kg stock. Sales R324; R200 received in July, R124 in August. Owner contributes R90; paid costs R60/R150; withdrawal R20. Actual closing R240. Bridge +R90 funds, -R20 withdrawal, -R36 quantity, -R124 timing, +R10 paid costs = -R80.

Each alternative basket-resale plan uses the same opening cash, different item units and incomplete market evidence. Its ten required owner hours exceed eight available. No answer asserts an enterprise is viable or recommends it solely from a higher closing cash forecast. Each original plan excludes earlier growing costs and other full-period evidence. The confirmed but unpaid water-delivery charge remains unknown. Full profit and full financial position cannot be established.

The 20m ×12m practice outline and 8m ×6m Plot A are imaginary references, not recommendations or an area-to-harvest model. No true location, access agreement or harvest forecast is inferred from the drawing. The case review covers one month, not an observed complete growing season.

## Assessment boundary

Nine numerical questions accept whole-input decimal-comma/point entries and compare exact cents/grams; invalid or blank inputs cannot pass. Five explanation prompts cover references, timing, units, funding, missing evidence and next action. A visible facilitator rubric records demonstrated / needs another attempt / not yet observed, with evidence and feedback. The software does not grade free text, award accreditation or turn reading ticks into passed assessments.

Answers can be saved on this device under separate case and account/guest/sample keys. This does not submit them to a mentor or write farm records. A corrupt stored draft is preserved, with saving disabled to avoid overwriting an unreadable copy. Printing remains available. Human practitioner, learner and fluent isiZulu review remain open. This branch builds on draft PR486; neither draft is a completed, production-published finance course. Animations remain held.

## Verification

Focused tests reconcile every case and test 27 wrong numerical answers, 60 altered source cases and an unknown-cost-to-zero fault. Whole-number/decimal parsing and bounded draft restoration are tested. Typecheck, full suite (3,658 tests: 3,657 pass, zero fail, one existing TODO), whitespace and release-note checks passed. Production build passed. Browser checks on the local production build confirmed that a wrong unpaid-balance answer produced 8/9 with corrective feedback, the correction produced 9/9, save/reload restored answers, and a different case started blank. Desktop and 390px phone layouts were inspected; the phone document did not overflow. Print CSS preserved the synthetic-case notice and expanded written answers, but actual PDF pagination and physical printing remain visually unverified. Hosted deployment verification is still pending. These checks do not substitute for practitioner, learner or translation review.
