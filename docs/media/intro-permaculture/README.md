# Introduction to Permaculture media — 20 September 2026

## Current learner-player status — 22 September 2026

The production notes below record the 20 September authored concept clips. They
are historical: the code-drawn Watch animations on slides 7, 13 and 19 are now
withdrawn from the learner player under Rory's visual-clearance rule. The
current English lesson 1 player uses the existing Flow Earth Care clip on slide
4 and stills on slides 5–8, including the slide 7 concept diagram. See
`../studies-animation-quality/intro-l1-lesson-check.md` for the current lesson
review and its unresolved source hold. Do not count the historical clips as
accepted media.

The English Introduction now has 22 slides and three opt-in Watch animations, using its existing 22 recordings. It follows the Water media branch and shares that branch's player/offline fixes. No narration, lesson, quiz, species, farming figure, saved geometry or PLAN_VERSION was changed. isiZulu remains a draft and is not published by this change.

## Teaching sequences

- Slide 7 shows the same borehole closed, open with falling water level, and shared while someone monitors the level. The monitored level continues downward: monitoring is not shown replenishing the borehole. There is no numerical or “safe” groundwater threshold.
- Slide 13 shows the same hail over maize and a varied generic planting, with damage in both. It then moves scraps toward compost and soil, and carries a bucket to water the bed. No additional species, loss percentage or guaranteed survival was added.
- Slide 19 is a north-up conceptual plan. Wind travels from upper-left to lower-right and passes through a permeable windbreak on the north-west boundary before reaching crops. The authored firebreak/frost sentence is a caption only; no unsupported placement diagram was added.

All animation captions, in sequence, exactly match each complete English Watch passage after whitespace and `[pause]` normalization. They are English-labelled concept diagrams, not scaled construction drawings. Captions are timed approximately by source word position, not by a forced alignment or human timing review.

## Production and checks

Antigravity produced the renderer through its local CLI using the exact brief and authored script. Codex reviewed and corrected the returned code and output. The first draft's unsupported water thresholds, loss percentage, extra farming prose and firebreak/frost placements were removed before integration. Text wrapping is measured and asserts on overflow; labels/captions are at least 28 pixels in a 1280×720 source frame. Alpha is composited onto the paper background.

`verification.json` records actual encoded durations, bytes, hashes and source MP3 hashes. All three silent H.264/yuv420p 24 fps videos fully decode and exceed their matching narration by at least one second. Decoded diagram-only samples at 2 fps have 44, 53 and 47 distinct frames; a repeated-frame control fails the motion requirement. Cropping out headers/captions prevents changing text alone from satisfying that check. The three clips together are 1,083,175 bytes.

Contact sheets were inspected across all teaching phases, including closed access, falling water, variable hail damage, compost flow, bucket delivery and wind direction. The 22-slide deck was inspected as a contact sheet. The app played the selected ethics video and its original narration together. A 390-pixel DOM viewport had no horizontal overflow. Browser capture scaling did not provide a reliable physical-size phone screenshot; no physical-device or fluent-language review is claimed.

The app's duration button rounds only its displayed seconds to one decimal place; the manifest retains measured durations. Offline assets and sizes include the slides, posters and optional clips through the existing pack builder. The in-app browser saved all 53 files (6.6 MB), but disconnected playback failed. The app’s own Offline & sync page reports that its first offline start is still preparing: there is no active service worker in this local session. The deployed preview passed the follow-up: after saving all 53 files, disabled its connection and played all three Watch clips with matching narration. Each audio/video stream reported readyState 4 and advancing playback. The connection was restored afterward. The local development failure does not reproduce on the built preview. Local checks passed in order: `npx tsc --noEmit`, `npm test` (3,632 pass, zero failures, one existing TODO), `git diff --check`.

## Reproduction and review reel

Stage the existing `public/course-audio/intro-permaculture/en/slide-07.mp3`, `slide-13.mp3` and `slide-19.mp3` under `OUTPUT/inputs/english-audio/`. Run:

