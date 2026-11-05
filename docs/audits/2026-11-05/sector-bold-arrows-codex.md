# Sector broad-arrow continuation — 2026-11-05

- Auditor: Codex, with coordinating-chat visual review of drafts 1/2 and the corrected bounds report. No physical-device acceptance is inferred from those reviews.
- Reviewed revision: `codex/sector-bold-arrows`, based on released main `1ae9ac2919bee8496ef820495e3bd5467e9d054a`.
- Deployment: preceding bolder-contour release was verified as `1ae9ac2`; this continuation's release identity and current-head gates are recorded on its PR and issue #35.
- Previous audit: [Bolder contours and external examples](sector-bold-contours-codex.md). Preserve historical findings and the original-device saved-AI-gallery verification gap.
- Scope: illustrated Sector wind/fall arrow painters, saturated palette, icons/sun markers, matching legend and label collision placement. Exact sheets, saved geometry, source bearings/contours/spacing, archive registration, AI artwork, provider/jobs/gates and other layers remain unchanged.
- Evidence: actual native compositor from original paid artwork/frozen scene and cached terrain; full export, 1123 px digital review and 390 px thumbnail; numerical map-canvas bounds report, typecheck and affected tests. No new paid generation.

## What was already done

The colour-preserving C artwork and stronger contours were released in #1274/#1281. Rory rejected the general internet references, then supplied a concrete earlier-looking sector image and explicitly preferred its bigger, bolder filled arrows. That reference supplies visual weight only: its completed-garden imagery, coordinates, labels and sun angles are not sources for the historical site.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-058 | Faint translucent wind streaks do not meet the requested broad-arrow reference | Implemented and native inspected; release gates follow | One shared opaque filled-arrow painter supplies map winds, card icons, downhill arrow and key. Broader shafts/heads, saturated teal/blue/orange, white casing and dark edges are a substantial shape/contrast change, not an opacity tweak. Wind bodies retain a dashed white regional-assumption spine. Original wind tails/tips and source bearings are unchanged. |
| AI-MAP-058 | Weak downhill arrow and small Sector markers | Implemented and native inspected | Downhill body/head strengthened on its original axis/endpoints; indicative dash follows the existing model. Sun end markers enlarged (.011W to .017W); compact noon medallions keep both seasons distinct without changing seasonal arc radii or computed rise/noon/set bearings. Fire icon and matching key enlarged; its parallel presentation offset clears the broad berg arrow without changing its bearing. |
| AI-MAP-059 | Enlarged labels can cover the 330 m contour caption | Reproduced and corrected in the actual draft | Draft 1 partially masks 330 m. Contour-caption bounds now join the same analytical obstacle register as arrows/sun markers. Draft 2 clears 330 m; final draft 4 also resolves all conservative card/mark overlaps. Contour lines, levels, density and exact rendering are unchanged. |
| AI-MAP-058 | Nearby-only label choices can fall back onto a large arrow | Reproduced and corrected | If normal offsets are exhausted, illustrated cards choose the nearest free bounded grid cell. The obsolete upper-left in-map-title reserve is removed only for the illustration, whose title is in the external key. Seven cards and four filled arrow bodies are within the native map canvas; final card-obstacle overlap count is zero. Exact label placement retains its previous path. |
| AI-MAP-063/064 | Duplicate model annotations and stray rain marks | Retained | No changes to raw-artwork polish handoff, paid-difference gate or no-loose-rain treatment. No paid render/queue action. |
| AI-MAP-042/026/019/033/051 | Other layers, canopy, oblique and editable archive labels | Open, carried forward | Remain on Sector before Zones. No other-map, physical phone/iPad, physical print or fresh-provider acceptance claimed. |

## Actual samples, bounds and provenance

Local folder: `/Users/roryclark/Documents/Codex/2026-11-05/sector-review/`.

- Before: `sector-C-bold-contours.png`, the previously released C finish, SHA-256 `2b57f6a9c45ac996100dad1cca5b57fbd06179d2d26cc0fb10ecf75a59463405`.
- Final: `sector-bold-arrows-draft4.png`, 3462 × 2448, SHA-256 `1de2e8e65ac648ec2eeffb2703fa1f82bac64ba6465f30b0003a25b3540cc8f2`.
- Review: `sector-bold-arrows-draft4-1123.png`, `-1500.png`, `-390.png`. The 390 px whole-sheet thumbnail confirms bold shapes remain visible; detail requires zoom and this is not an actual-phone UI test.
- `sector-bold-arrows-draft4-layout.json` records native map-canvas coordinates (2256 × 2448), card bounds and conservative obstacle hits, plus filled-arrow outlines including edge allowance. Seven cards, four major filled arrows, zero card-obstacle overlaps, zero cards/arrows outside the canvas. This is not a claim that intentional crossings between solar paths and directional marks are absent.
- Drafts 1/2/3 remain preserved at their stable filenames. Draft 1 has the caption defect; draft 2 clears it but has three conservative wind-card hits; draft 3 leaves one berg-card hit. Draft 4 resolves them without reducing arrow size.
- Exact native Sector remains byte-identical: `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`.
- Same frozen scene/original artwork and terrain inputs; serialized scene asserted unchanged. Measurements, site points, house/driveway/boundary, contour levels/spacing and true directions are not changed by painting.

The numerical probe instruments only the local extracted renderer, not production app code. It adds observation records without changing draw commands. The final actual image was also visually inspected; the bounds report alone is not appearance acceptance.

## Verification

- Typecheck: clean before final behaviour checks.
- Focused-render: 639 passed, 0 failed, two workers. Affected Sector: 22 passed, 0 failed.
- Those checks completed before an intentional environment interruption. Their completion is preserved in the chat tool results; temporary raw log files were removed by the environment. They were not restarted solely because of the interruption. Current-head CI and final notes checks follow the finished commit.
- The previous three-curve assertion encoded the rejected faint style. Its replacement executes the real filled painter and verifies source tips at screen/print scales, opaque visible body area, substantial head width and retained dashed provenance. All actual solar sweep/radius/marker-count assertions remain. A new regression forces a blocked label into the only free region and fails if the renderer silently paints its last overlapping candidate. No test assertion was deleted to conceal a failure.
- Whitespace: clean. Full suite is separate CI work; no new local full run/pass claimed. Nursery/root inline-help work remains separate.
- This changes the picture. PLAN_VERSION remains `v93` and recipe counters are untouched. No new provider render, schema/persistence, permissions, billing or worker change.
- Original-device free AI reassembly remains unverified: the available owner Chrome gallery lacked the original AI sheet. The previously verified exact-map save/download is not AI recovery. No storage injection, paid retry or connector credential workaround is used to hide that limit.

## Next continuation

Finish the release-note stamp, push the completed branch once, and record exact current-head rules/focused-render and a successful preview before guarded merge. Verify the normal existing-host production identity and keep the final draft paths stable. Do not describe a thumbnail or native preview as live owner AI reassembly or physical-phone acceptance. Source release evidence belongs on the PR and issue #35.
