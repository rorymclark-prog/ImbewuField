# Nursery-Unit SA Release-Copy Notes (`zu`, `st`, `ts`, `ve`)

## Scope & Provenance

- **Source**: `docs/international/agy-nursery-unit-sa-release-copy-2026-11-03/source.json` (SHA256 `0757135f0b7b1fbb405e0b20378ea9e3519f5981ffa7acb02c217140a045206d`), freezing 6 strings from `lib/release-notes.ts` (`346535` bytes, SHA256 `f2c5e662d3476f376ce2dd1bdee38f55587d3f1e9fb1484f91bde2124cf0f259`, base `844e4a1bcbf9d1b25d5cc7b747ea22f88e1f727e`).
- **Status**: All 24 candidates (6 each in `zu`, `st`, `ts`, `ve`) carry `reviewStatus: "unreviewed-ai-draft"` and `runtimeActivation: false`.

## Terminology & Semantic Guards

- **Seedling propagation (`nurseryRelease01`–`05`)**: Renders "nursery" as seedling propagation (`indawo yezithombo`, `sebaka sa lipeo`, `xirhapa xa swimilana`, `tsimu ya zwimela zwiṱuku`), never childcare.
- **Dimensions & surface (`nurseryRelease01`, `02`, `04`, `06`)**: Keeps tray dimensions in centimetres/inches (`li-inch (in)` in `st`; `ti-inch (in)` in `ts`) and 2D usable surface in square metres/square feet (`maoto a sekwere (ft²)` in `st`; `tifiti ta xikwere (ft²)` in `ts`, avoiding `mitirho`), without conversion factors, defaults, or measurement-rewrite claims.
- **Retention vs save confirmation (`nurseryRelease03`)**: Uses open-entry retention phrasing distinct from save verbs, without implying pre-write atomicity, cloud sync, or storage warranties.
- **Route & unknown vs zero stock (`nurseryRelease05`, `06`)**: Preserves `→` and distinguishes blank unknown equipment values from `zero` owned equipment stock (using `zero` rather than `tandza` in `ts`, and never implying seedling counts).

## Review Limits

AI drafts require human review before activation.
