# Sector DEM alignment and regional profile — 2026-11-03

- Auditor: Codex, following Rory's historical baseline, contour-quality and side-view requests.
- Reviewed revision: production `e2574e459638479f56518cc612a2f4b9bfe4cfb7` plus `codex/sector-terrain-profile`.
- Deployment inspected: named Existing Site default live at `e2574e4`; this terrain branch is not yet deployed.
- Previous audit: [Historical area names](historical-area-labels-codex.md), [baseline](historical-baseline-codex.md), [nine-layer corrections](ai-layer-fidelity-corrections-codex.md).
- Scope: Sector contour query/paint coordinates, broad overview treatment and separate free regional A–B profile. No saved geometry/schema, farming prescription, provider endpoint, server guard, paid-generation gate, species or lessons changed.
- Evidence: official terrain documentation, configured-provider read-only tile responses, actual production compositor with stored real DEM data, executable geometry/contract tests, live paid Sector/Earthworks/Structures review.

## What was already done

Historical source and named Existing Site are live (PRs #1179/#1182). Rory approved the area-name version as default; compact numbered labels remain optional. A real paid historical Sector completed normally and is visibly repainted, retaining the classrooms, slab, play equipment, toilet, tank and road without the later proposed garden. It is distinct from the exact photo-plus-overlay versions. Existing Site alone was not regenerated with AI for this review.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-048 | Historical Sector could be called improved AI based only on exact overlays | Actual provider output inspected | One normal owner paid historical Sector completed on 3 November. Painting is visible and recognisable; two classroom roofs remain separate, the courtyard is open, and no proposed beds/swales are added. Original photograph and paid result retained. Fine vegetation/edge accuracy is not certified. |
| AI-MAP-049 | 1 m regional contours imply unsupported local detail; side view absent | Implemented, local visual verification | Sector now shows an overview interval of at least 5 m (a multiple of the source interval), with explicit unknown local accuracy/datum and no set-out use. Separate Terrain profile option uses actual contour crossings; joins are dashed interpolation. It does not extrapolate unknown endpoint heights or invent dense terrain from the five SRTM samples. Plan shows A–B; graph shows provider height, ground distance, source limits and calculated vertical exaggeration. Insufficient/contradictory data returns unavailable. |
| AI-MAP-052 | Sector DEM lookup uses a resized frame with original geographic metadata | Implemented and tested | Query original saved frame/boundary, then transform returned normalized lines with the exact presentation crop. Previous image-marker misalignment exposed the same mismatch here. An executable test fails if resized frame dimensions reach the geographic query. Saved measurements remain unchanged. |
| AI-MAP-053 | Native comparison lacked the live DEM/auth path | Local data evidence qualified | Native renders use the actual compositor with a stored configured-provider DEM tile and matching isolines injected as read-only fixture data, not a fake survey or an owner-API bypass. Normal UI release verification remains required. Client contour requests now use the existing owner-header helper without altering server guards. |
| AI-MAP-054 | Existing contour route relies on an officially unsupported raster endpoint | Open compatibility finding | Route requests `mapbox.mapbox-terrain-dem-v1` through Raster Tiles API. Mapbox documents DEM-v1 as SDK-only. Configured requests for both this route's tile and supported Terrain-RGB returned HTTP 200 on 3 November, each 256×256. Present success does not establish a supported contract. No endpoint/provider-dispatch change made in this rendering branch. |
| AI-MAP-042/026/019 | Earthworks rims, rounded beds and clipped boundary pit | Fresh result still fails quality review | New normal owner Reference Blueprint/aerial Earthworks still has raised-looking rims and rounded bed edges; the northern pit is cut. The prompt correction alone is insufficient. Retain failed candidate separately; do not approve it or describe labels/counts as painted geometry verification. |
| AI-MAP-036 | Structures shade tunnel has no convincing cover | Fresh result still fails quality review | New normal owner Reference Blueprint/aerial Structures still depicts open rows where the Shade Tunnel leader points. The key symbol promises a cover that the painting lacks. Shared prompt glossary alone is insufficient; needs a factual foreground material treatment or a verified different input contract. |
| AI-MAP-019/033 | Canopy clipping and rejected oblique rearrangement | Open carried forward | No contour/profile or annotation change is claimed to repair either. |

## Data-quality decision

Mapbox's [Terrain-RGB reference](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/) documents 0.1 m encoded increments, maximum information equivalent to z15/256 pixels, multiple source datums and no updates to that tileset after December 2021. Encoded increments are not local vertical accuracy. The configured z14/256 query has roughly 8.5 m display sample spacing at this latitude; underlying source resolution and local errors are not independently established.

The [Terrain-DEM reference](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/) documents interpolation above its native zoom, mixed datums and SDK-only availability. No local accuracy certificate or survey datum was supplied. The existing route is left intact; its endpoint mismatch needs separate provider-contract work.

USGS describes [SRTM mission data](https://www.usgs.gov/centers/eros/science/usgs-eros-archive-digital-elevation-srtm-mission-summary) as approximately 30 m grid spacing with a mission absolute vertical accuracy objective of 16 m at 90% confidence. That global objective is not a measured error bound at this site. The app's five points estimate broad slope/aspect only; they cannot justify fine contours or a detailed ground section. A surveyed/controlled drone DTM or ground levels with known datum/accuracy are required for excavation-quality contours. The historic photo alone supplies no calibrated ground heights.

## Verification

- Final ordered typecheck clean; 627 focused render checks pass; whitespace clean. Release-note checks and current-head CI are recorded on PR/issue #35.
- Actual high-quality local Sector overview and separate regional profile inspected. Profile has sparse real contour-crossing points, dashed joins and blank unknown ends, not a fictitious smooth terrain. Diagram is readable alongside plan; graph does not crowd the Sector legend. Serialized frozen scene remains identical after composition.
- Local full canonical suite was attempted with Node 24 and two test workers, then gracefully interrupted without a final result when closing that verification phase. It had no observed assertion failure, but this is NOT a pass. Full CI continues independently. This is a focused presentation change using existing returned heights and frame distance, not a new saved measurement or farming calculation. Initial Node 26 run was replaced to match `.nvmrc`; no other chat's processes stopped. Existing requested gallery server retained; unused own Next dev4282 remains stopped.
- This changes the picture. PLAN_VERSION v93 and recipe r8 unchanged. Physical phone/iPad, live terrain profile and current-head CI remain distinct from native-canvas evidence.

## Next continuation

Finish verification/release of terrain presentation, then test the normal owner profile button and download, including insufficient-data behavior and three viewport sizes. Recompose the already-paid historical Sector for free to adopt the corrected contour frame/overview. Do not buy another Sector pass for this overlay correction. Continue the factual Earthworks/Structures material corrections with free recovery first; retain rejected candidates and test whether the final images actually improve. Historical area-name editing linkage remains separate from the already-existing Base rename/drag-label tools.
