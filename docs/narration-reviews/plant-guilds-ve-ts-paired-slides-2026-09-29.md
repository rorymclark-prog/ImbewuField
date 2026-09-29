# Plant Guilds Tshivenda and Xitsonga translation review packet — 29 September 2026

**Status: source-paired review packet only; no learner deck or audio is registered.** The two JSON
files keep all 51 English headings and narration lines exactly paired with explicit English holds.
This records the audited scope and gives a fluent reviewer exact source fields to work from; it is
not a translation draft or a learner-facing release.

## Fields needing translation and review

For each language, the fields still needing fluent translation are:

- `slides[1..51].target.heading`
- `slides[1..51].target.body[0]`

The English source line for each field is beside it in the same record. Reviewers should preserve
the existing slide order and source wording. Local farming review is needed for all body fields,
because the lesson's apparent descriptions carry plant, soil, companion-function, or management
claims. The source topics by slide are:

- 1–6: plant selection, site needs and guild functions;
- 7–16: nodules, nutrient release, named species and growing conditions;
- 17–26: plant size, seasonal cover, spacing and support density;
- 27–36: pruning, mulch, cultivar behaviour, insects and flowering plants;
- 37–51: companion functions, resource competition, establishment, thinning and field actions.

No subset met the safe bar for an unreviewed learner translation. Slide 27's “Watch the branch fall
onto the cut leaves” describes motion in the clip, while its still image shows a person pruning and
does not show a falling branch. Translating that line against the static frame would imply evidence
the image does not contain. Keep it in English unless a future review packet pairs it with the clip
as an accessible separate source.

## Source and validation

The source is `docs/narration/plant-guilds.en.md`. The source-paired records are
`docs/narration/plant-guilds.ve.paired-draft.json` and
`docs/narration/plant-guilds.ts.paired-draft.json`; their headings and body arrays are checked
against all 51 English records by `scripts/paired-draft-slides.mjs` and
`tests/paired-draft-slides.test.ts`.

No ve/ts slide assets, animation variants, narration tracks, or course-deck registration were
added. The existing English and isiZulu media remain the only learner decks for this module.
