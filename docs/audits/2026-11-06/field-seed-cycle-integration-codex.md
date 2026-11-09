# Field seed cycle export integration — 6 November 2026

- Auditor: Codex coordinator, integrating the preserved Claude source package.
- Reviewed source: feature `0bdbc59f161f83baffc6396b254327154c9040e0` on
  `67527a55756199f335471f545489f97f33181054`, branch
  `codex/field-seed-cycle-integration-20261106`.
- Previous records: [source handoff](../../international/claude-field-seed-cycle-breakdown-2026-11-06/HANDOFF-AUDIT.md)
  and [nursery release reconciliation](../2026-11-05/international-nursery-final-reconcile-codex.md).
- Evidence: source comparison, typecheck, baseline negative controls and affected
  tests. New customer/browser delivery and full current-head CI remain pending.

## What was already done

The earlier `a7e15470` feature was verified on `ad766563` but not published.
This continuation applies it to the assembled `67527a55` baseline. The two
production postimages and two feature-test postimages remain byte-identical to
that feature. The package-script conflict was resolved by preserving every
`67527a55` script and registering only the new cycle test once. An initial local
conflict-marked commit was corrected before any checks or push.

The base's original full CI passed 9,098 checks. Its failed font preview attempt
was retained; a single failed-job retry succeeded on exactly the same source
after a direct probe showed the unchanged pinned font loader working. Both
preview endpoints now serve `67527a5`. These are base receipts, not CI or output
evidence for this feature.

## Findings and disposition

| ID | Problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| FIELD-SEED-CYCLE-001 | A group total did not expose which represented cycles supplied its entered counts and planned dates. | Implemented and locally verified | The field CSV retains its 27-column prefix, appends seven columns and adds detached cycle records linked by public worksheet numbers. Nine unchanged new controls fail on the base; all ten pass on the feature. |
| FIELD-SEED-CYCLE-002 | Extra detail must preserve held membership, unknown versus zero and private association boundaries. | Locally verified | Cycle records do not repeat group quantity columns. Malformed/overlapping memberships do not select a winner; unknown and confirmed zero remain distinct. Tests cover source replay, Unicode/formula escaping, detached results and no private identifiers. Inspect actual new downloaded CSV next. |
| FIELD-SEED-CYCLE-003 | A download could outlive its source/account binding. | Existing source guards retained | Seven additional base binding cases are included in the current affected run. The earlier signed-in account/storage QA limitations remain open; no new permission or persistence claim follows. |

## Verification

1. Full-checkout typecheck passed with Node 22.23.4 and a 3 GB heap cap. The first
   1.5 GB attempt hit the configured V8 limit; it produced no TypeScript result.
   Checks were sequenced and that process had exited before the successful run.
2. Against the unchanged `67527a55` production files, the exact ten new cases
   produced one preservation pass and nine expected assertion failures.
3. After restoring the feature files, **615/615 affected checks passed**, with
   zero failures, skipped cases, TODOs or cancellations, using Node 24.22.2 and
   two modest workers. The historical 608 count grew by seven existing baseline
   binding cases; the verification helper's old count assertion was corrected
   after checking the source diff and all seven actual TAP names. No test or
   product assertion was changed to obtain this result.
4. Whitespace is checked before publication. Full current-head CI, preview,
   security and actual browser/CSV evidence are separate remaining gates.

The raw logs and process receipts remain outside the repository in the
coordinator's `work/field-seed-cycle-integration-verification/` directory.

This changes CSV presentation and appends a guidance sentence about positional
cycle numbers and planned dates. It changes no map artwork or saved geometry.
`PLAN_VERSION`, catalogue/species, lessons, quantities, source/account guards,
runtime dependencies and nursery export format are preserved.

## Next continuation

Publish this branch once, as a follow-up to the assembled integration. Verify
the full current-head gates, inspect an actual multi-cycle download and its
phone delivery, and coordinate release order with the integration owner.
Translation fluency, signed-in persistence and cross-device behavior remain
separate requirements.
