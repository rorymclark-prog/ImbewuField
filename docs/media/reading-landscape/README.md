# Reading the Landscape media — 20 September 2026

The English module now has 21 slides and all four authored Watch animations, with its existing 21 recordings. This branch follows Introduction (#447), which follows Water (#446); merge in that order. It also records Introduction's successful deployed offline follow-up. No narration, lesson, quiz, species, farming figure, saved geometry or PLAN_VERSION changed. isiZulu remains a review draft and is not published here.

## What the four clips show

- Slide 5: rain reaches a descending slope; surface flow spreads, some water sinks into soil, and low-ground water gathers and leaves the frame. There are no claimed storage volumes or engineered structures.
- Slide 9: a north–south section, north on the left, compares a higher summer sun and lower winter sun. Building/tree shadows point away from the sun and lengthen as it lowers. The ray/ground intersections use the drawn slope. This is a conceptual comparison, not a solar-angle or latitude calculator.
- Slide 13: wind crosses ridges and a gap, followed by a separate cold-air sequence gathering above the soil in low ground. Soft air shading replaces the draft's water-like rectangle; the two stages remain distinct.
- Slide 17: an example boundary, north arrow, existing building, road, water feature and slope marks appear progressively. Contours are kept behind the water feature; the completed drawing holds briefly before the clip ends. It is not a measured survey or proposed farm design.

Every full Watch caption matches its authored English passage after whitespace normalization. Diagram labels use the source's concepts. The new clips are silent: the app plays the original MP3 alongside them. Each lasts 14 seconds, a viewing duration rather than a farming instruction, and exceeds its recording by at least one second. Together the videos are 1,224,227 bytes.

## Production and verification

Antigravity generated the local Pillow/FFmpeg renderer from the current script and a bounded brief. Codex reviewed the code and rendered phases, correcting shadow geometry, downhill pooling, overflowing labels, translucent edges, road drawing and contour overlap. Captions and labels are at least 28 pixels in each 1280×720 source frame, with measured diagram-label wrapping. All four videos are H.264/yuv420p, 24 fps, faststart, and contain no audio stream.

`verification.json` records actual bytes/durations/hashes, poster hashes, unchanged source-audio hashes and complete decode checks. Each encoded clip was sampled at 2 fps. A diagram-only pixel check ignores small compression changes: a changed pixel must differ by more than 12 grey levels, and a moving transition must change more than 0.05% of the diagram. At least eight such transitions are required. The clips passed with 26, 26, 26 and 23 moving transitions; independently encoded frozen-poster controls all had zero. This avoids mistaking codec noise or changing captions for teaching motion.

The teaching-phase contacts, final corrected posters and 21-slide contact sheet were visually inspected. The local app displayed the new deck and played the water animation and matching narration together with readyState 4 and advancing playback. Physical-device and fluent-language review are not claimed. Offline pack contents and exact sizes use the existing pack builder; deployed disconnected playback is checked after the branch preview is built. Introduction's same player/cache path passed all three downloaded Watch clips with the connection disabled.

Local `npx tsc --noEmit`, `npm test` (3,632 pass, zero failures, one existing TODO) and `git diff --check` passed in order.

## Reproduce and review

```sh
python3 scripts/render-landscape-concepts.py --output OUTPUT --audio-dir public/course-audio/reading-landscape/en --preview
python3 scripts/render-landscape-concepts.py --output OUTPUT --audio-dir public/course-audio/reading-landscape/en
```

Requires Pillow, FFmpeg/FFprobe and Arial or DejaVu fonts. Missing recordings fail rather than producing a silently unpaired clip. Preview mode generates posters and contacts only. The full render streams RGB frames and records probed metadata.

The slide deck uses the existing `scripts/make-lesson-slides.mjs reading-landscape en OUTPUT --images ART`. Supply each Watch poster as `slide-05.jpg`, `slide-09.jpg`, `slide-13.jpg` and `slide-17.jpg`. The title retains the module's original water-flow illustration, padded rather than cropped. Export JPEG slides at 1920×1080, quality 85.

The local pack is `Downloads/imbewu-studies-2026-09-20/landscape-production/`. It includes the 56-second narrated review reel, made with the reviewed PNG-badge/audio-mux helper in `render-intro-concepts.py`. The speech is neither sped up nor trimmed; the review reel re-encodes it to AAC and pads scene tails. The app uses the unchanged original MP3s. The review reel is not included in the learner's automatic download.
