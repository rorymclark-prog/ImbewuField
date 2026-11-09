# Grower-cycle nursery review

`lib/international/grower-nursery.ts` adapts current own-cycle arithmetic to the
existing scoped nursery equipment and propagation recipes. It neither accepts a
proposal into the crop-plan book nor records an observed sowing. Catalogue
country approval is independent: crop identities and display names are reused,
but catalogue establishment methods, timings, spacing, seed rates and yields do
not supply missing inputs here.

## Current source and resource identity

`buildGrowerNurseryForecast` accepts either:

- `source.kind: 'proposal'`, with an actual automatic proposal and its current
  request. It checks `isGrowerAutoPlanCurrent`, then regenerates the engine output
  and uses those real cycle assessments. Proposed batches have no planting IDs
  and no invented acceptance timestamp.
- `source.kind: 'saved-cycles'`, with canonical rows and current cycle context.
  `projectGrowerCycles` supplies validated own intervals and target positions.
  Held markers and legacy competing work make resource clearance unknown.

Both require the ready `resourceContext` returned from the saved workflow source.
The shared `growerWorkflowResourceSiteId` owns the equipment namespace. A mapped
cloud design may use its design resource namespace while the crop scope remains
the mapped site. Scope, measured bed identities/areas and geometry fingerprint
must match the cycle source. This is caller-supplied current-source binding, not
authentication of an arbitrary imported DTO. The coordinator must reload the
actual source before a consequential action.

Proposals additionally carry controller-derived `competingDemand` from the fresh
whole-book workflow review. Only `assessed-none` clears that particular source
gap; missing metadata and `unresolved` keep nursery headroom unknown even when
the user confirms an empty physical other-use list. Known unresolved legacy or
held work is not waived by a free-space checkbox. Geometry-only held beds do not
by themselves invent competing work. This context is included in the fingerprint;
the parent must recheck the actual current book and diagnostics before delivery.

## Explicit inputs and unknowns

The request includes canonical nursery settings, a provenance-backed
`settingsReview` matching `nurserySettingsFingerprint`, a dated review horizon,
dated gross resource availability, and separately declared other resource uses.
Provided empty other-use lists are deliberate assertions; missing lists remain
unknown. Known proposal field reservations additionally require their complete,
unique IDs in `accountedFieldReservations`, acknowledging that their competing
nursery uses have been considered in availability/other uses. That acknowledgement
does not override held or legacy work.

Each transplant cycle remains a separate raising batch. The adapter uses the
shared assessment's final positions and exact half-open UTC interval
`[nurseryStartDate, fieldEntryDate)`. Direct cycles have no nursery batch. A recipe
duration conflict is visible and never moves the own field-entry date.

- Starts require explicit positive field survival. Missing and zero survival
  produce different issues; neither becomes an implicit success rate.
- Seed-cell recipes explicitly mean one seed per cell and one successful cell
  per transplant. Germination and nursery survival are each applied once, then
  positive recorded cells determine tray demand.
- Measured-output recipes use usable starts per tray, already inclusive of
  nursery losses. Those losses are not applied again. Seed demand requires a
  separate seeds-per-tray input; zero is retained as zero.
- Tray area requires both recorded physical dimensions. Unassigned containers or
  spaces remain unknown. Footprint arithmetic does not prove packing, clearance,
  paths, hardening or up-potting capacity.
- A zero target produces zero raising work. Positive demand over an empty nursery
  interval is unresolved; no day is invented to make it fit.

Neutral `nurseryCeilRatio` and `nurseryPeak` are exported from the existing
forecast module so both pathways share exact decimal ceiling and half-open
release-before-reserve arithmetic. Peak event sums and shortages reuse the
existing `farm-records` decimal accumulator, subtracting capacity before number
conversion. Thus 0.1 + 0.2 does not invent an excess over 0.3; a genuinely entered
tiny excess is retained without an epsilon. Footprint and tray-area products use
the same decimal authority with a single final number conversion, so three
0.1 m² trays do not invent demand above 0.3 m². Overflow or positive underflow
becomes unknown. Input, horizon and
interval-work ceilings are software limits, not agricultural recommendations.

## Capacity review

Availability is dated, scoped, nonoverlapping gross allocation per resource.
Known allocation cannot exceed recorded owned stock or usable surface. Other
uses are subtracted through simultaneous demand exactly once. Every allocation,
other-use and batch boundary is considered before projecting weekly views.
Unknown stock, availability gaps, unassigned demand, incomplete recipes, stale
settings review, source gaps and held competing work prevent a spare-capacity
claim. A known positive shortage remains visible as a lower bound even when the
rest of the budget is incomplete.

Completeness is specific to the resource: a measured-output recipe can have known
tray and surface requirements while seed purchases remain unknown. Its overall
result remains `partial`, but those complete assigned-resource budgets may be
within budget. A missing footprint holds surface clearance and overall headroom
while retaining an independently known tray budget. Source, timing and competing
work holds still apply to every affected budget. `headroom` describes the named
tray and growing-surface allocations, not seed availability or readiness to plant.

Canonical `NurserySettings` now preserves optional cell counts and measured
output zero. Duplicate resource IDs or same-site crop recipes reject every
ambiguous member, rather than choosing a winner. Serialisable `sourceIssues`
survive canonical save/load so a later review cannot mistake a sanitised empty
resource list for a verified budget. Optional `heldInputs` in the same settings
book retains detached JSON-safe original conflicting rows, including row order,
identical duplicate occurrences, foreign namespaces and extra source metadata.
They never supply usable stock, surface or recipes. Malformed/non-JSON claims
become durable unreadable sentinels without invoking getters or storing functions.
Repeated sanitisation retains these groups, and an ordinary edit elsewhere in the
crop book cannot erase the inventory evidence. Their presence itself requires
review even if a caller omits the earlier issue strings. No recovery or automatic
clearance is inferred. CSV includes only reviewed derived quantities and generic
issues, never these raw claims or private source identities.

The legacy catalogue forecast retains its
existing valid rates and calendar behavior; missing/zero divisors now remain
unknown instead of dividing by zero.

## Result and export boundary

The result exposes exact `batches`, dated `resources`, source status (`proposed`
or `saved-planned`), issues, and overall `headroom`. `ready` means the arithmetic
inputs are complete, not that the proposal is agronomically approved or that
stock has been observed. A complete budget may still report a shortage.

The full detached normalised snapshot and its fingerprint are frozen; caller
editors are neither mutated nor frozen. `isGrowerNurseryForecastCurrent` rebuilds
the current source and compares both the input snapshot and all derived reviewed
outputs before delivery. Keeping an input fingerprint while altering a tray count
or clearance cannot certify an export. The coordinator
must compare against freshly loaded current inputs after asynchronous work.

`forecast` is compatibility formatting for existing quantities/week views. Its
cohorts have no asserted readiness window. UI and exports must use own `batches`
for exact dates and the proposed/saved basis, and must not attach unconditional
catalogue nursery instructions. Resource budgets include declared other uses;
the overall own-batch peak is the own proposal's demand, not total live stock.

The runtime suite exercises real source inspection, automatic generation,
canonical own-cycle projection, propagation quantities, stale/ambiguous sources,
dated overlap, resource namespaces, unknowns/zeros, source mutation and forged
claimed proposal output. It does not establish agronomic suitability or a viewed
browser result.
