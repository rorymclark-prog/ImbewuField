# All-map illustration and context review — 2026-11-06

- Auditor: Codex, following Rory's request to apply the Zones/context review across the illustrated map set.
- Reviewed revision: `e63b77152a7f211d02cfca96c506dc7cf7076b2a`, documentation branch `codex/all-map-illustration-guides`; production base `06315a74ae03d6cb771c659776e09ce47f1d4a2b`.
- Deployment inspected: none this turn. Account connector profile, connection and site list all require connection; no current saved revision is claimed.
- Previous audits: [Zones authority/key](../2026-11-05/zones-authority-key-codex.md), [nine-layer fidelity](../2026-11-03/ai-layer-fidelity-corrections-codex.md), [Water budget/routes](../2026-11-04/water-budget-route-review-codex.md), [Terrain & Sections](../2026-11-03/terrain-section-contour-detail-codex.md), [Structures mesh recovery](../2026-11-03/structures-shade-recovery-codex.md).
- Scope: research and visual review of existing local examples for all nine sheets and the separate Terrain & Sections export; draft reusable illustration briefs and a private review gallery. No runtime implementation or generation requested through the app.
- Evidence: actual local PNG inspection, source review of `lib/render-policy.ts`, primary-source cartographic and landscape-design guidance. This is not fresh provider or physical-device verification.

## What was already done

Retain the named Existing Site default and the approved Sector appearance reference. The standalone Sector reference is an appearance guide, not measured geometry. The newer standalone Zones trials remain unapproved: the second still changes Zone 0 and introduces a roof-like detail. The broad overview/contact sheet does not establish ten acceptable or current outputs.

`recommendedSheetSettings` currently chooses available aerial imagery for AI sheets, and plain for exact Zones. It does not implement the finer illustration/background/context recommendations below. A white page is independent of whether reference photography reaches the model. Earlier plain Earthworks/Phasing attempts invented roof detail, so an aesthetic recommendation must not silently become a source-removal change.

## Proposed treatments

These are design judgments informed by the sources below, not surveyed industry prevalence or newly deployed defaults.

| Map | Illustration/background | Surroundings and overview | Label treatment |
| --- | --- | --- | --- |
| Existing Site | Source-faithful existing conditions; preserve the approved named default | Relevant off-site context plus optional wider view; historical/current imagery clearly separated | Names on recorded areas; optional codes/key |
| Sector | Rich existing-site illustration following the approved reference, analytical graphics above | Broad context with restrained darkening, full proposed extent | Direct sun/wind/weather labels; sourced contour overview; detailed profiles stay on Terrain |
| Zones | Quiet existing-site illustration under translucent exact regions | Muted adjacent habitat plus surroundings overview | Large zone numbers; short general care meanings; proposed extent distinguished from legal property |
| Water | Light, low-contrast illustrated ground and vegetation | Narrow context; broader inlet/outlet/catchment view only with evidence | Exact system routes/symbols, supported flow direction, shared app budget |
| Earthworks | Near-white/light earth working plan, modest excavation symbols | Minimal context; optional location view | Saved bed footprints, pit centres, swales and concise key; no invented rims or dimensions |
| Planting | Detailed botanical illustration on light ground | Small muted buffer; retain canopy overhang | Compact codes, recognizable matching key; detailed bed view when needed |
| Structures | Material-rich buildings/mesh/paving over quiet context | Relevant road, gate and service access | Short name leaders; small-object detail views |
| Whole | Cohesive full-design illustration with natural ground | Softened surroundings and optional wider overview | Major area labels and grouped key; avoid all analysis marks at once |
| Phasing | Reuse one approved Whole artwork from the same saved revision | Modest context; wider staging/access only when relevant | App-owned stage numbers/schedule; no different invented garden per phase |
| Terrain & Sections | Quiet relief/source base, exact contours and profile charts | Enough terrain context to locate sections | Primary/supplemental contour hierarchy; source-derived slope, percentage, levels and scale |

Across the set: white page and legend, fine frame, consistent type, preserved explicit user choices. The exact saved boundary, labels, scale and calculations remain app-owned. Trees and physical objects may cross the design outline without changing their saved centres or known dimensions. Darkening should not obscure adjacent habitat that the map is intended to explain.

Phone proposal: separate Site/Surroundings and map/key views. Tablet/laptop proposal: larger main map and useful overview. Print proposal: inset or separate context sheet with its own scale. These layouts have not been implemented or verified on devices.

## Findings and disposition

