# Grower-entered household and trial demand

`growerDemandsFromEnteredEntries` prepares household-food and trial demands for
the same own-input automatic proposal engine that buyer targets use. It does not
create a buyer, a harvest target, a sale, a price or a delivery promise, and it
does not write anything.

Each entered row names a purpose (`household` or `trial`), an existing crop
identity, one saved growing-estimate profile for the current mapped site, a
gross harvest weight and an optional harvest window. The weight is the grower's
explicit gross cycle capacity in the engine's canonical `kg-total` unit, for the
whole window. It is not a nutrition or food-security sufficiency assessment and
not saleable output. A trial label is not agronomic evidence, a suitability or
safety finding, or an approval. Both meanings are carried in the input
provenance note and in review metadata (`buyer:'none'`,
`saleableOutput:'not-applicable'`, `nutritionSufficiency:'not-assessed'`,
`agronomicEvidence:'not-established'`, `sourceVerification:'not-verified'`).

Quantity text stays text until this adapter. Blank (`''`, whitespace) is
`missing/not-entered` and the engine reports it; `0` is a known zero that needs
no window and produces `zero-demand`. Signs, exponents, locale separators,
units, more than six decimals and values above `Number.MAX_SAFE_INTEGER` (a
numeric-representation guard, not a quantity policy) hold. Unit
and locale conversion stays a separate reviewed boundary. A partial, impossible
or reversed window holds; a blank window on a positive or unknown quantity is
passed to the engine as `not-entered`.

The profile must exist exactly once in the whole saved profile list, normalise
through the existing profile authority, share the review's mapped scope and
match the row's crop. Nothing is borrowed from the catalogue, a buyer target or
a country profile; incomplete own estimates are reported by the engine.

Rows are identified by `entryId`; the engine demand is
`grower-entered:<entryId>`. Duplicate entry IDs hold whichever comes first. Any
saved harvest-target identity (selected or not, damaged or duplicated) equal to
that namespaced demand holds as a collision. The whole ordered demand list is
bounded by `GROWER_DEMAND_SELECTION_MAX_ROWS`, which reuses the existing engine
ceiling `GROWER_AUTOPLAN_MAX_ASSESSMENTS`. These are software representation/work bounds, not farming recommendations.
Canonical kg-only entry is a bounded milestone:
no localized unit or decimal-separator conversion is offered.

`GrowerWorkflowDraft.demands` is additive. Absent, the legacy buyer-only
`targetProfiles` list keeps its exact meaning and output. Present, it is the only
priority list (`targetProfiles` must be empty), buyer rows convert through the
unchanged `growerDemandFromHarvestTarget`, and engine demand order equals list
order. A buyer-only ordered list yields a review identical to the legacy list.

Accepted cycles append through the existing canonical row path. Only buyer
demands set `harvestTargetId`; grower-entered cycles never do. A cycle whose
demand origin is not exactly one of buyer or entered holds. Saved own cycles
reserve their bed interval in every later review regardless of purpose, because
reservation comes from the cycle attachment, not the demand.

Unmapped workspaces remain held: the existing workflow gate requires a mapped
site, and the facilitator-local resource namespace `design:local` is shared
across local designs.

## Durable origin (second delta)

Accepted cycles record `growerCycle.origin`, an optional extension of the
version-1 attachment: `{kind:'buyer-target', harvestTargetId}` or
`{kind:'grower-entered', purpose:'household'|'trial', entryId, demandSnapshot?}`. It is derived
only from the acceptance coordinator's fresh replayed review and must match the
cycle's own `demandId`. Absent means a cycle saved before origins existed: its
origin is unknown and is never inferred as buyer, household or trial. Present
but null, undefined, unreadable, unknown, extra-keyed or inconsistent holds the
whole cycle. A grower-entered cycle may not carry `harvestTargetId`; a buyer
cycle may only name its own target. Projection (`origin`), saved nursery
batches (`origin`) and the saved-nursery controller view expose the recorded
origin; raw-marker copiers (book save/load, nursery snapshots, report
snapshots) preserve it unchanged. No second ledger, no version bump, no
rewrite of existing rows.

## Durable entered request

Newly accepted household and trial cycles also carry
`origin.demandSnapshot`: the complete canonical `GrowerAutoPlanDemand` from the
acceptance coordinator's fresh replay. It keeps the demand and saved-profile
identities, scope, gross `kg-total` input and inclusive-start/exclusive-end
harvest window, including each input's explicit `grower-estimate` provenance.
The copied `recordedAt` is the request's review time, not an observed harvest or
proof of the original entry time. Neither whole-bed allocated capacity nor the
cycle's picking dates substitutes for the requested weight or full window.

The existing engine input parser remains the authority for demand syntax,
units, dates and provenance. Snapshot parsing first detaches descriptors and
rejects any normalisation that would drop or alter recorded properties. A
saved cycle requires a positive provided demand, a provided harvest window,
matching demand/profile/scope identities and a window containing its whole
picking interval through the engine's shared containment rule. Present but
null, undefined, accessor-backed, lossy, unknown or inconsistent snapshots hold
the attachment. Canonical, sample, nursery and report marker copies retain
that held evidence.

Older absent origins remain unknown; older purpose-only origins remain valid
but their request input is explicitly `not-recorded` through
`growerCycleDemandSnapshotView`. No request is reconstructed from output.
Origin and snapshot views are detached, so a read cannot freeze or alias a
caller's editor.

The whole request is repeated on each accepted cycle serving that demand; it
is not another per-cycle quantity or a second ledger. Consumers must not sum
these repeated requested weights as independent demand or observed production.
This snapshot establishes traceable entered intent, not source authenticity,
actor permission, nutrition sufficiency, actual harvest or country approval.

The entry parser also holds a decimal whose numeric serialization would change its value, even below the whole-number software limit. It reuses the existing lossless JSON number authority and preserves supported leading/trailing zero syntax. This is a representation guard, not farming guidance.
