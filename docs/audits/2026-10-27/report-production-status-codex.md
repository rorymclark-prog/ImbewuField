# Plant and housing status in real site reports — 27 October 2026

Auditor: Codex. Parent: final #1131 source `534f0c086`; this is a separate
follow-up so its full map/PDF checks can finish unchanged. Merge #1131 first.
Previous work: [published report handoff](site-report-handoff-results-claude.md),
[PDF sample continuation](report-pdf-pagination-codex.md),
[10 October production re-audit](../2026-10-10/production-reaudit-codex.md).
Earlier SS/MAP/REP-L findings retain their own dispositions. A search of the
shared audit archive found no recorded correction for this legacy-default split.

## Finding

| ID | Real observation | Correction |
| --- | --- | --- |
| REP-S01 | The real signed-in Ubhejane report showed placed plants as proposed in its design inventory but existing in undated food-forest rows. The crop reader treated missing status as existing; the canvas authority treats unmarked placed items as proposed. | Identified/unidentified perennial groups and housing groups now read `statusOf` from the design. Explicit existing/proposed fields still win. No stored item or geometry is changed. |

The earlier perennial comment claimed its legacy default matched `statusOf`;
reading the helper shows the opposite. The helper explicitly distinguishes traced
ground fabric (existing) from unmarked placed items (proposed). Reusing it avoids
inventing a third interpretation. The same independent legacy default was then confirmed in the housing reader.
Housing also uses `statusOf`; enterprise choices and missing product/month data
remain unchanged. No animal numbers are derived from structures.

## Verification and test reasons

- The signed-in production report was inspected without clicking Generate report
  or Save. Its design, annual product table and original saved-map set were read.
  Before screenshots are retained privately with Rory's local report samples,
  not uploaded to the shared Git history.
- Eight plant/housing status checks fail against the original readers and pass
  after correction. The 25 directly dependent test modules and associated exports,
  reports and notices now pass all 556 focused checks; typecheck passes.
- Two earlier count assertions treated an unmarked item as standing. They now
  require only explicitly existing plants to enter current picking jobs, retaining
  every identity, unknown research, local-date, proposed-plant and immutable-map
  assertion. The combined-citrus identity and mixed clump/circle guide fixtures now explicitly
  record their standing plants as existing; its product hold and all original assertions remain intact.
  These are corrections to false premises, not removed coverage.
- New checks retain all planned inventory, distinguish explicit existing/proposed
  fields, keep undated annual rows visible, and require the input geometry/status
  objects to remain byte-for-byte structurally unchanged.
- Canonical full checks and exact-head CI remain release gates. Record terminal
  totals and production verification in the PR and issue #35; an earlier green
  map head does not certify this follow-up.

## Full-suite continuation

The first full local run of `cf5dbbf61` exposed a food-chart test whose fixture
intended a standing tree but did not record its status. The fixture now explicitly
marks its standing tree and housing; every original food-gap, source toggle,
React-dependency and chart-consistency assertion is retained. Inspection found
the animal reader had the same contradictory legacy default, so it now shares
the canvas authority too. Its prior legacy-count assertion is rewritten with the
same reason and new housing/report regressions retain all geometry and unknowns.

The demonstrated failing run was stopped and retained privately; it is not a pass.
Its CI head is superseded only after the corrected finished source is pushed.
Fresh ordered checks and CI certify that final source. #1131 remains unchanged
and can finish its own existing gates.

## Limits and next continuation

New/current production views follow the shared status rule. Saved report snapshots
remain dated artefacts; exporting an older snapshot does not recalculate its
production season. No plant identity, reference season, spacing, yield, price,
animal number, saved geometry or lesson content was edited. PLAN_VERSION and map
recipe r8 are untouched. No new paid generation, field visit or agronomic approval
is claimed. The one update notice has explicitly unreviewed zu/st/ts/ve drafts in
[the source-pair record](report-production-status-release-drafts.json).

After release, reopen the real Ubhejane report/crop plan and confirm its unmarked
plants and housing are proposed, with absent dates/amounts still unknown. Inspect the actual
building/Record plan and free exact-map samples without changing the design.
