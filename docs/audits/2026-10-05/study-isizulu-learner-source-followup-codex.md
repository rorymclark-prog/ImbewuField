# Core Study isiZulu learner source follow-up — 2026-10-05

- Auditor: Codex, with separate semantic and implementation checks.
- Reviewed revision: `ee4afe0d05acdb4f22ea0de046cb1e63d47fd79a` plus this branch's scoped learner changes.
- Deployment inspected: this batch is not deployed; exact preview and phone review remain required.
- Previous audit: [isiZulu source-pairing audit](study-isizulu-source-pairing-codex.md), carrying `STUDY-ZU-001`–`005` and `STUDY-RES-002`.
- Scope: all 33 learner review drafts in the ten core isiZulu modules, source binding, source panels and conservative meaning repairs.
- Evidence type: exact source comparison, independent semantic checks, resolver and code review; publication gates pending.

## What was already done

PR #939 is production-verified at the reviewed revision. Its regional outcome
cards and assessments are retained. The separate Claude handoff covers remaining
Sesotho, Tshivenda and Xitsonga Soil/Water slide prose; this branch changes neither
those decks nor their learner registries.

The legacy isiZulu review drafts were compared with current canonical English
before recording source snapshots. Structural agreement alone was insufficient:
independent checks identified added explanations, missing premises, timing and
technical-term ambiguities. The conservative repairs retain exact technical
English where a local term could change the instruction. These checks provide
machine-draft semantic evidence, not fluent-speaker or local-farming approval.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-ZU-001 | isiZulu learner drafts lacked exact English panels and stored source binding. | Implemented; needs preview verification | Static snapshots cover all 33 current sources, including ordered options, indices and image descriptions. Any source drift withdraws the entire review draft. Student source panels now include isiZulu. Verify actual phone body, key points and answered feedback before publication. |
| STUDY-ZU-002 | Small Livestock L2 included a route instruction absent from the learner source and had an extra paragraph. | Implemented; needs preview verification | Remove only the learner-body route sentence and join the matching paragraph continuation. The instruction remains in its narration source; audio and media are preserved. Current body correspondence is 299 English/299 isiZulu paragraphs across 33 lessons. |
| STUDY-ZU-003 | isiZulu decks/offline packs lack simultaneous exact source pairing. | Open | This learner batch does not change the 240 deck images or narration tracks. A separate coherent deck/source/offline batch remains required. |
| STUDY-ZU-004 | Legacy images inconsistently mark draft status. | Open | Existing artwork remains unchanged. Consistent player/offline labels must be checked in the deck phase; four earlier samples do not prove all-frame coverage. |
| STUDY-ZU-005 | Historical handoffs disagree with current draft visibility. | Partial | Preserve previous records. This follow-up records current draft visibility and source protections; it does not upgrade any text or narration to human-approved status. |
| STUDY-ZU-006 | Several legacy learner fields changed current English meaning. | Implemented; needs final verification | Scoped repairs restore isolation guidance, subscription income, source timing, site factors and exact warning limits. Remove explanations absent from the learner source. Preserve correct answers, species and all unlisted text. See the final repair packets and preservation proof. |
| STUDY-RES-002 | Full regional Study translation and app coverage remain incomplete. | Open | This batch does not prove complete deck prose, translated image descriptions, app chrome or licensed narration. Continue those scopes separately. |

## Source comparison records

- [Introduction, Reading and Livestock semantic check](../../study-translation-reviews/ISIZULU-INTRO-READING-LIVESTOCK-SEMANTIC-CHECK-2026-10-05.json).
- [Seven-module semantic check](../../study-translation-reviews/ISIZULU-SEVEN-CORE-SEMANTIC-CHECK-2026-10-05.json).
- [Field-by-field assessment supplement](../../study-translation-reviews/ISIZULU-SEVEN-CORE-ASSESSMENT-SUPPLEMENT-2026-10-05.json): supersedes the earlier blanket assessment uncertainty; each disposition remains historical evidence.
- [Final title/body/alt check](../../study-translation-reviews/ISIZULU-TITLE-BODY-ALT-FINAL-CHECK-2026-10-05.json).
- [Supplemental technical repair check](../../study-translation-reviews/ISIZULU-SUPPLEMENTAL-TECHNICAL-REPAIRS-CHECK-2026-10-05.json).
- [Final accepted learner repairs](../../study-translation-reviews/ISIZULU-CONSERVATIVE-LEARNER-REPAIRS-2026-10-05.json) and [preservation proof](../../study-translation-reviews/ISIZULU-CONSERVATIVE-LEARNER-REPAIRS-PRESERVATION-PROOF-2026-10-05.json): 19 approved operations across 18 unique lesson fields, with the initial 15-operation check preserved as history.
- [Independent source-binding code check](../../study-translation-reviews/ISIZULU-SOURCE-BINDING-INDEPENDENT-CODE-CHECK-2026-10-05.json): root subsequently added same-count paragraph reorder and malformed quiz/options test cases without weakening the earlier safeguards.

The Reading body already preserves its canonical “can still spread” sentence;
the “favoured by” correction belongs only to its quiz rationale. No unnecessary
body rewrite was applied. All 32 canonical image descriptions remain English,
with one absent description; this is a translation gap, not a translated-alt claim.

## Verification and limits

- Root checked all 33 stored source projections against canonical English and the
  repaired body paragraph alignment. Focused source-binding tests exercise actual
  source edits and same-length reorders, not just counts.
- Ordered root typecheck, full suite (4,613 passed, zero failed, one existing TODO)
  and whitespace check passed for content commit `aa5271b1`. Exact-head CI,
  preview phone review and production verification remain pending.
- No narration playback, complete deck audit, cold-start offline or full-course
  offline claim is made. Existing narration/media hashes must remain unchanged.
- This changes learner presentation. `PLAN_VERSION` and saved geometry remain unchanged.

## Next continuation

Finish local gates and root phone verification, publish a coherent learner batch,
then add exact-source deck/offline comparison without silently replacing existing
isiZulu narration. Continue ordinary alt text and app gaps with independent checks.
