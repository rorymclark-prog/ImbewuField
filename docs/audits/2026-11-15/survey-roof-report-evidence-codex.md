# Survey roof evidence in site reports — 15 November 2026

- Auditor: Codex implementation owner, with a separate actual Codex read-only reviewer. Neither is Claude or AGY.
- Revision: `codex/report-survey-roof-evidence-20261115`, based on `9c1c302c1ab3bc4c6bb82c95e53cf2224ed3b5ce` (tree `e7b6e5edc1e0e0db8a810d3cd50ba4e7d2a61649`), plus this commit's changes.
- Previous audit: [Field-period review reasons](../2026-11-14/provisional-review-reasons-codex.md). The actual subsequent Claude review accepted that candidate and closed R1/R2/R3; its two full CI jobs passed 11,205 each. Those results do not approve this successor.
- Scope: actual `/api/generate-report` prompt and deterministic header, survey roof normalization/evidence and existing survey estimate. No global report-country eligibility change.
- Deployment/CI: successor pending at commit; actual handles/results belong in the PR and issue #35. No production merge or release.

## Findings and disposition

| ID | User-visible problem | Disposition |
| --- | --- | --- |
| SURVEY-REPORT-ROOF-01 | A positive survey-only roof was included in SITE SURVEY while separate calculation instructions denied any measured roof; the header also said not traced or measured | Pure shared normalization carries survey area and recorded entry provenance into the actual prompt/header. Missing map evidence is explicitly scoped to supplied map/design facts. Both map and survey survive discrepancies without addition or silent selection. Two baseline regressions failed before correction. |
| ROOF-REVIEW-01 | New summary initially rounded fractional survey components independently | Preserve supplied numeric precision in survey summary; existing map rounding is unchanged. Controls cover 0.4+0.4 and 60.4+15.4. Independent source delta accepted. |
| ROOF-REVIEW-02 | A finite subtotal could overflow the existing harvest multiplication | A finite-result gate withholds the estimate and asks to verify inputs; known rainfall is not falsely called missing. Single-component overflow and valid zero-rainfall controls pass. Independent source delta accepted. |
| CLAUDE-9C-I1 | Next implementation note should advance its base stamp | New narrow note stamped `9c1c302c1`, preserving earlier notes. |

## Retained contracts

The helper is pure; report facts have only its type import, not a runtime dependency on browser storage/sync. Saved survey component/source validation and field shape stay the same; subtotal is not persisted. Zero, missing, invalid and overflowing components remain distinguishable. Existing map coefficient 0.8 and survey gutter-dependent assumptions 0.8/0.6 are retained as scenarios, not independently validated collection. No new measurements, rainfall, demand, yields, species, lessons, geometry or PLAN_VERSION changes.

New corrected header copy is explicitly English/translation-pending outside English. Frozen translation fixtures remain byte-identical; only the superseded absolute absence expectation is replaced, with all unrelated translations/numbers/provenance assertions retained.

## Verification

- Ordered Node24 typecheck passed; 352 affected checks across 22 files passed, zero failures/skips/cancelled/todo. Full focused-render passed 674/674, likewise zero failures/skips/cancelled/todo. Whitespace and release-note checks pass. New regression file is included in the full-suite package command.
- Actual POST exercised with isolated authentication, country-policy and provider seams. Captured actual prompts and returned deterministic reports for survey-only, mapped144m²/survey75m² discrepancy, and unknown rainfall. Provider narrative explicitly says it is synthetic; no paid generation or real-provider behavior was tested.
- Actual application `buildReportPdf` produced three PDFs (four pages each). All12 rendered pages inspected by owner and independent Codex; changed roof rows remain readable, survey75m² is retained, map144m² and its existing92,160L scenario remain separate, and unknown rainfall stays unknown. Existing general table typography is retained, not redesigned. This changes report text/layout; PLAN_VERSION is unchanged.
- Read-only reviewer first requested the two edge-case corrections above, then accepted their source delta and inspected all three actual captures/12pages. Fractional/overflow controls are separately tested; these three PDFs are not those edge cases. This is not an external Claude/AGY review.
- Private receipts: `survey-roof-report-evidence-20261115` under the existing Imbewu private research root, including LOCAL-VERIFICATION.json, negative controls, command/logs, actual captures and two independent review records. No raw personal records, secrets or logs are committed.

## Limits and continuation

Full successor CI/security/preview and required exact-candidate external outcomes remain separate gates. Survey/map water-inventory reconciliation and legacy workers/household semantics are not fixed here. Signed-in/device, original24 acceptance cases, FIELD-PERIOD-06, PROVISIONAL-PRINT-04, NURSERY-SK-06 and broader P04/G03/local agronomy remain open within their existing scope. Do not infer complete global suitability or measurement accuracy from metadata, tests or model agreement.

Next: push this finished branch once, inspect actual successor CI/preview, prepare the bounded manual delta packet. Preserve accepted9c checkout/review; AGY automatic dispatch remains disabled and Rory initiates external manual reviews.
