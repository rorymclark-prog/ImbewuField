# Tshivenda Soil Health source-paired slide deck — 28 September 2026

**Status: unreviewed machine draft.** The 20 static frames reuse the existing English Soil Health slide artwork. Each frame shows the full illustrated English source slide, a Tshivenda draft/English-hold panel, and the exact English source text. This is a comparison deck for fluent-language and local farming review, not an approved learner translation. The deck has no Tshivenda audio. In the player, learners can choose **No narration** or explicitly select **English source narration**.

Slides 1–5 contain selected Tshivenda opening text: one short sentence on slide 1; the heading and first sentence on slide 2; the heading on slide 3; the heading on slide 4; and the opening observation sentence on slide 5. Slides 6–20 remain in exact English. Technical soil terms and all soil-science, compost, jar-test, diagnostic, safety and practical farming guidance remain exact English throughout.

The five drafts preserve broad orientation claims only. They do not translate the soil diagnosis, jar procedure, compost handling or field instructions. A fluent Tshivenda speaker should check grammar, register and comprehension; a local farming practitioner should review the teaching claims before learner use. English holds mean this is not a complete Tshivenda lesson.

## Render and visual check

The paired-draft renderer validated all 20 source records and produced 20 1440 × 5400 frames. The contact sheet is `docs/media/soil-health/qa/ve-source-paired-contact-sheet.jpg`; full-size WebP frames are under `public/course-decks/soil-health/ve/`. Slides 1, 2 and 5 also have 390 px samples under `docs/media/soil-health/qa/`. Draft status, exact English source, holds and page numbering are visible; no text clipping was seen. No new illustration or animation was created.

Rebuild the frames with:

```sh
node scripts/make-lesson-slides.mjs soil-health ve /tmp/soil-health-ve-paired \
  --paired-draft docs/narration/soil-health.ve.paired-draft.json
```

Convert the generated PNG files to WebP for the stored deck. The source-paired JSON is checked against `docs/narration/soil-health.en.md` by the renderer. No audio files or `lib/course-audio.ts` manifest entry were added.

The frames are registered as the Tshivenda Soil Health slides in `lib/course-deck.ts`. When a regional deck has no matching voice, `DeckPlayer` opens in No narration mode. Learners can opt into English source narration; English audio is never selected automatically. Choosing No narration during playback pauses and rewinds audio, stops play-through and timed advancement, and leaves manual paging available. Offline packs carry every selected Tshivenda frame and keep English source audio available as an optional choice. There is no Tshivenda audio asset or promise.

The existing Study offline download is a whole-course pack and still bundles English narration. It is not a slide-only or audio-free download. `offlinePack('soil-health', 've')` currently contains 21,768,163 bytes (20.76 MiB): all 20 Tshivenda frames plus 20 English MP3s and existing media. A slides-only download is not provided by this change.
