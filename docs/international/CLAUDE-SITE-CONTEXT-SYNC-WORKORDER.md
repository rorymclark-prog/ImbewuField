# Saved-site context sync owner assignment — 2 November 2026

Executor status: the verified AGY Claude Sonnet 5.5 High lane authored the patch
and stopped after an individual usage limit. It is no longer running. Root
retains the files for review; seven independent helper probes now pass. Core
context/storage checks pass 44/44. These are mocked-transport results, not live
account verification; full current-head checks and browser review remain open.
The original assignment below is historical scope, not a new dispatch.

Rory authorised the sustained international programme and parallel agents. Codex
coordinates integration. AGENTS.md assigns `lib/user-sync.ts` to Claude. The
native Claude Code CLI was checked and exited without work because its login
has expired. This bounded Claude implementation lane is therefore dispatched
through AGY using its verified available `claude-sonnet-5-5-high` model, in a
separate conversation from AGY's Kenya research. Verify the actual selected
model before implementation; do not silently substitute a different model.

Work in the current `codex/international-site-context` tree based on `8a12b3e`.
Other writers own the planner page, country UI, nursery UI and planner UI tests.
Your exclusive edit scope is `lib/user-sync.ts`, `lib/saved-places.ts`,
`lib/international/site-context.ts`, `tests/international-site-context.test.ts`,
`tests/international-site-context-storage.test.ts` and a new optional pure
place-context merge helper plus its focused tests. Coordinate before any other
file edit. Preserve all unrelated uncommitted files. No stage, commit, push,
message, merge, deployment, dependency installation or permission/settings change.

Read AGENTS.md, CLAUDE.md and
`docs/international/SITE-CONTEXT-SYNC-OWNER-HANDOFF.md`. Codex verified PUSH OK.
The two actual ordinary storage regressions currently fail: metadata confirmation
escalates the base site revision, and a remotely deleted site is recreated.
Fix the code; do not weaken, skip or delete either requirement.

Do not let a test fixture force an unsafe creation fallback: a context-only cloud
transaction must not create a missing remote base place even when no tombstone
is returned. The normal successful-roundtrip fixture currently seeds only local
data; seed the existing remote base place too, retaining all preservation and
unchanged-base-revision assertions. Add a separate regression proving that a
metadata update alone does not create a missing remote place. Existing explicit
site creation/reconciliation remains its own authority, not a country edit.

Implement a narrow context-only revision/merge path inside the existing saved
place account/sync authority. A metadata edit cannot revive a deletion, overwrite
a remote move/notes edit, or cross a deliberately re-added base revision. Keep
ordinary explicit site creation/re-add semantics intact. A single existingOnly
transaction is insufficient if generic offline reconciliation still resurrects
the locally timestamped metadata edit. Apply one tested place-context merge rule
to every relevant existing reconcile/live/import/transaction path. Preserve
bound canonical site identity and clear stale context on a move or base change.

The planner route also needs current saved-place delivery while it stays open.
Please expose a places-only subscription that reuses this same reviewed merge
authority, with account-transition disposal, current-subscription checks and
truthful unavailable/offline state. Root will own its React/auth lifecycle.
Do not start whole-map shape/water/design reconciliation merely to read country
context on the planner. Avoid duplicating merge rules in a parallel sync path.

Keep root-facing APIs compatible where possible: createSiteCountryContext,
normaliseSiteCountryContext, resolveSiteCountryContext, sitePlanningSupport,
and updateSiteCountryContext with truthful local-saved status. If a new pending
or rejected state needs UI support, send an exact integration request first.
No new storage collection, duplicate ledger, sharing grant or security-rule
change. No species, calibrated lessons, PLAN_VERSION or geometry changes.

Add meaningful tests for remote deletion before confirmation, offline edit then
remote deletion/reconcile, live tombstone delivery, remote move/notes updates,
deterministic context-only concurrent changes, deliberate re-add, malformed
storage, A/B/guest/auth-transition, network/quota failure and retained original
re-add behaviour. Existing tests asserting cloud transport are mocked-network
evidence, not live two-device verification. Do not claim otherwise.

Use normal scoped tool approvals; no permission bypass or global allow rules.
Use Node 24 at
`/Users/roryclark/.npm/_npx/387698761821791d/node_modules/node/bin/node`.
Run typecheck, affected tests and whitespace checks in that order. No sandbox
production build. Deliver concise source changes, exact commands/results,
outstanding constraints and any root integration requirements, then stop.
Codex owns full current-head CI, browser verification and release decisions.
