# Funding and delivery — product specification

6 September 2026. Proposed extension; not a claim that the complete workflow is
implemented. Written for the concept note and subsequent implementation.

## Purpose

Connect the site assessment and approved drawings to a costed needs register,
funding allocations, delivery evidence and ongoing asset performance. A funder
should be able to see what their contribution supports, what is demonstrably
complete, and which additional needs are ready for another partner to fund.

## Existing code foundations

- `lib/report-boq.ts` derives quantities from saved design facts, maps supported
  catalogue items to the price book and marks absent rates/measurements explicitly.
  Items marked existing are excluded from new construction cost. These are
  planning estimates; a mapped object is not a verified installation.
- `lib/report-site-facts-collect.ts` gathers design and crop-plan facts.
- `lib/programme-evidence.ts` has baseline, target, unit, owner, due date,
  measurement method, dated observations and publication for programme milestones.
- Reports, branding, garden directories and organisation/funder access provide
  reusable entry points. Funding allocations, procurement records and verified
  asset lifecycle tracking are not yet connected to BOQ lines.

## Where it belongs

| View | Primary place | What the person can do |
| --- | --- | --- |
| Organisation | Funding & delivery | Review needs, cost and prioritise them, approve scope, allocate funding, manage delivery and publish selected evidence |
| Funder | Funding & delivery | Review authorised funded commitments, delivery, operational status, evidence and additional approved funding opportunities |
| Mentor | Assigned garden → Needs & visits | Propose a need, attach observations/photos, record delivery checks and flag maintenance; approval follows organisational permissions |
| Farmer | My garden → Improvements | See approved planned work, confirm receipt where appropriate and report damage or a need |

The same garden-level records feed the portfolio, map and report. Filter by
project, area/village, garden, intervention and funder. Existing Progress &
milestones links to these deliverables; Assessments & learning records the
observations and reasons for changes. Avoid separate totals maintained manually
in each dashboard.

## One need record, linked to its origin

Give each need a stable identifier and links to the site, assessment finding,
map object(s), drawing revision and related milestone. Store:

- Description/specification, unit, quantity and quantity basis: drawn, measured,
  proposed by assessor, or still awaiting confirmation.
- Existing usable stock, rehabilitation/replacement needs and additional quantity.
- Priority and reason; dependencies; who benefits; responsible person; target date.
- Scope: approved current project, proposed variation, future phase, or additional
  need outside the current budget. A wish-list item is not an approved obligation.
- Price, currency, quotation/source date, expiry, supplier, tax treatment, transport,
  installation/labour, commissioning, maintenance and explicitly approved contingency.
- Funding allocations and restrictions, confirmed commitments, received cash,
  in-kind support, expenditure and supporting documents as separate records.
- Delivery quantities, verification, operational checks and maintenance responsibility.

Assessments can propose missing infrastructure. AI can help extract or draft
needs, but cannot silently invent quantities, prices or engineering specifications.
Changes to a drawing propose a BOQ revision; they must not rewrite an approved
budget, signed commitment or historical report. Show the difference for review.

## Funding gaps and cash availability

Present the agreed project budget separately from the wider site development plan.
Also separate confirmed funding from expressions of interest and conditional pledges.

For each defined scope and date:

- Budget coverage gap: approved current forecast cost minus confirmed eligible
  funding allocated to that same scope, floored at zero.
- Remaining completion gap: forecast cost still required minus unspent confirmed
  funding available/committed to that remaining work, floored at zero.
- Cash availability is shown independently: a signed future commitment may close
  the funding gap while leaving a temporary cash shortfall.

Do not subtract both committed and received amounts for the same award. Do not
subtract expenditure twice. Allocate split funding to the same unique need, and
show excess/restricted funds rather than treating them as transferable by default.
Accepted in-kind supply reduces the relevant remaining quantity or cost once;
its disclosed valuation is not cash. Unpriced needs stay visible as “Quote needed”
and are excluded from a clearly labelled priced subtotal, not treated as zero.

Include complete packages: a rain tank may also need a base, gutters, connectors,
delivery, labour and maintenance. A solar pump needs appropriate design and
commissioning. A tree allocation may need protection, watering and replacement
provision. These are dependencies to assess, not automatically assumed quantities.

## Three independent statuses

| Dimension | Example states |
| --- | --- |
| Technical approval | Proposed; assessed; approved; deferred; rejected |
| Funding | Unpriced; unfunded; partly funded; fully funded; cancelled |
| Delivery | Not started; ordered; delivered; installed/planted; verified; operational; needs repair |

