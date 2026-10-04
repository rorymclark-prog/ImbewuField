# Xitsonga Introduction learner fields — 2026-10-04

- Auditor: Codex implementation agent, with prior independent semantic review
- Reviewed revision: `432a99174819a303424404473ee54a08081ff2b4` on `codex/ts-intro-source-paired-gaps-20261004`, with uncommitted edits to the Xitsonga Intro registry and its focused test
- Deployment inspected: Not inspected
- Previous audit: [Core Study learner translation residual audit](study-learner-residual-codex.md); carries forward `STUDY-RES-001` and `STUDY-RES-002`
- Scope: Xitsonga Intro to Permaculture L1-L3 infographic descriptions and L1 key point 1 / quiz question 0
- Evidence type: Canonical source and registry binding, resolver tests, full suite and whitespace check; no screen inspection

## What was already done

The residual audit identified three missing Xitsonga `infographicAlt` pairs as `STUDY-RES-001`, and recorded Xitsonga L1's People Care key point and quiz question among broader held learner fields under `STUDY-RES-002`. The root-ready alt-text packet and accepted independent framing check are preserved alongside the implementation proof in the [study translation review archive](../../study-translation-reviews/TS-INTRO-L1-AND-ALT-IMPLEMENTATION-PROOF-2026-10-04.json). The original residual ledger and audit remain unchanged.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| STUDY-RES-001 | Three Xitsonga Intro infographic descriptions lacked regional source pairs. | Implemented in this working diff; release review pending | Added L1-L3 `infographicAlt` pairs with exact canonical sources and root-ready targets. Existing resolver source matching returns the regional target as a machine draft and falls back to current English if the alt source changes. Focused tests cover all three pairs and source drift. Root review is still required before commit/push. |
| STUDY-RES-002 | Some learner fields remained entirely English despite safe ordinary framing being draftable. | Partially addressed; finding remains open | L1 key point 1 now translates the family-needs priority while retaining `People Care` and `market production` as exact anchors. Quiz question 0 translates the farmer/selling and question framing while retaining exact English clauses for all surplus maize and keeping nothing for composting or seed saving. Source answer index 2, options and rationale remain unchanged. The prior ledger counts are historical and were not recalculated by this scoped change. |

## Verification

- Typecheck: Passed with `npx tsc --noEmit`.
- Full test suite: `npm test` exited 0; Final root combined suite: 4,599 passed of 4,600 tests, 0 failed, 1 existing TODO. The TODO is the documented `shape-sync-loss.test.ts` issue about `pushShapes` replacing the full collection.
- Whitespace: Passed with `git diff --check`.
- Output inspected: Resolver outputs and source-drift fallback tested. No browser or visual inspection; image and slide assets were not changed.
- Other limits: These are visibly unreviewed machine drafts. No fluent-speaker approval is claimed. The exact English clauses in the quiz preserve the uncertain crop and technical purposes. Canonical English, quiz answer index, options, rationale and media remain unchanged. `PLAN_VERSION` was not touched.

## Next continuation

1. Root reviews the complete registry, test and archive diff before any commit or push.
2. Keep facilitator feedback separate from fluent approval; do not treat these five fields as closing `STUDY-RES-002` or the broader residual audit.
3. At the next audit, bind remaining findings to the then-current canonical sources and resolver output rather than carrying old counts forward as current totals.

## Combined release review — root

The same release also includes six independently checked Market L1–L2 assessment fields in Sesotho, Tshivenda and Xitsonga: recording separately from cash, the keyed Tshivenda backwards-planning answer, three false tax-obligation distractors, and the false Xitsonga soil-fertility claim. Their technical English anchors, exact sources, option order and correct indices are preserved. The ambiguous Xitsonga “Assume” seed-lot candidate remains held. These changes partially address `STUDY-RES-002`; they do not close the broader residual finding.

Root reviewed all actual registry and test changes. Object-level comparisons verify exactly the three added Intro descriptions and eight existing target/status changes, with all other export values, canonical English, sources, quiz indices and media unchanged. The tax check now covers the actual learner resolver option rather than only fixture constants. Stale whole-English assertions were replaced with their source/anchor/answer rules and reasons; source-drift fallbacks remain enforced.

- Final original root gates: typecheck passed; 4,600 tests / 4,599 passed / 0 failed / 1 existing TODO; whitespace passed.
- Evidence: [Market applied check](../../study-translation-reviews/MARKET-REMAINING-ASSESSMENT-FRAMING-APPLIED-2026-10-04.json), [Market preservation proof](../../study-translation-reviews/MARKET-REMAINING-ASSESSMENT-FRAMING-PRESERVATION-PROOF-2026-10-04.json), [Intro preservation proof](../../study-translation-reviews/TS-INTRO-ROOT-PRESERVATION-PROOF-2026-10-04.json).
- No image, slide, audio or layout assets changed. The learner wording and description panels change; actual exact-preview phone checks remain required before release. No fluent approval is claimed.
