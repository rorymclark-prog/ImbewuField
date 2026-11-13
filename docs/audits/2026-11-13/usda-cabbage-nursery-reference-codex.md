# Optional Great Lakes cabbage nursery lead time — 13 November 2026

- Writer: Codex; branch `codex/global-cabbage-nursery-reference-20261113`.
- Base: `d59183e977597fcd1d84f716484ecfae3f5427c9`, tree `32b3c77d0d7f0a763ffc35752fe0c0b561733118`, stacked on PR1359.
- Previous: [Great Lakes spacing](great-lakes-spacing-codex.md) and [profile/adoption integration](provisional-cycle-app-exports-codex.md). Existing report, spacing and save corrections are retained.
- Scope: G03/G04 source adapter and the existing provisional preview; no second planner or saved schema.

## Source and interpretation

The original USDA NRCS *Community Garden Guide — Season Extension — Seed Starting*, page5, cabbage row, reports4–6 weeks before transplanting. Page1 gives the Great Lakes context and requires local frost-free timing; publication/revision dates remain unknown. Original pages1/5/9 and the live primary PDF were inspected. The original505,557byte PDF SHA256 remains `ff7a1dfea4582f69d8349e150e7e875b02df32c01bc1eef957aded6fa2a9483e`.

The independent source-only review found no blocking discrepancy for deliberately choosing a printed endpoint, subject to explicit limits. Four weeks is the shorter duration/later seed start (T−28); six weeks is longer/earlier (T−42). Exact weeks-to-days conversion does not increase agricultural precision. This is seed-starting lead time, not time after emergence, germination duration, guaranteed seedling readiness, a local calendar or a frost-safety check. No additional hardening interval is added.

Source: https://www.nrcs.usda.gov/plantmaterials/mipmcar9781.pdf . Numerical facts use the already reviewed USDA public-information reuse basis with attribution and protected-material exceptions; no artwork, logos or endorsement. The source dossier records the continuation separately from the unchanged historical spacing capsule.

## Implementation

`GLOBAL-USDA-NURSERY-01`: the duration choice starts blank, disabled until explicit undated-reference consent in the declared US/Great Lakes cabbage context. The grower may choose28 or42days. Existing candidate metadata retains the full28–42day range, chosen numerical-bound basis, original weeks, page/row/PDF hash and historical-transfer limits. A separate source identity preserves existing spacing-source bytes and saved origins.

The shared existing partial scheduler subtracts that duration from a separately entered field-entry date. Without a date, the absolute seed start remains unknown. No yield, harvest, field occupancy, final stand, positive planting window or calendar default is supplied. A manual duration edit remains a grower estimate even if numerically equal to a source bound. Reset restores the explicit chosen bound. Country/region changes, reference withdrawal and establishment edits retire the choice; returning does not revive it. Saving keeps the same existing request/profile schema and source evidence, without adding sowings.

## Verification and limits

- Final source typecheck passed before the final affected test run. One intermediate new save-test stub returned the wrong result tag; the typecheck caught it and the stub was corrected to the existing confirmed/profileId contract before the final pass.
- Final affected contract run:340/340 across17files, zero failures/cancellations/skips/todo. Covers UI, resolver, original export, saved profile readback, existing spacing, canonical storage/cycle projection, workflow and the phone type floor.
- Two new tests fail against the exact parent provider/component: missing source nursery value and missing choice control. An initial private baseline-loader import-resolution failure was corrected and is not counted as regression evidence. Parent files were read-only; no dependency/source baseline edits.
- Actual mounted product-component outputs and original printable HTML are captured for blank choice, both bounds, manual override, saved evidence and revoked country. Account/source-read callbacks and surrounding CSS are synthetic. Browser/PDF inspection, exact successor review and current-head CI are recorded in the owner checkpoint; a prepared artifact is not inspection or approval by itself.
- No local full suite or production build; existing parent full CI jobs continue without restart. Successor full CI/rules and applicable preview/render gates are still required. Independent implementation review must refer to the final candidate/tree.
- Claude/AGY automatic routes remain held under the existing service-policy boundary; no retry, proxy, account/auth change or paid API. Independent Codex source review does not replace those roles or validate agriculture.

This changes the displayed and printable picture. PLAN_VERSION, species names, measured geometry, existing sowings and historical saved source capsules are unchanged. No release, regional suitability or accuracy percentage is claimed. Continue the original G01–G05/P01–P24 milestone rather than treating this optional reference as completion.
