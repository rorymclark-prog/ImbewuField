# Canadian cabbage month reference — 14 November 2026

- Auditor: Codex implementation owner; independent Codex source/architecture review, not Claude or AGY.
- Reviewed revision: branch `codex/canadian-cabbage-month-reference-20261114`, exact successor recorded in issue #35 and frozen packet.
- Previous audit: [Optional monthly temperature comparison](../2026-11-13/provisional-temperature-comparison-codex.md); G03-D1–D5 retained within their earlier scope, not re-reviewed here.
- Deployment inspected: no successor deployment yet; static actual HTML/PDF output only.
- Scope: Canadian cabbage source selection, date precision, source bindings, saved profile/readback, shared exports and missing-condition saved-row rendering.
- Evidence: primary source admission, automated actual-function/component checks, original rendered print artifacts, exact parent reader/writer and regression probes.

## Findings and disposition

| ID | Problem or scope gap | Disposition |
| --- | --- | --- |
| G03-CA-01 | No source-bound Canadian aggregate month reference | Implemented explicit multi-variety field-transplant choice; April/hardening and scope limits retained. No single-cultivar or local recommendation. |
| G03-CA-02 | Year-only publication and protected-document reuse cannot be represented truthfully by day/month + known-licence-only metadata | Added year precision with strict historical fallback and an exact bounded fact admission; document permission stays unknown. |
| G03-CA-03 | Source-only month list could be mistaken for adoption permission | Existing positive-only gate preserved and tested with the real capsule and otherwise complete grower inputs. |
| PROVISIONAL-CONTEXT-NULL-01 | Saved-row screen throws when site conditions have not arrived | Reproduced against the actual parent helper; return held/null instead. Existing real-screen regressions retained. |
| G03-CA-04 | External same-candidate and local applicability review | Open. No automated AGY/Claude call, external disposition or agronomic accuracy claim. |


Stacked from `a6cccc8e5cb3c01b31f56be97e983a872ed97c70` (PR #1374). This changes the preview and printable output; PLAN_VERSION, existing species, lessons, measured geometry and saved records remain unchanged.

## Behaviour

The Canadian cabbage preview offers an explicit historical, unnamed multi-variety field-transplant programme choice. Transplant context and an empty variety reference are required in both the UI and resolver admission. Country alone never selects it. The source mentions April–July, with April limited to early varieties after hardening. These qualifiers and region/cultivar/weather uncertainty remain beside live and saved results, in the original print document and later cycle report evidence. Other months stay unknown. Source-only month facts never authorise automatic planning or cycle adoption; a separate grower window remains required. Edits retire source consent; existing actor, source, generation and save/download checks remain.

Independently entered grower estimates still support partial counts and nursery dates. No sourced nursery duration, field duration, harvest, density, yield, monthly climate comparison, water demand or frost clearance was added. Source emergence-to-transplant weeks and seeding-to-harvest weeks have incompatible phase anchors and remain withheld.

## Source and reuse boundary

Agriculture and Agri-Food Canada, *Crop Profile for Brassica Vegetables in Canada, 2024*, sixth edition **2025**, Table 3 printed page 4/PDF page 9, interpreted with printed pages 2–3 and continuation page 5. Publication month/day are unknown; 2024 is the reference-data year and the hosting URL is not a publication date.

Original PDF: https://agriculture.canada.ca/sites/default/files/documents/2026-01/Brassica%20CP%202024%20EN.pdf

Original SHA256: `fd69162fd641a77a212fb70fd806241ca27f45247f86791ba4c389eedac68121`. Accessed 13 November 2026. Current revision/review-due interval unknown.

The document remains Crown-protected and its commercial reproduction licence is **unknown**. Only the exact curated, independently worded month-fact capsule and qualifications receive a narrowly scoped fact-use admission, retaining source bindings and attribution. Altered months, field, method, scope, source metadata, hash, provenance or qualifiers cannot borrow it, even with a forged known-licence label. Other unknown-licence sources remain rejected. No table arrangement, source prose, PDF/image/logo or official endorsement is distributed.

Primary fact/expression basis: https://ised-isde.canada.ca/site/ised/en/about-copyright and https://www.canada.ca/en/canadian-heritage/services/crown-copyright-request.html . AAFC protected-work terms: https://agriculture.canada.ca/en/about-our-department/terms-and-conditions . This bounded fact-use inference is not an AAFC document licence or blanket legal clearance.

## Verification scope

Year-only dates become usable only after that whole year has ended. Conflicting precisions, malformed/future years and the historical undated fallback are checked. Existing requests with no year retain their exact result shape and frozen legacy replay. The historical tier has explicit historical-transfer scope and sits below local public evidence and above climate-derived estimates; prior relative ordering is unchanged.

Affected verification exercises actual adapters, resolver, all twelve months, canonical fact admission counterexamples, grower overrides, source-only full-planning hold, mounted component consent changes, save/readback and download. Generated examples use a synthetic 10.5 m² bed/date and explicit own estimates; they are engineering demonstrations, not farm validation. The actual prior a6 reader/writer is tested with the new saved origin in an isolated sample book; it holds its lossy projection and refuses to overwrite raw data. This does not establish all historic clients or cloud sync.

Exact commit, verification receipts and source-bound independent disposition are recorded in the private review packet and issue #35. Hosted interaction and same-final-candidate Claude/independent external reviews remain release gates. AGY automation is disabled; no external review or agricultural accuracy is claimed.

## Broader verification finding

The full affected international group exposed an inherited saved-row render exception: `createProvisionalCycleContext` called `Object.hasOwn` on absent site conditions. The saved-record screen can render before that context is supplied. Missing conditions now return a held/null review context instead of throwing. Existing actual-screen assertions remain intact; a direct helper regression also covers absent conditions and invalid review dates. No current site approval is inferred from the historic row.

## Next continuation

Inspect exact successor independent affected-delta disposition and current-head full test/rules/render/preview results; resolve related failures. Inspect hosted interaction separately when accessible. Seek source evidence for a local province/cultivar planting context before promoting the aggregate reference to locally applicable advice. Keep original P01–P24 and the rest of the global-planning goal open. No production merge/release until applicable review gates pass.
