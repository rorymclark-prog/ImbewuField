# Editorial contour caption clipping — 2026-11-07

- Auditor: Codex; independently checked the bounded visual observation supplied by the coordinating chat.
- Reviewed revision: production `842192455b250a14ba5b53a47cd9eea67d352c1b`; follow-up branch `codex/editorial-contour-labels`.
- Deployment inspected: retained production sample plus native current-branch output. This correction is not deployed.
- Previous audit: [Editorial Atlas](editorial-map-style-codex.md), retaining AI-MAP-069 and AI-MAP-026/042 as open model-fidelity limitations.
- Scope: native contour-caption placement in Editorial Sector only; no model call, source raster, contour level/route, saved geometry, boundary or historical coverage change.
- Evidence: actual original/after PNG inspection, measured native text calls, pure placement and actual compositor regressions.

## What was already done

PR #1325 supplies the second appearance option and circular page. The supplied sample’s complete proposed boundary, fine round posts and original historical blank corners remain. This correction does not replace the image artwork or infer a missing number from its cropped pixels.

## Findings and disposition

| ID | User-visible issue | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-077 | At about (389,905) in the 1800×1273 Ubhejane sample, the southwest clip cuts a native contour caption down to `m` | Verified defect; corrected and native output inspected; integration pending | Native text instrumentation identifies **325 m**, also already labelled in full elsewhere. The compositor now labels each existing height at most once and selects only an on-contour anchor where the full caption/casing fits the proposed boundary and registered photo coverage. If none fits, it omits that caption. No elevation is invented or altered. |
| AI-MAP-069 / 026 / 042 | Provider material/feature fidelity | Open, unchanged | No new paid provider image is generated or claimed. |

## Verification

- Typecheck: clean.
- Affected tests: 221 pass, including edge/coverage clipping, concave property notches and actual compositor omission/deduplication.
- Canonical `test:render` file set: 674 pass on Node 24, two workers. No local full application suite or build run.
- Whitespace and release-note checks: clean. Exact-source four-language UI notice drafts are retained separately; unreviewed, no farming/course content.
- Output inspected: `Ubhejane before caption correction.png` and `Ubhejane caption correction.png`, privately retained beside the Editorial Atlas gallery. Native text calls after correction contain one complete 325 m and one 330 m, plus the separate 10 m scale caption. Frozen source state still serializes identically.
- This changes the picture only for native Editorial contour captions. PLAN_VERSION v93 and render recipe are unchanged. No provider, security, spending, hosting or persistence changes; no temporary server/browser/watcher.

## Next continuation

Push the isolated correction and record the exact branch/SHA on issue #35. Keep it separate from the frozen private combined candidate `6830557`; no source changes to that checkout or independent production merge/deployment. The combined-release owner can inspect the actual after PNG and integrate the correction with the normal current-head release checks. Full-suite/physical-device/fresh paid artwork success is not claimed.
