# Market Gardening & Community media — 20 September 2026

Twenty English slides and three authored Watch clips use the module's unchanged twenty English recordings. This branch follows Small Livestock (#452) and records its successful deployed offline follow-up. No lesson, quiz, narration, species, farming figure, geometry or PLAN_VERSION changed. isiZulu stays review-only.

## Teaching scenes

- Slide 4 follows harvest baskets into family food, sales, gifts or compost, then scans the season's record. The table contains ticks, not invented quantities, prices or returns.
- Slide 9 traces roadside sales, grouped delivery to a shop and a household box. Grouped boxes join continuously and remain distinct as they travel.
- Slide 14 connects growers through shared seed, tools, skills, transport and food. Arrows and travelling tokens reveal the network progressively; labels remain outside their paths.

Full captions match the authored Watch text after whitespace normalization. The three silent fourteen-second clips total 401,777 bytes. Fourteen seconds is a viewing duration, not agricultural timing. The app retains original MP3s.

## Verification

Antigravity supplied a local Pillow/FFmpeg renderer. Codex inspected its code and teaching phases, correcting reverse early arrows, snapping delivery boxes, overlapping grower labels and missing book outlines. All twenty slides and the corrected network contact sheet were visually inspected. The local app played the farm-record animation and original narration at readyState 4 with advancing time. No physical-device or fluent-language review is claimed.

The clips are 1280×720 H.264/yuv420p at 24 fps with faststart and no audio stream. Full decodes passed. Verification records file sizes, hashes, actual durations and caption/source-audio matching. Diagram-only motion checks give 18, 22 and 24 moving transitions; independently encoded frozen-poster controls all give zero.

The review pack contains a 42-second narrated reel outside automatic downloads. The reviewed Intro helper retains full speech, without trimming or speeding, and pads tails. Deployed disconnected playback follows preview creation.

```sh
python3 scripts/render-market-concepts.py --output OUTPUT --audio-dir public/course-audio/market-community/en --preview
python3 scripts/render-market-concepts.py --output OUTPUT --audio-dir public/course-audio/market-community/en
```

Requires Pillow, FFmpeg/FFprobe and Arial/DejaVu. Missing or invalid audio fails explicitly. The existing slide generator uses unchanged narration, Watch posters and the original title illustration padded to retain the full image. App slides are 1920×1080 JPEGs at quality 85.

Local typecheck, full suite (3,632 pass, zero failures, one existing TODO), and diff check passed in order.
