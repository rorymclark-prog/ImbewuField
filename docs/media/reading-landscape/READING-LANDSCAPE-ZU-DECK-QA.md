# Reading the Landscape isiZulu still deck QA

Status: machine-drafted isiZulu deck and narration for labelled learner preview. Rory authorised publication before later review. No fluent speaker, farmer, crop-health, engineering or earthworks approval is claimed.

## Source pairing and audio status

The 21 frames were rendered from the corrected isiZulu script snapshot rebuilt from the four current full-draft review packets. Its SHA-256 is `a22e0b20fa037fe3ff7be065cc9423868fe1e74aca542fa4b881295bc6c8e26b`. The exact input copy is [`reading-landscape-zu-render-source.md`](reading-landscape-zu-render-source.md). The recorded isiZulu script now has the same SHA-256, and `zu-ZA-ThandoNeural` recordings are registered for all 21 slides and the full lesson. The deck build itself does not edit lesson, narration or audio files. All still source hashes are in [`verification-zu.json`](verification-zu.json), and the deterministic renderer is [`render-zu-stills.py`](render-zu-stills.py). Audio boundary and file proofs are in [`../../narration-reviews/reading-landscape-zu-audio-assets.md`](../../narration-reviews/reading-landscape-zu-audio-assets.md).

The supplied snapshot at commit `b7fbda65a1e0e59de06a4365c6c5947babd270f2` has SHA-256 `5907cc0e4f1c8573f64855e1e8acde0d744ea65d0b596b3da5cf1689e8ca5c55`. It is stale and was not used for the deck or audio. The checked-in `docs/narration/reading-landscape.zu.md` has since been replaced with the corrected source and recorded from that exact text.

The supplied snapshot and the old checked-in isiZulu script have wording differences in every slide block. The notable safety and accuracy conflicts below cite physical line ranges in the supplied snapshot and old checked-in script. Corrected deck wording follows the exact a22e0b2 script snapshot and its indicated full-draft slide sections:

| Slide | Snapshot lines | Current script lines | Stale claim removed; corrected draft section |
| ---: | ---: | ---: | --- |
| 4 | 27–34 | 35–44 | Do not walk during rain or frame all outflow as loss. Safe observation and a safe route for excess water; L1 §Slide 4 (line 105). |
| 6 | 39–46 | 51–60 | Remove two people/two hectares/one morning, no-surveyor assurance, and A-frame construction placement. Equal-height observations only; site assessment before earthworks; L1 §Slide 6 (line 117). |
| 7 | 47–54 | 61–70 | Remove fixed high/middle/low placement rule. No universal placement rule; L1 §Slide 7 (line 123). |
| 8 | 55–62 | 71–80 | Remove Highveld south-hollow frost rule. Scope sun observations to season and location; L2 §Slide 8 (line 93). |
| 10 | 67–74 | 87–96 | Remove the two-metre shade-cloth and all-day shade claim. Check actual site shadows; L2 §Slide 10 (line 119). |
| 11 | 75–80 | 97–106 | Remove the claim that a north-facing wall protects frost-sensitive plants. L2 §Slide 11 (line 137). |
| 12 | 81–88 | 107–116 | Remove fixed Highveld/KZN seasonal wind rules. Observe local wind and check local weather records; L3 §Slide 12 (line 93). |
| 14 | 93–102 | 123–132 | Restore frost damage without visible ice, minimum-temperature records/adviser, and conditional nursery selection; L3 §Slide 14 (line 105). |
| 15 | 103–108 | 133–142 | Remove guaranteed frost-free hillside placement and moving tomatoes as a late-blight cure. Include local records and crop-health advice; L3 §Slide 15 (line 113). |
| 16 | 109–116 | 143–152 | Do not treat pacing as measurement or draw to scale before distances are checked; L4 §Slide 16 (line 91). |
| 18 | 121–128 | 159–168 | Khakibos/blackjack presence alone is not a compaction diagnosis; L4 §Slide 18 (line 119). |
| 20 | 137–144 | 179–188 | Do not walk during heavy rain. Walk only once safe; L4 §Slide 20 (line 155). |
| 21 | 145–161 | 189–239 | Remove fixed placement rule and A-frame-as-design wording. A-frame marks are observations; assess the site before digging; L4 §Slide 21 (line 173). |

Slides 1–3, 5, 9, 13, 17 and 19 also use the corrected draft proposals rather than either stale narration source. Slide 17 remains a still. The image says the concept drawing is not to scale; the slide 16 caption says the sketch stays not to scale until distances are checked. Khakibos/blackjack presence alone is not presented as evidence of compaction.

## Visual review

The complete 21-frame contact sheet is [`reading-landscape-zu-contact-sheet.jpg`](reading-landscape-zu-contact-sheet.jpg). All frames were checked as a contact sheet; selected 390-pixel-wide samples for slides 2, 3, 5, 6, 13, 14, 16, 17, 18, 20 and 21 were inspected after the text-size, diagram label spacing and safety-caption revisions. Photos and existing teaching art are reused. Five diagrams are newly exported as static frames from existing Pillow drawing functions; no animation or video was created and no Flow credits were used.

Asset dimensions are 1920×1080. Per-file byte counts and SHA-256 values are in `verification-zu.json` and generated `lib/course-asset-sizes.ts`.

## Reproduce

```sh
python3 docs/media/reading-landscape/render-zu-stills.py
node scripts/gen-asset-sizes.mjs
```

The renderer assembles its ephemeral narration input from the four source draft files, localizes the diagram labels and deck branding, calls `make-lesson-slides.mjs --source`, then exports JPEG stills. It never opens or rewrites either narration source or any audio file.
