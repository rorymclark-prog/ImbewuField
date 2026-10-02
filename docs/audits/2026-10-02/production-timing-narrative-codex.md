# Production timing narrative — 2026-10-02

- Auditor: Codex, with independent page/calendar and PDF/consumer agents.
- Reviewed revision: `1b58ea7f62be2f35cd62d15d1b6d7f51ae0fe149` on `codex/production-summary-scope-20261002`, based on main `ffdab01539ddb762695cfd0e4d08f33056349e72`. The following commit records this exact code SHA and the farmer update note.
- Deployment inspected: both production hosts served `bbdb195` during the final native sample check; the later checkpoint-only release `ffdab01` passed actual hosting, main tests and release-note checks. The narrative correction below was checked locally before publication; final hosting evidence belongs on issue #35.
- Previous audit: [CP-013–CP-014 live edge cases](production-live-edge-cases-codex.md), [CP-001–CP-012 production follow-up](crop-production-codex-followup.md), and [SS-001–SS-004 continuation](site-survey-continuation.md).
- Scope: the production screen's lower narrative, its comparison scope, the canonical food-calendar callbacks and the detailed-reference PDF dashboard.
- Evidence type: hosted native sample, source/consumer review, actual callback tests, native local export, extracted page bounds and rendered PDF inspection.

## What was already done

The production plan, farmer monthly calendar, mapped food inventory, site observations and actual-unit records were deployed by PR #879. Food-only access and decimal aggregation followed in PR #886. PR #888 corrected a release-note history checkpoint after a merge preserved two complete entries but left the first checkpoint older than the incoming Reading work; its main CI and actual deployment both passed. None of those verified changes is reopened here.

A final hosted reread caught a separate narrative defect. The dated sample correctly showed existing cabbage/lettuce in October and onions in November, and its Year of food card counted those same slots. The lower Year ahead text separately excluded all existing crops and used an undated annual calculation, then said nothing was due for picking around September–November. Passing annual narrative tests did not establish consistency with this dated mixed plan.

This changes the picture. `PLAN_VERSION`, species identities, saved geometry, sourced crop timings and benchmark arithmetic remain unchanged.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| CP-015 | Year ahead declared a picking gap during months where existing crops were visible in the dated calendar. Its new-crop benchmark was also treated as a duplicate of a whole active/planned-crop PDF figure. | Implemented; actual callbacks and native local app/PDF verified; final publication evidence on issue #35 | The app requests comparison-only prose from the existing helper, labels it Planned crop comparison and points to the actual Year of food heading. Date/mode/source-switch-dependent food slots remain the sole timing authority. Both export modes receive that same comparison-only array. The detailed PDF preserves the distinct planned-crop total/top crop under explicit scope, rather than filtering it as a dashboard duplicate. |
| CP-013–CP-014 | Food-only plan access and binary decimal tails. | Carried forward; PR #886 deployed | The hosted sample retained exact `1 203,6 kg` with separate 12 eggs and 2 jars. Native coop-only access/export and arithmetic evidence remain in the preceding audit. |
| CP-001–CP-012 and SS-001–SS-004 | Prior farming-source, cultivar, saved-site, language and device limits. | Carried forward with prior dispositions | No current local variety approval, private Ubhejane recovery, signed-in cloud roundtrip, physical-device or fluent-language acceptance is claimed. |

The helper's default annual narrative remains available for reference producers, with explicit repeating-new-bed-crop scope and no blanket Nothing is due for picking claim. The runtime app suppresses that annual timing/storage prose and uses its existing dated food chart. Unknown yields, soil-cover explanations, conflicts and succession cautions remain intact; no monthly kilogram curve or new farm forecast is introduced.

## Verification

- Typecheck: final integrated `npx tsc --noEmit` passed on Node 24.
- Full test suite: 4,496 total; 4,495 passed; zero failures/cancellations/skips; one existing `shape-sync-loss` TODO; 76.4 seconds. No assertions were deleted or weakened.
- Whitespace and notes: `git diff --check` and `npm run notes:pending` passed.
- Actual page callback tests reproduce existing October/November crops, distinguish their own season from the following year, and exercise eight year-mode/tree/animal-switch combinations with locally confirmed fruit and eggs/honey. React dependencies and both real export props are checked. The subtitle destination is checked against the actual visible YearOfFoodCard heading.
- Model controls retain the benchmark when annual narrative is disabled, exercise real stored-food output in default mode, forbid whole-farm picking claims, preserve unknown-yield/cover/conflict warnings and leave saved inputs untouched.
- PDF test uses a synthetic existing-chard/planned-carrot fixture: both the dashboard's 40 kg comparison and the new-cycle 20 kg figure survive under separate scopes. [Mixed fixture comparison](evidence-crop-production/planned-crop-comparison-mixed-fixture.png). These are sourced model comparisons, not measured farm production.
- Native local output: [1280×720 scoped comparison](evidence-crop-production/planned-crop-comparison-app.png) and [actual detailed-reference page 2](evidence-crop-production/planned-crop-comparison-native-pdf.png). A fresh local-origin export produced 28 pages, retained the sample's planned-cycle figure and had zero text characters outside page bounds. Its comparison page was rendered and seen; the whole export contained no misleading Nothing is due for picking claim or Year ahead heading. An earlier stale local preview was rejected because it dropped the comparison paragraphs; it is not the verified final artifact.
- Layout limit: the optional detailed reference comparison can occupy a sparse second page to keep the heading and paragraphs together. The farmer calendar/default section choices are unaffected. Physical print readability still needs farmer/device review.

## Next continuation

1. Finish exact-head CI, merge and actual hosting verification for `codex/production-summary-scope-20261002`; record full SHA, main tests, release-note check, both live hosts and native live scope on issue #35.
2. Carry forward CP-012/SS-003 disposable signed-in save/reopen/site-switch checks and SS-001 draft recovery acceptance.
3. Complete current local cultivar/breed/source review, fluent-language acceptance and physical-device/field-worker review from the prior audits. The earlier unretrieved honey reference remains open.
