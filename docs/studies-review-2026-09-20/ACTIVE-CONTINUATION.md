# Active Studies continuation — 22 September 2026

Rory explicitly renewed sustained work after the previous response stopped overnight.
Continue authorised work across coherent lessons and units. Do not stop at another
planning/report-only checkpoint. Save intended changes about every ten minutes;
push complete batches, inspect CI and actual visuals, publish only release-ready work.

## Goal and persistence

The requested renewed goal is to complete Studies teaching/media and app learning
pathways to the agreed quality standard, beginning with Soil Health, reusing existing
assets before spending credits. Finish unblocked Finance/Design/app work alongside
held animation decisions. Preserve calibrated text, quizzes and species lists.

The app goal remains the earlier unfinished blocked goal. `create_goal` rejected
replacement; do not falsely mark it complete or claim a new app goal exists.
An ACTIVE hourly thread heartbeat `continue-imbewufield-studies` now provides
continuation across turns. It should pause when the authorised scope is complete
or Rory stops it. Notify only for meaningful completed units, failures or decisions.

## Current location

Worktree: `/Users/roryclark/.codex/worktrees/studies-finance-unit/ImbewuField`
Branch: `codex/studies-animation-direction`
Saved review: commit `869f2247`; source in
`docs/media/studies-animation-quality/soil-lesson-review/`.
Complete-media backup in Downloads/ImbewuField-Animation-Quality-2026-09-22.
Local review server: port 4372 (restart if absent).

## Immediate work

1. PR500 is published at ad44fd74. Production deployment, build identity and
   exact live slide16/18 bytes are verified. Do not repeat this release.
2. Soil lesson3's two still replacements, mobile controls and cache handling are
   implemented and verified. Do not regenerate these or repeat their review.
   Soil slide14 movie candidates remain held for joint review.
3. Soil lessons1–2 passed a teaching/media-fit review with no replacement brief.
   Lesson1 reviewed actual stills and sampled tour contact views; this is not full
   temporal or practitioner approval. Lesson2's attempted uninterrupted offline
   play-through had no observed end state, so that one check remains unverified.
4. Continue a concrete unfinished task from the remaining Finance/Design narration
   gates or coordinated core fact-check corrections, subject to existing content
   protections. First establish whether its scripts/voice samples already exist.
   Do not redo deployed app guides, finished previews or media inventories. Human
   acceptance and protected-content decisions must remain explicit dependencies.

Finance F1 already has three narration drafts, and the app reading matches them.
An exact-text English candidate pack for F1.1–F1.3 was recorded and technically
checked on 22 September; see `FINANCE-F1-NARRATION-REVIEW.md` and its local listening
pack. It remains outside the app pending listening, bookkeeping and learner review.
The remaining Finance/Design scripts and voice choice are not thereby accepted.

Design D1.1–D1.3 now have short English candidate scripts grounded in the existing
manuscript and busy-yard case. One D1.1 voice sample is technically checked in a
local review pack; see `reserve/design/D1-NARRATION-CANDIDATE.md`. None is accepted
or integrated. The next step is human listening and practitioner/learner review,
while other unblocked Studies work may continue.

## Boundaries

No credits spent since the duplicate Quality soil trial. Conservative remaining
batch budget: 2,400 credits. “Not accepted” or “export unresolved” is not “missing”.
All49 core video slots /57 language variants have files and posters. Fast soil
and bee originals are recovered. See SOIL-COMPARISON-REVIEW.md for exact findings.
Fluent isiZulu and practitioner/human listening review remain outstanding; no
invented approval. The existing A-frame and principle-attribution issues require
coordinated editorial/media corrections; do not silently rewrite protected content.

## Implementation checkpoint

- Reuse search found no defensible existing illustrations for Soil16/18.
- Two new built-in imagegen stills now replace those slides (zero Flow credits).
  Exact prompts/provenance: soil-stills-review. Narration and assessment unchanged.
- Scoped DeckPlayer arrow shortcuts implemented with behavioral regression test.
- Two-still-only cache migration and idempotence/preservation test implemented.
- Dependencies refreshed into this worktree (previous shared symlink was removed,
  its target preserved) to match main’s new Rive dependency.
- Local production-build app at4373; browser review and the full suite completed.

## Verified release batch

Implementation checkpoints:6a757544 and dec51ea2. Two stills visually inspected in
actual app at desktop/390px; independent review accepted qualitative teaching fit.
Soil saved all51files; both new stills and narration played with tab network disabled.
Native-audio arrow seeking no longer advances slides; focused deck navigation works.
Phone Play/Back/Next controls no longer squeeze/wrap their labels.
Final typecheck,3,681passing tests(0fail,1existingTODO),whitespace and production build
passed. CI caught an update-tour link failure after release-note insertion; the initial targeted-check shell exit masked that failure. Corrected the guide destinations without weakening its test.
No Flowcredits spent; no animation accepted or re-generated. Publication/CI next.

The latest main b8c7a6a4 app-guide screenshots and scrolling improvements are merged
and preserved. Release notes now link to Studies and the concrete invoice guide.
Compost lesson2 current media was independently reviewed and fits the unchanged
teaching; no replacement is justified. Offline production-build reopening succeeded
(the tour tips initially obscured the controls; closing them restored access).

The corrected release-note destinations now pass both update-tour tests. After
merging main, typecheck and the full suite pass: 3,683 tests, 3,682 passes,
zero failures, one existing TODO; whitespace is clean. Final compost play-through
was started offline but its end state was not observed, so do not mark it passed.

## Release checkpoint — PR500

PR https://github.com/rorymclark-prog/ImbewuField/pull/500 merged at
ad44fd74b98359aaad4ca3ec6943af7eac0fa1b9. Exact-head ad10af26 CI test and rules
jobs both passed in runs 35690201090 and 35690198377; preview 35690198389 passed.
Production deployment 35690531200 succeeded, as did main test run 35690531245.
Live build-info reports ad44fd7. Both new JPEGs returned HTTP 200 and matched
accepted local bytes/SHA256 exactly (slide16: 932,837 bytes; slide18: 795,928 bytes).
Independent Soil lesson1 review found no concrete media replacement need. Its
five sampled phases and stills support the observation task without claiming a
soil diagnosis. No full-motion or practitioner sign-off is implied.