These must be independent: “funded” does not mean installed, and a donated asset
may be delivered without a cash payment. Record partial quantities. A supplier
invoice alone is not evidence of installation; an uploaded photograph alone does
not prove a system works. Use dated records, reviewer identity and relevant
commissioning/receipt evidence. AI sample media must never satisfy live verification.

## Tangible outputs and outcomes

| Intervention | Output/deliverable metrics | Follow-up outcome or functionality metrics |
| --- | --- | --- |
| Rainwater | New tanks installed and verified; added litres of storage capacity | Operational tanks; measured water use/collection where available; irrigation reliability |
| Solar | Systems commissioned; installed PV capacity in kWp; battery capacity in kWh separately | Metered energy in kWh, uptime and pump service where measured |
| Fruit trees | Trees planted and verified by planting cohort; existing trees reported separately | Survival at specified follow-up dates; bearing trees; actual recorded fruit harvest |
| Irrigation | Verified equipped area in m²/ha; system components | Functioning irrigated area and reliability at inspection |
| Training | Sessions and unique participants with attendance evidence | Learning change and practice adoption using defined follow-up instruments |

Store baseline, funded target, current actual, unit, period, method, evidence,
review status and owner for each indicator. Report existing assets separately
from assets added by this project. Replacements do not count as net new assets.
Tree survival uses a defined planted cohort as denominator; show assessed coverage
and unknown status rather than assuming unvisited trees are alive. Capacity is
not measured output: tank litres are not litres of water saved, and kWp is not
energy generated. No inferred carbon savings without an approved methodology.

Cofunded assets count once in portfolio totals; each funder can see the shared
contribution with attribution stated. Never sum “their” asset counts across
funders to inflate project totals. The timeline filters observations by date and
shows the latest observation date, outstanding checks and data coverage.

## Fundraising and reporting

Organisation staff can publish a selected **Funding opportunity** from approved,
costed needs: the problem, proposed package, site context, funding already secured,
remaining request, dependencies, expected outputs, timeframe and maintenance plan.
Prospective funders see a permission-controlled summary with an “Express interest”
route; interest is not a pledge or payment. Publishing and outreach remain explicit
organisation actions. Do not expose household details or precise private locations
by default, and do not contact potential funders automatically.

Reports should include an executive funding/delivery overview, costed BOQ,
funding-gap schedule, milestone and asset register, evidence references, financial
basis, missing data, risks, next actions and partner branding. A funding-opportunity
brief can be exported separately. Reports must carry reporting date, scope, design
and budget revision, and approval status. Preserve historical report snapshots.

## Delivery sequence and acceptance criteria

1. Stable BOQ/need IDs, source links and reviewed budget snapshots.
2. Funding allocation and gap register; organisation approval and funder visibility.
3. Delivery/asset evidence, verification and operational follow-up.
4. Reconciled dashboards/reports, then selective opportunity publication.

Acceptance scenarios include partial delivery, two funders sharing one tank,
in-kind trees, missing quotes, price increases, withdrawn commitments, tree deaths,
asset replacements, changed drawings, unauthorised access and historical reports.
Samples should cover these states and reset safely without live data writes.

## Concept-note paragraph

The proposed funding and delivery module will connect site assessments and garden
designs to a costed bill of quantities, showing approved work, secured support and
remaining funding needs. Implementing organisations will be able to prioritise
investments and present selected opportunities to additional funders. Delivery
tracking will link tangible outputs, such as installed water storage, commissioned
solar systems and planted trees, to dated evidence and follow-up checks. Funders
will be able to distinguish financial support, completed work and ongoing benefits.

## Sources and interpretation

- FAO: preparation of plans, cost estimates and tender documents, including BOQs
  prepared from drawings/specifications: https://www.fao.org/4/x5744e/x5744e08.htm
- GCF: results-based management and project/portfolio monitoring:
  https://www.greenclimate.fund/portfolio/results-based-management
- American Red Cross DMERL framework: linking outcomes to indicators and outputs
  to milestones: https://preparecenter.org/wp-content/uploads/2022/09/DMERL-Framework-American-Red-Cross-2022-version-2.0.pdf

The app structure and metric choices above are design recommendations informed
by these approaches, not certification, a construction specification or a claim
that this workflow has been deployed.
