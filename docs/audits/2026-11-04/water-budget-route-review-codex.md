# Water budget figures and illustrated route review — 2026-11-04

- Auditor is Codex.
- Reviewed revision is `87bb0366f` on `codex/shared-water-sheet-budget`, PR #1221.
- Deployment has yet to reach production. The print-size images come from the app's native compositor and the existing paid artwork.
- Previous audit is [Water shared budget](../2026-11-03/water-shared-budget-codex.md), carrying forward AI-MAP-059 and AI-MAP-060.
- Scope is the exact and app-owned illustrated Water exports and a source restoration trial of the northern tank junction.

## Findings and disposition

| ID | User-visible problem | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-059 | Shared figures were buried in the Water budget paragraph | Implemented and inspected | Both exports give the primary traced roof (~44 m²), estimated annual yield (~27 kL/year) and placed storage (12,500 L) their own prominent rows. They use the same 768 mm site rainfall, 0.8 runoff, and connected-roof verification note. Roof area and placed capacity remain visible if rainfall is missing. |
| AI-MAP-060 | Older painted blue line can read as a second pipe | Open in the saved illustration | The source-restoration trial covers the offset stroke, but adds a visible strip of different ground and clips the tank and junction imagery. The candidate was rejected. The illustration now says AI WATER · UNDER REVIEW by the title and directs readers to the exact Water map for pipe locations. The app's overlay still follows the single saved pipe route. |

## Verification

- Inspected print-size exact and illustrated exports from one frozen scene and the registered source trial. The source scene serialized identically before and after composition. No paid generation was started.
- Clean typecheck, 634 focused render checks, 67 Water and terrain checks, release-note tests and whitespace. This changes the picture. PLAN_VERSION and the saved-job recipe are unchanged.
- The full current-head CI suite, rules, focused render and preview are required for #1221. Existing Site #1208 and Zones #1217 preserve their branches and queued jobs while connector #1181 finishes its full suite. The release-note overlap is logged in issue #35.
