# Buyer-target kilogram/pound entry contract

## Inspected scope

Committed head `844e4a1bcbf9d1b25d5cc7b747ea22f88e1f727e`: complete `components/crops/HarvestTargetsPanel.tsx`, `lib/harvest-targets.ts`, `lib/international/grower-harvest-demand.ts`; ten exact `lib/crop-plan.ts` AST statements; reviewed `docs/international/agy-grower-unit-standards-2026-11-03/CONVERSION-FACTS.md`. All five exact snapshot/source bytes and SHA256 identities remain in `status.json`. No new primary fetches. Unshown imports, parent callbacks and observed farm-record consumers remain UNKNOWN.

## Current authority

`KgHarvestTarget` stores positive `weeklyKg`; `PackHarvestTarget` stores `weeklyQuantity`, produce-pack `unit` and optional positive `kgPerUnit`, without `weeklyKg`. Imported `normaliseRecordUnit`/`validRecordQuantity` semantics are uninspected. Preserve existing month/outlet/saleable-share/range validation. `harvestTargetWeeklyKg` returns a known pack product only when finite and positive; otherwise null.

`targetDemand` uses actual inclusive UTC-month day counts for aggregate kilograms, not a weekly picking curve. Catalogue assessment uses its existing yield-factor rules; missing saleable share leaves that factor at one. The own-estimate adapter instead holds positive demand without supplied saleable share, or with zero share. Its optional source is checked when supplied; output still says `sourceVerification:'not-verified'` and `deliveryDistribution:'not-established'`. These do not establish crop suitability, observed harvest or a complete production forecast. Produce-pack trays are distinct from nursery equipment.

## Proposed entry and confirmation

Keep canonical `weeklyKg`/`kgPerUnit` in kilograms and preserve pack counts, units, dates and saleable share. Use only supplied exact avoirdupois `1 lb=0.45359237 kg` (NIST footnote22), distinct from rounded table `0.4535924 kg`; inverse division is derived. Exclude ounce, troy, force and fluid units. No country/language/currency default or standard pack weight.

Reuse existing plain-decimal parsing and nonzero-safe formatting. Convert valid pound edits once, retaining full-precision staged kilograms through toggles; never reparse rounded display. Invalid/incomplete entry retains its text/unit and holds. Blank optional pack weight stays unknown, not an inferred conversion.

Current panel `persist` treats Boolean true as device-saved and claims unchanged storage on catch without proof. Catalogue deletion calls `onTargets` directly, bypassing `onSaveTargets`; parent internals remain UNKNOWN. Route edits/deletes through one existing namespace authority and original actor/sample/site/source-bound write/readback confirmation. Unconfirmed attempts retain drafts without automatic duplicate retry or no-mutation claims. A matching sample receipt can clear its own sample draft with memory-only wording, never device-bound intent or device-persistence claims. Nursery receipt repairs are not already applied to targets.

## Proposed negatives — NOT EXECUTED

1. Clean/dirty kg↔lb toggles must preserve canonical values and missing pack weight/saleable share; rounded factors or unsupported units cannot become conversion authority.
2. Invalid/incomplete/range-failing entry must hold without relabelling text; aggregate buyer targets never become observed stock, weekly delivery curves or verified sources.
3. Stale contexts, foreign-site edits, bypassing deletes and unconfirmed outcomes must not leak private drafts, alter foreign namespaces or clear device intent using sample-only confirmation.
