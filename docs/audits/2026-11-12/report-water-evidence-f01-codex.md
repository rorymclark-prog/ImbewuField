# Report annual rainfall evidence — 12 November 2026

- Writer: Codex, sole writer of `codex/report-water-evidence-f01-20261112`.
- Base: `c8c00515e97ae810b4e95d4e9c3898d82196a1ac`, tree `0ba5b9749e20c5b1c150ff4248094e7092625e5e`.
- Scope: CSR-15A-F01 in report risk rows and structured document challenges.
- Previous audit: [Water/climate corrections](report-water-climate-corrections-codex.md), preserved unchanged.
- Draft successor stacked on PR1341; no merge, release or provider review.

## Correction

The former positive annual-rainfall test below 500 mm assigned High likelihood and High impact to crop failure and prescribed storage. The structured document called the same total low/erratic rainfall and made storage the priority. Neither conclusion follows from an annual total. Extending those guards to zero would have made that unsupported advice more widely reachable.

Those two judgements are removed. One shared unrated statement prints the supported annual total, including true zero, or unknown. It explicitly leaves crop demand, seasonal supply and water adequacy unassessed and does not infer crop-failure likelihood or required storage. The route supplies its existing provenance-gated annual value. The document places the note before its existing five challenge slots, preserving those slots. The risk note remains visible with both empty and populated registers.

The original translation packet and historical fixtures are unchanged. Localization expectations retire only the unsupported rainfall row and renumber the retained rows; all other source wording, figures and ratings remain checked. Native report tables retain their existing translations. The new note is explicitly labelled English with translation pending. No new translated advice is activated or claimed fluent-human approved.

## Verification

- Final `tsc --noEmit`: exit 0. An initial test-harness property-path mistake was corrected before this final check.
- Seven affected report/localization/PDF test files: 126/126 passed, no failures, skips or cancellations.
- Final regression and release-note checks: 22/22 passed (11 report regressions repeated plus 11 release/update checks).
- Seven new or expanded regressions fail on exact c8 product files through a read-only loader: six rainfall-state cases and the real report POST. Four pre-existing c8 regressions continue to pass. No baseline worktree edits.
- Actual POST runs have provider/payment/authentication boundaries mocked. Cases cover unknown with an unsourced placeholder, 0, 0.5, 499, 500 and positive annual rainfall; no remote provider request.
- Whitespace and release-note drift checks passed. No unrelated long full suite rerun locally; current-head CI is required separately.

## Output inspection and retained limits

Actual generated markdown, structured document JSON and original `buildReportPdf` exports were saved for unknown, 0, 499 and 900 mm/year. The affected PDF pages were rendered and inspected. The original ReportView renderer was extracted into an isolated synthetic HTML fixture: desktop and 390 px phone screenshots show readable notes, including the explicit isiZulu-report English fallback. Phone scroll width equals 390 px. Surrounding fixture CSS is not the authenticated app layout; model body text is mocked and no physical print or paid model output was inspected.

A pre-existing PDF pagination defect remains: the risk-table header can sit alone on page 6 with its rows on page 7. Exact c8 exports with the same inputs reproduce this; both predecessor and successor screenshots are retained. The new note is intact and the next page repeats the header. This observation does not close the defect or approve the whole export.

Other retained advice is outside F01: roof-runoff/storage prescriptions, unvalidated slope/soil ratings, generic document priority actions, and prior irrigation assumptions. Their presence is not newly validated by removing the rainfall judgement. Saved older reports are not rewritten. Source and translation evidence are not agronomic validation.

This changes displayed report text and the exported picture; PLAN_VERSION is unchanged. Applicable current-head CI and explicit independent same-candidate review remain open. No Claude or Flash review ran on this successor; no release approval is claimed. All temporary browser/server resources owned by this task are stopped before handoff. Exact source and output hashes are in the private review packet.
