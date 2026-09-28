# Food Forest Design — Xitsonga silent slide draft

28 September 2026. This is a source-paired machine draft, not fluent-language review or local
farming approval. No narration was created or registered.

## Learner deck

The complete twenty-slide Xitsonga deck uses the existing English illustrations and exact English
source text. Every frame is labelled **XITSONGA AI DRAFT / NOT REVIEWED** and has a paired panel
showing the Xitsonga draft or the exact English hold, followed by the complete English source.
Slides open silently; English source narration remains an explicit optional choice.

Only three existing concept sentences are drafted:

- Slide 4: the first two body passages about an indigenous forest using space, light and moisture
  at different levels.
- Slide 8: the second body passage about shade and leaf litter changing conditions below as plants
  grow.

All headings and every other passage remain exact English. In particular, species identity and
legality, regional examples, site suitability, water, establishment, pruning, and field actions
remain held in English. No species name, farming figure, recommendation, or lesson wording was
added or changed.

## Review still needed

A fluent Xitsonga reviewer and a local food-forest practitioner have not reviewed this deck. The
intended Shangani-speaking learner group also needs the local educator trial described in
[`SHANGANI-XITSONGA-SPEAKER-TRIAL.md`](SHANGANI-XITSONGA-SPEAKER-TRIAL.md). These frames must not be
presented as approved or used as the sole farming instruction.

## Render and visual evidence

Regenerate the frames, contact sheet, phone captures and checksum report with:

```sh
python3 docs/media/food-forest/render-ts-paired.py
```

The script validates every slide against the current English narration via
`scripts/make-lesson-slides.mjs`. The twenty WebP frames are 1440×5400. Review the whole deck at
[`ts-paired-contact-sheet.jpg`](../media/food-forest/qa/ts-paired-contact-sheet.jpg) and the full
phone-width captures for slides 4 and 8 beside the report at
[`ts-paired-verification.json`](../media/food-forest/qa/ts-paired-verification.json).
