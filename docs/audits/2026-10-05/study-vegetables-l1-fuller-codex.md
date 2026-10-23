# Vegetables L1 fuller regional drafts — 2026-10-05

- Auditor: Codex, with independent semantic checks and root image review.
- Reviewed revision: base `439557a0c6a4922e3f7d0256f13e14545163c913`, branch `codex/regional-vegetables-l1-fuller-20261005`, with uncommitted local changes.
- Deployment inspected: no preview for this batch yet.
- Previous audit: [Core Study residual translation follow-up](study-outcomes-residual-codex.md), carrying `STUDY-RES-002` open.
- Scope: Sesotho, Tshivenda and Xitsonga Vegetables L1 learner/card fields and matching paired silent slides 4–7.
- Evidence type: frozen source/target packets, actual registry/test diffs, source-drift tests and compressed WebP inspection.

## What was already done

Production through PR945 is retained. This continuation translates ordinary clauses while keeping difficult English terms and visible unreviewed status. It preserves canonical English, twenty ordered body paragraphs, quiz answers B/C, quantities, species, other lessons and Sesotho Introduction audio/slide bindings.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary English remains within regional learner and deck drafts. | Open; partially implemented | The reviewed learner packet applies 66 fuller ordinary fields and one English fidelity repair. Thirty-nine complete matching English narration rows reuse accepted learner targets across twelve silent frames. Source/render round trips were checked independently by root. Remaining modules and clauses still require work; these counts do not prove whole-job completion. |
| STUDY-VEG-001 | An older Tshivenda nursery sentence weakened the source comparative “do better.” | Implemented; publication pending | The first sentence now remains exact English and the checked crop-group sentence remains localized. This is a fidelity repair, not additional translation progress. |

## Verification

- Typecheck: original root command passed on the final combined implementation.
- Full test suite: final original root run had 4,653 pass, zero failures and one existing TODO. Earlier learner/deck synchronization failures were addressed by matching deck updates. Historical status assertions now accept mixed compositions only with exact current learner text and complete English source coverage. Migration order checks require both functions to exist and preserve their relative order; deletion, once-only and unrelated-asset checks remain.
- Whitespace: final original root check passed after the full suite.
- Output inspected: root viewed all twelve actual compressed 1440×5400 WebPs through four three-language contact sheets. Unreviewed labels, rust English holds, exact English cards and counters were visible without clipping. This changes the picture; `PLAN_VERSION` remains unchanged.
- Limits: no preview phone/offline review yet, no fluent-language or local farming approval, no new narration.

## Next continuation

1. Finish manifest and selective still-cache refresh checks, preserving audio and shared films.
2. Run original typecheck/full suite/whitespace and notes gates; save a coherent recoverable batch.
3. Verify exact-head CI/native preview and actual 390px learner/source/B,C feedback, silent cards and one offline pack before merge.
4. Verify main jobs, deployment/build-info and issue35; keep the wider residual finding open.
