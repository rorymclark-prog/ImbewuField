# Soil Health L3 English lesson and Flow check — 23 September 2026

**Media decision — 23 September 2026:** Replace only slide 14's still with the
static comparison below. The one-output Flow rain shot remains held outside the
learner player because it does not make the taught mechanism clear at phone
width. The original check made no lesson, quiz, narration or audio changes.

**English correction — 24 September 2026:** Rory authorized a source-backed
correction to Soil Health L3. Slide 14 narration now says that when rain hits
mulch instead of bare soil, much raindrop energy is dissipated, and limits the
diagram to that surface-impact idea. The lesson and slide 18 distinguish
raindrop damage to bare soil from soil carried away where water runs over the
field. The quiz rationale makes the same distinction. The closing claim now
says cover crops, mulch and organic matter can help hold soil in place.
Leachate is defined as liquid that drains naturally from a worm bin; the
existing edible-plant safety caution remains. The matching English clips for
slides 14, 17 and 18 were regenerated with `en-ZA-LukeNeural` at `-12%`; word
boundaries matched each supplied script, each clip decoded, and the rebuilt
20-slide `full.mp3` decoded. Recorded hashes and durations are in
[`soil-health-corrected-audio.json`](../studies-illustrated-release/soil-health-corrected-audio.json).
These are automated checks, not a listening or fluent isiZulu review. The
existing slide-14 static still already expresses the conditional mechanism, so
no slide art changed. No species, farming figure, video registration or
`PLAN_VERSION` changed.

## Current five-slide lesson

The English lesson occupies slides 14–18. Slide 14 now uses a static concept
diagram with large “Bare Soil” and “Loose Mulch” labels, equal sparse rain marks,
and only a small bare-surface splash. The caption says “Loose cover can cushion
raindrop impact”; the figure is marked “Concept diagram · not to scale.” It
shows no pooling, runoff, infiltration path, or universal erosion result. Slide 15
shows Black African hands placing leaf mulch clear of a tomato stem. Slide 16
**already has** a photorealistic cover-crop field with a Black African woman;
slide 17 shows a Black African woman inspecting a worm bin. Slide 18 **already
has** a paired photorealistic bare/covered field. Earlier handover descriptions
of text-only slide 16 or cartoon slide 18 are stale; those stills need no remake
on that premise. None of slides 14–18 currently registers a video. The old
locally drawn slide-14 film remains held under Rory's explicit visual-clearance
rule. The earlier Fast and Quality Flow comparisons also failed the readable,
equal-raindrop-impact gate.

Before this still replacement, the deployed 390 × 844 Student preview reopened
from the saved **23.0 MB** Soil module pack with network disabled. That check
covered the former slide 14 still and existing audio only. The replacement was
inspected locally at 1920 × 1080 and as a proportional 269 × 151 phone-size
render. The two labels, rain marks and small bare-surface flecks remain visible
there. This is not a post-deploy offline-pack check, physical-phone check, or
listening or screen-reader review. The earlier browser run does not prove that
the new still has reached saved packs.

## One new Flow result, held

One 16:9, 720p, eight-second **Veo 3.1 Quality x1** request was made in the
existing Google Flow project. The UI displayed **100 credits**. The prompt
asked for a locked, continuous photorealistic macro shot of the same South
African smallholder garden soil, bare on the left and loosely covered with
straw/leaves on the right, under equal natural rain. It explicitly asked for
low bare-soil splashes, some water passing through mulch gaps, no pooling or
runoff claim, no labels, cuts, audio or instant change. Only one output was
generated; there was no reroll.

Flow editor: https://flow.google.com/project/7d35cc98-916e-4c7b-89b0-86365cac5442/edit/0f272ec2-e6cf-491c-99ef-1df0d3e3cc09
(renamed “HOLD — garden rain close-up”). The downloaded original is
`/Users/roryclark/Downloads/Rain_falling_on_garden_soil_20260923020226.mp4`,
6,093,724 bytes, SHA-256
`c182809563d97e9e934d481b67ae58337d11f742f9d91ed1791d5b88c0c61572`.
It is 1280 × 720, 24 fps, eight seconds and unexpectedly has an AAC audio track.
The [silent, faststart review copy](review-candidates/soil-l3-ground-rain-flow-review.mp4)
is 4,062,317 bytes, SHA-256
`96ba31b8fb368a2b01bf212278ca6d0f2c4d97fe47458a8e8bc701e23ac7e1f1`;
it is under `docs/`, not the public course bundle.

