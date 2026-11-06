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
no window and produces `zero-demand`. The legacy `grossKg` branch keeps its
original rules: signs, exponents, locale separators,
units, more than six decimals and values above `Number.MAX_SAFE_INTEGER` (a
numeric-representation guard, not a quantity policy) hold. A partial, impossible
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
The additive `quantityEntry` branch is described below; the engine remains kg-only.

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
`{kind:'grower-entered', purpose:'household'|'trial', entryId, demandSnapshot?, quantityEntry?}`. It is derived
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

## Authored kg/lb entry

An editor row supplies exactly one weight property: legacy `grossKg: string`,
or `quantityEntry: {unit:'kg'|'lb', text:string}`. Both present hold even when
one is empty or explicitly undefined. The new entry reader rejects unknown
fields, malformed presence, accessors and non-enumerable properties without
evaluating getters. It detaches evidence rather than freezing the caller's form.
Both branches reuse the established 64-character entry work bound; there is no
new farming quantity ceiling. Canonical kg retain the existing nonnegative,
finite and `Number.MAX_SAFE_INTEGER` representation boundary.

`parseExactUnitDecimal` shares `parseLengthDecimal`'s plain-decimal grammar:
dot or comma is explicitly a decimal separator, never grouping. Numeric signs
are grammar; the entered-demand authority separately rejects negative weight.
No exponents are parsed. The exact wrapper normalizes insignificant spelling
for the existing `rawJsonIsLossless` guard before converting to Number. Negative
zero and decimal serialization loss hold. The original unit and untrimmed text
are retained unchanged, including supported padding and decimal separators.

`readMassQuantityEntry` keeps blank distinct from provided zero. Pounds use the
existing exact avoirdupois-pound constant in `mass-units.ts`; no country or
language selects or reinterprets a unit. `exactDecimalQuantityProduct` reuses
the existing coefficient multiplication and decimal comparison in
`farm-records.ts`. The exact coefficient product must equal the final Number's
declared decimal; overflow, nonzero underflow or changed decimal value hold.
This is not a binary floating-point exactness promise. Existing
`decimalQuantityProduct`, `massToKilograms`, mass drafts and their intentionally
rounded numeric behavior are unchanged. Converted canonical kg never pass
through the old six-place entry field or a rounded display string.

Review metadata includes `quantityEntry` from the submitted branch, so even a
different spelling or unit giving the same canonical kg requires fresh review.
New acceptance reparses the actual fresh replayed metadata and binds that
weight to its full canonical demand snapshot before copying both into the
existing origin. New legacy `grossKg` submissions can record their actual
`{unit:'kg', text:grossKg}`; this is submitted evidence, not reconstruction from
planned output. A saved `quantityEntry` requires a matching positive provided
canonical snapshot. Buyer origins reject this property. Malformed or mismatched
present evidence holds the whole cycle and existing raw-marker copies preserve
the hold through JSON, canonical, sample, nursery and report paths.

Older origin-only and snapshot-only rows remain valid and explicitly lack
recorded original unit/text. `growerCycleQuantityEntryView({origin})`, used after
attachment resolution, returns a detached recorded entry or `not-recorded`.
It cannot recover authorship from canonical kg or certify freshness or actor
permission. Existing attachment/source/geometry/occupancy/private replay and
save authorization gates remain necessary.

UI consumers must keep authored entry separate from `MassDraft` display state:
the shared unit switch reformats display text. Toggling a display cannot replace
authored input, mutate saved geometry or rows, accept a review or create a new
write permission. An actual edit uses the current entry unit/text and withdraws
the old review. Domain implementation alone is not proof of that UI behavior,
hook detachment, browser verification or runtime release.
