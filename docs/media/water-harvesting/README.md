# Water Harvesting media — 20 September 2026

The English Water module now has 24 authored slides and six opt-in Watch animations, using the existing 24 English recordings. The new assets are registered in course-deck.ts and the generated offline size manifest. No lesson, quiz, species, farming figure, narration text or PLAN_VERSION changed.

## Sources and production

- Slides 4 and 7 reuse Rory’s recent Mzomoyethu animations. Slide 4 is seconds 0–16 of “Mzomoyethu - swale side profile v2.mp4”; slide 7 is seconds 56–69 of “Mzomoyethu - guided site v3.mp4”. The latter is a lined garden pond example, not an engineered dam.
- Source masters: Documents/ChatGPT/Work & Clients/Mzomoyethu review 2026-09-18/controlled-animation/. Originals are unchanged. Cropping was avoided; the complete frame is scaled to 824×720, H.264/yuv420p, 24 fps, faststart and no audio stream.
- Antigravity produced conceptual motion diagrams for slides 9, 12, 16 and 21. Reviewed corrections removed opaque root overlays, separated the dam crest from the lower side spillway, and replaced added prose with the exact existing Watch sentences. These are English-labelled concept diagrams, not construction drawings.
- Reproduce the concept clips with `python3 scripts/render-water-concepts.py OUTPUT_DIRECTORY [SLIDE ...]`. Pillow, NumPy, Homebrew FFmpeg and macOS Arial fonts are needed. Diagram times control illustration pacing; they are not farming instructions.
- The slide deck uses the existing `scripts/make-lesson-slides.mjs` generator and exact authored English script. Supply `--images` with `slide-NN.jpg` matching each Watch poster; never let its positional lesson-art fallback choose Water illustrations. The title frame is padded to retain the entire source picture. JPEG exports are 1920×1080, quality 85.
- Exact hashes, durations, bytes and independent decode/motion checks are in verification.json.

## Player behavior and checks

The phone preview revealed that square clips were squeezed into a 16:9 frame. The manifest now declares their aspect ratio. The player waits for both the selected animation and narration to finish, so the short English voice cannot cut off the teaching action. No video element or video download is created before Watch is chosen (unless the learner already downloaded it for offline playback).

The player resolves spoken language using the existing narration resolver and explicitly discloses a fallback. Offline packs contain that same spoken language. This corrects the prior combination of silent English-only decks and a false “spoken lesson is in your language” note.

All six complete video files decode. Sampling decoded frame hashes at 2 fps found real changes, and an identical-frame control fails that check. Contact sheets were visually inspected across every teaching phase. The local Studies preview was checked at a 390×844 viewport, including the Mzomoyethu animation’s actual moving video and matching narration. React event-order tests cover either stream finishing first and confirm that no video loads before selection. These checks are not a physical-device or fluent-language review.

`npx tsc --noEmit`, `npm test`, and `git diff --check` passed in order: 3,632 passing tests, zero failures, one existing TODO. The unknown-module and readiness tests were generalized because Water no longer truthfully satisfies their old “no deck / Lessons only” fixtures; the original rules remain covered.

## Review-only material

The local delivery pack is Downloads/imbewu-studies-2026-09-20/. Its water-production folder contains the six-slot 95-second English review reel, source scripts, contact sheets and mechanical audio QA. The 24 isiZulu review takes remain outside public/ and are not registered or presented as approved. Fluent pronunciation, translation and comprehension review remain outstanding; Water is still in progress.

The separate case-study folder contains a compact copy of the corrected 19 September “extended with music - English - v3” Mzomoyethu film, with subtitles and chapters retained. It is approximately 10m46s and 38.5 MB. It is not part of the learner’s automatic course download. Older complete-film commentary was not reused.

This changes the Studies pictures and playback. It does not change saved farm geometry or plan-sheet rendering. PLAN_VERSION is unchanged. Production publication is not claimed by this branch.

## Deployed offline follow-up

On the combined Market preview, all 64 Water files saved (9.2 MB). With the tab disconnected, all six Watch video/narration pairs played at readyState 4 with advancing time, including both Mzomoyethu excerpts. Network emulation was restored afterwards. This is a browser check, not a physical learner-device test.
