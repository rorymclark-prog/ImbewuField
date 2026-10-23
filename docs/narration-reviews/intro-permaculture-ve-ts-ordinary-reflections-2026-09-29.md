# Introduction ordinary reflection drafts — 29 September 2026

**Status: unreviewed machine drafts.** These six lines are staged for fluent-language review. They are not approved translations, learner guidance, or local farming advice. The source English remains paired with each target sentence. No narration was created or registered.

The source is `docs/narration/intro-permaculture.en.md`; target records are in `docs/narration/intro-permaculture.ve.paired-draft.json` and `docs/narration/intro-permaculture.ts.paired-draft.json`.

| Slide | Exact English source | Tshivenda draft | Xitsonga draft |
|---|---|---|---|
| 2 | Think of one job on your farm that takes longer than it should. Where does the time actually go? | Humbulani nga mushumo muthihi bulasini yaṋu une wa dzhia tshifhinga tshilapfu u fhira tshine tsha ṱoḓea. Tshifhinga tshi khou ya ngafhi zwa vhukuma? | Ehleketa hi ntirho wun'we epurasini ra wena lowu tekaka nkarhi wo tala ku nga ri na xilaveko. Nkarhi wolowo wu ya kwihi hakunene? |
| 4 | Look at one patch of bare soil on your land. Is anything protecting it right now? | Sedzani tshipiḓa tshithihi tsha mavu a songo tibedzwaho tsimuni yaṋu. Hu na tshithu tshine tsha khou tsireledza mavu eneo zwino? | Languta xiphemu xin'we xa misava leyi nga funengetiwangiki epurasini ra wena. Xana ku na lexi xi yi sirhelelaka sweswi? |
| 17 | This is the point of the whole exercise. | Ndivho ya nyito yoṱhe ndi iyi. | Hi xona xikongomelo xa ntirho lowu hinkwawo. |

Slide 11's “arrives free / leaves free” sentence and slide 12's “edge” question remain explicit English holds in both packets because their intended meaning was not clear enough to draft without a fluent check. All other source holds and the technical or actionable text remain unchanged.

## Render and visual check

The existing paired renderer validated both complete 22-slide source records and rendered to temporary directories. Only slides 2, 4 and 17 were converted to WebP and replaced in each language deck; the other 38 frames remain untouched. Slide 17 uses the existing site-walk photograph mapped in `docs/study-translation-reviews/INTRO-PERMACULTURE-ST-PAIRED-ART.json`, replacing the concentric-zone illustration. Its exact English narration remains in the source panel below the photo. I inspected the six 390 × 1463 samples (`ve-slide-02-390.jpg`, `ve-slide-04-390.jpg`, `ve-slide-17-390.jpg`, and the corresponding `ts` files) and their contact sheet at `docs/media/intro-permaculture/paired-review/ve-ts-ordinary-reflections-contact-390.jpg`. The AI DRAFT / NOT REVIEWED labels, unchanged English source, target panel, English-hold styling and page numbers were visible; I saw no clipping at the checked phone width.

Rebuild the rendered candidates with:

```sh
node scripts/make-lesson-slides.mjs intro-permaculture ve /tmp/intro-permaculture-ve-paired-review \
  --paired-draft docs/narration/intro-permaculture.ve.paired-draft.json \
  --paired-art docs/study-translation-reviews/INTRO-PERMACULTURE-ST-PAIRED-ART.json
node scripts/make-lesson-slides.mjs intro-permaculture ts /tmp/intro-permaculture-ts-paired-review \
  --paired-draft docs/narration/intro-permaculture.ts.paired-draft.json \
  --paired-art docs/study-translation-reviews/INTRO-PERMACULTURE-ST-PAIRED-ART.json
```

The shared override file also names art for slides 10 and 15; those generated temporary frames were not copied into either target deck.

The image render verifies layout only. A fluent Tshivenda and Xitsonga speaker still needs to check the word choice, register, and meaning before these drafts can be relied on by learners.
