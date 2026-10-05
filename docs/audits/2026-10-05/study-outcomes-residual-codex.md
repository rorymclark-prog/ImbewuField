# Core Study residual translation follow-up — 2026-10-05

- Auditor: Codex, with independent source and semantic checks and root visual review.
- Reviewed revision: base `a5fd76db64e70fd69d6c5e449cc6b8ce4dda7a0b`, branch `codex/regional-study-outcomes-next-20261005`, with local changes pending final gates.
- Deployment inspected: no deployment for this branch; nine final slide stills were inspected from local rendered outputs.
- Previous audit: [Core Study Reading body follow-up](../2026-10-04/study-reading-body-fuller-codex.md), carrying `STUDY-RES-002` as open.
- Scope: 18 approved paired-deck body fields across nine frames and five learner assessment/question fields in the current regional Study batch.
- Evidence type: exact source/target packets, registry and resolver checks, focused tests, rendered WebP inspection, and cache migration tests.

## What was already done

The previous Reading follow-up completed a separate regional prose batch and kept the broader ordinary-English finding open. This batch applies only source-bound fields accepted in the frozen review packets. Canonical English, indices, unrelated registry fields, narration and the ST Introduction media binding were preserved. Difficult terms and uncertain clauses remain visibly English where needed; these are unreviewed machine drafts for facilitator feedback, not fluent or farming approval.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary English remains within regional learner and deck drafts. | Partially addressed; open | The approved outcomes packet records 18 paired-deck body fields across nine rendered frames and five learner assessment/question fields. Root inspected the nine final 1440×5400 frames and found the source, draft text and status readable without clipping. Exact source segments and retained English clauses are checked in `docs/study-translation-reviews/STUDY-OUTCOMES-RESIDUAL-PAIRED-FIELDS-2026-10-05.json`; learner changes are recorded in the dated Reading and Xitsonga Introduction review packets. The residual audit does not establish whole-module completion or language fluency. Continue auditing ordinary prose and preserve difficult technical or uncertain clauses in English until checked. |

## Verification

- Typecheck: root original command passed on the final combined code.
- Full test suite: root original command passed: 4,608 tests, 4,607 pass, zero failures and one unchanged TODO. Historical assertions were updated to compare only the documented later fields while preserving source, order, English-hold and unrelated-field coverage.
- Whitespace: root original command passed after the full test suite.
- Output inspected: all nine changed slide stills at 1440×5400; root reviewed the actual frames and accepted their readable text flow, source and status. This batch changes the picture.
- Media/cache checks: exact changed-frame hashes and byte sizes are in the paired-field proof. A selective, once-only cache migration covers those nine still URLs and preserves other media; focused migration/offline tests are included in the pending final test run.
- Limits: no fluent-language review, facilitator review, or farming-practice endorsement is claimed. `PLAN_VERSION` is unchanged.

## Next continuation

1. Save the reviewed coherent batch and notes, then verify both exact-head CI jobs and native preview SHA.
2. Inspect actual 390px learner answer feedback, source cards and one saved silent pack before merging; verify both main jobs, deployment/build-info and issue #35 afterward. No new publication is claimed in this record.
3. Continue `STUDY-RES-002` with current source-bound learner and paired-deck evidence; do not infer completion from non-English fields or these nine frames.
