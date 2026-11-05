# Recorded shade cover over AI Structures — 2026-11-03

- Auditor: Codex, continuing the actual-image review.
- Reviewed revision: main `2583801ee3cad1c191e33e257df0af6891eda601` plus `codex/ai-shade-cover-recovery`.
- Deployment inspected: preceding terrain release verified live at `2583801`; this cover correction is local until its PR release.
- Previous audit: [Sector terrain and fresh failures](sector-terrain-profile-codex.md), carrying AI-MAP-036/042/026/019/033/051 forward.
- Scope: recorded shade-cloth foreground on app-owned locked Structures finishes/recovery. No other feature stamp, saved data, dimensions, geometry, provider request or paid gate changed.
- Evidence: actual 2 November and fresh 3 November paid Structures artwork, production-finisher recomposition, serialized-scene equality, executable drawing test.

## What was already done

The shared shade-tunnel prompt correction did not work: the fresh 3 November provider result still showed open beds at the Shade Tunnel leader. This is a real failed image check, not a missing prompt assertion. Preserve that result separately and reuse its raw artwork for free recovery.

## Findings and disposition

| ID | Problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-036 | Label/key promises a tunnel cover absent from AI artwork | Implemented; actual local output inspected | Reuse the existing cartographic cloth symbol and existing see-through alpha at the recorded centre, width, height and rotation. On the paid landscape, mesh/frame lines now span the beds while crops remain visible underneath. The cover is app drawn; do not attribute it to a successful AI reconstruction. Both actual paid candidates recomposed without another model request. |
| AI-MAP-055 | A corrective layer could erase all paid plants again | Covered by source and executable checks | Helper returns before allocation for non-Structures sheets or no shade objects; filters only existing shade-cloth IDs. It never restores beds, trees, other buildings or a whole feature layer. Existing broad-restamping prohibition retained. The old blanket `undefined` source assertion was rewritten to permit only this material exception, with its fresh failed-image reason and actual-helper dimensions/opacity/immutability test. |
| AI-MAP-042/026/019 | Earthworks rims, bed drift and northern pit clipping | Open | Fresh Earthworks remains rejected. Shade correction does not repair it. Needs a different texture-versus-factual-geometry contract, not another assertion that the prompt says the right words. |
| AI-MAP-033/051 | Rejected oblique and historical area-name editing link | Open | Neither is changed by this foreground material correction. Named Existing Site remains the approved default; Base already has independent rename/drag-label tools. |

## Verification

- Ordered typecheck clean, 628 focused render checks pass, whitespace clean. Notes/current-head rules, focused-render and preview evidence recorded on PR/issue #35.
- Production finisher recomposes registered actual raw artwork from each job's frozen scene. Saved scene JSON remains byte-identical. Native compositor output inspected at high quality, including net across the correct nine-bed area. Existing roofs, open courtyard, painted trees/crops, coop, hives and labels remain visible.
- Existing registration authority normalizes the provider's small aspect-rounding difference before finishing; no aspect check was bypassed or loosened.
- Full CI remains independent; no full-suite pass asserted. Native Arial fallback differs from browser fonts. Live free-reassembly and responsive checks remain release continuation work.
- This changes the picture. PLAN_VERSION v93 and recipe r8 unchanged. Scope is the current app-owned locked Structures finish; no claim about model-authored pages or the shelved second paid-polish branch.

## Next continuation

Release after current-head checks/preview, reassemble the existing paid Structures in the normal owner UI for no AI charge, inspect/download, then update the gallery while retaining the rejected candidate. Continue Earthworks with a new factual technical-feature contract and inspect a real result before calling it improved. Do not certify painted corners, canopy overhang or oblique fidelity from accurate labels alone.
