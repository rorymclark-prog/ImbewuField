# Canonical grower-cycle bridge (prerequisite only)

**Acceptance is NOT enabled.** Every task, calendar, report, PDF, nursery, food,
financial and occupancy consumer must become basis-aware before these rows are
written into the live crop-plan book. Existing country guards remain intact.

`grower-cycle.ts` defines one optional `Planting.growerCycle` attachment, not a
parallel persistent cycle ledger. It retains the immutable shared assessment
inputs/fingerprint, accepted timestamp, persistent planting ID, review-local
cycle ID, demand ID, bed ID and saved-source geometry fingerprint. Capacity and
dates are recomputed only by `assessGrowerPlanning`; no second derived schedule
is persisted. A cycle total is never a weekly delivery promise or actual stock.

`createGrowerCyclePlanting(cycle, {plantingId, acceptedAt, geometryFingerprint})`
is pure. The caller supplies a persistent identity because engine cycle IDs are
review-local ordinals. Creation checks shared assessment results and binds row
identity, whole-bed fraction and the compatibility `sowMonth`/`once` projection
to the own nursery-start date (transplants) or field-entry date (direct). It sets
no observed-sowing, nursery or finished legacy lifecycle flags.

`resolvePlantingBasis(row, currentContext)` returns `legacy` only with no own
marker. That classification grants no catalogue/country approval. A valid own
result requires exact current scope, one unambiguous measured bed, matching area
and the actual saved-source geometry fingerprint; equal area does not prove an
unmoved polygon. It returns recomputed own dates/capacity and the half-open field
reservation through next field entry, including turnaround. No annual recurrence
or actual establishment is inferred. Profile edits/deletion do not change the
accepted snapshot; changed cycle inputs or geometry need a new review.

Malformed/null/unknown-version own markers remain held, never legacy. Before
JSON storage or whitelist-based report copying, spread
`preserveGrowerCycleMarker(rawRow)` into the copied row. It retains serialisable
markers and substitutes a durable invalid marker for undefined/unserialisable
ones. Otherwise JSON would delete an undefined marker and silently restore the
catalogue path. Raw archived attachments can be retained while live derivation
is held. This bridge does not yet change loaders, settlement or report parsers.

The eventual acceptance coordinator must additionally recheck the current whole
proposal, source/book revision, unique IDs and reserved-interval conflicts before
its single canonical save. No country approval, source verification, sowing
observation, nursery losses, prices or currency follows from this arithmetic.
