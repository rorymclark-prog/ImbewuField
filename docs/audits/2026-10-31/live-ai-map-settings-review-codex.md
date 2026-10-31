# Live AI map settings review — 31 October 2026

- Auditor: Codex, following Rory's instruction to make every sheet work with suitable settings.
- Reviewed deployment: production `https://imbewufield.vercel.app`, independently verified main `9d6854ee6f1467e517ec0cb138a0dc4a18ef1fd3`; PR #1160 merged after current-head focused-render/rules/preview passed. Production deployment 41193536198 succeeded.
- Follow-up: `codex/ai-live-settings-review`, starting from that production revision. Only the Earthworks starting-underlay recommendation changes here; release head/CI belong to the PR and issue #35.
- Previous audit: [Per-sheet settings](map-sheet-defaults-codex.md), following [nine-sheet fidelity](ai-sheet-fidelity-codex.md). Carry AI-MAP-019/024–032 forward.
- Scope/evidence: three actual single-pass owner jobs through normal signed-in UI, exact masters, actual composed results/gallery/download, native reconstruction from each job's frozen scene and responsive viewer fixtures. No admin enqueue, provider bypass, worker change or new credentials.

## What was already done

PR #1160 deployed per-sheet recommendations and session memory, the visible/supported style choices and improved digging/bed inputs. The first exact save and each paid AI completion appeared in the normal gallery. All three frozen scenes contain identical saved items, lines, zones and reference polygons; their labels/underlays differ as selected. No measured geometry was edited for the tests. High AI quality, Reference Blueprint and top-down were retained.

## Actual output findings

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-025 | Earthworks previously showed finished planting and blue swales. | Fresh stage improvement observed | New plain-input result visibly shows nine bare beds, digging pits and two brown earthworks. This is an actual paid output, not the earlier input diagram. It is not an unconditional geometry/count certification. |
| AI-MAP-024 | Plain-input AI invents a roof over the recorded courtyard. | Still open; reproduced on Earthworks | Despite the tan paving guide and explicit brief, the new output roofs the courtyard. Water and Planting on the real aerial keep it open. Do not certify the plain Earthworks image as accurate. |
| AI-MAP-030 | Starting settings need to account for the failed plain-paper experiment. | Follow-up implemented; aerial Earthworks output unverified | Earthworks now prefers available own aerial, otherwise satellite, otherwise plain. Zones remains plain. The other eight settings contracts remain as previously recorded, including manual overrides/session memory and codes on Earthworks/Planting/Whole. This supersedes only the earlier Earthworks-underlay recommendation, based on real output evidence. |
| AI-MAP-026 | Beds can change in provider art. | Partial visual evidence; exact-footprint review remains open | Water and Planting both retain a recognisable nine-bed block; the model's texture is visible. Their exact keys/labels are app-owned. No numerical claim that every painted corner or plant count matches saved geometry is made. |
| AI-MAP-019 | Canopy can be cut at the boundary. | Partial improvement observed; open | New Planting visibly has several crowns beyond the boundary. Complete silhouette/foreground accuracy remains unverified; do not close the whole finding from a thumbnail. |
| AI-MAP-027/028/029 | Context/Phasing corrections and complete fresh nine-sheet evidence. | Still open | Fresh paid outputs exist for Earthworks, Water and Planting. Base, Sector, Zones styled view, Structures, Whole and Phasing still require the normal live check; the aerial Earthworks comparison is also unfinished. |

## Rejected correction, not shipped

A local paving-only overlay was tried against the already-paid Earthworks bitmap, with no new AI charge. Both candidates were inspected. Neutral procedural ground looked like a flat grey sticker; a licensed satellite reference was too blurry and did not blend. **Both failed the visual review and their code was completely discarded before this branch was committed.** No all-ground overpaint, courtyard patch or changed roof renderer ships here. The recommendation uses factual image context instead; that is a safer starting input, not a promise of successful model geometry.

## Verification

- Follow-up ordered checks: `npx tsc --noEmit` clean; focused rendering 606/606; affected notice/tour/release/UI 40/40; whitespace clean. The test expectation for Earthworks changes from plain to available imagery because the live plain-paper premise proved unreliable. All nine image-availability, route/authority and manual-override assertions remain; none was removed or weakened.
- Three normal single-pass paid jobs completed and were saved with their free exact masters. No new paid retry has been made. The originally described ceiling remains nine total paid test images. Zones uses exact app-owned polygons and does not need a paid pass for this style; its spare slot was proposed for the aerial Earthworks comparison, but that request has **not** been performed.
- Actual Water and Planting full-screen app results inspected on the laptop; Earthworks full-screen inspected and its courtyard rejected. The actual Planting download is preserved privately outside Git. Native reconstruction of all three from their own input/output/mask/frozen scene was inspected; no source data was changed.
- [Responsive measurements](live-ai-viewer-checks.json): three fresh outputs × phone 390×844 / iPad 820×1180 / laptop 1440×900 × root zoom 1 and 1.4 = 18 loaded, contained, no-overflow cases using actual full-screen JSX. Settled Planting phone/iPad screenshots inspected. This is viewport evidence, not physical iOS/Safari or authenticated mobile generation certification. Prior nine-exact/four-historical output fixtures remain in the previous audit.
- Chrome automation disconnected after these three tests. Browser operations stalled/reconnected repeatedly, then both tab access and native click failed. Read-only local viewer checks continued separately. A reconnect was requested; no authentication/security changes or admin-created paid jobs were used as a workaround.
- Full-suite CI for #1160 and the production merge was still running at this checkpoint. Required focused-render and rules had passed; do not call the full suite passed. Follow-up release gates must be recorded at its own exact head.
- **This changes the starting input/picture for Earthworks.** PLAN_VERSION v93 / recipe r8 remain unchanged. Saved geometry, old paid images, access/spending controls and species/advice are untouched. Four release-copy translations are [unreviewed drafts](live-map-settings-release-drafts.json).

## Next continuation

Reconnect normal owner Chrome access. Compare Earthworks with the available aerial once, then finish Base, Sector, Zones styled view, Structures, Whole and Phasing. Inspect each exact/result pair, preserve the old art, and stay within nine total paid test images. Keep the known courtyard/canopy/painted-geometry findings open until corresponding output evidence resolves them. Publishing this default change does not complete the all-nine quality audit.
