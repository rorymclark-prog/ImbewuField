# Production status in real site reports — 27 October 2026

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
| REP-S01 | The real signed-in Ubhejane report showed placed plants as proposed in its design inventory but existing in undated food-forest rows. The crop reader treated missing status as existing; the canvas authority treats unmarked placed items as proposed. | Both identified and unidentified perennial groups now read `statusOf` from the design. Explicit existing/proposed fields still win. No stored item or geometry is changed. |

The earlier perennial comment claimed its legacy default matched `statusOf`;
reading the helper shows the opposite. The helper explicitly distinguishes traced
ground fabric (existing) from unmarked placed items (proposed). Reusing it avoids
inventing a third interpretation. Housing rows already retain their own source
status, numbers and missing product choices; they were not altered.

## Verification and test reasons

- The signed-in production report was inspected without clicking Generate report
  or Save. Its design, annual product table and original saved-map set were read.
  Before screenshots are retained privately with Rory's local report samples,
  not uploaded to the shared Git history.
- Five status checks failed before the correction: four new real-reader rules
  plus the rewritten earlier standing-tree claim. All 386 focused production,
  food-availability, identity, report and PDF checks then passed; typecheck passed.
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

## Limits and next continuation

New/current production views follow the shared status rule. Saved report snapshots
remain dated artefacts; exporting an older snapshot does not recalculate its
production season. No plant identity, reference season, spacing, yield, price,
animal number, saved geometry or lesson content was edited. PLAN_VERSION and map
recipe r8 are untouched. No new paid generation, field visit or agronomic approval
is claimed. The one update notice has explicitly unreviewed zu/st/ts/ve drafts in
[the source-pair record](report-production-status-release-drafts.json).

After release, reopen the real Ubhejane report/crop plan and confirm its unmarked
plants are proposed, with absent dates/amounts still unknown. Inspect the actual
building/Record plan and free exact-map samples without changing the design.
