# Individual DEMO calendar identity — 13 November 2026

- Writer: Codex; branch `codex/provisional-calendar-evidence-20261113`.
- Starting commit: `7896dca1dffce96a3fbc6e2ecc2bcd6b41d949aa`, same finished branch before its single push; base remains PR1361 / a0f4b15ef.
- Previous: [Provisional calendar evidence](provisional-calendar-evidence-codex.md).
- Finding: `CALENDAR-SINGLE-DEMO-IDENTITY-01`, P2, discovered in the exact original-output review. Original G04/G05/P19 scope and all P01–P24 requirements remain intact.

## Actual defect and repair

The actual sample:true probe downloaded a DEMO-labelled bulk file, but the individual calendar used a normal title, description, event UID and filename. An incidental DEMO bed name was not a reliable label. The reviewer confirmed the same behavior in a0f: an inherited defect, not a new provenance regression.

Individual grower calendar actions now select one currently displayed task and reuse the existing guarded bulk writer and browser delivery. They carry the same public source lines, explicit sample context, calendar title, DEMO filename/title/description and demo UID namespace. Ordinary event identity, dates and descriptions remain equivalent to the bulk event; the general Home task helper stays untouched. Individual files now use the existing grower-planned-dates filename rather than the generic grower-cycle-task filename.

The shared render/source/checker/sample/lifetime lease also retires an individual download after a context round trip; it cannot revive when the same value returns. Full-calendar completeness still requires all held sources to be reviewed. An individual checked task remains independently downloadable if other cycles are held. Completion/checklist behavior is unchanged. No saved data, measured geometry, permissions, crop values, provider call, workflow, script or PLAN_VERSION change.

## Verification and original outputs

- Typecheck exited0, then325/325 affected checks across21 existing registered suites, zero failures/cancellations/skips/todo. Seven added mounted cases cover ordinary/prop/device sample identity and four pending context round trips.
- Against unchanged7896 source, the seven new cases yielded one ordinary pass and six intended failures: missing sample identity and revived old pending downloads. Those failures are preserved separately; no assertions were weakened.
- Actual mounted callbacks downloaded fresh one-event and six-event original ICS files with the same accepted provisional fixture. Independent Python icalendar7.3.0 parsing and datetime arithmetic confirmed six dates/exclusive ends, all36 public source/limit lines in every event, and the individual event's UID, summary, description and dates matching its bulk counterpart. Both filenames and calendar names are DEMO-labelled. Private structural canaries, recurrence and alarms remain absent. Owner read the actual single file and parser receipt.
- The screen/disclosure layout is unchanged. The six original phone/desktop screenshots and their exact7896 review are retained rather than generating a duplicate visual review. Actual delivery uses synthetic source/account/browser seams; no hosted/live-account/native Apple or Google calendar import claim.
- Whitespace and post-commit release-note checks, final exact-source/output review and current-head CI are recorded separately. The earlier318-check provenance receipt is preserved, not overwritten with325.

## Remaining gates

Publish once after exact final review; full successor CI/security required for the shared calendar behavior. No merge/release approval is claimed. The inherited preview heap failure and prepared workflow patch remain subject to the pending explicit ownership decision; no patch is applied. Hosted calendar/map/capture checks remain open. Claude/AGY automatic routes remain disabled under the service-policy hold; a Codex review is identified as Codex and does not substitute for those roles. No new agricultural-accuracy claim.
