# AI layer output review — 2026-11-02

- Auditor: Codex, following Rory's clarification that he wants AI versions of every layer.
- Reviewed revision: production main `8a12b3ef9747807cacbc2c6e4ff0255cf223fe81`; documentation branch `codex/ai-layer-output-review` starts from the same revision. No application source changes.
- Deployment inspected: `https://imbewufield.vercel.app`; `/api/build-info` returned `8a12b3e` during this review.
- Previous audit: [Live settings review — 31 October](../2026-10-31/live-ai-map-settings-review-codex.md). Carry AI-MAP-019/024–032 forward.
- Scope: normal owner sign-in, nine top-down layer results, the rejected Whole oblique, saved-map downloads and a private local comparison gallery.
- Evidence: actual paid outputs, normal application UI/downloads, read-only job metadata/frozen scenes, unchanged production compositor for two recoveries, local browser gallery checks. Private site images and job records are not committed.

## What was already done

PRs #1160/#1162 supplied the live defaults and input corrections. Earlier Water and Planting results remain the 31 October paid artwork. The initial delivery of nine **exact** plans did not fulfil Rory's request for nine AI versions; this review supersedes that delivery claim.

The 2 November Whole oblique was produced through the normal single-pass workflow. Rory rejected it because the site was rearranged. Its reference board does contain the correct saved layout, actual aerial and modelled contours. That input evidence does not excuse the inaccurate output. It is excluded from the new nine-map gallery and is not reported as a successful reconstruction.

Seven top-down requests were made on 2 November: Whole first, then Site, Sector, Zones, aerial Earthworks, Structures and Phasing. These follow Rory's renewed instruction for all AI layers. Together with the retained Water/Planting artwork, they provide nine layer versions. Counting the earlier failed plain Earthworks and rejected oblique, the inspected period contains eleven paid requests, not nine. No automatic paid retry or shelved second pass was used. Every request went through the normal account controls; no administrator enqueue, credentials change or permission bypass.

| Layer | Style / underlay | Delivered evidence |
| --- | --- | --- |
| 01 Site | Reference Blueprint / own aerial | 2 November actual app download; AI restyled ground and app-owned geometry. Footer defect below. |
| 02 Sector | Reference Blueprint / own aerial | 2 November actual app download; AI background with app-owned analysis. Not a claim that the arrows are model drawn. |
| 03 Zones | Satellite Overlay / own aerial | 2 November actual app download; model-authored comparison. Rejected scale/roof fidelity below. Reference Blueprint uses deterministic styled zones instead of a paid pass. |
| 04 Water | Reference Blueprint / own aerial | 31 October paid result recovered using its frozen scene and unchanged production compositor; previously inspected in the live app. Native font rendering can differ from a browser download. |
| 05 Earthworks | Reference Blueprint / own aerial | 2 November actual app download; bare beds, pits and brown swales, open courtyard. |
| 06 Planting | Reference Blueprint / own aerial | Retained 31 October actual app export, not regenerated. |
| 07 Structures | Reference Blueprint / own aerial | 2 November actual app download; tunnel depiction needs review. |
| 08 Whole | Reference Blueprint / own aerial | 2 November paid result recovered with the unchanged compositor and frozen scene. Native font rendering can differ from a browser download. |
| 09 Phasing | Reference Blueprint / own aerial | 2 November actual app download; AI background, app-owned symbols, phase pins and schedule. |

