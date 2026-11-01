# AGY international foundation work order — 1 November 2026

Owner: Rory Clark. Integration and release coordinator: Codex root chat.
Baseline: `main` at `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`.
Shared coordination: [GitHub issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35).
This is the explicit assignment for three concurrent AGY chats, each in its own worktree.
Read this document, your lane brief, and the local `AGENTS.md` before work.
The assigned work supersedes taking an unrelated backlog item; all safety rules remain.
Codex has already verified the shared remote and `PUSH OK` before this assignment.

## Product outcome

Build reviewable foundations for international food security, livelihoods,
agroforestry, agroecology and commercial market-garden projects.
The grower remains the primary user; organisations and funders support that work.
Deliver working typed code, tests and useful review interfaces, alongside research.
An essay or a list of future tasks alone does not complete any lane.
Preserve the reviewed South African app and its current farming authorities.
Country context, agricultural region and language are independent concepts.
A translated interface is not locally reviewed agronomy.
Worldwide reference coverage is not worldwide production-plan support.
Unsupported countries must never silently receive South African recommendations.

## Execution choice and isolation

Codex coordinates three installed `/opt/homebrew/bin/agy` CLI jobs.
CLI provides separate worktrees, observable output and resumable conversation IDs.
Use the app or Chrome only where an actual visual/review task requires it.
The installed help supports `--print`, `--new-project`, `--conversation`,
`--mode accept-edits|plan`, `--sandbox`, `--model`, `--effort` and JSON streams.
There is no verified swarm flag in the installed CLI help.
Do not invent flags, native subagents, benchmarks, token savings or cost claims.
Supported parallel research tools may be used within a lane when available.
Record the actual model and agent/tool use; do not call ordinary concurrency a swarm.
Use execution mode for this authorised implementation, with the normal sandbox.
Do not spend the assignment in abstract planning or repeated permission requests.
Do not bypass required tool approval or use `--dangerously-skip-permissions`.

| Lane | Worktree and branch | Assigned model | Brief |
| --- | --- | --- | --- |
| Country data | `/Users/roryclark/ImbewuField-tokens/agy-country-foundation`, `codex/agy-country-foundation` | Sonnet High (`claude-sonnet-5-5-high`) | [Country data](assignments/country-data.md) |
| Localization | `/Users/roryclark/ImbewuField-tokens/agy-global-localization`, `codex/agy-global-localization` | Flash High (`gemini-3.8-flash-high`) | [Localization](assignments/localization.md) |
| Project workflows | `/Users/roryclark/ImbewuField-tokens/agy-project-workflows`, `codex/agy-project-workflows` | Flash High (`gemini-3.8-flash-high`) | [Project workflows](assignments/project-workflows.md) |

Codex confirms installed model availability at dispatch; no unverified fallback model.
Each job must first print its `pwd`, branch and baseline revision.
If these disagree with the lane, stop writes and tell the coordinator immediately.
Do not create competing task systems, ledgers or account integrations.
Do not edit another lane's source, even when its code is visible elsewhere.

## Ownership

Country owns new `lib/international/countries/**`, `lib/international/providers/**`,
country-profile types/registry within that namespace, `components/international/countries/**`,
`app/international/page.tsx`, country-specific tests and research documentation.
Localization owns new `lib/international/locales/**`,
`app/international/locales/**`, locale-specific tests, coverage tooling and documentation.
Projects owns new `lib/international/projects/**`, `components/international/projects/**`,
`app/international/projects/**`, project-specific tests and documentation.
Use lane-prefixed test filenames and documentation names to prevent collisions.
The common work order and assignment briefs are coordinator-owned after handoff.
Each lane owns only its own `AGY-STATUS-<lane>.json` status file.
Existing `lib/i18n.tsx`, lesson translations, shared navigation and core crop-engine
integration belong to Codex; propose exact integration patches without applying them.
Existing release notes are coordinator-owned; deliver a lane-specific draft sidecar.
Only additive test registration in `package.json` is a shared mechanical exception.
Preserve existing entries; the coordinator resolves the final registry union.
No dependency installation into the shared `node_modules` symlink.

## Non-negotiable data boundaries

Never change species names or add catalogue entries, calibrated lessons or quizzes.
Never change saved geometry, sync/tenant permissions, rules, deployment workflows,
paid-AI behavior, billing or `PLAN_VERSION`.
Do not change the active nursery work or core crop calculations in these branches.
Invent no spacing, yield, rainfall, frost, stocking, growth or soil figures.
Unknown, not reviewed, unavailable and zero are different states.
Public geographic layers cannot certify planting suitability or legal permission.
Do not infer carbon, soil improvement or resilience from map icons or participation.
Keep actual observations separate from forecasts and proposed interventions.
Preserve currencies on historical transactions; no relabelling rand balances.
No mixed-currency totals without a separately recorded conversion authority.
No precise farmer coordinates, private records, credentials, `.env*`, tokens or logs
in source fixtures, documentation, status artifacts or screenshots.
Use public/demo data for network proofs and visuals.
Only issue #35 and the assigned PR coordination are authorised messages. No outreach,
unrelated external messages, accounts, payments, legal acceptance or paid generation.

