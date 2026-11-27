# Weekly market-garden production audit

- Auditor: Codex
- Branch: `codex/weekly-market-garden-production-20261127`, based on production `f1d955c99a8716791d1d69de2dd19fbf8ca9bef9`
- Prior record: [Crop-cycle harvest links](../2026-11-25/crop-cycle-harvest-link.md)
- Scope: mapped Production, the buyer-target editor, the dated Task Planner and recorded harvest and sale readback

| Check | Evidence at this checkpoint |
| --- | --- |
| WM-01 · Work follows from mapped beds | Green Horizon shows worked lettuce and chard cycles that start one week apart. Their dates and whole-cycle yield come from the existing own-estimate planner. The carrot row retains its saved sowing month and leaves picking dates open. |
| WM-02 · Weekly order and gap | Three fictional chard periods intentionally show a filled plan, an entered zero and an unknown quantity. Week boundaries come from the saved target. A shorter final period has an unknown requested quantity until an exact order is established. |
| WM-03 · Save and reopen | The target editor saves weekly amounts with the existing receipt and conflict guard. The finished save reads back the canonical crop book. The mounted checks reject ambiguous numbers, reopen an exact zero, and preserve 0.0000001 when saving another week. A competing write keeps its own quantity. |
| WM-04 · Occupancy and declared availability | Accepted reservations and worked example dates show periods of occupancy. Real availability comes from the current checked planner review. An unverified period remains unknown. Weekly production and the saved-cycle view share the current checked context. The route test verifies that a saved design alias retains a valid provisional cycle and withholds it after its policy changes. |
| WM-05 · Actuals | Linked harvest quantities come through the dated Task Planner evidence path. Sales show their own date, quantity and buyer label. The view establishes no delivered quantity from those rows. |
| WM-06 · Workspaces | The weekly practice draft and practice sales are scoped to Green Horizon. Unit and mounted checks retain isolation from the real account and Ubhejane. |
| WM-07 · Accept the two practice cycles | The original phone run reached the weekly save but found the staggered crop review had an aggregate capacity gap. The fictional chard pack weight now lets the existing planner save both cycles using the same dates and mapped beds. The weekly entries still include an explicit zero and an unknown. The heavier-pack regression retains the planner’s aggregate guard. |

## Verification

- Node 24 TypeScript and 154 focused checks passed locally, including the saved-row, date-window, quantity and geometry-context checks.
- Independent Codex review of the original candidate found two remaining issues. WM-03 now reopens tiny quantities in plain notation. WM-04 now passes the same checked provisional context to both views and keeps the design ID distinct from its geographic scope. Independent review of this successor remains due.
- The hosted build, phone keyboard flow, saved readback after navigation and cross-demo reset are pending at this checkpoint. Production publication of this milestone requires separate authorisation.
- Values and dates in Green Horizon are synthetic practice inputs. Local crop suitability and weekly delivery stay open. The existing site geometry and PLAN_VERSION are preserved.
