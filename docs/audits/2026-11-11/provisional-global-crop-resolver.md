# Provisional global crop resolver audit

- Auditor: Codex, 11 November 2026.
- Reviewed revision: `1bdd26ebad4c0f95a87a0bd28641d9c38410b0d1`, branch `codex/global-provisional-planning-20261110`, with local resolver, arithmetic and regression changes.
- Deployment inspected: none; this implementation is not connected to an app route.
- Previous work: [grower receipt review](../2026-11-07/grower-held-review-receipt.md), the existing grower arithmetic module and [shared crop checklist](../CROP-PLANNING-CHECKLIST.md).
- Scope: evidence selection and independently available components of a provisional crop draft. No country calendar, crop value, saved plan or account policy is changed.

## Supported draft behaviour

The resolver selects applicable, source-labelled field candidates before calculating a new draft. Local public evidence takes priority over disclosed climate transfers and grower estimates. Equally ranked conflicting values remain unresolved. A grower edit retains the automatic baseline and is identified as an estimate; an invalid edit does not silently restore that baseline.

Missing yield or density does not erase dates that have sufficient independent inputs. Missing planting-window evidence stays unknown, with conditional dates based on the explicitly entered start date. Known exclusions remain exclusions. These are software behaviours verified with clearly labelled engineering fixtures, not evidence that the fixture values fit a real crop or region.

## Findings and disposition

| ID | Scope | Status | Evidence and next action |
| --- | --- | --- | --- |
| G01 | Separate provisional evidence contract | Partial implementation verified in synthetic cases | Applicable country/region, method, water regime, source freshness, reuse metadata and positive-window markers are checked. Actual source extraction and review remain G03 work. |
| G01-COUNTRY-OTHER | An unlisted-country placeholder could select unrelated local evidence | Reproduced and corrected locally | `OTHER` is not treated as a country/region match. Both geographic cases are covered, while an explicitly disclosed grower estimate remains usable with unknown country. |
| G02 | Useful independent arithmetic and dates | Partial implementation verified | Eighteen resolver tests cover missing inputs, priority, conflicts, overrides, UTC dates, restrictions and input preservation. Existing grower arithmetic supplies the calculations. |
| G03 | Applicable public evidence adapters | Open | Bind actual crop, region, method, units, period, permitted extracts and transfer assumptions. Fixture metadata does not verify an external source or transcribe a regional calendar. |
| G04 | App generation, editing and source-labelled exports | Open | Integrate the resolver with a current actor/site context and inspect actual drafts and exports. Pure scope checks do not establish persistence or account isolation. |
| G05 | Independent release review | Open | Reconcile the current crop candidate, complete applicable whole-project checks and obtain the required same-version Claude, Codex and actual Argon dispositions. |

## Verification

- Scoped TypeScript check: passed for the actual resolver and new regression-test dependency closure. The external check configuration explicitly resolves the checkout's real Node declarations; no declaration shims were added.
- Resolver tests: 18 passed, zero failed, cancelled, skipped or pending. The file is registered in the existing full test command.
- The unlisted-country regression first failed because the resolver selected a country candidate labelled `OTHER`. The geographic match now requires a named country for country/region evidence; site-bound and explicit-transfer handling remain separate.
- Fixture correction: the first run used a workspace identifier rejected by the existing scope validator. The fixture now uses the established `virtual-bed` workspace; the validator and behavioural assertions remain intact.
- Whole-project typecheck and full CI: still required for the integrated candidate. The earlier whole-project attempt reached its deliberate 2 GB heap limit and is not recorded as a pass.
- Output inspected: actual resolver results through tests; app screens, saved records, browser layouts and exports are not implemented or verified here. This does not change the app's picture or `PLAN_VERSION`.

## Next continuation

Add actual source adapters and a user-facing provisional draft through the existing country/site workflow. Preserve the separate South African catalogue gate, saved geometry, existing species identities and paid/account controls. Keep this branch separate from Claude's active crop and Atlas display fixes until their owner agrees the integration point. Before publication, reconcile the current base and test registry; before release, complete G03–G05 rather than presenting the resolver as worldwide agronomic validation.