## Evidence and source standard

Use primary official agencies, extension institutions and original datasets.
Verify each linked source and distinguish full content from a search snippet.
Record date accessed, exact URL and the claim or capability actually supported.
For each provider record coverage, resolution, units, update cadence, licence,
attribution, authentication/access limits and failure/missing-data behavior.
Unknown licence or cadence remains explicitly unknown, not guessed from another API.
Separate biodiversity/taxonomy/conservation, agriculture/extension, weather/frost,
soils and plant legality; no single SANBI analogue answers all five questions.
Global GBIF/FAO/raster sources may complement local authorities, not replace them.
Research-priority countries and engineering pilots are provisional work choices.
They are not launch suitability, funding eligibility or validated crop claims.
Respect source quotation limits and avoid copying entire publications or datasets.
Network adapters require bounded requests, explicit failure states and provenance.
Never hide a timeout, rate limit or missing value behind a plausible default.
Use mocked-network tests for reproducible checks; keep live proof separate.

## Status and stall contract

Create `docs/international/AGY-STATUS-<lane>.json` immediately after workspace checks.
Use `country-data`, `localization` or `project-workflows` as the lane suffix.
Write valid JSON containing this contract:

```json
{
  "branch": "codex/<assigned-branch>",
  "cwd": "/absolute/assigned/worktree",
  "status": "working",
  "milestone": "workspace verified; next concrete artifact named",
  "updatedAt": "ISO timestamp",
  "lastMeaningfulAt": "ISO timestamp",
  "artifacts": [],
  "validation": [{ "command": "actual command", "result": "actual result or pending" }],
  "nextAction": "specific executable next step",
  "blocker": null,
  "conversationId": null
}
```

Use `working`, `blocked`, `needs-review` or `complete` consistently.
Update at concrete milestones, failures, approval waits and completion.
Advance `lastMeaningfulAt` only when evidence or an artifact actually changes.
A timestamp refresh or “Working” label is not evidence of progress.
List repo-relative artifact paths; exclude raw logs, secrets and personal data.
First milestone: a typed schema/fixture or executable adapter/test, early in the run.
Continue an independent deliverable if one source or country blocks progress.
If all lane work is blocked, record the exact dependency and notify Codex.
Codex monitors observable artifacts, status and CLI output, then resumes or redirects
stalled work with concrete next steps; do not silently idle awaiting another lane.
Record any conversation ID supplied by AGY for resumable follow-up.

## Verification and review

Follow `AGENTS.md`: typecheck, affected tests, then whitespace checks, in that order.
Use Node 24; the available binary is
`/Users/roryclark/.npm/_npx/387698761821791d/node_modules/node/bin/node`.
TypeScript tests use `--import ./tests/register-alias.mjs --test <owned-test-files>`.
Do not change the test runner or assertions to make a failing implementation pass.
Register new tests additively and document exact affected commands and results.
Required full current-head CI and rules gates apply before eventual merge.
Codex owns integrated full-suite/release review; an affected pass is not a full pass.
Do not run a sandbox production build: Google Fonts fetches make that misleading.
For a new interface, inspect actual rendered output and report the viewport/theme.
Use port 4250 for countries, 4251 for locales only if needed, 4252 for projects.
Do not touch Rory's 4246 service or Codex's nursery 4247 service.
Do not claim visual verification from source tests or a failed screenshot request.
When no browser is available, name the exact route and behavior needing review.
Do not disturb unrelated files, servers or worktrees to obtain a preview.

## Finished handoff

Deliver source, relevant tests, evidence notes, exact integration proposal and
`docs/international/AGY-RELEASE-NOTES-<lane>.md` in the assigned worktree.
Country, locale and project interfaces must state their actual readiness limits.
Record what is executable, what is reference/research only and what remains unsupported.
Stage explicit owned paths, commit the finished coherent work, then push the branch once.
Provide a reviewable PR with baseline, concrete delivered behavior, tests, source
limitations, visual evidence/gaps and any shared integration patch needed.
No merge, production deployment or release approval is delegated to AGY.
Record branch, SHA, PR and status through the agreed issue #35 handoff.
Codex coordinates the ledger and approves cross-lane integration/release decisions.
If a tool cannot post there, provide the exact ledger text to Codex; keep working.
Mark the status `needs-review` when implementation is ready for Codex review,
and `complete` only when the assigned delivery and handoff are actually complete.
No claim that the worldwide crop engine is ready may appear in the PR or interface.
