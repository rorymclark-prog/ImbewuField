# Separate Terrain & Sections sheet and contour hierarchy — 2026-11-03

- Auditor: Codex, following Rory's request for clearer earth colours and a separate detail sheet.
- Reviewed revision: `codex/terrain-contour-detail`, based on the two-section and Sector finish head `7f0a3e68d17a512de86962647a0ae9862a01afb3`.
- Previous audit: [Downhill sections and Sector finish](downhill-sections-sector-finish-codex.md). This change is sequenced after that release.
- Scope: dedicated free export, contour selection/paint and key. No new paid artwork, saved geometry/schema, cartographic provider endpoint, authentication or excavation guidance.
- Evidence: actual posted raster, existing paid artwork and exact render, native export inspection, geometry tests. Live owner export pending.

## Findings and disposition

| ID | Issue | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-059 | Users cannot tell which map owns contours and what the lines mean | Implemented, native visual review | 02 — Sector retains a light labeled 5 m overview in exact and paid exports; brown dashed sample in the key matches the line, not the water icon. A separate Terrain & Sections entry opens and saves its own export; plan set numbering stays 01–09. |
| AI-MAP-061 | Extra contour detail can create false accuracy or frame/edge ghosts | Implemented and inspected | Detail interpolates the exact same raw pixel centres as the A–B/C–D charts. Open marching-squares cell runs are joined only at matching endpoints, clipped to the saved property and sub-grid supplemental fragments suppressed. Thick solid brown 5 m levels have one label per height; finer dashed 2.5 m levels are visually subordinate. No higher-resolution data is claimed. |
| AI-MAP-062 | Proposed fencing could be confused with the analytical outline | Clarified, no fence change | Rory confirmed to skip proposed fencing on these analysis sheets. Green dashed Current design extent is explicitly keyed as orientation. No separately classified proposed fence was found in the inspected frozen Ubhejane render; no new line, recolour, saved-feature change or reclassification. Existing photographed fence retains its separate Sector key. |
| AI-MAP-054 | Legacy Sector contour endpoint compatibility | Open carried forward | Dedicated contours use the new documented Terrain-RGB raw response already used by the section; no second contour API request. Existing Sector overview path unchanged beyond paint and labels. |

## Actual raster and alignment

Four elevation levels visible at Ubhejane: 325, 327.5, 330, 332.5 m, across five clipped runs. The additional small 325 m run is unlabeled because the longer run already identifies that height. A–B crosses 330, 327.5, and 325 m at roughly 16.1, 33.3 and 48.9 m respectively. Re-evaluating the same raster at those plan intersections differs by at most 0.003 m from the contour value; this is numerical consistency only, not field accuracy. Both sections retain the same geometry/scales and classroom widths. The 8.5 m posted grid, unknown datum/local accuracy and need for surveyed or controlled drone data remain explicit.

Styling follows the distinction between heavier labeled [USGS elevation contours](https://www.usgs.gov/ngp-standards-and-specifications/us-topo-cartographic-specifications-elevation) and lighter auxiliary lines; the [Esri half-auxiliary convention](https://doc.esri.com/en/arcgis-pro/latest/tool-reference/topographic-production/identify-contours.html) informs 2.5 m between the main levels. This is a regional app map, not a claim of compliance with survey or USGS product accuracy specifications.

## Verification

- Ordered local tsc clean; 634 focused checks, 19 Sector checks, whitespace clean. The new geometry test would fail on a half-pixel shift, untrimmed property crossing or contours drawn from a flat raster.
- Inspected actual native 1800×1273 section with brown contours and explicitly named extent. Inspected paid Sector recomposition with the actual archived artwork, 5 m contour marks and matching dashed swatch. Exact reference uses the same 5 m palette/labels. Frozen saved scene remains unchanged.
- No duplicate paid AI request. Full suite and live browser checks recorded separately, no pass claimed here.
- This changes the picture. PLAN_VERSION and render recipe unchanged. Other map-layer/oblique fidelity findings remain open.
