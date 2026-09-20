# Food-forest layer tour

Replaces the flat seven-layer animation on Food Forest slide 5 with detailed homestead artwork, a guided camera, focus highlights and large labels. It is an illustrated teaching tour, not simulated plant growth or a documentary of an actual planting.

## Reproduction

1. The selected built-in image_gen artwork is `source.png`. Generation and revision prompts are saved beside it. The first output clipped the canopy and was rejected; it is preserved in the local Downloads review folder, not published.
2. `storyboard.json` contains the exact nine spoken phases and normalized highlight regions. `scripts/record-forest-layer-tour.py` records the existing South African English voice and verifies all returned word boundaries against that text. It writes `narration.mp3` and `timing.json`.
3. `python3 scripts/render-forest-layer-tour.py` renders the 24 fps H.264 tour and poster. It uses Pillow, FFmpeg and macOS Arial. It refuses stale narration hashes or incomplete word/timing evidence.
4. Import only slide 5's narration; rebuild the 20-slide combined audio from the published individual clips. Keep the audio manifest, readable transcript, registered animation dimensions/bytes/duration, poster, downloadable still and generated asset-size table together.

## Reviewed output

Selected source inspected at full resolution: both tree crowns, shrub, soft-stemmed flowers, ground cover, storage roots and supported climber are distinguishable. Nine representative video views inspected together at 400 pixels wide; each label and highlight identifies its intended layer. The initial render's focus was too subtle, so the final render uses a restrained outline and stronger shading outside it.

Final video: 1600 × 1100, 30.375 seconds, 729 frames, 7,425,984 bytes. `render.json` records the SHA and phase starts. Video and audio fully decode without errors. The narrated review movie played to completion in an embedded browser player (`ended=true`, duration 30.375, readyState 4, no media error); the climber phase and overview were inspected in that player. The direct native-video tab crashed; embedded playback succeeded. This does not establish physical phone performance or a fluent human listening review.

Audio: 55 words, 29.088 seconds. Returned word-boundary text matches the full source, and each highlight begins with its corresponding sentence. No word is omitted or clipped according to that mechanical check. Human listening review remains open.

Accuracy references and limitations are in `FACT-CHECK.md`. No species names, planting measurements or yield claims were added. The final narration tells learners that these are planning layers, not fixed height bands, and that plants and spacing depend on their site.

The versioned movie URL avoids stale video. A one-time migration removes only the replaced English slide audio, combined audio and slide still from saved course media. Regression coverage verifies preservation of other downloads, idempotency and no automatic redownload.

Local before/after review: `Downloads/ImbewuField-Animation-Quality-2026-09-20/forest-layers/REVIEW.html`. Deployment verification is recorded in the issue #35 release ledger after publication.

Local release checks: `npx tsc --noEmit` passed; `npm test` completed with 3,637 passing tests, zero failures and one pre-existing TODO; `git diff --check` passed. CI and production checks follow the branch push.
