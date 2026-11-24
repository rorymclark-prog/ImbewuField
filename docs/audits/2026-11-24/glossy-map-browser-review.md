# Glossy map inspection in Chrome — 24 November 2026

- Reviewed production revision `2c06e05421a2a5aaf566953edb2b6a84bdc7c990` at [Design Studio](https://imbewufield.vercel.app/design). The desktop Chrome session and a separate test browser both opened the live app.
- Compared with the [Editorial Atlas review](../2026-11-07/editorial-map-style-codex.md) and [contour caption correction](../2026-11-07/editorial-contour-captions-codex.md). Both changes have since merged.
- The public example workspace supplied the **exact** sheets for this check. It is a demonstration layout at Ubhejane, not the owner's saved design. Both production addresses showed zero private saved maps in this browser.

## Results

| Finding | Reproduction | Correction and evidence |
| --- | --- | --- |
| AI-MAP-078 | A full landscape sheet was only 366 CSS pixels wide on a 390-pixel portrait phone. The full key was visible but its type was too small to read. Tapping it dismissed the viewer. | Add a separate enlargement control for exact, saved and illustrated sheets. Native scrolling, keyboard and mouse drag reach the sheet edges. Fit view retains tap-to-dismiss, Escape and Close. A first fourfold enlargement cropped the left side of the Editorial key at the far-right scroll limit. The revised size shows the complete key column. |
| AI-MAP-079 | A newly drawn full-screen sheet could identify only the farm. The sample Terrain gallery also explicitly promised a C–D building section although only the A–B downhill section was present. The lone slope summary sat far below its graph. | Name the selected sheet in the viewer. Name Terrain neutrally when saving or displaying the historical title. Place the lone summary with its graph and keep two-profile spacing when both sections exist. |
| AI-MAP-080 | The 330 m contour caption extended from the photograph onto the white margin of the sample Terrain page. | Use the existing complete-caption fit check against the property and displayed image. Preserve the line even if no complete caption fits. |
| AI-MAP-081 | In the retained Ubhejane Earthworks illustration, both swales copied the exact plan’s hard casing and crossbars and looked like timber. The polish brief also called for a grassed bank on a pre-planting sheet. | Give the AI a softly shaded cut and spoil bank at the saved route and width. Use the digging-stage material brief for the illustration, overlay and polish paths. Exact setting-out symbols still draw separately. |
| AI-MAP-069 / 026 / 042 | New model material and geometry fidelity, including bed counts and roofs. | Still open. Retained AI examples and the previously assembled Editorial sheet can be inspected. They do not verify fresh model output, an oblique projection or the owner's paid job path. |

## Verification

- In production Chrome, generated or reopened all nine example sheets and the separate Terrain & Sections sheet. Captured full-screen views at 390 × 844, 820 × 1180 and 1440 × 960. Sheet 05 displayed the demo's seven beds, five tree pits and one swale. Terrain showed the downhill grade in percent and degrees and the elevation endpoints.
- Looked at the retained AI sample set. Ran the updated viewer JSX and CSS in Chrome with existing Reference Blueprint, Editorial Atlas and Earthworks artwork at all three sizes. Checked stable image source, fit/detail switching, tap handling, complete legend access and measured a 110-pixel mouse drag. The isolated viewer check used the real saved bitmaps, not a new AI generation.
- Compared the exact and AI-input swale painters in Chrome. The first revision ended abruptly. A second introduced visible bands between brush strokes. The revised guide has feathered tips and continuous soil shading around the bend. The regression covers measured width, endpoints, crossbars and the separate exact convention.
- A separate reference-guided AI edit of the retained Ubhejane artwork showed two dry excavations with irregular spoil. It is a material sample. Several pits by the banks became less distinct, so this sample is insufficient to verify setting-out fidelity. The in-app provider path still needs a fresh authorised site render.
- Typecheck passed. All 120 affected checks and all 677 canonical rendering checks passed. Whitespace and release-note checks passed. The full application suite runs separately in CI.
- Local captures are in Rory’s **ImbewuField App / Map browser audit 2026-11-24** folder. Private site images are kept out of the public repository. No physical iOS device was tested.
- This changes the viewer and Terrain sheet presentation. New AI Earthworks artwork receives a different drawing guide and material brief. This changes the picture. Coordinates, contours, elevations, profile calculations and AI access are unchanged. PLAN_VERSION unchanged.

## Release verification

Branch `codex/glossy-browser-polish-20261124`. Record hosted preview, merge and live checks in issue #35 and the PR. New provider fidelity still requires an authorised saved-site run and comparison with the exact layout.
