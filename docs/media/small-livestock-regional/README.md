# Small Livestock: silent regional Study frames

The Sesotho, Tshivenda and Xitsonga decks are available in Study as silent static slides, with an explicit English narration option. Each has 20 frames and a slides-only offline pack. All target-language text is visibly marked as an unreviewed machine draft and paired with exact English source. No fluent-language or local-farming approval is claimed. Xitsonga uses standard written form and is provisional for Shangani; do not infer Shangani comprehension.

The first release has 3 Sesotho, 4 Tshivenda and 8 Xitsonga draft passages. Examples:

| Language | Slide | Exact English source | Draft status |
| --- | ---: | --- | --- |
| Tshivenda | 17 | Ask what useful things it produces. | Unreviewed machine draft |
| Tshivenda | 9 | Watch one bee move from one blossom to another. | Unreviewed machine draft |
| Xitsonga | 2 | Small livestock can do work beyond producing meat, eggs, or honey. | Unreviewed machine draft |
| Xitsonga | 1 | Small livestock integration turns chickens, ducks, and bees into working parts of the farm. | Unreviewed machine draft |
| Xitsonga | 17 | Ask what useful things it produces. | Unreviewed machine draft |

Other passages, including animal care, bee and hive safety, disease, manure, pesticide exposure, registration, crop consumption, water and feed plans, and site-specific guidance, stay exact English. A frame with no draft preserves the source slide illustration, then shows a readable English hold labelled “translation pending.” On mixed frames, rust text is explicitly labelled as an English hold and the full exact English source appears below.

No regional narration is included. The source-paired records are in `docs/study-translation-reviews/small-livestock-regional/`. `render-review.py` reuses `scripts/make-lesson-slides.mjs` and writes the static review frames, contact sheets, phone-size samples and SHA-256 verification records here. Public copies live in `public/course-decks/small-livestock/{st,ve,ts}/`. Source frames and text come from the current English Small Livestock deck.

## Review files

- `st/contact-sheet.jpg`, `ve/contact-sheet.jpg` and `ts/contact-sheet.jpg` show the complete 20-frame decks.
- `ve/slide-17-390.jpg`, `ts/slide-02-390.jpg`, and `ts/slide-17-390.jpg` show target drafts at phone width.
- `ve/slide-13-390.jpg` and `ts/slide-15-390.jpg` show dense held source material at phone width.
- Each language folder includes `verification.json` with source hashes, frame dimensions and hashes, and review status.
