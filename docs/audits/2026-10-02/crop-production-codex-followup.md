# Crop and production plan follow-up — 2026-10-02

- Auditor: Codex; implementation and independent QA shared by the parent agent, crop-model agent and inventory agent.
- Reviewed revision: `366f3e93dfbc47689db5a5ebce500fab2e8ee348` on `codex/ubhejane-farmer-crop-print-20261002`, with the integrated production-plan, site-observation and record-unit changes. The following note commit only adds release wording and this SHA reference. Deployment evidence is recorded on issue #35.
- Deployment inspected: independent checks in this record used local source and generated PDFs. Hosted build verification remains the release owner's task.
- Previous audit: [current register and CP-001–CP-008](crop-production-audit.md), its [preserved original audit PDF](Ubhejane-Crop-Plan-Audit-2026-10-02.pdf), and [site-survey continuation](site-survey-continuation.md).
- Scope: `/facilitator/crops`, farmer/reference PDF exports, mapped food inventory, crop varieties, same-site observations and production records.
- Evidence type: source review, primary-source review, automated rules and actual-PDF tests, rendered PDF pages; the parent separately reports native-browser sample export and mobile-viewport checks.

## What was already done

The prior register remains the original finding authority. Its regional arithmetic and printed-plan findings are carried forward below; the original report is not overwritten. Existing survey storage, mode switching, language source pairs and report integration are retained rather than replaced.

The temporary pasteboard path for the supplied farming PDF became unavailable. Preserved printed rows support a **reconstruction**, not a recovery of the current private Ubhejane design. Revised reconstruction exports label inferred starter status, printed area precision and unavailable saved tree/animal inventory. Synthetic inventory, production-observation and regional cases are separate test fixtures.

This work changes the picture: the default farmer PDF has a bed-by-bed month timeline, picture availability, purchasing, monthly work and unitful field records. Saved geometry, verified species names, generated variety/harvest datasets and `PLAN_VERSION` are unchanged by this follow-up.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-001 | National avocado windows were presented as one farm's long season. | Verified in model/print; release check pending | Regional reference windows remain separate. `TreeSeasonChoices` requires locally confirmed bearing status and months. Unconfirmed dates create no farm bar. |
| CP-002 | Banana and designed food sources disappeared when dates were unknown. | Verified in model/print; release check pending | Dated-capable known plants and undated layouts survive. No-dossier catalogue food plants can record their own observed months without source yields. Generic fruit elements remain unidentified inventory. See synthetic evidence below. |
| CP-003 | Honey disappeared in export and Simple mode hid enterprise choices. | Verified in model/print; release check pending | Hives/coops remain inventory without products or animal counts inferred from housing. Purpose choices and local month confirmation are accessible in Simple mode. Changing purpose invalidates incompatible month choices. |
| CP-004 | First-year and established-year assumptions disagreed. | Verified by dated rules and PDF guards | Default print follows the current twelve-month horizon. Established templates are labelled comparison views. No future sowing creates an earlier pick or stored-food window. |
| CP-005 | Partial-bed allocations were lost from monthly jobs. | Verified by model/PDF tests and rendered fixtures | Jobs preserve recorded share/area. Separate sowings of one crop retain separate calendar cohorts. Overbooking and invalid shares have visible warnings; rendering does not alter geometry. |
| CP-006 | Calendar passage silently promoted unconfirmed starters. | Verified by model/PDF tests | Pending sowings need a farmer decision; finished dated cohorts do not recur as future crops. Neither creates a future lane, task or expected pick. |
| CP-007 | Rate-based buying, nursery reminders and storage guidance were incomplete. | Implemented and independently checked; final pack check pending | Oat purchases use the existing source weight rate, without fake spacing/plant counts. Packet quantities stay unknown where spacing cannot establish an order. Transplant readiness and sourced storage conditions remain explicit. |
| CP-008 | Tiny type, orphan rows and incomplete field records weakened use. | Rendered improvement verified; physical-user review still needed | Timeline fixtures include long labels, repeated headers, cover finish and shared cohorts. Parent reports seeing the actual sample export, including the new production-unit record page. Type and layout are software-checked; physical-device/field-worker acceptance is not claimed. |
| CP-009 | Research-inferred cultivar zones were claimed as explicit local source recommendations; uncertain traits looked instructional. | Verified source defect; corrective wording verified | `VarietyGuidance` and shared production guide provide names/source links under a cautious climate shortlist. No inferred seed-saving, season-only, maturity or trait instructions leak into these summaries. Recorded names do not change crop timing or yield. Current complete cultivar validation remains open. |
| CP-010 | Survey records or the prior site's climate could create false current-site facts or future production. | Verified boundary rules; release check pending | Keyed survey/climate snapshots isolate sites. Unknown water/frost/production stay unknown; invalid draft years/months/quantities are rejected. Annual records retain their stated units/year and do not create a future yield curve. Current-cohort frost checks and food-gap suggestions reuse canonical field occupancy. |
| CP-011 | No-dossier food plants could not record their own observed dates; restricted mapped plants could vanish. | Verified in model/print | `placedTreeGroups` now includes permitted catalogue food identities with `referenceMissing`, empty source windows and null source figures. Existing confirmation/storage/availability authority handles observations. Restricted mapped food retains the catalogue flag as inventory, without a new legal classification, propagation advice or production dates. |
| CP-012 | Kilogram-only harvest/sale forms could not honestly record eggs or jars. | Implemented; model, rules and sample-browser flow verified; signed-in check remains open | Parent/model agents extend the existing collections with explicit quantity/unit and unknown mass for counts. Unit grouping, mass-only analytics, invoices, server rules, deployed-rule verification and frontend checks must be included in the final release record. Never convert egg/package counts into kilograms without a measured mass. |
| SS-001 | Unsaved survey edits have no persistent reload/device-restart recovery. | Open improvement; carried forward | New observations use the existing explicitly saved survey. This change does not add silent draft publication or claim draft recovery. Acceptance remains site/account-scoped resume/discard and successful-save cleanup. |
| SS-002 | Consequential language drafts lack fluent/local farming review. | Open review dependency; carried forward | Source pairs/draft notices remain. Added farming observations, units and guidance also need the documented review; software checks do not approve translations. |
| SS-003 | Full current signed-in save/reopen/report journey is unverified. | Needs verification; carried forward | Disposable-site signed-in checks must verify matching deployed app and Firestore rules, save/reopen, site switching and report facts. Sample/native-browser checks do not establish this path. |
| SS-004 | Physical phone/iPad and Safari ergonomics are unverified. | Needs verification; carried forward | Viewport screenshots are not physical-device tests. Exercise keyboard entry, rotation, review scrolling, Save/discard and storage-failure retry. |

