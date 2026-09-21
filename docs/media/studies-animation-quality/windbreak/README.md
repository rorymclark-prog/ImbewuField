# Wind and shelter: authored teaching motion

Introduction to Permaculture slide 19 replaces its flat field-and-circles diagram with a detailed aerial homestead illustration. Moving arrows show northwest-to-southeast through-flow continuing across the tree-and-shrub belt and slowing toward the crops. Narration explicitly describes the other air going over or around it. This is an animated explanatory overlay, not filmed vegetation or a measured airflow simulation.

## Source and reproduction

`source-prompt.txt` records the built-in image_gen prompt. Its references were the previous windbreak poster for geometry and the reviewed young-food-forest artwork for style. The generated original is `exec-e0531da4-ecb2-4103-8139-c3894bfe3548.png`, copied intact to `source.png`; no API key or Flow credits were used for this source image.

```sh
uv run --with edge-tts python scripts/record-forest-layer-tour.py --art-dir docs/media/studies-animation-quality/windbreak
python3 scripts/render-windbreak-motion.py
```

Pillow and ffmpeg render authored arrows over the unwarped scene. Pixel travel speeds are only visual cues, not farm data. Arrows always continue forward through the belt; they slow smoothly and fade only near the path endpoints. North remains up. The five captions follow returned word-boundary timings, with a final visual hold after speech ends. Title, narration, source and scope live in `storyboard.json`; hashes and complete word boundaries in `timing.json`.

## Review

Source artwork and all five phase views inspected. Two complete browser playbacks reached 30.666667 seconds with no media error; the second used a 390 × 844 viewport. Labels and moving arrows were visible and the page had no horizontal overflow. `playback-review.json` records that evidence. This does not establish fluent human listening or a physical-phone review; both remain open. Accuracy and illustration limits are in `FACT-CHECK.md`.

Final silent movie: 1600 × 1100, 24 fps, 736 frames, 4,248,143 bytes; full decode passed. Voice: 29.376 seconds, en-ZA-LukeNeural at -12%, 72 word-boundary events matching the complete supplied narration. This is the existing Edge fallback, not AGY. The 22-track module audio was rebuilt without re-encoding after checking all tracks share MP3 / 24 kHz / mono, then decoded fully.

The new movie URL avoids reusing a cached older video. A one-time migration removes only the superseded English slide-19 audio, full-module audio and still; all other saved media remains. No replacement downloads automatically. The player uses the existing narration-clock synchronization, including pause, seek, late loading and final hold.

Local before/after review: `Downloads/ImbewuField-Animation-Quality-2026-09-20/windbreak/REVIEW.html`. Repository tests and preview/production verification are recorded in the release ledger after they finish. `PLAN_VERSION` is untouched; this changes the lesson picture, not any farm-plan rendering.
