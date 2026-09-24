# Small Livestock Integration media — 20 September 2026

> **Current-state note, 23 September:** The illustrated-release record below
> describes authored videos that Rory later held for visual quality. The
> adjacent `verification.json` is a historical snapshot of that release, not a
> live asset manifest: its slide-9 `watch-09-bee-pollination.mp4` and slide-14
> `watch-14-nutrient-loop.mp4` entries and hashes record the old authored
> renders. Neither movie nor its poster is present in the current public
> payload or learner player. Current source registration is in
> `lib/course-deck.ts`: slide 9 uses the separate
> `flow-bee-between-blossoms.mp4`; slide 14 has no registered video. The
> current static slide-14 diagram still overstates a closed nutrient cycle. See
> `../studies-animation-quality/small-livestock-l3-lesson-check.md` before
> reusing any of the older render or verification results.

## Illustrated-release update

The history below describes the earlier media branch. The current illustrated release supersedes its unchanged-audio and unchanged-content statements: source-backed livestock corrections now update lesson bodies, four quiz claims, English narration and all twenty English recordings. AGY reviewed the narration text; the existing Edge TTS pipeline generated the recordings. Automated word-boundary comparison and full decoding passed; this is not human listening approval.

Watch 4 now defines a chicken tractor before showing it. Its clip is 14.583333 seconds; the other two remain fourteen seconds. The verification JSON records bytes, audio hashes, captions and motion checks for that historical illustrated release only. A separate eight-second Google Flow duck scene is included in the illustrated-release manifest. All twenty slides were re-rendered at JPEG quality 90. New playback checks are recorded with the illustrated release, not inferred from the earlier preview. isiZulu remains unpublished review material.

## Earlier branch record


Twenty English slides and the three authored Watch clips are paired with the module's existing twenty English recordings. This branch follows Food Forest (#451) and the earlier Studies stack; it also records Food Forest's successful deployed offline follow-up. No lesson, quiz, narration, species name, farming figure, geometry or PLAN_VERSION changed. isiZulu stays review-only.

## What the clips show

- Slide 4: a chicken tractor pauses and moves across an empty, harvested bed. Birds remain inside with feet on the ground. Scratching affects only the patches the stationary pen has covered; small manure marks remain on the surface. No seedlings, new stocking densities, rotation timetable or instant fertility are added.
- Slide 9: a bee leaves the hive, visits actual flower centres and returns. It carries visible pollen between flowers, with transferred particles appearing after visits. Flowers are generic and unnamed; no placement distances, new hive instructions or yield claims are introduced.
- Slide 14: moving tokens follow plants, animals, manure, compost and the growing bed in that order. Direction arrows remain visible outside the nodes. Raw manure has no direct arrow to the bed; the schematic does not invent a composting time or guarantee complete nutrient closure.

Complete captions match their authored Watch passages after whitespace normalization. The three silent fourteen-second clips total 468,928 bytes. Fourteen seconds is a viewing duration, not farming advice. Original MP3s remain unchanged and play separately in the app.

## Verification and reproduction

Antigravity supplied the local Pillow/FFmpeg renderer. Codex reviewed its code and teaching phases, correcting impossible pest placement, material being cleared before the pen arrived, buried manure marks, a frame beam obscuring a bird, labels crossing the diagram boundary, and arrowheads hidden under nodes. The final posters and twenty-slide contact sheet were visually inspected.

All clips are 1280×720 H.264/yuv420p, 24 fps, faststart, and fully decode without an audio stream. The verification record includes byte counts, video/poster/source-audio hashes, actual durations and exact caption matching. Diagram-only pixel-motion checks give 27, 21 and 27 moving transitions; independently encoded frozen-poster controls all give zero. The local app played the chicken tractor and original narration together at readyState 4 with advancing time. No physical-device or fluent-language review is claimed. The deployed preview saved all 49 files (5.1 MB). With its tab disconnected, all three Watch clips and their original narration played at readyState 4 with advancing time. Network emulation was restored afterwards.

```sh
python3 scripts/render-livestock-concepts.py --output OUTPUT --audio-dir public/course-audio/small-livestock/en --preview
python3 scripts/render-livestock-concepts.py --output OUTPUT --audio-dir public/course-audio/small-livestock/en
```

Requires Pillow, FFmpeg/FFprobe and Arial/DejaVu. Caption and label fonts are at least 28 pixels in the source. Missing or invalid audio fails explicitly. The existing slide generator consumes the unchanged narration, with Watch posters supplied as slide-04.jpg, slide-09.jpg and slide-14.jpg and the original title illustration padded to preserve the full image. App slides are 1920×1080 JPEGs at quality 85.

The local `Downloads/imbewu-studies-2026-09-20/livestock-production/` pack includes a 42-second narrated review reel. The reviewed helper in `render-intro-concepts.py` retains full speech without speeding or trimming, re-encodes the review copy to AAC and pads scene tails. The app uses original MP3s; the reel is outside automatic learner downloads.

Local `npx tsc --noEmit`, full tests (3,632 pass, zero failures, one existing TODO) and `git diff --check` passed in order.
