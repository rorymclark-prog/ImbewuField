# Paid Earthworks callout contrast — 25 November 2026

Codex continued the [saved Water comparison](paid-water-labels.md) and [swale midpoint correction](swale-callouts.md) from `25086e69b` on `codex/earthworks-ai-callouts-20261125`.

| ID | Finding | Disposition |
| --- | --- | --- |
| AI-MAP-091 | In the signed-in site's existing paid Earthworks export the swale names sat in tiny type near the far right edge. The bed count and banana circle name were similarly small on the opposite edge. The matching exact drawing put contrasting plaques near the features. A second polish could also lose those names. | Both app-composed paid stages now draw the measured Earthworks callouts and plant marks after painting. They reuse the exact sheet's label placement. The clean map for a later polish excludes that type. |
| AI-MAP-089 | A saved swale should keep its halfway anchor when the trace direction is reversed. | Retained. The paid pass now paints both named anchors through the same plaque painter as the exact plan. |
| AI-MAP-081/082 | The recent provider output has a distinct banana ring, and both long soil banks remain visible. | The material is the original paid painting. This change addresses label placement and contrast only. |

## Verification

Matched the frozen Earthworks job to the owner's downloaded model output by SHA-256 and replayed the actual first-stage finisher in Chrome. Compared the resulting full sheet with the original paid and exact exports. Both swale names sit beside the correct banks; the nine-bed group and banana circle retain their names. A regression checks the two swale positions on oppositely traced banks in the shared post-artwork pass. This changes the picture while preserving the geometry and `PLAN_VERSION`. Private site images remain in the owner's local Earthworks folder.

Local typecheck and 693 focused map checks passed. Release gates, preview and live verification belong to the PR and issue 35. The twelve-view review distinguishes the Terrain study and exact Record Plan from provider jobs. Next, check the deployed finishing path and review the remaining representative sheets and location-driven overlays.
