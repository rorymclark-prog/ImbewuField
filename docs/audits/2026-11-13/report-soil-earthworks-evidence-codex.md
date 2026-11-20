# Report soil and earthworks evidence — 13 November 2026

- Auditor/writer: Codex; branch `codex/report-soil-earthworks-evidence-20261113`.
- Base: `9acbdba552bca1ba0db388a306307c20ae745413`, tree `a2f2cbec30d9cf7676af182115e5616c93e1b190`, draft PR1357.
- Previous audit: [report slope evidence](report-slope-evidence-codex.md). The soil and earthworks finding IDs below continue that record; prior slope, irrigation, historical-report and actor-save closures are retained.
- Deployment inspected: no successor deployment yet. This changes report text and the exported picture. `PLAN_VERSION` is unchanged.
- Scope: new deterministic report builders, soil/header provenance and narrative instructions. No saved report rewrite, measured geometry mutation, species identity, calendar, provider, authentication, billing or workflow changes.

## Findings and correction

| ID | Problem | Disposition |
| --- | --- | --- |
| REPORT-SOIL-RATING-OPEN | Non-laboratory source labels produce High/Medium soil risk and an unsupported cheapest-test claim | Implemented and locally verified; independent successor review/CI pending. Shared unrated soil evidence now remains visible with empty and populated registers. |
| REPORT-EARTHWORKS-OPEN | Missing site evidence creates generic swales, tanks, orchard/soil-treatment tasks and construction months | Implemented and locally verified; independent successor review/CI pending. Unsupported defaults become evidence-review steps, without deleting actual saved plans or phase tasks. |
| SOIL-EARTHWORKS-CONTRACT-SYSTEM-01 | Higher-priority system prompt says silence means physical absence and requires BUILD/BUY | Corrected in every captured batch. Missing inventory is unknown; neither a drawing nor missing data authorizes construction. |
| SOIL-EARTHWORKS-CONTRACT-LAB-01 | A bare lab flag claims an uploaded, on-site measured original | Corrected in structured value basis, route preamble, header and contextual assurance. Original report, sampling depth and sample/site correspondence remain unverified. Recorded pH and genuine zero organic carbon survive. |
| REPORT-ROOF-INVENTORY-01 | No recorded tank is treated as proven runoff loss and cheapest water | Unsupported rated row retired; header and measurement prompt identify inventory gaps without physical-absence or comparative-cost claims. Existing roof arithmetic and stated capacities remain. |
| REPORT-TERRAIN-HEADER-OPEN | Missing runtime slope can still print `undefined` in the older deterministic terrain header | Carried open, outside this bounded soil/inventory correction. The assembled outage response exposes it; register slope evidence stays unknown. Reader/PDF fixtures explicitly supply terrain fields and do not validate terrain outages. |
| REPORT-LAB-SAMPLING-DEPTH-01 | Lab narrative preamble still assumes0–30cm depth | Independent review requested correction; source-aware heading now reserves the model layer for SoilGrids and leaves laboratory sampling depth unverified. Successor verification pending. |
| REPORT-RECORDED-TANK-STATUS-01 | Final prompt summary promotes mixed tank groups and loses same-name status distinctions | Independent review requested correction; design/water summaries retain each group's name/count/status, and heterogeneous/mixed header records display per-row status. Successor verification pending. |
| REPORT-LAB-PDF-RETEST-01 | Original English report footer unconditionally requests another soil test | Independent review requested correction; report-only footer asks to review existing evidence and field conditions before treatment. Shared plan/Atlas wording and existing isiZulu footer remain unchanged; new other-language English is explicitly pending. Successor verification pending. |

Source flags now distinguish model estimates, generic placeholders, recorded laboratory
attribution and unknown sources. The soil note asks for the original results and
sampling/crop context before treatment, rather than automatically ordering a duplicate
test. Non-English reports visibly identify new English text as translation pending;
no fluent-human or language-activation approval is claimed. Generic no-context plan
assurance and its original translation packets are unchanged.

The local skeleton no longer invents a month-by-month building schedule, mandatory
aeration or a generic cover-crop list. Removing that unsolicited output does not
change any species catalogue or saved planting. Actual Studio existing/proposed/mixed
records, same-name counts, two swales totaling30m with stated1.5m width, approved map
footprints and supplied roof-gutter phase tasks retain their original records and
links. Recorded cultivation/tree-belt footprints are not independently verified land
uses or a design approval. Distinct generic sector/fire/security advice and unrelated
risk rows remain outside this finite correction and are not validated by it.

## Verification and actual outputs

- Sequential typecheck,38 affected test files and whitespace pass. The affected pass is470/470, with zero failures, cancellations, skips or todos; release-note checks also pass.
- The independent review of initial commita299 accepted the bounded rule removal and system correction, but requested the three retained consumer corrections above. Three targeted regressions fail against a299 for the intended prompt/status/footer claims. The corrected successor passes typecheck and472/472 affected checks across the same38 files; final outputs and delta review remain separately required.
- On the exact base loaded read-only,12 new/expanded regressions fail for the intended unsupported claims. No import/setup failure is counted as a negative control.
- Historical fixtures and translation packets remain unchanged. Broader testing exposed obsolete assertions for physical absence, soil provenance and mandatory roof risk. Their claims were rewritten with reasons while preserving exact unaffected rows, catalogue/custom names, source identities, original numbers and chart objects. The inherited assurance test now compares each original paragraph and title independently of route heading renumbering.
- Six actual assembled POST responses and18 per-batch system/user requests are retained. They exercise missing/model/lab soil and null/zero/sub-litre/ordinary annual rainfall, keeping the previous water-demand and cultivation-area checks. Authentication, payment and providers are mocked; these are actual request assembly and deterministic response evidence, not generated narrative compliance.
- Actual structured-builder matrix retains17 cases: missing/null/estimate/model/lab/unrecognised soil, missing numeric lab/model fields, roof inventory/capacity/status variants and saved geometry/phase records. Input snapshots remain unchanged.
- Four original `buildReportPdf` exports, two pages each, were rendered and all eight pages opened. Soil qualification, zero carbon, inventory gaps and retained unrelated risk text are readable without clipping in these bounded English/isiZulu outputs.
- Six actual-reader/CSS fixture screenshots were opened:1280px desktop and390px phone, light/dark, missing-soil and recorded-proposal cases. Document width stays within the viewport; the existing English risk table retains internal horizontal scrolling, and native risk rows retain their stacked labels. These fixtures include explicit surrounding styles and synthetic terrain; they are not the full signed-in application or a physical-device test.
- Evidence root: private `global-provisional-adoption-20261113/report-soil-earthworks-evidence/`, including baseline/current JSON, captures, exact commands, logs and original exports. No raw logs, private records or credentials are committed.

## Remaining gates and continuation

Independent Codex accepted the base correction contract, including system-prompt and
lab-provenance consistency, then reviewed initial commita299 and requested the three
consumer corrections recorded above. That review is not successor closure. Review
the corrected frozen source and changed outputs, then inspect its own security,
focused-render, preview and full CI before any merge. The base9ac push full job has
11,070/11,070 passes; that is parent evidence, not approval for this delta.

Claude/AGY automated routes remain disabled under the existing service/policy hold.
Prepared manual packets are not dispatched or completed reviews. No bypass, account
rotation or alternate provider is authorized by this continuation. Agricultural
accuracy, genuine account/cloud-save acknowledgement, local agronomic validation,
unsupported regional calendars and required external reviews remain separate gates
for the original global-planning objective. Do not substitute this report correction
or passing tests for completion of that objective.
