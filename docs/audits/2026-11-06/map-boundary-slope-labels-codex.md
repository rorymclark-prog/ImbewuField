# Sample boundaries, slope values, Earthworks labels and Record plan — 2026-11-06

- Auditor: Codex, following Rory's review of the paired map samples.
- Reviewed revision: `2bd0180f7c2c7abf216369bbd42f597f739e015e`, `codex/all-map-illustration-guides`.
- Previous audits: [paired samples](paired-map-samples-codex.md), [Zones context](zones-reserve-context-codex.md), and [terrain detail](../2026-11-03/terrain-section-contour-detail-codex.md). Their remaining fidelity findings carry forward.
- Deployment inspected: none. Local sample revisions only; no application source/defaults changed.
- Evidence: original frozen scene, cached configured-provider terrain raster, actual app drawing exports, built-in image edit, factual SVG overlays and visually inspected PNG exports.

## User decisions and result

Rory clarified that the additional map is the existing **Record plan**, not Implementation & Phasing. The gallery now includes the actual `sitePlanFigure` SVG from the same original scene, using the existing RecordPlanOption/report drawing authority. It retains codes, numbered beds/plots, scale and existing/proposed marks. A viewer-compatible duplicate text-halo treatment is used for the selected local SVG/PNG; the untouched export is preserved separately. No drawing rule or saved data changed.

The terrain sample's existing design-extent stroke was faint. It is strengthened using all ten saved boundary vertices, with endpoint badges above the linework. Provider contour heights 325, 327.5, 330 and 332.5 m remain explicit. Native source lines and labels are overlaid on both exact and existing AI presentations; the AI ground bitmap is not repainted. Unknown photo coverage remains white.

Section statistics use the same existing `rasterTerrainSections` calculation and cached Terrain-RGB pixels as the original charts. A–B drops 6.699 m over 49.730 m: 13.5% (7.7°). C–D drops 2.304 m over 43.402 m: 5.3% (3.0°). The separate saved five-point site estimate, 11.8% (6.7°), is labelled as a broad indicative estimate. These different sampling extents are not silently substituted for one another. Heights have an unverified datum and local accuracy; no survey-quality levels are asserted.

Percentage is the primary label, with degrees alongside. [USGS explains rise/run percentage and angular slope](https://www.usgs.gov/educational-resources/determine-percent-slope-and-angle-slope); the [NRCS glossary](https://www.nrcs.usda.gov/sites/default/files/2022-10/GDS_v5.pdf) uses percent slope for soil/site description. This supports the presentation choice without claiming a universal surveying convention. No contour interval or ground measurement is invented.

Earthworks gets five readable native leader labels on both variants: two individually identified saved swales, the nine vegetable beds, banana circle and a representative tree pit. Positions come from saved feature anchors. The original AI bitmap is embedded unchanged. Labels do not certify its pit depth, raised-looking rims, swale construction or bed corners. The false inherited “Exact plan” footer on this AI variant is replaced with an illustration/verification note.

The previously selected Sector illustration had a model-painted lime outline that differed from the saved polygon. One built-in image edit removed that painted outline, kept the approved visual style and strengthened the surrounding contrast. Rory then said, “sector map is great just include a boundary line”. The selected final version therefore adds the **saved** polygon and a matching key through SVG, with analysis labels/arrows above it. The existing courtyard fence remains distinct. This newer appearance decision supersedes the prior byte-identical-selection requirement for the revised sample only; the original approved v1 and prior gallery files remain preserved. AI-painted ground/contour alignment is still illustrative, not certified by the exact polygon.

## Findings and disposition

| ID | Issue | Status | Evidence and remaining work |
| --- | --- | --- | --- |
| AI-MAP-070 | Terrain boundary too faint; usable height and gradient summaries missing | Revised local exact/AI samples inspected | Full saved boundary, contour/endpoint elevations and both gradient units. Runtime implementation remains open. |
| AI-MAP-071 | Sector's generated boundary diverges from saved extent | Exact SVG boundary in revised local sample | All ten vertices compared against earlier saved proposed-boundary guide; maximum numerical error below 0.001 output pixel. Native line is above ground and below analysis labels. Production generator not changed. |
| AI-MAP-069 | Model-authored features/annotations can drift | Open, reduced for overlays | Terrain/Earthworks bitmap bytes preserved; factual labels/lines are separate vectors. Sector appearance edit inspected but not certified for painted contours or site geometry. |
| AI-MAP-026/042 | Earthworks bed/excavation appearance differs from exact | Open | Leader labels improve identification; no claim of repaired excavation shapes. |
| AI-MAP-068 | Paired sample set omitted the separate Record plan | Included locally | Actual app/report SVG exported from the same frozen scene. Not a new current-account revision. |

## Verification

- Exact and AI Terrain, Earthworks and Sector final PNG exports visually inspected; final Record plan PNG inspected after resolving Cairo's unsupported `paint-order` rendering of text halos. Original SVG retained unchanged alongside the compatible copy.
- Executable checks confirm unchanged serialized scene, all ten Sector outline vertices against the earlier saved reference, percentage/degree conversions, and byte-identical embedded prior Terrain/Earthworks AI bitmaps. These checks fail on changed geometry, formulas or bitmap content; they do not certify model-painted detail.
- Sources and deliverables are private local files under `Documents/ImbewuField App/Map style samples/2026-11-06/Boundary slope and labels/`. `Samples.html` pairs the revisions and includes Record plan; earlier galleries link to it. SVG/PNG files, source facts, calculations, prompt, hashes, checks and reproducible helpers are retained.
- ImbewuField connector `get_profile`, `get_connection`, `list_sites` still require connection. Reused already authorised local scene/evidence; no account/site access inferred and no new credentials requested or printed.
- Typecheck/full suite/focused-render not run: documentation and private sample artifacts only, no runtime code changes. Whitespace checked. This changes the sample pictures; PLAN_VERSION v93 and recipes unchanged.
- No deployment, paid app job, provider dispatch, saved schema or security change. Physical phone/iPad/laptop app QA not claimed. No temporary preview server or browser was started.

## Next continuation

Review the remaining native/AI differences, then integrate approved presentation requirements through the existing authorities with the relevant typecheck/render/CI/preview/visual gates. Keep Record plan distinct, retain the newer Sector appearance with a source-derived polygon, and carry the original source/data limitations into future generator guides. Do not treat these local samples as deployed defaults.
