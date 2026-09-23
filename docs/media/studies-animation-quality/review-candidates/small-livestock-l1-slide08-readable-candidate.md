# Small Livestock L1 slide 8 — static readability candidate

**Status:** Selected for a branch preview release; deployed learner check is
pending. This static still is not human-approved teaching media. No lesson,
narration, quiz, species, farming number, video or `PLAN_VERSION` changed.

## Content and layout

The four visible statements are copied verbatim from the existing slide and English narration. The candidate retains the existing title, cream background, green heading, gold accent and footer. Four large cards replace the small unboxed bullets; statement text is 55 px on the 1920 × 1080 canvas and wraps inside each card.

## Files

- `small-livestock-l1-slide08-readable-candidate.jpg` — 1920 × 1080 static JPEG.
- `small-livestock-l1-slide08-readable-fit-269.jpg` — 269 × 151 fit preview.
- `render-small-livestock-l1-slide08-readable.py` — deterministic Pillow renderer for both images.
- `public/course-decks/small-livestock/en/slide-08.jpg` — byte-identical public
  copy made by the renderer, 296,063 bytes, SHA-256
  `622dcb7bcea69b402b768fe2c474068d8ed80f75e44284fa6440c35f54937f8d`.

Source wording: `public/course-decks/small-livestock/en/slide-08.jpg` and `docs/narration/small-livestock.en.md` (Slide 8).

## Visual inspection and limits

Inspected the candidate at 1920 × 1080 and the fit preview at 269 × 151. All
four statements fit without clipping: statements one and three use one line;
statements two and four use two. At 269 px wide the body text is about 7.7 px
high and is too small for comfortable reading at displayed size. At a 390 px
fit, the 55 px body type scales to about 11.2 px; this is substantially larger
than the original slide's body type at that width, though still dependent on
device display and viewer scaling. The result improves hierarchy and fit but
needs assessment at the actual learner player size before acceptance. The
English narration, expandable lesson text and full-size still link carry the
detail when the image is too small to read.
