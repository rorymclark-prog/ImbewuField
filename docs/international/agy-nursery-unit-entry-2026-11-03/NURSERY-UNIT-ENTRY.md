# Nursery Tray Inches & Surface Square Feet Contract

## 1. Inspected Sources (`df8899f28ec5b07bf55c8c9fc68712da1ce9efad`)

- Repo-relative sources (bytes/SHA256 in `status.json`): `components/crops/NurseryPlanPanel.tsx`, `lib/nursery-settings.ts`, `lib/international/grower-nursery.ts`, `lib/length-units.ts`, `tests/international-nursery-equipment.test.ts`, `docs/international/agy-grower-unit-standards-2026-11-03/CONVERSION-FACTS.md`. Parent `onSettings` persistence/readback internals: `UNKNOWN`.

## 2. Conversion Boundary

- **Printed NIST SP 811 B.8/B.9 exact factors**: `1 in=2.54 E-02 m` (`0.0254 m`); `1 ft²=9.290 304 E-02 m²` (`0.09290304 m²`), distinct from acre/survey-mile.
- **Printed corroboration and derived arithmetic**: Supplied B.8/B.9 also print exact `1 in=2.54 cm`. This agrees with `0.0254 m×100 cm/m`; reverse `cm/2.54` and `m²/0.09290304` are derived arithmetic. Excludes mass/ounce and standard tray/crop constants.

## 3. Canonical Storage & Auto-Plan Facts

- `lib/nursery-settings.ts`: `NurserySpace` stores `usableM2>=0` (`0`=zero surface). `NurseryContainer` stores optional integers `cells>=0`, `owned>=0` (`0`=zero owned trays; `undefined`=unknown), and `widthCm>0`, `lengthCm>0` requiring `decimalQuantityProduct([widthCm,lengthCm,0.0001])>0` when paired; `sanitiseNurserySettings` preserves `sourceIssues`/`heldInputs`.
- `lib/international/grower-nursery.ts`: `buildGrowerNurseryForecast` checks `nurserySettingsFingerprint`, computes `trayFootprintM2=decimalQuantityProduct([widthCm,lengthCm,0.0001])` and `areaM2=decimalQuantityProduct([trays,trayFootprintM2])` in `batchFor`, flags `'container-footprint-missing'` when `targetPositions>0` lacks either dimension, and budgets containers (`owned??null`) and spaces (`usableM2`).

## 4. Proposed Pure Draft Authority (`lib/length-units.ts`)

- **Authority**: Extend `lib/length-units.ts` for tray (`'cm'|'in'`, `×2.54`/`÷2.54`) and area (`'m2'|'ft2'`, `×0.09290304`/`÷0.09290304`) drafts, reusing `parseLengthDecimal` and existing nonzero-safe paint formatting without rounding canonical math.
- **Unknown vs zero**: Optional `widthCm`/`lengthCm` map `""↔undefined` across toggles without inventing `0`, requiring `>0` and positive paired footprint; required `usableM2` rejects `""`/`<0` and preserves `0` (`0 m²=0 ft²`).
- **Dirty-switch rules**: Valid edited entries convert once on edit and retain full-precision staged canonical `widthCm`/`lengthCm`/`usableM2`; unit toggles format staged values in the new unit (leaving `nurserySettingsFingerprint` unchanged when clean). Invalid/incomplete drafts hold the switch and keep existing unit/raw text without silently reinterpreting or relabeling numbers.

## 5. Lifecycle & Receipt Boundaries

- **Current facts**: `NurseryPlanPanel` only sets `key={props.siteId}`. In `publish`, `onSettings` returning `false` or throwing retains inputs (without proving pre-write atomicity), while `true` or `undefined` (`void`, unconfirmed save) clears forms.
- **Proposed contract**: Bind drafts to an opaque `{actorScope,sampleMode,siteId,settingsFingerprint,sourceRevision}` context: withhold prior private values and stale submit callbacks on actor/sample/`siteId` change (preserving drafts privately only within the original actor), retain dirty same-source `settings` clones, and require explicit reload/receipt-bound reconciliation when saved `settings` change. Boolean `true` plus matching props/fingerprint is not a durable receipt: hold drafts without duplicate retry on `false`/`undefined`/throw/unconfirmed states, clearing only on a write/readback receipt bound to active actor/sample/site/source and intended settings.

## 6. Proposed Negative Requirements (Not Executed)

1. Clean or valid-dirty `cm↔in`/`m²↔ft²` toggles must not round/mutate staged canonical `widthCm`/`lengthCm`/`usableM2` or `nurserySettingsFingerprint`, nor map blank optional dimensions to `0` or `usableM2=0` to `undefined`.
2. Invalid/incomplete drafts (`<=0` dimensions, `<0` area, blank `usableM2`, lone `.`/`,`, fractions/suffixes, non-positive paired footprint) must hold unit toggles without relabeling raw text, block `onSettings` (untouched new blank surfaces may choose units but cannot save), and never invoke `buildNurseryForecast` when `allowCatalogueForecast={false}`.
3. Context switches, same-source clones, changed saved `settings`, or `false`/`undefined`/throwing/unconfirmed saves without a bound write/readback receipt must never leak private drafts, overwrite dirty edits, retry duplicates, or claim durable save.
