# Sesotho Food Forest source-paired slides — 28 September 2026

All twenty Study slides now have a silent Sesotho review frame. This is an unreviewed machine-draft comparison aid, not fluent-language approval or local farming approval. No Sesotho narration was created or registered.

The frames reuse the existing English slide illustrations and the current paired source in `docs/narration/food-forest.st.paired-draft.json`. In addition to the original three draft paragraphs on slides 4 and 8, the 29 September batch adds orientation drafts to slide 1 paragraphs 1 and 4, slide 2 heading and paragraph 1, and slide 3 heading. A later 29 September batch adds slide 8 and 13 headings and slide 13's first habitat paragraph as unreviewed drafts. Every remaining held field displays exact English. The renderer validates every English heading and paragraph against `docs/narration/food-forest.en.md`; it does not edit or paraphrase the paired packet.

On 30 September, slide 4 paragraphs 3–4 and the matching Sesotho learner lesson gained two descriptive machine drafts about the forest pattern and layers. `food forest`, `productive species` and `layers` remain visible English technical terms; the full exact English sentences remain paired. The wording needs first-language Sesotho and local practitioner review before it is treated as approved. Species selection, planting instructions and ongoing care still remain exact-English holds.

The top panel shows the complete English source slide. The middle panel marks the Sesotho draft or English hold; the bottom panel repeats the exact English text. Every frame says **SESOTHO AI DRAFT / NOT REVIEWED**. The learner starts silent. Existing English source narration remains a separate choice. The existing English sheet-mulching Flow poster is suppressed for Sesotho because it would cover the paired source and draft text on slide 16; no Flow asset or narration was added.

Review needed: a first-language Sesotho speaker should check all drafts for grammar, register and meaning, especially `layers`, `food forest`, `qala` (starting versus establishing), `moru wa tlhaho`, `boemo ba tsona`, `masalla a makgasi`, and the mixed `indigenous plants` and `habitat` terms. A local food-forest practitioner should separately confirm the conceptual wording. Species, legal claims, climate/site selection, water, planting, establishment care, pruning and field actions remain English holds.

## Render and visual evidence

Regenerate with:

```sh
python3 docs/media/food-forest/render-st-paired.py
```

The script uses the existing paired-draft validator and English source renderer, exports twenty 1440×5400 WebP frames, a full contact sheet, 390-pixel captures of slides 1–4 and 8, and a hash report. `docs/media/food-forest/qa/st-paired-verification.json` records each frame, the source hashes and the review limitations.
