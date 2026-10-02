# Small Livestock: silent regional Study frames

The Sesotho, Tshivenda and Xitsonga decks are available in Study as silent static slides, with an explicit English narration option. Each has 20 frames and a slides-only offline pack. All target-language text is visibly marked as an unreviewed machine draft and paired with exact English source. No fluent-language or local-farming approval is claimed. Xitsonga uses standard written form and is provisional for Shangani; do not infer Shangani comprehension.

Since 2 October 2026 every heading and paragraph on all 20 frames is drafted: 90 passages per language, 0 English holds. Animal care, bee and hive safety, manure, registration, food-crop and goat-worm conditions are translated with their qualifications ("before", "do not", "may") rather than held in English. Difficult technical terms stay in English inside the translated sentences, for example chicken tractor, demarcation line, Cape honeybee, African honeybee, swarm, colony, grazing camp and parasite plan. Animal names were checked separately from the translation pass, because an earlier draft confused ducks with frogs; ducks carry an English gloss on every slide that names them.

Each passage had a blind English back-translation by a separate agent and an independent semantic check. The draft, its exact English source and its back-translation are listed in `docs/study-translation-reviews/seeds-livestock-regional-2026-10-02/small-livestock.{st,ve,ts}.back-translations.json`.

No regional narration is included. The source-paired records are in `docs/study-translation-reviews/small-livestock-regional/`. `render-review.py` reuses `scripts/make-lesson-slides.mjs` and writes the static review frames, contact sheets, phone-size samples and SHA-256 verification records here. Public copies live in `public/course-decks/small-livestock/{st,ve,ts}/`. Source frames and text come from the current English Small Livestock deck.

## Review files

- `st/contact-sheet.jpg`, `ve/contact-sheet.jpg` and `ts/contact-sheet.jpg` show the complete 20-frame decks.
- `slide-01-390.jpg`, `slide-02-390.jpg`, `slide-13-390.jpg`, `slide-15-390.jpg` and `slide-17-390.jpg` in each language folder show dense frames at phone width.
- Each language folder includes `verification.json` with source hashes, frame dimensions and hashes, draft and hold counts, and review status.
