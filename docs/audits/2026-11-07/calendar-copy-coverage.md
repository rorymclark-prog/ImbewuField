# Release-copy coverage checks — 7 November 2026

- Auditor: Codex
- Reviewed revision: `c576bff36b5bf4d17e5ee979c04623b7a0266ba5`, branch `codex/calendar-copy-coverage-20261107`, plus the two test changes described below.
- Deployment inspected: none.
- Previous record: [Checked grower dates in one calendar file](../../international/grower-work-calendar-2026-11-07/README.md). This continues its open current-head verification gate; no prior copy-coverage finding IDs existed in that record.
- Scope: update banners, history, language-chunk arrival and their test renderer. No application or translation data changes.
- Evidence type: source review, TypeScript AST comparison and actual React test rendering.

## What was already done

The calendar release announces the preceding seed-pack budget in English. Its full CI run reported 10,159 passes and four failures among 10,163 tests. A focused local run reproduced exactly those four failures: 17 passes and four failures among 21 tests. The failures assumed every new description already had native copy, or selected the newest description as a supposedly distinct native-language fixture.

English-only announcements invalidate those assumptions without invalidating the existing published translations. Checks must still reject stale local-copy resurrection, wrong-language arrival and incorrect source disclosures.

## Findings and disposition

| ID | Coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| COPY-COVERAGE-001 | Universal native-copy assumptions reject legitimate English-only release descriptions. | Implemented; focused verification passed | Availability is checked against each exact source. Real history renders exercise fully covered, partially covered and explicitly withdrawn copy in all four existing test languages. English tags, native tags, labelled source backing and the English-gap notice remain asserted. |
| COPY-COVERAGE-002 | The newest-description fixture can resolve to identical English in both languages, making late-chunk and empty-published-copy controls vacuous. | Implemented; focused verification passed | Controls now require an actually translated archived source; late-language cases additionally require distinct published Sesotho and Xitsonga wording. A late old-language chunk must leave the selected-language source in English until its own chunk arrives. |

Independent AST comparison retains 102 of 106 original assertion expressions byte-for-byte with multiplicity. Precisely four obsolete coverage/index assumptions are replaced with the stated rules; 25 expressions are added or substituted. The complete original 604-entry archive equality assertion remains unchanged and passes. All 730 public release-history entries and the complete history file remain byte-identical. No translation dictionary, source packet or product source changed.

The renderer adds only an optional `historyNotes` test fixture. Omitting it retains the real release history; other renderer behavior is byte-identical after removing that seam.

## Verification

- Typecheck: the implementation lane did not run it. A later coordinator attempt with an artificial 768MiB Node heap cap ended with heap exhaustion (exit134), not a successful typecheck or source diagnostic. A normal-sized ordered typecheck remains pending while the existing full run continues.
- Focused localisation: 25/25 passed, zero failures, cancellations, skips or TODOs.
- Affected release tests: 45/45 passed across six files, zero failures, cancellations, skips or TODOs, Node 24 with one test worker. This includes localisation, feature previews, update tours and release-note import/type/gate contracts.
- Full suite/current-head CI: not run on this uncommitted repair; coordinator review remains required.
- Whitespace: `git diff --check` passed for the two changed test files.
- Output inspected: actual React trees and text, not a browser or physical device. Test-only changes do not change the application picture; no visual, fluent-language or release approval is claimed. `PLAN_VERSION` is unchanged.

## Next continuation

Coordinator reviews this three-file repair, adds the dated audit index entry, runs required final checks and updates the calendar branch with current-head evidence. The calendar's populated account, device and external-import gates remain separate.