| ID | Problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-066/067 | Boundary authority and zone meaning | Open; retained | Wider context must not extend the saved design polygon or imply ownership. Adjacent natural habitat can be labelled as such; assign Zone 5 only with confirmation, without forcing every site to contain it. Existing source/data limits still apply. |
| AI-MAP-068 | One background treatment does not serve all illustrated subjects | Recommendation drafted, not implemented | Water's older image has a dark competing ground; Earthworks exaggerates pits/rims and bed edges; Planting/Whole need different label density. Ten per-map briefs distinguish source evidence from finished background. Preserve current defaults until the corresponding revised example is inspected. |
| AI-MAP-069 | Standalone approved appearance can conceal geometry or source gaps | Open; visually reproduced in local trials | Sector appearance reference includes model-owned boundary/text; Zones v2 changes Zone 0 and adds a roof-like detail. Preserve source geometry and build exact analytical overlays after AI. Neither a prompt nor correct labels prove the painted geometry. Genuine wider satellite imagery remains needed before demonstrating a surrounding-landscape view. |
| AI-MAP-019/026/042 | Cropped boundary features, bed drift and exaggerated excavation | Open | Actual older Earthworks/Planting images inspected, including exact Earthworks comparison. No repair claimed by documentation. New Earthworks sample must retain bed corners/centres and avoid invented construction detail. |
| AI-MAP-060 | Duplicate painted pipe route | Open in earlier saved artwork | Prior Water recovery rejection retained. Lighter background alone cannot remove a false route. Future Water sample must avoid model-owned competing pipe strokes. |
| AI-MAP-033 | Oblique rearranges the site | Open | No new oblique generated or approved. Whole remains top-down pending a site-faithful experiment. |
| AI-MAP-036/055 | Recorded shade material and broad feature restamping | Prior disposition retained | Saved Structures illustration has the documented app-drawn mesh. It is not new evidence that the model reconstructed the tunnel or that current live recovery was tested. |

## Research

- [Esri cartographic principles](https://www.esri.com/arcgis-blog/products/arcgis-pro/mapping/primary-design-principles-for-cartography): subdued basemaps, foreground/background hierarchy, screening and vignette. Informs how strongly imagery competes with thematic marks.
- [Esri overview maps](https://doc.esri.com/en/arcgis-pro/latest/help/layouts/extent-indicators.html): a wider locator view and an extent indicator supply spatial context while preserving main-map detail.
- [Permaculture Association base maps](https://www.permaculture.org.uk/design-methods/making-base-map) and [Sector analysis](https://www.permaculture.org.uk/design-methods/sector-analysis): key permanent features underpin overlays; external influences cross the site.
- [Santa Cruz Permaculture zones](https://santacruzpermaculture.com/2021/02/zone-and-sector-analysis/): use/intensity defines zones; smaller properties may lack some zone classes inside their own property map.
- [Mississippi State landscape-design guide](https://extension.msstate.edu/publications/home-landscape-design): relevant off-site features, recognizable symbols, names/codes and matching plant key. Adopt drawing communication principles, not Northern Hemisphere planting prescriptions.
- [University of Georgia site-analysis guide](https://fieldreport.caes.uga.edu/publications/C1032-4/drawing-a-landscape-plan-site-analysis/): observed site facts and water movement on a base map. Georgia-specific sun and growing advice is not used for South Africa.
- [NRCS conservation planning](https://www.nrcs.usda.gov/getting-assistance/conservation-technical-assistance/conservation-planning): resource maps, photos and schedules tailored to producer goals. Does not prescribe our particular visual style.
- [USGS contour symbology](https://www.usgs.gov/ngp-standards-and-specifications/us-topo-cartographic-specifications-elevation): supports contour hierarchy; does not establish the accuracy of this site's elevation source.

## Verification

- Actual image inspection: named historical Site; approved Sector trial v5; unapproved Zones trial v2; older Water, Earthworks, Planting, Structures, Whole and Phasing; native Terrain & Sections preview; exact Earthworks comparison. Archive files span different dates/revisions and are not a synchronized live map set.
- Private local pack: `Documents/ImbewuField App/Map style samples/2026-11-06/All-map illustration guide/`. Contains ten original-byte example copies, SHA-256 provenance, ten draft briefs, `guide.json`, and `All-map illustration guide.html`. No farmer imagery or private source paths are committed to Git.
- Static gallery checks: ten records/briefs, linked images exist and match source hashes. Browser preview unavailable: local-file navigation was rejected by browser URL policy; no alternate surface or server workaround attempted. No responsive/browser verification claimed.
- Typecheck/tests not run: documentation/research only, with no runtime change. Whitespace checked before commit.
- No app render, paid generation, saved-data edit, API credential use or deployment. No preview server/browser resource left running.
- This does not change the production picture. `PLAN_VERSION` v93 and recipe counters remain unchanged.

## Next continuation

1. Keep user-led sample review first; the private briefs are drafts, not ten approved guides.
2. Obtain genuine wider registered imagery for the context demonstration, with dates/attribution/coverage; preserve the exact full proposed boundary.
3. Correct Zones geometry from saved vectors and test the proposed overview; do not model-author the shapes or scale.
4. Produce bounded Earthworks and Water examples addressing their existing concrete failures before broad aesthetic rollout.
5. Implement approved presentation policies in the existing authorities, inspect actual output at phone/tablet/laptop sizes, and apply the required verification/release gates. Keep the separately owned terrain/survey work coordinated.
