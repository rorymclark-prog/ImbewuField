# Crop-cycle harvest link audit — 25 November 2026

- Auditor: Codex. Separate reviewers traced the accepted-cycle and harvest-book authorities.
- Baseline: released commit `46b57cea249d1359882fa06c37859df948c5204c`, tree `a81c6b4ca638f54298675a78b5ef37b1cf4a48d1`.
- Scope: accepted-cycle first-pick task, existing harvest records, saved crop progress HTML, and actor boundaries.
- Previous milestone: [Global Planner crop reports and German station batch](https://github.com/rorymclark-prog/ImbewuField/pull/1415).

## Reproduction and design

On the released public farm at 390 × 844, Mkuze cabbage and Wisconsin tomatoes each reached an accepted plan for a measured 6 m² bed. Each first-pick task offered a checklist, calendar and a journal note. The separate Harvest Records form accepted a quantity and unit. It had no observed-date input, and the report showed actual harvest as unknown.

The first-pick action now asks the grower to select an existing own harvest and confirm the actual picking date. It stores a private association between that record ID and the exact planning scope, planting ID and bed ID. It keeps the current harvest quantity and unit in the original harvest book. Existing account rules keep these associations private even when a mentor can read the underlying harvest record. The sample keeps associations in its existing in-memory sandbox.

| Finding | Disposition | Evidence |
| --- | --- | --- |
| CROP-HARVEST-LINK-01 | The first-pick task lacked a checked path to an actual harvest. | The source and target are checked again before linking. A transaction preserves an existing conflicting link and admits an identical repeat. |
| CROP-HARVEST-LINK-02 | A detached report could outlive a harvest edit or delete. | Checked report rows come from the current owner-scoped book. Changed evidence cancels the handoff, and unavailable rows leave part or all of the total unknown. |
| CROP-HARVEST-LINK-03 | An entry timestamp could be mistaken for a harvest date. | The actual day starts blank and must be confirmed. The report shows it separately from the planned day. A real harvest date cannot be later than today on the device. |

An independent review of `705bbe7de` identified two gaps. The workflow now lets the grower remove the exact association, even when the harvest row is unavailable. Removing the association leaves Harvest Records unchanged. A harvest that is still available can be linked again. Actual dates in signed-in records are limited to today or earlier. Isolated demo cases can still use illustrative future dates.

## Verification correction — 26 November 2026

Full CI on `2678137` passed 11,336 tests and failed three. The old-client shape fixture and source-bound translation test both protect the original sample module. The harvest feature now holds demo link metadata in memory for the active sample window and resets it with the existing sample-mode event. The original sample module is byte-for-byte identical to the released base. The new form is registered under the 12 px farmer text floor. The three former failures and the affected planner and export checks passed together locally on Node 24.

## Verification boundary

The local tests cover explicit selection, idempotent retry, confirmed removal and relinking, future-date rejection, stale and foreign input, updated and deleted records, original units, and isolation of sample data. The exact candidate still needs independent review, current-head GitHub checks and a hosted phone rehearsal for both crops. Costs, water use and unlinked harvests stay unknown. The candidate changes no planting calculations, measured geometry, access rules or PLAN_VERSION. Ontario stays provisional and undated.
