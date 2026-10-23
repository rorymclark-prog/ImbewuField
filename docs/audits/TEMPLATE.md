# <Area> audit — <YYYY-MM-DD>

- Auditor: <Claude / Codex / human; identify collaborator if relevant>
- Reviewed revision: <full Git SHA, branch, and any local changes>
- Deployment inspected: <URL and verified build SHA, or not inspected>
- Previous audit: <relative link and carried-forward finding IDs>
- Scope: <routes, components, flows and user roles>
- Evidence type: <source review / automated tests / browser / physical device / PDF>

## What was already done

Link the earlier findings and merged work. Explain what is retained and which
old claims are superseded by later evidence. Do not reopen a resolved finding
without reproducing it on the reviewed revision.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| <area>-001 | <concrete trigger and consequence> | <open / implemented / verified / needs verification / blocked / superseded> | <file, reproduction, screenshot, test, commit or PR> |

Use stable IDs on subsequent dates. Distinguish a verified defect from an
improvement proposal or a check that was not possible.

## Verification

- Typecheck: <result or not run>
- Full test suite: <pass/fail/TODO counts, runtime and result or not run>
- Whitespace: <result or not run>
- Output inspected: <exact viewport/device/export and linked evidence, or not inspected>
- Other limits: <missing access, language review, offline or physical-device checks>

A green suite alone does not verify appearance. Record whether this changes the
picture. Leave `PLAN_VERSION` unchanged.

## Next continuation

List the next work in priority order, its acceptance checks and dependencies.
Record the branch/PR/checkpoint so another chat can continue from the same state.
Keep personal records, secrets and raw logs out of this file.
