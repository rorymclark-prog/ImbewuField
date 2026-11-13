# Provisional source history in general reports — 13 November 2026

- Auditor: Codex implementation owner; bounded independent review pending.
- Base: `2e870fb0c4a185b69e7dfa9e209f0980697c3bcc`, draft PR1353.
- Branch: `codex/provisional-report-history-20261113`, stacked on PR1353.
- Previous: [Cycle adoption app and exports](provisional-cycle-app-exports-codex.md).
- Scope: general report archived crop-row projection, ReportCropPlan component/CSS, report crop PDF appendix. No catalogue, farming values, live acceptance or geometry change.
- Deployment inspected: parent2e preview only; this correction is not yet deployed.

## Reproduction and correction

The actual saved provisional attachment normalized successfully, and its report
snapshot was admitted. `reportCropRows` then re-assessed without the recorded
provisional context or count-area binding, returning "invalid or unsupported"
and hiding all its own dates. A new test failed on that actual status assertion
against2e, independently of fixture/transpilation setup.

The existing attachment normalizer remains the archive admission authority. The
report now passes its validated recorded review context and count-area binding
back to the existing assessor. It does not manufacture a current geometry/site
approval, re-date source history or make a present-day evidence claim. A different
report site, malformed review or changed binding still holds and retains its raw
marker. Own rows remain excluded from regenerated catalogue calendars and food
forecasts.

The existing public-evidence projection supplies country/region, original/new
review dates, source/attribution/reuse limits, chosen inputs, zero/unknown values
and caveats to both report screen and PDF. It omits structural actor/source-key/
policy fingerprints. Authored text and public URLs are still intentional content,
not a general guarantee that arbitrary entered text contains no private data.

The screen disclosure has a separate print representation. Reusing optional-notes
styling would have hidden the new evidence in browser prints. Screen and print
representations use the same data; CSS selects one, including when the screen
disclosure stays closed. The PDF checks glyph support before encoding and wraps
source paragraphs with a member-labelled continuation. An inspected preliminary
PDF split "Evidence default: Unknown" across pages; the final layout reserves a
whole source paragraph whenever it fits a fresh page.

## Findings and disposition

| ID | Problem | Status / evidence |
| --- | --- | --- |
| G04-REPORT-HISTORY-01 | Valid provisional archive falsely became unsupported in the general report | Reproduced and corrected; final checks/output/review recorded below |
| G04-REPORT-PRINT-01 | Optional-note print CSS would omit the new source disclosure | Corrected with separate shared-data print view; actual collapsed-disclosure browser print required |
| GLOBAL-CURRENT-HEAD-CI | Farming/report successor needs exact-head full checks | Open; parent CI does not approve this delta |
| GLOBAL-EXTERNAL-REVIEW | Existing AGY/Claude-through-AGY403 hold | Open; no retry, alternate account/auth/provider bypass or fabricated review |
| GLOBAL-AGRONOMY-VALIDATION | Source facts and test arithmetic are not local farming accuracy | Open; synthetic region declaration and counts are engineering controls |

## Verification

- Initial focused test: genuine failure of the expected archived-status assertion, retained separately.
- Typecheck: clean before affected checks; final status recorded with the exact successor.
- Final affected run:1,623 pass, zero fail/cancel/skip/todo across92 existing registered test files,107.95seconds. All old report/intent/site isolation checks retained.
- Release-note/type-floor checks:16pass, zero failures. Final typecheck repeated with explicit exitCode0 receipt after the notes update; whitespace clean.
- Source fixture: actual optional undated USDA Great Lakes cabbage method reference; original12November and new13November review dates remain distinct. Synthetic density/timing and recorded zero yield are not guide recommendations.
- Invalid cases: missing review, changed country, wrong area binding and foreign report site hold; no dates/evidence are borrowed from the valid neighbour.
- Actual component SSR uses the real row projector; only browser IO/module boundaries are controlled. It does not mount live auth/sync effects or claim a real account flow.
- The existing CID/ToUnicode PDF text decoder moved unchanged into a shared test helper. Existing intent-delivery assertions are retained and use the same decoder.
- PDF scope: actual `drawReportCropSummary` under both existing catalogue-permission branches, with an explicitly synthetic opening page. Not a paid generated narrative or a complete real site report.
- Output inspection: all7actual report-appendix PDF pages (including2synthetic opening pages), all2collapsed-disclosure browser-print pages, and desktop/phone/light-dark fixture screenshots viewed. No missing source text, observed clipping or horizontal page overflow. The fixture uses the actual CSS module and existing report color tokens with browser-IO stubs, not a deployed report session.
- Both own browser sessions closed; no local preview server was started for the report fixture.
- Parent hosted verification: exact2e build-info, actual sample accept/reopen/historical download and country-change hold pass; five original historical PDF pages inspected. It does not cover this separate general-report correction.
- Parent protected location-data returned401 for the unsigned sample. No bypass or live geographic claim; no real account/device/sync/reload validation.
- No workflow, species, geometry, auth or paid route change. This changes the report screen/PDF; `PLAN_VERSION` stays unchanged.

## Next continuation

Finish actual report screen/print/PDF inspection and applicable tests, obtain a
bounded independent delta review, push the finished successor once and wait for
its own full CI/rules/preview. Retain parent CI/review receipts separately. Do not
merge or label the full global milestone complete while applicable gates remain.
