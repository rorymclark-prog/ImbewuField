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

## 22 September continuation — offline and animation evidence

After downloading the full Soil Health pack online, the Compost lesson 2 player
ran all five slides with the browser offline and ended on “Keep Seed Pods and
Contaminants Out” with its control reset to “Play the lesson”. The lesson-specific
player showed no missing-media alert. A stale alert in the separate whole-module
player came from the earlier attempt before the pack was cached; it is not a
Compost end-state failure. This is device/browser playback evidence, not a
practitioner or language review.

The Small Livestock ducks clip (lesson 1 slide 7) and hive-to-flowers bee clip
(lesson 2 slide 9) were inspected through their full motion and at phone scale;
their movement supports the existing narration. The hens clip (lesson 1 slide 4)
shows the requested pecking but has pose jumps around 3–4 seconds. Trimming or
crossfading existing frames cannot produce a better coherent loop. A licensed
real-footage candidate from Pexels has since been prepared under a new filename
on the working branch. See `docs/media/studies-animation-quality/HENS-REAL-FOOTAGE-CANDIDATE.md`.
It does not establish an enclosure or a harvest sequence, and it is not yet
published or accepted by Rory.

Soil lesson 3 slide 14 is still held. The recovered Fast movie can be cropped to
remove vertical-face drips, but its rain is unequal across the two surfaces. A
new dry image with deterministic equal rain did not make splash versus mulch
interception legible at 390px without conspicuous synthetic marks. Neither
experiment was registered or published. No Google Flow credits were spent.
Reproducible local trial files are in the Downloads animation-quality review
folder; they are failed candidates, not course assets.

## Further 22 September continuation — review dependencies

PR504 is a draft candidate for the real hens footage and source-grounded F1.2
practice timeline. Its current preview and exact-head test, rules and preview
jobs passed. The hens clip has been inspected in the actual desktop and 390px
player. Rory's joint visual decision is still required before publication.
The proposed 100-credit Soil slide 14 Flow attempt also awaits Rory's explicit
choice; no credit was spent.

An independent full-motion review of Vegetables lesson 1 slide 6 exposed a
specific error in the 20 September visual review: at the end of the film the
seedling's root plug stands above the bed. The earlier claim that soil closes
around it is incorrect. Full-size 5.5-second and 7.5-second frames and a 390px
frame confirmed the issue. The published clip must not be described as a
completed transplanting demonstration. Its local source has the same ending,
so a verified new action or coordinated lesson/media decision is needed.

F2.1–F2.3 now have a concise English narration review copy drawn from the
existing embedded drafts. No voice asset or app narration was added. Local
bookkeeping, learner, human listening and fluent isiZulu review remain open.

Market Gardening lesson 1 slide 4's record labels proved unreadable in the
390px lesson player. The registered poster is a complete 1280×720 record
diagram, so the deck now offers an on-demand full-size still link on animation
slides. In the actual 390px local sample player, the link opened that asset in
a separate browser tab; tapping the image expanded it to its natural width for
panning, and opening it paused the playing movie. The lesson text and media
bytes were not changed. This improves inspection of dense diagrams; it is not
learner approval of the animation or its teaching.

Reading the Landscape slide 6's A-frame film has now been checked through its
full six seconds at source and phone width. Its held tool and plumb line are
coherent, but it shows neither reversal calibration nor successive contour
marks. The existing text, quiz and audio claims about speed, survey and
earthworks remain a coordinated correction, not a visual fix. The fact-check
follow-up records this media limit and the primary-source boundary.

Food Forest lesson 3 slide 16's sheet-mulching film has a different open media
gap. The final full-size frame still shows broad exposed cardboard while the
mulch remains piled beside it; this is also visible at 390px. The eight-second
loop therefore shows an in-progress setup, not the narrated cardboard-under-
mulch result. The clip was left unchanged rather than passing an incomplete
action as a finished demonstration.

The Food Forest lesson 3 overview still had a separate clarity gap: its first
panel placed cardboard over visible straw without showing a top mulch layer.
Straw can be a valid base layer; the image did not make the lesson's
cardboard-under-mulch relationship visible. A corrected four-panel
illustration now shows mulch over cardboard on soil, with a new asset path,
exact byte count, matching alt text and a narrow offline-cache migration.
The corrected JPEG was checked at full size and 390px and independently
reviewed. Its prompt, hashes and limits are in
`docs/media/studies-animation-quality/food-forest-sheet-mulch-still.md`.
The unchanged slide-16 movie remains incomplete; the still does not clear it.

