# Tshivenda Vegetables and Staple Crops paired still deck — 28 September 2026

**Status: unreviewed machine draft.** This silent 18-frame deck is for fluent
language and local farming review. Every frame shows the existing illustrated
English slide, the Tshivenda draft or exact-English hold panel, and the exact
English narration source. It does not claim fluent-language approval, learner
comprehension, or local farming approval. No narration was created or registered.

The source is `docs/narration/vegetables-staples.ve.paired-draft.json`, checked
against `docs/narration/vegetables-staples.en.md`. It contains one existing
Tshivenda draft paragraph: slide 14's second sentence, preserved byte-for-byte
and visibly marked unreviewed. Slide 12's opening sentence is an exact English
hold. All other narration text, including every operational crop instruction,
also stays an exact English hold. No new translation was added.

## Safety and scope

The source pairing contains 18 records, one draft body paragraph, 116 held
body paragraphs, and 18 held headings. Crop-specific or operational guidance
remains exact English, including crop selection, maize storage and seed
isolation, beans and cowpeas, sweet-potato water conditions, amadumbe's wet
ground use, bed dimensions, sowing and spacing, pest response, treatment labels,
and field actions. This deck adds no crop species, measurement, timing, or
farming instruction. English holds remain visible alongside the English source.

## Source and render validation

The source-pair validator passed all 18 slides and confirmed the English
headings and paragraph arrays match the authored source in order. It also
checks the target paragraph counts and requires each target entry to be either
a non-empty draft or an explicit English hold.

```sh
node scripts/make-lesson-slides.mjs vegetables-staples ve /tmp/vegetables-staples-ve-paired --paired-draft docs/narration/vegetables-staples.ve.paired-draft.json --validate-only
```

The deterministic slide renderer generated 18 PNGs at 1440 × 5400 from the
existing English artwork. Those were encoded as WebP frames under
`public/course-decks/vegetables-staples/ve/` at quality 88. No English artwork,
source wording, or target wording was edited.

## Visual check

I inspected the full contact sheet and the 390 px samples for slides 1, 12, 14,
and 18 under `docs/media/vegetables-staples/ve-paired-review/`. The unreviewed
banner, English artwork, target draft/hold colours, exact English source panel,
and frame count are visible. I saw no clipping in those samples; the remaining
slides were checked in the contact sheet, not individually at phone width.

The frame hashes, dimensions, source hashes, contact sheet, and sample paths
are recorded in `docs/media/vegetables-staples/ve-paired-review/verification.json`.

The deck is silent. No Tshivenda audio asset or audio manifest entry was added.
