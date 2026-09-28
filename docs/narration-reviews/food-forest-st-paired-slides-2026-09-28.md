# Sesotho Food Forest source-paired slides — 28 September 2026

All twenty Study slides now have a silent Sesotho review frame. This is an unreviewed machine-draft comparison aid, not fluent-language approval or local farming approval. No Sesotho narration was created or registered.

The frames reuse the existing English slide illustrations and the current paired source in `docs/narration/food-forest.st.paired-draft.json`. Exactly three body paragraphs are shown as Sesotho drafts: slide 4 paragraphs 1–2 and slide 8 paragraph 2. Every other heading and paragraph is an explicit exact-English hold. The renderer validates every English heading and paragraph against `docs/narration/food-forest.en.md`; it does not edit or paraphrase the paired packet.

The top panel shows the complete English source slide. The middle panel marks the Sesotho draft or English hold; the bottom panel repeats the exact English text. Every frame says **SESOTHO AI DRAFT / NOT REVIEWED**. The learner starts silent. Existing English source narration remains a separate choice. The existing English sheet-mulching Flow poster is suppressed for Sesotho because it would cover the paired source and draft text on slide 16; no Flow asset or narration was added.

Review needed: a first-language Sesotho speaker should check the three existing draft passages for grammar, register and meaning, especially `moru wa tlhaho`, `boemo ba tsona`, and `masalla a makgasi`. A local food-forest practitioner should separately confirm the conceptual wording. Species, legal claims, climate/site selection, water, planting, establishment care, pruning and field actions remain English holds.

## Render and visual evidence

Regenerate with:

```sh
python3 docs/media/food-forest/render-st-paired.py
```

The script uses the existing paired-draft validator and English source renderer, exports twenty 1440×5400 WebP frames, a full contact sheet, 390-pixel captures of slides 4 and 8, and a hash report. The contact sheet and captures were visually inspected. `docs/media/food-forest/qa/st-paired-verification.json` records each frame, the source hashes and the review limitations.
