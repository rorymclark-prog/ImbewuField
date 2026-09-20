# Studies media continuation — 20 September 2026

Source: production source `a9b3f5a`, checked from freshly fetched origin/main. This is a dated production snapshot, not a second readiness authority.

## Where the work stopped

All 10 modules have reading lessons, 33 lesson illustrations and 240 English slide recordings. Seeds has 24 isiZulu recordings and Plant Guilds has 51. Both have registered English/isiZulu decks and eight animation slots each. All files referenced by those narration/deck/animation manifests exist on disk. Existence is not visual or linguistic sign-off.

The latest substantial media work was the September Plant Guilds rebuild: 51 slides, 25 distinct illustrations and eight approved clip slots. Its isiZulu narration was released by Rory's explicit exception; fluent review remains pending. Seeds is the only module currently returned as fully complete by the app's readiness rule.

| Module | English clips | isiZulu clips in app | Deck languages | Animation slots | Missing Watch clips |
|---|---:|---:|---|---:|---:|
| seeds-sovereignty | 24 | 24 | en, zu | 8 | 0 |
| intro-permaculture | 22 | 0 | Missing | 0 | 3 |
| reading-landscape | 21 | 0 | Missing | 0 | 4 |
| water-harvesting | 24 | 0 | Missing | 0 | 6 |
| soil-health | 20 | 0 | Missing | 0 | 3 |
| vegetables-staples | 18 | 0 | Missing | 0 | 0 |
| plant-guilds | 51 | 51 | en, zu | 8 | 0 |
| food-forest | 20 | 0 | Missing | 0 | 3 |
| small-livestock | 20 | 0 | Missing | 0 | 3 |
| market-community | 20 | 0 | Missing | 0 | 3 |

Eight modules lack registered decks. They total 165 slide positions (330 image positions if both languages are produced). These same modules lack 165 isiZulu audio tracks in the app. There are 25 missing Watch animations; the August inventory's 28 is stale after the Guilds rebuild. Vegetables has no authored Watch slot; do not invent one to satisfy a quota.

## Work completed in this continuation

- Exported Water Harvesting's 24 isiZulu speech blocks from the current source without rewriting them.
- Generated 24 review recordings with the existing Microsoft synthetic voice, zu-ZA-ThandoNeural, rate -12%: 597.6 seconds in total.
- For every clip, compared normalized service word-boundary text to the entire source, decoded the saved file, and checked its duration covers the final word. All 24 passed. This is structural verification, not a human listening or pronunciation review.
- Saved source/audio hashes, word boundaries and timings in verification.json; created one combined review MP3.
- Regenerated 10 bilingual review packets. They contain 17 mechanical flags for a human to inspect, not 17 proven translation errors.
- Extracted the 25 missing animation slots with verbatim English and isiZulu source passages into ANIMATIONS.md and animation-slots.json.

Working pack: `/Users/roryclark/Downloads/imbewu-studies-2026-09-20/`. Audio remains there as REVIEW material; no new learner-facing audio or app manifest was added. No production deployment occurred.

## Accurate review status

The course:status command's phrase “reviewed” means the script has no recognized blocker phrase. That is not evidence of human sign-off. Water Harvesting's original commit 5f2b777 explicitly says only structural checks were done, and language/agronomy review remained human work. Its new recordings are therefore labelled review copies.

The seven other unrecorded isiZulu scripts explicitly remain drafts. Plant Guilds also retains a pending fluent-review record despite its owner-authorized publication. Do not remove their review markers or extend the Guilds release exception to other modules without authorization.

The status command prints “2/10 fully produced” from media presence, while app readiness correctly excludes Guilds pending its review. Use the distinctions above, not that summary, when discussing completion.

## Next production sequence

1. Water Harvesting: listen to and review the 24 isiZulu clips against the paired text; approve/correct the script before learner release. Build its English and isiZulu slide decks and six matching animations (slides 4, 7, 9, 12, 16, 21).
2. Complete each remaining module as one unit: review translation, record per slide, build both decks, produce its exact Watch clips, wire manifests, then test playback and offline use on phone-sized screens.
3. Preserve the current course words, farming figures, species and quizzes. Any content changes require separate author review.
4. Before declaring the course complete, revisit the August art audit's six findings and curriculum gap audit. They are historical findings, not reverified defects in this continuation. The current course:calendar still reports 25 scheduled weeks out of the promised 36; media completion alone does not settle the remaining 11 weeks.

No lesson bodies, quizzes, species, geometry or PLAN_VERSION were changed. App code was not modified. Fresh visual inspection of existing decks and playback on learner devices was not performed in this status-and-recording batch.

## Verification of this checkpoint

`npx tsc --noEmit` passed; `npm test` passed 3,629 tests with zero failures and one existing TODO; `git diff --check` passed, in that order. New recording pacing check found no outliers across all 24 clips (median 1.217 words/second). The complete review pack is also saved as `/Users/roryclark/Downloads/imbewu-studies-2026-09-20.zip`.
