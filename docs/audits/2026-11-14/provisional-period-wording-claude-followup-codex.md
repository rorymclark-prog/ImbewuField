# Field-period wording and report continuity — 14 November 2026

- Auditor: Codex implementation owner. Actual external reports retain their own attribution.
- Starting revision: `af401d2a57835aceb932e32934d23a6e1fa7572f`, tree `6da49ec0120147ea27ce243e042d8a718594ca46`, PR #1379.
- Branch: `codex/provisional-period-wording-20261114`, stacked on #1379 in a separate checkout; the reviewed baseline remains intact.
- Previous audits: [Field-period comparison](field-period-temperature-codex.md), [Climate fixture](page-consumer-climate-fixture-codex.md), [Short-report rainfall](../2026-11-13/summary-rainfall-evidence-codex.md).
- Scope: shared period display sentences, affected tests and fresh output evidence. This changes the picture. Values, dates, raw states/reasons/provenance, saved schemas, geometry, species, lessons and PLAN_VERSION are unchanged.
- Hosted successor deployment: not inspected at this implementation checkpoint. No production merge/release.

## Received baseline reviews

Actual manual AGY report: 35,996 bytes, SHA-256 `364d5f6fbe779c67cb19273f6d3cf71a841629f0173adc0de9f9a45c07032b81`. No new blockers; bounded engineering acceptance. Its manifest byte-count typo is recorded separately (47,614 actual bytes, matching SHA). Both baseline full CI runs passed 11,201/11,201; its pending duplicate-CI observation is closed.

Actual Claude report: 13,162 bytes, SHA-256 `0cd4714a9e5ab3bc5052efb012261ef2c28490ece664798216e713afc1218d20`. Fixture correction accepted, with two Low findings and three informational observations. Neither report is approval of this successor or local agronomic validation.

## Findings and disposition

| ID | Problem or evidence gap | Disposition |
| --- | --- | --- |
| CLAUDE-AF40-F1 (Claude F-1) | Internal comparison/reason codes in shared period sentences | Plain displayed states, reasons and occupancy provenance; raw data remains intact. The screen, report and calendar use the same formatter. Two new regressions fail on the baseline and pass after correction. Unrelated general evidence-provenance blocks retain their existing machine-like labels; this is not a whole-export rewrite. |
| CLAUDE-AF40-F2 (Claude F-2) | Seven unchanged entry blobs were used to support older outputs without checking imported dependencies; current ink-summary originals were omitted | Supersede blanket equivalence with a reproducible AST import-closure ledger and fresh exact-input short summaries. One entire local closure is unchanged; six contain changed modules. Static reachability is not executed-path proof. |
| CLAUDE-AF40-F3 | Unrealistic DEMO tomato durations | Retained as synthetic arithmetic inputs, not realistic plans or recommendations. No new thresholds invented. |
| CLAUDE-AF40-F4 | Historical criterion transferred beyond Ethiopia | Existing explicit transfer and local-applicability limits remain. Claude's primary-PDF fetch failed TLS verification; no bypass or new source approval. |
| CLAUDE-AF40-F5 | Existing exclusive picking/clear boundary dates | Existing named boundary convention retained; no new picking-day claim. |

## Output and continuity verification

The reproducible ledger records all seven historical entry blobs and their imports at the baseline and successor, including type-only edges, node hashes, changed package manifests, untraversed external dependencies and a nonliteral locale import. The length-unit preference's eight-node local closure is unchanged. Six other closures contain changed modules; `@noble/hashes` 2.4.0 is the sole added declared dependency versus those historical baselines. Do not call all older outputs source-identical.

The short-summary rainfall correction already landed in `6b9de2c4`; it is not new here. Three fresh actual jsPDF outputs reproduce exact retained English unknown, English supported-zero and isiZulu five-page inputs: seven pages total. Semantic page arrays match the retained expectations; inputs remain unchanged. Unsupported rainfall is Not recorded and a supported zero remains 0 mm. This closes the missing current ink-summary surface, not every account/device/historical output path.

Five fresh actual period HTML/PDF outputs retain original source climate and engineering inputs, including London outside-range, withheld June and year rollover. All 25 rendered pages were inspected in complete per-report sheets, plus full-size outside-range/missing-value pages. All seven short-summary pages were inspected too. No clipping/overlap observed in these artifacts. Inherited sparse last pages and the split evidence article remain non-blocking pagination observations.

Actual mounted calendar callbacks generate fresh single/bulk files with public evidence lines, DEMO identity, all six dates, private-structure exclusion, stale-source round-trip hold and zero saved writes. Six older origin1/2 HTML exports replay byte-identically with original fingerprints.

## Checks and remaining gates

- Final Node 24.22.1 typecheck passed; 296/296 affected checks passed across nine files, zero failures/skips/cancelled/todo. The intermediate Node 26 affected run also passed 296/296. Both new regression tests fail against the baseline for the reported wording.
- Whitespace and pending release notes checked before push. Full successor CI is separate; baseline green does not establish successor green.
- Source-alignment and local agronomy remain separate. No new farming numbers or document redistribution permission.
- Hosted authenticated climate, independent benchmark/local validation, broader P04/G03 evidence coverage, FIELD-PERIOD-06, PROVISIONAL-PRINT-04 and NURSERY-SK-06 retain their applicable limits.
- Exact-successor external outcomes remain required as applicable. Codex support is not another Claude/AGY review; no production release approval.

Private source/output receipts are under `claude-findings-followup-20261114` in the existing Imbewu private research folder. Original external reports, historical evidence and manifests are preserved.
