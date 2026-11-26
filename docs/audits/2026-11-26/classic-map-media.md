# Classic illustration finishes

This follows the [four-finish paid comparison](ai-map-art-finishes.md). AI-MAP-093 remains open for new paid comparisons of the earlier finishes. AI-MAP-094 concerned the progress label. This change adds three other media.

## Design references

- The [National Gallery of Art’s Latrobe plan](https://heald.nga.gov/mediawiki/index.php/File:0058.jpg) combines ink, watercolour, wash and graphite. The Watercolour finish uses transparent washes and paper highlights over a light framework.
- The [Royal Collection garden-house plan](https://www.rct.uk/collection/930105/a-ground-plan-of-the-kings-garden-house-showing-designs-for-alterations) uses pen and ink over pencil with wash. The Pen & Ink finish uses a clear outline, open crowns and sparse hatching suitable for monochrome print.
- The [Royal Horticultural Society’s garden planning guide](https://www.rhs.org.uk/garden-inspiration/design/creating-your-garden-plan) describes drawing fixed features to scale on paper. Graphite Pencil uses pressure and tonal variation. Measured positions and labels come from the app.

## Findings and verification

| ID | Finding | Result |
| --- | --- | --- |
| AI-MAP-095 | A monochrome prompt alone would leave coloured routes, aerial context and key symbols on the exported sheet. | The final compositor converts Pencil and Pen & Ink pages to neutral greys after placing the map and key. Watercolour retains its palette. |
| AI-MAP-096 | More style packs previously looked actionable but required horizontal scrolling. | Chrome at a 390 px viewport advanced the actual style carousel and selected each new card in a local component fixture. |

- A local Chrome fixture exercised the production sheet compositor with the same public example aerial for each finish. Both monochrome 1494 × 1056 PNGs contained zero non-neutral pixels. The colour control contained 663,642. Visually inspected the assembled print key, scale bar and picker. This verifies composition independently of provider behaviour.
- TypeScript and all 778 focused rendering checks passed. Coverage includes both polish stages, style selection on all nine sheets, oblique style recovery and monochrome conversion across strip boundaries.
- A separate reference-guided AI comparison used the owner's saved design detail. It is a visual study. The production browser requested sign-in, so no new paid account render was submitted for these three finishes. A fresh paid side-by-side is still the direct check of provider fidelity to the chosen mark-making.
- This changes the picture for newly selected styles. The shared plan version and existing saved geometry stay intact. The PR and issue #35 record hosted checks.
