# Core Study Market L2/L3 ordinary learner completion — 2026-10-05

- Auditor: Codex implementation and scoped source review; parent review outstanding.
- Reviewed revision: `bde761b33dc4f587746d60b5fe77d881f29b80ca`, branch `codex/regional-market-learner-completion-20261005`, plus local changes.
- Deployment inspected: Not inspected by this implementer.
- Previous audit: [Learner residual finding register](../2026-10-04/study-learner-residual-codex.md), carrying `STUDY-RES-002`; [Market L1 completion](../../study-translation-reviews/MARKET-L1-ORDINARY-COMPLETION-2026-10-05.md).
- Scope: Market and Community lessons 2 and 3, Sesotho, Tshivenda and Xitsonga learner field targets.
- Evidence type: Native registry/source/resolver tests and immutable baseline reconstruction; no fluent approval or browser appearance claim.

## What was already done

Market L1 completion, module cards and existing regional deck/media work remain separate historical batches. Rory authorized ordinary regional prose translation, retention of difficult English terms and visible source pairing as unreviewed drafts. Canonical teaching content is preserved.

The earlier implementer left 37 proposed target-field replacements and durable source/current/final proof. Final review restores one distractor to its exact prior target, leaving 36 actual changes and five unchanged reviewed tuples. The temporary candidate, final-proof and implementation-plan files are no longer available. The retained [applied packet](../../study-translation-reviews/MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-APPLIED-2026-10-05.json) contains all 36 changed source/current/final tuples, five unchanged accepted tuples and 25 bounded repair targets/reasons. A separate native import of all three registry files from `bde761b` confirmed the complete L2/L3 baseline records exactly. The [native baseline](../../study-translation-reviews/MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-BASELINE-2026-10-05.json) is unchanged. No claim of independently recovered temporary review evidence is made. A subsequent independent source review approved four narrow repairs: preserve nearest-buyer superlatives in all three L3 comparison paragraphs and retain the Xitsonga distractor’s exact “all varieties without labels” scope. The final proof carries these four additional reasons.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary English holds remain within regional learner lessons. | Implemented for this bounded batch; wider finding remains open | 36 changed fields in Market L2/L3; five accepted final fields match baseline. All six bodies retain twelve paragraphs in canonical order. Tests compare actual paragraph changes and every unlisted paragraph against the immutable prior target. |
| STUDY-MARKET-001 | Earlier tests describe partial learner holds and deck reuse mappings as if they were current. | Historical claims reconstructed with dated reason | `market-l2-l3-completion-checks.ts` verifies native source/final target and visible machine-draft status before reversing only the accepted changes for the earlier batch. Historical resolver checks first verify the actual final resolver target. The existing L1/L2 mapping reconstructs its original 18 replacements and L1 completion before applying L2 on an exact prior/source edge. No assertion was removed. |
| STUDY-MARKET-002 | Preserved slide 15/18 wording can differ from the later fuller learner text. | Explicitly preserved; future deck work remains separate | Three historical tests retain exact live deck English/status/manifest checks and compare to the validated prior learner reconstruction. No deck, media or audio bytes changed. Any future deck alignment must be source checked and visually inspected. |
| STUDY-MARKET-003 | Language fluency and visible presentation of the revised prose are unverified here. | Needs verification | Fluent facilitator review remains outstanding. Parent can inspect Study → Market and Community → L2/L3 in ST/VE/TS, including marked drafts and exact English source pairing. |

## Verification

- Typecheck: `npx tsc --noEmit` passed locally on Node 26.5.0.
- Full test suite: `npm test` passed with exit 0: 4,672 tests, 4,671 passed, zero failures and one pre-existing shape-sync TODO, 85.04 seconds. First run exposed 15 obsolete historical Market claims; the dated reconstruction preserves their coverage.
- Focused learner tests: 49 passed, zero failures before the additional negative reconstruction and nearest/label scope guards. Six final scoped tests passed; the final full suite includes all new guards.
- Whitespace: `git diff --check` passed after the full suite.
- Output inspected: Actual native source/target tuples and resolver output; no browser/deployment inspected by this implementer.
- Other limits: No fluent approval. No paid render. This changes learner prose; it changes no sheet picture. `PLAN_VERSION`, canonical sources, species names, numeric claims, quiz indices, unlisted fields, illustration descriptions and media/audio are preserved.

The final-native tests validate all 41 source/current tuples, the exact 36 changed targets, all 72 body paragraphs and 25 bounded repairs. They check reliability and only-when conditions, sale-price retention, income prediction, seed permissions and highest/shortest comparison scope. Negative tests alter a final target and its source pair and require reconstruction to fail.

## Next continuation

Parent owns final diff review, release note, commit, push and release verification. No commit or push was made by this implementer. Publish visibly as unreviewed only after the parent's gates; obtain facilitator feedback without treating this mechanical source review as language certification.
