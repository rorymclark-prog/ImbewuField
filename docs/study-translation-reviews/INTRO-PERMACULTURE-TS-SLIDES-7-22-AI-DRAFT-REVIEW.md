# Introduction to Permaculture — Xitsonga slides 7–22 draft

**Unreviewed machine draft.** The source-paired packet is
[`docs/narration/intro-permaculture.ts.paired-draft.json`](../narration/intro-permaculture.ts.paired-draft.json).
It retains the complete exact English source for all 22 slides. Slides 7–22 have
three Xitsonga body candidates and 74 English-held fields (16 headings and 61
body paragraphs total: 77 fields). All 16 titles remain exact English.

The three candidate lines are slide 9's closing transition and slide 16's two
reflection prompts. Gemini 3.8 Flash Low generated the candidates; Gemini 3.1
Pro Low independently backchecked them. This is not fluent-language review,
Shangani comprehension evidence, or local farming approval. The other text on
slides 7–22 stays in English where it describes ethics, water permissions,
earthworks, crop or animal care, zone numbers, windbreaks, or field procedures.
The slides about plot edges, consequences, and site-specific wind also remain
fully in English because the candidate wording or intended meaning was
uncertain.

## Render a visibly unreviewed proof

From the repository root, validate and render the source-paired packet with:

```sh
node scripts/make-lesson-slides.mjs intro-permaculture ts /tmp/intro-permaculture-ts-review \
  --paired-draft docs/narration/intro-permaculture.ts.paired-draft.json \
  --paired-art docs/study-translation-reviews/INTRO-PERMACULTURE-ST-PAIRED-ART.json
```

The renderer checks the exact English paragraphs and adds an `XITSONGA AI
DRAFT / NOT REVIEWED` banner. English holds appear as English in the paired
frames. Inspect slides 9 and 16 at phone width and check every draft against
the source before asking a fluent Xitsonga speaker familiar with the Shangani
learners to review it. Keep the paired English source, review notice, and holds
when these candidates are wired to a learner surface. Slides and narration
remain English until separately translated and reviewed; no audio or deck
assets are included in this data batch.
