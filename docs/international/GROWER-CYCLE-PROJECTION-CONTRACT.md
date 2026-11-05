# Own-cycle projection (pure prerequisite)

`projectGrowerCycles(rows,currentContext)` reads canonical rows through
`resolvePlantingBasis`. Context must supply exact current scope, all current
measured beds and the actual saved-source geometry fingerprint. The existing
shared assessor remains the sole authority for own capacity and UTC dates.
This module writes no rows, enables no acceptance and changes no existing consumer.

The result partitions:

- `legacyRows`: required structural fields (`id`, `bedId`, existing `cropKey`,
  integer `sowMonth` 1–12) are present and the own marker is absent. These are
  pass-through records for existing **gated** consumers, labelled
  `legacy-unapproved`. Optional lifecycle semantics still belong to those consumers.
- `ownCycles`: live resolved, scope/area/geometry-matching own rows with recomputed
  assessments, exact planned events, total cycle kg and target final-stand count.
- `heldRows`: malformed/unknown own markers, invalid structural legacy rows,
  stale context and all rows involved in ambiguous IDs or own interval overlaps.
  Original row index/raw row and explicit reasons remain available.

Duplicate IDs across **all** input rows hold each involved row. Whole-bed own
reservations overlap on `[fieldEntryDate,nextFieldEntryDate)`; all affected own
cycles are held, while exact boundary adjacency is allowed. The result explicitly
states `reservationCoverage:'valid-own-cycles-only'` and
`legacyOccupancy:'not-assessed'`. It cannot certify free land or conflict-free
acceptance: legacy or other known occupations need the caller's separate checks.

Own events are `nursery-start` (only if the own method has a nursery phase),
`field-entry`, `first-pick`, `picking-end`, `field-clear` and `next-entry`.
All are **planned**, not observations, completed tasks or annual recurrences.
Picking-end and field-clear are exclusive boundaries. Next entry is the own
occupancy/turnaround boundary, not approval for a successor outside its entry window.
No monthly/weekly yield distribution, price, currency or actual stock is projected.
Provided zero quantities remain zero; unresolved values are never replaced with zero.

For an own transplant, `nurseryDemand` contains target final-stand `targetPositions`
and `[nurseryStartDate,fieldEntryDate)`. It applies no unentered germination or loss
factor. `seedQuantity`, `trayQuantity` and `spaceM2` are explicitly **null** because
own loss/container/space inputs are absent. A supplied zero-day nursery has an empty
known interval; it does not create positive occupancy. Direct establishment has
`nurseryDemand:null` because no nursery phase applies, even if the catalogue labels
the crop a transplant. Density remains an estimate, not bed/row layout clearance.

All derived own data is detached and frozen. Legacy/held raw rows pass through by
reference in frozen wrappers; projection does not freeze or alter caller-owned
saved records or geometry. These references are for review/preservation, not an
immutable acceptance revision. Re-project against current context at each use.
`sourceVerification:'not-verified'` preserves the grower-claim boundary throughout.
No country/catalogue approval, source authentication or tray/seed/space calculation
follows from this projection.
