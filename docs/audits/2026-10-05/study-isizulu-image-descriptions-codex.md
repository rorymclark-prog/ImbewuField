# Core Study isiZulu image descriptions — 2026-10-05

- Auditor: Codex, with root's independent source/meaning and image review.
- Reviewed revision: `724f1d32a125d4a52fd8abc3ee0d6568dbcc52ea` on `codex/zulu-study-image-descriptions-20261005`, plus the scoped working changes.
- Deployment inspected: no; this batch has not been published or checked in a browser.
- Previous audit: [isiZulu learner source follow-up](study-isizulu-learner-source-followup-codex.md), carrying `STUDY-ZU-001`–`006` and `STUDY-RES-002`.
- Scope: 32 existing isiZulu learner `infographicAlt` fields; canonical English source, exact illustration assets and fallback on source drift.
- Evidence type: native registry/resolver checks, frozen source snapshot, image path/hash checks and focused tests.

## What was already done

The prior learner follow-up added exact frozen English snapshots and a fail-closed
source resolver for 33 isiZulu lesson drafts. It identified image descriptions as
an unfilled learner field. This batch adds only that field to 32 existing drafts.
It preserves the 33 lesson records, bodies, titles, key points, quiz wording and
answer positions, existing media and the source snapshot authority.

The accepted targets come from the root-repaired packet, not the repository's
older candidate packet, which has four superseded target strings. Root read all
32 source/target pairs and reviewed the corresponding image assets; eight targets
were bounded repairs to the earlier proposals. Technical phrases remain in
English where the image or term does not support a safer localized claim. The
resulting fields remain `machine-draft` under the existing `review-draft` state.
No fluent-speaker or local-farming approval is claimed.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-002 | Full regional Study prose and app coverage remain incomplete. | Open | This batch covers 32 isiZulu image descriptions only; ordinary prose, other languages and app chrome still need scoped work. |
| STUDY-ZU-001 | isiZulu learner drafts need exact English source pairing and source-drift protection. | Implemented for current frozen sources | All 32 new descriptions use the matching canonical English `infographicAlt`; changing any paired source withdraws the complete lesson draft to current English. Preserve and extend these tests with future source changes. |
| STUDY-ZU-002 | Small Livestock L2 had a learner-only movement instruction and paragraph mismatch. | Implemented; unchanged here | Existing body repair and source checks are retained. This batch changes no lesson body or narration. |
| STUDY-ZU-003 | isiZulu decks and offline packs lack exact English pairing. | Open | No deck or offline files changed. Continue as a separate source-paired deck batch. |
| STUDY-ZU-004 | Existing artwork does not consistently show draft status. | Open | This adds learner image-description text; it changes no JPG, animation, player status label or offline pack. Review status presentation separately. |
| STUDY-ZU-005 | Historical handoffs disagree with current draft visibility. | Partial | This record updates image-description status only; preserve historical handoffs and reconcile them with later exact-head evidence. |
| STUDY-ZU-006 | Legacy learner fields differed from current English meaning. | Implemented; unchanged here | Existing conservative learner repairs and their preservation evidence remain unchanged. |
| STUDY-ZU-007 | Thirty-two canonical image descriptions previously had no localized isiZulu draft. | Implemented as unreviewed candidates | The applied packet binds each target to its frozen source and actual existing image bytes. English technical holds and image uncertainty are recorded per field; fluent and local review remains open. |

## Applied records

- [Frozen registry and image baseline](../../study-translation-reviews/ISIZULU-IMAGE-DESCRIPTIONS-2026-10-05-BASELINE.json) records all 33 prior learner entries, their unlisted-field hashes, and the 32 missing-alt states.
- [Applied image-description pairs](../../study-translation-reviews/ISIZULU-IMAGE-DESCRIPTIONS-2026-10-05-APPLIED.json) records exact current English, target text, draft state, root review provenance, technical English retained, image URL, dimensions and byte hash.
- The working tree preserves all pre-existing untracked Playwright and reviewer files; none is part of this implementation.

## Verification and limits

- The native resolver confirms the 32 exact-source drafts remain visibly unreviewed and returns English fallback if any paired image-description source changes.
- The focused image-description test passes 3/3 checks: the full 32-field table and image hashes, all 33 registry records' unlisted fields, and source-drift fallback for each changed source.
- Root ran the ordered typecheck, full suite and whitespace gates: 4,665 passing tests, zero failures and one unchanged shape-sync TODO. The three focused image-description checks remain registered in the full suite.
- Existing illustration assets and URLs are byte-for-byte unchanged. This implementation does not establish actual learner-screen layout or fluent isiZulu approval.
- No audio, body, quiz, deck, species, number, saved geometry, `PLAN_VERSION` or ST Introduction hash was changed.

## Next continuation

Run the ordered full gates and review the source/test/document diff. Then check the exact preview's isiZulu alt rendering beside English on a narrow phone. Keep uncertain technical image language visible in English until an appropriate language and subject review supports a change. Continue the open `STUDY-RES-002` learner/deck/app work separately.
