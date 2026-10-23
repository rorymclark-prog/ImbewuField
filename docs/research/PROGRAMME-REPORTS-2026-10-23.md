# Funder and organisation reports: evidence and design decisions

Research checked 23 October 2026. Scope: the shared Reports tab on `/funder`
and `/ngo`, using the existing consent-projected network portfolio. No paid AI
calls, new farmer data collection, private-record access or agronomic changes.

## Audience needs

A funding review needs a concise answer to what was delivered, whose records
support the answer, what remains uncertain and what decision follows. The
implementing team additionally needs a way to find incomplete reporting and
support work. Both need an export whose scope matches the preview. Neither is
served by an impressive total without a denominator or an unsupported impact
claim. This is a product interpretation of the sources below, not a claim that
a particular donor mandates this format.

## Primary-source research

1. [OECD evaluation criteria](https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness/evaluation-criteria.html).
   The six criteria offer complementary questions about an intervention.
   OECD explicitly says their use should fit the purpose and context. We use
   this to distinguish delivery evidence, evidence gaps and review questions;
   we do not generate a score or claim an evaluation was performed.
2. [OECD: Applying Evaluation Criteria Thoughtfully](https://www.oecd.org/en/publications/applying-evaluation-criteria-thoughtfully_543e84ed-en/full-report/understanding-the-six-criteria-definitions-elements-for-analysis-and-key-challenges_2843ff7d.html).
   Output/outcome achievement and higher-level effects are distinct. The
   report therefore does not promote logged kilograms or module completion
   into improved food security, nutrition or household income.
3. [FAO: Tool for Agroecology Performance Evaluation](https://www.fao.org/family-farming/detail/en/c/1618512/).
   FAO describes farm-level evidence across environmental, social and
   economic dimensions, with diagnostics over time and producer participation.
   This supports explicit source/method statements and makes clear why one
   production total cannot stand for agroecological performance. The app has
   not collected a complete TAPE assessment; no TAPE score is manufactured.
4. [South African DSD: NPO obligations](https://www.dsd.gov.za/index.php/16-obligations).
   DSD lists narrative reports, financial statements and the accounting
   officer's report among the annual reporting documents. The app's farmer
   ledgers do not supply organisation accounts or governance records. The
   report is programme review evidence, not a statutory annual return.
5. [IFC: impact investing](https://www.ifc.org/en/our-impact/impact-investing-at-ifc).
   IFC distinguishes public disclosure of its management alignment from
   independent verification. Similarly, readable app records are not audit
   assurance. No verification badge is derived from a complete data count.

## Existing implementation and boundaries

Current main already has ReportComposer and buildProgrammePdf, with branded
covers, screen/colour/ink modes, summaries and photographs. ProgrammeReports
previously generated a small collection of prose lines and an individual-farmer
bar chart. It used cumulative totals only and supplied the same broad reporting
count beside measures that can have different consent and data coverage.

The network response provides per-farmer cumulative metrics and separately a
server-aggregated organisation-wide monthly ledger. It does not provide dated
per-cohort raw ledgers. Therefore:

- Cumulative reports can filter a cohort using existing authorised rows.
- Month range reports use only the server's event-date monthly buckets.
- Selecting a cohort disables the organisation-wide month range, preventing
  totals from another population acquiring a cohort label.
- Learning, membership, coverage and follow-up remain current snapshots, even
  beside period-based ledger totals.
- Missing stays unavailable; a readable empty book can legitimately be zero.
- Per-measure coverage is shown; sales minus costs and ROI are not inferred
  from books that may describe different populations.
- The default export aggregates cohorts and omits names, IDs and coordinates.
  This does not replace the access controls already enforced on the server.

## Design decisions

Use the existing shared composer and report tokens rather than a second export
pipeline. Match the site report's forest cover, Newsreader/serif hierarchy,
numbered chapters, restrained gold detail and readable evidence captions.
Keep app workspace colours theme-aware and the PDF a legible paper document.

Three report choices: results/delivery, production/finances, learning/participation.
Show scope before the report. Use coverage and course distributions instead of
ranking individual farmers with different circumstances. Keep quantitative
results in tables with a definition and denominator; keep findings and possible
follow-up in distinct chapters. Both full and brief exports retain essential
scope and limitations. Tables repeat headings across PDF pages; a brief export
states how many rows were omitted.

## Remaining evidence needs

Baselines, agreed targets, follow-up observations and supporting evidence live in
Progress & milestones. They are not invented from network totals. Grant budgets,
disbursements, indirect reach, verified household changes and programme attribution
are not present in this report's source. Future combined reporting should reuse
the existing published milestone projection with explicit project/date scope.

## Review improvements found during implementation

The first rendered PDF exposed a currency value extending beyond its tile. Tile
values now fit their measured width, and label/detail lines determine row height.
The first layout also put result tables after lengthy narrative; tables now follow
the scope chapter, before review questions. They span the full report width on
screen and repeat their column headings after PDF page breaks.

The monthly series can report readable-book counts but cannot say how many
farmers contributed a known weight within a selected period. The report names
that limit rather than presenting those counts as weight completeness. Current
months are marked incomplete. All numbers use the app's deterministic formatting
helpers; browser locale differences cannot change a report's decimal convention.

The sample portfolio spans several cohorts, so its branding omits the single
garden mark used by the separate six-garden delivery example. The report provides
working return buttons to cohort records and Progress & milestones. Replacing an
organisation selection cannot briefly expose the previous organisation's report
while its replacement is loading. Ink preview defines paper colours locally so
an app theme cannot turn report text pale on white.

## Verification

- Node 24 typecheck and whitespace checks pass.
- Focused report, existing programme/session, PDF, type-floor and manifest checks:
  78 tests passed, including 13 new report regressions.
- Browser review: funder/organisation reports, 390 px phone width, desktop,
  month-range read-back, cohort reset, real PDF download, dark mode, paper ink
  preview, and the working organisation progress action. Sample data only.
- Rendered and inspected full funder, brief organisation, production ink and
  learning PDFs, plus an existing training-session PDF. Full reports have four
  pages on this sample; the brief has three. Page counts are observations, not
  requirements. Layout fixes included metric width/height, full-width tables,
  repeated table headings and compact clickable references.
- The canonical full suite and both CI jobs are tracked with the review branch.
  No production deployment or paid render is part of this verification.

The picture changes in programme report layouts. Saved farm geometry, farming
content and PLAN_VERSION are unchanged. The older shared session-report rule
against repetitive sample footers remains covered by its existing regression.
