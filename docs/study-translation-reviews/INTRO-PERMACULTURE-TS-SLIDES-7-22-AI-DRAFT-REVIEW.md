# Introduction to Permaculture — Xitsonga source-paired slide drafts

**Unreviewed machine draft.** The source-paired packet is
[`docs/narration/intro-permaculture.ts.paired-draft.json`](../narration/intro-permaculture.ts.paired-draft.json).
It retains the complete exact English source for all 22 slides. Across slides
1–6, the packet has six heading drafts and seven body drafts. Slides 9 and 16
have three additional body candidates. All other fields on slides 7–22 remain
English holds: 16 headings and 58 body paragraphs. These are partial drafts,
not completed translations.

The three candidate lines are slide 9's closing transition and slide 16's two
reflection prompts. Gemini 3.8 Flash Low generated the candidates; Gemini 3.1
Pro Low independently backchecked them. This is not fluent-language review,
Shangani comprehension evidence, or local farming approval. The other text on
slides 7–22 stays in English where it describes ethics, water permissions,
earthworks, crop or animal care, zone numbers, windbreaks, or field procedures.
The slides about plot edges, consequences, and site-specific wind also remain
fully in English because the candidate wording or intended meaning was
uncertain.

## Registered review frames

From the repository root, validate and render the source-paired packet with:

```sh
node scripts/make-lesson-slides.mjs intro-permaculture ts /tmp/intro-permaculture-ts-review \
  --paired-draft docs/narration/intro-permaculture.ts.paired-draft.json
```

The checked renderer produced all 22 source-paired WebP frames from the exact
English illustrations. Every frame has an `XITSONGA AI DRAFT / NOT REVIEWED`
banner, a paired Xitsonga panel where text is drafted, rust-coloured exact
English holds, and the complete English source panel. The 22 WebPs add
6,498,854 bytes. Contact sheets for all frames and full-size slides 1, 9, 16
and 22 were inspected; text blocks, holds, source text and page labels fit.

The renderer validates every candidate against the current English narration.
No narration, lesson body, quiz, species, or farming figure changed. Xitsonga
audio is not registered. A fluent Xitsonga speaker familiar with the intended
Shangani learners and a local farming reviewer must still check the wording,
comprehension, and every source pair before approval or classroom reliance.