The recovered eight-second Flow bee macro was paired with the existing
fourteen-second hive-to-flowers concept diagram for Small Livestock lesson 2
slide 9. A shorter 13.75-second muted clip now shows the route first and one
lifelike blossom visit second; the final encode is 1,330,202 bytes rather than
the 2.73 MB prototype. Full motion, poster and 390px views were inspected.
The macro shows contact with one blossom, not pollen deposited on a second
flower; it cannot prove fruit set or yield. The existing transcript/audio and
quiz were left unchanged. Exact provenance and source limits are in
`docs/media/studies-animation-quality/bee-hive-and-blossom.md`.
No new Flow credits were spent, and Rory's visual decision is still required
before release.

## Further media work — Water Harvesting and complete-action checks

Full-motion/phone reviews retained the existing Market seed-sharing, Soil
compost-materials, Intro earth-care, Small Livestock ducks, and Water roof-rain
Flow clips for the narrow actions each actually depicts. Their limits are now
recorded beside their slots in `docs/media/studies-animation-quality/COVERAGE.md`;
none needs a duplicate Flow generation. The Seed lesson animation was untouched.

Water lesson 3 slide 16's existing first-flush diagram retains a correct early
runoff → chamber/seal → later runoff to tank concept. Water lesson 4 slide 21's
greywater diagram now has a draft clearer source badge excluding kitchen/toilet
washwater and a visible “Non-food planting” badge by the generic tree. Its
17-second movie and poster were checked at full size/390px; the narrow source,
hashes, cache migration and limits are in
`docs/media/studies-animation-quality/greywater-media-correction.md`.
No site design, water-quality result or municipal approval is implied.

Further Water slide 4/7 review identified unsupported outcome/safety impressions
in the swale infiltration and homestead overflow films. Slide 12's wall-above-
spillway diagram has sound conceptual topology, but “size the dam to the
catchment area” in its caption/narration is incomplete without the existing
site/flow/qualified-design cautions. These require coordinated editorial/media
review; do not silently change protected narration or pass the films as safe
construction examples. The [SA DHS stormwater guide](https://www.dhs.gov.za/sites/default/files/documents/Redbook/REDBOOK_Section_L_Stormwater_v1.pdf)
sets site, drainage, receiver, erosion and runoff assessment requirements.

The Vegetables slide 6 transplanting movie still ends with its root plug above
the bed. Its local source has the same fault. Four licensed Pexels candidates
(9737854, 9737847, 5766084, 19018086) were inspected end-to-end and at 390px;
none visibly completes an open-soil transplant with the plug seated and covered.
They were rejected, not added to the course. See the existing hold in the
coverage register. No new Flow credits were spent.

Rory then requested a lesson-at-a-time deployment he can inspect. Water
Harvesting lesson 4 is the current unit. Its four-slide phone-width player
play-through reached the end, and the corrected movie played to its last frame
without a media error. Slides 2/4 have very small text in their still images,
so the existing full-size image link has been extended to still slides; slide
4's 1920×1080 asset opened and zoomed in the browser. Evidence and open
acceptance gates are in `docs/media/studies-animation-quality/water-l4-lesson-check.md`.
Do not move on to another lesson until the unit's latest preview is checked.

## Food Forest lesson 3 candidate — 22 September

After the Water lesson 4 preview and exact-head CI were checked, work moved to
Food Forest lesson 3 (module slides 14–18). The earlier note above correctly
describes the original slide-16 Flow source: it stops with broad exposed
cardboard. A zero-credit composition now retains that eight-second setup and
adds five seconds of clearly labelled illustration showing loose mulch above
cardboard on soil. The original source remains intact. A deterministic local
rerender matched the candidate MP4 and poster SHA-256 hashes exactly.

At 390px in the local app, the five-slide English lesson reached its end; the
new 13-second video finished once and held the final layer diagram while the
longer slide-16 narration continued. The 34.6 MB Food Forest pack reported
saved after an offline reload. In that offline browser, the lesson reopened and
slide-16 video and audio both loaded and played from saved media. Details and
limits: `docs/media/studies-animation-quality/food-forest-l3-lesson-check.md`.
This is a review candidate until its exact-head preview and both CI jobs pass.
It does not imply Rory, fluent isiZulu, practitioner or learner acceptance.
