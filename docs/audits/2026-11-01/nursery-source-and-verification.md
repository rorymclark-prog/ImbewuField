# Nursery forecast: source interpretation and verification — 2026-11-01

- Auditor: Codex independent verification agent, alongside the implementation and integration reviewers.
- Reviewed revision: `0f34e304344a5e9d1c59f539d1187bd6a2b8d491`, branch `codex/nursery-crop-planner`, plus the local nursery work. Final revision and publication evidence belong to issue #35.
- Deployment inspected: none by this reviewer.
- Previous audit: [Production plan re-audit — 10 October](../2026-10-10/production-reaudit-codex.md), retaining CP-030–CP-046 and the earlier CP lineage. This nursery review does not reopen or certify those findings.
- Scope: shared crop-plan nursery arithmetic, grower-entered resources, dated cohorts and source qualifications. No catalogue, species, lesson, saved geometry, field-task or yield changes are authorised by this review.
- Evidence type: primary-source reading, existing-source tracing and independent automated adversarial tests. Browser appearance and saved-plan recovery belong to integration verification.

## What was already done

The existing crop plan owns mapped areas, field-position ranges, sowing occurrences and the monthly field calendar. Nursery demand must derive from those authorities. The prior production audit distinguishes dated forecasts from observations, preserves unknown data and avoids treating mapped structures as stock. Those distinctions also apply to trays and nursery surfaces.

## Source interpretation

Sources were opened on 1 November 2026. These are design evidence and limitations, not new South African growing prescriptions.

