# Nursery Units & Save-Outcome Global Translation Notes

## Scope and Provenance

- **Source packet**: `docs/international/agy-nursery-unit-global-translations-2026-11-03/source.json` (SHA256 `1ad74cb3f57f231db0e80de9f5fc154f057db42485c628e6510711a79addc6ef`), freezing 18 English strings from `components/crops/NurseryPlanPanel.tsx` (`40074` bytes, SHA256 `83662d0936bd840f1651c9f6e57d2a6b51ab1ff5b059a736f63e165d6951d474`, base `844e4a1bcbf9d1b25d5cc7b747ea22f88e1f727e`).
- **Status**: All 126 drafts (18 each in `fr`, `es`, `pt-BR`, `sw`, `hi`, `bn`, `id`) carry `reviewStatus: "unreviewed-ai-draft"` and `runtimeActivation: false`.

## Terminology and Semantic Guards

- **Plant propagation (`nurseryUnits01`, `09`, `13`–`18`)**: Uses seedling-nursery terms (`pépinière`, `vivero`, `viveiro`, `kitalu`, `पौधशाला`, `চারাশালা`, `persemaian`), never childcare terms.
- **Unit symbols (`nurseryUnits02`, `03`)**: Preserves `(cm / m²)` and `(in / ft²)` verbatim without numeric defaults, agronomic advice, or currency/mass terms.
- **Growing surface (`nurseryUnits04`, `09`, `10`)**: Renders "space" as usable propagation area (`espace de culture`, `espacio de cultivo`, `espaço de cultivo`, `eneo la kitalu`, `उगाने की जगह`, `চারা উৎপাদনের স্থান`, `area semai`), not volume or device storage.
- **Equipment stock, optionality, unknown (`nurseryUnits05`–`08`, `11`, `12`)**: Distinguishes tray cavities (`nurseryUnits06`) from owned containers (`nurseryUnits07`, ownership only without claiming uncommitted availability or observed seedlings), keeps `(optional)` explicit, and renders `Unknown` (`nurseryUnits08`) as unknown rather than zero.
- **Session vs device memory (`nurseryUnits14`–`16`)**: `nurseryUnits15` is sample-session-only; `nurseryUnits16` states the unit choice works here but could not be remembered on the device (not a conversion error), without permanent storage warranties.
- **Unconfirmed save and reload (`nurseryUnits13`, `17`, `18`)**: `nurseryUnits17` states save confirmation is missing (claiming neither unwritten state, nor certain failure, nor success), uses form-retention verbs (`conservées`, `se conservan`, `mantidas`, `yamebakizwa`, `बनी हुई हैं`, `রেখে দেওয়া হয়েছে`, `tetap dipertahankan`), and treats reload (`nurseryUnits13`, `18`) as reading saved settings rather than retrying a save or confirming draft persistence.

## Review Limits

These AI drafts are unverified for native fluency or regional agronomic register and require human review before activation.
