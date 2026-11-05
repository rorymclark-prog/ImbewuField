# Water sheet shared budget — 2026-11-03

- Auditor is Codex.
- Reviewed revision is `84ffa82dd` on `codex/shared-water-sheet-budget` over `c06b77b`.
- Deployment was not inspected. Evidence comes from local print-size exports made with the actual app compositor.
- Previous audit is [White Water sheets and retained AI roofs](../2026-10-31/paper-map-finish-codex.md). This follows the AI-MAP-059 discrepancy in the separate Zone review.
- Scope is the exact and app-owned Hybrid Water sheets. The input is the same frozen Ubhejane design and its saved paid artwork.

## Findings and disposition

| ID | User-visible problem | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-059 | Exact and illustrated budgets used different roof lists and units | Implemented and inspected | The former exact sum added the promoted 43.87 m² Classroom ring, the same Classroom ring again as a Studio feature and the 17.74 m² Storeroom. That yielded 105.48 m² and about 64,805 L/year. The illustrated sheet used the primary Classroom ring once. Both now use the existing Water system's primary traced roof rule and notes. No explicit roof-to-tank assignment is recorded for either roof. The Storeroom is a separate building outline. The new shared estimate is about 27 kL/year at 768 mm and a 0.8 coefficient, with site confirmation of the connected roof area. Placed storage is 12,500 L across one 2,500 L and two 5,000 L tanks. The old 13 kL display rounded the same capacity to a whole kilolitre. Storage stays separate from annual harvest and the notes retain the missing daily-demand qualification. |
| AI-MAP-060 | Illustrated Water omitted deterministic routes and terrain arrows | Implemented and inspected | The paid finisher deliberately avoided the exact feature overlay so it would not cover painted tanks and other features. That also left routes to the provider. The Hybrid now draws the saved pipes, drip routes and swales and reuses the exact sheet's elevation-based flow field, interceptors and flow key. It retains the illustrated surfaces and hardware. Exact leader labels and schematic roof/overflow arrows stay in the exact rendering. The reused painting still contains an older offset blue stroke near the north tanks. The exact map remains the pipe-location reference. |

## Verification

- Typecheck, 634 focused-render checks and 67 affected Water, tank and overland-flow tests passed locally before the release-note commit. Release checks and whitespace are recorded in the PR.
- The two reassembled exports were inspected at print size. The budget figures and flow key agree. Both show the same saved plan route geometry. The original artwork and byte-for-byte scene stayed intact. No paid generation was requested.
- This changes the picture. PLAN_VERSION and the saved-job recipe are unchanged.
- The full current-head suite is required before merge because this changes published water calculations. The Mac had heavy swap use, so the full run belongs to CI. The base revision's prior Sector footer source test failure is recorded on issue #35.

## Next continuation

Reconcile the release notes after the other map and connector PRs land. Verify full test, rules, focused-render, release notes and preview for the actual merge head. The existing painting's offset stroke remains open for a separate artwork cleanup.
