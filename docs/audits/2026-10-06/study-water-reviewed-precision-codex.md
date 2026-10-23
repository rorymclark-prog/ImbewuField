# Water regional draft precision audit — 2026-10-06

- Auditor: Codex implementation and independent semantic checker; root reviewed native/deck diffs, compressed images and independently ran the final gates.
- Reviewed revision: `f3b75a58b390c9312e5fa1df35e81fd40e2cb051`, branch `codex/regional-water-reviewed-precision-next-20261005`, plus the scoped accepted changes in this commit.
- Deployment inspected: none; native phone preview and publication remain pending root verification.
- Previous audit: [Soil/Water material integration](../2026-10-05/study-soil-water-material-integration-codex.md), carrying `STUDY-RES-002` and `SOIL-WATER-MATERIAL-001` through `005`; [Soil fuller learner continuation](../2026-10-05/study-soil-learner-fuller-codex.md).
- Scope: nine Water learner paragraphs in South African Sesotho, Tshivenda and Xitsonga; 27 complete source-bound Water slide body fields; 20 silent paired stills and selective saved-still refresh.
- Evidence type: exact-source review, independent Agy report identity/triage, automated source and preservation checks, static compressed-image inspection. No fluent-language or physical-device approval.

## What was already done

The previous Water learner completion and four precise PR953 deck holds are retained. Historical Agy exports, proposals and earlier audit records remain unchanged. The independent review checked all 315 public Water source/draft units for report identity and triaged all 108 flagged rows before root accepted nine bounded precision repairs. Difficult English remains where semantic uncertainty was identified; retained English is not fluent approval.

The current accepted packet records exact source, previous target, applied target and provenance. The two low-store repairs retain the existing localized plan/what/when framing with the exact inline English predicate `stored water runs low`; they add no exhaustion or critical threshold.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Learner and slide drafts have different completion histories. | Implemented for this Water scope; remaining course coverage open | Nine native repairs and 27 source-bound deck fields are reconciled. Current source checks precede reconstruction of historical snapshots. |
| SOIL-WATER-MATERIAL-001 | VE moisture-depth disclaimer must retain exact scope. | Preserved and verified | PR953 `ve.4.body.1` target object equals base exactly. |
| SOIL-WATER-MATERIAL-002 | VE dam advice must retain suitable qualification. | Preserved and verified | PR953 `ve.12.body.1` target object equals base exactly. |
| SOIL-WATER-MATERIAL-003 | VE sanitation advice must retain qualified local advice. | Preserved and verified | PR953 `ve.20.body.0` target object equals base exactly. |
| SOIL-WATER-MATERIAL-004 | TS watercourse must not narrow to a river. | Preserved and verified | PR953 `ts.22.body.0` target object equals base exactly. |
| SOIL-WATER-MATERIAL-005 | Machine review cannot establish fluent or local farming approval. | Open | All targets remain visibly unreviewed; facilitator review follows publication. No Shangani comprehension approval. |
| WATER-PRECISION-001 | Demand comparison, low-store state, pooling, downstream safety, land scope, province-alone and already-operating conditions need precise source predicates. | Implemented; source and static output verified | [Native packet](../../study-translation-reviews/WATER-LEARNER-REVIEWED-PRECISION-2026-10-05.json) and [native application proof](../../study-translation-reviews/WATER-LEARNER-REVIEWED-PRECISION-PROOF-2026-10-05.json). Nine paragraph repairs only; every unlisted native field preserved. |
| WATER-PRECISION-002 | Remaining inherited slide clauses need current exact learner wording or bounded source compositions. | Implemented; static output verified | [Deck proof](../../study-translation-reviews/WATER-DECK-REVIEWED-PRECISION-2026-10-05.json): 23 exact current learner reuses and four bounded compositions, all complete exact-source paragraphs. |
| WATER-PRECISION-003 | Saved selected stills can retain earlier wording. | Implemented; automated cache behavior verified | Once-only migration deletes exactly the 20 selected still pathnames and query variants; unrelated assets remain cached. It performs no fetch and preserves narration and films. Native/offline learner verification remains pending. |

## Verification

- Typecheck: helper and root independently passed `npx tsc --noEmit`.
- Full test suite: helper and root independently passed `npm test`: 4,685 total, 4,684 passed, zero failures, one pre-existing explicit shape-sync TODO; process exit 0.
- Whitespace: helper and root passed `git diff --check`; staged whitespace check is part of the scoped commit gate.
- Source and preservation: all 12 complete learner bodies and three module registrations resolve as drafts; each accepted source mutation withdraws the complete draft. Rewinding only nine native paragraphs restores every unlisted field, metadata, status and correct index. Rewinding only 27 deck targets restores all three serialized slide arrays exactly, including all four PR953 repairs.
- Assets: exactly 20 compressed WebPs changed, 1440 × 5400, quality 88/method 6; 1,830 other media files retain exact hashes. Only the selected asset-size entries change. Canonical course data, Water English narration, audio registry, entire Sesotho Intro-containing registry, species, numbers and `PLAN_VERSION` remain unchanged.
- Output inspected: helper inspected all three contacts from actual compressed images; root reviewed those 20-frame contacts plus original compressed VE17 and TS22. Draft/source panels and counters remain intact; no visible clipping was found. [ST contact](../../media/water-reviewed-precision-2026-10-05/st-selected-contact.jpg), [VE contact](../../media/water-reviewed-precision-2026-10-05/ve-selected-contact.jpg), [TS contact](../../media/water-reviewed-precision-2026-10-05/ts-selected-contact.jpg), [asset proof](../../media/water-reviewed-precision-2026-10-05/frames.json).
- This changes the picture. `PLAN_VERSION` is unchanged.
- Limits: native phone UI, signed-in/offline learner behavior, deployed build verification, fluent language/local farming review and publication have not been verified in this step. An initial incorrect ST list was rendered only to a discarded temporary directory; only the final exact 20 selected frames were installed.

## Next continuation

Root reviews the scoped content SHA and SHA-bound concise notes/tour, then authorizes publication. After deployment, verify the actual build and native phone learner flows, including selected still download refresh. Facilitator review follows publication; keep all remaining difficult technical holds visibly unreviewed. No push, merge or deployment is performed by this helper before root approval. Unrelated QA remains untouched.
