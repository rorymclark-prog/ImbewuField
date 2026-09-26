# Food Forest isiZulu still deck

Status: machine-drafted isiZulu stills and narration for a labelled learner preview, as Rory authorised publication before later review. No fluent-language, farmer, practitioner or human listening approval is claimed.

## Rebuild and source

Run `python3 docs/media/food-forest/render-zu-stills.py` from the repository root, then `node scripts/gen-asset-sizes.mjs`. The renderer requires Pillow. It reads the checked-in render source, verifies its SHA-256, creates the localized layer/climate diagrams, calls `scripts/make-lesson-slides.mjs`, writes 20 JPEG slides at 1920 × 1080, and creates the contact sheet and phone samples.

The isiZulu source is `food-forest-zu-render-source.md`, SHA-256 `6390548164490a05f96553201ce048eddbb84fb349746371268bb36271ab697e`. The checked-in isiZulu narration has the same SHA-256; all 20 slide clips and the full track use `zu-ZA-ThandoNeural` at −12%, with file and text-boundary proofs in `docs/narration-reviews/food-forest-zu-audio-assets.md`. The current English narration is SHA-256 `ed16fe05d1608259c293e4957f939095515fbfb9f1ed6a97a9ebc27b490fcfc5`. Slides 3–18 follow the three current isiZulu full-draft packets; slides 1–2 and 19–20 use the current English-aligned opening and field actions supplied in the canonical source. Packet, image-source and review details are recorded in `qa/report.json`.

## Review holds

- Slide 10 keeps the isiZulu qualification that climate helps determine what may suit a site. The current English narration says “Climate decides which species belong,” while the isiZulu review flags that sentence as too categorical. English source-owner alignment remains open (`docs/narration-reviews/food-forest-l2.zu.review.md`, slide 10).
- L2 slide 9 says mango can suffer frost damage; its quiz describes a stronger likely-killed-or-badly-damaged outcome. This variance is preserved for review, not resolved in the deck (`docs/narration-reviews/food-forest-l2.zu.full-draft.md`, reviewer holds).
- The named plants remain examples from the paired English source. They are not planting recommendations or legal approval. Confirm identity, variety, local suitability, mature size, legal restrictions, project lists and safe use locally; protect existing native vegetation and healthy grassland.
- Layer names describe planning roles, not fixed heights or area prescriptions. Establishment, spacing, pruning, moisture, mulch suppression and harvest stay conditional. No species or quantities were added.
- Slides 5 and 10 are localized still diagrams. Slides 10 and 15 retain “Watch” in their source headings, but the delivered media are still images. No Flow credit or new animation was used. IsiZulu audio and narration were added; lesson bodies, quizzes and rationales were unchanged.

## Visual QA

Contact sheet and six 390-pixel-wide samples were inspected on 24 September 2026. The deck uses existing South African smallholder-context art featuring Black African farmers where people appear. See `qa/contact-sheet.jpg` and `qa/slide-*-390.jpg`.
