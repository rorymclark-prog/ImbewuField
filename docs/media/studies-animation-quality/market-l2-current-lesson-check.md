# Market Gardening L2 English lesson check — 23 September 2026

**Status:** A static slide-9 readability revision is deployed and checked;
the other four stills and English audio remain. No new Flow
request, local animation registration, protected lesson/quiz/narration edit,
species, farming figure or `PLAN_VERSION` change was made. This is technical
and source review, not Rory, farmer, learner, practitioner or fluent isiZulu
approval. Farm Finance is outside this pass.

## Earlier deployed lesson check, before the slide-9 revision

Module slides 9–13 present roadside stall, group delivery and household box
routes, then customer needs, direct-selling work, regular orders and matching
offers to variable supply. Slide 9's route diagram uses still arrows; the
locally drawn surplus-routes movie remains withdrawn under Rory's visual
clearance rule. The slide 9 labels and lower explanation are small in a 390 px
full-slide fit, with a full-size still link and English narration available.
Slide 10 depicts Black African women discussing produce at a stall. Slides
11–12 are text-heavy stills and slide 13 is a static route graphic. The five
current full-size stills were inspected; none implies a guaranteed income.

At 390 × 844 in the deployed Student preview, the English lesson opened at
slide 9 and autoplay advanced to its final slide 13, returning to Play at the
end. Slide 13's still loaded at `naturalWidth=1920`, and its MP3 advanced at
`readyState=4`. The existing **12.7 MB / 45-file** Market pack showed “On
this phone.” With browser network disabled, `/student` reloaded under an
Offline badge; L2 reopened, slide 9's still loaded at `naturalWidth=1920`,
and its English MP3 advanced at `readyState=4`. Playback was stopped and
network restored. This is one browser cache path, not physical-phone or
listening acceptance.

## Static slide 9 revision — deployed check

The existing route still had three small labels and a long explanatory
paragraph that could not be read at phone fit. The replacement uses three
equal, separate farm-to-destination rows. Its labels repeat the existing
English narration exactly: Roadside stall; Group delivery to a shop; Box
delivered to a household. Each row retains a farm origin and outward arrow.
No row is preferred, no price or income is promised, and the choices remain
conditional on supply, demand, costs and local rules in the unchanged lesson.

`docs/media/studies-animation-quality/render-market-l2-routes-still.py`
deterministically renders the 1920 × 1080 JPEG. The full image and a 270px
copy approximating the player's picture width were inspected; all three labels
are legible without overlapping the icons. The first candidate had an
overlapping box and Farm labels outside their cards; those were corrected
before this file was considered ready. The final JPEG is 191,111 bytes,
SHA-256 `07ed3c60f85fc1c23445e1404161ee99b0ed36169416ce2e2d18a11e64f90cb3`.
A one-time service-worker migration removes only the prior saved slide-9 JPEG,
leaving English MP3s and other Market stills in the pack.

Exact-head `test` and `rules` passed for `40cdcf50` in run 35809394916;
preview run 35809394918 passed and `/api/build-info` reported `40cdcf5`.
At 390 × 844, the actual lesson player showed all three route names clearly
inside a **269 CSS px** image. The JPEG loaded at `naturalWidth=1920`, its
English MP3 reached `readyState=4` and advanced, and the lesson had zero video
elements. The previous saved Market pack became **44 of 45 files**, with
**187 KB left** for the new JPEG. After `Finish download`, it reported **On
this phone · 12.8 MB**. With browser networking disabled, `/student` reloaded
under the Offline badge; slide 9 loaded at 1920 natural pixels and its English
MP3 again reached `readyState=4` and advanced. Network access was restored
and playback stopped. This verifies one browser cache path, not a physical
phone, a learner's comprehension or human visual acceptance. No Flow credit
was used, and Farm Finance was not changed.

## Teaching and Flow decision

The current body and quiz make the right conditional distinction: regular
orders help planning only if agreed supply, payment, customer demand and costs
work; an inconsistent harvest should not be promised as a fixed delivery.
The lesson tells growers to check local trading, food and certification rules
for their own channel. A read-only review found no concrete unsupported
farming or market figure in this lesson; that does not amount to legal approval
for a particular stall or sale.

No video can establish the economics or permission requirements of the three
routes from a generic scene. The still, narration and lesson text already
cover the choices, so a new paid Flow request is not justified here. Retain
the slide 9 still and keep the locally drawn motion outside the player until
Rory judges its visual quality.
