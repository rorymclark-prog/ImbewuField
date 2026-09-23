# Small Livestock L3 English lesson check — 23 September 2026

**Status:** The source-backed English correction was authorised by Rory. The
lesson title and body, slides 14–15, lesson diagram, narration, transcript and
English audio now show feed entering, only some nutrients returning through
manure compost, and food/products leaving. The quiz and animal-health safeguards
remain unchanged. The corrected media and selective saved-pack migration passed
deployed preview checks; the historical sections below record the *previous* released state
and its source hold. No Flow credit was spent. The old code-drawn animation
remains withdrawn. Farm Finance is excluded.

## Module framing cleanup after the L3 release

The earlier L3 release fixed the main nutrient-flow lesson, but the module's
slide 3 still promised “closing nutrient loops” and slide 19 asked for a farm
“loop.” [FAO manure-management guidance](https://www.fao.org/4/X6113E/x6113e06.htm)
explains that feed brings nutrients in, products carry nutrients out and manure
can lose nutrients. The module outcome now says livestock move nutrients around
a farm. The field assignment asks learners to draw one useful link and show
what comes in and what leaves. The stale L3 image brief is aligned. No new
species, quantities, compost timing or animal-health instruction was added.

The two corrected English JPEGs, their two MP3s and the combined English MP3
were released in `db554051`. Slide-3 and slide-19 narration matched the
exported script at 50/50 and 64/64 normalized WordBoundary words. All 20
individual clips and the 399.696-second combined track decoded; the other 18
clips kept their hashes. The [audio verification record](small-livestock-module-framing-audio-verification.json)
and [deterministic still renderer](review-candidates/render-small-livestock-l1-slides03-19.py)
are retained. Both actual 1920×1080 JPEGs and 269×151 phone-fit reductions
were inspected: text and footer are not clipped, although the long slide-19
copy is small at phone fit. The learner can open the full-size still and read
the expandable English transcript.

Local typecheck, 3,726 passing tests with zero failures and one existing TODO,
and whitespace validation passed. Exact-head CI `35863371089` passed both
`test` and `rules`; preview `35863371093` passed and `/api/build-info`
reported `db55405`. In the deployed 390px sample Student, slides 3 and 19
showed the revised stills and titles; the MP3s loaded and advanced beyond 5
seconds. The selective migration left 45/49 previously saved files, then the
user-selected 587 KB refresh completed to **On this phone · 24.3 MB**. After
a network-disabled reload with the Offline badge, both new JPEGs loaded at
1920×1080 and both new MP3s advanced beyond 4 seconds without media errors.
The browser network and temporary viewport were restored. This is technical
browser verification, not physical-phone, human listening, learner, farmer,
veterinary or practitioner approval. The module-wide isiZulu draft still has
closed-loop language on pages 3 and 19 and remains unpublished pending fluent
and local review. No Flow credits were spent and no SVG motion was registered.

## Corrected release verification

Commit `b336a9ec` passed local typecheck, 3,713 tests with no failures and one
existing TODO, plus whitespace validation. Exact-head CI `35830511586` passed
both `test` and `rules`; preview `35830511468` passed and `/api/build-info`
reported `b336a9e`. The actual JPEGs and 269px fits were inspected before
release. At deployed 390px size, the sample player showed slides 14 and 15
without clipping; their short supporting lines remain small, with matching
English narration, transcript and full-size image links available. Slide 15
audio advanced to 0:03 / 0:30 online.

The replacement assets selectively retired six older cached URLs: slides 14
and 15, the lesson diagram, the two slide MP3s and the combined English MP3.
The user-selected refresh completed all 49 files and reported **On this phone ·
24.2 MB**. After a network-disabled browser reload, the 390px sample player
reopened both corrected stills and their English MP3s; the files played to
0:05 / 0:15 and 0:04 / 0:30. The network and temporary viewport were restored.
Two earlier in-app browser tabs crashed when directly clicking their native
audio controls; the later lesson-control playback and offline reload worked.
This is a technical browser check, not physical-phone, learner, farmer,
veterinary, practitioner or fluent isiZulu acceptance.

## Previous deployed media and saved-pack check

Lesson 3 occupies slides 14–18. All five current stills and English MP3s
appeared in the deployed 390 × 844 learner player. Slide 14 has a static
diagram and narration; its former 14-second code-drawn animation and poster
are absent from `public/course-animations` and `LIVESTOCK_ANIMATIONS`, so the
learner player and current offline pack do not serve them. The historical
reconciliation/renderer files are not evidence of a current registration.
The “Watch” heading remains baked into the slide 14 still despite there being
no movie. The diagram's labels and bottom caption, as well as the longer
bullets on slides 16 and 18, are too small for comfortable reading at phone
fit size; English narration, expandable lesson text and the full-size still
link remain available.

The saved **23.7 MB** Small Livestock pack reopened after an offline browser
reload. Slide 14's still loaded with the **Offline** badge visible; its
English narration advanced to 0:01. The browser was restored online. This
checks one browser's saved-pack playback, not physical-phone reliability or
learner comprehension. Slide 17 depicts two adults reviewing a farm plan;
their visible appearance is consistent with Rory's Black African direction,
but imagery does not verify identity or human approval. No other slide in
this five-slide lesson depends on depicting a person.

## Source hold: “closed loop” is stronger than the lesson

The full-size slide 14 draws a complete circle from plants to animals,
manure, compost, growing bed and back to plants. Its title says **“Closed
Livestock Loop”**; slide 15's title and circular goat/manure/compost/bed
illustration repeat closure. The lesson body, however, correctly says only
*some* nutrients return, bought feed enters, products leave, and scraps may
not meet animal needs. [FAO manure-management guidance](https://www.fao.org/4/X6113E/x6113e06.htm)
describes feed imports, product exports and nutrient losses, which confirms
that a farm flow cannot be represented as a sealed circle. The current MP3,
narration script and transcript for slide 14 say “Watch nutrients move from
plants to animals, then through manure and compost back to the growing bed.”
This limited path is possible, but with the title and artwork it can be heard
as a complete closure claim. There is no approved replacement animation.

**Proposed coordinated correction when protected teaching is authorised:**

- Use “Nutrients Moving Through the Farm” for the slide 14 title and remove
  “Watch” while the slide remains a still. Align the lesson title, slide 15
  heading, alt text, narration, transcript and English MP3 to the partial
  return described in the body. Keep wording as simple as “Some nutrients
  return in safely managed compost. Bought feed brings nutrients in. Food
  and other products take some away.”
- Replace the sealed-circle diagrams on slides 14–15 with a **static** readable
  path that visibly shows an input, a partial return and an output. Label
  manure management/composting clearly; do not imply raw manure is safe for
  edible crops. The [fresh-produce hygiene code hosted by South Africa's
  Department of Agriculture](https://www.nda.gov.za/images/Branches/AgricProducHealthFoodSafety/food-safety-and-quality-assurance/food-safety/audit-policy/cxc-codes-of-hygienic-practices-for-fresh-fruits-and-vegetables.pdf)
  warns that manure can contain pathogens and that suitability depends on
  effective treatment.
- Keep the code-drawn motion held until Rory explicitly reviews its visual
  quality. A replacement must first pass the corrected nutrient-flow claims,
  then actual full-motion and phone-size inspection. The old film animates
  the same sealed circle and cannot be re-registered as-is.

No invented nutrient percentages, manure processing time, stocking rate or
veterinary treatment is proposed. The quiz, slide 16 guinea-fowl warning and
slide 18 goat-worm guidance are already appropriately cautious: birds may
forage but do not replace tick checks, goat parasite assessment or advice from
a veterinary/animal-health practitioner. Relevant local veterinary guidance
is available from the [University of Pretoria's Anipedia](https://anipedia.up.ac.za/resources/introduction/1293.html).

The English technical review does not constitute human listening, farmer,
veterinary, practitioner or fluent isiZulu acceptance. Rory authorised this
named English correction; the isiZulu alignment remains an unreviewed draft.

## Static review candidate

The [earlier unregistered slide-14 candidate](review-candidates/small-livestock-l3-slide-14-nutrient-flow-candidate.md)
uses existing repo photos and shows feed entering, a partial return through
managed compost and food/products leaving. Full-size visual review found its
source claim more faithful than the closed-circle art. At 390 px full-slide
fit, the smaller flow labels and body copy are too small. It therefore stays
in `docs/` as a historical review draft. The later partial-flow stills replace
the learner-facing English art and were inspected at full and phone-fit size;
they do not constitute learner or practitioner approval.
