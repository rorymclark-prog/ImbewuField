# Site-export draft verification — 22 October 2026

This is a partial step toward whole-app translation. The working crop-plan appendix still has
English furniture, as its existing controls say. Saved report prose, bed names, varieties and
photo notes remain in their recorded language. The new labels are unreviewed AI drafts.

The browser probe calls the actual PDF builders, font registration and SVG-to-canvas helpers.
Its temporary local route was removed before committing. It uses the checked demo-plan fixture,
synthetic saved records and an existing catalogue image as a test image. These are not new
farming instructions or photographs claimed as field evidence. No paid generation was used.

For each of `zu`, `st`, `ts`, `ve`:

- `colour`: visual front pages, charts, a chapter illustration, table, sowing calendar, saved
  design plate and two annotated images.
- `ink`: saved prose, table and sowing calendar without the colour front pages.
- `legacy`: an older report without its own cover or dated crop snapshot.
- `working`: the optional full working-plan appendix, including its recorded native bed name,
  variety and warning. Its labels remain English in this increment.
- `overflow`: a saved photo note spanning multiple pages, with its final native marker retained.

All 20 native PDFs were rendered with Poppler and their contact sheets inspected. The four sowing
tables were also inspected at a larger size (`calendar-details.png`). Extracted text contains the
complete canonical caution and the draft-status notice on every one of the 188 native pages.
The page-boundary check covers 60,881 words in 248 pages, including English regression documents;
it found no clipped words. This check can detect clipping, not translation quality or every
possible collision; the rendered inspection is separate evidence.

`english-regression.json` compares original-source and changed builders on ink, colour and
working-plan cases. All 30 corresponding pages have identical rendered pixels and extracted
text. Original sources were captured before edits at `f75f928f`; file hashes and the source
phrases are retained in `tests/fixtures/site-export-translation/source.json`.

The release row was measured on phone and desktop in each language: 8 states, 34 reading lines,
no hidden lines, horizontal overflow, unresolved placeholders or failing text contrast. All four
phone row captures were inspected.

Typecheck and the 180-test report/export set pass. A separate overlapping release set has 33
passing tests. These are focused results, not a full-suite pass. Full-suite and CI results are
reported separately on the PR. `PLAN_VERSION` was left untouched. This changes the picture.
