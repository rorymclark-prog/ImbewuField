# Site report CI follow-up — 24 October 2026

- Auditor: Codex, following Rory's question about whether everything is finished.
- Reviewed revision: `ca5b78543afa1149038c68481a02822b5bcf5792`, PR #1099, plus the register additions committed with this record.
- Previous audit: [Annual production, report purposes and Record plan](site-report-production-mapping-codex.md). Its functional and visual evidence remains applicable; this follow-up changes no application code or pixels.
- Deployment: the existing preview build `ca5b785` previously inspected. No new deployment is needed for these test/document changes.
- Evidence: completed CI output, comparison with green main CI, and a fresh local typecheck and regression run.

## What was already done

The previous implementation is retained. The crop/food-forest/animal builders,
two report purposes, saved snapshots and Record plan have not been rewritten.
Earlier six-report Ubhejane files and all historical audit records are preserved.

The completed branch run [40074231075](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40074231075)
reported **5,481 tests: 5,479 passed, one failed, one existing TODO**. The failed
assertion was `every screen reachable from a farmer or staff route has been classified`
in `tests/type-floor.test.ts`. The three new reachable components were missing
from its required register. Main's [base run](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40071450225)
passed, so this omission belongs to this branch.

## Findings and disposition

| ID | Problem | Disposition / evidence |
| --- | --- | --- |
| SS-013 | Three new survey/report components were not classified for readable type | Added `SiteSurveyProductionYear`, `ProductionYearOverview` and `ReportPurposeGuide` to `FARMER_SURFACES`, with reasons. All use the strict 12px floor and zero allowance. No assertion, threshold, route or existing allowance was removed or relaxed. The existing test is intended to require these registrations when components are added. |
| SS-008, SS-009, SS-011, SS-012 | Previous report/mapping implementation | Retain prior implementation and visual verification. The full run found no failure in those production/report tests. Paid generation and real-farm report quality remain unverified. |
| SS-002, SS-004, SS-010 | Fluent review, physical devices, current local-economy evidence | Still open; this CI correction does not resolve them. |

The shape-sync assertion printed under the full run's diagnostics is already
marked TODO on main (`tests/shape-sync-loss.test.ts`). It is not this run's failing
check and was neither hidden nor changed here. Its shared-data work remains
outside this report continuation.

## Verification

- Node 24 typecheck: clean.
- Fresh regression run, including all type-floor checks: **174 passed, zero failed** (5.3s).
- `git diff --check`: clean.
- Full-suite rerun: initiated by pushing this correction; read the new PR checks before merging. A local focused pass is not a claim that the new full run has completed.
- Earlier preview build and security-rule checks passed. Their source is unchanged by this correction.
- No visual change, no new farming figures or species, no private-farm writes, and no `PLAN_VERSION` change.

## Next continuation

1. Confirm the new full-suite result on [PR #1099](https://github.com/rorymclark-prog/ImbewuField/pull/1099) before review/merge.
2. Highest remaining report check: inspect both real Ubhejane report purposes against authorised current saved evidence, including the annual product snapshot. Use the original private authoring/evidence folder; save any new document edition under a new date.
3. Continue SS-010 with current, source-backed local-economy evidence, then SS-002/SS-004 with fluent language review and physical phone/Safari tests. Reuse the existing evidence checklist and earlier findings rather than building parallel reports or forecasts.