- [Heirloom nursery overview](https://heirloom.ag/help/nursery/overview) connects planned plants, container dimensions and nursery duration to propagation-space demand. It distinguishes the season view from current plantings. ImbewuField has no new task-completion or observed-stock ledger in this scope; a calculated present-week value remains a forecast.
- [Heirloom nursery forecast](https://heirloom.ag/help/nursery/predicting-space-tray-needs) distinguishes simultaneous peak tray usage from total seasonal tray uses. It also models potting-up container stages. ImbewuField's initial single-container recipe does not implement those stages. Its weekly display must preserve actual interval overlap rather than counting every cohort that touches a week as simultaneous.
- [Utah State University transplant production](https://extension.usu.edu/vegetableguide/production/transplant-production) explains that cell size and growing conditions affect transplant performance, space and production time. This supports requiring the grower's actual equipment and estimates. It does not justify copying Utah conditions, crop durations, densities or treatment rates into a South African plan. No numeric recommendation from that page is added.
- The existing [KZN DARD Plant Establishment source](https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_establishment.pdf) returned 404 in the integration review on this date. Its previously reviewed spacing data and shared one/two/three-month calendar interpretation are retained, not represented as freshly revalidated. No replacement number is invented. A future source repair needs primary-source review.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| NUR-001 | Re-rounding each bed or merging different dates/varieties can over-order trays or erase separate crops. | Automated contract verified | Independent fixtures compare shared BOQ cohorts with a combined-area oracle, preserve saved years and named varieties, and reject duplicate seasonal recurrence. |
| NUR-002 | Applying nursery losses twice, or confusing field establishment with nursery survival, can inflate or understate sowing demand. | Automated contract verified | Seed-cell fixtures explicitly compound entered germination and post-germination survival; measured usable starts already include nursery losses, including multi-sown output above the tray's cell count. Field survival is separate and optional. Fixture figures are arithmetic examples, not advice. |
| NUR-003 | Missing dimensions, deleted references or another farm's equipment can silently appear to provide free capacity. | Arithmetic verified; UI integration check required | Tests verify unknown surface demand, missing rates, strict site scope and known demand alongside unknown demand. Zero stock/surface produces shortages; zero success and numeric underflow cannot produce a finite sowing recommendation. Global incompleteness must remain visible before individual resource rows, whose zero demand cannot account for unassigned cohorts. |
| NUR-004 | Seasonal tray totals or week-bucket sums can report stock shortages when cohorts never coexist. | Automated contract verified | Peak checks use simultaneous intervals, including an end/start tie within the same reporting week and a separate positive overlap control. A seasonal total remains a separate workload measure. |
| NUR-005 | Grower nursery weeks can silently shift published field work or imply precise planting dates. | Automated contract verified | Tests verify conservative month-based envelopes, an exposed readiness conflict, unchanged canonical tasks and input immutability. The existing field/yield authority is retained; no new yield guarantee is checked or claimed. |
| NUR-006 | A forecast can be mistaken for observed stock, packing capacity, a potting-up schedule or a weekly food guarantee. | Scope limit | None of these are established by nursery arithmetic. Appearance, wording and save/reopen evidence need separate integration review. |
| NUR-007 | Reloading in a later month removed a confirmed sowing's nursery flag before its forecast reservation ended, falsely freeing tray and surface capacity. | Reproduced and corrected; two regression tests pass | Execute `confirmOnceSowing`, then the actual `settleOnceRows` used on load, then forecast again. The original implementation returned no cohorts. The correction retains a `confirmed-sowing` forecast reservation until its computed end, using a local BOQ projection without changing saved field state or tasks. Tests cover the existing calendar envelope and a longer grower duration, expiry, malformed dates and completed rows. |
| NUR-008 | Binary rounding could turn an exact 200-seed requirement into 201, adding an entire tray and a false stock shortage. | Reproduced and corrected; two regression tests pass | Grower rates of 50% germination and 57% nursery survival with 57 required starts need exactly 200 seeds. Exact decimal-rational ceiling now sizes field survival, nursery success and measured tray output; nearby genuinely larger requirements still round upward. Decimal and exponent-form inputs are covered; no blanket epsilon is used. |
| NUR-009 | Simple mode's nursery sourcing link targeted the buying calendar that Simple mode hides. | Reproduced in hosted review; correction and two navigation regression tests pass locally | Simple now targets the nursery's own always-present needs section. All tools retains the existing buying-calendar destination. The real page supplies the visibility flag; no appearance preference or saved farm state is changed by navigation. |

These IDs record new-feature failure modes and their verification, rather than claiming that every listed defect was reproduced on the baseline before the feature existed.

NUR-007 was reproduced during the later integration review and is an exception to
that distinction: its new regression failed before the correction. A confirmed
sowing reservation does not claim that seedlings are still physically in trays.
The interface labels this phase separately and treats its seed quantity as a
historical reference rather than another purchase.

## Integration continuation

The nursery forecast is also shown, collapsed, beside the existing Seeds &
seedlings buying calendar. It uses the same forecast calculation and keeps the
grower's seed estimates and resource shortages separate from the calendar's
no-loss field-position references. Nursery links lead to that section and the
existing task planner. No packet size, price, purchasing lead time or second task
calendar is introduced. The dated CSV exports the same forecast and known/unknown
resource values, with the existing spreadsheet-formula protection.

The first full local run found an overlong new update notice. The notice was
shortened to 78 characters; its four source-paired translation drafts were kept
in step. Required checks on the final revision and hosted/production evidence
are recorded in the release handoff below and issue #35.

## Verification

- Typecheck: `npx tsc --noEmit` passed after the 16-case test file was complete.
- Affected tests: **16/16 passed**, zero failures/skips/TODOs, with Node 24 and the repository alias loader: `node --import ./tests/register-alias.mjs --test tests/nursery-forecast-adversarial.test.ts`. The run took 0.69 seconds. Tests assert manually calculated fixture outcomes, include positive overlap controls and compare shared BOQ agreement; they do not infer correctness from an implementation snapshot.
- Full test suite: not run by this reviewer; integration reviewer owns the required full-suite run.
- Whitespace: `git diff --check` clean for this reviewer's two paths after the completed edits.
- Output inspected: no nursery screen or export inspected by this reviewer. Tests alone cannot establish visual correctness.
- Other limits: no observed germination trial, resource measurement, local cultivar validation, actual nursery inventory, potting-up sequence, bin-packing check, private farm save/reopen, fluent isiZulu or physical-device review.

The nursery interface changes the picture; this source/test review itself adds no artwork. `PLAN_VERSION` remains unchanged. Synthetic test rates, tray dimensions and durations are entered examples for arithmetic only, never recommended farming values.

## Next continuation

1. Re-run the affected checks if the forecast implementation changes; no failure was reproduced by this reviewer's 16-case run.
2. Finish integration verification: storage isolation and failure/recovery, real app controls, narrow screen and language behavior, full suite and current-head release checks.
3. Record branch, final SHA, checks and audit link on issue #35; consult that ledger for release status.
4. Repair the unavailable KZN source only with a separately reviewed authoritative source; preserve the existing reviewed constants in this task.


## Local browser integration evidence — nursery UI reviewer

The UI reviewer inspected the running app on `http://localhost:4247/facilitator/crops`
on 1 November 2026 using the repository Playwright skill, a separate Node 24 dev
server and the `nursery-release` session. This is local working-tree evidence,
not a hosted preview or production verification. Only the public demonstration
farm was loaded, through **Choose a view → Open Farmer**. No private farm was
accessed, no paid generation ran and no mapped geometry was changed.

Completed checks:

- Opened the Nursery planner against the sample farm's accepted future crop
  plan. Three dated cohorts appeared: Broccoli in February 2027 (Bed 6),
  Lettuce in September 2027 (Bed 2), and Tomatoes in October 2027 (Bed 4).
  Before equipment/recipes were entered, tray and surface requirements stayed
  **Unknown**, with an explicit incomplete-forecast warning.
- Through visible controls, added the synthetic `QA net bench` with 0.05 m² net
  allocated surface and `QA 20-cell tray` with 20 cells, 30 × 40 cm outer size,
  and one owned container. These are disposable arithmetic examples, not
  recommended equipment dimensions, success rates or growing instructions.
- Saved a Broccoli recipe with 80% entered germination, 75% entered nursery
  survival and a deliberately long 20-week nursery duration. The screen showed
  source field positions and usable starts **11–21**, seeds **19–35**, whole
  tray fills **1–2**, and footprint **0.12–0.24 m²**. It reported a known bench
  shortage of at least **0.19 m²** and a known stock shortage of at least **one
  container** while preserving the other two crops' unknown demand and the
  global incompleteness warning.
- The 20-week entry visibly reported a readiness conflict, with readiness
  21 June–18 July 2027 and the working field month still April 2027. The
  canonical field date was not moved by this nursery edit.
- Actually opened and viewed these screenshots with the image tool at
  **1440 × 1000, light theme**:
  `output/playwright/nursery/initial.png`,
  `output/playwright/nursery/desktop-light-forecast.png`, and
  `output/playwright/nursery/desktop-light-editor.png`.
  The initial screen, rendered cohort cards and equipment editor were legible,
  with no visible clipping in those captured areas. The forecast screenshot
  shows the lower Broccoli warning and the Lettuce/Tomatoes unknown cards;
  its filename does not imply that the summary header was captured. The
  screenshots remain local QA artifacts and are excluded from the commit.

UI changes made by this reviewer: navigation links from Nursery planner to
`#nursery-purchasing` and `/cropplan`, field-calendar explanation, and explicit
`confirmed-sowing` wording for historical reservations. The confirmed-sowing
wording was added after the preceding live checks and is not separately
browser-verified here. These components change the picture; `PLAN_VERSION`
was left unchanged.

**Unfinished browser release gate:** 390-pixel phone views, dark-theme views,
deleting equipment while retaining a dependent recipe, save/reload recovery,
the automatic crop proposal's nursery preview, and the new navigation links'
complete destination behavior were not verified. The live development session
underwent Fast Refresh full reloads during concurrent library changes, then its
browser target closed. A separate CUA in-app-browser attempt and a named Chrome
attempt both returned **“Local browser use is disabled in Work settings.”**
Browser actions stopped at that explicit availability boundary. No passing
claim is made for the unfinished checks, and this local desktop evidence does
not satisfy the remaining visual release gate.

The dev console also recorded an existing LimaBar server/client style-attribute
warning and initial development stylesheet requests that returned 404. The
screenshots above show the eventually rendered styles; neither message was
claimed resolved by this nursery review. Typecheck, full tests and current-head
CI/publication are owned by the integration reviewer. `git diff --check` passed
after this reviewer's UI and evidence changes.

## Hosted release continuation — 2 November 2026

Browser access became available after the owner resumed the goal. The hosted
preview at `imbewufield-nursery-crop-planner.vercel.app` reported SHA `30554e7`.
Its full push and pull-request CI passed: 6,295 passes, zero failures and one
pre-existing TODO out of 6,296 tests; both rules and focused-render jobs passed,
and the preview build succeeded. The interrupted local full run remains
incomplete, not a pass. The unchanged cancelled crop-plan-notes suite separately
passed 20/20.

Actual hosted controls and screenshots were inspected at 1440×1000 and 390×844,
in Earth light and dark modes. At phone width the measured page width remained
390px. A fictional 20-cell 30×40cm tray, stock one, 0.05m² allocated bench and
80%/75% success recipe for an existing sample Broccoli cohort produced 19–35
seeds, one–two tray fills and 0.12–0.24m². The interface exposed at least one
missing tray and 0.19m² shortage while the other crops remained unknown. An
entered 20-week duration exposed the late-readiness conflict without moving the
April field month. Fixture figures are checks, not recommendations.

The buying calendar in All tools showed the same forecast. Removing the
fictional container kept the crop recipe with its rates and made its missing
container explicit. A commercial proposal showed eleven combined nursery
cohorts before acceptance, while the saved plan still had three; accepting its
fifteen fictional sowings updated the saved forecast to eleven cohorts.

Normal signed-out persistence was checked separately from the resetting tour:
a 1.25m² bench and 72-cell 30×50cm tray with stock four survived hard reload and
reselecting the same virtual site. A recipe with missing rates remained explicitly
unknown. The existing virtual-bed view itself is not remembered across reload;
reselecting it does not erase its saved nursery resources. Tour data is a separate
resetting sandbox, so it was not used as evidence of account persistence.

Hosted inspection reproduced NUR-009. The correction changes navigation only;
its clean typecheck and 218 affected checks include two new navigation tests.
That changed head needs a fresh preview and the required current-head CI before
merge. Captured JPEGs remain local in `output/playwright/nursery-release/`; no
private farm information or screenshots are included in the source commit.
