# Study blind-reviewed corrections audit — 2026-10-12

- Auditor: Codex; genuine target-only Claude model back-translations checked passage by passage against frozen English by Codex.
- Reviewed revision: production base `74b0d72a3d49ac90503db436ee79e56248b3a350`, branch `codex/blind-reviewed-study-corrections-20261012`, with local bounded corrections and explicit historical guard composition.
- Deployment inspected: no preview of this correction branch yet.
- Previous audit: [Reading titles and least-intensive action](../2026-10-08/study-reading-title-lightest-codex.md). Carry forward STUDY-READING-COMP-003.
- Scope: nine target corrections; five paired silent cards; existing learner/native source pairs; one selective offline image refresh.
- Evidence: actual target-only model results and provenance, full root source comparison, primary lexical references for the two livestock words, complete before/after runtime objects and file spans, actual compressed card pixels, causal preservation and corruption checks.

## What was already done

PR991 and PR993 are production verified, including both domains, at the current base. Earlier four-card Reading/Vegetables changes and their prior evidence are retained. Their old audit's unpublished status is historical. No previous successful suite or accepted phone review has been repeated for this batch.

The original Agy bulk report is rejected as exhaustive evidence: copying English sources as regional back-translations and inspecting superseded images does not establish semantic review. The replacement genuine audit has 8748 unique passages read in full by root, with immutable binding/provenance checks. Its 2586 notes include uncertainty, deliberate English holds and rejected reviewer claims; they are not a defect count. The final 66 have no saved result after an external classifier interruption. No retry or bypass is attempted, and root is source-exposed to those 66.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-BLIND-ST-INTRO22-001 | Ordinary older-neighbour and worst-wind wording remained English in the silent Sesotho field action | Implemented locally; unpublished | Independently checked bounded wording; English source, count and action sequence unchanged; recorded ST edition unaffected. |
| STUDY-BLIND-TS-INTRO5-001 | Paired card used buys where source and learner body say sells | Implemented locally; unpublished | `xavaka`→`xavisaka` in the paired cell only; learner wording already correct. |
| STUDY-BLIND-TS-INTRO22-001 | Older-neighbour and worst-wind spans remained English | Implemented locally; unpublished | Exact mixed source segments retained, independently checked noun phrase/superlative and concord; remaining grammar unreviewed. |
| STUDY-BLIND-READ-OBSERVATION-001 | Ordinary observation phrase remained English in VE/TS Reading learner bodies | Implemented locally; unpublished | Only that clause changes; whole paragraph and design/earthworks permission safeguards retained. One obsolete TS hold metadata row removed. |
| STUDY-BLIND-ZU-WATER-ALT-001 | Illustration description implied moving down at speed rather than slowing runoff | Implemented locally; unpublished | Bounded description predicate correction; canonical illustration, site conditions and narration unchanged. |
| STUDY-BLIND-TS-MARKET3-001 | Card heading meant finding true cost rather than Learning Outcomes | Implemented locally; unpublished | Exact canonical English heading retained as an explicit English hold; no regional heading claimed. |
| STUDY-BLIND-ST-LIVESTOCK6-001 | Shake-the-birds verb did not express moving birds | Implemented locally; unpublished | `Sisinya`→`Suthisa` only. Genuine fresh target-only result accepts move/shift-aside; existing before/first grammar ambiguity remains. |
| STUDY-BLIND-TS-LIVESTOCK-QUIZ-001 | Winter distractor used summer despite its inline English gloss | Implemented locally; unpublished | `ximumu`→`xixika` only; exact English option, position 3 and correct index 1 unchanged. |
| STUDY-BLIND-CACHE-001 | Existing packs could retain old wording at unchanged image URLs | Implemented locally; unpublished | Five exact paths/query variants retired once; audio, movies, recorded ST and unlisted cards preserved; actual preview/offline review pending. |
| STUDY-READING-COMP-003 | Exhaustive completion and linguistic approval remain unproven | Open | 8748/8814 independent audit rows checked; final 66 external failure, further uncertainties and fluent/farming review open. |
| STUDY-AUTHENTICATED-STATES-001 | Assignment deadline/module-unlock screens lack authenticated learner proof | Blocked on test learner access | Public sample has no assignments. No screenshot or result is fabricated. |

