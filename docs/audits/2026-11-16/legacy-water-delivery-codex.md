# Legacy watering-method read compatibility — 16 November 2026

## Scope and starting point

- Owner: Command Centre / Codex. Branch `codex/legacy-water-delivery-20261116`.
- Starting commit: `d48e2516674f81655ad5a032a7b7a009ed08a0b7`.
- Previous audit: [Survey water evidence](../2026-11-15/survey-water-report-evidence-codex.md).
- Trigger: actual Claude source-only review of d48, information item I-2.
  It accepted that candidate's source/tests/CI but did not receive its output
  packet. That acceptance is neither output review nor successor release approval.

## Reproduction and correction

`SiteSurveySheet` and the prompt formatter retained a historical scalar
`waterDelivery` fallback, but `loadSurvey` normalised it through the generic
array-only reader first. A saved `"drip"`, `"none"` or unknown historical method
therefore became an unanswered list. Direct raw API input also has separate
survey-prompt and deterministic-header entry boundaries.

`SURVEY-DELIVERY-LEGACY-01` uses one pure delivery-only scalar/array normalizer in
`lib/report-survey-water.ts`, reused by both `normaliseSurvey` and
`surveyWaterEvidence`. It trims and deduplicates current arrays identically and
wraps the documented old string shape once. It does not split or interpret
historical text, accept arbitrary objects, or broaden scalar source/storage
fields. Unknown text remains unrecognized; explicit none stays explicit.

Direct load returns a compatible view without changing the stored original.
Existing explicit save and eligible place-id migration retain the answer in the
current array format; their existing account/site, timestamp, storage-failure and
sync boundaries are not changed. Draft parsing remains strict; no revision or
changed-saved-answer warning is bypassed. No user records were read or migrated
for this work; examples are synthetic memory-storage controls.

## Checks and original output evidence

Private originals and exact command/log/hash receipts live under
`/Users/roryclark/.codex/imbewu-private-research/global-provisional-adoption-20261113/legacy-water-delivery-20261116`.

| Case | Before | After / verification scope |
| --- | --- | --- |
| Stored scalar delivery, actual load and prompt | Reported unanswered | Retained singleton and correct prompt; raw bytes unchanged; another account cannot read it |
| Raw API scalar, deterministic header and survey prompt | Lost answer | Both preserve the same delivery; a normalizer-only fix would leave the header wrong |
| Current arrays / none / unknown / malformed | Existing distinctions | Preserved; unknown scalar structure is escaped in header tables; other scalar fields remain rejected |
| Existing place-id migration and explicit save | Scalar lost | Current array saved while old receipt and saved date remain intact |
| New regression controls against original code | Three failures | Actual lost-answer and raw-route failures, not a pinned implementation constant |
| Node 24.22.3 typecheck | Clean after test typing correction | Clean on implementation |
| Affected survey, report, roof and localization checks | 45/48 on initial two-file baseline | 130/130 across seven affected files; zero failed/skipped/cancelled/todo |
| Release note / whitespace | Next note needed | Checks pass; note covers legacy display and previously described field-clear wording |
| Actual report output | Old input lost | Three actual POST captures; actual app PDF writer produced three four-page PDFs |

All 12 PDF pages were rendered and inspected by Codex. The changed rows are
readable: `Drip irrigation`, explicit `Rain-fed only`, and an unrecognized
historical method remain separately farmer-reported. The mapped 2,500 L tank is
not added to survey quantities. Existing report styling is retained; this changes
the displayed answer, not measured geometry or farming calculations.

POST captures isolate auth/country/provider seams and use an explicitly stubbed
narrative. No live provider, paid generation, real-account/cloud acknowledgement,
device import, isiZulu translation acceptance or local farming validation is
claimed. Existing generic qualitative risk rows are not independently approved
by this compatibility check.

## Findings and gates

| ID | Severity / owner | State and closure evidence |
| --- | --- | --- |
| SURVEY-DELIVERY-LEGACY-01 | Moderate compatibility/data-display defect; Codex | Implemented with baseline failures, affected checks and actual outputs; successor exact-head CI and applicable external review remain separate |
| CLAUDE-D48-I-1 | Process note; Codex | Next release note added; no completed review relabelled |
| SURVEY-REPORT-WATER-01 | Carried report-source boundary | Original source-only Claude acceptance retained; original missing packet/output review still open |
| FIELD-PERIOD-06 / PROVISIONAL-PRINT-04 / NURSERY-SK-06 | Carried programme/release limits | No broader closure asserted by this change |

Full exact-head CI is required because this changes saved-record read
compatibility and existing normalization at explicit save/migration boundaries.
No merge or release is authorized by this record. The original P01–P24 and
G01–G05 milestone, applicability gaps and independent validation limits remain.
Species, lessons, farm geometry, provider/auth/paid routes and PLAN_VERSION are
unchanged. Required reviews must name the final candidate, not its accepted parent.
