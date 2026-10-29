# Audit coverage and release status — 29 October 2026

The 28 October pass was a focused cross-workflow audit. It was not a complete visual or functional audit of every screen. The original request was broader than the completed browser coverage.

| Area | Evidence obtained in this pass | Still unverified |
| --- | --- | --- |
| Home and tour | Desktop home, tour entry and role handoffs observed | Every first-run state, every language/theme/device |
| Mentor/training | Narrow layout, register, venue, signatures, feedback and report screen observed; Tour title save/reopen worked | Authenticated live/offline save and reconnect; training PDF pagination |
| Funder | Cohort dashboard and shared-record presentation observed; source/permission paths reviewed | Multi-account access testing against live backend, all report variants |
| Reports | Real React screen/save/PDF-handler regressions for historical photos and map selection; boundary/distant-water regressions | All exported PDF pages visually checked; every historical report shape |
| Production charts | Before/after desktop and 390px dark-theme rendering; measured colours and page width | Every chart/state visually checked in all themes/languages |
| Design/export | Tour Record plan created, added to maps and reopened; 20 Tabs stayed in gallery; final preview passed zoom Escape → gallery, then Escape → Manage | Every editing tool/layer, all sheet types/styles, paid-render fidelity |
| Crop plans/finance/journal/community | Relevant data paths, exports and existing regression coverage reviewed | Complete interactive create/save/reopen/export journeys for every area |
| Study | Earlier audits and existing source-binding/test history reviewed; lesson wording preserved | Every lesson, quiz, audio/video and language manually exercised |
| Offline/accessibility/devices | Shared focus tests and emulator rule checks; selected phone-width checks | Physical-device offline recovery, assistive-technology/device matrix |
| Release | Typecheck, focused checks and preview build passed for prior head; overnight full CI identified failures | Full suite must pass on the corrected head before deployment |

## Follow-up caused by full CI

The new release note displaced older guide-bearing entries from the five-line update window. This removed the visible update guide and caused several guide tests to fail. The fix retains a real localized guide on the newest entry.

The remaining Escape/refusal checks pinned old implementation syntax. Their replacements must verify the actual behavior and retain the reasons for coverage. A newly confirmed direct-render Tour refusal also needs the purposeful UserFacingError type so the shared friendly-error handler preserves the instruction.

These are release blockers, not permission to weaken tests or bypass CI. Rory authorized deployment on 29 October; merge/deployment remain conditional on both required jobs passing for the exact corrected head.

## Outstanding audit findings

- Water-point coordinates/proximity do not establish ownership or permission to use water.
- analysedMapIds still derives identity from nonunique display labels.
- Saved-report schematics intentionally use today's design and carry the existing changed-design warning; this pass did not freeze that entire input model.
- PDF print layout, paid rendering and physical-device offline recovery cannot be certified from the checks above.

No conclusion that “everything works” is supported by this pass.
