# Downhill section, classroom cut and Sector finish — 2026-11-03

- Auditor: Codex, following Rory's correction that the first classroom transect did not follow the main slope and his review of the painted Sector export.
- Reviewed revision: `codex/sector-artwork-finish`, continuing `codex/raw-terrain-profile` at `ab4f1c3f3d0795ea4102a2623369b75415e86a72`.
- Deployment inspected: `a602ee7` live for named Existing Site, previous Sector composition and Structures recovery. The two-section and art-finish images below are local renderer evidence; preview/current-head release remains separate.
- Previous audit: [Raw classroom profile](raw-terrain-classroom-profile-codex.md). Its 43.4 m classroom line remains useful as C–D; it is superseded as the primary A–B section.
- Scope: regional map presentation, two sampled cuts, and restyling app-owned overlays over existing paid Sector pixels. No new paid render, worker, spending/auth changes, saved measurements, species or farming prescription.
- Evidence: frozen owner render scene and original paid pixels, actual configured provider tile, source/geometry and visual checks, baseline full-suite failure investigation.

## What was already done

The named historical Existing Site remains live as default with a Numbered key alternative. Rory rejected both a two-contour-crossing graph and using the classroom-only path as the main downhill section. The current profile keeps that classroom cut separately. The historical paid painting was already recovered free in production; this pass changes its annotations only.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-049/056 | Primary section does not follow site fall | Replaced and visually inspected locally | Fit the broad downhill axis using least-squares direction across native pixels within the saved boundary, then sample each actual plotted height from the raw raster, never from the fitted plane. Ubhejane: 29 in-site posts, 49.7 m A–B broadly south, higher A/lower B, consistent with the observed overview contour trend and indicative SRTM south fall. Flat/discordant or incomplete data is unavailable. |
| AI-MAP-055 | Classroom positions need their own correct chainage | Implemented and inspected locally | C–D is 43.4 m through both traced footprints, separate from A–B. True intersection widths align to C–D distance. A–B carries no off-line classroom silhouettes. Same horizontal/vertical pixel scale for both charts; no inferred roof heights. |
| AI-MAP-059 | Contours hard to distinguish from property and drawing lines | Implemented in art and section plan | 330 m and 325 m overview lines visibly labeled olive/dashed on actual Ubhejane preview. Sector and section plan share the same fetched/cropped contour paths. These are coarse independent overview traces, not surveyed crossings; raw sampled section heights remain authoritative for its regional estimate. Select 02 — Sector Analysis and draw the Design map; contours appear automatically when available. |
| AI-MAP-058 | Technical arrows and legend overwhelm paid historical artwork | Implemented, locally inspected | Narrower tinted wind gradients preserve original arrow endpoints and regional dashed indication. Compact sentence-case map labels, light halos, restrained warm/cool sun paths, unified symbols and one-column grouped key. Concise assumptions, archive attribution and accuracy remain on the paid export; full notes remain on the exact reference. No new paint or duplicate charge. |
| AI-MAP-054 | Legacy contour source still uses an unsupported direct raster endpoint | Open for legacy route | The stored DEM-v1 and documented Terrain-RGB responses for this tile are byte-identical; that does not prove a general support contract. New raw section uses documented Terrain-RGB. Existing contour provider and legacy georeferencing are unchanged. |
| AI-MAP-060 | Baseline full-suite tests misread the actual prompt/coverage paths | Corrected contract checks | CI run 41612235606 had 6,350 passes, one failure and one TODO. The Structure Register line-end regex missed the real Phasing template interpolation; AST inspection found all three calls with the register on both baseline and raw branch. Test now checks the actual fourth argument at every call, preserving the minimum three paths. Sector's old regex assumed a `const` mask and no archive exception; current test requires the distinct archive coverage mask while retaining the ordinary Hybrid-only restoration contract and app-owned chrome. No production prompt gates or worker changes. Shape-sync TODO remains untouched. |
| AI-MAP-042/026/019/033/051 | Other layer fidelity, clipped canopies, oblique and archive-label editing | Open carried forward | This release does not certify the nine paid illustrations or the oblique view. Existing Base can rename its traced areas; historical fixed annotations are not yet linked to those edits. |

## Verification

- Ordered local typecheck clean; 633 focused render checks; 25 affected Sector/structure contracts; release-note checks separately; whitespace clean.
- Actual 1800×1273 section preview inspected: A–B and C–D, labeled 330/325 m overview contours, roof-width bands, dates/accuracy qualifications and no height exaggeration. Underlying Terrain-RGB z14/256 posts are approximately 8.5 m here. The original PDF has no usable recorded elevations. No known controlled site DTM was available.
- Actual reassembly of the same 3 November paid historical Sector inspected at full export and review size. Exact Sector PNG is byte-identical before/after this art-only pass (`d4d24dc39f424bc313a439d0f452c4056c3c32107594e63675c103937010f289`). Serialized frozen scene identical. These native results are not proof of the deployed owner flow.
- Current-head `rules`, `focused-render`, preview and normal owner export need live confirmation. Full suite runs separately; the earlier observed failure and unrelated expected TODO are recorded above, with no current full pass claimed.
- This changes the picture. PLAN_VERSION v93 and recipe r8 unchanged.

## Next continuation

Verify the current preview and production build, use the normal owner Sector controls to save/download the two-section sheet and freely reassemble the saved historical Sector, and inspect the outputs at phone/tablet/laptop viewport sizes. Keep prior versions with accurate review labels. Continue the distinct Earthworks fidelity, canopy, oblique and editable archive-label findings without buying duplicate artwork just to retest an app overlay.