```sh
python3 scripts/render-intro-concepts.py --output OUTPUT --preview
python3 scripts/render-intro-concepts.py --output OUTPUT
```

Pillow, FFmpeg/FFprobe and a supported Arial/DejaVu font are required. Preview renders posters/phase contacts only. The full command streams frames and builds a narrated review reel. `--reuse-clips` is only for rebuilding the reel when the frame renderer has not changed. The PNG review badge avoids depending on FFmpeg's optional drawtext filter.

Generate the deck using the existing `scripts/make-lesson-slides.mjs intro-permaculture en OUTPUT --images ART` with matching Watch posters named `slide-07.jpg`, `slide-13.jpg` and `slide-19.jpg`; the title uses the module's existing ethics illustration, padded to retain the whole picture. Export JPEG slides at 1920×1080, quality 85. No new voice files are needed.

The local delivery pack is `Downloads/imbewu-studies-2026-09-20/intro-production/`. Its review reel preserves the source speech without speed changes or trimming and pads the scene tails; the reel re-encodes audio to AAC. The app continues to play the original MP3 files. The reel is review material and is not included in the learner's automatic download.

## isiZulu review deck — 24 September 2026

The 22 isiZulu stills in `public/course-decks/intro-permaculture/zu/` are an
**unreviewed AI draft**. They were rendered from the source-paired isiZulu script
at SHA-256 `ce4186135f0e59a2fa5a38e0f1be04cdd8e324f1b4743a7e3d1cee4dfb0c4b5f`.
The first-language and local farming review gate in
`docs/narration-reviews/INTRO-PERMACULTURE-AUDIO-HOLD-2026-09-24.md` still applies.

From a checkout that contains that exact script and its English art plan:

```sh
node scripts/make-lesson-slides.mjs intro-permaculture zu /tmp/intro-permaculture-zu-base
python3 docs/media/intro-permaculture/render-zu-deck.py intro-permaculture
npm run assets:sizes
```

The first command uses `docs/narration/intro-permaculture.zu.md`, the existing
module artwork, and `docs/course-deck-art.json`. The Pillow post-processor reads
the emitted slide JSON and PNGs from the temporary output. It adds isiZulu
titles and source sentences to scene slides, replaces English labels in the
three Watch diagrams, and marks all images `OKUSALUNGISWA NGE-AI · AKUKABUYEKEZWA`. It writes
1920×1080 JPEG stills at quality 88. It makes no animation and uses no paid
generation credits. The 22 stills total 6,024,458 bytes (about 5.8 MB decimal).

The post-processor is reusable for another module when its isiZulu script and
English art plan exist: render its `zu` base PNGs with `make-lesson-slides.mjs`,
then run `render-zu-deck.py <module-id>`. Diagrams with labels baked into source
art need a module-specific localization pass. Per module, verify the source
script hash, visible copy and badges on all slides, baked-in diagram labels, a
contact sheet, and representative 390-pixel samples. This Introduction renderer
has specific overlays for its existing diagrams on slides 7, 13 and 19.
Familiar teaching terms such as *Permaculture*, *biomass* (explained with leaves
and plant remains), *windbreak*, *zones/sectors*, *swale* and *borehole* remain
where they are paired with isiZulu context. Generic subheads, review badges and
diagram labels are localized.

Before release, inspect the full contact sheet at
`docs/media/intro-permaculture/zu-contact-sheet.jpg`, then inspect slides 2, 4,
7, 13 and 19 at a 390-pixel viewport. Check that each of slides 1–22 visibly
contains isiZulu text, the source teaching is still represented, no text is
cropped, and the deck has no horizontal overflow. Slides 7 and 13 deserve a
source check: slide 7 asks learners to check sharing permission and borehole
capacity; slide 13 says hail damage depends on the storm and maize growth stage
and makes no survival promise. No fluent isiZulu or human farming review is
claimed by the contact sheet or viewport check.
