# Short-report rainfall evidence — 13 November 2026

- Auditor: Codex / Command Centre; branch `codex/summary-rainfall-evidence-20261113`.
- Base: `a3fcfcda2bf22953a1038e8687a3285e05d61b33`, tree `c2672a714e5544f4e514796c3c680d9b27d7c572`, draft PR1367.
- Previous: [Report irrigation evidence](report-irrigation-evidence-codex.md), [Report terrain unknowns](report-terrain-unknown-codex.md) and [Tomato source continuation](usda-tomato-nursery-codex.md).
- Scope: existing one-page/five-page report summaries and their prepared full-report assembly. No new farming number, rainfall source, species, geometry, saved data, translation, workflow or PLAN_VERSION change.

## Finding and correction

| ID | Reproduction | Disposition |
| --- | --- | --- |
| REPORT-SUMMARY-RAIN-EVIDENCE-01 | Actual `reportSummaryPages` prints the saved791mm placeholder with no/estimate source, even though the main report's existing `annualRainfallMm` returns null for that same input. | Use that shared authority before summary formatting. Missing, unsupported, nonfinite, negative or wrong-type annual values remain unknown; supported zero and sub-millimetre values remain exact. |

The same short-page assembly is used by `sampleFullSiteReport`; it now preserves the same distinction. Existing translations supply the unchanged labels and unknown wording. Historical fixtures/source-pair packets are not rewritten. Already sourced values and every unrelated line retain their existing snapshot checks. The correction changes visible report text only for previously unsupported annual values; it does not classify rainfall adequacy or water demand.

## Verification

- New actual-function regression fails on the exact base for the intended English one-page rainfall line; six existing/new positive tests pass. No setup/import failure or test deletion is counted as proof.
- Ordered typecheck exits0, then178 affected checks across12 existing test files pass with zero failures/cancellations/skips/todos, then whitespace exits0. New cases cover all five report languages, both page counts, prepared assembly, missing/unknown sources and invalid values; sourced0,0.25and791 remain unchanged. No historical assertion is weakened.
- The real `buildInkSummaryPdf` generated three original DEMO files: English one-page unknown, English one-page sourced zero and isiZulu five-page unknown. PDF text extraction finds the expected exact unknown/zero wording and no791mm claim. All seven rendered pages were opened and visually inspected; headers, body, footers and page counts are readable without observed clipping in these bounded fixtures.
- Outputs use prepared sample location and synthetic rainfall overrides; not a live site or agronomic validation. No AI/provider request, real-account save, hosted UI/download or fluent language approval is inferred. No local preview server was needed.
- Actual source, inputs, original PDF files, PNG renders, negative control and checks are retained in the private `summary-rainfall-evidence` packet; no raw logs or personal records are committed.

## Remaining gates

Independent exact source/output delta review, own required current-head CI/security and preview remain separate. Parent test results are not successor approval. Original P01–P24 global milestone remains intact; external Claude/AGY route hold is unchanged and manual packets are not completed reviews. No production merge/release is approved.
