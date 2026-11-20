# Report water and climate corrections — 12 November 2026

- Auditor/writer: Codex, sole writer of `codex/report-water-climate-corrections-20261112`.
- Base: `15aeada5782ba781a83d58387fea8194b4572ca4`, tree `24010e2f4cbadc0c8742a9ccfa72677f51c01c50`.
- Deployment inspected: none. This is a draft successor; no merge or release.
- Previous audit: [Crop-plan decisions](../2026-11-11/crop-plan-decisions-claude.md).
- Immediate evidence: Command Centre's CSR-15A source review and parent disposition on the exact base, retained unchanged in the private review packet. Its requested Claude identity was unverified, so it is not Claude release approval.
- Scope: report prompt, deterministic header season arguments, roof-storage comparison and ReportView climate footnote. No model dispatch, paid generation, saved-data change or farming threshold change.

## Findings and disposition

| ID | Problem | Status and evidence |
| --- | --- | --- |
| CSR-15A-F02 | Storage bullets requested an invented deficit immediately after withholding it. | Corrected in water and irrigation storage bullets. Recorded capacity remains separate from demand, available supply and adequacy. Actual mocked POST captures both storage branches; no paid request. |
| CSR-15A-F04 | Zero harvest divided storage by a fabricated litre; rounding also distorted small positive harvests. | Zero denominator now explicitly undefined. Positive ratios use the unrounded harvest. Neither ratio diagnoses the binding constraint or storage adequacy. Regressions include zero and a synthetic 0.4 L denominator. |
| CSR-15A-F06 | Outage placeholders appeared as climate class/pattern/seasons. | Shared evidence gate now used by route and actual footnote JSX. Class needs complete sourced rain and temperature; rain seasons remain independently usable. Unknown temperature has a named label. |
| CSR-15A-F03 | Annual-only payload printed raw seasons in the deterministic header. | Reproduced through the real POST with provider/payment boundaries mocked. Route passes the same gated seasons used in its prompt. Current NASA producer rejects incomplete rainfall before tagging it; this is a reachable accepted report payload, not proof that today's NASA producer emits it. Header helper still accepts explicit caller-supplied season strings. |
| CSR-15A-F01 | Legacy positive/truthy rainfall guards omit zero. | Open, confirmed in report-risk and report-doc. Extending them would introduce unsupported high-risk/storage advice for zero. No substitute threshold or risk rating invented. Zero remains visible in report evidence; no-rows text is not a low-risk assessment. |
| CSR-15A-F05 | Reviewer could not inspect zero SVG scaling. | Reuse Command Centre's original browser inspection of the unchanged base SVGs. No repeat full figure suite or new visual claim for those files. |

## Verification and limits

Typecheck passed. The ten affected report/climate test files passed 133/133 with zero failures, cancellations or skips. All five new regressions fail against exact base product files; successor files were restored byte-for-byte. The prompt contradiction also failed before fixing it; the final baseline control catches the header mismatch first. Existing localization, PDF, header, document and water-scope contracts remain covered. Another 40 release-note, feature-tour and localization contracts passed; final typecheck, whitespace and release-note gate passed.

Actual changed footnote JSX and roof text were rendered in an isolated synthetic HTML fixture and inspected at desktop and phone widths. The fixture stubs label translation and does not mount the full authenticated report. It does not validate a paid model's prose, full report layout or physical print output. These changes alter the displayed picture/text; PLAN_VERSION is unchanged.

Current-head full CI, security/preview checks and independent same-candidate dispositions remain required before release. No full-suite pass is claimed from the predecessor. Exact output hashes, screenshots, logs, input bindings and negative controls accompany the private packet.

Retained: existing positive-rain risk thresholds and irrigation demand assumptions remain unvalidated; the universal irrigation prompt figure was not replaced. Existing share/localization gaps (F07/L01), saved-client compatibility questions (M01), other prior crop findings and source applicability limits are not closed by these edits. New corrective English copy is not a fluent-human translation approval. Model agreement is not agronomic validation.

## Next continuation

Review this exact successor delta and affected outputs, then verify applicable current-head CI. Resolve F01 and retained advice with explicit evidence and product decisions. Keep the separate provisional-export branch and its reviews under their existing owner; no adoption, source adapter or global suitability approval is implied.
