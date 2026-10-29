# Farm memory verification continuation — 29 October 2026

- Auditor: Codex, with parallel implementation and review agents.
- Reviewed revision: `cc2809c55ec03a37364895ffa43de1750a6cdcb4`; branch `codex/farm-memory-isizulu-20261029` has uncommitted language and journal workflow changes under development.
- Deployment inspected: local sample farm at `http://127.0.0.1:4251`, with the follow-up changes; preview and production verification pending.
- Previous audit: [Simple plant-label coverage and full-run continuation](simple-plant-label-coverage-codex.md), carrying REP-V01 forward. Also read [audit coverage and release status](coverage-and-release-codex.md).
- Scope: full-suite CI evidence, the current update-copy contract and the farm-memory continuation's release gate.
- Evidence type: connected GitHub job metadata and finalized logs; independent source review; actual rendered-component tests; desktop and phone browser checks using disposable sample records.

## What was already done

PR #1148 merged the task-to-journal handoff, actual-harvest shortcut, searchable journal, photo comparison and selected-note exports as `cc2809c55`. This does not establish that its full suite passed. The follow-up branch adds isiZulu draft/source presentation and further journal controls; its checks remain separate from the merged source.

The previous REP-V01 failure is already corrected in the inherited source. At `a07866238276416835eab8958880b9cc7a629012`, full CI run [40882723876](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40882723876) passed: **6,132 tests, 6,131 pass, zero failures and one existing shape-sync TODO**, exit 0. Its full test duration was 10,529,580 ms (about 2 h 55 min). The independent rules and focused-render jobs also passed. The second run [40882713418](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40882713418) succeeded on that same head. These results apply to that source, not to later farm-memory changes.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| REP-V01 | An obsolete Plant labels source-regex assertion rejected the legitimate Whole grouping guard. | Previously corrected; retained | Old main run [40870782161](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40870782161) ended with 6,124 tests / 6,122 pass / one failure / one TODO. Its sole non-TODO failure was `tests/design-glossy-simple.test.ts:38`. The corrected-head green runs above supersede that failure; do not reopen it without a new reproduction. |
| FM-V01 | Farm-memory update lines and tour descriptions have no matching entries in the four update-copy dictionaries, leaving this new announcement in English. | Corrected; affected tests verified | Added exact-source drafts for all four languages in `lib/update-copy-locales/{zu,st,ts,ve}.ts`, recorded in [the release draft packet](farm-memory-release-drafts.json). The 21 update-notice checks pass, including the unchanged archived suffix, native/source pairs and tour destinations. The pending earlier full runs have not supplied terminal results. |
| FM-V02 | Full current-source verification is incomplete. | Pending; release gate | Rory explicitly requested a green full suite for this continuation. Focused results alone do not satisfy that request. Record the new branch's ordered local and exact-head CI results before declaring completion. |
| FM-V03 | Repeating the same bed/crop history tap does not return to the result heading, and leaves a stale scroll request for a later search. | Corrected; regression verified | History navigation now has an explicit request counter. The actual rendered-component regression failed before the correction on the second identical bed tap, passes afterwards, and confirms later searches do not consume an old request or write records. |

## Verification

- Snapshot: **29 October 2026, 20:42 Europe/Vienna**.
- Main run [40924622651](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40924622651), head `cc2809c55`: typecheck passed; full `test` still running; `rules` and `focused-render` passed.
- Earlier feature runs [40923696459](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40923696459) and [40923687230](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40923687230): full `test` still running; their rules/focused checks passed. Pending is not passed.
- Current follow-up branch: Node 24 typecheck passed, **83 affected checks / 83 pass / zero failures**, whitespace clean. The checks cover journal filtering/identity, task drafts/harvest destinations, photo comparison, CSV/HTML safety, isiZulu labels, optional export photos, current translated notices, original workflow assertions and complete test registration. Full local suite and exact-head CI remain pending. No test is deleted or weakened.
- Runtime context: the last completed full main success, [40731374668](https://github.com/rorymclark-prog/ImbewuField/actions/runs/40731374668), took about 3 h 11 min. Its finalized log records long Soil/Water media-preservation checks; a shorter elapsed run is not evidence of a stall. Running-job log downloads returned `BlobNotFound` until logs are finalized.
- Output inspected: browser viewports 390×844 and 1440×1000, isiZulu filters, one-tap crop history, original note text, and actual two-photo comparison. Local evidence is in `output/playwright/farm-memory-zu-{phone,photos-phone,photos-desktop,history-desktop}.png` (QA files excluded from Git). Downloaded isiZulu HTML/CSV retain the original test note and demonstration marker: photos-on HTML has two embedded images (107,009 bytes), notes-only has none (2,860 bytes). These sizes describe this sample only. Language fluency, physical-device offline use and deployment remain unverified. Language drafts still need fluent review. This changes the journal UI picture; `PLAN_VERSION` is unchanged.

## Next continuation

Finish the localized source dictionaries and assigned journal controls. Run ordered typecheck, affected checks, full `npm test` and whitespace; preserve actual failure evidence and fix the underlying issue. Wait for the new head's full CI `test` and `rules` results plus its applicable preview/focused gates. Update this record with terminal results and the precise source before normal merge and production verification. Keep raw logs and private farmer records outside Git.
