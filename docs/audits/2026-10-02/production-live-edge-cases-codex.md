# Production-plan live edge cases — 2026-10-02

- Auditor: Codex, with independent crop-model, inventory and UI-guard agents.
- Reviewed revision: `4729738da97360dc3b267fa0cba88fff7ca8fe91` on `codex/production-record-total-precision-20261002`, based on main `dca05ac578db4e1c50cdec7fc442853df81524c6`. The next commit adds only this exact SHA reference and the farmer update note.
- Deployment inspected: `https://imbewufield.vercel.app` and `https://permamap-sa.vercel.app` independently returned `dca05ac`; these observations belong to the first production release. Follow-up checks below use the latest local code. Final hosting evidence is recorded on issue #35.
- Previous audit: [production follow-up and CP-001–CP-012](crop-production-codex-followup.md), [original register](crop-production-audit.md) and [SS-001–SS-004 continuation](site-survey-continuation.md).
- Scope: food-source-only production plans, auto-suggest boundaries, accumulated quantity summaries in Records/lender/staff views.
- Evidence type: real hosted sample, native local browser, actual downloaded PDFs, source/AST boundary tests and decimal arithmetic tests.

## What was already done

PR #879 merged to `dca05ac` and deployed successfully. Exact-head and main CI, actual Vercel upload/domain aliases/live-SHA verification and actual Firebase rule-release steps all passed. [Release ledger](https://github.com/rorymclark-prog/ImbewuField/issues/35#issuecomment-5955953172) records full SHAs and workflow links.

The live public isolated farm sample resolved its own-coordinate satellite climate to the Subtropical coast / Lowveld / Bushveld group. Its native 23-page farmer PDF downloaded successfully; the monthly calendar and actual-unit record page were visually inspected. This is sample evidence, not recovery of the private saved Ubhejane design.

That live check found decimal addition noise in the Records total. Source review then found a separate unconditional crop-bed gate, which hid production tools from food-tree- or animal-only maps. The following corrections retain the original production model, observations, unknown dates, source choices, units and saved geometry. This changes the picture. `PLAN_VERSION` is unchanged.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-013 | A map with fruit trees, unresolved food layouts or animal housing but no vegetable/staple beds showed the empty state and hid confirmation/export. | Implemented; local model/native housing-only checks verified; final release check recorded on issue #35 | The shipped JSX gate now considers the canonical tree, unresolved-food and housing groups. Truly empty maps retain help. No virtual bed is injected. Auto-suggest cannot open, generate or accept without a crop bed; source confirmation and PDF remain reachable in Simple and All tools. AST tests exercise that actual gate against orchard, coop+hive, banana-layout and no-dossier olive cases. |
| CP-014 | Decimal harvest totals displayed `1 203,6000000000001 kg`, including downstream summaries. | Implemented; arithmetic and native Records checks verified; final release check recorded on issue #35 | Canonical decimal strings accumulate as BigInt mantissa/exponent; one final Number conversion. Saved observations and exact/tiny labels stay unchanged. Matching units stay separate; unsafe whole totals or overflowing masses are withheld. Staff garden figures reuse that authority, and signed original observations derive unmatched weight without float tails, invented zero or clamped oversold balances. |
| CP-001–CP-012 | Earlier planning, inventory, cultivar, survey and unit findings. | Carried forward with the verified first release above | No earlier source or field-review limitation is silently closed. CP-012 still needs the disposable signed-in cloud save/reopen journey; successful rule deployment and local sample writes do not prove it. |
| SS-001–SS-004 | Draft recovery, fluent/local review, signed-in journey and physical devices. | Still open, as in the prior continuation | Continue with the prior acceptance checks and actual user/device evidence. |

## Verification

- Typecheck: `npx tsc --noEmit` passed on Node 24 after all six source/test files were frozen.
- Full test suite: 4,487 total; 4,486 passed; zero failures/skips; one existing `shape-sync-loss` TODO; 70.1 seconds. No assertions were removed or weakened. The staff source guard was rewritten from pinning a reduce implementation to requiring explicit unknown-weight coverage; new arithmetic and actual-branch cases provide independent failure conditions.
- Whitespace: `git diff --check` passed.
- Arithmetic checks: decimal addition/control order, explicit high-precision inputs, tiny scientific exponents, safe whole-count boundary, overflowing totals, exact signed zero and oversold balance. Three new decimal regressions failed before the arithmetic correction, then passed.
- Output inspected: the native local isolated sample saved 12 eggs and 2 honey jars while retaining an exact `1 203,6 kg` total and matching lender summary. [Desktop quantity evidence](evidence-crop-production/exact-record-totals.png). This is not a signed-in cloud write.
- A separate previously empty local test design received one proposed coop through the ordinary design UI. With zero crop beds, it opened the full production screen, disabled auto-suggest, exposed care/purpose controls and downloaded a nine-page farmer PDF. [390×844 survey/poultry guide](evidence-crop-production/phone-coop-only-controls.png), [390×844 export success](evidence-crop-production/phone-coop-only-production.png), [visually inspected undated housing checklist](evidence-crop-production/coop-only-care-checklist.png). The proposed coop does not establish a bird count, eggs, picking dates or future output.
- Other limits: phone viewport checks are not physical devices. No complete current cultivar validation, fluent-language approval, private Ubhejane recovery or signed-in cloud roundtrip is claimed. The earlier honey-reference limitation remains.

## Next continuation

1. Finish exact-head CI, merge and actual hosting verification for `codex/production-record-total-precision-20261002`; record full SHA and deployment evidence on issue #35. Data rules did not change in this follow-up; the tested rules actually released by PR #879 remain the matching authority.
2. Continue CP-012/SS-003 with a disposable signed-in site and matching deployed app/rules; verify save/reopen, site switching, unit counts and report/invoice identity.
3. Continue SS-001 draft recovery and SS-002/SS-004 user/language/device review with the prior acceptance checks.
4. Refresh cultivar records and actual local growing conditions. Only 28 of 49 crops currently have cultivar research records; climate grouping and a source name are not complete local variety approval.
5. The food-only PDF can still contain largely empty crop/buying pages before housing guidance. A future usability pass can omit empty sections without inventing production. This is the prior low-priority layout opportunity, not a loss of food sources.
