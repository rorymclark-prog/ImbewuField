# Drawing controls: batch 18 evidence

Source baseline: `59a115b163260d48127a8008503027b55e260108` (#1044).
All translation wording remains an unreviewed AI draft.

The fixtures extract the actual palette, drawing-action and sector-card JSX using
`tests/control-icon-renderers.ts`. They use the real dictionary, sector model and app fonts,
with isolated state and mocked preview summaries. Their focus handler is extracted from the
actual tool strip and attached to that fixture; callback identity and availability gates are
checked separately through the actual source functions. No saved data or paid generation is used.

`browser-qa.json` records 106 rendered states in four languages at 390 × 844 and 1440 × 1000:
palette/hint, line/zone, confirmable and unavailable Tidy/Snap/Cleanup, full/mixed/missing sector
context, and six corrected Tshivenda matching-verb paragraphs. Zero document overflow,
clipped native/source text or clipped buttons remained. The existing palette is a horizontal
scroll strip: the phone does not show every icon simultaneously. Its last action is reachable
in all four languages. `keyboard-qa.json` records 32 focused actions, fully visible with 20 px icons.

`contact-*.png` shows all four phone languages. `first-contact-line.png` and
`first-contact-snap.png` retain the observed narrow-column layout before the paint-only fix.
Final action groups use bounded max-content width and confirmation icons cannot shrink.
`ve-desktop-snap.png` and `st-desktop-sector.png` show representative desktop results.
`ve-matching-verb.png` records the six source-bound wording corrections. These images and
phone contacts were visually inspected; the broader state set was also measured.

The sector card still contains model-owned English provenance/season notes. Layers and other
Design Studio controls outside the declared 50 keys remain outside this batch. The unused Main
key is cleaned but has no active Home caller. This evidence does not prove a full editor workflow,
complete app translation, linguistic fluency, or translation of recordings and images.

Final focused validation: typecheck clean; 203 tests passed across 32 registered files,
including the unchanged icon audit and historical preservation checks; release-note and
whitespace checks clean.

The previous complete run at `1340afff` finished with 5,418 passed, one failed and one pre-existing
TODO. Its one failure was the unchanged icon audit, reproduced before and passing after this fix.
That old run is not proof for the current stack. A fresh registered full run and CI are still
required before merge. `PLAN_VERSION` is unchanged; this changes the picture.

The ongoing complete run later found a second obsolete source-shape guard in
`design-simple-mode.test.ts`: it pinned the removed `toolGlyph` helper name. The three
helper-name regexes are replaced by execution of the real caller JSX in English and all four
targets. Tidy/Snap/Cleanup must be absent in Simple and present in All tools; intentionally
feeding the All-tools row to the Simple audit must throw. Existing Layers and multi-select
guards stay intact. No product code or pixels change in this follow-up.

The same ongoing full run also caught the translator-handoff CSV retaining 19 old English
pictographs. The unchanged `scripts/pending-translations.mjs` regenerates all 1,050 pending
source rows; the diff changes only those glyphs. Translation cells stay blank for human review.
The unchanged CSV verification and actual palette/Simple checks pass. No product code or pixels
change in this follow-up.