### Independent rendered evidence

All examples below are explicitly synthetic; their counts and confirmed months are not claimed as Ubhejane facts.

- [Unknown mapped food: names, counts, generic pear and catalogue restriction retained](evidence-crop-production/mapped-food-unknown.png).
- [Confirmed local months: olive and black mulberry appear only in the recorded slots](evidence-crop-production/mapped-food-confirmed-months.png).
- [Proposed olive and unresolved/flagged inventory remain separate from dated picks](evidence-crop-production/mapped-food-confirmed-inventory.png).
- [Native-browser sample PDF: crops over months](evidence-crop-production/native-sample-calendar.png), [production records with actual units](evidence-crop-production/native-sample-production-record.png) and [mobile sample guidance](evidence-crop-production/mobile-sample-guide.png). The parent inspected these public isolated-sample outputs; they contain no private saved-farm evidence.

The independent inventory-only fixture also shows a low-priority layout opportunity: with no crop beds, a largely empty vegetable/utilisation page precedes inventory. This does not lose food sources or invent picking dates, but a later farmer-usability pass could suppress empty sections. Do not change agronomic rules to fill the page.

### Primary-source findings

The current catalogue has 49 crops; generated cultivar research covers 28 records with 105 named entries, some combining names. Twenty-one catalogue crops have no generated variety record. `varietiesForSite` remains the shared authority; it is not complete contemporary regional validation.

