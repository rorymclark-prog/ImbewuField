# Soil Health L2 English lesson check — 23 September 2026

**Status:** The existing Flow films on slides 10–11 stay registered. No new
Flow request, lesson edit, narration edit, quiz edit, species, farming figure or
`PLAN_VERSION` change was made. This is a technical and source check, not Rory,
farmer, learner, practitioner or fluent isiZulu approval. Farm Finance is
outside this pass.

## Current lesson and actual media

The English lesson occupies module slides 9–13. Slide 10 plays the eight-second
`flow-build-compost-heap.mp4`: a Black African farmer spreads dry leaves and
straw over visible fresh greens. Slide 11 plays the existing eight-second
`flow-compost-materials.mp4`: a Black African farmer adds fresh greens to an
open bay. Both continuous shots and one-second contact frames were inspected;
the first setup action is clear at 390 px phone width. Slide 11's film shows
only an early addition. Neither film depicts moisture/air checks, turning,
decomposition, sanitation or ready compost, so the spoken lesson must carry
those later steps. Slides 9, 12 and 13 use stills. Slide 12's full-size still
states that heat at the centre is not a whole-pile safety check; slide 13
states the seed-pod and clean-material cautions. The full-size slide text is
clear, but its fit-to-phone rendering is small; English audio and full-size
still links remain available.

In the deployed 390 × 844 preview, slide 10's film played in the learner
player with its English audio. The saved **23.0 MB** Soil module pack showed
“On this phone.” After a browser reload with network disabled, the Student
page reopened under an Offline badge. Slides 10 and 11 played their cached
MP4s with `readyState=4`; slide 11's English MP3 also advanced with
`readyState=4`. Network was restored and playback stopped. This proves one
browser cache path, not a physical-phone or listening acceptance test.

## Source and claim boundary

The current English body and narration qualify compost readiness, whole-pile
heat treatment and survival of weed seeds or disease organisms. [Oregon State
Extension's slow-composting guidance](https://extension.oregonstate.edu/news/slow-composting-works-when-you-have-more-time-labor)
says a cool pile may not kill most weed seeds and describes grass clippings
matting, excluding air and producing an ammonia smell; mixing with drier
leaves and redistributing clumps are corrective actions. The existing
lesson's instruction to add browns and turn a wet, slimy, ammonia-smelling
heap is consistent with that guidance. The film does not establish that its
heap is sanitised or finished. The [South African ARC black-wattle
leaflet](https://www.arc.agric.za/arc-ppri/Leaflets%20Library/Blackwattle.pdf)
documents persistent seed-bank concern; the current quiz's qualified “some
seeds may survive” answer is appropriately cautious. We did not verify a
specific seed-coat mechanism in ordinary home heaps and should not add one.

**One protected wording hold:** `lib/course-modules.ts` quiz 1 rationale calls
ammonia and sliminess *“the signature of too much nitrogen-rich green
material relative to carbon.”* The symptoms justify the stated response,
but they do not identify that single cause with certainty; excess moisture
and poor aeration also matter. A narrower rationale for a coordinated,
authorised content edit would be:

> A wet, slimy heap needs more air and drier material. Add dry browns and turn
> the heap; do not add more greens or water. An ammonia smell can also suggest
> too much nitrogen-rich material.

The correct answer and lesson action can remain. This proposal is held under
the project's protected lesson-and-quiz rule until Rory authorises a broader
correction. The old `soil-health.zu.md` file is an expressly unpublished
draft; its earlier timings, ratios, sanitation target and seed-coat/bark
claims must not be presented as approved teaching. English-first scope and
fluent review remain explicit.
