# Historical area names — 2026-11-03

- Auditor: Codex, following Rory's request to see the existing site's different areas named.
- Reviewed revision: production `56d6ebad098311cdd179ff29cbf3b1ff3968715e` plus `codex/historical-area-labels`.
- Deployment inspected: historical baseline verified live at `56d6eba`; named-label release verification belongs to this branch's PR.
- Previous audit: [Historical baseline](historical-baseline-codex.md), carrying AI-MAP-019/026/033/034/036/042/048/049 forward.
- Scope: historical Site label presentation only, using the existing frozen label-mode field. No new schema, measured geometry or provider execution changes.
- Evidence: actual native high-quality sheet, live baseline browser export and executable compositor tests.

## What was already done

PR #1179 is deployed. The normal owner flow saved the historical Existing Site exact sheet; its numbered landmarks were inspected full screen in production. The historical Sector exact sheet was also saved in the normal UI. A single historical Sector AI request is now in progress and remains separate from exact photographic output. Fresh Zones/Phasing gallery entries retain their stated limitations.

## Findings and disposition

| ID | Problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-046 | Number-only markers require repeated reference to the key | Named variant implemented and visually inspected | Area names use short leaders to the two classrooms, slab, play area, toilet, tank, road and fence. Roofs/play equipment remain visible. A Numbered key option retains the compact alternative. Named inventory has no misleading category swatches. |
| AI-MAP-050 | A label choice could recover another cached picture | Implemented | Historical Site includes its existing label-mode suffix in its exact cache key; frozen jobs pass their saved label mode through Site finishing. No saved positions moved. |
| AI-MAP-051 | User needs to rename areas during design | Existing canvas capability confirmed in source; historical linkage remains open | Base ground features already carry `name`, `labelDx`, `labelDy`; tap a ground-feature label to rename, drag it to move only its label. Historical photo facts are archive annotations and are not automatically converted into measured ground polygons. Do not pretend those names are already editable historical photo facts. A generic annotation/editing connection needs separate implementation and persistence checks. |
| AI-MAP-048/049 | Historical AI quality and terrain profile | Open continuation | One normal owner historical AI Sector render started. Terrain sources investigated; no high-resolution ground survey found. Neither label readability nor exact overlays certify AI painting or survey accuracy. |

## Verification

- Ordered clean typecheck; 624 focused render checks pass; whitespace clean. Release notices/current-head CI and preview results are recorded on the PR.
- Named high-quality output inspected. All eight names have white backings and leaders; no plaques cover the roof/slab/play features. The numbered alternative remains in the actual compositor. Native Arial fallback may differ from browser fonts.
- Regression test exercises real drawing helper, checks all eight labels/backings and verifies archive facts remain byte-for-byte unchanged. Existing numbered/crop/coverage tests retained.
- This changes the picture. PLAN_VERSION v93 and recipe r8 untouched. No physical iPhone/iPad claim; responsive release checks remain continuation evidence.

## Next continuation

Release named labels after required current-head rules/focused-render/preview. Inspect the paid historical Sector when it completes. Connect editable user area naming to historical annotation presentation without mutating measured geometry during rendering, using the established canvas naming/offset contract and full persistence checks if adding saved fields. Continue contour/profile work with explicit source limits.
