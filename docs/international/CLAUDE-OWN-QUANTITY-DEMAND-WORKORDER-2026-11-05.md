# Claude implementation handoff: automatic planning without a buyer target

Reserved for the actual Claude executor being dispatched by the coordinating chat. This is an implementation proposal/patch task, not an AGY translation job and not permission for another writer to modify the frozen nursery release. Do not call it running until actual Claude accepts. Source base is immutable `5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e` from draft PR1290; production main is a different tree. Open and inspect the actual files linked below before proposing changes; prose alone is not the source handoff.

## Concrete product result

A grower with an eligible saved measured design and saved own-growing estimate can request a total harvest weight in an explicit date interval for household use, a trial or other planning, without inventing a buyer/sale. The current UI and assembler require saved buyer targets even though the engine already accepts dated demands. Keep the original buyer flow intact. This first milestone keeps the existing mapped/source prerequisite; it does not silently enable the currently unsupported virtual/no-design source. A later unmapped capability requires its own source/actor review.

## Ownership and output

Propose the exact additive API early. Claude owns a proposed patch only for `lib/international/grower-harvest-demand.ts`, `lib/international/grower-workflow.ts`, and a new `tests/international-grower-own-demand.test.ts`. Existing buyer function/test assertions must remain intact; no wholesale normalizer/engine rewrite. Root owns `GrowerAutoPlanPanel.tsx`, its UI/controller acceptance tests, package registration, integration, checks, Git and release. No concurrent UI implementation is dispatched until the API is reviewed. Do not edit `useGrowerWorkflow.ts`, crop-plan/sync/storage/rules, existing tests, country readiness, three nursery observation fingerprints, species/lessons or PLAN_VERSION. If one of those is genuinely necessary, report the exact reason before widening. No Git/push/merge/deploy/dependencies/accounts/settings/terms/permissions or paid calls. No test execution claim unless actually run against the patch in the repository.

Return an inspectable unified diff plus the exact new test file, a short explanation of API/semantics, and real results or explicit NOT RUN. Root will independently apply/review/test. Do not replace source evidence with a conceptual answer.

## Required semantics

- Add explicit own-quantity mode to the existing draft/assembler, retaining legacy buyer drafts. Suggested optional `demandMode: saved-targets | own-quantity` and `ownDemands` rows with opaque stable demandId, profileId, totalKg as raw user text, harvestStart and harvestEndExclusive. Confirm the API before implementation; mode must not silently reinterpret quantities or ignore malformed supplied fields.
- Each own request chooses an explicit saved profile in the same current scope; IDs must be unambiguous and priorities explicit. No inferred first crop/profile, country calendar, target, unit weight, density, yield, date, availability or numeric farming default. Weight is an aggregate planned harvest-capacity requirement in canonical kg, before saleable-grading conversion; do not apply the buyer marketable-percent allowance or claim weekly distributions/food adequacy.
- Missing/blank input is unknown, not zero. Explicit zero follows the engine zero-demand rule and grants no saved cycles. Reject invalid/nonfinite/negative weight, invalid or reversed calendar windows, foreign/duplicate/missing profile or demand identities. Reuse the existing date/scope/profile and engine authorities. No new demand storage/ledger.
- Every existing measured-source, whole-book occupancy, source/account/sample, stale review, private-identity, all-cycles-or-none write and nursery projection guard remains. Own-mode review/acceptance must use its real detached draft on reassembly; copied/mutated reviews must not acquire authority.
- Important existing line: prepareGrowerWorkflowAcceptance currently assigns `harvestTargetId: cycle.demandId` to EVERY new cycle. Own requests MUST NOT create a fake buyer/harvest-target association. Keep existing buyer IDs unchanged; use the existing canonical own-cycle attachment/demand identity without adding unreviewed storage metadata or a second ledger. Inspect downstream consumers before choosing the minimal distinction.
- Preserve all prior rows, profile metadata, foreign evidence and actual/estimate distinctions. Planning neither records sowing/planting/harvest/stock/sales nor grants country/local legality/reuse/funder approval. Readiness stays false.

## Evidence required before root release

Original own-use path absent/held proof; pure adapter and actual assembler tests for explicit quantities/date boundaries, zero versus missing, unavailable/occupied beds, multiple request priorities, no fake buyer association, immutable old rows, transplant nursery output, acceptance reassembly and stale/copy/actor withdrawal via the existing controller. Preserve established buyer regressions. Root performs ordered Node24 typecheck/full suite/whitespace, current-head CI and authorised actual hosted desktop/phone saved-own-cycle/readback checks. A route probe or in-memory fixture is not end-to-end proof. Existing shape-sync TODO is separately Claude-owned; do not delete/weaken it or claim strict100% while it fails.

## Immutable actual source packet

All links use the exact same frozen source commit. Read the complete files, including acceptance and controller rechecks, not only snippets.

- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/lib/international/grower-harvest-demand.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/lib/international/grower-workflow.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/lib/international/grower-autoplan.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/lib/international/grower-cycle.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/components/crops/GrowerAutoPlanPanel.tsx
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/components/crops/useGrowerWorkflow.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/tests/international-grower-harvest-demand.test.ts
- https://github.com/rorymclark-prog/ImbewuField/blob/5c12307aa26cdb5d9ebb57814a69b6d4cb0d1f1e/tests/international-grower-workflow.test.ts

The coordinating sender must carry actual source attachments into Claude when supported; otherwise these durable authenticated repository links must be opened and inspected by the receiver. If Claude cannot access them, obtain the exact source files through the authorised handoff rather than guessing. No private handles, raw logs, credentials or farmer coordinates in public output. Optional data sharing remains off in AGY; no change to any provider's account/settings is authorised by this file.
