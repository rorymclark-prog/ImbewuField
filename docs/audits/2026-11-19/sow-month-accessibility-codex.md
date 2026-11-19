# Sow-month button labels and selection — 19 November 2026

- Auditor — Codex, following Claude’s D-7 in the planner journey.
- Starting revision — released `088afa397864824a6755249b3751ef62f966aed9`, tree `5b2455b9d6849562c821fade2982a7c16f962191`.
- Previous audit — [Wisconsin reference disclosure](../2026-11-18/wisconsin-reference-disclosure-codex.md).

The crop picker gave every month a short name and used distinct colours for selection and the usual sowing window. Without those colours it was difficult to tell which month had been selected or which months the current catalogue marks as usual.

| Case | Expected behavior | Verification |
| --- | --- | --- |
| D-7.1 | Each button shows **In window** or **Outside window**. Its accessible name has the full month and the same status. | Actual picker markup and hosted crop-picker control states. |
| D-7.2 | The current choice has a visible check and a pressed state. Selecting a new month transfers both indications. | Actual month selection in the picker. |
| D-7.3 | The month grid fits a narrow viewport and month buttons have a 44 px minimum height. | Touch contract and rendered phone breakpoint. |

The same catalogue sowing windows and month callbacks drive the buttons. An outside-window month remains selectable with the existing warning. The new descriptions are English, like the surrounding sow-month controls.

Local Node 24 typecheck and all 125 affected tests passed, followed by the release-note and whitespace checks.
