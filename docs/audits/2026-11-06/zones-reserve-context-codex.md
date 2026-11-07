# Zones reserve context and national locator sample — 2026-11-06

- Auditor: Codex, following Rory's request for a small wider Zones view showing the adjacent reserve, and a Base-map South Africa locator recommendation.
- Reviewed code: `008fc12ad63163cc9573eb9cbdcd3ae39c50dbf6`, documentation-only `codex/all-map-illustration-guides`; runtime code remains production base `06315a74ae03d6cb771c659776e09ce47f1d4a2b`.
- Previous audit: [Paired exact/AI samples](paired-map-samples-codex.md), retaining its geometry and source limitations.
- Deployment inspected: none. Local sample variants only; connector still requires connection. Existing authorised local saved-scene sources reused; no new account or permission granted.
- Evidence: genuine wider licensed satellite imagery, primary project records, Natural Earth country/province geometry, native SVG layout, a rejected model-layout trial and actual PNG inspection.

## Result and evidence

The Zones exact SVG gets a separate small context panel in the blank lower legend. The AI presentation reuses the original illustrated Zones bitmap unchanged and adds the same factual panel through SVG layout. It does not ask an image model to create geography. A 500 m scale is calculated from the actual satellite view and site latitude; the original main-map scale is retained separately.

The wider image uses the existing licensed ArcGIS Location Platform helper and configured credential, not the deliberately removed unauthenticated Esri endpoint. Twenty tiles produce a 1350×900 source. The saved original site coordinate is projected through the same tile plan, without moving design geometry. Imagery was retrieved 6 November; its capture date is not supplied. Provider attribution travels on the inset. No token or signed credential URL is stored in the private provenance or committed.

[Zululand Conservation Trust's Mandlakazi project record](https://zululandconservationtrust.org/community_projects/mandlakazi-food-security-project/) identifies the western-boundary communities and uBhejane crèche. [ACT's 2020 report](https://projectafrica.com/wp-content/uploads/2021/02/2020-Annual-Report-ACT.pdf) also places the three crèches along Manyoni's western boundary. The panel labels Manyoni Private Game Reserve to the east, without drawing or claiming a surveyed reserve polygon. The adjacent reserve is not silently added as a saved Zone 5 or treated as garden property.

The separate Base locator proposal uses Natural Earth's [country geometry](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson) and [50 m-scale dataset provinces](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_1_states_provinces.geojson). Here “50 m” is Natural Earth's 1:50 million product name, not 50-metre ground accuracy. Nine South African provinces are present, KwaZulu-Natal is highlighted, and the same actual site coordinate supplies the dot. This is a simplified national locator, not a measured plan or a new Base export.

## Findings and disposition

| ID | Issue | Disposition |
| --- | --- | --- |
| AI-MAP-068 | Wider context proposal lacked an actual sourced example | Local exact/AI Zones variants and Base locator proposal now produced and inspected. No runtime inset/default implementation claimed. |
| AI-MAP-069 | Generating a context image can invent surroundings or alter scale | A single built-in AI layout trial changed existing detail and the inset scale depiction. Retained privately as an unselected trial. Selected AI presentation uses the existing bitmap plus native factual inset instead. |
| AI-MAP-066/067 | Boundary authority, zone classes and actual site use | Prior limitations retained. Reserve boundary untraced; no saved zone/outline edit. Original zone geometry and explanation draft remain unapproved as recorded previously. |

## Verification

- Actual raw satellite, native inset, exact Zones variant, AI layout trial, selected AI presentation and national locator visually inspected. The final inset clears the original AI footer.
- Executable pixel comparison confirms the entire left main-artwork rectangle and original bottom-right footer are unchanged from the previous AI PNG. This check would fail if either were repainted or covered.
- Context SVG scale/marker derive from the actual tile projection, not generated raster text. The native exact SVG only appends the separate inset; the existing drawing subtree is preserved.
- Private deliverables: `Documents/ImbewuField App/Map style samples/2026-11-06/Zones reserve context/`. `Samples.html` pairs exact and AI variants and the national locator. Source/projection facts, outlined SVGs, PNGs, hashes, pixel checks and trial prompt are retained. Prior all-map gallery links to this update; old originals and prior ZIP remain preserved.
- Typecheck/tests not rerun: no runtime code edits. Whitespace checked for the audit. No paid app job, credential provisioning, saved-data change, provider dispatch change or deployment. PLAN_VERSION and recipe unchanged; no temporary server/browser remains.

## Next continuation

Review the context samples with Rory. If approved, integrate this separate sourced inset into the existing presentation authority, retain its own scale/attribution/date, preserve the previous Sector sample, and apply the applicable focused-render/typecheck/CI/preview/visual gates. Base national locator placement remains a proposal rather than a deployed feature.
