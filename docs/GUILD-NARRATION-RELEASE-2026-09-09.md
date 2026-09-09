# Guild narration release — 9 September 2026

The user explicitly authorised sending the current English and isiZulu guild scripts to speech.platform.bing.com and deploying the completed lesson. The English lesson replaces the old 20-track version with 51 narrated slides across 26 learning blocks. Existing lesson IDs and learner progress remain intact.

Microsoft synthetic voices: en-ZA-LeahNeural and zu-ZA-ThandoNeural, rate -12%. IsiZulu is recorded for review but is not in the learner language manifest: the existing first-language review gate remains. No human listening or pronunciation review is claimed.

The deck contains 25 distinct illustrations, each used once. Eight existing clips occupy their matching teaching slots. Clip 02 is locally trimmed branch pruning on a retained tree. Slide 43 explains whole-plant thinning, suitable biomass retained as mulch and regrowth management. No retired clip 07, additional Veo generation, universal nitrogen-fixer ratio or fixed nitrogen delivery claim is included.

Three reading lessons and six quizzes now agree with the deck. Source URLs are in guild-lesson-sources.json. The two scripts contain the same learner speech as the slide-aligned recordings; the isiZulu review appendix is excluded from speech.

Media verification checks source hashes, word-boundary text, decoded recording duration covering the last word, final saved video decoding and exact app audio copies. Four truncated saved recordings were repaired before release. Full-video audio uses continuous PCM before AAC encoding so segment encoder padding does not overlap. Visual review includes the rendered slides, dense-guild labels, pruning scene, thinning explanation and retained-mulch scene.

Validation: TypeScript and full test suite pass with zero failing tests. The repository retains one existing shape-sync TODO; this change neither deletes nor relaxes it. Existing app language-release and asset-disk/manifest checks are preserved. Two guild tests now catch missing slides/audio, mismatched media sizes and accidental reuse of the pruning clip to teach thinning.

A one-time service-worker migration removes the obsolete guild English audio cache before claiming clients. It preserves other lesson downloads and skips deletion after the revision marker is present. The behavioral regression test verifies both preservation and repeat activation. Learners are told to download the updated guild narration again.
