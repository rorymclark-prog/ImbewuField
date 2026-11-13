# Positive-only crop month evidence — 13 November 2026

- Auditor: Codex; independent Codex source-admission and contract review.
- Starting revision: `51872cdfe7cc93855667f92b69c5e9e77f9ccf15`.
- Branch: `codex/positive-month-coverage-20261113`, based on PR #1369.
- Previous audit: [Place identity in provisional exports](provisional-export-place-label-codex.md).
- Evidence: actual resolver reproduction, source assessment, affected tests and original HTML inspection. No hosted successor or real-farm validation claimed.

## Findings and disposition

| ID | Problem | Disposition |
| --- | --- | --- |
| GLOBAL-POSITIVE-MONTH-EVIDENCE-01 | A positive source month list would exclude every omitted month and suppress otherwise supported date arithmetic. | Versioned positive-only coverage implemented; successor review and CI remain required. |
| STOCKTON-WINDOW-CLOSED-WORLD-01 | The extracted Stockton transplant window does not establish year-round exclusions. | Source adapter held; this change admits no agronomic data. |
| STOCKTON-SOURCE-BOUNDARY-02 / STOCKTON-REUSE-04 | Original table/attribution evidence and factual reuse basis remain incomplete. | Held, not replaced with an invented licence or PDF hash. |

## Contract

Version1 profiles keep their existing explicit allowed-month semantics, including an empty window excluding every month. They are not migrated. Their canonical result shapes and fingerprints remain unchanged; a frozen actual-base saved profile and adopted-cycle fixture checks replay.

Version2 is reserved for a nonempty external-reference positive-only month list. Listed months are reported-positive; omitted months remain unknown. Counts, yield and supported date offsets remain independent conditional calculations. The shared full assessor holds both listed and omitted dates with `needs-grower-entry-window`, so a positive list alone cannot authorise automatic scheduling or cycle adoption. Existing source, actor, scope and restriction checks remain intact.

Only applicable, reviewed external candidates may carry positive-only coverage. Different coverage conflicts even when the month values match. Rejected candidates cannot taint another selected window. A deliberate grower override replaces active coverage, retaining the source baseline; an empty override excludes every month. Removing the override resets to the source. Missing/withheld overrides are supported at the resolver boundary; the existing UI exposes reset and explicit arrays, not a separate withholding control.

Coverage survives normalisation, original-request replay, saved evidence, fingerprints and HTML. The legacy estimate editor refuses even a bare version2 profile, preventing an accidental conversion into a grower assertion. Older clients reject version2 profiles and may hold the whole book against editing. An actual-base reader/writer probe confirms the existing lossless-write gate refuses an unrelated edit and preserves raw mixed-version data; this is not seamless old-client support.

## Verification and limits

- The actual unchanged resolver reproduced June/October exclusion from a synthetic positive July–September list. The initial probe had an invalid workspace ID; only the corrected valid-workspace run counts. All numeric examples are engineering fixtures, not crop recommendations.
- A real base-module negative control fails on `excluded` versus expected `unknown`, not an import or setup error.
- Ordered typecheck, affected feature tests and whitespace checks are recorded in the exact-candidate review packet. The first focused run found one invalid test timestamp; the fixture was corrected to the existing same-day saved-receipt contract, without relaxing production admission.
- 1,248 affected checks across73 existing test files passed before the final additive saved-UI case. Final ordered typecheck,52 preview-UI/release-note checks and whitespace passed. These runs overlap; do not add their counts as distinct tests.
- Four original HTML files cover June, July, September and October. Actual browser views of July and October show independent count/date arithmetic, explicit source-month uncertainty and no fabricated exclusion for an omitted month. This changes the picture of new positive-only previews; `PLAN_VERSION` is unchanged.
- Full current-head CI, required external Claude/AGY outcomes and broader G03 source integration remain open. The provider-policy hold is unchanged. This extension supplies representation, not a positive local calendar, site-climate estimator or proof of agricultural accuracy.
- No species, lesson, geometry, timing, yield, water-demand or country permission default changed. No production merge or release.
