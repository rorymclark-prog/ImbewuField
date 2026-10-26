# Animal legal translation source continuation — 2026-10-26

- Auditor: Codex; no additional agent or fluent reviewer.
- Reviewed revision: `244b0fabfbc0114baf05fd241ff6f56934c7a480`, branch `codex/four-language-animal-legal`, with the draft-only packet described below.
- Deployment inspected: none; no merge or deployment.
- Previous audit: [Production plan re-audit — 10 October](../2026-10-10/production-reaudit-codex.md), retaining CP-035, CP-036 and CP-037 and the other CP-030–CP-046 dispositions. These findings do not reopen the corrected 24-month bee registration.
- Scope: all 55 unique legal statements in the 15 animal enterprise authorities, 73 exact catalogue bindings; card and generated guide source presentation. Personal records were not read.
- Evidence type: immutable source/markup/guide capture, complete draft pairs, draft preservation probes, primary-source text and one visually inspected statutory table. No changed application rendered.

## What was already done

The preceding translation stack retains welfare drafts, controls and complete reference notes, with English source preservation and explicit review status. Its reference-note suite is running separately against frozen inputs. This branch starts from that exact source checkpoint. CP-036's amended bee registration remains unchanged. This continuation preserves all original source wording and citations in a one-time fixture rather than silently translating source defects into apparent new authority.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| TLAG-001 | The current Nile tilapia category statement does not match the actual 2020 listing and omits its permitted-aquaculture distinction. | Open; reproduced with primary table | [Official Gazette, printed p. 71](https://www.gov.za/sites/default/files/gcis_document/202009/43726gon1003.pdf) and the [inspected page](../../translation/four-language-completion/evidence/animal-legal/tilapia-gazette-page71.png). Tilapia is item 22; protected-area 1b appears in adjacent perch item 23. Reconcile the original legal statement and all corresponding drafts with the exact statutory qualifiers before applying them. No claim of latest 2026 permit approval. |
| TLAG-002 | A present-tense wool-export statement rests on a 2020/2021 annual review. | Open source-age gap | The original source metadata and quote are retained in the immutable fixture. A historical export report does not establish current status. Date the historical statement or mark current status unconfirmed with an appropriate source. |
| TLAG-003 | The fish notes can be read as blanket farm permission or universal water-licence requirements based on a 2015 report. | Needs primary-framework review | [Dated IDC report](https://www.idc.co.za/wp-content/uploads/2018/11/Tilapia-Research-Report-2015.pdf). Preserve distinctions between invasive listing, aquaculture permission, site restrictions and water authorisation. Do not infer a permit or an exemption. |
| TLAG-004 | All original animal legal paragraphs still need four-language runtime presentation with the full English original. | Drafted; not applied | [Source-bound draft packet](../../translation/four-language-completion/animal-legal-drafts.json): 55 complete source clauses, 220 target drafts. All remain unreviewed. Resolve TLAG-001–003 before registry/app publication, then implement guarded per-note English disclosures and actual guide output. |

## Verification

- Typecheck: not rerun for this draft-only checkpoint. The frozen parent reference run has passed its typecheck.
- Full test suite: not run for this draft-only checkpoint; parent reference suite remains live in a separate checkout. No full-green claim.
- Whitespace: checked before the local checkpoint.
- Draft/source probe: 220 complete draft fields, ten original application files and 1386 registry rows unchanged; ordered figures and named identities checked; 17 independent negative cases rejected. This does not prove fluent equivalence.
- Output inspected: the downloaded official Gazette's printed page 71; no changed app or export rendered.
- Other limits: current 2026 applicability, full legal review, fluent review, runtime wiring, browser and PDF QA remain outstanding. Three linked source PDF fetches failed; historical evidence was retained, not treated as current certification.

No application picture changes in this checkpoint. `PLAN_VERSION` is unchanged. This is not whole-app completion.

## Next continuation

Resolve TLAG-001–003 using primary sources and explicit historical/current distinctions; preserve the captured original text and measured farming figures. Update the affected English/native pairs, implement the complete remaining legal presentation in app and shared export authority, and add meaningful source/exception/permit/private-value counterexamples. Inspect actual phone/desktop states and PDFs in all four languages. Run Node24 typecheck, the complete suite and whitespace checks in that order against frozen final inputs, then push the finished branch once and open a stacked draft PR. No source English or runtime change has yet been applied here.
