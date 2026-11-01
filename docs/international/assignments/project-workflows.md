# AGY lane: international grower project workflow templates

Read [the common work order](../AGY-WORKORDER-2026-11-01.md) and local `AGENTS.md`.
Work only in `/Users/roryclark/ImbewuField-tokens/agy-project-workflows`
on `codex/agy-project-workflows`, baseline `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`.
Assigned model: Flash High. Codex launches the installed CLI.
Status path: `docs/international/AGY-STATUS-project-workflows.json`.

## First concrete milestone

Create a reusable typed project/indicator schema and one concrete template.
Add a test showing that planned activity or participation alone cannot satisfy
an observed outcome indicator. Expand to five templates and a working review UI.
Do not create another farm-record ledger to make template examples easy.

## Deliverables

1. Independent typed template schema and evaluators in `lib/international/projects/**`.
2. Five concrete reusable templates: food security, livelihoods, agroforestry,
   agroecology and commercial market gardening.
3. Explicit references to existing records, tasks, journal, invoices, programme
   and MEL authorities, with a documented integration boundary.
4. Tests that can reject invalid evidence, missing denominators, mismatched
   periods/scopes, estimate/actual confusion and unsupported impact claims.
5. A usable review UI in `components/international/projects/**` and
   `app/international/projects/**`, showing template purpose, grower workflow,
   evidence required, missingness and actual-versus-estimated status.
6. Public/demo examples, evidence notes, release-note draft, status and PR.

## Inspect and reuse current authorities

Read `lib/farm-records.ts`, `lib/production-records.ts`, `lib/task-board.ts`,
`lib/field-journal.ts`, `lib/task-record-link.ts`, `lib/invoices.ts`,
`lib/programme-report.ts`, `lib/mel-report.ts`, `lib/farm-report.ts` and corresponding tests.
Use `rg --files` to locate any additional programme/evidence authorities before reading them.
Inspect the report modules when designing review/export-oriented summaries.
Reference those authorities through IDs/types or pure adapters; do not rewrite
their persistence, create duplicate actuals, change roles or modify sync/rules.
Propose exact integration changes for Codex instead of applying shared edits.

## Five templates, each concrete

Each template needs grower-owned objectives, a sequence of actionable work,
roles, evidence sources, review steps and a small useful indicator set.
Specify the indicator's definition, unit, scope, period, evidence type,
baseline/follow-up needs, cutoff rule, missing-data state and review limitations.
Use descriptive targets or grower-entered values; invent no numeric agronomic,
income, carbon, nutrition, resilience or funding thresholds.

- Food security: distinguish planned crops, recorded harvest and food retained
  or used; production alone does not prove sufficient nutrition or household access.
- Livelihoods: distinguish recorded sales from costs, profit and household income;
  do not convert invoice creation into paid revenue or total mixed currencies.
- Agroforestry: distinguish mapped/proposed trees, confirmed planting and observed
  survival at a defined follow-up; maps alone prove neither survival nor carbon.
- Agroecology: distinguish practice completion from measured soil/ecological change;
  keep method, sampling/observation context and source uncertainty visible.
- Commercial market gardening: connect plans, actual harvest, pack/unit records,
  sales and task reviews without promising weekly deliveries from seasonal yields.

## Evidence and permissions

Participation, outputs, outcomes and causal impact are different levels of evidence.
Counts do not prove causality; a before/after change alone does not establish it.
Missing baseline, denominator, cutoff or follow-up must remain a named gap.
Do not coerce an unknown observation into zero or a completed task into an outcome.
Use explicit timezone/date boundaries and avoid comparing incompatible periods.
Keep estimates and actual observations visible even when both are available.
Specify consent/publication expectations without weakening existing access controls.
No private names, household records or exact farmer locations in demo examples.
No carbon credit, soil health, resilience or funding eligibility certification.
The template schema should describe evidence needs, not claim new permissions.

## Acceptance checks and handoff

Tests should reject unsupported impact assertions, predicted values counted as
actuals, missing/zero denominators being confused, out-of-period evidence,
duplicate references and unqualified mixed-currency income totals where applicable.
Include positive controls showing valid observed evidence can be accepted.
The review route must make a real template selection/change and show its evidence
requirements; avoid decorative controls or a static page presented as a workflow.
Inspect a narrow viewport and a supported dark theme using demo data on port 4252.
If browser access is missing, record that exact limit and the route needing review.

Write `docs/international/AGY-PROJECT-WORKFLOWS-EVIDENCE.md`,
`docs/international/AGY-INTEGRATION-project-workflows.md` and
`docs/international/AGY-RELEASE-NOTES-project-workflows.md`.
Run typecheck, owned tests and whitespace checks, then finish the common PR handoff.
The deliverable is reusable evidence-aware workflow code and review UI, not a
new ledger, external programme submission or claim of measured project impact.
