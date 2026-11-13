# Preview build memory — 13 November 2026

- Auditor: Codex; branch `codex/preview-build-memory-20261113`.
- Starting revision: `32cdffbcf80267ca47927c762d0c1740439ec3d5`, stacked on PR1362.
- Previous audits: [Worldwide map entry](global-place-search-codex.md) and [individual DEMO calendar identity](calendar-individual-demo-codex.md).
- Scope: the previously prepared and independently reviewed two-line preview workflow heap proposal, explicitly approved by Rory on13November: “Yes, apply and verify it.” This is the narrow exception to the Claude workflow lane; it changes no other ownership.

## Findings and disposition

`PREVIEW-NODE-HEAP-01`: exact a0f and32cd preview builds compiled successfully, then Node20.20.2 exhausted roughly2GB V8 heap while linting/typechecking. The downstream no-serverless-pages error follows that failure. Earlier font override warnings were not the terminal cause. Those original failure receipts are preserved privately.

Add only the prepared comment and `NODE_OPTIONS: --max-old-space-size=4096` to the existing preview job environment. This is a per-process old-space ceiling, not a4GB aggregate job or RSS guarantee. Vercel inheritance, runner capacity and build success require the actual successor result.

No typecheck, lint, test, security check, trigger, command, dependency, token, permission or deployment target is removed or narrowed. No app/source schema, saved data, species, lessons, geometry or PLAN_VERSION change. This does not change the picture; it enables the existing preview to be verified. Nothing changes on the local Mac's memory settings.

## Verification

The exact approved patch hash is186ef65d6e90778b9d40b5932ded7632a768533c76e9ea4d5bb115a487879e03. Application first passed git-apply checking. The source/result workflow mappings are compared with a YAML parser after removing only the added environment key. Typecheck exited0, then22/22 existing workflow-alias/update-preview/release-note checks passed, with0failures/cancellations/skips/todo, followed by clean whitespace. PyYAML6.0.3 confirms identical workflow mappings after removing only the new NODE_OPTIONS key. Committed release-note checks are recorded separately for the finished candidate. No local production build is used.

Independent technical review of the exact proposal found no blocker; the accepted application/report/calendar source and generated outputs remain unchanged. Current-head full CI/security and successful preview remain required before release. Actual hosted map/capture/calendar verification follows a successful exact-head build. No build success or agricultural accuracy is inferred from this setting.

## Next continuation

Push the finished branch once, inspect actual successor CI and preview logs, verify served build SHA, then inspect the inherited map and calendar features in that hosted build. Resolve concrete new failures. The Claude/AGY automatic service hold remains unchanged; no provider or authentication workaround, external-role approval, production merge or release is included.