Primary lexical evidence: [Mabille Sesuto–English dictionary](https://emandulo.apc.uct.ac.za/collection/FHYA%20Depot/Mabille_Adolphe_Sesuto_English_Dictionary.pdf), PDF 438/443, printed 427/432; [DSAC Multilingual Mathematics Dictionary](https://www.dsac.gov.za/sites/default/files/2023-11/Multilingual%20Mathematics%20Dictionary.pdf), PDF 150/165, printed 135/150. These support the narrow lexical distinction, not whole-sentence fluency or farming approval.

## Verification

- Record stage: verified source cut before exact-head preview and publication. Release outcome is recorded on issue #35.
- Original typecheck: passed on Node24 after composing the declared successor/caller projections.
- First original full suite: terminal exit 1, 5061 tests, 5020 passed, 40 failed, no cancellations and one existing TODO. Actual failures were preserved and inspected. Most shared a stale caller/disk paired-file comparison; the remaining dated observation/image and binary-reference claims were composed with the exact new source/media layer. A corrected original full run remains required before publication.
- New focused guard: six passed, including same-size live-source and unlisted-image corruption in isolated fixtures. Isolation avoids damaging live inputs of concurrent full-suite workers.
- Worker checks: actual live function preserves unrelated saved media, rejects unintended audio deletion, and retains redownloaded corrected cards on the second activation. No network fetching.
- Historical composition: every original assertion expression retained verbatim across 39 dated owners. Two failed focused runs exposed stale successor comparisons and a string/Buffer boundary bug, which were corrected without deleting coverage. One slow focused run was interrupted, never counted as a pass. The final six-file focused run passed all 25 checks, zero failures/cancellations, in 74.4 seconds. Synchronous historical read scopes validate the complete live correction layer at both boundaries; a deliberate mid-scope disk mutation is rejected.
- Focused failure repairs: six of eight first probes passed; the remaining Reading learner comparison and old Small Livestock image comparison were repaired. Final four probes passed, including the corrupt-new-card rejection. All eight current correction/cache checks passed. Every original assertion expression is retained verbatim across all 46 changed test files; callers receive a fully validated exact predecessor before dated comparisons.
- Second original full run: deliberately interrupted after the adjacent Reading learner-versus-native comparison was confirmed. Actual terminal exit 1: 4999 tests, 4991 pass, one failure, six cancellations, one existing TODO. It is not a pass. The missing identical predecessor view was then applied; the entire five-test Reading claim file passed. A final corrected original full run is required.
- Third original full run: deliberately interrupted after two late Market preservation errors were reported. Actual terminal exit 1: 5003 tests, 4996 pass, two failures, four cancellations, one existing TODO. The tests had read the new TS Market3 card against its dated predecessor and passed a new manifest to a predecessor comparison. Both exact guarded views were composed. The whole three-test Market media file then passed, including the original corruption probes. Original typecheck passed; all original assertion expressions remain intact across 47 changed test files.
- Final Market-composed original full suite: terminal exit 0, 5062 tests, 5061 pass, zero failures, zero cancellations and one existing TODO; duration 3448708ms. All prior failed/interrupted evidence is retained and is not counted as a pass.
- Whitespace: passed. Release-note content identity and exact-head gates remain pending.
- Output inspected: five PNGs and their actual compressed 1440×5400 WebPs; target, exact English, draft warning and footer visible without clipping. New exact-head 390px preview and existing-route saved-pack review pending.
- Complete layer: eleven whole source files, five measured images, every unlisted measured asset in the 1936-file inventory, canonical source and recorded Sesotho assets protected by the successor proof.

This changes the picture in five silent cards. PLAN_VERSION stays unchanged. No audio is added or rewritten. These remain unreviewed drafts with exact English; there is no fluent-speaker, local-farming, pronunciation or Shangani approval.

## Next continuation

The original full source suite is complete. Review the final actual diff, update this record and notes with actual results, push the finished branch once, and require both exact-head jobs, native build identity, root 390px source/status/footer/answers/silent optional-English/saved-pack checks, history-preserving merge, main jobs, deployment and both production build identities before the final issue #35 ledger. Full goal remains open while independent final 66 review and authenticated learner states lack evidence.

[Complete source/media predecessor and successor proof](../../study-translation-reviews/blind-reviewed-corrections-2026-10-12/README.md).
