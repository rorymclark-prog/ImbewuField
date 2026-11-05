# Reviewed media test scope continuation — 2026-11-05

- Auditor: Codex root sprint coordinator
- Reviewed revision: original `af1329f1ac595e22d96a696816395b36ea1b239f`, branch `codex/reviewed-media-test-scope`, with a conflict-free merge of main `9c8289ff43ee2977904f3ba86de1c9923534b131`.
- Deployment inspected: none; tests/docs only, no application changes.
- Previous audit: [Original scope and measured evidence](../../international/REVIEWED-MEDIA-TEST-SCOPE.md).
- Scope: two synchronous Soil/Water preservation tests and their existing shared guard.
- Evidence type: exact source comparison, actual CI logs, local typecheck and guard tests.

## What was already done

PR #1178 already wraps each complete preservation callback in the existing
`withBlindReviewedCorrectionReadScope`. Reuse that work; do not create a second
implementation. Current main contains the corrected AST structure-register check
that was absent in the old PR run.

All original test-body bytes are unchanged after removing only the added import
and scope wrapper. Shared historical-reader helper/guard sources, the two corruption/format
checks and the lockfile match the old PR and current main exactly. The wrapper retains each original per-entry assertion;
the helper still validates the complete current layer before and after the outer
synchronous read. Existing mutation tests change only their isolated cloned fixture.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| MEDIA-SCOPE-001 | Repeated full media-layer checks slow down release verification | Implemented, full current-head verification pending | Exact two callback wrappers from #1178; no helper, assertion, timeout, package or workflow relaxation. |
| MEDIA-SCOPE-002 | Old #1178 full run failed an unrelated polish-callsite assertion | Current-main correction retained; affected local check passed | Run 41631529207: 6,352 tests, 6,350 pass, one failure, one existing TODO. `structure-register.test.ts` now parses actual calls with TypeScript AST rather than the old line-end regex. |
| MEDIA-SCOPE-003 | Scope batching might hide changed bytes | Verified in the current local guard run | Same-size live source, unlisted media and mutation during nested read must all fail, then recover after restoration in the cloned fixture. |

## Verification

- Typecheck: Node 24.22.2, `tsc --noEmit --incremental false`, exit 0 after main reconciliation.
- Guard tests: 15/15 pass across blind-reviewed corrections, WebP format and structure register on the reconciled tree; Node 24.22.2, concurrency 1, 7.027 seconds. All same-size and nested mutation rejection/recovery checks passed.
- Full test suite: new current-head CI required; not passed or merged.
- Historical baseline: successful main run 41868034947, job 126707265307, revision `a5300d2f7e1da32238196e02444c1c494f954761`: 6,385 tests, 6,384 pass, zero failures, one existing TODO; test duration 12,234.375 seconds. Soil and Water callbacks each took about 72 minutes on that runner. Different contention and scope prevent a controlled speedup claim.
- Whitespace: working-tree and staged checks passed before commit.
- Output inspected: no rendered output changes; this does not change the picture. `PLAN_VERSION` remains unchanged.
- Limits: the wrapper does not remove all nested historical verification cost. No promise that the complete suite is now fast.

## Next continuation

Finish current guards, push one reconciled head on existing #1178 and inspect its
full `test` and `rules` gates before any merge. Preserve unrelated active release
checks and do not restart another owner's jobs. No production release is claimed.
