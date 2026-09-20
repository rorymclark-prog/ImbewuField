# Introduction to Permaculture media — 20 September 2026

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
