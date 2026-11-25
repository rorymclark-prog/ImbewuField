# Design map review and Record Plan bed numbers — 25 November 2026

Codex reviewed the nine Design Studio sheets, Terrain & Sections, Record Plan and the separate Whole Design oblique. The Record Plan change is based on `a52824cc4368e0502ceabc2788222ddaa03d4320` (`codex/record-plan-bed-numbers-20261125`). Production reported build `7400812` during the initial audit. The signed-in production render was downloaded and inspected on 24 November. The browser opened for this follow-up requested sign-in when reading saved reports.

## Previous evidence

The [previous full-map review](../2026-11-24/full-map-review.md) covers 33 production example views at phone, iPad and laptop sizes. [Earthworks materials](../2026-11-24/earthworks-banks.md) and [the Water budget](../2026-11-24/water-phone-budget.md) have separate focused checks. The example and the owner's design have different inventories. Private site images remain in the owner's local gallery.

## Findings and disposition

| Sheet | Observed on the available site artwork |
| --- | --- |
| Existing Site | Separate roofs and the eastern road are visible. Illustrated vegetation is denser than on the source aerial. Use the photograph for existing planting. A named-area study and country locator are linked separately. |
| Sector | The earlier artwork has low-contrast marks on the historic photo. The approved dark surround and fine boundary with round posts and the circular Editorial treatment are separate samples. Regional wind and computed sun remain separate in the key. |
| Zones | Zones 0–3 occupy the expected coloured areas. The western bed group has little visible detail under the cover. The reserve context study puts neighbouring land in an inset. Its formal boundary is unknown. |
| Water | The northern tank pair is visible. Some blue pipes are hard to trace over the vegetation. The older AI sheet and the exact export also carry different catchment figures. A comparison of quantities requires the same saved revision. |
| Earthworks | Nine western beds are distinguishable. The middle swale has two raised-looking sides and the banana ring is narrow. AI-MAP-081/082 have ground-dependent drawing guides. Their effect on a fresh paid site illustration remains unverified. |
| Planting | The bed group, individual plant codes and crowns appear. Overlap in the southern tree rows prevents a reliable visual count. Refer to saved placements when checking spacing. |
| Structures | Gate, coop, nursery table and apiary have callouts. The shade cover is clearer in the exact sheet. The older recovered AI export predates later site edits. |
| Whole Design | The plan shows two roofs and four southern plots. Surface detail in the open yard and route contrast remain approximate in the saved painting. |
| Implementation & Phasing | Six numbered pins connect to six schedule stages. The long instruction column requires zoom on a phone. The retained paint belongs to an earlier revision. |
| Terrain & Sections | The compared site study includes the proposed boundary, elevation-labelled contours, separate downhill and cross-site profiles and both percent and degrees. The relief is a regional estimate. The illustrated study has separate provenance from the nine saved AI exports. |
| Record Plan | AI-MAP-087. The key promised nine numbered beds. Only the last number appeared on the plan, well away from its row. The new fallback places the number on the long axis of a narrow bed and staggers neighbouring numbers when labels compete. Saved bed identity, scale and geometry are preserved. |
| Whole Design oblique | AI-MAP-085/086. On the paid production export, the classroom long axis and eastern road agree with the site reference. Planting hides the short gate-to-yard approach and the play slab is drawn as a detached rectangle. No measured driveway width is available in the reviewed reference. |

AI-MAP-026/042/069 remain open for model fidelity on new jobs. The guide study, archived artwork, app-drawn labels and last paid oblique each appear with their source in the private review.

## Verification

- Rendered the actual Record Plan painter before and after from the same saved frame, items, zones and lines. Read the output SVG and inspected the two rasterized drawings. The original plan had only bed 9 plus a separate number 1 in the key. The corrected plan has all nine numbers over their respective rows.
- Ran a separate synthetic regression at two rotations using custom bed numbers. The previous renderer missed bed 42. The corrected renderer keeps each saved number on the sheet.
- Opened all twelve comparison pairs in Chrome at 390 × 844, 820 × 1180 and 1440 × 960. All 72 image placements decoded and fit the width. These are responsive evidence-gallery checks. The previous public app checks and the saved owner artwork are identified separately.
- Typecheck, 31 report figure and localization tests, 687 focused rendering checks, release-note drift and whitespace checks passed locally. This change only affects how the Record Plan draws a label. Record Plan is an exact drawing.
- Private comparisons are in the local “Map review 2026-11-25” folder. No new paid jobs were submitted. Full-suite CI, hosted verification and deployment are tracked in the PR and issue 35.

## Next continuation

The highest-priority AI checks are the width of the banana-circle bank, the downhill-only swale bank, water-line legibility and the oblique entrance. Match the saved scene revision before comparing quantities on a new render. Record field-confirmed access and elevation only when supplied.
