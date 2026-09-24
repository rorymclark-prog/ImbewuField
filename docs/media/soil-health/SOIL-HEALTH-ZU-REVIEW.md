# Soil Health isiZulu media draft — 24 September 2026

**Status: UNREVIEWED DRAFT.** This branch prepares 20 isiZulu slide stills and
matching per-slide/full narration from the current English source meaning. It
does not claim fluent-language, practitioner, farmer or learner approval.

## What is included

- 20 still slides at 1920 × 1080, with a contact sheet and selected 390 px
  phone-width samples under `qa/`.
- Twenty per-slide MP3s plus an ordered full track in
  `public/course-audio/soil-health/zu/`, recorded with
  `zu-ZA-ThandoNeural` at `-12%`, matching the Seeds voice settings.
- Slide titles and per-slide course audio mapping in `lib/course-audio.ts`.
- `soil-health` isiZulu slide routing in `lib/course-deck.ts`.
- The existing compost Flow videos remain available to English. In isiZulu,
  slide 10 reuses an existing South African smallholder photo of a Black African
  farmer with compost materials; slide 11 uses the compost-layer illustration.
- No Flow credits were spent. Slide 14 remains a static still. No new
  SVG/code animation was created.

## Content alignment

The narration file now follows the current 20-slide English script and the
source-backed isiZulu lesson drafts. It removes stale fixed jar instructions,
compost timings/ratios/temperatures, regional cover-crop schedules and
worm-leachate dilution/use claims. Slides 14, 17 and 18 preserve the corrected
rain-impact boundary, natural leachate definition and edible-crop warning, and
the distinction between storm impact and soil transport where runoff occurs.

No species names or farming numbers were added. Existing examples are retained
only where the English module names them. The leachate wording, agricultural
terms and crop-name pronunciation still need first-language local farming
review.

## Rebuild and verification

```sh
python3 docs/media/soil-health/render-zu-stills.py
uv run --with edge-tts python scripts/record-soil-health-zu-draft.py STAGE_DIR
node scripts/import-course-audio.mjs soil-health STAGE_DIR
node scripts/gen-asset-sizes.mjs
```

`verification-zu.json` records every slide path/hash/size and source hash.
`audio-proof/RUN.json` and its adjacent proof files record source, voice, rate,
duration, byte count, audio hash, word-boundary equality and full-decode results.
No listening review is claimed. Audio is only a voice candidate until a
fluent isiZulu speaker who farms reviews it.

Contact-sheet and phone-size inspection found all 20 slides render without
overflow. The localized text remains a draft and carries an unreviewed badge.
