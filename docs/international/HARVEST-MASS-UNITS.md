# Harvest target mass entry: kilograms and pounds

`lib/mass-units.ts` is a closed pure kg/lb facade over the existing numeric entry
authority in `lib/length-units.ts`. Its canonical quantities remain kilograms.
The nursery entry engine is generalized internally into one canonical-unit draft
kernel; its public shapes, supported unit families, optional-area restrictions,
source checks and existing assertions remain unchanged. Field length remains
strictly `m | ft`; nursery dimensions remain `cm | in | m2 | ft2`.

## Source and arithmetic

NIST SP 811 [footnote 22](https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes)
gives the exact avoirdupois pound factor `4.535 923 7 E-01`: **1 lb = 0.45359237 kg**.
This differs from the rounded B.8/B.9 mass-table row `0.4535924 kg`.
The supplied coordinator-fetched primary body was independently checked against
its receipt: 96,781 bytes, SHA256
`20a953aad34582d88d50b099b9b3d4ed9d069787cbfe32b4220f965f21967bd5`,
fetched 3 November 2026. No new network fetch was performed by this lane.
Pounds multiply by the exact factor through the existing pure
`decimalQuantityProduct` authority, converting only the final decimal product to
a finite Number; kilogram display divides by the exact factor. The inverse is derived arithmetic. Finite binary floating-point arithmetic
still has representability limits; no decimal rounding is applied to canonical
values. Ounces, troy/force/fluid units, default pack weights, country inference and
agronomic constants are excluded.

## API and draft behavior

`MassUnit` is `kg | lb`. `massToKilograms`, `kilogramsToMass` and
`formatMassKilograms` reject unsupported units, nonfinite results, overflow and
nonzero conversion to zero. They reuse the existing representability guard and
nonzero-safe display formatter.

`createMassDraft({ sourceKey, unit, kilograms, optionalFields })` snapshots exact
canonical numbers. `originalKilograms` aliases its detached `originalCanonical`
snapshot; it is not another saved book. `editMassDraft` stages one conversion from
the explicitly entered unit. `readMassDraft` returns `ready` with `kilograms`, or
`held` with a bounded reason. `switchMassDraftUnit` formats the staged canonical
numbers, never reparsing rounded display. The facade shares the existing decimal
parser/stager and generic draft engine with nursery entry; no alternate grammar
or independently rounded formatter is added.

Required weekly mass may start blank. A pristine unentered blank can select a
unit before typing while Save remains held. Clearing an entered required mass,
incomplete text, unsupported/mixed units or a changed source holds the draft and
preserves its raw text/unit. Optional pack weight blank remains unknown
`undefined`, including after explicit clearing and unit switches. No weight is
borrowed from a crop or another pack. Dot or comma is an explicit decimal
separator, never grouping; ordinary signs/leading decimals are supported.
Suffixes, fractions, exponents, mixed separators and nonzero numeric underflow
are rejected by the same existing grammar/range checks.

The caller supplies an opaque source key from its actual editor/actor/site/source.
This helper neither authorizes a write nor certifies persistence. Numeric zero or
negative known mass remains numeric at entry; the existing
`sanitiseHarvestTargets` authority owns strictly positive weekly/known pack mass,
pack quantities, month range, saleable share and aggregate finite bounds. UI must
apply that existing validation before switching/applying invalid domain input.
Produce-pack counts/units, saleable percentages, dates and outlet text are not
converted or defaulted.

## Meaningful checks

Synthetic engineering fixtures compare actual sanitizer/JSON reload,
`targetDemand` inclusive UTC-month days, `growerDemandFromHarvestTarget` and
`generateGrowerAutoPlan` quantities for equivalent kg/lb inputs. Controls expose
rounded-table-factor drift and parsing a rounded display back into canonical
kilograms. Other cases distinguish unknown pack mass from known zero, retain
missing saleable share, test pristine/dirty required blanks, source/family/unit
and optional-field damage, overflow/underflow and immutable snapshots.

No plant, farming recommendation, lesson, storage schema or `PLAN_VERSION`
changes are included. Passing pure/calculation checks is not visual, translation,
observed-harvest, source-verification, delivery-curve or release approval.

Actual ordered lane validation: Node 24 typecheck exit 0 with empty output,
then **121/121 tests across eight files at concurrency 2**, no failures/skips/TODOs
(new mass drafts; unchanged field lengths, nursery drafts, harvest targets,
own-demand adapter, own auto-plan and nursery calculations), then whitespace
checks on all four complete owned files. The initial display-reparse negative
control used an exact ten-pound multiple and correctly did not show rounding;
its new synthetic fixture was corrected to an awkward canonical kilogram value,
retaining the assertion. No pre-existing test or assertion was edited.


## Capacity-boundary correction

An independent real-source probe found that raw binary `10 × 0.45359237` gave
`4.535923700000001`, while a separately entered decimal `4.5359237 kg` is the
physical equivalent. At a synthetic February capacity boundary, that extra ULP
changed actual-day demand from `18.7916839` to `18.791683900000002 kg`; the real
own-estimate auto-plan allocated two cycles/16 positions instead of one cycle/
eight positions. The existing nursery ceil authority likewise returned two
rather than one capacity unit. This is an executed engineering regression, not
an agronomic recommendation or a nursery recipe.

Forward pound conversion now reuses existing decimal quantity multiplication;
there is no epsilon, arbitrary rounding, tolerance or planner change. The
independent metric/lb regression uses the existing `ownRow` saved-source fixture,
actual `targetDemand`, own-demand adapter, auto-plan and nursery ceil authority.
Signed finite inputs and negative zero retain their declared numeric semantics;
positive-known validation still belongs to the harvest schema. New expected-
product fixtures now use independently stated decimal products instead of
mirroring the original binary multiplication error. The earlier 121-test result
is baseline evidence only; final checks follow this repair.

An explicit preserved-original negative control retains independently saved
`4.535923700000001 kg` exactly when its unchanged pound display reads `10`:
that distinct canonical input still needs two cycles/16 positions at the same
boundary. Only a new ten-pound entry is converted to `4.5359237 kg`. No existing
saved precision is migrated, rounded or silently repaired by toggling display.

Final post-correction ordered verification: Node 24 typecheck exit 0/empty log,
then **123/123 tests across the same eight files at concurrency 2**, no failures,
skips or TODOs, followed by whitespace checks on all four complete owned files.
The independent small after-probe also executed both February and December:
new ten-pound and literal metric entries each required one cycle/eight positions,
with nursery capacity ceil count one. The original probe and earlier runs remain
baseline evidence; no full suite, browser or release approval is claimed.