The continuous preview, one-second contact frames and full-resolution frames
reduced to phone width were inspected independently. The field setting and
loose cover look natural. Bright water patches rapidly spread along the
bare/mulch boundary and over the covered half, however, so pooled water
dominates the shot. The few impact/grain differences are not legible at 390 px,
and equal forcing is unclear. Showing it under “Watch: Bare Soil and Mulch”
would imply a water-retention result the lesson and source do not establish.
**Hold/reject** this Flow candidate. Slide 14 remains still-only; the separate
static replacement below does not register the movie or add a poster.

## Static comparison still — V1 clarity replacement

The corrected English narration says: “When rain hits mulch instead of bare
soil, much of the raindrop energy is dissipated. This diagram shows that
surface-impact idea only; it does not predict how water will move at a
particular site.” The paired still clarifies the comparison but does not
simulate a storm or show water movement beyond surface impact. Its conditional
caption is limited to a mechanism supported by USDA NRCS [Soil Health: Principle 1 — Soil
Armor](https://www.nrcs.usda.gov/state-offices/north-dakota/soil-health-principle-1-of-4-soil-armor):
when rainfall hits cover rather than bare soil, much of the raindrop energy is
dissipated. NRCS's [Mulching practice standard](https://www.nrcs.usda.gov/sites/default/files/2022-09/Mulching_CPS_484_Oct_2017.pdf)
also cautions that material, site and application matter. Neither source makes
this concept diagram evidence of a universal infiltration, runoff, erosion or
water-storage outcome.

The deterministic renderer is
[`render-soil-l3-slide14-static.py`](../../review-candidates/render-soil-l3-slide14-static.py).
It produces the public still and review copy from the same authored static
diagram. The public asset is `public/course-decks/soil-health/en/slide-14.jpg`,
1920 × 1080 JPEG, 221,671 bytes, SHA-256
`4e06cb5c1e7707c191f1744efe7935045a2f922b7b4fea1f032edc254c02658c`. The exact
byte-size manifest was regenerated. A one-time worker migration removes only
the saved English slide-14 still, including query variants, and preserves other
downloaded lesson files; the learner chooses when to fetch its replacement.

Exact-head `test` and `rules` passed for `860b4c62`, and preview run
`35816126882` passed. `/api/build-info` reported `860b4c6`; the deployed
slide-14 JPEG returned the same SHA-256 as the local candidate and opened in
a real browser. Its 269 × 151 fit was inspected from those exact bytes. A
fresh browser redirected `/student` to `/login`; the subsequent sample Student
route provided a post-deploy technical player check. At 390 × 844, lesson L3
opened slide 14 as the first of five lesson slides. The revised still completed
loading at its 1920px source width, and the English MP3 had ready state 4.
The Soil pack reported **On this phone · 23.1 MB**. With the browser network
disabled, `/student` reloaded with the Offline badge; L3 slide 14 again loaded
at 1920px, and its English narration advanced from 0 to 4.57 seconds of 8.45
without a media error. Network and viewport settings were restored. This is a
sample-browser check, not an authenticated-account, physical-phone, learner
readability, listening or practitioner review.

## Teaching and source limits

[USDA NRCS soil-armor guidance](https://www.nrcs.usda.gov/state-offices/north-dakota/soil-health-principle-1-of-4-soil-armor)
supports surface cover dissipating raindrop energy and helping reduce wind and
water erosion and evaporation. Its [water erosion guidance](https://www.nrcs.usda.gov/sites/default/files/2023-01/Understanding-Soil-Risks-and-Hazards.pdf)
describes erosion as particle detachment and transport, including raindrop
splash and surface flow. That supports separating surface impact from the
conditional transport of loosened soil. Its [mulching practice
standard](https://www.nrcs.usda.gov/sites/default/files/2022-09/Mulching_CPS_484_Oct_2017.pdf)
also says material, site and application matter: excessively thick or tightly
packed mulch can create soggy conditions or keep rain from reaching soil. The
film cannot prove a universal infiltration, runoff, erosion or water-storage
outcome. [FAO's biological nitrogen-fixation
review](https://www.fao.org/4/x5546e/x5546e05.htm) supports the lesson's
conditional bacterial and field-setting language for legume cover crops; the
rain shot does not demonstrate nitrogen fixation. [University of Georgia's
vermicomposting guidance](https://fieldreport.caes.uga.edu/publications/B1596-01/vermicomposting-basics-for-gardens-landscapes-farms/)
defines worm leachate as liquid that drains naturally from a vermicomposting
bin and distinguishes it from prepared worm tea. It warns against use on
edible plants because naturally draining leachate may contain harmful
organisms. The English lesson retains its conservative caution. The isiZulu
draft remains unpublished and needs fluent farming review before any release
claim.
