# Sesotho intro-permaculture slide pilot plan

Status: source-paired, visibly unreviewed learner pilot for the opening and lessons 1–3 (slides 1–22). The provisional Sesotho packet at `docs/narration/intro-permaculture.st.paired-draft.json` is unreviewed machine text. It is not an approved translation or narration script. Uncertain teaching remains visibly held in English inside the paired frames. No Sesotho narration is registered.

## Finding

`scripts/make-lesson-slides.mjs` can render the existing 22-slide English script, and it recognizes bilingual **headings** in the form `**[target heading] (Slide N — English heading)**`. It does not render two language bodies. Its body parser treats each paragraph as one string, chooses a few opening sentences, and puts those in a single text column. Passing the English script with `st` would render English content labeled as the Sesotho deck; passing the existing Sesotho learner draft would not provide exact slide-level English source pairs. Do not run either command as a Sesotho pilot.

The app already has a Sesotho intro-permaculture review packet and visibly paired learner draft in Study. That is useful translation context, but it is not a translated numbered narration script. The packet documents held English fields and open fluent/local-farming review. The course has 22 English and 22 isiZulu slides, plus English and isiZulu audio. The repository has 240 isiZulu slide JPGs and 240 isiZulu MP3s across 10 modules. All 22 source-paired Sesotho frames cover the opening and lessons 1–3; many lesson 3 lines remain exact English holds.

## Safe pilot shape

Use the existing numbered English source at `docs/narration/intro-permaculture.en.md` as the immutable source. The paired JSON packet contains exactly 22 numbered records. Each record retains the exact English heading and source paragraphs beside a provisional Sesotho heading and draft paragraphs. Missing or held target copy is explicitly marked as an English hold; no source fact, condition, number, or species is silently omitted. The packet carries an unreviewed machine-draft status. Its present 42 draft paragraphs and 46 English holds are review data, not a complete Sesotho teaching script.

The generator now has an opt-in `--paired-draft` path. It checks all 22 records against the English script before rendering and uses vertically stacked Sesotho and exact-English panels with an unreviewed banner. The English and isiZulu paths remain unchanged. The proof reproduces each existing illustrated English source slide above the paired text, so a reviewer can compare the visual teaching context. Slide 10 uses the existing Black African site-observation photograph named in `INTRO-PERMACULTURE-ST-PAIRED-ART.json` because the English slide shows a White man; its exact English narration stays below. All 22 proofs are compressed as WebP learner assets. Slide 15 uses an existing numbered footpath illustration instead of the concentric circles Rory rejected. Slide 17 uses an existing Black African site-walk photograph instead of a second concentric diagram. Both visual changes are examples, not fixed zone layouts. The Sesotho copy is incomplete, and there is no Sesotho narration.

## Manifest and player changes

- Do not add `st` to `COURSE_NARRATION.languages`, add `st` narration tracks, or add any audio files. There is no Sesotho voice for this pilot.
- The manifest registers all 22 slides as `st` WebP assets, with exact English holds on uncertain guidance. Keep the unreviewed banner and exact source on every draft image.
- The player has separate slide and voice selection. Sesotho images stay Sesotho when a learner chooses the clearly named English source track; no audio starts until that choice. Existing English and isiZulu switching remains available.
- No `PLAN_VERSION` change.

## Local and phone QA before any learner release

1. Compare all 22 generated slide records against `intro-permaculture.en.md`: exact English text, slide numbering, no missing/duplicate records, and all target drafts visibly marked unreviewed.
2. Inspect every rendered image at full size and on a narrow phone viewport. Check that both columns/panels remain legible, long Sesotho lines wrap without clipping, status labels are visible, and diagrams do not cover either text block.
3. In a 390px phone preview, open the deck in portrait and landscape widths, advance through all three lessons, enlarge text, and confirm the English source remains readable beside each draft. Verify the no-voice state and that no audio starts automatically. Ask an ACT facilitator to try the deployed draft on a device before classroom use.
4. With network disabled after opening/downloading the deck, revisit the draft slides and confirm the browser's existing offline cache serves them. Check transferred image sizes against the English deck and disclose the added download before the learner opens it.
5. A fluent Sesotho speaker from the intended QwaQwa / Maluti-a-Phofung audience and a local farming reviewer must review terminology, reading level, agricultural meaning, and every source pair before any draft is called approved. Rory has authorised publication of clearly marked machine drafts while that review is pending.

## Cost and scope

Rendering the 22 reviewer proofs uses local Pillow and existing app art, with no paid AI render or voice generation. The full illustrated local PNG proof set is not in the learner app. The compressed WebP learner frames are tracked at exact byte sizes in the offline manifest. Their portraits include the illustration, followed by the Sesotho draft/hold and exact English source. Check actual network transfer and offline behavior before release.
