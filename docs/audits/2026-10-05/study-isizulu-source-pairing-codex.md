# Core Study isiZulu source-pairing audit — 2026-10-05

- Auditor: Codex, with a read-only independent helper.
- Reviewed revision: `a5fd76db64e70fd69d6c5e449cc6b8ce4dda7a0b`.
- Deployment inspected: this audit is source review, not new browser verification.
- Previous audit: [Reading follow-up](../2026-10-04/study-reading-body-fuller-codex.md), carrying `STUDY-RES-002` as open.
- Scope: ten core isiZulu modules, learner source binding, deck status/source pairing and offline selection.
- Evidence type: source/resolver inspection and four sampled legacy JPGs; no repository implementation in this audit.

## What was already done

PR938 is production-verified at the reviewed main revision. It completed a scoped regional Reading batch; it did not establish isiZulu source pairing. All 33 isiZulu lessons currently resolve as visibly unreviewed drafts. The 240 isiZulu JPGs and narration assets exist; file coverage does not prove translation fidelity or paired English presentation.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Ordinary prose remains within regional drafts. | Open | The current outcomes batch addresses only scoped fields. No whole-project completion percentage is established. |
| STUDY-ZU-001 | isiZulu learner drafts lack visible exact English and source-drift binding. | Open | `app/student/page.tsx` restricts paired source rendering to ST/VE/TS; `lib/course-localization.ts` checks draft shape rather than exact source identity. Compare all 33 legacy drafts semantically against current English before establishing stored source snapshots; never stamp current source onto unchecked legacy text. Extend paired UI and fail-closed source checks. |
| STUDY-ZU-002 | Small Livestock L2 adds an instruction absent from current English. | Open | Current source has three paragraphs; isiZulu has four and adds `Hlela indlela abantu nezilwane abazohamba ngayo kule ndawo.` The helper identifies a people/animal route instruction absent from source. Independently check a conservative removal and paragraph alignment; do not add canonical advice. |
| STUDY-ZU-003 | isiZulu decks and offline packs lack simultaneous exact English source pairing. | Open | `lib/course-deck.ts`, `components/course/DeckPlayer.tsx` and `lib/offline-pack.ts` select localized artwork without a matching source panel/row. Bind source data to each actual slide, preserve existing narration and media, and verify phone/offline comparison. |
| STUDY-ZU-004 | Legacy images inconsistently mark unreviewed status. | Open | Sampled Intro 4 and Soil 12 contain draft labels; Reading 14 and Vegetables 12 do not. Provide consistent player status across every frame, including animated media. Four samples are not an all-frame visual audit. |
| STUDY-ZU-005 | Historical isiZulu handoff/queue claims disagree with the live resolver. | Open | Introduction handoff claims no publication; core review queue claims held lessons which now resolve as drafts. Preserve historical records and append current status/evidence rather than silently replacing prior findings. |

## Verification

- Typecheck/full suite/whitespace: not run for this read-only audit; the separate outcomes implementation has its own gates.
- Resolver inspection: 10 modules, 33 draft lessons, 299 English and 300 isiZulu body paragraphs. Sole count mismatch is Small Livestock L2.
- Output inspected by helper: original Intro 4, Reading 14, Soil 12 and Vegetables 12 JPGs. Root has reviewed the written evidence, not these four artwork samples.
- Limits: no fluent-language or local-farming approval; no complete 240-frame visual review, narration playback or cold-start offline test. The proposed repairs would change presentation; `PLAN_VERSION` remains unchanged.

## Next continuation

1. Finish and verify the current outcomes batch independently of these findings.
2. Semantically compare legacy isiZulu lessons to current canonical English, repair or hold mismatches, then implement exact source binding and paired learner UI with source-drift tests.
3. Add visible per-slide English source/status and offline source coverage while preserving all existing narration hashes.
4. Verify exact preview at 390px and representative saved packs, publish coherent batches, and update these finding IDs with evidence.
