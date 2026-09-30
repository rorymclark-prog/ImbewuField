# Plant Guilds observation prompts — regional review draft, 30 September 2026

**Unreviewed AI language drafts.** Sesotho, Tshivenda and Xitsonga have silent paired still decks
for all 51 source slides. The repeated observation heading and closing reflection question on slide
47 are translated in all three languages. Sesotho and Xitsonga also translate the record prompt on
slide 46; Tshivenda holds that sentence in English because the candidate wording was ambiguous. The
full English slide source is shown below each draft. Slide 47's growth, shade, moisture, harvest,
pest and management statements stay verbatim English. The English word `guild` remains alongside
the established Sesotho phrase; it remains in English in the Tshivenda and Xitsonga drafts.

No fluent-language or local-farming review is recorded. No regional narration is attached or
claimed. Learners can choose the existing English narration separately.

## Exact source scope

- Slide 46 heading: “Let Observation Decide”
- Slide 46 body: “Keep a short record of how the guild performs.”
- Slide 47 heading: “Let Observation Decide”
- Slide 47 closing prompt: “What evidence would make you change the guild?”

Every draft field is paired with these exact English source strings in its language JSON. All other
Plant Guilds heading and body fields remain English holds, including all species identity, plant
selection, nitrogen, spacing, season, mulch handling, pruning, water competition, pest, thinning,
and planting-plan guidance.

## Visual verification

`docs/media/plant-guilds-regional/render-paired.py` uses the existing paired-slide renderer. It
exports all 51 frames per language with a visible `AI DRAFT / NOT REVIEWED` banner, shows the exact
English source on each frame, and marks the held source text in rust. Existing Sesotho frames other
than slides 46–47 are preserved byte-for-byte. The contact sheet and
per-language hashes are in `docs/media/plant-guilds-regional/qa/`. The comparison changes the
picture for Sesotho slides 46–47 and adds Tshivenda and Xitsonga slide assets; `PLAN_VERSION` stays
unchanged.
