# Crop-plan edits after write access is lost — 19 November 2026

- Auditor — Codex, following finding D-2 from Claude’s planner journey review.
- Starting revision — `7910adb7b4127f97aa273307666519bf6b784c8c`, branch `codex/crop-plan-readonly-edit-20261119`, based on released `088afa397864824a6755249b3751ef62f966aed9`.
- Previous audit — [Wisconsin reference disclosure](../2026-11-18/wisconsin-reference-disclosure-codex.md) documents the preceding global planning milestone.

The first D-2 patch verified crop add, edit and remove in a signed-out preview with two tabs. A second probe of the mounted planner handlers found that the calendar, production and stock paths could still stage changes after losing write access. The production editor cleared inputs after a refused change. The legacy harvest-target editor could show that it added sowings even when the planner declined the callback.

| Case | Change and expected outcome | Verification |
| --- | --- | --- |
| D-2.1 | Calendar changes and Undo require a writable book. | Calendar and writer-admission regression tests exercise the retained callbacks. |
| D-2.2 | A changed or read-only book rejects a new production or stock edit before staging. The form retains a refused draft. A previously staged observation stays visible for recovery. | The mounted crops page checks newer stored bytes, and the actual editor checks both forms and their write controls. |
| D-2.3 | Legacy harvest-target sowings require a current book, a single canonical write and exact readback before the editor reports success. An ambiguous receipt calls for reopening the saved plan before another attempt. | Real page tests check current, stale-country, changed-geometry and replaced-book callbacks. The editor exercises confirmed, held and uncertain outcomes. |

## Release checks

Node 24 typecheck, all 208 affected tests across 13 files, whitespace and the release-note check passed on the proposed change. The local suite includes the actual storage event being superseded by a newer book during a legacy-target save.

The first hosted focused run (job 135500489550 on 335ef9981) found that the update text exceeded the 90-character phone limit. The follow-up shortened the text and registered the draft-retention regression in the full-suite command.

The branch requires the full current-head test job, rules and a preview. The signed-out preview exercises simulated data. Language, real account and physical-device checks are separate. This correction changes persistence and feedback; the crop catalogue, farming values, saved-data format and `PLAN_VERSION` retain their existing definitions.
