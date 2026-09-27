# Sesotho intro-permaculture slide pilot plan

Status: planning only. No Sesotho slide copy has been authored or approved, no narration is included, and no slide assets have been generated.

## Finding

`scripts/make-lesson-slides.mjs` can render the existing 22-slide English script, and it recognizes bilingual **headings** in the form `**[target heading] (Slide N — English heading)**`. It does not render two language bodies. Its body parser treats each paragraph as one string, chooses a few opening sentences, and puts those in a single text column. Passing the English script with `st` would render English content labeled as the Sesotho deck; passing the existing Sesotho learner draft would not provide exact slide-level English source pairs. Do not run either command as a Sesotho pilot.

The app already has a Sesotho intro-permaculture review packet and visibly paired learner draft in Study. That is useful translation context, but it is not a translated numbered narration script. The packet documents held English fields and open fluent/local-farming review. The course currently has 22 English and 22 isiZulu slides, plus English and isiZulu audio. The repository has 240 isiZulu slide JPGs and 240 isiZulu MP3s across 10 modules.

## Safe pilot shape

Use the existing numbered English source at `docs/narration/intro-permaculture.en.md` as the immutable source. After a Sesotho draft is supplied for review, create `docs/narration/intro-permaculture.st.md` with exactly 22 numbered records. Each record must retain the exact English slide heading and source paragraphs beside a clearly labeled provisional Sesotho heading and draft paragraphs. Missing or held target copy stays visibly marked as an English hold; do not paraphrase or silently omit a source fact, condition, number, or species. This file must carry a prominent machine-draft / not reviewed warning.

The current generator cannot create that layout without a change. Extend `scripts/make-lesson-slides.mjs` to parse the paired records and render an English source column next to a Sesotho draft column, with persistent `SESOTHO DRAFT — NOT REVIEWED` status on every image. Keep current English and isiZulu parsing unchanged. A paired-record count and exact-source comparison should fail closed if any source heading/body differs from the English script or any slide is missing/duplicated. Keep the English source readable at phone width; if two columns fail that check, use vertically stacked source/draft panels or stop the pilot rather than shrinking type until it is unreadable.

## Manifest and player changes

- Do not add `st` to `COURSE_NARRATION.languages`, add `st` narration tracks, or add any audio files. There is no Sesotho voice for this pilot.
- Once all 22 source-paired draft slide files exist and pass visual QA, add `st` to only the `intro-permaculture` `slideLanguages` list in `lib/course-deck.ts`. Keep the unreviewed status visible in the player and on every slide; do not call the deck reviewed.
- Update `components/course/DeckPlayer.tsx` so a Sesotho slide deck has an explicit no-Sesotho-narration state and cannot silently play English narration as if it were Sesotho. English audio may be offered only as a clearly named, user-selected source track. Keep the slide's paired English source visible when a target paragraph is held.
- The renderer change, player state, and deck manifest entry should land together with all 22 generated slide images. No `PLAN_VERSION` change.

## Local and phone QA before any learner release

1. Compare all 22 generated slide records against `intro-permaculture.en.md`: exact English text, slide numbering, no missing/duplicate records, and all target drafts visibly marked unreviewed.
2. Inspect every rendered image at full size and on a narrow phone viewport. Check that both columns/panels remain legible, long Sesotho lines wrap without clipping, status labels are visible, and diagrams do not cover either text block.
3. In a 390px phone preview, open the deck in portrait and landscape widths, advance through all slides, enlarge text, and confirm the English source remains readable beside each draft. Verify the no-voice state and that no audio starts automatically. Ask an ACT facilitator to try the deployed draft on a device before classroom use.
4. With network disabled after opening/downloading the deck, revisit every slide and confirm the browser's existing offline cache serves all 22 images. Check transferred image sizes against the English deck and disclose the added download before the learner opens it.
5. A fluent Sesotho speaker from the intended QwaQwa / Maluti-a-Phofung audience and a local farming reviewer must review terminology, reading level, agricultural meaning, and every source pair before any draft is called approved. Rory has authorised publication of clearly marked machine drafts while that review is pending.

## Cost and scope

After the paired draft text is prepared, rendering 22 static slides with the existing local Pillow workflow is modest: it uses local CPU and writes 22 images, with no paid AI render and no voice generation. The bilingual images will be larger than English-only stills, so measure their actual total before release and let learners choose before downloading. This pilot plan itself has generated no media and made no paid call.
