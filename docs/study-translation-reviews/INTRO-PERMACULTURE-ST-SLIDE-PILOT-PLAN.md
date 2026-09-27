# Sesotho intro-permaculture slide pilot plan

Status: source-paired review pilot. The provisional Sesotho packet at `docs/narration/intro-permaculture.st.paired-draft.json` is unreviewed machine text. It is not an approved learner deck or narration script. The optional renderer has generated local review images, but no Sesotho slide assets or narration have been registered in the app.

## Finding

`scripts/make-lesson-slides.mjs` can render the existing 22-slide English script, and it recognizes bilingual **headings** in the form `**[target heading] (Slide N — English heading)**`. It does not render two language bodies. Its body parser treats each paragraph as one string, chooses a few opening sentences, and puts those in a single text column. Passing the English script with `st` would render English content labeled as the Sesotho deck; passing the existing Sesotho learner draft would not provide exact slide-level English source pairs. Do not run either command as a Sesotho pilot.

The app already has a Sesotho intro-permaculture review packet and visibly paired learner draft in Study. That is useful translation context, but it is not a translated numbered narration script. The packet documents held English fields and open fluent/local-farming review. The course currently has 22 English and 22 isiZulu slides, plus English and isiZulu audio. The repository has 240 isiZulu slide JPGs and 240 isiZulu MP3s across 10 modules.

## Safe pilot shape

Use the existing numbered English source at `docs/narration/intro-permaculture.en.md` as the immutable source. The paired JSON packet contains exactly 22 numbered records. Each record retains the exact English heading and source paragraphs beside a provisional Sesotho heading and draft paragraphs. Missing or held target copy is explicitly marked as an English hold; no source fact, condition, number, or species is silently omitted. The packet carries an unreviewed machine-draft status. Its present 42 draft paragraphs and 46 English holds are review data, not a complete Sesotho teaching script.

The generator now has an opt-in `--paired-draft` path. It checks all 22 records against the English script before rendering and uses vertically stacked Sesotho and exact-English panels with an unreviewed banner. The English and isiZulu paths remain unchanged. The reviewer proof also reproduces each existing illustrated English source slide above the paired text, so a reviewer can compare the visual teaching context. These are still reviewer proofs, not a learner deck: the Sesotho copy is incomplete, portrait proofs have not been checked in the actual phone player, and there is no Sesotho narration.

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

Rendering the 22 reviewer proofs uses local Pillow and the existing English slide JPGs, with no paid AI render or voice generation. The illustrated local PNG proof set is about 24 MB and is not in the learner app. Its portraits include the original English visual, followed by the Sesotho draft/hold and exact English source. Measure and optimize any later learner deck's actual transfer size before release, and let learners choose before downloading it.
