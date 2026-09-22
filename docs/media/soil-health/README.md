# Soil Health & Composting media — 20 September 2026

> **Current status — 22 September 2026:** the three locally drawn clips described below were withdrawn from the learner player under Rory’s visual-quality rule. Slide 10 now uses the separately reviewed Flow candidate `flow-build-compost-heap`; slides 5 and 14 use their existing stills. Slide 11 retains `flow-compost-materials`. The production record below is historical, not approval.

The historical production pass registered twenty English slides and three locally
authored Watch clips with the existing twenty English recordings. The current
learner registration is described above. This branch follows Reading the Landscape
(#448), Introduction (#447) and Water (#446). It also records Reading's successful
deployed offline follow-up. No lesson, quiz, narration, species, farming figure,
saved geometry or PLAN_VERSION changed. isiZulu remains an unpublished review draft.

## What the clips show

- Slide 5: a worm moves through dark topsoil and leaves a visible channel, beside pale compacted soil. The source's smell clues remain words, not a fabricated visual test.
- Slide 10: dry browns and fresh greens build a heap in layers, followed by modest moisture, air and abstract decomposer activity. No worms, temperatures, layer depths, ratios or timers are added to the Watch scene.
- Slide 14: equal rain falls on identical sloping ground, bare on one side and mulched on the other. Bare impacts lift soil particles; mulch receives the rain on its surface. Water continues downslope on both sides. There is no claimed erosion percentage or immunity from runoff.

Each silent clip is 14 seconds, a viewing duration rather than a farming recommendation. Full captions match the exact authored Watch passages after whitespace normalization. The original MP3s are unchanged and play separately in the app. The videos total 612,914 bytes.

## Production and checks

Antigravity supplied the local Pillow/FFmpeg renderer. Codex reviewed the code and phase contacts, correcting upward-moving compost layers, label overflow, rain crossing labels, soil particles hidden below the surface and overly regular rain phases. Missing source audio now fails explicitly; final durations are probed from the encoded files. Headers, labels and captions use fonts of at least 28 pixels in the 1280×720 source.

All three H.264/yuv420p, 24 fps, faststart clips fully decoded, with one silent video stream each. `verification.json` records bytes, durations, source/audio/poster hashes, full-caption matching and diagram-only motion measurements. Motion checks at 2 fps reject compression noise and require at least eight materially changing transitions. Independently encoded frozen-poster controls are required to have none.

Phase contacts, the corrected rain sequence and the complete 20-slide contact sheet were visually inspected. The local app showed the Soil deck and played the living-soil video with its original narration at readyState 4 and advancing time. No physical-device or fluent-language review is claimed. The deployed preview saved 49 files (5.4 MB); with its tab connection disabled, all three Watch video/audio pairs played at readyState 4 with advancing time. The connection was restored afterwards. Reading and Introduction also passed disconnected playback.

Local `npx tsc --noEmit`, `npm test` (3,632 pass, zero failures, one existing TODO) and `git diff --check` passed in order.

## Reproduce

```sh
python3 scripts/render-soil-concepts.py --output OUTPUT --audio-dir public/course-audio/soil-health/en --preview
python3 scripts/render-soil-concepts.py --output OUTPUT --audio-dir public/course-audio/soil-health/en
```

Requires Pillow, FFmpeg/FFprobe and Arial or DejaVu fonts. The existing slide generator consumes the unchanged English narration. Supply Watch posters as slide-05.jpg, slide-10.jpg and slide-14.jpg; the title uses the module's existing soil illustration, padded to preserve it. App slides are 1920×1080 JPEGs, quality 85.

`Downloads/imbewu-studies-2026-09-20/soil-production/` contains a 42-second narrated review reel. The reviewed helper in `render-intro-concepts.py` muxes unchanged speech without speed changes or trimming, re-encodes the review copy to AAC and pads scene tails. The app uses the original MP3s; the review reel is outside automatic learner downloads.
