# Map style footer and oblique feasibility — 30 October 2026

- Auditor: Codex, following Rory’s request to demote “Reference Blueprint” and assess an automatic oblique illustration.
- Reviewed base: `efdd0cd85aacfad8aec4e640de85f44ea30cb4ed`; branch `codex/map-style-footer`.
- Deployment inspected: pending current-head checks and release; completion revisions belong on issue #35.
- Previous audit: [Boundary foreground follow-up](../2026-10-29/ai-map-boundary-features-codex.md), released in #1151. AI-MAP-001–008 dispositions retained; source-photo seams remain open.
- Scope: style credit layout in the shared sheet composer and the separate Phasing panel. Oblique work is a read-only feasibility assessment, not an implemented or generated view.
- Evidence: current code, official provider/terrain/photogrammetry documentation, actual compositor over existing paid artwork, seven credit-position traces and full rendered sheets. No new paid generation.

## What was already done

The independent surveyed boundary, foreground tanks/foliage, white paper, catalogue key and AI review/imagery credit remain. Saved geometry, existing artwork and paid recovery contracts are unchanged. The user’s latest Planting result was recovered and visually verified in production after #1151.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-010 | “Reference Blueprint” occupies a prominent line below the sheet heading. | Implemented and locally inspected. | Reference Blueprint moves to footer-size type below provenance/credit, leaving the sheet title and farm name at the top. Custom Water notes and the independent Phasing schedule reserve footer space. Other style names retain their current header treatment. Seven actual draw traces contain one credit each, all below 80% of canvas height and with font size below 2% of height. |
| AI-MAP-011 | An automatic terrain-guided oblique view is requested for consideration. | Feasible proposal; not implemented or tested with a model. | The app has Mapbox-based contour generation, indicative site elevation/slope, photo underlay and multi-image OpenAI request assembly (composite plus style reference). The paid frozen scene currently describes a top-down frame/source, not a terrain grid, camera, aligned photo set and projected label anchors. A distinct view/render contract is needed. |
| AI-MAP-007 | Source-photo inset seams. | Open, unchanged. | This layout correction does not change source imagery or registration. |

## Oblique approach proposed from the evidence

1. Collect the saved boundary/features and the best available georeferenced ground elevation model. Keep source, date, resolution, vertical datum and missing-data status. A contour interval is not a claim of survey accuracy. Check the existing contour route’s data-access assumptions against current Mapbox SDK restrictions before using it in a new pipeline.
2. Prepare an oblique terrain/scene view in code with a frozen camera, projected saved positions and explicit height evidence. Species height metadata may exist, but it is not a measurement of a particular tree or a traced building. Unknown heights stay illustrative; missing terrain must not silently become measured flat ground.
3. Select and align same-site drone/ground photos as appearance evidence. A single photo is not an elevation survey; photogrammetry products can provide separate georeferenced orthophotos, ground terrain and surface models. Prefer ground terrain for the land surface so existing buildings/trees are not counted twice.
4. Give the geometric base, top-down plan and relevant photos to the image model with clear roles. The image API supports multiple reference images; this does not guarantee exact reconstructed geometry or hidden feature counts. Avoid asking the model alone to infer a terrain survey from a pretty plan.
5. Reproject labels from saved geometry using the same camera; handle occlusion and provide the complete inventory separately. Current top-down pixel restoration, scale bar and registration checks cannot simply be reused on a perspective image. Add suitable verification rather than weakening the existing guards.
6. Present a simple proposed “Top-down / Oblique” choice while preparing inputs, choosing a useful camera, queuing, saving and retaining source provenance in the background. Keep the measured top-down plan available as the working reference. Preserve existing account/org/spend controls. This proposal adds no UI option or worker/schema change in this release.

Official sources read 30 October 2026:

- [OpenAI image generation — editing with multiple image references](https://developers.openai.com/api/docs/guides/image-generation#edit-images): confirms multi-image inputs; does not establish survey or reconstruction accuracy.
- [Mapbox Terrain-DEM](https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-dem-v1/): elevation/terrain support, limited source resolution, datum variation and current SDK-only access statement. Zoom interpolation is not additional measured detail.
- [OpenDroneMap outputs](https://docs.opendronemap.org/outputs/): georeferenced mesh, orthophoto, ground DTM and surface DSM as separate outputs. No ODM installation, licensing choice or external processing service was selected here.

## Verification

- Typecheck: `npx tsc --noEmit` passed.
- Relevant suite: `npm run test:render` — 574 pass, zero failures/skips/TODO; additional typography/legend-layout tests recorded in the release ledger.
- Full suite: runs separately in CI under AGENTS.md §1; no current full-suite pass claimed.
- Whitespace/release-note checks: recorded before push; four notice translations are unreviewed drafts paired in `map-style-footer-release-drafts.json`.
- Actual output: six design-layer composers and Phasing ran with existing Whole artwork as a layout fixture; these are not seven fresh model generations. Planting and Phasing inspected at full-sheet resolution; all seven credits measured at footer baselines with small type. Frozen scene remained byte-identical.
- Local canvas uses fallback fonts; final browser proof and release revision belong in issue #35. No new provider request, contour-data purchase or drone upload.
- **This changes the picture.** PLAN_VERSION and recipe tokens remain unchanged; existing paid art can use free reassembly. No provider, spending, permissions, job execution, data schema, saved geometry, lesson or species-data changes.

## Next continuation

Finish focused-render/security/preview gates, merge and verify production, then inspect the free reassembly of the existing Planting artwork. The oblique pipeline remains a proposed next feature requiring its own inputs, verification and full-suite gates for worker/schema/provider changes.
