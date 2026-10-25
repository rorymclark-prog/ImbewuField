# Site-report main integration — 25 October 2026

- Auditor: Codex, continuing the report goal after the final mergeability check.
- Prerequisite: #1099, previously verified at `45d3dabe`; integration target `origin/main` `8d2e1a9aa` (waves 19–21).
- Previous: [production/mapping implementation](../2026-10-24/site-report-production-mapping-codex.md) and [CI correction](../2026-10-24/site-report-ci-followup-codex.md).

The previous source passed full test/rules CI, but #1099 had become conflicting
against newer main. A green old run was therefore insufficient for a mergeable
handover. Current main has been merged into the review branch; no production
merge is performed by this operation.

Four conflicts were resolved deliberately:

- `PROGRESS.md`: retain both sets of dated work records.
- Audit index: retain both the report records and newer wave records.
- Release notes: retain the report entry and newer main entries, including tours.
- Report archive: retain main's removal of its redundant Saved reports heading,
  and retain the report-purpose/origin labels added by #1099.

Other reviewed main changes merge normally, including its own language and
course UI work. This pass does not author or rewrite that content, alter saved
geometry, add species or farming figures, or assign `PLAN_VERSION`.

Local integration verification: the locked dependencies were restored.
`npx tsc --noEmit` is clean; 225 focused report/survey/UI checks pass, with zero
failures. Whitespace is clean. Full integrated CI is required before merge. An initial typecheck raced dependency installation and attempted an
unavailable registry fetch; it is not treated as a source failure. It was rerun
with the restored local compiler. No test assertion was removed or weakened. The release-note stamp is advanced to
the recorded integration commit in a separate note-only commit before the single
branch push, so the existing drift gate has a reachable source revision to check.

The rendered evidence for Record plan, annual products and report purposes in
the prior audits remains applicable to their existing implementation. The report
archive heading follows the already-reviewed main change. The combined preview
and full CI must be checked after this integration, so no visual or full-suite
success is claimed from the old branch run alone.

#1101 must carry this updated prerequisite before its final verification. Keep
its market-note/source/date and soil-source changes. Its 25 October verification
record remains a historical checkpoint of `23922e558`; read this integration and
the latest PR/issue #35 status before merging. Fluent review, physical devices,
current buyer/field evidence and generated narrative quality retain their recorded
limits. Both PRs remain for review in the order #1099, then #1101.

## Wave 22 integration after completed CI

The four full CI runs on the preceding integrated sources completed successfully.
For #1099 at `0a08ccc57`, push/PR runs `40192436366` / `40192439093` each
report **5,563 tests: 5,562 pass, zero fail, one existing TODO**. For #1101 at
`4b88d5559`, runs `40197264764` / `40197269927` each report **5,573 tests:
5,572 pass, zero fail, one existing TODO**. Typecheck and all rules jobs pass.
The TODO remains the pre-existing shape-sync-loss scenario, not a report failure.

The completion audit then found #1099 conflicting after main advanced to
`cfb75437c` (wave 22). Only progress history, the audit index and release entries
conflicted; both histories and both sets of release messages/tours are retained.
The report archive's wave-22 spacing change merges normally with its saved
purpose/origin metadata. Reviewed main code and tests are carried without hand
rewrites. The prior successful runs certify their recorded heads; the refreshed
review heads need their own CI. Read the final PR bodies and issue #35 handover
for the terminal results, without creating another documentation-only CI cycle.

Report generation, captured facts, annual products, map rendering, farmer data
and the original six-report collection retain their prior implementation and
verification scope. No new narrative, field visit, species, figures, geometry or
PLAN_VERSION changes are introduced by this reconciliation.

On the refreshed #1099 tree, typecheck is clean and **315 focused report,
survey, production, readability, release and waves 19–22 checks pass, zero fail**.
Whitespace is clean. Full CI and the combined preview are checked after the one
finished push; previous rendered report/PDF evidence retains its scope.
