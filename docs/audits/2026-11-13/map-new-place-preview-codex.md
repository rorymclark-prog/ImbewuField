# New-place naming during area previews — 13 November 2026

- Auditor and implementation owner: Codex / Command Centre.
- Base: `be38a7a15a7e74097a8f6dc0c62ee038ad982e64`, tree `9e9024dc8e33cbb7137008d38df0840db031a0b7`, draft PR1363.
- Branch: `codex/map-new-place-preview-20261113`.
- Previous: [Worldwide search](global-place-search-codex.md), [actor-bound saves](saved-place-actor-guard-codex.md) and [preview memory](preview-build-memory-codex.md).
- Scope: map new-place opening and deferred confirmation; explicit existing-pin rename/recolour retained. No geometry, saved schema, country permissions, agricultural figures, species, lessons, PLAN_VERSION, workflow, provider or account change.

## What was already done

The approved parent preview repair succeeded in actual run43426043091. Its hosted
build identifies be38a7a; rules and focused-render jobs pass. Both full test jobs
remain separately pending at this inspection. The actual hosted sample planner
created one provisional cycle and six dated tasks. Original bulk and individual
DEMO calendar downloads were independently parsed: all26 public source and
limitation lines survive in each of seven events, with independently recomputed
dates and exclusive ends. That is engineering sample evidence, not local
agricultural validation, native calendar import or a real-account write.

## Findings and correction

| ID | User-visible problem | Disposition |
| --- | --- | --- |
| PLACE-NEW-SAVE-PREVIEW-CONTEXT-01 | After previewing Vienna with an old farm selected, Save place opened a naming sheet for the old selected point. A nearby update could therefore relabel that old point while another area was visible. | Reproduced in actual hosted be38 UI and actual callbacks. New-place opening now uses the existing exact-point permission; a draft is bound to the selection generation and its own sheet identity. Confirmation checks before and after the nearby prompt and inside the shared writer. Successor hosted verification and independent review remain required. |

Preview and own-point changes retire new-place drafts, including round trips.
External selected-point changes also advance the selection generation; retained
opening callbacks cannot open a sheet for a different old point. Cancellation,
replacement and unmount retire the sheet identity. The existing actor/sample
receipt remains composed with the new-place checks, rather than replaced.
Explicit existing-pin rename/recolour remains separate and allowed during an
unrelated preview, preserving coordinates and notes. A nearby match discovered
while saving a new point is still subject to new-place validity.

## Verification and limits

- Actual base callback negative control:24 pass and13 intended failures. The retained opener, preview confirmation, ten deferred nearby-answer transitions and final re-entrant guard all fail against the exact base source. No live save was confirmed. Existing positive handlers remain intact.
- Final ordered verification: typecheck exit0, then995/995 affected checks across the shared18 rendering files plus map/search, saved-place/account/sample, international context and release-note consumers. Zero failures, cancellations, skips or todos. Whitespace and committed release-note checks are recorded with the exact candidate on issue35.
- An exploratory fixture initially bound callbacks before their dependencies; its ReferenceError output is retained and excluded from product failure evidence. A later TypeScript fixture narrowing error was corrected by explicitly reading the fresh post-action value; no assertion or original case was removed.
- Original base screenshot was opened and inspected: the Worldwide Vienna background and active Save this place sheet are visible. Its historical filename contains “guard” but it is failure evidence, not a passing output.
- This changes map interaction and error feedback, not map artwork. PLAN_VERSION is unchanged. Actual successor hosted opening/selection behaviour remains unverified until its preview is inspected; callback tests do not establish a live cloud write, account transition or physical-device result. Capture payload verification remains open independently.

## Next continuation

Independently review the exact successor and actual finite evidence, push the
finished branch once, then inspect its own rules/render/preview and full-suite
results. Verify the actual hosted preview holds new-place opening while an area
is temporary and permits a fresh naming draft after explicit own-point selection.
Keep the full original global-planning scope and required external-review gates.
AGY/Claude-through-AGY remain disabled; prepared packets do not imply external
review, and this branch grants no production merge or release approval.
