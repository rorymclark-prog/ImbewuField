# Report evidence and PDF continuation — 2026-10-29

- Auditor: Codex
- Reviewed revision: started from `55b03506e21d9e180ce11677a236bffe9c39dadd`, then integrated main `2d2ce46da879dd6c3cb1322e847360fbd6b3e3a5` (map-composition release #1143). Changes are on `codex/report-evidence-followup-20261029`.
- Deployment inspected: no new browser inspection in this session. The previous release's GitHub deployment and live-build verification passed; its full test job was still running when checked.
- Previous audits: [28 October coherence audit](../2026-10-28/coherence-audit-codex.md), [29 October coverage record](coverage-and-release-codex.md), and the [27 October report handoff](../2026-10-27/site-report-handoff-results-claude.md).
- Scope: report map-image preparation, generation, saved identity and reopening; mapped-water provenance through server instructions and deterministic report headers; aggregate training and individual-session PDF exports.
- Evidence type: source review, executable React save/reload checks, synthetic-data PDF exports, rendered page inspection. No paid generation.

## What was already done

PR #1141 is merged as the reviewed main revision. Its photograph snapshots, explicit historical map selection, site water-point filtering, South African fieldwork dates, chart styling and gallery focus changes are retained. This continuation does not reopen them.

The queue was reread from GitHub main before implementation and again after #1143 landed. The latter adds Rory's 29 October matched-verification policy. This report work changes saved analysis semantics and water-advice instructions, so it remains subject to full-suite verification; the focused-map exception is not used. Rory's explicit current request to continue the broader audit determines this pass. The workspace's terminal Git lookup still fails DNS. The previously authorised connected GitHub service is used to preserve the finished branch, without changing the existing August checkout or its unrelated work.

The earlier coverage record's conditional-release wording describes the state when it was written. Rory subsequently authorised deployment before the full suite concluded, for #1141 specifically. That release succeeded; this continuation does not inherit an exception to the full-CI gate.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| report-map-identity (previously described as `analysedMapIds` matching nonunique labels) | A saved selection can contain identically named versions. If one fails preparation or exceeds the upload budget, matching its name can falsely record it as analysed. | Implemented; automated generate/save/reload verified | Successful prepared images retain their original sheet ID. The real report component records only those submitted IDs. Selection remains separate from analysis history; legacy reports are not rewritten. Added failure and budget regressions failed on the pre-change implementation. |
| report-water-access (previously described as proximity not establishing ownership/access) | A nearby or boundary-contained pin, and a drawn storage polygon, can be read as available irrigation water. | Implemented; deterministic output verified; paid response unverified | One shared rule qualifies ownership, permission, reliability, quality and available supply in every independent generation batch. Contradictory mapped-storage comparison instructions are qualified too. The shared header explicitly leaves access/reliability unconfirmed in English and the four existing draft report languages. No pin, boundary, category, capacity or saved geometry is modified. |
| report-pdf-coverage | Earlier training PDF download observation timed out. | Coverage expanded, still partial | Exported aggregate training summary/full and individual-session summary/full in English and isiZulu, plus a site report in English/isiZulu using one consistent captured location fixture. Rendered page evidence is linked below. This is direct exporter coverage, not a browser-download or complete live-report composition test. |
| report-schema-history | Saved-report schematic figures still read today's design, with the existing changed-design warning. | Open, retained | No new immutable design snapshot was added. Attachment identity and photo-history changes do not freeze all schematic inputs. |
| report-language-coverage | Training exports still contain English authored section/table copy when the interface language is isiZulu. The export's existing draft notice remains visible. | Observed; open | This pass does not claim full translation or fluent approval. Lesson bodies and course wording are untouched. |
| audit-browser-coverage | No browser-control app/runtime is available in this session. | Blocked for fresh live UI checks | Browser runtime availability was checked. No standalone browser substitute or screenshot-only inference is presented as an interactive walkthrough. Desktop/phone/themes, authenticated role journeys and browser downloads need a subsequent browser pass. |
| audit-device-and-paid-coverage | Paid rendering, authenticated device offline/reconnect and live cross-account role boundaries remain unexercised. | Open, retained | Existing regression and rules checks do not certify physical-device behaviour or production rules deployment. No paid API, rule deployment or access-setting change was made. |

## Verification

- Typecheck: `npx tsc --noEmit` passes with the existing complete dependency installation. The original checkout's older dependency tree lacked the declared Rive package; no package or test-script change was made to compensate.
- Focused tests: 138 pass, zero failures, including the real report component's generation/save/reload, map preparation limits, all supported header languages, update guide/localisation, existing measurements and training PDF evidence.
- Full test suite: final `npm test` started after the final successful typecheck; still running at branch publication. Earlier interim runs were stopped when the source changed and main advanced; it is not a verification result for this branch. Full exact-head CI is required before merge.
- Whitespace: `git diff --check` passes.
- The historical English-header fixture asserted byte-identical authored provenance. That claim no longer holds for the deliberately added water-access qualification. Its test now explicitly allows only that one wording substitution, retaining full equality for every other word/measurement and exact diagram equality. The separate regression requires the qualification in each supported language. No assertion or test was deleted.
- Output inspected: [rendered export contact sheet](evidence-report-followup/contact.jpg), [water-access header](evidence-report-followup/site-en-1.png), [session register](evidence-report-followup/session-en-full-1.png), and [isiZulu session continuation](evidence-report-followup/session-zu-full-2.png). See [page counts and off-page-text checks](evidence-report-followup/layout-checks.json). No clipped/off-page text was found in the exported fixtures; this does not certify every historical/live document or external font/device combination.
- Reproduction: run `node --import ./tests/register-alias.mjs docs/audits/2026-10-29/evidence-report-followup/render-exports.mjs /tmp/imbewu-followup-pdfs` from the repository root. Inputs are existing demonstration records and a captured location fixture; no personal records, credentials, network or paid model are involved. Render the resulting PDFs with Poppler.
- This changes the picture for newly generated report provenance text. `PLAN_VERSION` is unchanged. No species, approved lesson, agronomic number, geometry, rule, workflow or billing/access setting changed.

## Next continuation

1. Read both exact-head `test.yml` jobs and the preview outcome; do not call pending checks passed or merge with incomplete verification.
2. When browser control is available, check the report generation/save/reopen/export journey on phone/desktop and each role, including failed image preparation; repeat chart/gallery checks on the deployed version.
3. Review all PDF compositions with real permitted attachments and expanded records, then finish training authored-copy localisation with the existing draft-review discipline.
4. Preserve the remaining device, paid-render and cross-account evidence limits until those workflows have actually been exercised.

This is a continuation with concrete fixes and expanded export evidence. It is not a claim that the whole app or every visual has been audited.
