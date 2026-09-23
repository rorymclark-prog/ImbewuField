# Food Forest Design L3 current English check — 23 September 2026

**Status:** Deployed media and source check with one protected quiz correction
still open. Human, learner, facilitator and practitioner approval are not
claimed. No protected teaching was edited. The slide-15 review candidate below
used 100 AI credits while the Flow balance remained 0. Farm Finance remains
excluded.

## Current player and actual media

Lesson 3 is slides 14–18, with matching English MP3s. The current slide 14
still is the four-stage sequence; slide 15 shows a farmer caring for a young
planting; slide 16 alone registers the eight-second Flow
`flow-sheet-mulching-closeup.mp4`; slides 17–18 use stills. The current Flow
shot shows gloved hands moving wood chips onto cardboard on soil. An exposed
cardboard edge remains visible and the clip does not depict a finished bed or
prove weed suppression. It has no identifiable person. The slide 15 and 18
stills show adults whose visible appearance is consistent with Rory's Black
African depiction direction; their identities or approval cannot be verified
from an image. Slide 15's “Watch” title is stale: its former locally drawn
young-forest animation is held outside the player for Rory's visual clearance.
The authored sheet-mulching composite is likewise withdrawn; the older wide
Flow shot remains unregistered because it ends with broad exposed cardboard.

I inspected the deployed 390 × 844 learner player on slides 14–18. Slide 16's
Flow clip played in the actual player, reached 0:08, and held its final frame
while the longer English MP3 continued to 0:20. Slides 17's bullet text is
small at phone fit size, though narration, expandable lesson text and the
full-size still link are available. The module's saved **17.7 MB** pack
reopened slide 16 after an offline browser reload. With the **Offline** badge
shown, the saved video progressed through a visible hand-and-mulch frame while
the English audio advanced; the final video frame held while narration
continued. The browser was restored online. This is a browser check, not a
physical-phone or human listening assessment.

## Slide 17 static still release — 23 September

The existing three statements were reflowed into larger cards in a deterministic
1920 × 1080 static still. Their wording, including the local-suitability and
competition cautions, is unchanged. The render was inspected full-size and at
269 × 151 px; it has no clipped text and gives the long pruning statement more
space than the previous bullet layout. Existing narration and expandable text
remain available. SHA-256:
`4f8f3d9ffe505a05e251249ad98f5d95a7450267b4f9b8a1799656b196c50a0b`.

Exact-head `test` and `rules` CI jobs passed for `d9aa951f`; preview run
`35813885562` passed and `/api/build-info` reported `d9aa951`. The deployed
slide-17 JPEG returned the same SHA-256 and 1920 × 1080 dimensions, and the
public image URL opened in a real browser. The one-time cache migration removes
only old saved slide-17 JPEGs, without fetching the replacement or deleting
other stills/audio. A fresh unauthenticated browser was redirected from
`/student` to `/login`, so this release has **not** had a current deployed
390px learner-player or offline-pack recheck. The phone fit was inspected on
the exact deployed bytes, but physical-phone and learner readability remain
unverified.

**Post-release sample-player check, 23 September:** The deployed `/samples` →
Open Student route entered the sample learning workspace without an account.
At 390 × 844, L3 slide 17 appeared as slide 4/5, “Adjust as the Trees Grow.”
Its 1920px still loaded with all three cards within the image; the screenshot
also shows that the long text remains small at the 269px image fit, with the
full-size link, English MP3 and expandable lesson text available. The MP3
advanced beyond five seconds of 25.13 without a media error. The Food Forest
pack saved all 45 files and reported **On this phone · 17.4 MB**. With network
disabled, `/student` reloaded under the Offline badge; slide 17 again loaded
at 1920px and its MP3 advanced from 0.24 to 5.29 seconds with ready state 4
and no error. Network and viewport settings were restored. This closes the
sample-browser offline technical check, not authenticated-account, physical-
phone, learner-readability, human or practitioner review.