All jobs record `engine: openai`, `model: gpt-image-2.5-sunburst`, High quality and complete status. All eleven frozen records have one identical digest over saved `state` and `refLayers`. Rendering did not change measured geometry.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-029 | Missing actual AI versions across the nine sheets. | Nine outputs now available; quality audit remains open | Seven new top-down outputs plus retained Water/Planting. Each was visually inspected. Availability is not an all-nine accuracy or appearance pass. |
| AI-MAP-024 | Plain Earthworks invents a courtyard roof. | Aerial comparison improves this result; broader finding remains open | New aerial Earthworks leaves the courtyard open; the earlier failed plain result is retained separately. No promise that a later request cannot invent one. |
| AI-MAP-025 | Earthworks depicts finished planting instead of digging. | Fresh aerial stage improvement observed | The downloaded output shows bare beds, pits and brown excavation features. No claim that every pit or bed corner/count has been independently certified. |
| AI-MAP-019/026 | Canopy clipping and painted bed/feature drift. | Still open | Whole has several overhanging crowns and recognisable bed context. Exact painted geometry/counts remain unverified; do not close from attractive thumbnails. |
| AI-MAP-033 | Oblique changes site arrangement and building form. | Rejected; open | Correct reference board plus visibly inaccurate output and explicit owner rejection. Future work needs stronger geometric anchoring and a checked reconstruction, not another unreviewed prompt retry. |
| AI-MAP-034 | Zones Satellite Overlay invents a scale and changes roof form. | Rejected for measurement use; open | Its model-authored 20 m bar and hipped roofs differ from the exact plan's app-owned scale and recorded roofs. Gallery explicitly labels it as needing correction. Preserve exact zone/scale authority in any follow-up. |
| AI-MAP-035 | Paid Site illustration prints an Exact-plan footer. | Reproduced; open | `finishSiteSheet` calls `composeStyleSheet` without `aiArtwork: true`. Actual AI export says “Exact plan” / “No unsaved features added”. Correct provenance in a focused presentation follow-up; no farming data change needed. |
| AI-MAP-036 | Structures' Shade Tunnel label points into a bed block without a clear shade cover. | Needs correction/review | Actual output and exact label anchor inspected. Its recognisable cover/material is not demonstrated by the current art. |
| AI-MAP-037 | Phasing still reads as exact SVG symbols over an AI background. | Observed appearance limitation; open | `composePhasingSheet` restores app-owned design glyphs and schedule. The schedule must remain app-owned, but the current result does not deliver the same fully painted appearance as Whole/Planting. |
| AI-MAP-038 | Analysis-sheet picker help names the previous design layer. | Reproduced; open | Selecting Site/Sector/Phasing can leave Whole/Structures wording in the style/preview description. The queued sheet keys were correct; generation was not sent to that stale description's layer. |

## Verification

- Typecheck: `npx tsc --noEmit` clean. Full/render suites not rerun for this documentation-only record; no application, tests, workflow or rules changed. `git diff --check` clean.
- Output inspected: all nine full-resolution images; Site/Sector/Zones/Earthworks/Structures/Phasing are actual downloads; Planting is its prior actual export; Water/Whole are clearly identified recoveries. No AI input diagram is substituted for an output.
- Local gallery: nine AI cards, image view and exact comparison, with small thumbnails to avoid decoding all full-resolution sheets at once. All nine thumbnails loaded; all eighteen full-size AI/exact files returned successfully. Whole comparison loaded both images at 390 px phone and 820 px tablet widths with no horizontal overflow; the laptop gallery also had nine loaded cards and no overflow. Physical phone/iPad generation and Safari memory behaviour are not certified by this gallery check. The 31 October responsive evidence remains separate.
- No fresh oblique retry. No deployment or PLAN_VERSION/recipe change. This records new pictures and failures; it does not publish an application correction or certify the render pipeline fixed.

## Next continuation

1. Correct Site provenance and stale analysis-picker copy with relevant rendering/UI tests and rendered evidence.
2. Keep Zones' dimensions/scale and geometry app-owned while preserving useful AI artwork; do not treat the model-authored comparison as an accurate plan.
3. Review painted bed/pit footprints and cover semantics against saved coordinates before claiming fidelity.
4. Improve Phasing's artwork without handing task text, timing, instructions or measured geometry to AI authority.
5. Revisit Oblique only with geometry-led reconstruction and explicit site-match acceptance evidence. The current oblique remains rejected.
