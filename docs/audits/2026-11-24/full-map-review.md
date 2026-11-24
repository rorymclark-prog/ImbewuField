# All map layers and the oblique guide — 24 November 2026

- Reviewed by Codex on `codex/all-layer-map-review` from production commit `2da33a33ae0551c23e154e37dfbf20c3e6e7523a`.
- Follows the [Glossy browser audit](glossy-map-browser-review.md), [Water phone audit](water-phone-budget.md) and [Earthworks bank audit](earthworks-banks.md).
- Chrome opened the public example at https://imbewufield.vercel.app/samples/farm through Design Studio. All nine sheets, Terrain and the separate Record Plan opened at 390 × 844, 820 × 1180 and 1440 × 960. The ten raster sheets also zoomed and panned. The laptop Record Plan exported as SVG. These were browser viewports, with touch emulation on the two smaller sizes.
- Separately compared the owner's nine archived AI outputs with their corresponding archived exact sheets. The public example has different saved quantities. Its screenshots cannot attest to the owner's counts. Dates and provenance are included in the local review gallery.

## What the sheets showed

| Sheet | Exact, AI or additional evidence inspected |
| --- | --- |
| Existing Site | Existing buildings and ground names are readable. Dense illustrated vegetation deserves comparison with the original aerial before being taken as an existing planting. |
| Sector | The older retained painting has faint marks. The later thin-post boundary sample and circular Editorial Atlas sample retain the proposed extent and distinguish regional wind from computed sun paths. Separate saved Cape Town, Pretoria and Hoedspruit location sheets and profiles have different aerials and values. |
| Zones | The saved sheet has numbered coloured areas. The western shade-cover depiction still needs comparison with its actual footprint. The off-site reserve inset is a separate design study. |
| Water | The earlier paid illustration has less pipe contrast than the exact sheet. The existing phone-budget correction is still visible in the current public example. |
| Earthworks | Nine western beds and the saved pits are easier to count on the owner's exact plan. The earlier AI material needs review against the approved downhill bank, broad banana ring and tree basin. |
| Planting | The retained illustration shows canopy structure. Overlapping crowns and adjacent beds make exact counts difficult to confirm from the painting. |
| Structures | Inspected the earlier recovered illustration with app-drawn shade mesh. Its site revision predates later edits. |
| Whole Design | Separate roofs, paved yards and spacing between bed groups need to survive illustration. A real roof-count contradiction was found in the model brief. |
| Implementation & Phasing | The saved result includes its app-drawn schedule and step numbers. Its archived painting is from an earlier revision. |
| Terrain & Sections | Opened the current relief and profile view at all three sizes. Inspected a separate illustrated Ubhejane sample with elevations, slope percent and degrees. |
| Record Plan | Opened the exact drawing at all sizes and exported the SVG. This plan has no AI rendering path. |
| Oblique | The earlier paid site image shows a larger joined roof form and redistributed beds. Drew and inspected a new four-panel input with the production painter, owner-traced design, registered aerial and cached terrain. |

## Findings and disposition

| ID | Finding | Disposition |
| --- | --- | --- |
| AI-MAP-078/079/080 | Mobile zoom, Terrain naming and contour label fit. | Retained. The ten zoomable sheets opened, enlarged and panned on each viewport. |
| AI-MAP-081/082 | Swale and basin appearance, plus Water budget on mobile. | Retained. The Whole/Planting material briefs now describe the broader banana-circle rim and the flush uphill swale shoulder where applicable. A banana clump and a compost circle have separate meanings in the overlay brief. |
| AI-MAP-083 | The AI could receive a one-house instruction for a site with multiple traced roofs, and an assumed country unrelated to the saved location. | The brief uses the same roof footprints as the map and the supplied site evidence. Covered by a fixture with a repeated main footprint and a second building at another location. |
| AI-MAP-084 | The oblique reference supplied only a top-down layout. Faint staple plots on paper made the four southern plots difficult to distinguish. | The guide shows the saved plan and the same footprints foreshortened for its south-facing camera position looking north. The photo and terrain remain separate. The text identifies roofed and open areas and lists bed coordinates relative to the top-left panel. Stronger crop fills on the two paper model guides made each of the four southern plots visible in Chrome. |
| AI-MAP-085 | Rory identified the classroom turned broadside in the third AI study. | The saved classroom measures about 8.0 × 5.5 m along and across its 179°/359° long wall. The smaller store runs 91°/271°. Use the shared longest-wall calculation on undistorted ground coordinates, project the roof polygons, and enlarge the registered main roof inside its traced corners. A targeted edit and an independent fresh generation from the final application input both show the short classroom end facing the southern camera and a receding north–south ridge. Ground dimensions come from the trace. Facade, height and roof finish in the illustration remain approximate. |
| AI-MAP-026/042/069 | Fresh site AI may still move beds, merge roofs or hide pits. | Open. Retained paid artwork and a corrected input board cannot verify the outcome of a new production job. The private account connector requested reconnection. |

## Verification and handoff

Typecheck, all 202 targeted prompt and oblique checks, 46 solar/cartography/underlay checks, all 686 canonical rendering checks, release-note drift and whitespace checks passed locally. The feedback loop included a second browser rasterization after discovering faint fields. A standalone model sample using the revised board showed distinct roofs and four foreground plots, but moved beehives to the back and tanks by the classroom. The next board marks every in-frame tank and hive at its projected ground position and gives the prompt the matching location register. In a second sample, the two rear tanks returned to the north, the smaller tank appeared near the middle and all three hives appeared along the southwest edge. The shade tunnel still sat beside the western bed group, and the main roof proportions and exact bed spacing still differed. A final pass computed bed-centre inclusion in the saved, rotated shade-tunnel footprint. All nine western bed centres are inside it. The third standalone image put mesh above those beds and retained the near hives and rear tank pair. It still broadened the main roof and its yard. Roof and bed geometry in a new provider job remain unverified. These studies use the chat generator, separate from the private app job. The stronger field fills changed 49,097 pixels across the two plan views on the same board. The local gallery opened all twelve entries at each of the three widths. Current-head CI, hosted preview and production verification are recorded in the PR and issue #35.

This changes the picture for newly generated artwork. Saved geometry and `PLAN_VERSION` were preserved. The private evidence is in Rory's ImbewuField App / Full map review 2026-11-24 folder. The public repository contains no site screenshots. Follow up with a new authorised Ubhejane oblique and Earthworks job through the production app. Compare the nine beds, four southern plots, two roofs and open play area directly with the matching saved revision.
