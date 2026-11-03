# Dated grower work and canonical save admission — 2026-11-03

- Auditor: Codex root, with disjoint implementation owners and a separate read-only reviewer.
- Reviewed revision: `codex/international-grower-operations`, parent `fbe546d6c30c79e584981bbdf82d7cfada5b6363` plus the described changes. Exact publication SHA and CI belong to [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35).
- Deployment inspected: local current-code preview only; no production deployment claimed.
- Previous audit: [Production plan re-audit](../2026-10-10/production-reaudit-codex.md), retaining its CP findings and historical scope. This new additive scope follows the [grower proposal/nursery review](../../international/GROWER-WORKFLOW-REVIEW-2026-11-03.md).
- Scope: canonical crop-book saves, own-input dated tasks/calendar, older planner/PDF consumers and draft work-date language packets.
- Evidence: actual mounted writer/component regressions, source review, isolated in-memory probes, local desktop/phone and four synthetic PDF pages inspected by the implementation reviewer.

## What changed

The Task Planner reads saved grower-cycle dates through current owned design sources. Planned nursery/entry/picking/clearing/availability boundaries retain exact dates, including past dates and exclusive ends. Completion updates the existing checklist, never harvest, stock or sale records. Calendar downloads use the same planned dates and opaque task identities. Stale sources, actor transitions, ambiguous identity/geometry and missing records withhold work.

Older planner and PDF consumers distinguish grower-owned cycles from catalogue advice. Unknown complete coverage remains unknown; foreign and malformed evidence survives unrelated edits. New proposal acceptance remains disabled. The pure preparation API is documented separately and supplies no auth or write authority.

## Findings and disposition

| ID | Problem or gate | Status | Evidence and next action |
| --- | --- | --- | --- |
| GOPS-001 | Raw null plus an existing row could display as empty while retaining a valid write token, allowing ordinary autosave to erase evidence. | Verified correction in affected tests | Original loss reproduced with actual parent autosave in isolated memory only. Original-load admission and lossless candidate checks now cover all parent writers/undo and valid legacy settlement. No real farmer storage was touched. |
| GOPS-002 | A safe sample replaced later by an enumerable getter could execute during token serialization and be overwritten. | Independently rechecked | Shared descriptor-safe sample snapshot covers raw/current/writer tokens. Original reproduction now holds the write with zero getter calls and preserves the replacement object. |
| GOPS-003 | Undoing suggested rows retained explanations/rain basis authored by that removed action. | Independently rechecked | Both real suggestion handlers stage detached pre/post metadata; committed action history restores its prior group only while its authored group remains current. Newer metadata and foreign/own rows survive. |
| GOPS-004 | Populated dated-work browser and real account save/reload are unverified. | Open release gate | Local current-code empty state and refresh inspected; positive mounted component tests do not substitute for the remaining browser/account checks. |
| GOPS-005 | Finance may filter orphan/unresolved own-marker rows before applying the shared evidence gate. | Source finding; reproduction pending | Separate reviewer identified the filter in `lib/finance-plan-source.ts` and empty-state implication in `FinanceGraphs`. Reproduce and repair before enabling proposal acceptance; preserve actual records. |

## Verification

- Node 24 typecheck: clean after registering the writer suite.
- Affected implementation run: **541/541 tests across 27 files**, including 20 writer/action regressions. Existing assertions retained. The separate panel and release-copy checks remain separate evidence, not extra unique coverage totals.
- Full `npm test`: running with all seven added suites registered; no full-suite success claimed. Current-head CI, security and hosted preview gates remain pending.
- Whitespace: tracked and new text files checked before publication; ordered full-run whitespace is recorded when that run terminates.
- Actual local browser: empty Task Planner and refresh at desktop and 390 × 844; phone viewport/content both 390px, no captured console errors. These are empty-state observations, not accepted-cycle/account proof.
- Existing four-page synthetic PDF review found and corrected a misleading free-bed phrase. It is not real farm-output verification.
- Language packets: 124 French/Spanish/Brazilian Portuguese/Swahili plus 93 Hindi/Bengali/Indonesian work-date drafts. Root checked exact 31-source bindings/tokens and 14 damaged controls for each packet family. No fluent review or new runtime language activation. 24 existing-language release candidates have separate Codex provenance.

[Desktop empty state](evidence-grower-operations/empty-desktop.jpg) · [Phone empty state](evidence-grower-operations/empty-phone.jpg)

This changes the planner picture. `PLAN_VERSION`, measured saved geometry, species and calibrated lessons/quizzes remain unchanged. No agronomic figure or local farming approval is supplied by engineering fixtures.

## Next continuation

Finish current full tests/CI and hosted/account review. Reproduce the Finance consumer gap, then implement actual proposal acceptance in a separate child branch with original-review provenance, fresh source/book/actor guards, canonical IDs and writer receipts. Complete Kenya/UK/US/Brazil source and human-review gates independently. Public research/draft packets do not implement provider APIs or grant project publication consent.
