# Saved map recovery and device review, 26 November 2026

Codex reviewed production revisions `25086e69b` and `f68de314b` and continued the [twelve-view review](../2026-11-25/all-design-maps.md), [Water label comparison](../2026-11-25/paid-water-labels.md) and [Earthworks label comparison](../2026-11-25/earthworks-paid-callout-contrast.md). This pass covers the farmer's saved gallery and the public farm in Design Studio.

## Findings and disposition

| ID | Finding | Evidence and disposition |
| --- | --- | --- |
| AI-MAP-090 | The Water painting lacked directly readable callouts. | Verified on the canonical site. The signed-in owner’s original High-quality job produced a second downloadable 3462 × 2448 sheet. Six callouts identify the two tank sizes, taps, buried pipe, drip line and banana circle. |
| AI-MAP-091 | The saved Earthworks map put small labels at its edges. | The original provider artwork reassembled in Chrome shows two swale labels beside their midpoint, the western beds and the banana circle. Signed-in free recovery on the canonical site increased the gallery from six to seven maps. The new full-resolution Earthworks PNG and the full-screen gallery were captured. |
| AI-MAP-092 | Free recovery of a High-quality map in light mode suggested refreshing without identifying what needed to change. Completion also read like another paid generation. | Reproduced in the signed-in production gallery. Resuming the normal desktop print setting allowed Water to finish from its saved job. The change names the original print setting, guides light-mode and phone users and distinguishes incompatible renderer versions. The finish notice identifies the completed artwork as already paid. |

## Browser and location checks

Opened each of the nine exact sheets and Terrain in the live public example at 390 × 844, 820 × 1180 and 1440 × 960 in Chrome. At each size, opened the finished sheet, enlarged it, panned and returned to fit. The Record Plan opened at all three sizes and exported as SVG. These were Chrome viewport checks. Physical iOS Safari memory behaviour remains unverified in this pass.

Inspected the retained Ubhejane image pairs for Existing Site, Sector, Zones, Water, Earthworks, Planting, Structures, Whole Design and Implementation & Phasing. The Terrain example is a style study, the Record Plan is an exact vector export, and the oblique is previously purchased artwork accepted by the owner. The oblique shows the classroom to the left of the open play yard and road access on the right. Its extra interior fence remains visible. No new provider calls were made.

The deployed terrain endpoint returned elevation rasters for three test windows around Ubhejane, Cape Town and London. The application produced a distinct elevation profile, grade and angle for each window. Summer noon faced north in both South African examples and south in London. Only Ubhejane matched the regional KwaZulu-Natal wind table. These are comparisons between test windows, not measurements of a surveyed parcel.

Private site exports and the screenshot gallery are held in the owner's local ImbewuField App documents. The pull request and issue 35 record exact checks, previews and live revisions.
