# Sector supplied-reference styling — 2026-11-05

- Auditor: Codex; Rory supplied actual visual references and explicitly asked to retain the slope, slope percentage and contours.
- Reviewed revision: `codex/sector-reference-flow`, based on `805a5a49621ed4ab46ea0eed6008612c563435a4` (#1285).
- Deployment inspected: existing production was verified as `805a5a4/main`; this branch's preview and final identity are recorded on its PR and issue #35.
- Previous audit: [Sector release contracts](sector-release-contracts-codex.md), following [Broad arrows](sector-bold-arrows-codex.md). Original-device AI reassembly and physical-device acceptance remain open.
- Scope: illustrated Sector weather motifs, broader curved wind bodies, contrast cards and a clipped aerial veil. No other-layer, provider, worker, paid gate, schema, permissions, source geometry, farming-calculation or workflow changes.
- Evidence: actual attached images visually opened, actual native compositor at 3462 × 2448, 1123 px and 390 px review, numerical bounds and unchanged exact-map comparison. No new paid generation.

## What was already done

The earlier broad-arrow release retained the paid artwork and correct bearings. The new direct attachment makes the preferred additional treatment concrete: recognisable wind curls and rain, bold labels and stronger separation from the aerial background. Blue winter/gold summer identity is retained rather than copying the reference's yellow winter sun. Rory specifically wants all slope and contour information kept.

Both earlier reference images were opened visually, not merely described by another chat. Durable files in the local `sector-review` folder are `rory-bold-sector-reference-1-2026-11-05.png` (SHA-256 `b0bc3933db08f4deff65b56fd305d0c7fd668067551c07c8fe76c54d71ccd84a`) and `rory-bold-sector-reference-2-2026-11-05.png` (`e56a51b50f0e777313621d758531d80829aee1f1007d65206edd02a2f4e0cfd7`). The first is existing-condition context; the second adds design. The direct uploaded `codex-clipboard-ee6b5eb3-fb54-46ea-910d-dd12d261b03c.png` was also opened visually and copied to `rory-direct-sector-reference-ee6b5eb3.png`; it has the second reference's exact hash. Their proposed beds/tanks, scale numbers, geography and symbolic solar arcs are not sources for the actual historical site.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-065 | Solid arrows alone do not explain wind/rain as immediately as Rory's samples | Implemented and actual output inspected | Broader wind bodies with curved sides carry a recognisable white wind-curl or cloud/rain motif. One weather painter supplies those map motifs, card symbols and coloured key samples. Rain belongs only to the existing sourced cold-front record, with no new summer-storm bearing or scattered observational dots. Regional dashed provenance is retained beside the motif. Actual tips/tails and direction axes are unchanged. |
| AI-MAP-058/065 | Small labels and pale-ground competition | Implemented and actual output inspected | Slightly larger illustrated type on opaque dark green cards with light title/detail; colour accent and matching pictogram identify each energy. Existing 7:1 text/background contrast test passes. A modest aerial veil is clipped to known photo coverage; white page, key and unphotographed corners remain white. The original registered painting is retained and never sampled for geometry. |
| AI-MAP-065 | First native draft shades a wrong quadrilateral over the classrooms | Reproduced and corrected before push | Draft 1 exposed a repeated presentation crop when projecting archive corners against the resized frame. Draft 2 uses the existing `historicalPresentationPhotoPoint` authority with the original state/frame/refs. A regression executes the actual coverage expression and checks all four corners use the original authority, plus clip-before-fill and no-coverage/no-veil behavior. It would fail with the draft 1 projection. |
| AI-MAP-059/065 | Larger bodies/cards can obscure the 330 m caption or leave the map canvas | Verified in final native output | Draft 2: seven cards, four major filled arrows, zero conservative card-obstacle overlaps, zero cards/arrows outside native map bounds. Caption/solar/arrow claims remain in the same obstacle register. Full native and 1123 px output inspected; 390 px is only a thumbnail, not physical-phone acceptance. |
| AI-MAP-058/065 | Styling could alter slope, percentage, contours or season identity | Verified retained | Actual slope arrow remains S · ~12% from the same model. Same 5 m main/2.5 m supplemental source isolines and heights 325/327.5/330/332.5 m; no additional measurements invented. Blue winter `#2876AD`/gold summer `#D89408` and the shared sun painter remain on map/cards/key. Solar bearings and arc radii unchanged. |
| AI-MAP-042/026/019/033/051/063/064 | Other layers, oblique, source fidelity and original-device acceptance gaps | Carried forward | This remains a Sector presentation change. No physical phone/iPad, fresh-provider fidelity, saved paid-sheet reassembly/export or other-layer acceptance claimed. The available owner Chrome gallery previously lacked the original AI sheet; no storage injection or paid retry. |

## Verification

- Typecheck: clean before final affected tests.
- Affected tests: 53 passed, 0 failed (`sector-cartography`, `sheet-typography`, `update-notices-localization`).
- Focused render: complete shared group, 639 passed, 0 failed, two workers. Whitespace clean; final release-note stamp/check follows implementation commit.
- Full suite: separate CI, not claimed passed. Current-head rules/focused-render and successful preview are required before guarded merge.
- Final native: `sector-reference-flow-draft2.png`, 3462 × 2448, SHA-256 `35eb824a61cb93125eeae1b21e5b1c34b9d0fb663d34cf380f956092729a4692`; 1123/820/390 px review copies and `sector-reference-flow-draft2-layout.json` are preserved locally. Draft 1 remains separately preserved with its recorded coverage defect.
- Exact native: independently recomposed as `sector-reference-flow-exact-check.png`; SHA-256 `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d` matches the prior exact baseline byte for byte. Frozen scene serialization is asserted unchanged by the native harness.
- No assertions removed to hide failures. The previous no-veil style claim is explicitly superseded by the supplied reference, while source-copy/no-shift/no-pixel-rewrite coverage remains and a real coverage/crop regression is added. Curved endpoints are now recorded by the existing arrow geometry check; original tip, opaque area, head width, dash provenance and solar assertions remain.
- Native release descriptions in all four chunks are paired with English and recorded as unreviewed machine drafts in `sector-reference-flow-release-drafts.json`; first-language review remains open.
- This changes the illustrated picture. PLAN_VERSION stays `v93`; recipe counters and saved geometry remain untouched. Heavy checks/native renders were sequenced and no own server/browser was started.

## Next continuation

Record the finished SHA and exact current-head CI/preview on the PR and issue #35. Merge only after the focused gates pass; verify both existing production aliases. Present the actual draft 2 image rather than the earlier plain-arrow sample. Preserve the original-device recovery and physical-device gaps explicitly.