The previous [`food-forest-l3-lesson-check.md`](food-forest-l3-lesson-check.md)
describes a 13-second authored composite and a 34.6 MB pack from an earlier
player state. Its top warning now marks that account as historical. The
current registration and offline pack contain the eight-second Flow close-up.

## Source and proposed narrow correction

The body and slide 16 narration say that plain cardboard beneath suitable
mulch **can suppress** unwanted growth where appropriate; they require water
entry and clear space around trunks. Slide 18 asks the learner to check root
zone moisture and avoid waterlogged ground. There is no fixed planting date,
harvest promise or mulch depth. The [Agricultural Research Council's soil and
water manual](https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Pages/assets/modules/2.pdf)
says weeds grow less well where mulch blocks sunlight, and its [fruit-production
manual](https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Pages/assets/modules/6.pdf)
describes a significant reduction in weeds. These support suppression, not a
guarantee that existing grass dies.

Quiz 1's correct option says “Smothering existing grass,” and its rationale
states that cardboard cuts off light, **“killing it.”** This overstates a
site-dependent result and conflicts with the lesson's qualified wording.
Pending Rory's broader protected-content decision, the answer and rationale
remain unchanged. Proposed matched edit: describe cardboard as blocking light
and **helping suppress** existing grass while it breaks down, then ask learners
to check for regrowth. Keep the water-entry and trunk-clearance safeguards.
No species or numbers should change.

This review is a technical preview check, not final content or practical
farming clearance; isiZulu remains for a fluent review cycle.

## Slide 15 grass-removal Flow candidate — 23 September

One request used Veo 3.1 Quality, 16:9, 720p, eight seconds and x1. The
displayed cost was 100 AI credits; Google One showed Flow credits 0 → 0 and AI
credits 3,780 → 3,680. The existing Food Forest L3 `source.png` was attached as
the opening frame. Flow project:
<https://flow.google.com/project/7d35cc98-916e-4c7b-89b0-86365cac5442/edit/1165b14f-af29-41c8-aa27-5d107a2e1a07>.

Exact prompt:

> Use the uploaded image as the exact visual reference and opening frame. Photorealistic documentary, one continuous locked 16:9 medium-close shot in the same South African smallholder food forest, same adult Black African woman, same young tree, mulch, light and viewpoint. Show only one clear action: she gently grips a single small tuft of grass growing near the young tree and loosens it by hand, then lifts that tuft away and sets it on the ground beside the bed. Keep the young tree upright and still; keep mulch clear of its trunk. Do not pull the tree, disturb its roots, or move or pile mulch against its trunk. Keep her hand and the tuft visible throughout. Natural restrained body motion; no other work. End with only that tuft removed, with the tree and mulch otherwise unchanged. No new plants, tools, weeds, species, water, labels, text, graphics, narration, sound, or music. No cuts, transitions, time lapse, slow motion, reframing, or camera movement.

The original Flow download is
`/Users/roryclark/Downloads/Woman_gripping_tree_in_forest_20260923053008.mp4`
(7,924,046 bytes; SHA-256
`fc96cc673fe84238b52c454d3c85e2cc17540e7868a766e956410eac00f0067a`). It
contains an AAC audio stream even though the prompt asked for no sound. The
silent local review copy is
`docs/media/studies-animation-quality/review-candidates/food-forest-l3-slide15-grass-removal-flow-x1-review.mp4`
(7,739,744 bytes; SHA-256
`ce46382289b6b4df01208d699e0f3a78ce0f1bba85e80ff2dc85c2ddfc44cbab`),
8.0 seconds, 1280 × 720 at 24 fps, with no audio stream.

Full-motion and 390-pixel phone-width inspection found that the adult and young
tree stay in frame and the composition fits. The removal itself is not cleanly
legible as one small grass tuft: a large dark clod of soil/turf appears to be
lifted beside the trunk, then set down again, raising a possible root-disturbance
implication. The candidate is **HELD by the motion and farming review**; Rory
can revisit it later, but his latest direction allows work to continue without
waiting for an animation approval. It remains outside the learner player and
public assets. No reroll was made. This
inspection is not human, farmer, practitioner, learner or isiZulu approval.
