# Tshivenda Food Forest source-paired slide deck — 28 September 2026

**Status: unreviewed machine draft.** These 20 static comparison frames keep the exact English slide source beside each Tshivenda draft or English hold. They reuse the existing English Food Forest slide illustrations; no new art or narration was created. This deck is for fluent-language and local farming review, not approved learner instruction.

The existing source-paired record is `docs/narration/food-forest.ve.paired-draft.json`, checked against `docs/narration/food-forest.en.md`. It contains four Tshivenda body fragments: three on slide 4 and one on slide 6. Every heading and the other 66 body fragments remain exact English holds. Plant names, restrictions, spacing, site selection, establishment and ongoing care guidance stay in English. Keep the English terms visible until a fluent speaker and local farming practitioner review the source pairs.

## Render and visual check

The paired-draft renderer validated all 20 English source records and produced 20 1440 × 5400 frames. The contact sheet is `docs/media/food-forest/qa/ve-source-paired-contact-sheet.jpg`; representative 390 px samples are `ve-slide-01-390.jpg`, `ve-slide-04-390.jpg`, `ve-slide-06-390.jpg`, `ve-slide-07-390.jpg` and `ve-slide-20-390.jpg` in that directory. I inspected the contact sheet and all five samples. The unreviewed banner, illustrated English source, target panel, exact English source panel and page numbering are visible; no clipping was apparent at the checked size.

The 20 WebP frames are under `public/course-decks/food-forest/ve/`. Rebuild the source frames with:

```sh
node scripts/make-lesson-slides.mjs food-forest ve /tmp/food-forest-ve-paired \
  --paired-draft docs/narration/food-forest.ve.paired-draft.json
```

Convert the generated PNG frames to WebP for the stored deck. The draft is not fluency-reviewed, and this visual check does not establish learner comprehension or farming approval.

The Study registry now selects all 20 frames. It opens silent by default, with available English source narration only by explicit choice. No Tshivenda narration was added.
