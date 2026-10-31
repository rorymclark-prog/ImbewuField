# Map and report release continuation - 29 October 2026

- Auditor: Codex.
- Reviewed revisions: #1131 `534f0c086c6abae61d8b3c7c0481c3c137fbc7a9`, #1137 `cd6074d22362cb3db85c728fe07f9987e03a2375`, integrated with main `55b03506e`.
- Deployment inspected: production build-info serves `55b0350`; the two open PRs are not published.
- Previous audit: [Nine-map visual audit](../2026-10-27/map-visual-audit-codex.md), [PDF pagination](../2026-10-27/report-pdf-pagination-codex.md), [Production status](../2026-10-27/report-production-status-codex.md).
- Scope: release conflict reconciliation; source and completed GitHub check evidence.

## What was already done

Both push and PR test/rules jobs for the original two heads completed successfully on 27 October. Preview and Vercel checks also passed. #1131's full local result was 6078 passes, zero failures and one existing shape-sync TODO. The interrupted #1137 local log has no terminal result; its completed GitHub jobs are the full-suite evidence. Neither PR merged before main advanced through #1135 and #1138-1141.

## Findings and disposition

| ID | Problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| MAP-L01-L06; MAP-B01/K01/F01 | Earlier map layout/building findings | Retained; combined output needs verification | Retain shared wider frame, larger type, calibrated rulers, all traced roofs and current redraw selection. Main's white paper and per-species artwork preloading survive. Shared legend fill also uses main's paper authority. |
| REP-L01 | PDF heading pagination | Retained | PDF correction and regressions survive unchanged. |
| REP-S01 | Legacy production status differs from design | Follow-up remains on #1137 | Merge after parent integration; preserve explicit existing status and proposed fallback. |
| Release integration | Main advanced while completed releases remained open | Implemented; checks pending | Retain new AI controls/provider rounding, gallery focus/Escape, historical photo/map evidence and water scoping. Both callback test families remain. All native dictionaries and release histories are additive. |

## Verification

The first combined focused run passed 152/153. Its sole failure was the padding callback harness missing the newly shared PAPER dependency; the fixture now supplies the actual paper authority while preserving every physical-size and no-scaling assertion. This is a harness dependency correction, not removal of a failed check.

Final combined typecheck, full canonical suite, whitespace, preview and exact-head CI remain gates. Results belong on #1131/#1137 and issue #35. Earlier green results do not certify this integration. Current combined map output has not yet been rendered. This changes the picture: the earlier cream legend now follows main's white paper. PLAN_VERSION, saved geometry, species and source farming figures are unchanged. No paid generation or actual farmer Save occurred.

## Next continuation

Finish combined checks and a fresh rendered preview, then normal merge #1131 and production verification. Integrate #1137 with the finished parent, run its full gates, publish and verify the actual Ubhejane annual rows. Complete the private sample pack using actual saved maps/calendar; preserve the 3 October baseline dates and distinguish prepared demonstrations. Existing samples are available in the user's Reports folder; do not describe them as new field observations.

## Paid-composition main integration

Main advanced to `2d2ce46da` (#1143), which includes Rory's approved matched-check policy. The map release now integrates it: paid reassembly, protected foreground/roof ownership, independent boundary and AI review notices survive. The sole composer conflict keeps the measured/wrapped footer and uses main's canonical AI_MAP_REVIEW_NOTICE for the non-exact default; main's new regression rejects the old exact-count claim. Native histories and audit indexes remain additive; workflow, policy, queue and test command are imported from main unchanged.

The prior `2e020fd49` local full suite passed6116/0fail/1existingTODO. Its current white-paper preview was also rendered through the normal Tour UI: nine new selected sheets, nine unique PDF image operations, all3783x2675, all full keys and the complete retained Phasing rule inspected. Private proof is in Rory's 29October Release verification/map-preview folder. That output precedes this paid-composition integration; actual new combined output remains to be checked. The new map-only integration follows current AGENTS §1: typecheck, shared test:render, additional PDF/legend/typography/source-localisation checks, whitespace/note coverage, exact-head focused-render and rules, successful preview and visual inspection. Full suite continues separately and is not claimed passed for this changed head. The production-status follow-up remains subject to its own full-suite gate. PLAN_VERSION remains unchanged.
