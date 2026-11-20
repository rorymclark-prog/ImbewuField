# Provisional planner entry messages — 13 November 2026

- Auditor: Codex / Command Centre; branch `codex/provisional-entry-copy-20261113`.
- Base: `d012bf123e9daf6d3aef657def132acb9f419f4d`, tree `90abe9f7d28fdc6b58980e88edcc9a0967e5e71f`, draft PR1365.
- Previous: [Map preview feedback](map-preview-feedback-codex.md), [Provisional app integration](provisional-cycle-app-exports-codex.md) and [Country evidence next steps](../2026-11-10/country-evidence-next-steps-codex.md).
- Scope: two existing country/planning notices, their actual React/page checks and release text. No planning permission, source selection, calculation, persistence, provider request, species, geometry, lesson, schema, workflow or PLAN_VERSION change.

## Finding and correction

| ID | Problem and evidence | Disposition |
| --- | --- | --- |
| GLOBAL-PROVISIONAL-ENTRY-COPY-01 | In the exact base hosted public demonstration, a saved US country description displays “Automatic crop planning is not available” and “Local crop planning is not available”, directly above the usable Provisional crop preview. The notice also describes exports as unavailable without distinguishing the provisional printable export. | Notices now name the held South African catalogue planner and explain the separate supported partial-preview, printable-preview and saved-profile paths. Unknown values and local-suitability limits remain explicit. Successor visual verification remains separate. |
| PLACE-PREVIEW-STALE-FEEDBACK-01 | Parent exact source/handler and hosted warning-retirement review accepted. | Retained closure within that bounded scope; no map change here. |

The browser used the official public tour and its prepared demonstration records. Changing the sample's declared country to US / Great Lakes States is a synthetic UI control, not evidence that the South African sample coordinates belong to the US, that any region matches geographically, or that its farming advice is suitable. No NWS request, paid generation or real-account write was performed.

## Verification

- Two actual React/page negative controls fail on the unchanged base notices with the new, more precise capability expectations. They retain all existing assertions that block South African catalogue recommendations, forecasts and exports for foreign/unknown contexts.
- Ordered verification: `npx tsc --noEmit` exits 0; then all122 affected checks pass with2workers, zero failures/cancellations/skips/todos; then `git diff --check` exits 0. Local Node is26.5.0; Node24 CI remains separate.
- Affected suites cover the real planner's country invalidation and saved entries, country navigation and unsaved-selector authority, actual provisional-preview UI, touch/keyboard and font rules, release-note labels and update tours. This is a wording/UI change, not a farming-calculation change or map render.
- Original hosted screenshots and AX text are retained in the private `provisional-entry-copy` receipt folder. The corrected hosted screen must be inspected on its own exact build before claiming its visual result.
- The full original P01–P24 programme remains open. Current source/CI and same-candidate external review gates remain distinct; held Claude/AGY access is not replaced by this Codex work.

## Next action

Independently review the exact changed source, push the finished branch once, inspect its actual preview and CI, and retain any new finding. Do not merge or release while the applicable programme review gates remain open.
