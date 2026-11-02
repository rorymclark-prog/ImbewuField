# Saved buyer targets to own-cycle demand

`growerDemandFromHarvestTarget` prepares a single existing canonical harvest
target for the own-input automatic proposal engine. It does not edit that target,
accept a crop cycle, verify a source or promise weekly deliveries.

The caller explicitly selects a current mapped-site scope and a matching saved
estimate profile. Target site and crop identity must match; no nearest farm,
same-name crop or inferred profile is substituted. Unmapped target bindings are
held until their identity contract is implemented.

The existing `targetDemand` authority supplies aggregate kilograms from the
target's inclusive calendar months and actual day counts. Produce packs still
need the grower's weight per pack. For positive demand, an explicit existing
`marketablePercent` is required: missing is not 100%, and zero cannot satisfy
positive buyer demand. The engine receives gross cycle capacity required after
that allowance, separately labelled from the buyer's aggregate kilograms.
Overflow is held rather than becoming infinite capacity.

The original inclusive month interval becomes an exact half-open UTC harvest
window. Copy-time provenance explicitly says it is not the target's original
entry time, and no private outlet name is included. Source verification remains
`not-verified`. `deliveryDistribution:'not-established'` means the aggregate
cannot demonstrate each week's requested supply or a within-cycle picking curve.

This adapter prepares demand only. Profiles may still be incomplete; every
required own yield, density, method, date, availability and reservation input is
checked separately by the automatic engine. A ready demand does not establish a
ready crop plan, agricultural suitability, local permission, seed/tray quantities,
price or currency. Batch callers must reject duplicate target identities and
account for all existing reservations before reviewing or accepting a proposal.
