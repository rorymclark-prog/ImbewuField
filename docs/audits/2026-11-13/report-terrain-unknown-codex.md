# Missing report terrain fields — 13 November 2026

- Auditor/writer: Codex; branch `codex/report-terrain-unknown-20261113`.
- Base: `7791a6a2ba186bf53f486b2d5fb575f6c7b8b57e`, tree `71c5fa94514339ac953632f5aa65dfb8d81868a4`, draft PR1358.
- Previous audit: [soil and earthworks evidence](report-soil-earthworks-evidence-codex.md). Independent Codex accepted that bounded correction; its terrain-header finding is carried here without reopening prior closures.
- Deployment inspected: parent public build-info returns HTTP200 and7791a6a at the report-soil-earthworks preview. No terrain successor deployment yet.
- Evidence type: actual parent and corrected assembled mocked responses, source review, affected tests, original PDFs and real-reader fixtures. Independent successor review and CI gates remain open.

## Finding and correction

| ID | Problem | Disposition |
| --- | --- | --- |
| REPORT-TERRAIN-HEADER-OPEN | A runtime slope outage prints962m/undefined-degree/N in the deterministic header while the register correctly says slope unknown | Implemented and locally verified; independent successor review and CI pending. |

One shared terrain-value helper now keeps missing or malformed elevation, slope,
percent slope and aspect independent. Slope reuses the existing0–90-degree geometric
validation; it adds no agricultural threshold. Finite signed elevation, genuine
zero, recorded finite percentage and nonempty direction labels survive. Missing
values are not coerced from strings or inferred from another terrain field.

The actual elevation producer uses an em dash for direction when relief is too low
to support one. That sentinel and explicit unknown labels stay unknown; they are
not called lateral slopes. A retained direction is described as a recorded estimate
requiring site confirmation, without inferring warmer/drier or cooler/moister
conditions from the text label. No elevation producer, sampled geometry or saved
record is changed.

The header preserves exact prior output when all three recorded fields are valid.
For partial evidence it retains supported values, labels the missing fields and
qualifies provenance. New non-English text is visibly English pending translation.
The prompt preamble and water-strategy template use the same values; the structured
document no longer retains an empty/sentinel aspect as if it were a direction.

## Verification state

- Three targeted regressions fail on the parent for the intended header/prompt/structured unknown claims, with no import/setup failure.
- Initial affected pass:474/474 across38 files. Typecheck also exits0, but completion was not observed before that initial pass started; this is not claimed as ordered final verification.
- Final frozen-source verification runs sequentially: typecheck0,474/474 across38files, whitespace0, current release-note gate0 and release-note tests5/5. No failures, cancellations, skips or todos. The initial overlap is not reused as ordered evidence.
- Cases include absent/null/nonfinite/nonnumeric slope, signed/zero elevation, source-produced unconfirmed direction, independent missing fields, tiny positive and boundary degree values, source input preservation, current native-language pending labels and the actual mocked POST consumer.
- Prior accepted soil/earthworks/lab/status/footer and slope-risk corrections remain; their tests are retained. No species identity, lesson, schema, measured geometry, plan version, calendar, provider, account or workflow changes.
- Six actual deterministic builder cases cover missing slope, all missing fields, nonfinite values, zero, signed elevation and source-produced low-relief direction, across English and four native header languages. Input records are unchanged.
- Eighteen actual per-batch requests and six assembled responses are retained with provider/auth/payment boundaries mocked. The actual outage response now retains962m/N and says slope not known. Prompt assembly, not live model compliance, is verified.
- Four original one-page `buildReportPdf` exports were rendered and every page opened: English/isiZulu, missing slope and negative elevation with zero slope. Six actual-reader/CSS fixture images were opened at390/1280px in light/dark. The new text wraps without document overflow; zero, signed value, raw direction and pending-English qualification remain readable. Surrounding fixture styles are explicit; these are not the full signed-in app or physical devices.
- This changes report text and the exported picture. No agricultural, fluent-human or release approval is claimed. All owned temporary browser/server resources were closed and their PIDs verified gone.

## Remaining work

Bind the frozen source and inspected outputs to the final commit, then obtain a
finite independent delta review.
Push the finished branch once, stacked on PR1358, and establish its own applicable
CI/security/render/preview gates. Current7791 full jobs continue separately and
cannot approve this successor. Historical long-report pagination, genuine account
and device checks, local agricultural validation and the original global-planning
acceptance requirements remain distinct. Claude/AGY automated routes stay held;
preparing a manual packet is not a completed external review.
