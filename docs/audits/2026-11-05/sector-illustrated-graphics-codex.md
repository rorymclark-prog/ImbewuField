# Sector graphics and contour comparison — 2026-11-05

- Auditor: Codex; visual preference remains for Rory to review.
- Reviewed revision: implementation `31b47afff5c10f8b52912482bd9291aa1c913f99` on `codex/sector-illustrated-graphics`, integrated over `a43b411ea` (the current main with the separately owned feature walkthroughs).
- Deployment inspected: `https://imbewufield.vercel.app/api/build-info` reported `a5300d2` initially and `a43b411` during this continuation. These samples are local drafts, not deployed changes.
- Previous audit: [Sector context and analysis graphics](../2026-11-04/sector-calm-context-codex.md). Retains AI-MAP-058/059/063/064 and the documented source-coverage and registration limits.
- Scope: illustrated Sector painters, labels, key and optional source-raster supplemental contours. No other map redesign, provider dispatch, paid-job gate, worker, saved schema, calculation, permissions or measured geometry changes.
- Evidence: real native compositor outputs from the frozen Ubhejane scene, original accepted paid artwork and saved original terrain tiles; code, typecheck and affected tests. No new paid generation.

## What was already done

The previous Sector change was merged as `837aa9656`, followed by separate assistant and update-guide integration. It quieted the background and prevented annotated Sector pages from entering the paid polish stage. Rory now finds the finish too similar to an instant map and asks for richer graphics/labels, more prominent contours and several researched samples. This continuation does not reopen the completed source-handoff correction or claim a fresh model output.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-058 | Flat symbols and small plain labels make the AI sheet feel like an instant diagram | Implemented and inspected as drafts | Shared shaded sun medallions and two-tone flame artwork on map/cards/key; measured two-line white cards; larger sunrise/sunset captions; flowing wind ribbons retain all three dashed streamlines and actual sourced tips. Compact Sector alone has a serif heading and fine category separators. Exact map and other layers retain their painters. Three actual context treatments permit comparison before selecting a new default. |
| AI-MAP-059 | Regional contours remain too faint and the overview hides available terrain detail | Implemented and inspected as drafts | Illustrated Sector reuses `fetchProfileTerrain` and `rasterTerrainContours`, already used by Terrain & Sections, in the original saved geographic frame. Actual Terrain-RGB pixel-centre isolines provide 2.5 m supplemental spacing, clipped to the property and transformed only into paint coordinates. Main 5 m lines are heavier; white casings and larger numeric labels survive the artwork. Missing/unsuitable pixels retain the established overview. Exact Sector still requests no supplemental raster and keeps its 5 m presentation. Finer spacing is interpolation, not improved accuracy or survey/set-out data. |
| AI-MAP-063 | Analysis accidentally enters the model polish input and returns twice | Retained | No changes to the previously corrected unannotated-artwork input, revision check or paid-difference gates. The new finish is app-authored; no model-created label/bearing is trusted. |
| AI-MAP-064 | Loose rain drops intrude into blank source coverage | Retained and inspected | No loose rain drops on these illustrated sheets; the SW card/key retain driving rain. Blank archive coverage remains white. |
| AI-MAP-042/026/019/033/051 | Other layers, canopy, oblique fidelity and editable historical area labels | Open, carried forward | No new provider output, other-map redesign or physical phone/iPad/print verification is claimed. Whole-sheet 390 px thumbnails require zoom. Older artwork with baked-in annotations still cannot be reliably de-annotated by reassembly. |

## Samples and research

Local review folder: `/Users/roryclark/Documents/Codex/2026-11-05/sector-review/`.
`Sector samples.html` links all three full-resolution sheets and A4-sized digital previews. `sample-receipt.json` records hashes, immutable artwork inputs and exact-reference provenance. The local native harness asserts the serialized scene is unchanged.

| Sample | Presentation | Full-resolution SHA-256 |
| --- | --- | --- |
| A | Balanced illustrated atlas; current code candidate, moderately quiet colour | `95e6ccd3a156e91bc55102efbc99ecb43d41425b772444bb3583a143d7973508` |
| B | Pale terrain-first context; local comparison only | `050ab12b2476286679c890499b3a88667c805e916e6572d8f4cc741b6aee2a82` |
| C | Original artwork colour/detail with the new graphics; local comparison only, preferred for visual richness | `e926ad0def70525899d2912afff9208ff22bad9e87adbfa8f271d1ebee6e5e18` |

All sheets are 3462 × 2448. The actual extra source levels are 327.5 m and 332.5 m; 325 m occurs in two separately clipped runs and 330 m crosses the property. The native exact Sector export remains byte-identical to the previous baseline: `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`.

Research informed the presentation, not new site facts:

- [Permaculture Association sector analysis](https://www.permaculture.org.uk/design-methods/sector-analysis): represent directional energies over the real base site. This supports readable flowing directional marks; it does not supply this site's wind observations.
- [Cathrine Dolleris forest-garden case study](https://www.permaculture.org.uk/sites/default/files/forest_garden_design_kattekaerhus_cc.pdf), sector page: consulted its sector-analysis description as a reference; no artwork copied or added as an app asset.
- [USGS contour hierarchy](https://www.usgs.gov/ngp-standards-and-specifications/100k-ondemand-topo-cartographic-specifications-elevation): stronger labelled main contours and thinner intervening lines. Its mapping scale/intervals are not adopted as ground accuracy claims here.
- [QGIS raster extraction](https://docs.qgis.org/3.44/en/docs/user_manual/processing_algs/gdal/rasterextraction.html): contours derive from elevation rasters at a specified interval. Reuse the app's existing actual-raster implementation rather than invent new curves from slope or drawing between lines.

## Verification

- Typecheck: clean again after integrating current main `a43b411ea`, before the final affected-check run.
- Focused render: 639 passed, 0 failed with two workers, including the final current-main integration run. The first run exposed a missing imported supplemental-ink dependency in the extracted compositor test scope; supplied the actual shared constant without changing any assertions, then reran successfully.
- Affected Sector/release/label/tour tests: 34 passed, 0 failed. The wind probe's Canvas stub now supports linear gradients; its actual bearings, three streamlines, dashed register and solar sweep assertions remain intact.
- New supplemental-contour test executes the real selection/crop function, verifies the original frame is used, exact requests no extra pixels, missing pixels fall back, and source geometry stays unchanged. Existing raster tests check pixel-centre elevations on a known gradient and clipping; tests can fail on displaced or invented contours.
- Full suite: not run locally for this focused presentation change; no full current-head pass claimed. CI remains separate.
- Whitespace: `git diff --check` clean. 13 release-note/label/tour checks passed after the implementation stamp; `notes:pending` reports no uncovered user-facing changes.
- Output inspected: all three final 1123 × 794 digital A4-sized previews, full-sheet screen exports, and whole-sheet 390 px thumbnail. Card text/key remain separate from the art, no clipping/overlap observed in these samples. No physical-device or physical-print verification.
- This changes the picture. PLAN_VERSION and recipe counters are unchanged. Source registration, white source gaps, original exact map, paid gates and Terrain & Sections qualifications remain intact.

## Next continuation

Show the three samples to Rory and select the final context treatment. Branch code currently represents A; B/C are explicit local visual comparisons, not hidden app settings. Preserve current-main assistant/update work. Push the finished draft with its audit; any release still requires current-head rules/focused-render and a successful preview, then normal owner free reassembly/export verification on the released build. Do not merge the old duplicate Sector extraction PR or describe these samples as live.
