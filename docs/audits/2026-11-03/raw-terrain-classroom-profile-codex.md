# Raw terrain and classroom section — 2026-11-03

- Auditor: Codex, following Rory's rejection of the sparse profile and request for classroom locations at scale.
- Reviewed revision: `codex/raw-terrain-profile`, based on `a602ee78ba094ae10b4f4a764c1cbf2536c407ed`.
- Deployment inspected: named default and Structures recovery live at `a602ee7`; this profile remains a local preview until release evidence is added.
- Previous audit: [Sector terrain profile](sector-terrain-profile-codex.md), [shade recovery](structures-shade-recovery-codex.md).
- Scope: optional Sector section rendering and a bounded raw-pixel response on the existing authenticated contour route. No saved schema/geometry, AI provider dispatch, paid-generation gate, worker, permissions, farming prescriptions or species changed.
- Evidence: official provider documentation, original earthworks PDF, stored actual provider tile, actual native compositor, executable raster/georeferencing/footprint tests. Normal owner UI verification remains required after deployment.

## What was already done

Rory approved the named historical Existing Site as default. The optional numbered key remains live. A genuine paid historical Sector was freely reassembled in production with the corrected geographic frame and 5 m contour overview, preserving the painting. The prior sparse two-crossing profile was shown and explicitly rejected. Its export is retained as a rejected baseline, not final evidence. This continuation supersedes the usability claim for AI-MAP-049 without rewriting the historical audit.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-049 | Two contour crossings give an unhelpful straight hillside | Replaced locally; release verification pending | Profile now samples decoded Terrain-RGB pixels along A–B. Actual local export has 45 interpolated plot points supported by 15 raster pixels, approximately 8.5 m posted spacing, over 43.4 m. These counts describe the returned data, not independent ground measurements. No contour crossings or five-point SRTM fit supply the section. |
| AI-MAP-055 | Profile does not locate classrooms or relate to the plan scale | Implemented, local visual verification | A straight transect passes through the two principal saved building centroids. Plan and section show the same A/B. True polygon intersections supply roof-footprint width bands and chainage; both axes use equal pixels per metre (1× exaggeration). Historical classroom names are matched to the registered archive anchors. No building/roof height or ground-control precision is invented. |
| AI-MAP-056 | Pixel georeferencing and interpolated detail could imply false precision | Implemented and tested | Pixel centres use the half-pixel convention. A synthetic raster peak survives sampling; out-of-coverage values are unavailable, not zero. Endpoint heights come from raster coverage, not extrapolated isolines. Native grid spacing/supporting-pixel count are distinct from plotting steps. Fetch uses the original saved geographic frame; presentation crop is paint-time only. |
| AI-MAP-054 | Existing contour tiles use an officially unsupported Raster endpoint | Profile avoids it; old contour compatibility remains open | New raw mode uses documented `mapbox.terrain-rgb` PNG raw tiles with the existing configured Mapbox token. It validates 256×256 unbuffered tiles. Legacy isoline queries keep their source; this branch does not certify or silently rewrite those contours. |
| AI-MAP-057 | A raw request could become an unbounded payload or bypass existing gates/cache identity | Implemented and tested | Same `guardPaidApiRequest('contours')` runs before any cache read. Existing tile/time/bbox limits remain. Raw window is independently capped at 128×128 and keyed by exact returned integer window, separate from contour responses. Partial/invalid grids fail. No new external credentials or AI call. |
| AI-MAP-058 | Sector technical graphics dominate the paid painting | Open, actual production output inspected | Thick outlined arrows, outlined all-caps text, unexplained assumption markers and dense notes need a separate visual hierarchy pass. The latest actual Sector export remains work in progress, not an all-maps completion claim. |
| AI-MAP-042/026/019/033 | Earthworks rims/bed changes, canopy clipping and rejected oblique | Open carried forward | Raw profile and Structures material recovery do not repair these output failures. |

## Source investigation

[Google Earth Pro's official guide](https://support.google.com/earth/answer/148134?co=GENIE.Platform%3DDesktop&hl=en) supports drawing/opening a path, then Edit → Show Elevation Profile, with cursor-linked distance/height. No available Google Earth connector was found. This is not a Google terrain integration, and no Google surface heights or 3D classroom models were copied.

[Mapbox Terrain-RGB](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/) is the documented Raster API source. The profile deliberately uses z14/256 posted samples; this is not its finest potential encoded grid, nor proof of local source resolution. Multiple vertical datums and source ages remain unverified. The raw profile is a regional surface estimate, not a bare-earth survey. [Terrain-DEM](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/) documents SDK-only buffered tiles; those must not be treated as ordinary unbuffered pixels in this new path.

The original 2019 hydrology/earthworks PDF was text-extracted and rendered at 1800 px for inspection. It has drawn contour guides but no recorded numeric height levels that can establish this section's elevations. A bounded search of the Ubhejane archive directory found no GeoTIFF/DEM, LAS/LAZ, XYZ, ASC, KML, GPX, SHP or CSV terrain file. The registered photograph is not a drone photogrammetry ground model. Copernicus GLO30 and the NGI regional catalogue were investigated as alternatives, but no independently better controlled site dataset was obtained; no commercial dataset was purchased. A surveyed/controlled drone ground model with known horizontal/vertical references remains the route to drainage/construction-quality work.

## Verification

- Typecheck: clean before final verification; final ordered checks recorded on PR/issue #35.
- Focused render: 632 passed, including the supported-endpoint decoding contract.
- Full suite: continues separately; no pass claimed. This is a bounded map-rendering/data presentation change, not AI-provider dispatch or saved measured geometry. Existing unrelated full-suite failure is not described as a pass or used to waive an affected test.
- Native output inspected: landscape 1800×1273 actual compositor plus stored actual Terrain-RGB tile, both classroom bands, A/B and equal H/V scale visible. Serialized frozen scene unchanged. This does not verify the live authenticated endpoint.
- Whitespace: final result recorded at release.
- This changes the picture. PLAN_VERSION v93 and recipe r8 unchanged.

## Next continuation

Verify owner button and saved download against current-head preview/production, including raw API and the three viewport sizes. Share actual export, keep sparse baseline marked rejected. Refine Sector overlays freely over the existing paid painting; no duplicate AI charge needed. Continue the remaining Earthworks/canopy/oblique and archive-area editing findings separately.
