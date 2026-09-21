# C03 — Build and review a design

Seven-step English guide at `/student/guides/design`. Baseline `e36e2d433df5f97854921d5a67fac490aa8dd0c9`. No animation changes, species edits, geometry migrations or PLAN_VERSION changes.

## Source checks

- `components/design/DesignWizard.tsx`: Base, Sector, Water, Earthworks, Zones, Planting, Structures, Review, Glossy; layer presence is not proof of design accuracy.
- `components/design/StepGuide.tsx`, `lib/design-substeps.ts`: task expansion, Do this tool selection, checks derived from drawn content. The guide does not repeat palette dimensions or placement suggestions as agronomic recommendations.
- `components/design/SectorSummary.tsx`: coordinate/model and regional context; source/missing-data notes; compare with field observations.
- `app/design/page.tsx`: local save result, asynchronous cloud push, Undo/Redo and visibility by step. Saved confirms local write, not cross-device arrival. No storage clearing recommended in this companion.
- `components/design/DesignCanvas.tsx`: body movement differs from width, height, corner and rotation controls. Invisible touch targets can overlap a small selected bed at fit scale; zoom in and verify dimensions.
- `components/design/DesignGlossy.tsx`: deterministic Design Map path, sheet selection, underlay/labels/quality, saved renders, current versus saved versions, selected-map PDF/image download. No AI-render flow invoked.

## Actual sample workflow — 21 September 2026

Tour stop2 → Try it now opened Ubhejane Creche on Planting with Saved visible. The selected sample Bed1 showed width1.5m and height4m. Two attempted drags at fit scale hit its width handle instead; Undo restored width1.5 each time. This observation is the reason the guide explicitly distinguishes body dragging from resize handles.

Zoomed in twice, dragged the body of the unselected sample Bed3. Its position changed and width1.5m/height4m remained. Undo visibly restored the original position. All geometry edits were in the disposable sample and were undone. No real farm changed.

Opened Review and observed all relevant layer visibility restored. Opened Glossy → Preview & Export; selected existing default Whole/Plain paper/High/Codes settings and clicked Design Map. A deterministic saved render appeared, Saved maps changed from0 to1 and Export & Share became available. Opened the map full screen and inspected it; no AI or animation generation used.

Export & Share → selected Whole design → PDF → Download(1) produced the actual `ubhejane-creche-whole-design-design-map.pdf` in Downloads. It has one landscape page (917447bytes at the time of the test). Rendered and inspected the full page: site title, whole-plan layout, legend, north arrow and scale are present and match the preview. Some tree illustrations cover nearby bed edges and no individual plant codes are visible on this whole sheet despite the Codes control being selected. This is not claimed as a complete cartographic quality pass; the tutorial asks learners to check needed labels and the appropriate sheet before use. No recipient was contacted.

## Remaining verification

The actual walkthrough establishes sample edit/Undo, deterministic rendering and PDF delivery. Real-account local reopen/cloud sync, every design step/tool, every output sheet, physical-phone editing and professional site suitability have not been newly verified. Guide preview, phone readability, exercise feedback and release checks are recorded in issue35. Narration, translation and learner review remain open.
