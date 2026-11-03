# Grower proposal review assembly

`lib/international/grower-workflow.ts` supplies a pure, read-only review assembler.
It calls the existing harvest-demand adapter, cycle projector and auto-plan engine;
it does not read storage, fetch data, append plantings, accept proposals or approve
a country. A result remains an estimate from unverified grower assumptions.

## Controller boundary

`assembleGrowerWorkflowReview({scope,source,book,draft,recordedAt})` requires the
current mapped scope, a ready `GrowerWorkflowSource` from the shared saved-source
authority, the **whole canonical crop book**, explicit unsaved controls, and one
canonical UTC review timestamp captured by the controller. Reuse that timestamp
for every recheck. The assembler never calls a clock or changes original input
provenance dates.

`GrowerWorkflowDraft` contains blank-until-entered `planningStart`,
`planningEndExclusive`, `maxAssessments` strings; prioritized `targetProfiles`
entries `{targetId,profileId}`; `available` entries
`{bedId,start,endExclusive,confirmed}`; and `assumptionsConfirmed`.
There is no default profile, free-land window, saleable share or pack weight.

The source's exact `resourceSiteId` binds existing targets to their canonical
namespace. A cloud design's `design:<id>` target is not relabelled as coordinates.
Profile scope and geometry still use the verified source's exact mapped identity.
Selected target/profile duplicates are counted over their entire source lists;
an invalid selected target holds assembly rather than being skipped.

## Occupancy and source claims

Planting IDs are counted over the entire book before any scope/bed partition.
Duplicate IDs, including corrupt or foreign duplicates, hold review. Every valid
current own cycle contributes its full half-open field-entry-to-next-entry
reservation, including turnaround, whether or not its bed is checked as available.
Overlapping or otherwise held current rows block that bed. Valid legacy rows on
current beds also block availability because their exact occupancy is unassessed.
A free-land checkbox cannot override these records.

A well-shaped legacy row with a different bed ID remains preserved and unassessed.
A tagged foreign row is excluded only after the shared resolver proves intact row
identity up to the missing-current-context boundary, its normalized attachment
has an explicit different scope, and its bed ID is absent from **all** current
eligible/held source beds. This does not validate foreign current geometry.
Malformed foreign claims and unknown row associations hold the entire review.

Saved-design area claims are copied at review time with a reference identifying
explicit saved dimensions/calibrated geometry, not independent field verification.
Source-held beds cannot become eligible through draft controls. Unchecked windows
are omitted; checked blank/invalid windows hold. No availability means no capacity,
never an inferred horizon-wide free interval.

## Results and limits

`GrowerWorkflowReview` is `held` with plain issue codes, or `review` with the actual
`request` and actual engine `proposal`. Both expose `blockedBeds`,
`existingOwnCycles`, `targetMetadata` and `issues`. Reaching `review` does not imply
engine readiness: the proposal may be held for inputs/software limits or show
capacity gaps. `targetMetadata` preserves buyer aggregate, gross capacity needed,
days and explicit saleable share separately. It never supplies weekly production,
revenue, observed stock or a delivery promise. Existing reservations constrain land;
they do not silently count as completed buyer deliveries.

Requests/results are detached and frozen without freezing the caller's book or
controls. The controller must retain them privately, re-read and compare the actual
owner/sample/source/book receipts after asynchronous work, and withhold stale
results. Source-revision or unrelated book changes may require controller-level
invalidation even when arithmetic inputs are unchanged. Fingerprints and private
receipts must not be shown or logged. No acceptance/write callback belongs here.
