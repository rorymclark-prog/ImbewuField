# Water sheet phone export — 24 November 2026

- Codex checked [Design Studio](https://imbewufield.vercel.app/design) at production commit `f967472f5a906b3a24926ab81ed58b1dfcf85930` after [the Glossy map review](glossy-map-browser-review.md). Findings AI-MAP-078 through 081 remain as recorded there.
- In a fresh 390 × 844 touch-enabled Chrome example workspace, open Glossy and draw Site, Sector, Zones, then Water. The complete rainwater budget and downhill-flow key were present by the time Water opened. The hosted preview had passed all nine sheets at three widths, but its guest run lacked terrain data. The live site exposed a case missing in that run.

## Findings

| ID | Problem | Change and evidence |
| --- | --- | --- |
| AI-MAP-082 | The Water sheet failed before it could be saved. Its six legend rows needed at least 399 pixels. The complete water budget occupied 785 of the 939 available pixels, leaving 154. The renderer only considered a single column for short Water inventories. | Measure the wrapped budget and size it inside the shared vertical space. Prefer one column for the key if it fits, and allow more columns if necessary. Keep every fact, source note and map label. |

## Verification

- Reproduced the production error and captured the actual example inventory and budget. Exercised the revised layout in Chrome with that content. The six rows fit in one column at 25 pixels and the complete budget at 19 pixels. The key had 490 pixels available. Checked the displayed final fact, the note and its lower margin.
- The typecheck, 54 affected checks, 677 render checks, release-note check and whitespace check passed locally. The full application suite runs separately in CI.
- The earlier release’s Earthworks and Terrain sheets were also drawn and enlarged on the alternative production address at phone, tablet and laptop sizes. The terrain sheet showed the measured downhill profile. No physical iOS device or new paid owner-site generation was used.
- This changes the Water sheet's presentation. Saved geometry and budget calculations are unchanged. PLAN_VERSION unchanged. Hosted and production outcomes are recorded on the follow-up PR and issue #35.
