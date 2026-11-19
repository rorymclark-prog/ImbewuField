# Report slope evidence — 13 November 2026

- Auditor/writer: Codex, sole writer of `codex/report-slope-evidence-20261113`.
- Base: `54beb1e9403060ee45461bcc53768726b0179911`, tree `8be79e07c8a4258a8ef6a15b1b7f712b236222c0` (draft PR1356).
- Previous audits: [annual rainfall evidence](../2026-11-12/report-water-evidence-f01-codex.md), [irrigation evidence](report-irrigation-evidence-codex.md), and [saved-place actor guard](saved-place-actor-guard-codex.md). Prior closures remain unchanged.
- Scope: REPORT-SLOPE-EVIDENCE-01, the retained slope risk finding; new deterministic reports only. No paid/model dispatch, saved report rewrite, geometry, calendar, crop/species or workflow changes.
- Deployment inspected: no successor deployment yet. The base preview and its sample save flow have separately scoped evidence.

## Reproduction and correction

Actual base report builders disagree: exactly 10 degrees produces High/High soil-loss risk in the register but Low erosion in the structured document. Missing, negative-sentinel and nonfinite slope values receive reassuring structured runoff/erosion labels; Infinity can produce a High/High row. Neither the 5/10-degree bands nor those likelihood/impact conclusions have an applicable evidence source in this code. Correcting comparison operators alone would preserve the unsupported judgement.

The two slope-derived rated rows and their earthworks instructions are retired. One shared helper retains a valid recorded estimate and explicitly leaves runoff and erosion risk unassessed. It supplies the markdown note, structured water fields and inherited landscape erosion statement. The route passes slope explicitly; old three-argument markdown callers receive unknown rather than a fabricated zero. Finite numeric degree values from 0 through 90 retain their original value; missing, nonnumeric, nonfinite, negative and above-90 values remain unknown. This is angle validation, not an agronomic threshold or proof of source accuracy. The original location record is not rewritten.

The evidence note remains visible with empty and populated registers and alongside the unchanged water evidence. The former introduction promised a numeric threshold behind every rating; it now identifies the remaining ratings as qualitative rule outputs, not measured probabilities or a complete site-risk assessment. Other risk rows and their translations remain unchanged apart from sequential IDs. New English statements are visibly marked translation pending in non-English markdown and structured text; no new native translation is activated.

## Findings and disposition

| ID | Problem | Status and evidence |
| --- | --- | --- |
| REPORT-SLOPE-EVIDENCE-01 | Slope-only ratings disagree and unknown slope implies low risk | Implemented; exact successor review/CI pending | Actual base JSON, intended negative regressions, shared consumer tests and original outputs retained |
| REPORT-SLOPE-FIXTURE-01 | Older BOQ regression explicitly required the unsupported soil-loss row | Claim rewritten with reason | Broad affected run exposes it; replacement asserts no slope rating, retained 12-degree estimate/unassessed risks and unchanged unpriced-work row |
| REPORT-SOIL-RATING-OPEN | Non-laboratory soil still receives High/Medium and an unsourced cheapest-test claim | Carried open | Actual soil cases in the baseline and corrected outputs; outside this slope correction |
| REPORT-EARTHWORKS-OPEN | Generic priority actions, proposed swales and narrative prompts still imply earthworks | Carried open | Source retained unchanged; this correction does not validate the whole report's advice |

## Verification and outputs

- Initial negative control: all 13 first slope cases fail on exact base for the intended rated/reassuring output, not an import or setup error.
- Expanded cases include null, negative Infinity, numeric strings, tiny positive estimates, old boundaries, zero and invalid degree values; unrelated input records and risk rows remain checked.
- First focused group:144/144 passed. The broader 26-file pass initially reports321/322; its sole failure is the documented BOQ expectation above. After rewriting that obsolete expectation with its reason, the final 26-file group passes322/322 with zero failures, cancellations, skips or todos. Typecheck and whitespace both exit0.
- Six actual assembled POST responses retained with authentication/payment/provider boundaries mocked. Unknown slope and exactly 10 degrees are present in the response note; no remote AI request or generated narrative is claimed.
- Actual builder JSON and four original `buildReportPdf` exports retained: English/isiZulu, empty-unknown/populated-10-degree cases. All four PDF pages rendered and opened; evidence text, pending-English labels and the retained unpriced row are readable and uncut.
- Reader fixture: actual markdown reader and CSS module,1280px desktop and390px phone, light/dark, English/isiZulu, empty/populated registers. All six screenshots opened. New evidence paragraphs fit without document overflow; the unchanged English table retains its internal horizontal scroll, with its action column checked after scrolling. Native isiZulu row cards retain all six labels. The first fixture omitted the reader wrapper's existing Tailwind overflow utility; that fixture dependency was added without a product CSS change.
- All owned temporary browser/server processes stopped and their PIDs verified gone. No real signed-in browser, farm record, paid generation or physical-device test.

## Limits and next continuation

This changes report text and the exported picture. `PLAN_VERSION` is unchanged. The original source translation fixtures and old saved reports remain unchanged. Existing irrigation/storage fixes and quick-save closures are retained; they are not re-reviewed as new work.

Independent Codex reviewed the exact base sources and actual 14-case probe and accepted the bounded correction contract; implementation closure still needs its own frozen-source/output review. Claude/AGY automated routes remain disabled under the service hold; no provider review or release approval is invented. Appropriate current-head security, preview and full CI remain required. UI fixtures are not real signed-in accounts, cloud acknowledgement, physical devices, human language approval or agricultural validation. Resolve the retained soil/earthworks findings separately rather than claiming all report advice is now verified.
