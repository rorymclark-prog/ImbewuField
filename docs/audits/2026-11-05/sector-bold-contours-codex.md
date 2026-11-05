# Sector bolder-contour continuation — 2026-11-05

- Auditor: Codex.
- Reviewed revision: `codex/sector-bold-contours`, based on released main `9c8289ff43ee2977904f3ba86de1c9923534b131`.
- Deployment: preceding rich C release verified as `9c8289f`; this follow-up's final release identity/checks are recorded on its PR and issue #35.
- Previous audit: [Rich C implementation and release](sector-rich-aerial-release-codex.md). Preserve AI-MAP-058/059/063/064 and the owner-gallery limit from the release ledger.
- Scope: illustrated Sector contour strokes and their key symbols only; reference research is a local comparison artifact, not copied app imagery.
- Evidence: actual native compositor from the same frozen owner scene/original paid artwork and cached raster; real browser inspection of three external reference images; typecheck and affected suites. No new AI generation.

## What was already done

PR #1274 released C's original artwork colour, richer app-drawn graphics and 2.5 m source-raster supplemental contours. Both production aliases served `9c8289f`. Rory then asked for ALL contours to be bolder and for real internet examples to compare. The native and existing AI artwork distinction remains explicit: this is a drawing finish over existing AI-rendered imagery, not a new paid painting.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-059 | Both main and supplemental contours need more presence over the artwork | Implemented and native inspected; release gates pending | Increase illustration main width from .0025W to .004W and supplemental from .0019W to .003W; increase the minimum from 3.5 to 4.5 canvas pixels. Both use existing dark contour ink, retaining different dashes and weights. Matching illustration key samples are heavier/darker too. Exact-map ink/weights, contour coordinates/elevations/spacing, source data, geometry and all other sheets are unchanged. |
| AI-MAP-058 | Compare stronger examples before a larger style decision | Research comparison prepared | Three actual publisher images visually inspected through supported CUA: Granvisio aerial bands, Permarchitecture illustrated sectors, Integrated Biotecture technical solar/wind rings. Their primary pages and hosted image URLs are in the local comparison; no external art copied into the repository or shipped app. These observations are visual-design judgement, not claims about this site's climate or bearings. |
| AI-MAP-063/064 | Double model analysis and stray rain marks | Retained | Raw-artwork polish gate unchanged; no extra model pass or loose illustrated rain marks. |
| AI-MAP-042/026/019/033/051 | Other-map fidelity, canopy, oblique and editable archive labels | Open, carried forward | No other map redesign. Physical device/print and a fresh provider generation are not certified. |

## Actual images and research

Local folder: `/Users/roryclark/Documents/Codex/2026-11-05/sector-review/`.

- `sector-C-bold-contours.png`: 3462 × 2448, SHA-256 `2b57f6a9c45ac996100dad1cca5b57fbd06179d2d26cc0fb10ecf75a59463405`.
- Final 1123 × 794 preview inspected; 1500 px and 390 px versions are provided for comparison. Supplemental lines now use the same dark ink as main lines, with their own shorter dashes/weight. Colour and line weight agree with the key.
- Native exact Sector remains byte-identical: `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`.
- Frozen scene JSON is asserted unchanged by the same harness. No point, height, new measurement, bearing or archive registration changed.
- `Sector reference comparison.html` loads publisher-hosted reference images directly and links their original context. The references are not user-site data or app assets.

Primary references visually inspected:

1. [Granvisio — Permaculture Designs](https://www.granvisio.com/permaculture-designs): actual sector-map aerial with large coloured bands/direct labels. Closest presentation reference to this app's illustrated-aerial approach.
2. [Permarchitecture — Listen to your land](https://permarchitecture.net/): soft illustrated sector diagram, trees/contours and readable outer bands.
3. [Integrated Biotecture — Our design process](https://integratedbiotecture.com/services/project-phases): technical site plan with separated solar/wind rings and detailed key. Useful hierarchy; its numerical site facts are not imported here.

Also inspected the classic black-and-white example credited by [Santa Cruz Permaculture](https://santacruzpermaculture.com/2021/02/zone-and-sector-analysis/) to Rob Allsop/Rosemary Morrow. Selected the three above for the visual shortlist, rather than claiming the classic diagram was the desired richer AI finish.

## Verification

- Typecheck: clean, before the final focused run.
- Focused-render: 639 passed, 0 failed with two workers. No test added/removed/weakened for this small paint-only adjustment.
- Sector/release-note checks and final notes stamp: recorded on the PR/ledger.
- Whitespace: clean. Full suite runs separately in CI; no new local full-suite pass claimed.
- Actual output: final native 1123 px sheet inspected; exact reference checksum unchanged. White archive gaps remain white; source positions and all analytical directions stay fixed.
- This changes the picture. PLAN_VERSION remains `v93` and recipe counters stay untouched. Reassemble existing AI artwork for the new finish at no AI charge.
- Owner free AI reassembly remains an explicit prior release gap: the available owner Chrome gallery held no original AI sheet. A free exact map was saved/exported/reopened successfully there; that does not establish AI reassembly. Rory is on his phone and was given the free action to use on its existing saved artwork.

## Next continuation

Push the completed paint-only branch once, record exact current-head rules/focused-render/preview and native evidence before guarded merge, then verify existing-host release identity. Keep the comparison references for Rory's review before a broader band/label redesign. Do not advance to Zones or silently pay for another AI painting.
