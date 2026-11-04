# Automatic grower-input crop-cycle proposals

`generateGrowerAutoPlan(request)` is pure, deterministic whole-bed/whole-plot
proposal generation. It calls the shared `assessGrowerPlanning` authority for all
capacity, required grower inputs and crop dates. It reads existing crop identity
only, never catalogue agronomy. No stored row, geometry, API, country permission
or paid feature is changed by this module.

## Explicit request

`GrowerAutoPlanRequest` contains:

- Exact `scope`, canonical UTC `requestedAt` and the actual selected saved source's
  opaque `geometryFingerprint`. Area alone cannot detect a moved polygon.
- Existing `profiles`, and `beds` wrappers `{bed:PlanBed,scope,measuredAreaM2}`.
  The sourced `GrowerInput<number,'m2'>` must exactly equal `bed.areaM2`.
- Sourced `planningStart`/`planningEndExclusive` (`utc-date`).
- Explicit `availability` assertions `{bedId,scope,window}` and known `reserved`
  intervals `{id,bedId,scope,window}`. An absent availability assertion never means
  the bed is free. The caller must bring known existing occupations, not omit them.
- Ordered buyer `demands`: `{demandId,profileId,scope,totalKg,harvestWindow}`.
  `totalKg` uses `kg-total`, not kilograms/week. A canonical harvest-target adapter
  must use its existing total-demand authority and retain conversion missingness.
- An explicit positive integer `maxAssessments` software budget, at most 10,000.

Windows use `GrowerInput<{start,endExclusive},'utc-date-window'>`, strict UTC dates
and the same provenance/missingness authority as grower profiles. They are half-open
and positive in length. All provenance is a grower-supplied claim, not an
authenticated record, verified publication or independently measured geometry.
Duplicate bed/profile/demand identities, foreign scope, unknown referenced sources,
bad units/provenance, unequal area and malformed supplied values hold the request.

## Search and capacity

Demands run in supplied priority order. Select the earliest feasible field-entry
date, then lexicographic bed ID for ties. Use the entire measured bed for one crop
cycle; do not assume fractions, row layout or pathways. Each selected cycle reserves
`[fieldEntryDate,nextFieldEntryDate)` before further cycles/targets are considered.
Reservations block overlaps; adjacent half-open intervals can touch. One complete
availability assertion must contain the cycle through field clearance **and**
turnaround; adjacent assertions are not silently combined into a longer one.

The grower's allowed entry months apply. Nursery start cannot precede planning
start. First harvest and the entire picking interval must fit the requested harvest
window. No within-cycle yield curve, weekly delivery, germination allowance,
weather adjustment, success guarantee or local-agronomy approval is inferred.
Zero yield, zero measured area or a stand estimate below one plant supplies no
useful cycle for positive demand. Provided zero demand creates no cycle and needs
no invented profile timings or harvest window. Unknown is never converted to zero.

Search jumps past reservations, early nursery/harvest boundaries and disallowed
calendar months. Requests are limited to 3,660 UTC days and an explicit work budget;
these are software limits, not growing advice. Input rows, visited availability
windows and shared assessments consume that budget. If it is exhausted, the
result is `work-limit-exceeded` with **no usable partial cycles**, not a claim that
the search proved capacity is absent. Missing required inputs similarly hold all
cycles. No default horizon or work budget is supplied.

## Result and freshness

Usable results are `ready` or `with-gaps`. `cycles` carry demand/profile/crop/bed
identity and the complete ready shared `assessment`, with its own input provenance,
capacity and exact UTC dates. Auto-selected dates are explicitly grower estimates,
not observations; `recordedAt` is the request's supplied `requestedAt`.
Cycle IDs are deterministic review-local ordinals, not persistent ledger IDs.

`demandResults` show requested total, estimated allocated total, unmet total,
excess estimated capacity and reasons for gaps. Whole-cycle excess is visible.
Held results (`missing-inputs`, `invalid-inputs`, `work-limit-exceeded`) expose no
cycles; unknown/unassessed allocated/unmet/excess quantities are null. Every result
states `basis:'grower-input-cycle-capacity'` and `sourceVerification:'not-verified'`.

Proposals and their normalized `snapshot` are detached and deeply frozen. Bed,
profile, availability and reservation order normalize canonically; demand priority
order remains significant. Each cycle binds the full request fingerprint and its
shared-assessment fingerprint. Changing assumptions, provenance, measured metrics,
saved-source geometry revision, demand, scope or availability invalidates the review.
`isGrowerAutoPlanCurrent(proposal,request)` regenerates against current inputs before
accept/export. Fingerprints include private source context: keep them in the
current account, not public logs or analytics. They are review identities, not
authentication or source-verification credentials.

Persistence and acceptance into canonical `Planting` records require coordinator
integration review; this module creates no parallel crop-cycle store.
