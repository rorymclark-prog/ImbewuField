# Small Livestock lesson 1 — Chickens in the System

**Checkpoint:** 22 September 2026, draft PR #504, deployed preview build
`d55f050`. The English lesson has five slides (module slides 4–8). The active
slide-4 hens movie is the already-prepared, licensed real-footage candidate;
the slide-7 ducks movie is the existing Flow source. No new media was made for
this checkpoint.

In the deployed Student sample at 390px, “Watch and listen” traversed all five
slides and ended on “Rotate the Tractor Across the Plot”, with “Play lesson”
restored and Next disabled. Narration loaded on each observed slide without a
media error. The hens movie shows hens pecking among cut stems; it does not
show an enclosure, a harvested-bed transition, insects eaten, manure handling
or a feed/water plan. The ducks movie's earlier full-motion and 390px review
shows ducks among established orchard plants, not measured slug control or a
plant-safety result. The other three stills illustrate the movable pen,
separation from crops and a conditional move decision. Slide 8's full text is
too small to read comfortably inside the 390px deck frame; narration, the
transcript and the existing full-size zoom link provide readable routes. No
claim of low-literacy comprehension follows from those routes.

The 23.2 MB Small Livestock module pack reported “On this phone” after download
and a browser reload with its network disabled. The deployed Student page
reopened offline, lesson 1 played all five slides to its end, and the saved
slide-4 hens movie loaded as an eight-second video with `readyState=4` and no
media error. Its English narration also reached `readyState=4` and played.
This is a browser/cache check, not evidence from a physical phone. Unrelated
unsaved assets and update checks generated offline network errors without
blocking the saved lesson.

**Current saved-pack recheck, 23 September:** In the deployed `/samples` → Open
Student route at 390 × 844, the Small Livestock pack saved all 49 files and
reported **On this phone · 23.7 MB**. After a network-disabled browser reload,
the Offline badge appeared and the saved pack still reported On this phone.
L1 slide 4's registered hen video reached ready state 4, played beyond four
seconds of its eight-second duration and showed foraging hens at phone width.
An independent check also played the slide-7 duck clip and its English MP3
offline at the same viewport; both advanced with no media errors. The slide-4
English MP3 loaded and advanced in that check. Browser network and viewport
settings were restored. This establishes current sample-browser playback for
both registered L1 clips; it is not physical-phone, learner, poultry-practitioner
or Rory visual approval.

## Slide 8 static clarity release candidate — 23 September

The earlier 390px check found that slide 8's four unboxed bullets were too
small in the deck image. A deterministic static reflow now keeps its title and
all four existing statements verbatim in larger cards. The public JPEG is
1920 × 1080, 296,063 bytes, SHA-256
`622dcb7bcea69b402b768fe2c474068d8ed80f75e44284fa6440c35f54937f8d`.
The [renderer and two review sizes](review-candidates/small-livestock-l1-slide08-readable-candidate.md)
were inspected full-size and at the 269px image fit. Nothing is clipped; the
text is clearer than before but remains about 7.7px high at 269px and cannot
be called comfortably readable at that fit. Narration, the expandable English
lesson text and the full-size link remain important. A one-time selective cache
migration retires only the old saved English slide-8 JPEG, leaving downloaded
audio, other slides and other languages in place; the learner chooses when to
fetch the replacement. No Flow credits or code-drawn motion were used.

Exact-head `test` and `rules` passed for `e6d13901`; preview run
`35822273901` passed. `/api/build-info` reported `e6d1390`, and the deployed
JPEG returned the exact hash above. In the deployed 390px sample Student
player, L1 slide 8 appeared as 5/5 and loaded the 1920px still, with its four
cards unclipped. The screenshot confirmed improved grouping and type size,
while long wording remains small in the phone-width image. Its English MP3
advanced beyond six seconds of 20.98 without error. The previously saved
Small Livestock pack showed **48 of 49 files** and offered only **289 KB**
to finish; after that download it reported **On this phone · 23.9 MB**. With
network disabled, `/student` reloaded under the Offline badge, the revised
still completed loading at 1920px and the MP3 advanced from 0.04 to 6.17
seconds with ready state 4 and no error. Network and viewport settings were
restored. This is technical sample-browser evidence, not authenticated-account,
physical-phone, learner or poultry-practitioner acceptance.

The lesson's care warning is supported by [University of Maryland Extension's
flock guide](https://extension.umd.edu/resource/raising-your-home-chicken-flock),
which requires balanced feed, water and daily care. [University of Minnesota
Extension's manure guidance](https://blog-fruit-vegetable-ipm.extension.umn.edu/2024/04/can-i-safely-use-animal-based-compost.html)
confirms that untreated poultry manure can carry food-safety pathogens. The
lesson gives no invented universal stocking number or manure waiting period;
it directs the learner to local extension advice before another food crop.

**Translation mismatch to resolve:** the unpublished draft
`docs/narration/small-livestock.zu.md` still calls slide 4 a moving chicken
tractor and tells the learner to watch a tractor move and manure remain. The
active English slide and footage show hens foraging. Coordinated fluent
isiZulu title/text/audio review is required before any localized release.
The course deck and public audio are currently English-only. Rory's visual
decision on the hens clip, plus local poultry/practitioner and learner review,
also remain open. This is a technical English lesson review, not teaching or
translation acceptance.
