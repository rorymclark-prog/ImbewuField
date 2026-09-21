# Scale and space — source-grounded model exercise

This development preview adds `/student/design/scale` alongside D1.3, D4.1 and D4.3. The learner compares two bed outlines with a gap, touching edges and an overlap, then checks the area and the limits of the evidence. It is an explicitly simulated model exercise; it does not turn the busy-yard sketch into a measured site or replace the complete household design case.

## Source and geometry

The server reads `buildDemoFacilitatorState()` in `lib/demo-farm.ts` and selects its existing `demo-bed-1` and `demo-bed-2` records. The sample source explicitly identifies its layout as illustrative data, not the actual crèche layout. Only identifiers, bed labels, local metre coordinates, width and length are passed to the client. Actual latitude/longitude, crop identities, personal details and financial records are not part of this exercise.

The supplied records are aligned rectangles, each 1.5 × 4 metres, at top-left model coordinates (4,12) and (6.5,12). The gap is derived edge-to-edge, not between centres. The touching example moves the second outline until its left edge equals the first outline’s right edge. The overlap example moves it until half of the first width is shared. These are explanatory model operations, not planting/access prescriptions. No saved farm/sample geometry is changed.

The diagram keeps its display frame fixed between arrangements. Explicit view enlargement changes only the screen display. Bed area, gap area, shared area and outer extent are derived from the same model used for the drawing and answer checks. The coloured outer rectangle represents the combined extent, not a property boundary. Text descriptions, labels and dashed overlap styling supplement colour.

## Practice and export

Three numerical questions compare one bed’s area, the gap/overlap width and the ground inside bed outlines counted once. Answers accept decimal commas/points, reject partial values and blanks, and reset when the arrangement changes. View enlargement preserves them. Feedback shows the arithmetic and asks what further evidence would be needed for access, cultivation or production. It neither submits nor certifies an assessment.

The SVG download serialises the displayed vector drawing, preserving its model dimensions and descriptive limitations. It promises no fixed physical print scale: resizing/print settings must be checked before ruler measurements can represent ground distances. This is a diagram download, not an offline lesson pack or an animation.

## Verification

Typecheck, full suite (3,669 tests: 3,668 pass, zero fail, one existing TODO), whitespace/release-note checks and production build pass. All three diagram arrangements were visually inspected on desktop; fitted and overlap views were inspected at 390px. The fitted SVG now displays its complete footer. Phone document width stayed 390px in both fitted and enlarged views; enlargement scrolls within the diagram. Bed SVG widths/heights and the first bed’s position stayed fixed across arrangements. Supplied-gap and overlap mistakes produced 2/3, corrected responses 3/3; touching accepted a genuine zero gap. Decimal commas work, changing arrangements clears answers and view enlargement retains them. All three downloaded SVGs were opened, parsed, rasterised and visually inspected. The final downloads preserve their dimensions and model-only descriptions. The D4.1 lesson → exercise link was tested. Temporary viewport override reset. Hosted CI/deployment verification pending; no real-site dimensions, agronomic suitability, learner competence or paper print scale is certified.

Reviewed source SHA-256 (`lib/demo-farm.ts`): `7bd8aa5a143d5d78979f7000edfb450189ee061aa70bb98430164adb261a69e1`. Runtime reads the current source instead of duplicating these values as independent lesson constants.
