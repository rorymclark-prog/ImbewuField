# Food Forest Design media — 20 September 2026

The English module now has twenty slides and its three authored Watch scenes, paired with the unchanged twenty English recordings. This branch follows Vegetables (#450), Soil (#449), Landscape (#448), Introduction (#447) and Water (#446), and records the successful Soil/Vegetables deployed offline follow-ups. No lesson, quiz, narration, species name, farming figure, geometry or PLAN_VERSION changed. isiZulu remains review-only.

## Scenes

- Slide 5 reveals the seven source layers with generic unnamed plants, roots below ground and a climber tracing its support. Label leaders follow emerging plants; the final sub-canopy and climber leaders do not cross. Herbaceous plants use leafy stems rather than woody trunks.
- Slide 10 moves cold-tolerant and warm-climate cards within two labelled conceptual regions, then reveals generic plants. The region headings stay visible. Frost, rainfall and humidity remain site checks; no thresholds, new species or geographical boundaries are invented.
- Slide 15 lays sheet mulch, establishes pioneers and fruit trees, then adds lower layers, ground covers and climbers. It shows sequence without a new calendar, spacing, yield or instant soil-recovery claim. The final arrangement holds before ending.

All complete captions match the exact authored Watch passages after whitespace normalization. Each silent clip is fourteen seconds, an illustration duration rather than a farming instruction. The videos total 585,361 bytes. Original MP3s remain separate and unchanged.

## Verification and reproduction

Antigravity supplied the local Pillow/FFmpeg renderer. Codex reviewed its code and phase contacts, correcting foliage scaling, cards covering region headings, floating label targets, crossed leader lines and herbaceous silhouettes. The renderer measures caption and label bounds, requires Arial/DejaVu at least 28 pixels, raises on missing/invalid source audio and probes the actual encoded metadata.

All three 1280×720 H.264/yuv420p, 24 fps, faststart clips fully decode and have no audio stream. `verification.json` records video/poster/source-audio hashes, bytes and durations, exact caption matching, and diagram motion checks that ignore small codec noise. The clips have 22, 18 and 21 materially moving sampled transitions. Independently encoded frozen-poster controls all have zero, so the check can reject static output.

The phase contacts, corrected final posters and entire twenty-slide contact sheet were visually inspected. The local app played the seven-layer animation and original narration together at readyState 4 with advancing time. No physical-device or fluent-language review is claimed. Deployed disconnected playback is checked after the preview builds.

```sh
python3 scripts/render-forest-concepts.py --output OUTPUT --audio-dir public/course-audio/food-forest/en --preview
python3 scripts/render-forest-concepts.py --output OUTPUT --audio-dir public/course-audio/food-forest/en
```

Requires Pillow, FFmpeg/FFprobe and Arial/DejaVu. The existing lesson-slide generator reads the unchanged English narration. Supply Watch posters as slide-05.jpg, slide-10.jpg and slide-15.jpg; pad the original lesson-one title illustration to preserve the complete diagram. App slides are 1920×1080 JPEGs at quality 85.

The local `Downloads/imbewu-studies-2026-09-20/forest-production/` pack includes the 42-second narrated review reel made with the reviewed helper in `render-intro-concepts.py`. The speech is not sped up or trimmed; the review copy is re-encoded to AAC with padded scene tails. The app uses the original MP3s, and the reel is outside automatic learner downloads.

Local `npx tsc --noEmit`, the full suite (3,632 pass, zero failures, one existing TODO) and `git diff --check` passed in order.
