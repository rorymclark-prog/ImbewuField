# Sector release separated from Water history — 2026-11-04

- Auditor: Codex, following Rory's correction that the design review remains on Sector.
- Reviewed branch: `codex/sector-release-main`, based on released `81d696f1800151722e088dea19be572fe6de6781`.
- Previous audit: [Sector comparison and polish-input correction](sector-calm-context-codex.md); carries AI-MAP-058/059/063/064 forward unchanged.
- Deployment inspected: production `81d696f`, before this selected Sector finish. No claim that this successor is live.
- Evidence: source AST comparison, actual native compositor with original paid artwork/frozen scene, matching export hashes, focused local tests and normal production owner recovery/download.

## What was already done

PR #1234 at `b2c15b6b3385d4840a9b58b844d837a7d39a7a63` contains the complete selected Sector change. It inherited Water #1221's branch but has no functional dependence on the Water calculation correction. Rory is still reviewing Sector; Water's full CI remains independently required. Neither original branch nor its live runs is changed here.

## Findings and disposition

| ID | Problem | Status | Evidence |
| --- | --- | --- | --- |
| AI-MAP-065 | Unrelated inherited Water history delays the complete Sector release | Extracted without reducing scope; successor release pending | Cherry-picked complete original implementation `c7e222ef2e07da1638010c80a61655ab1fdc40ce` and record commit `b2c15b6b3385d4840a9b58b844d837a7d39a7a63` as `4f52ecbd7`/`f005ec005`. Resolved only notes/index context to omit unmerged Water claims/links. No Sector source conflict. |
| AI-MAP-058/059/063/064 | Muted context, sun/wind/fire readability, contour captions, unannotated polish input and weather cleanup | Retained exactly | Actual function text for drawSectorAnalysis, drawSectorArtworkContext, composeSectorSheet, drawStyleLegendSymbol, generateSectorViaQueue and finishSectorSheet is identical to #1234. Actual selected and exact exports are byte-identical to their recorded originals. |

`lib/water-system.ts` and its tests are byte-identical to released main; no Water renderer/budget hunks or release note are included. The changed renderer's entire enqueue call/options is also text-identical to released main. Only the bitmap chosen for Sector polish and its prompt content change: provider, worker execution, two-pass lifecycle, spending checks, result kind, masks and authorization remain the existing contract. The paid-render/locked-flow/chrome tests remain in the required focused group. This is the same complete map/presentation scope, not a reduced substitute or a new paid-generation bypass.

## Verification

- Ordered typecheck: clean on extracted head.
- `npm run test:render -- --test-concurrency=2`: 638 passed, zero failed.
- Affected Sector/prompt/release checks: 42 passed, zero failed.
- Release-note/label/tour checks and notes drift are recorded after stamping the successor's own ancestor SHA.
- Whitespace clean. No new heavyweight full suite; prior Water run remains separate and is not a current-head Sector pass.
- Native actual selected export SHA-256: `1e2bfa9a8523633a0fb616ea3079111d306670af5fe6800f2aecebe84dcc7212`.
- Native exact reference SHA-256: `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`.
- Both are identical to the original #1234 exports, so no intentional visual difference needs approval. Same frozen scene remains unchanged, same 3462×2448 finished sheet, same archive coverage and source crop. Prior screen/A4-sized review therefore applies to these identical bytes. No new paid provider request.

Production housekeeping merged #1208 and #1217 using exact-head guards. Resulting main tree equals tested Zone head tree `da7148d2eb1120136699f1d5bacdd7bc2c346d8f`. A remote build from clean main was used while Actions deploy waited. The initial CLI build lacked Git runtime metadata; a corrected upload failed before deployment; a supported REST redeploy reused those uploaded source files and supplied per-deployment SHA/ref. Final READY deployment `dpl_4pscBW657wX8P6MmbeMbbiAj74q8` serves branch main/SHA `81d696f` on both app aliases. No persistent project environment change, local heavy build, or manual cancellation of existing CI.

The normal owner session recovered the latest original Sector using only “Reassemble artwork · no AI charge” and downloaded its current production PNG. Artifact `/Users/roryclark/Documents/Codex/2026-11-04/map-release/sector-production-81d696f-before-selected.png`, SHA-256 `896debbbd9fe8df1195277e7f615f5752a8ad67dd3386a0b322f854832249475`, visibly retains the old arrows and scattered drops. This verifies the production recovery/export route, not the new selected finish. Temporary browser tab closed. No later-map design review or Zone approval is inferred from the technical housekeeping release.

This changes the picture relative to production. PLAN_VERSION and recipe counters remain unchanged.

## Next continuation

Push the finished successor once. Require its own current-head rules, focused-render and successful preview; old #1234 results are evidence, not a substitute for these gates. Guarded merge to current main, deploy and verify its real SHA, then normal owner free Sector reassembly/download and inspect against the selected draft. Keep #1221 and its required full CI independently tracked. Preserve #1234 evidence until the successor is verified, then mark it superseded with the successor reference rather than pretending its Water parent shipped.