| Primary source inspected | Supported use and limitation |
| --- | --- |
| [KZN DARD onion guide](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/onion.pdf) | Names KZN options and explains latitude-dependent bulbing/curing considerations. Undated guide with 1993–1997 market data; does not prove current stock or farm fit. |
| [KZN dry-bean recommendations](https://www.kzndard.gov.za/images/Documents/RESOURCE_CENTRE/GUIDELINE_DOCUMENTS/AGRI-UPDATES/Dry%20Bean%20Cultivar%20Recommendations.pdf) | Genuine regional multi-site trials, published April 2013 from 2009/10–2012/13 seasons. Historical managed-trial rankings require current local confirmation; not a school-bed yield promise. |
| [KZN DARD lettuce guide](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/lettuce.pdf) | Named cultivar distinctions and separate frost sowing groups. Does not assign each cultivar to the app's eight areas; historical market data do not establish 2026 availability. |
| [ARC March 2024 newsletter](https://www.arc.agric.za/arc-vopi/Newsletter%20Library/ARC-VIMP%20Newsletter%2019,%20March%202024.pdf), [sweet-potato breeding](https://www.arc.agric.za/arc-vopi/Pages/Plant%20Breeding/Sweet-Potatoes.aspx), [vine nurseries](https://www.arc.agric.za/arc-vopi/Pages/Crop%20Science/Sweet-Potato-Nurseries-for-Multiplication.aspx) | Supports existing cultivar references and disease-free vine access. Breeding history or a market address is not comparative farm suitability; clonal crops do not inherit inferred seed-saving instructions. |
| [Sakata Scarlet Nantes bulletin](https://sakata.co.za/wp-content/uploads/2024/09/SCARLET-NANTES.pdf), [current product page](https://sakata.co.za/shop/vegetables/carrot/scarlet-nantes-carrot/) | Primary wording is “best suited to early cool season production”; the research summary's “cool-season only” was stronger. Old dossier URL is stale. Specific bulletin timing must not silently replace general crop timing. |
| [Starke Ayres December 2020 catalogue](https://www.starkeayresgc.co.za/wp-content/uploads/2022/04/SeedsFertilizer-Care-Catalogue-A4-DEC2020-min.pdf) | Corroborates existing bush-bean names. Historical marketing does not prove regional trial performance, current stock or climbing-bean geometry. |
| [ARC maize trials](https://www.arc.agric.za/arc-gci/Pages/Maize.aspx), [trial interpretation](https://arc.agric.za/arc-gci/Documents/Maize%20reports/2016/oos16.pdf) | Comparisons need multiple sites/seasons. The existing blank maize shortlist is more honest than a claimed best current cultivar selected from an old isolated result. |

Several dossiers explicitly infer coarse climate zones. Others use search summaries, abstract mirrors or historical locations. Generated data/scripts were not rewritten here. Inspect original sources, publication date, identity and current availability before restoring detailed cultivar instructions. Existing unknown schedules, spacing and yields remain unknown; a variety name cannot supply them.

## Verification

- Typecheck: final integrated `npx tsc --noEmit` passed on Node 24.
- Full test suite: 4,473 tests, 4,472 passed, zero failures, zero skips, one existing `shape-sync-loss` TODO; 85.9 seconds on Node 24. All 55 Firestore emulator tests passed, including valid count records, forbidden phantom weights, invalid units and cross-account rejection. Independent targeted runs also passed. The first integrated run caught missing readability-register entries for the two new record components; both are now held to the existing 12px farmer floor, without exemptions or weakened assertions.
- Whitespace: final whole-branch `git diff --check` passed.
- Output inspected: nine synthetic timeline fixtures, thirteen pages in that run, rendered and viewed; actual-PDF guards test default timelines, distinct cohorts, impossible shares, cover Finish wording and pending/finished exclusion. Four latest unknown/confirmed mapped-food PDF pages were independently viewed, with durable synthetic images linked above. Parent separately reports a native-browser sample PDF download and inspection of pages 1, 2 and 23 of its 23-page output plus mobile-viewport screenshots; all 23 pages had zero text characters outside the page bounds; those are attributed checks, not independent signed-in/physical-device evidence.
- Regional checks: the current follow-up ran 540 scenarios across eight stored NASA climate fixtures plus the recorded Mkuze fixture, all twelve start months, managed/rain-fed water, and synthetic Jun–Aug frost overrides. Zero scheduling, heat, rain-fed or occupancy faults. Negative controls withheld benchmarks for invalid shares/overbooking and refused rain-fed planning without climate evidence; a missed sowing produced no asserted picking months. Synthetic frost controls are not measured regional frost dates. Detailed reproducible inputs/results remain in the local output folder, separate from private saved-farm claims.
- Other limits: no complete agronomist/cultivar approval, fluent-language sign-off, physical-device check or disposable signed-in integration run is claimed. The previously unretrieved underlying honey-flow reference remains a source-verification limitation.

### Final integrated sample-browser checks

The parent used the isolated public sample workspace at a 390×844 viewport. Fractional egg quantities were rejected before writing. Saving 12 eggs and 2 honey jars left the existing kilogram totals unchanged. A six-egg sale for a synthetic R24 opened its saved paid invoice showing `6 eggs × R4`; returning to records retained both count harvests and counted the payment once. The updated summary puts each unit on its own readable line. See [record-unit totals](evidence-crop-production/mobile-sample-record-units.png) and [saved egg invoice](evidence-crop-production/mobile-sample-egg-invoice.png). These are disposable test observations, not Ubhejane production or a real transaction.

Earlier native-browser checks exercised optional survey observations, review/edit links, whole-hen-count validation and explicit Save. Saved water, frost and poultry observations reached the plan guidance. This does not establish the signed-in cloud save/reopen path or a physical-phone check.

The release owner will record exact-head CI, production app SHA and matching rule-deployment results on [issue #35](https://github.com/rorymclark-prog/ImbewuField/issues/35). This document records pre-publication checks; deployment is not inferred from a local test pass.

## Next continuation

1. Finish integrated typecheck/full suite, exact-head CI, Vercel release and matching Firestore-rule deployment verification. Record SHA/URLs and actual checks here and on issue #35. Current branch is `codex/ubhejane-farmer-crop-print-20261002`, [PR #879](https://github.com/rorymclark-prog/ImbewuField/pull/879).
2. Verify CP-012 on a disposable signed-in site: count-unit harvest/sale, legacy weighed records, grouped totals, invoice linkage and source-consistent report views; retain SS-003 until that evidence exists.
3. Continue SS-001 draft recovery and SS-002/SS-004 review using their prior acceptance checks. Keep explicit saved survey facts as the reporting authority.
4. Refresh cultivar sources locally and seasonally before claiming full regional recommendations. Confirm actual water capacity, soil, drainage, shade, frost pocket, planting material and buyer prices; climate means cannot establish those facts.
5. The plan retains vegetables, staples, mapped fruit/nuts/berries and animal products, but neither complete farm profit nor a measured household food-sufficiency forecast is asserted. Housing is not headcount; local month observations are not guaranteed output. Production records can inform a later review, without invented monthly kilograms, automatic yield calibration or a claimed multi-year rotation history.
