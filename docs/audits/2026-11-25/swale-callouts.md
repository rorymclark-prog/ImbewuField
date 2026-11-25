# Earthworks swale callouts and map review — 25 November 2026

Codex compared the app at production build `12ff32d` with the changes on
`codex/earthworks-swale-label-location`, based on `12ff32d96`.
The [twelve-map review](all-design-maps.md) records each archived sheet and its
revision limits. This pass also follows the [Earthworks and Water review](water-and-oblique.md)
and the [oblique access review](oblique-paving-detail.md).

## Findings and disposition

| Finding | Observed result |
| --- | --- |
| AI-MAP-089 · Earthworks swale callout | On a two-point swale the previous callout targeted the last point. Reversing the same trace moved the callout to the opposite end. The revised painter measures halfway along the saved polyline in sheet pixels. It accounts for unequal axes and repeated vertices. Chrome drew both directions and the two labels landed in the same position. |
| AI-MAP-081/082 · Earthworks relief | Reinspected the archived Ubhejane illustration. The nine western beds are distinguishable. The middle swale has two raised-looking sides and the banana circle has a thin rim. The current guide depicts the fuller downhill bank and wider ring. A fresh model output would be needed to verify how well those features carry through. |
| AI-MAP-085/086 · Whole Design oblique | Rory accepted the newer Photo Plan view with a stray interior fence and no visible play equipment. It replaces the older oblique in the local comparison against the saved Whole Design. No new illustration was commissioned and no equipment or fence was added to the design. |

## Verification

The live public example produced nine exact sheet images and a separate Terrain &
Sections image. At 390 × 844, 820 × 1180 and 1440 × 960 all ten fitted the full-screen
viewer and their detail panes allowed horizontal panning after zoom. Chrome used
simulated viewport sizes. The separate Record Plan also fitted horizontally at all three
sizes and downloaded as SVG. The sample inventory differs from the private Ubhejane
record used for the saved artwork comparisons.

Chrome also rendered the before/after callout painters over the same archived
Earthworks artwork using both saved swale traces. A separate direction test
draws one trace both ways to make the old endpoint jump visible. The geometric
regression also uses an unequal-axis sheet, a bend and repeated vertices.
The previous count-and-exclusion test had pinned the endpoints. Its replacement
still verifies inclusion, IDs, both swale positions, bed count and preservation
of input geometry, and now checks the midpoint.

Local typecheck, 691 focused map checks, whitespace and release-note checks passed.
Hosted checks and release verification are tracked in the PR and issue 35.
This changes the picture when drawing labelled Earthworks maps. Existing exports retain
their original pixels. Open model-fidelity checks AI-MAP-026/042/069 remain subject to
a new authorised generation. Screenshots and saved site artwork are in the owner's
private map review.
