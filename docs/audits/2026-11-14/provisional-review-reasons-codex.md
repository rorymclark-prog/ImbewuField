# Field-period review reasons and punctuation — 14 November 2026

- Auditor: Codex implementation owner; actual Claude report remains separately attributed.
- Starting revision: `25c2119f8e868769a603348e9de6215bc8648c35`, tree `869aecdd6ba707731bc70225a2250f4d79062411`, PR #1382.
- Branch: `codex/provisional-review-reasons-20261114`, separate checkout stacked on #1382.
- Previous audit: [Field-period wording and continuity](provisional-period-wording-claude-followup-codex.md).
- Scope: three Low findings from the completed actual Claude desktop review. This changes displayed text. No farming calculations, source facts, saved data/schema, geometry, species, lessons or PLAN_VERSION changes.
- Hosted successor deployment and CI: pending at this implementation checkpoint; exact results will be recorded in the PR and issue #35. No production merge/release.

## Received review and baseline

Actual Claude report: 10,627 bytes, SHA-256 `05678d046a1949abd5e63c45687843077d74ca2327d5696e2b34c78f8ca1da68`. Accepted with three Low findings, no blocking defect, not programme/release/agronomic approval. The earlier F-1 period wording and F-2 continuity findings were accepted. Both baseline full CI jobs passed 11,203/11,203. Those results apply to the starting revision, not this successor.

## Findings and disposition

| ID | Problem | Disposition and verification |
| --- | --- | --- |
| CLAUDE-25C-R1 | A withheld clear date falsely blamed an absent date or positive duration when an entry-month exclusion or incompatible occupancy already caused the hold | Cause-neutral reason directs the grower to entry-window/timing checks. Tests use the actual planner for both causes, preserve the raw reason and positive occupancy, and retain the exact-equality available boundary. |
| CLAUDE-25C-R2 | Release note implied all historical entry-month comparison text changed | Narrowed to field-period temperature comparisons; legacy version1 is deliberately unchanged. Note is 77 characters. |
| CLAUDE-25C-R3 | Missing-value clause supplied a stop before the caller's stop or semicolon | Private monthly clause strips only its terminal full stop. Entry line and month row each keep the correct outer separator; stored reasons remain unchanged. |
| CLAUDE-25C-I1 | Separate baseline GitHub preview failed in unchanged Next font loading | Retained as a dated failure, not silently retried or erased. Baseline native Vercel succeeded; successor preview must be checked separately. |
| CLAUDE-25C-I2 | General evidence blocks still contain machine-like provenance labels | Outside this bounded period-sentence change. No whole-export readability claim. |
| CLAUDE-25C-I3 | Zero annual-rainfall software control has positive monthly values | Existing isolated annual-line control, not a coherent farming recommendation; retained climate/source records not rewritten. |

## Verification

- Node 24.22.1 typecheck passed; all 298 affected checks across nine files passed, zero failures/skips/cancelled/todo. Complete focused-render suite passed 674/674, also zero failures/skips/cancelled/todo.
- Baseline negative controls failed on old cause/punctuation wording. A new test initially used `invalid` instead of the authoritative `invalid-inputs` enum; corrected that assertion to the actual contract before the final passing run, without weakening the behavior checks.
- Seven exact-input current/parent raw result comparisons are deeply identical. Three unchanged period HTML reports are byte-identical; the withheld-June report differs only by removal of the doubled stop. Six old origin1/2 HTML/fingerprint replays remain exact.
- Four actual application HTML reports were printed with WeasyPrint and rendered by Poppler: 20 pages inspected in a complete montage, plus all four changed temperature pages at full size. No clipping/overlap observed. Existing sparse final pages remain; this is not browser/physical print acceptance.
- An actual planner-generated, accepted origin3 row with missing entry-month climate exercised the mounted screen and single/bulk calendar download actions. All six tasks retain the exact evidence, DEMO labels and corrected separators; no private structural keys or saved writes. Stale source A→B→A still prevents delivery. Account/source-check/download sinks are isolated test seams; no calendar-device import claim.
- Whitespace/release-note checks run before commit. Full successor CI is required and separately tracked, never inferred from the starting revision.

## Limits and continuation

All new dates, durations, area and yield used by the controls are explicitly synthetic engineering choices, not crop recommendations. Retained public climatology is gridded historical evidence, not local weather or local agronomic validation. No new threshold, timing, yield or water demand is introduced.

Carry FIELD-PERIOD-06, PROVISIONAL-PRINT-04, NURSERY-SK-06, broader P04/G03 coverage and the 24-case programme acceptance matrix forward. No signed-in available-climate/device validation is inferred. Primary Ethiopian PDF TLS/reuse limits remain unchanged. Independent Codex review is not Claude or AGY; exact-successor external gates remain separate.

Next: commit/push once, inspect actual successor CI/preview, and prepare the bounded manual review delta. AGY automatic dispatch remains disabled; Rory initiates manual reviews. Private receipts: `claude-r1-r3-followup-20261114` under the existing Imbewu private research root. Original reports/archives/manifests are preserved.
