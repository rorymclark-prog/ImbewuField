# Young food forest: illustrated establishment tour

Replaces Food Forest slide 15's flat planting sequence with a warm homestead scene, guided close-ups and synchronized English narration. It teaches establishment care and when to consider the next addition, rather than presenting one mandatory planting order. Adjacent slide 14 retains the wider sequencing explanation.

## Reproduce

The built-in image_gen edit and reference are recorded in `source-prompt.txt`. `source.png` preserves the reviewed scene with an unmistakable open collar around the young tree's trunk.

```sh
uv run --with edge-tts python scripts/record-forest-layer-tour.py --art-dir docs/media/studies-animation-quality/forest-establishment
python3 scripts/render-forest-layer-tour.py --art-dir docs/media/studies-animation-quality/forest-establishment --out "$PWD/public/course-animations/food-forest/tour-young-forest.mp4"
```

The existing renderer accepts an optional transition duration and overview label, so this scene is correctly labelled an illustrated example rather than a cutaway. Other storyboards keep their default transition timing. The exact spoken phases and focus regions are in `storyboard.json`; audio hashes, word boundaries and starts in `timing.json`.

## Reviewed evidence

Source artwork inspected: young tree crown, clear trunk base, loose leaf mulch, coherent hands and competing grass being removed. All five phase views inspected at 400 pixels wide; labels fit and focus outlines identify the intended features. Eight successive decoded frames across the first camera transition were inspected together; the camera eases toward mulch without morphing trees or people. The narrated browser movie completed twice, 33.291667 seconds, `readyState=4`, `ended=true`, no media error. This is guided camera motion over an illustration; it is not filmed gardening or simulated growth.

Final video: 1600 × 1100, 24 fps, 799 frames, 6,436,310 bytes. Full decode passed. English speech: 32.04 seconds, existing South African Luke voice at -12%, with 72 returned word-boundary events matching the complete narration text. Audio and video hashes are retained. This uses the existing Edge fallback, not AGY; fluent human listening and physical-phone review remain open.

The slide still, transcript, narration script, audio manifest and animation registry change together. The complete Food Forest MP3 is concatenated from all 20 individual tracks without re-encoding; the codec, rate and channels were checked equal first. A one-time offline migration removes only the replaced English slide-15 audio, full audio and still, preserves other downloads, and never auto-downloads a replacement. Its regression check covers removal, preservation and idempotency. The movie has a new URL and all download sizes are regenerated.

Primary-source accuracy review: `FACT-CHECK.md`. Local before/after review: `Downloads/ImbewuField-Animation-Quality-2026-09-20/forest-establishment/REVIEW.html`.

Local verification: typecheck clean; full test suite passes with zero failures and one existing shape-sync TODO; whitespace check clean. Browser preview found that choosing Watch after speech had begun left the picture behind the voice. The three word-timed tours now follow the audio clock after loading, seeking, pausing or resuming; the last visual hold finishes before advancing. Narrated mode uses the audio controls for both streams; silent watching retains video controls. An actual-player regression test covers the late-load reproduction, native audio controls, drift recovery, buffering, and final hold. Independent demonstration clips retain their own timing. Final preview and production checks are recorded in issue #35 after release.
