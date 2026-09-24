# Plant Selection & Guilds — lesson 3 review

## Scope

Lesson 3 is module slides **37–47**. Slides 48–51 are the separate field assignment and closing sequence. English and isiZulu slide audio and stills are present for all slides 37–47.

## Existing media

The lesson inventory originally registered three existing clips:

- **Slide 37 — Bring the Jobs Together:** `Imbewu-Guilds-05-Guild-overview` (8s). A young fruit tree is shown with surrounding support plants and a visible access path. The scene is conceptual; it does not identify species, prove roles, or prescribe spacing.
- **Slide 41 — First, Establish the Guild:** `Imbewu-Guilds-06-Succession-establish` (8s). People water young trees; mulch rings and routes between plantings are visible. It does not show the later thinning decision.
- **Slide 45 — Move Support Into the Light:** `Imbewu-Guilds-08-Succession-carry-mulch` (8s). A person carries leafy material under an established fruit tree and the path remains open.

The clip had been registered on slide 44, whose narration says to renew sun-loving support plants in open edges. Slide 45's narration says to carry useful prunings back, so the clip is now registered there. Slide 44 retains its still of a shaded established tree beside an open sunny edge.

## Slide 43 authored animation

**Current player status:** slide 43 is still-only. Its code-drawn MP4 and
poster have been removed from the public assets and registration, and Rory has
not accepted that animation. Two later x1 Flow attempts also failed visual
review. The current `lib/course-deck.ts` registration has no animation for
slide 43. The playback and offline observations below are historical evidence
from an earlier preview in which the candidate was temporarily registered;
they do not describe or approve the current learner player.

`thin-selected-support.mp4` is a deterministic, silent 1280×720 animation with matching poster and a builder in this directory. It uses language-neutral stage numerals and pictograms. The sequence shows:

1. one competing support selected;
2. the entire above-ground crown removed, leaving a small stump and separate cut biomass clear of the fruit-tree trunk;
3. the opening retained while light, moisture, and later regrowth are checked. Roots remain visible to avoid implying that thinning ends root competition immediately.

The start, middle and held end frames were inspected, including a 390px rendition. **Historical candidate review only:** in the earlier local 390px Student player on slide 43, the video loaded with `readyState=4`, no media error and no loop; it reached `ended=true` and remained on its final frame. The player then offered the 48 KB clip on demand. These observations are not current registration or acceptance. See `plant-guilds-thinning.md` for reproducible build, exact bytes and source alignment.

## Safeguards and source alignment

The lesson body, narration and quiz retain the required safeguards: keep trunk and access areas open; compare living cover with ordinary mulch when resources are tight; thin selected whole supports when pruning no longer gives room; leave suitable biomass as mulch; manage regrowth; and observe light, soil moisture, growth, harvest and pest damage before changing the guild. Existing source notes include World Agroforestry tree management, Warwickshire Wildlife Trust thinning guidance, SANBI's *Tulbaghia violacea* page, and the project guild source packet. No species, spacing, yield or timing claims were added.

## Limits still open

**Historical preview evidence (build `f7280d7`):** the preview at
`https://imbewufield-studies-animation-direction.vercel.app/samples` then
reported that build, and its slide-43 MP4 and poster matched the documented
hashes. At 390px in that deployed Student lesson, slide 43's video loaded with
`readyState=4`, no media error, `loop=false` and `ended=true`, retaining its
last frame. Slide 44 had no carry video; slide 45 offered the existing carry
clip. The 120-file Plant Guilds pack reported **On this phone · 60.7 MB** after
the two new assets were downloaded. With browser network disabled, the Student
page reopened, and the then-registered slide-43 MP4 and English audio loaded to
`readyState=4` without a media error; Cache Storage returned 200 for that MP4.
Slide 45's moved carry MP4 and English audio also loaded to `readyState=4`
offline. Network was restored afterward. The complete English 37–47 player
had reached its end on the prior deployed build; the changed slides and media
were rechecked on build `f7280d7`. This is historical browser-profile evidence,
not current slide-43 playback or physical-device acceptance. The current
slide-43 still-only state has not had a fresh deployed or offline check recorded
here.

A fluent isiZulu reviewer has not accepted the narration or the language-neutral
visual pairing. Farmer, facilitator and practitioner review of thinning, mulch
placement, access and regrowth teaching remains open.
