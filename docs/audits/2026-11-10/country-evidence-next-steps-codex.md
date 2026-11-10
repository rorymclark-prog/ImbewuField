# Country evidence review next steps — 10 November 2026

- Auditor: Codex, continuing the renewed global-app implementation instruction.
- Reviewed revision: baseline `29e5516d9195a75f300985015e9dfc4c7c2cf8f4`, branch `codex/country-evidence-next-steps-20261110` plus the changes described here.
- Deployment inspected: none for this change. Current production verification belongs to PR1329; it is not verification of this branch.
- Previous audit: [International combined-source continuation](../2026-11-07/international-release-next.md). Its release gates remain historical; no closed finding is reopened here.
- Scope: country evidence cards on `/international`; explanatory presentation only.
- Evidence type: source inspection and actual React component tests. Browser/physical-device appearance is unverified.

## What was already done

The existing readiness evaluator distinguishes available dated references, absent full-source evidence, overdue review and missing/unusable dates. Country, region and language remain separate. The international production engine stays unavailable. Pilot dossiers, official links, evidence claims, limitations, source metadata and provider request behavior are retained.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| COUNTRY-UI-001 | Evidence cards expose raw state names such as `undated`, without explaining what needs review; the recorded review deadline is absent from the displayed metadata | Implemented; visual verification pending | Each source now explains the existing decision, gives a bounded review next step and displays its actual review deadline or unknown. Category counts use the existing evaluator's available count, not source presence. No dates or evidence are invented. |

The new English explanations belong to the existing English review draft. They do not activate an AI dictionary or constitute fluent review. A source's access/modification date cannot replace an unknown publication date. A dated reference alone does not approve local farming advice.

## Verification

- Typecheck: passed with `tsc --noEmit --incremental false`, Node26.5.0 and a3072MiB heap. The initial attempt used an older shared dependency set and failed on missing existing zip/sax packages; switching this checkout's own dependency link to the existing complete released-candidate dependency set resolved those diagnostics. No package, lockfile or shared dependency was changed.
- Affected tests:83/83 passed across nine existing test files, one worker,0fail/cancel/skip/TODO,5.95seconds. Includes readiness positive/negative controls, source/provider contracts, real parent navigation, linked-country/reset/late-response behavior, composed DWD/BMKG references and release-note gates. Two additive tests cover seven source-state/date cases and all four pilots plus unsupported selections.
- Adverse controls: mislabelling undated evidence as dated and counting every recorded source as available each failed the new tests. Actual source restored afterward.
- Full suite: no duplicate local full run. New candidate CI has its own result; previous10,542-pass runs do not validate this change.
- Whitespace and local release-note gate: passed before publication. Record current-head CI separately.
- Output inspected: actual React summaries, review actions, retained metadata/link/claim text and per-purpose counts. Supported CUA inventory returned no browsers and a disabled-setting error; no navigation, server or browser workaround was attempted. Phone layout, theme contrast, keyboard interaction and changed-preview appearance remain unverified.
- This changes the country evidence page's visible text and card height. No map picture or `PLAN_VERSION` change. No source registry, readiness decision, saved record, geometry, farming calculation, crop data, calendar, security rule or provider dispatch change.

## Next continuation

Inspect the exact changed preview at `/international?country=US` and the other pilots: expand an undated source and confirm the next step, unknown publication date and actual review deadline remain readable at phone width. Check the unavailable-source and unsupported-country views, keyboard disclosure behavior and both themes. Do not merge or describe appearance as verified before actual supported-browser evidence is available. Keep current-head CI status explicit. Claude retains crop UI/data/calculation/climate/calendar ownership; native AGY synthesis remains subject to actual Argon quota availability.
