# One Surface — killing the trace-then-redraw duplication

_Fable 5 architecture analysis, 2026-07-15. The owner's problem: "I drew polygons on the live map, then have to draw them again in the Design Studio — it's duplication of effort."_

## Root cause (it's the DATA MODEL, not the render engines)
The map→Studio bridge is a **lossy funnel**. `mergeFarmShapesIntoDesignState()` classifies every traced shape into typed layers, but `app/design/page.tsx` then collapses them to **just 3 non-editable reference rings** (boundary / house / driveway), rendered `pointer-events:none`. The farmer's traced **veg garden / dam / tree belt are not rendered at all** in the Studio → he must re-draw them. Nothing flows back either. There are **5 geometry stores across 4 canvases** in 3 coordinate systems, wired by one-way bridges. That's the duplication, mechanized.

## Decision: live-map-under-SVG (NOT everything-on-mapbox)
Put a **live mapbox basemap underneath the Studio's existing SVG editing layer**, camera-slaved by a **single affine transform**, with all geometry migrated to lng/lat as one source of truth.
- **Why sound:** at bearing/pitch = 0, Web Mercator is closed under pan/zoom as one scale+translate — and the Studio's own projection math (`lib/design-canvas.ts`) IS mapbox's Mercator math, losslessly convertible today. The whole SVG tracks the map by updating one `<g transform>`; no per-vertex reprojection during gestures.
- **Lag fix (already proven in-repo):** update the transform **imperatively** in `map.on('move')` (not through React state — that's what caused the observed one-frame lag; native Markers don't lag for the same reason). React re-render only on move-end.
- **Why not everything-on-mapbox:** would regress the loved SVG editing (emoji discs, `foreignObject` labels, resize handles, mid-draw vertex grab). mapbox-gl-draw is a ceiling (repo already has scar-tissue workarounds). Map.tsx is 3,863 lines, the most-guarded file — don't grow design into it.
- The Studio's ~250 lines of hand-rolled pan/pinch/wheel get **deleted** (the map's native camera replaces them). The cached snapshot stays as an **offline/data-saver fallback**.

## Single source of truth
- **Traced reality** (boundary, parcels, water, roof, driveway) → `FARM_KEY` FeatureCollection (lng/lat), synced by user-sync.
- **Design intent** (zones, elements, lines) → `DesignCanvasState` migrated to lng/lat.
- Both **editable in the one surface**; "adopt into design" is one tap and creates a design object **from** the traced geometry with a `sourceFeatureId` back-link — never re-drawn, and shows "trace changed — update this zone?" instead of diverging silently. Design flows back to the map as a read-only "My design" layer.

## Phased migration (each ships independently; rollback tag `baseline-pre-merge-20260715`)
- **Phase 1 — "everything you traced is already in the Studio" (the felt-duplication killer; SMALL, ADDITIVE, ZERO Map.tsx risk).** Stop collapsing traced layers to 3 refs — render ALL near-site traced layers in `DesignCanvas` as visible, tappable shapes; tap → "Use in design" adopts the geometry (via the existing `project()`), stamped `sourceFeatureId`. **This alone answers the complaint.** _← DO THIS FIRST._
- **Phase 2 — geo-native design state.** Store points as `[lng,lat]`; version the storage key + Firestore doc so a stale PWA client can't misread. Verify round-trip drift < 1cm.
- **Phase 3 — design flows back to the map (read-only).** A "My design" GeoJSON layer on the farmer map. Near-zero risk; builds trust in the one model before the weld.
- **Phase 4 — THE WELD (the risky phase).** 4a: mount a live basemap under the Studio, camera-slaved SVG, snapshot fallback + kill-switch flag. 4b: extract the reticle trace engine + FARM_KEY persistence out of Map.tsx's `recompute()` guard-web (`restoredRef`/`tearingDownRef`/`applyingRemoteRef`/`mergeReadyRef` — each guards a past "20 min of drawing gone" bug) into `TraceTool` + `lib/farm-shapes.ts`, **verbatim guard semantics**, 3-stage extraction, rolling 3-deep FARM_KEY backups, fallback link. This is where the real regression risk lives.
- **Phase 5 — retire duplicates.** Port the AI producer styles into `DesignGlossy`; `/facilitator` becomes a shell over the Studio; strip `GeometryDesignStudio` to its plan/report lib.

## Critical files
`app/design/page.tsx` (Phase 1 + 4a host) · `components/design/DesignCanvas.tsx` (render traced layers; camera-slaved transform) · `lib/design-canvas.ts` (Phase 2 geo-native v2) · `components/Map.tsx` (Phase 3 layer; Phase 4b extraction source) · `lib/design-studio.ts` (classifier/importer, `sourceFeatureId`).
