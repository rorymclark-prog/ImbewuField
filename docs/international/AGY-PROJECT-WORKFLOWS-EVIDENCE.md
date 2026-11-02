# Project workflow foundation: delivered evidence — 1 November 2026

- Executor: **Codex delegated agent**, after the AGY CLI permission/terms limitation reported by the coordinator. No successful AGY implementation or native swarm is claimed.
- Baseline: `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`, branch `codex/agy-project-workflows`, with uncommitted lane changes prepared for parent review.
- Scope: new `lib/international/projects/**`, `components/international/projects/**`, `app/international/projects/**`, one owned test file and lane-specific documentation/status.
- Parent retains integration, visual review, full current-head CI, release notes registration and release authority. No commits, pushes, PRs, merge or deployment were performed by this writer.

## Concrete delivered behavior

Five grower-owned templates cover food security, livelihoods, agroforestry, agroecology and commercial market gardening. Each has a sequence of actions, supporting roles, source authorities, evidence requirements and limits. Ten indicators distinguish output from outcome; no indicator claims causal impact or funding eligibility.

The pure evaluator returns `reported`, `incomplete` or `unavailable`, a complete value only when its checks pass, separately labelled known partial sums, accepted source references, rejected references/reasons, named gaps and interpretation limits. It preserves observed zero, refuses missing/nonfinite values, planned values, wrong evidence levels, incompatible units, mismatched site/project, duplicate source IDs, invalid/out-of-period dates, cutoff violations, missing/withheld consent and unapproved publication. Counts need safe whole numbers. Numeric overflow cannot become a complete result.

Fixed-cohort survival requires a matched baseline/follow-up method and population, positive denominator equal to the original cohort, and counts within that denominator. Soil comparisons require an explicit method unit and retain negative change without classifying it as improvement. A matched before/after result remains descriptive, not causal.

Mixed currencies cannot produce either a complete value or partial mixed subtotal. The evaluator also refuses cross-authority sums without reconciliation: two different IDs may still describe one harvest or payment. Missing costs do not establish zero costs, and receipts are not profit or household income.

Source references carry no private payload or new access grant. The production adapter reuses `sanitiseProductionRecords`, preserves actual/expected, original unit, site, fictional provenance and the full calendar month, and requires a supplied review envelope because the source has no recording-date/publication metadata. Legacy unassigned rows cannot be borrowed into a site result. It performs no fetch or save.

The interactive `/international/projects` review route switches templates and indicators, edits an ephemeral grower objective and reporting dates/cutoff/time zone, selects fictional failure scenarios and expands source/exclusion details. It reads no farm records and publishes/saves nothing. The route is an English draft and labels all example quantities as fictional arithmetic examples. A passing demo review is not real observed project evidence or reviewed local farming support.

## Verification actually performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Passed after all source/tests were complete. |
| Node 24 `--import ./tests/register-alias.mjs --test tests/international-project-workflows.test.ts` | **15/15 passed**, zero failures/skips/TODOs; 0.25 seconds. |
| `git diff --check` | Clean. New untracked source files were also scanned explicitly: eight files, zero trailing-whitespace findings. |
| Production build | Not run, following the sandbox Google Fonts rule. |
| Full app suite / current-head CI / rules | Not run by this lane; parent-owned integration gate. |
| Browser / phone / dark theme | Not inspected by this writer; parent-owned verification remains open. No source-test result is presented as visual proof. |
| Real records / private farm / publication | Not accessed or performed. |

The owned tests exercise all ten demo indicators with both a positive control and a planned-only rejection. Adversarial checks cover matched survival, changed population/method, missing/zero/wrong denominators, adverse soil change, invalid calendar dates, scoped period/cutoff behavior, duplicate source IDs, partial missing data, cross-book duplicate risk, consent/publication boundaries, fictional/live boundaries, mixed currency, complete-month source coverage and impossible magnitudes. They assert concrete values and failure states, not source snapshots.

The test filename still requires the coordinator’s additive `package.json` registration. No package/dependency changes were made in this lane.

## Visual and integration handoff

Open `/international/projects` on the integrated development server using port 4252 if needed. Check a narrow viewport and supported dark theme. Select Agroforestry → original cohort alive; compare complete fictional observations with missing baseline and duplicate references. Select Livelihoods → recorded receipts → mixed recorded currencies. Edit cutoff and reporting dates to confirm exclusions change visibly. Check source details and objective draft behavior without implying persistence.

The back link `/international` depends on integrating the separate country lane. The source interface uses existing theme tokens and labelled controls with 44-pixel minimum heights, but rendered fit/contrast/interaction remain unverified here.

See [the exact integration proposal](AGY-INTEGRATION-project-workflows.md) and [release-note draft](AGY-RELEASE-NOTES-project-workflows.md). This adds a new review interface and therefore changes the picture. `PLAN_VERSION`, species names, lessons/quizzes, saved geometry, core crop calculations, accounts/sync, access rules, workflows and existing ledgers remain unchanged.
