# Saved-site country status — 10 November 2026

- Auditor: Codex, continuing Rory's international-app improvement sprint.
- Reviewed revision: released baseline `dc48b9c06b6e0cc7e733bc6dd67311d17855b506`, branch `codex/site-country-status-20261110` plus this change.
- Deployment inspected: baseline is live; changed preview remains unverified.
- Previous audit: [Country evidence next steps](country-evidence-next-steps-codex.md), carrying forward COUNTRY-UI-001 as separately released in PR1330, and [review help](international-in-flow-help-codex.md), released in PR1332. Neither closed finding is reopened.
- Scope: the existing saved-site country panel, visible status and planning-availability explanation only.
- Evidence type: actual source and component-output checks; no physical-device/account or local agronomy approval.

## What was already done

The country resolver distinguishes confirmed, unknown, conflicting and missing mapped sites. `sitePlanningSupport` is already the authority for automatic planning availability: confirmed South African sites use the existing planner; other countries retain reference-only support. Country confirmation never approves local agronomy. The panel already keeps local save and cloud acknowledgement separate.

The independently reviewed AGY batch11 proposal P-01 identified a real copy ambiguity: unknown and missing-site resolutions shared the top summary, although their next actions differ. Its broader usability consequences are hypotheses, not measured farmer findings. This change does not shorten the confirmation form or decide CP-047.

## Findings and disposition

| ID | User-visible problem | Status | Evidence and next action |
| --- | --- | --- | --- |
| COUNTRY-STATUS-001 | An unopened map and an existing saved site needing country confirmation share the same top instruction | Implemented; changed-output review pending | Missing sites now ask the grower to open or save a mapped site. Unknown saved sites ask for country confirmation; conflicting aliases retain their distinct instruction. |
| COUNTRY-STATUS-002 | A saved country is shown without explaining the existing automatic-planning boundary | Implemented; changed-output review pending | The panel reads `sitePlanningSupport` without changing it. Confirmed ZA retains reference-planning availability and local-condition qualification; other countries explain unavailable automatic planning and reference evidence. Unsaved selector edits do not change this saved-state explanation. |

## Verification

- Typecheck: passed with Node26.5.0,3072MiB heap, `tsc --noEmit --incremental false` on final code and release note. Existing dependencies reused from an identical lockfile; no install or package changes.
- Affected checks:47/47 across six existing component/context/readiness/type-floor/release-note files, one worker,0fail/cancel/skip/TODO,4.80seconds.
- Negative control: the same two new component cases fail against the exact prior SiteCountryPanel (0pass/2fail); candidate restored byte-exact. Whitespace and release-note gates passed.
- Component cases cover unresolved states, ZA and four pilot countries, unsaved selector edits, unchanged input records and no writes while reading. Existing save acknowledgement and evidence-navigation tests remain intact.
- Full suite: no duplicate local run; new candidate CI is separate from the earlier releases.
- Actual changed-preview phone/theme appearance: not yet inspected. A green source suite is not appearance proof.
- This changes visible panel text and height, not map artwork. `PLAN_VERSION`, site resolver/policy, store/sync, country form controls, crop calculations, calendar, species, lesson content, provider dispatch, security rules and translations are unchanged.

## Next continuation

Inspect an exact changed preview on the existing sample site with unknown and confirmed country states at phone width in both Earth themes. Confirm form controls remain reachable, availability follows only the saved description, and reading/editing the form does not save it. A temporary sample choice must remain inside sample mode. Record exact current-head gates and output evidence before using AGENTS section1's focused-UI merge authority.
