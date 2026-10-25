# Role reports and MEL integration

Requested by Rory on 24 October 2026, after programme reports shipped in #1098.
Implementation order: farmer production and finances; mentor and facilitator;
then existing MEL evidence. The common composer, report tokens and PDF writer
remain the visual authority for every audience.

## Research and decisions

- [OECD evaluation criteria](https://www.oecd.org/en/topics/sub-issues/development-co-operation-evaluation-and-effectiveness/evaluation-criteria.html):
  select questions for the programme and its stakeholders; a universal dashboard
  cannot replace a donor agreement or evaluation design.
- [FAO farmer-field-school MEL toolkit](https://www.fao.org/family-farming/detail/en/c/1637407/):
  distinguish delivery, learning, application and outcomes. Bring findings back
  into support decisions. Reuse the app's session, visit and assessment records.
- [FAO TAPE](https://www.fao.org/agroecology/database/tools-tape/how-it-works/en):
  its ten core areas extend beyond production: tenure, productivity, income,
  added value, pesticide exposure, dietary diversity, women's empowerment,
  youth employment, biodiversity and soil health. This work is a crosswalk of
  available evidence, not a TAPE assessment or a new sustainability score.
- [GIIN agriculture benchmark](https://thegiin.org/benchmarks/agriculture/):
  farmer services, income change, sustainably managed land and decent work are
  separate indicators. Revenue alone cannot establish livelihood improvement.
- [FAO food-security measurement](https://www.fao.org/measuring-hunger/en):
  food access and consumption require their own measurement. The existing
  seven-day garden-food question is a reported behaviour, not a validated
  food-security or nutrition score.

## Data contracts

Farmer reports use the same period and cash-income authorities as Records.
Paid invoices replace linked sale rows once. Unpaid invoices remain separate.
Quantities retain their original units; bags, eggs and items never become kg.
The logs do not establish household consumption, donations, losses or opening
stock. A harvest-minus-sales residual must not acquire any of those labels.
Mapped area without matching crop-cycle dates cannot establish achieved yield
per area. Planned production and guide prices do not enter actuals.

Mentor reports use only their authorised field-team projection. Actions are at
their latest recorded status, even when visits have a period filter. Facilitator
reports distinguish unique participant IDs from attendances and recorded
feedback from demonstrated skills. Neither service counts nor certificates
prove livelihood impact.

MEL integration must reuse published/private projections and existing
small-group suppression. It may not join programme labels to cohort totals or
imply that different source populations are the same. Matched change needs the
same project, question/version, consenting participants and compatible stages.
Every comparison names its matched denominator and attrition. A missing source
is unavailable, not zero. Baselines, targets and dates remain as recorded.

## Verification plan

Exercise sample records in a real browser, including phone/desktop and dark mode.
Download and render full/brief/ink reports. Compare totals to the existing book,
and inspect table pagination, long values, empty/missing data and disclosure.
Regression cases cover invoice duplication, mixed units, cross-year seasons,
missing dates, permissions and unmatched or suppressed assessment evidence.
Run Node 24 typecheck, full tests and whitespace checks in the required order.

This changes report pictures only. PLAN_VERSION, saved geometry, species,
course content, rules and paid-render paths remain outside this work.

## Implemented review paths

- Records → Production & finance reports: current month, season or calendar
  year; separate production and cash reports, with full and brief editions.
- Mentor → Fieldwork → Field report: current assignments, selected visits,
  action status, practical observations and a full internal evidence appendix.
- Mentor/Organisation → Training register → Facilitator delivery report:
  saved sessions, repeat attendances, identified learners, guest attendances,
  feedback coverage and recorded follow-up. The record-owning account filter
  does not infer staff identity from a typed facilitator name.
- Organisation/Funder → Reports → MEL evidence: project indicators, dated
  observations, selected assessment findings and compatible matched change.
  Published comparisons require both assessments to be closed and shared.

Every route uses the existing report composer, forest/serif report design,
weighted tables and PDF writer. Cross-garden reports omit the global single
garden mark. The farmer report uses the farm identity instead of NGO branding.

## Runtime and export checks

Local sample checks exercised desktop and 390px phone layouts, light and dark
mode, full and ink-saving downloads, invalid facilitator dates, assessment
review navigation and newly published fictional training comparisons.
The training comparison contains 16 matched responses; the provisional project
midpoint comparison contains 12 matched skill responses and four unmatched
baseline answers. Missing numeric agricultural answers remain unavailable.
Named registers and private written feedback are absent from the facilitator
aggregate; funder MEL omits private ratings and internal action owners.

Browser-downloaded PDFs were rendered with Poppler and inspected visually.
Text-boundary checks found no words outside any page. Long evidence rows repeat
column headings, short caveats remain together and a measured chart regression
first failed when its final observation moved away from its heading.
The finance export includes all six ledger columns and counts local invoice
receipts once. Missing dates, quantities and possible duplicates remain visible
in brief exports. Future-dated entries retain the Records calendar basis and
appear in the monthly breakdown with an explicit date-check note.

## Scope still requiring programme decisions

This does not claim to cover every donor's indicator agreement. The full MEL
report includes a ten-area planning crosswalk and names the further measurement
needed for food security, empowerment, employment, tenure, pesticide exposure,
soil, biodiversity and programme cost-effectiveness. No new score is invented.
Farmer reports currently use the same current-period choices as the book; they
do not add a custom historical date picker. Report analysis remains in English;
isiZulu controls are explicitly labelled as unreviewed drafts.

Local runtime verification uses isolated fictional data. Authenticated live
Firestore/grant access is not available in the local environment. The new
published comparison route was reviewed for both-document publication and grant
checks; matched/suppressed/private data behaviour is covered by pure regression
cases. Final typecheck, complete suite, CI and hosted-preview results are recorded
in the pull request and coordination ledger when complete.
