# Xitsonga Vegetables and Staple Crops paired still deck — 28 September 2026

**Status: unreviewed machine draft.** This 18-frame deck is for fluent-language
and local farming review. It is silent: no Xitsonga narration was created or
registered. Every frame keeps the illustrated English slide, the Xitsonga
draft/English-hold panel, and the exact English narration source visible.
Nothing here claims fluent-language approval, learner comprehension, or local
farming approval.

The source is `docs/narration/vegetables-staples.ts.paired-draft.json`, checked
against `docs/narration/vegetables-staples.en.md`. It contains four existing
draft paragraphs: the closing observation on slide 13 and three short
paragraphs on slide 14. All 113 English holds remain verbatim. The draft word
“Resilience” stays in English inside its Xitsonga sentence; check whether that
mixed wording is understood in the intended written variety.

All crop-specific or operational guidance remains exact English, including
maize storage and seed isolation, bean and cowpea harvest, sweet-potato water
conditions, amadumbe's conditional wet-ground use, bed dimensions, sowing and
spacing, pest response, and field actions. The Xitsonga drafts add no crop
species, measurement, or farming instruction.

## Render and visual check

The paired renderer validated all 18 source records and rendered 18 WebP frames
at 1440 × 5400 from the existing English artwork. The full contact sheet and
390 px samples for slides 1, 13, 14 and 18 are under
`docs/media/vegetables-staples/ts-paired-review/`. I inspected the contact
sheet and those four phone-width samples. The unreviewed banner, source art,
draft and hold colours, exact English panel, and page count are visible; I saw
no clipping in those samples. Other slides were checked in the contact sheet,
not individually at phone width. I compared regenerated slides 13–14 with the
previous frames: the English artwork, target wording and source narration are
unchanged. The source-panel caption now says “EXACT TEXT” instead of “EXACT
NARRATION”; the wording itself remains exact.

The deterministic render command is:

```sh
python3 docs/media/vegetables-staples/render-ts-paired.py
```

The output frames are stored under `public/course-decks/vegetables-staples/ts/`.
The Study registry now selects all 18 frames. It opens silent by default, with
available English source narration only by explicit choice. No Xitsonga audio
asset or audio manifest entry was added.
