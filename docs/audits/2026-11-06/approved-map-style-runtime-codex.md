# Approved map styling in the app and cross-location checks — 2026-11-06

- Auditor: Codex, following Rory's instruction to make the boundary thinner with circular posts, apply the sample decisions to new app renders and check other locations.
- Reviewed base: production `06315a74ae03d6cb771c659776e09ce47f1d4a2b`; branch `codex/approved-map-styles` continues the documentation/sample branch through `f98125ce1225cfa6835890ff32ca5f5277ef4e28`.
- Previous audit: [sample boundaries, slope labels and Record plan](map-boundary-slope-labels-codex.md). [Earlier context proposals](zones-reserve-context-codex.md) remain separate samples, not runtime features introduced by this change.
- Deployment inspected: local actual component/helper outputs; preview/release identity and current-head CI recorded on PR/issue #35.
- Scope: default illustrated prompt, native boundary/key, Sector surround/terrain presentation, Earthworks callouts, Terrain & Sections captions/fallback/layout. No provider dispatch, worker execution, account/billing gate, saved schema or source measurement change.

## Implementation and carried decisions

The shared native boundary now uses a fine wire and small round post symbols. The historical Sector proposed extent delegates to that painter instead of maintaining a separate dashed-line style. The key uses the same fine wire and round dots. Posts are symbolic paint marks, not surveyed post locations or a spacing recommendation. Gate breaks and saved boundary geometry remain unchanged.

Sector darkening now intersects actual image coverage with the **outside** of the full saved proposed polygon. The property stays luminous and unknown archive tips remain white. Exact copied artwork, native sun/weather marks and the saved boundary remain separate. Analytical symbols sit above contour strokes; their claimed boxes prevent contour lines crossing the weather/sun graphics. The large broad-slope arrow belongs to the separate detail/Water story, so it and its legend row are omitted on the composed Sector sheet. Legacy direct analysis rendering is retained.

Sector contours are now independent of the separate five-point slope estimate. If the overview route cannot select an interval from SRTM, the existing authenticated raw-raster route can still supply actual 5 m overview contours or 2.5 m illustrated supplemental levels. No contour is invented where pixels are missing. The note distinguishes available DEM contours from a missing broad slope estimate. All coordinates are still queried in the original saved frame and transformed only for presentation.

Terrain keeps the full fine boundary and labels all available main/supplemental heights. New captions report the actual section's endpoints, fall/rise, horizontal length, percentage and degrees. They are not copies of Ubhejane or replacements for a site's broader SRTM estimate. A small numerical tolerance accepts interpolation endpoint round-off; empty/incomplete/non-finite/reversed data remains unavailable. When pixels exist but no consistent downhill section exists, the plan retains available contours and explains the unavailable section instead of discarding the whole map. Gentle-profile height ticks use printed spacing; two-section charts reserve space for the captions while maintaining equal horizontal/vertical scale.

Earthworks exact and illustrated maps share callouts from the existing element/line register. Names/counts identify saved preparation features and individual swales, even in plant-code mode. Context pipes/trees do not become excavation callouts. Labels do not certify AI-painted pit depth, bed corners or berms. AI-MAP-026/042 remain open for provider-drawn feature fidelity.

Reference Blueprint remains the default, with a finer illustrated material brief and white page/key. Sector's prompt describes the approved appearance while forbidding transfer of another site's buildings, vegetation, reserve, boundary or terrain. Numerical/analytical graphics remain app-owned. Other selected styles and user overrides remain available; no worker reference asset or provider contract changes.

Record plan remains the existing exact report/Studio option. No AI image replaces it. The prior Zones reserve inset and national locator have their own sample artifacts; this focused runtime change does not claim those proposals were deployed.

## Findings and disposition

| ID | Issue | Disposition |
| --- | --- | --- |
| AI-MAP-070 | Faint terrain extent and missing usable height/gradient summaries | Implemented and native output inspected; current-head preview/release evidence follows on PR/#35. |
| AI-MAP-071 | Model-drawn extent and inconsistent native boundary treatments | One fine native painter for the saved ring; symbolic circles and matching key. Outside shading follows saved polygon, not the compound. |
| AI-MAP-072 | Cross-location terrain presentation was hidden by missing broad slope or short charts | Actual provider-data renders at three additional SA locations; contour fallback, captions, round-off and chart spacing corrected. Missing-data branches tested separately. |
| AI-MAP-069 | A successful model response need not preserve geometry or requested aesthetics | Remains open for fresh model outputs. Prompt updated; retained Ubhejane artwork recomposed, not a fresh paid provider run. |
| AI-MAP-026/042 | AI excavation/bed geometry | Still open; labels do not prove these painted shapes correct. |

## Verification and limits

- Ordered local `npx tsc --noEmit` clean; 203 affected checks pass. Canonical `test:render` file set passes 645 checks on Node 24, limited to two workers. Whitespace clean. Release-note check and current-head CI are recorded on PR/issue #35.
- Actual native app outputs inspected: Ubhejane retained AI Sector, exact Earthworks and Terrain; Cape Town, Pretoria and Hoedspruit Sector/terrain. Other-location polygons are explicitly labelled **TEST EXTENT**, not real saved customer boundaries. Real licensed Esri context and actual Mapbox Terrain-RGB tiles supply these checks. No imagery capture dates or survey accuracy are asserted.
- Additional four-location synthetic tests include a northern-hemisphere location, distinct raster heights/query windows, missing evidence and contour/sample consistency. Synthetic fixtures are not reported as measured land.
- Earlier local probe imports followed a shared `node_modules` symlink into an older checkout. Corrected to absolute current-branch helper imports before selected reruns. Selected checks then exposed and repaired the fractional endpoint-caption and crowded gentle-profile tick defects. Final selected images were inspected after those corrections.
- Frozen source state serializes identically after every selected native output. No saved geometry, species, lessons, provider permissions, spend/quality tier or source levels changed. Existing app guards were not bypassed; local read-only provider fixtures substitute for browser-owned authenticated responses in the native probe.
- Sources, PNGs, cross-location evidence and reproducible helper retained privately under `Documents/ImbewuField App/Map style samples/2026-11-06/App style location checks/`. Updated thin-post Sector sample is in the sibling `Boundary slope and labels/` gallery. No private farm scene, credentials or raw log committed.
- No fresh paid app image job or physical phone/iPad/laptop run is claimed. New provider artwork still needs normal owner review. Regional wind/fire evidence is explicitly unavailable where the existing model has no supported profile; it never borrows Durban's arrows for another region.
- This changes the picture. PLAN_VERSION v93 and render recipe unchanged. Full CI suite continues separately; no unobserved full-suite pass claimed. No temporary preview server/browser was started for the native phase.

## Release continuation

Finish the current-head focused-render/rules and successful preview build, record exact identity and visual evidence on PR/issue #35, then merge under AGENTS §1. Continue normal owner testing of newly generated artwork separately from the verified deterministic boundary/annotation changes. Keep the remaining geometry and optional context-inset work visible rather than treating a pretty sample as a completed production feature.
