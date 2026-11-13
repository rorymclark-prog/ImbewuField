# Southeast Missouri oats reference — 13 November 2026

- Auditor: Codex; independent Codex source admission accepted with bounded prerequisites.
- Starting revision: `5ef1d0a5fcfa8cdc70503a5c0ec9939c75d74707`.
- Branch: `codex/missouri-oats-reference-20261113`, based on PR #1370.
- Previous audit: [Positive-only crop months](positive-month-coverage-codex.md).
- Scope: optional oats source choice in the existing provisional preview, resolver, original printable file and saved readback. No production release or real-farm validation claimed.

## Findings and disposition

| ID | Problem or prerequisite | Disposition |
| --- | --- | --- |
| GLOBAL-POSITIVE-MONTH-EVIDENCE-01 | Positive source months need unknown omissions rather than invented exclusions. | Parent versioned contract retained; this is its first admitted regional month adapter, subject to successor review/CI. |
| MISSOURI-OATS-PURPOSE-TYPE-01 | Existing winter-cover crop label cannot identify spring/winter seed type or grain versus cover-crop use. | Explicit blank-first oat type and cover-crop source choice; type/use/checksum retained in evidence and replay. |
| MISSOURI-OATS-HISTORICAL-SCOPE-02 | The old grouped source must not become current country-wide advice or imply winter survival. | Declared US/Southeast Missouri only, historical-transfer tier, March2014 month precision, explicit limits and no inferred climate calculation. |

## Source and outputs

The [source dossier](../../../research/crop-sources/usda-southeast-missouri-oats/README.md) records the actual PDF checksum, page/panel, month transcription, retrieval, reuse limits and unadopted facts. Root and independent Codex opened both original pages. The adapter adopts only direct establishment and positive months March, April, August and September; no omitted month is excluded. Source availability and agronomic currency remain separate.

Three actual HTML files were generated from the real adapter with synthetic measured area/date choices: spring type in March, winter type in September, spring type in October. Root opened all three browser documents and inspected their actual result text, source/type/use/checksum and date metadata. Browser screenshots of the September and October results show reported-positive versus unknown while counts, yield and dates stay unknown. The nursery date retains `not-applicable` for direct seeding. This changes the picture; `PLAN_VERSION` is unchanged. Full print pagination, physical devices, authenticated account use and present local farming validity are unverified.

## Verification

- Ordered typecheck passed; 266 affected checks across12 existing feature files passed, including actual mounted source choice, stale callback refusal, save/readback/remount, override/reset and shared adoption boundaries. Counts overlap parent checks and are not an independent agricultural benchmark.
- First UI run:81/82 passed; one new expectation incorrectly assumed the shared null-date formatter displayed “Not applicable.” It actually preserves `Unknown (not-applicable)`; the assertion was corrected to that existing contract, without production behaviour changes or lost status coverage.
- A private source-row mutation replaces March with May. The unchanged actual source test then fails on March `unknown` versus `reported-positive`; no import/setup failure or application source mutation was used.
- Final release-note/whitespace and exact-candidate independent runtime/output review are recorded separately. Full current-head CI remains required; no repeated local full suite.
- Same-candidate Claude and authorised independent provider outcomes remain release gates. The AGY service/policy hold is unchanged; no automatic AGY invocation or Claude-through-AGY route was attempted. Codex review does not stand in for those roles.

## Next continuation

Inspect exact successor review and CI, fix concrete findings, and verify the hosted source-choice flow once deployed. Continue the original global planning/soil/save/report programme; this bounded source adapter does not complete it. Do not infer yield, timing, water demand or applicability for unsupported regions.
