# Tshivenda Reading frost placement — 2026-10-07

- Auditor: Codex implementation, following root source-semantic acceptance; no fluent approval.
- Reviewed revision: base `4e2f1078eaa1a2cd505cb293f13c4b0ada6b8625`, branch `codex/ve-reading-frost-placement-20261007`, with the listed local changes.
- Deployment inspected: not inspected; this branch is unpublished and preview/main jobs are pending.
- Previous audit: [Reading comparisons and remaining prose](study-reading-comparisons-codex.md); carried forward `STUDY-READING-COMP-003` and `STUDY-RES-002` as open language/completion scope.
- Scope: three accepted Tshivenda frost-placement bindings in learner Reading L2 and paired Reading slides 14–15; only their still images, asset-size entries, offline invalidation, and historical proofs.
- Evidence type: exact source/target bindings, complete before/after text and native snapshots, all 21 Tshivenda Reading still hashes, focused tests, and root-rendered slide review.

## What was already done

The preceding source-semantic check accepted the L2 `kha` locative insertion, the slide 14 learner-reuse clause when replacing only the held segment, and the mixed slide 15 “hillside position” candidate. Its source, current-target, segment-boundary and limits are preserved in [the accepted plan](../../study-translation-reviews/ve-reading-frost-placement-2026-10-07/root-accepted-plan.json). The original landform candidate using `thavha` is superseded by the accepted mixed option; it is not copied here.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| VE-READING-L2-LOCATIVE | Learner instruction did not make the “out of known low frost pockets” relation explicit. | Applied locally, unpublished | Only `kha` was inserted after the existing negative imperative. Species, sensitivity, named frost condition, and observe-before-planting sentence remain bound to source. Await root review and release gates. |
| VE-CG02 / Reading14 | Deck held the action clause in English while its observed-location suffix was already localized. | Applied locally, unpublished | Reused the learner instruction in the held source segment and retained `dzine na dzi vhona.` exactly once. |
| VE-CG01 / Reading15 | Deck held the no-guarantee hillside frost caution in English. | Applied locally, unpublished | Applied accepted mixed option with exact “hillside position” anchor; guarantee scope retained. `thavha` candidate rejected in favor of the root-accepted binding. |
| VE-READING-FROST-STILLS | Saved offline cards could show the previous wording at existing URLs. | Applied locally, unpublished | Replaced only Tshivenda slides 14–15. Root rendered and reviewed these two compressed frames at 1440 × 5436 and 1440 × 5400; no clipping was seen. The root retained the cards’ extra 36 px height. No other deck still hash changed. |
| VE-READING-FROST-CACHE | Saved copies of the two changed stills could remain offline after an update. | Applied locally, unpublished | Once-only migration deletes only the two exact still paths and URL query variants. Focused test covers stale variants, marker/repeat activation, replacement pack retention, other stills, audio, and shared film preservation. |

## Verification

- Typecheck: not run; root will run original gates after review.
- Full test suite: not run; root will run original gates after review.
- Focused tests: recorded in the handoff; no publication claim is made.
- Whitespace: pending root review.
- Output inspected: root rendered and inspected only the compressed VE Reading slides 14 and 15; no other frames were rendered in this continuation.
- Proofs: `current-binding.json`, `root-accepted-plan.json`, `exact-file-proof.json`, `native-registry-proof.json`, and `all-asset-sha-proof.json`. The exact file/native history layer validates the complete current files and registry before reconstructing older dated claims.
- Limits: source-semantic acceptance is not fluent-speaker or local farming approval. No language approval or publication has occurred. `PLAN_VERSION` was not changed. Main jobs and deployment remain pending.

## Next continuation

Root review the complete diff and the two rendered frames, run the repository’s original typecheck/full-suite/whitespace gates, then complete the existing native-preview and publication checks. Until those steps finish, the accepted candidate remains an unpublished machine draft.
