# Field block length entry in metres or feet

`FieldBlocksPanel` offers an explicit Metres/Feet choice for bed length, bed width
and paths. The existing `FieldBlockConfig`, generated dimensions and planner
consumers remain in metres. No country, language or currency selects a unit.
The pure `length-units` authority owns international-foot conversion and decimal
draft handling; the panel supplies no second parser or conversion factor.

Untouched saved values retain their exact canonical numbers. Formatted display
text is never parsed back into those values on toggle, preview or Apply. A valid
user edit converts once at its explicitly displayed unit; later toggles format
that staged canonical value. Leading decimals and a single dot or comma decimal
separator are supported. Grouping marks, fractions, exponent forms and unit
suffixes are not accepted as dimensions. Incomplete/invalid entries retain their
text and current unit when a unit switch is refused. Direction uses the existing
separate signed-degree behavior. Bed/path limits and polygon fitting remain the
existing geometry engine's responsibility, not new agronomic recommendations.

Unit changes and rendering never call `onApply` or change saved geometry. Explicit
Apply supplies only canonical metres to the existing field-block engine. Open
mode still produces the actual polygon plot without synthetic beds. Shared
allocation, overlap and exclusion checks remain authoritative. A queued parent
rejection is displayed beside the form through `applyError`; a callback returning
does not establish a device/cloud save receipt or clear the entered dirty draft.
After a changed saved source, explicit Reload loads the source's current values.

## Draft and actor identity

The same `fieldBlockSourceKey` binds the panel and parent update. It compares the
actual site, field/config/polygon, calibrated frame and relevant footprints and
other field/exclusion polygons. Object property order, generic revision/time
counters, imagery and unrelated labels do not create a new measured source.
An identical-value parent clone preserves dirty entries. Explicit selection of a
different field loads its own settings, including defaults for an unconfigured
field. An external change to the same authorised dirty field withholds Apply and
retains the draft for explicit reload. Apply recomputes the live key and checks
its private editor/context binding synchronously, including retained callbacks.

Text, name and mode callbacks use guarded functional mutations, so legitimate
batched edits merge and an older callback cannot restore the previous field or
interpret old metre text as feet. Account/sample transitions revoke the captured
opaque context, including an A → B → A return. The old instance withholds field
names, measurements, counts and site links, rather than merely disabling Save.
It must be reopened under the new context; Reload cannot grant an old instance
authority over its preceding private props. Dirty-draft preservation applies
within the same authorised context, not across accounts or demo sessions.

## Remembered interface choice

`length-unit-preference` stores only an explicit unit choice in its own
account-scoped interface-preference key. It imports no crop catalogue or demo
farm and changes no canonical geometry schema. Actual Firebase/mounted owner,
sample lifecycle, storage identity and cleanup bind private context proofs.
Sample choices stay in memory and reset with their sample context; they never
read or overwrite the real account preference. Malformed or missing preferences
default to metres without rewriting storage or inferring a region.

Server and initial client state start in metres. Private controls wait for
context checking. The saved preference is read in an effect; if typing has
already begun, those entries keep their original unit. A committed explicit
unit selection may remember the interface choice, but quota/unavailable storage
leaves it working only in the current panel and reports that it was not
remembered. Neither reading nor remembering the preference applies geometry.

## Verification limits

Mounted tests use the actual panel, pure draft API and geometry/planner engines,
with only navigation, authentication notifications and bounded storage controlled.
They exercise repeated toggles, exact canonical preservation, actual feet edits
through generated beds, a JSON roundtrip and actual canvas normalisation, the
existing planner-area bridge and real source inspection/fingerprinting, malformed input,
signed direction, allocated rebuild refusal, open fields, stale sources,
functional input merging, private-context withholding and preference failure.
Synthetic planner quantities and dates are engineering fixtures, not farming
advice. The existing bridge's area precision is preserved.
The feet-created and metric-equivalent layouts have the same generated IDs,
bed counts, path widths, rounded areas and geometry fingerprint; inspection binds
the exact saved source revision and leaves its bytes unchanged.

Browser access was disabled during implementation. Phone/desktop appearance,
real input keyboard behavior and account/browser release checks remain required.
This changes the picture; `PLAN_VERSION` is unchanged. No new runtime language,
fluent review, calibrated lesson, species or local crop-suitability claim is made.
