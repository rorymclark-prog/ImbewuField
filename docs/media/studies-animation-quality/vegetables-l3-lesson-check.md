# Vegetables and Staple Crops lesson 3 — Staple Crops

## English sweet-potato qualification — 23 September 2026

The [South African ARC summer vegetable guideline](https://www.arc.agric.za/arc-vopi/Leaflets%20Library/Production%20Guideline%20for%20Summer%20Vegetables.pdf)
describes a degree of drought tolerance **after storage roots form**, while
water stress in the first weeks or during root formation can reduce yield. It
also identifies young leaves as edible. The earlier body, key point, slide 13
speech/transcript and still said only that sweet potato tolerates dry periods.
The coordinated English correction now carries the stage and early-water
limits without importing the guideline's general water amount as a local
threshold. No species list, quiz answer, spacing or harvest date was changed.

Slide 13 is a static four-card comparison; the existing L3 infographic and
other two stills are unchanged. The corrected 1920 × 1080 JPEG was visually
inspected at full size and a 269px fit, with no clipping. Crop names are about
9.3px and supporting lines about 8.1px at that fit, clearer than the old
roughly 5px bullet text. The matching English speech, expandable transcript
and full-size link remain available. Image SHA-256:
`557b3dec511b95c8013d22dce1dff40e94aabf61cf58aa40b0e521f674bc4b01`.
The deterministic [renderer](render-vegetables-l3-slide-13.py) starts from a
pinned source image; rerunning reproduced this hash.

The slide 13 English MP3 and full 18-slide MP3 were regenerated. The
[audio verification](vegetables-l3-english-audio-verification.json) records
91/91 exact normalized WordBoundary tokens, full decoding, and a 693.672-second
combined duration equal to the slide sum. The saved-pack migration retires
only the old English slide 13 JPEG, its MP3 and the full MP3, without fetching
replacements or deleting adjacent/isiZulu assets. No new Flow credit or
SVG/code-drawn animation was used. Local typecheck, 3,725 passing tests /
0 failures / 1 existing TODO, and whitespace check passed. Content/audio commit
`e6d619fd` passed exact-head CI `35860676505` (`test` and `rules`) and preview
`35860676607`. The clearer card commit `7c0c30db` passed exact-head CI
`35861357889` (`test` and `rules`) and preview `35861358014`; `/api/build-info`
reported `7c0c30d`. In the deployed 390px sample Student, the corrected body,
key point and slide transcript appeared; the four-card slide 13 loaded at
1920 × 1080 and its new English MP3 played beyond 12 seconds with no media
error. A prior saved Vegetables pack refreshed its three changed English assets
to **On this phone · 18.6 MB**. After a network-disabled reload, the Offline
badge appeared and the corrected slide 13 card and MP3 reopened; the audio
advanced beyond five seconds. Connection and viewport were restored. This is
browser delivery evidence, not physical-phone or human comprehension review.
The [isiZulu packet](../../narration-reviews/vegetables-staples-l3.zu.review.md)
is review-only; its old broad dry-period claim is unpublished. Human listening,
physical-phone, learner, farmer, practitioner and fluent isiZulu approval are
not claimed.

## isiZulu learner preview — 24 September 2026

The 18-slide isiZulu deck now includes a localized four-card slide 13. Its sweet-potato card says water is needed early and during root formation, with some drought tolerance only after that stage; the matching isiZulu narration and transcript also retain the possibility of reduced harvest from water stress. The updated deck and all 18 recordings are clearly labelled as an unreviewed learner preview. First-language isiZulu, local farming and human listening review remain pending. The localized card was rendered from the committed English card still by [the matching Pillow renderer](render-vegetables-l3-slide-13-zu.py) and inspected at full size and 390px fit. No animation or Flow render was created.

## Earlier technical checkpoint — before the correction

**Checkpoint:** 22 September 2026, deployed English sample build `0f505fe`.
This lesson is module slides 12–14. All three checked-in stills and the lesson
infographic were inspected at full size; slide 12 was also inspected in the
390px learner player. The deployed three-slide player ran from slide 12 to
slide 14, “Diversity Keeps Food Moving”, and reset to “Play lesson” with Next
disabled. The final slide's English audio reached `readyState=4` without a
media error. The checked-in audio manifest records text match and full decode
for all three tracks, but explicitly does not record human listening acceptance.

The slide-12 visual depicts a maize stalk, a climbing bean and a root crop.
It does not establish their spacing, performance or suitability for a
particular field. Slides 13 and 14 are text-led; the player supplies narration,
an expandable transcript and a full-size still link. There is no registered
Watch animation for this lesson and no demonstrated media gap requiring one.

The protected English text/quiz distinguish a stable open-pollinated maize
variety with managed pollination from saved F1 seed, and present crop diversity
as a way to reduce single-crop risk rather than a harvest guarantee. The
[University of Minnesota Extension seed-saving guide](https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/saving-vegetable-seeds)
supports the pollination and selection qualification. The
[South African ARC summer vegetable guide](https://www.arc.agric.za/arc-vopi/Leaflets%20Library/Production%20Guideline%20for%20Summer%20Vegetables.pdf)
says sweet potato develops a degree of drought tolerance **after storage roots
have formed**; the brief slide-13 phrase “tolerates dry periods” should be
checked by a practitioner in the context of the full lesson before any broader
climate-suitability claim is made. The
[ARC indigenous crops page](https://www.arc.agric.za/arc-vopi/Pages/Crop%20Science/Indigenous-Crops.aspx)
records amadumbe cultivation in South African wetlands. No crop calendar,
spacing or yield figures were imported from these sources.

The isiZulu narration is an unpublished draft. Its slides 12–14 appear to track
the English claims, but crop names and seed-saving terms still require fluent
and learner review. No public lesson copy, quiz, audio, species list or media
was changed for this lesson. This is a technical English media/playback and
source check, not Rory's, fluent isiZulu, practitioner or learner acceptance.
