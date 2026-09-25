# Introduction L2 English lesson check — 22 September 2026

**Status (23 September):** English correction released on the Studies preview
as `fdd773e9`.
The source-backed lesson, quiz, narration, transcript, four corrected static
stills and six matching English slide MP3s now agree. The combined narration
was rebuilt and decoded; the [audio verification record](intro-l2-english-audio-verification.json)
contains exact WordBoundary matches. The corrected slide 13 is a still, with
the older code-drawn motion still held. The revised stills were inspected at
full and 269 px fit sizes. At the small fit, supporting text needs the zoom
link or spoken narration. Selective offline cache migration retires only this
lesson’s changed English media from saved packs. No Flow credit was spent.
Local typecheck, 3,714 passing tests / 0 failures / 1 existing TODO, and
whitespace checks passed. Exact-head CI `35832925424` passed both `test` and
`rules`. Preview run `35832925320` passed on attempt 2 after a transient
Google-font fetch failure on attempt 1; `/api/build-info` reported `fdd773e`.
At 390 × 844, the deployed sample Student showed the corrected lesson text,
quiz and slides 11–14 without clipping. On slide 13, the English MP3 reached
`readyState=4` and advanced past five seconds. The selectively migrated pack
first showed 39 of 49 files and offered the 1.8 MB replacement; after finishing
it reported **On this phone · 17.3 MB**. With the browser network disabled and
the page reloaded, slide 13 reopened with the Offline badge and its English MP3
again reached `readyState=4` and advanced past five seconds. Network was
restored. This verifies one browser at phone width, not a physical phone or
human listening. Human and fluent isiZulu review are still open;
[isiZulu packet](../../narration-reviews/intro-l2.zu.review.md) is review-only.

## Original 22 September check and holds

The following is the pre-correction evidence and source hold that drove this
release candidate.

## Learner-player evidence

Introduction to Permaculture lesson 2 is module slides 9–14. All six English
stills and six MP3s exist; no video is registered for this lesson. The deployed
390 × 844 preview ran from slide 9 through slide 14 and reset to “Play the
lesson” at the end. At sampled slides 10 and 12, the matching MP3 had
`readyState=4` and advanced while the still rendered at 1920 px. Slide 10's
people visibly read as Black African adults in a South African smallholding
setting. The other lesson stills are text or concept diagrams. The module pack
was already saved on the phone at 16.7 MB. With the browser network disabled
and the page reloaded, lesson slide 13 rendered at 1920 px and its English MP3
advanced with `readyState=4`; no video element appeared. Offline console errors
were for uncached background requests, not these checked lesson assets. The
browser network was restored after the check. No Flow credit was spent.

The 16:9 text stills become too small to read inside the phone-width image area;
the player supplies narration, an “Open still image” zoom link and expandable
“Read this slide” text. This is a mobile presentation limitation to assess with
learners, not proof that the teaching is understandable to a low-literacy user.

## Source and visual holds

1. The lesson calls the twelve design principles a joint distillation by Bill
   Mollison and David Holmgren. Holmgren's own [principles project](https://permacultureprinciples.com/about/)
   identifies this twelve-principle formulation as his work; the original
   permaculture concept was co-originated with Mollison. Attribute the twelve
   precisely, then keep the two founders' broader contribution distinct. The
   claim that three principles “matter most” to all South African smallholders
   should become a teaching choice such as “three useful starting points”, not
   an unsupported universal ranking.
2. Slides 9–10 and the quiz teach observation before swale digging, which is a
   useful first step. They do not explain that any later water earthwork also
   needs site-specific checks for drainage, slope, overflow, erosion and other
   constraints. The quiz's engineer option is a distractor, which may suggest
   observation alone completes a safe swale design. [Oregon State University
   Extension's swale guidance](https://extension.oregonstate.edu/catalog/pub/em-9209-water-quality-swales-low-impact-development-fact-sheet)
   documents soil, groundwater, slope and siting limits for water-quality
   swales. These are a reason to check the local site, not a South African
   construction standard; its US numerical setbacks are **not** proposed for
   South African farms.
3. Slide 13 narration/body says one hailstorm can wipe out maize but “rarely”
   wipes out a mixed planting. The still shows all maize fallen while the mixed
   side is largely intact, then calls diversity “insurance you plant”. This is
   an unsupported guarantee for the pictured storm. Crop injury depends on
   storm severity, crop and growth stage; a mixed planting can also suffer
   serious damage. [University of Minnesota Extension's hail guidance](https://extension.umn.edu/agriculture/crop-production/corn/wind-and-hail-damage)
   shows how crop injury varies with storm severity and growth stage. The
   conclusion that this mixed planting cannot be promised survival is an
   inference from that variability; the source does not test this exact crop
   mixture. A correction needs to change the words **and** the still, keeping
   the principle without promising survival.
4. Slide 12 calls a stream bank one of the most productive edges. The lesson
   should prompt observation and checks before recommending use of a real bank,
   where access, erosion and watercourse restrictions may matter. Slide 14's
   chicken-in-beds example is explicitly after harvest but merits a food-safety
   boundary before edible crops return. Neither needs an invented interval or
   blanket local rule.
5. Slide 11 says catching rain, sun and biomass is “almost always cheaper”
   than buying the same thing later. This unqualified cost comparison has no
   cited basis in the lesson; remove it or make it an observation question.

The corrected release candidate addresses these five holds together. Keep the
older code-drawn slide 13 movie withdrawn. Human, practitioner and fluent
isiZulu acceptance remain open.
