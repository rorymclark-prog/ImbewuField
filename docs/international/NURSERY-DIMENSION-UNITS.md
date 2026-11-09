# Nursery dimensions: canonical centimetres and square metres

`lib/length-units.ts` adds nursery-dimensional drafts to the existing pure length
entry authority. Field-block `LengthUnit` remains only `m | ft`, with its existing
conversion, source-binding and draft behavior. The shared plain-decimal parser,
finite/nonzero representability guard, staged entry and nonzero-safe display
formatter serve both surfaces. No account, storage, catalogue or geometry module
is imported by this authority.

## Exact sources and direction

Coordinator-fetched NIST SP 811 primary bodies were independently checked against
actual byte counts and SHA256 receipts on 3 November 2026. The bold table entries
are exact conversion factors in the stated direction:

- International inch → metre: `2.54 E-02`, or `0.0254 m`.
- Square foot → square metre: `9.290 304 E-02`, or `0.09290304 m²`.
- Inch → centimetre: `2.54 E+00`, also printed in the supplied tables. The same
  value follows explicitly from `0.0254 m × 100 cm/m = 2.54 cm`.

Sources: [NIST B.8](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8)
(body SHA256 `be7334086bcb574317dd1f78a7822adb699670b7f2bece6ca8a252884158eb5f`)
and [NIST B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
(body SHA256 `0197b5ee24ad88a42cabb9f58a2a08bbda25431dc9182c222e66c09390583396`).
These were supplied frozen coordinator fetches, not new requests by this lane.
Division for reverse display is derived arithmetic. JavaScript finite arithmetic
still has representational limits; exact factors do not imply arbitrary real
numbers can be represented exactly as binary floats. No survey unit, mass/ounce,
count, percentage, date, country inference or default equipment size is added.

## Public additive API

`NurseryDimensionUnit` is `cm | in | m2 | ft2`.
`nurseryDimensionToCanonical`, `canonicalToNurseryDimension` and
`formatNurseryDimension` convert/display tray lengths in canonical centimetres
and usable surface in canonical square metres. They reject unsupported units,
nonfinite values, overflow and nonzero values converted to zero.

`createNurseryDimensionDraft({ sourceKey, unit, values, optionalFields })` detaches
and freezes original canonical values. `editNurseryDimensionDraft` stages one
conversion from the explicitly entered unit. `readNurseryDimensionDraft` returns
`ready` with `values`, or `held` with a bounded reason.
`switchNurseryDimensionDraftUnit` changes presentation of staged canonical values;
it never reparses rounded display. The caller supplies an opaque source key bound
to the actual actor/sample/site/settings source. The pure helper is not an
authorisation or durable write receipt.

Unedited values and valid edited canonical values survive repeated toggles and
JSON save/reopen without display rounding becoming saved precision. Switching
between tray length and surface area, per-field mixed units, a changed source,
missing/extra fields or invalid/incomplete entry holds the original draft/text.
Dot or comma is an explicit decimal separator, never grouping; leading decimals
and ordinary signs share existing entry grammar. Suffixes, fractions, exponents
and mixed/grouping separators are rejected. Numeric nonzero underflow is held.

Optional tray blanks remain `undefined`/unknown even after editing or toggling.
Required surface blanks hold Save; explicit zero surface stays zero and negative
surface is held. A new untouched required blank permits choosing the display unit
before any number is entered, retaining blank and Save hold. Clearing an entered
required value is dirty/incomplete and cannot use that exception.

Positive tray sides and positive paired footprint remain the existing
`sanitiseNurserySettings`/nursery calculation contract. Numeric entry does not
replace that validation: the caller must block invalid tray switches/apply with
that existing authority. No new agronomic minimum or duplicate normalizer exists.
Counts, ownership, survival percentages and nursery calendar inputs are untouched.

## Verification boundary

The new suite uses synthetic equipment and engineering fixtures, not recommended
farm values. It compares actual `decimalQuantityProduct` footprints,
`nurserySettingsFingerprint` and `buildNurseryForecast` before/after conversion,
repeated toggles and JSON reload. A rounded-display negative control demonstrates
why displayed text cannot become canonical authority. Additional controls cover
unknown/zero, blank-first unit choice, dirty cleared blanks, invalid grammar,
range limits, mixed dimensions/units, stale sources and malformed drafts.

The existing field-length and nursery calculation suites remain unchanged.
This pure helper does not certify translated copy, browser presentation,
parent persistence or a release; those remain separate coordinator/owner gates.

Actual ordered checks for this lane: Node 24 typecheck exit 0 with an empty log,
then **94/94 tests across seven files**, with no failures, skips or TODOs (new
nursery units, existing field lengths, nursery planning/forecast/adversarial/
export and international grower nursery calculations), then whitespace checks
on all three complete owned files. No existing assertions or tests were changed.
