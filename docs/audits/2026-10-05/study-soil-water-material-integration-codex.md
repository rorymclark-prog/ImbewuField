# Soil and Water regional draft integration — 2026-10-05

- Auditor: Codex scoped integration helper, with root visual inspection of all four phone samples.
- Reviewed revision: `086884a1955fc2fc43f95ef13cace5ce516c3237`, branch `codex/soil-water-deck-reviewed-integration-20261005`, uncommitted merge of `bde761b33dc4f587746d60b5fe77d881f29b80ca` and four narrow Water repairs.
- Deployment inspected: none in this integration; publication and native preview remain root gates.
- Previous audit: [Learner residuals](../2026-10-04/study-learner-residual-codex.md), [isiZulu source zoom continuation](study-isizulu-source-zoom-codex.md), and [original regional Soil/Water draft proof](../../study-translation-reviews/SOIL-WATER-ORDINARY-SLIDES-2026-10-05.json).
- Scope: six existing regional Soil/Water paired decks, integration of current Water learner drafts, four Water clause holds, and corresponding still assets.
- Evidence: source reconstruction, exact exported review projection comparison, deterministic rendering, static phone samples and ordered verification.

## What was already done

The original six decks preserve source-paired ordinary-prose completion and unreviewed notices. Main's Water learner completion is retained with its [dated application proof](../../study-translation-reviews/WATER-HARVESTING-LEARNER-ORDINARY-COMPLETION-2026-10-05.json) and [independent implementation audit](../../study-translation-reviews/WATER-HARVESTING-LEARNER-INDEPENDENT-IMPLEMENTATION-AUDIT-2026-10-05.json). Learner body completion supersedes prior runtime wording; earlier deck reuses are checked against the dated prior learner text, with historical English holds still verified. Original blind-review records remain historical evidence rather than being rewritten to claim a new semantic review.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary learner prose and deck prose have different completion histories. | Implemented for this scope | Both learner completion and deck source-bound historical reuses are retained. Whole-course coverage remains outside this narrow integration. |
| SOIL-WATER-MATERIAL-001 | Tshivenda Water 4 loses the explicit moisture-depth disclaimer. | Implemented; static output verified | Only the first disclaimer sentence returns to exact English; the second regional sentence stays unchanged. |
| SOIL-WATER-MATERIAL-002 | Tshivenda Water 12 training wording does not clearly retain suitable qualification. | Implemented; static output verified | Only `A suitably qualified person` remains an exact English hold. |
| SOIL-WATER-MATERIAL-003 | Tshivenda Water 20 training wording does not clearly retain qualified local sanitation advice. | Implemented; static output verified | Only `qualified local sanitation adviser` remains an exact English hold. |
| SOIL-WATER-MATERIAL-004 | Xitsonga Water 22 narrows watercourse to river. | Implemented; static output verified | Only `watercourse.` remains an exact English hold. |
| SOIL-WATER-MATERIAL-005 | Machine comparison cannot establish fluent or local farming approval. | Open | All drafts remain visibly unreviewed. Facilitator review follows publication; native preview remains a prepublication gate. |

## Implementation and evidence

[Repair proof](../../study-translation-reviews/SOIL-WATER-MATERIAL-REPAIRS-2026-10-05.json) records exact before/after target cells, exact English segments, installed asset hashes, and preservation. Rewinding the four target cells reconstructs all six HEAD source packets exactly. The other 128 regional Soil/Water stills are byte-identical to the original branch. Canonical narration and `lib/course-modules.ts` are unchanged. All 245 final targets match the existing exported review projection; no new native semantic scan was dispatched in this helper.

Only VE Water 4, 12, 20 and TS Water 22 were rendered using `scripts/make-lesson-slides.mjs --paired-draft --slides`. Four asset-size entries and four rendered frame proof/checksum rows were updated, together with the two affected source hash bindings. Existing service-worker migration 125 already includes all four frames; no new migration was introduced. The original ordinary-completion review proof remains unchanged.

The paired test now checks each live mixed repair against its exact source-bound proof, then rewinds that field when checking the original blind-review record and safety anchors. This preserves earlier semantic coverage while adding current exact-English holds. Existing historical learner reuse and hold assertions retain their original reason after learner completion. Two leftover merge closing lines in release notes and a duplicated test message were removed; both release-note entries remain.

[Four-frame contact sheet](evidence-soil-water-material-repairs/contact.jpg) and 390 px samples: [VE 4](evidence-soil-water-material-repairs/ve-water-slide-04-390.jpg), [VE 12](evidence-soil-water-material-repairs/ve-water-slide-12-390.jpg), [VE 20](evidence-soil-water-material-repairs/ve-water-slide-20-390.jpg), [TS 22](evidence-soil-water-material-repairs/ts-water-slide-22-390.jpg).

Root inspected the contact sheet and all four phone samples: exact rust English holds, source panels and draft notices are visible; no clipping was observed. This is a static image check, not native preview learner UI verification or fluent approval. This changes the picture. `PLAN_VERSION` remains unchanged.

## Verification

- Typecheck: passed `npx tsc --noEmit`.
- Full suite: passed `npm test`, 4,668 tests, 4,667 passes, zero failures, one existing shape-sync TODO; 96.1 seconds, process exit 0.
- Whitespace: passed `git diff --check` and `git diff --cached --check` after the suite.
- Output: contact sheet and four 390 px static images inspected by root; local helper also inspected contact and VE 4.
- Limits: native preview, signed-in/offline learner behavior, fluent language/local farming review and publication remain root work.

## Next continuation

Root reviews the combined diff, records native preview/deployment evidence, and handles commit/push/publication. This helper has not committed or pushed. Untracked QA and original Claude worktree are preserved. Market worktree is untouched.
