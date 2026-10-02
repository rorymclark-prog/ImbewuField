# Ubhejane six-report continuation — 3 October 2026

- Auditor: Codex, following Rory's request for six actual reports: simple and
  comprehensive editions of assessment, design/implementation and progress/review.
- Reviewed repository revision: `65a72ef5ab2221217e4aefcf103b4bb536d01237`,
  `codex/site-survey-visual-review-20261002`. This continuation changes documentation.
- Deployment inspected: `https://imbewufield.vercel.app/`, signed in as Rory.
  The deployed build SHA was not established; do not equate it with the repository
  revision above or claim the open survey branches are deployed.
- Previous audit: [report coverage and stages, 2 October](../2026-10-02/site-report-coverage-and-stages-codex.md).
  SS-001–SS-010 retain their previous implementation/release dispositions.
- Evidence: signed-in saved-site survey review, current report/design quantities,
  crop summary, native PDF export, report-readiness and record screens, public
  location-data snapshot, primary municipal/ecological sources, six rendered PDFs.

## What was already done

The prior audits recovered comprehensive work and clarified three purposes:
assessment/potential, design/implementation and progress/review. They also
distinguished plain wording from report depth and from the app's reading edition.
This continuation uses those distinctions to create six concrete reading outputs.
It does not replace the earlier crop audits or implement a new stage selector.

The earlier completed example was the prepared tour, not the current private
saved site. This continuation recovered the real signed-in site and its survey,
design, crop summary and native saved-facts export. The tour's illustrative
geometry, harvests and finance examples are excluded. Older crop benchmarks
remain historical proposals, not achieved harvests.

## Dated report set — read before the next iteration

The complete private set is local at:

`/Users/roryclark/Documents/ImbewuField App/Reports/2026-10-03/Ubhejane Creche/`

Start with `README.md` or `index.html` there. The six PDFs are:

| Purpose | Simple edition | Comprehensive edition |
| --- | --- | --- |
| Site assessment and potential | `01-Ubhejane-Site-Assessment-Simple-2026-10-03.pdf` — 3 pages | `02-Ubhejane-Site-Assessment-Comprehensive-2026-10-03.pdf` — 10 pages |
| Design and implementation | `03-Ubhejane-Design-and-Implementation-Simple-2026-10-03.pdf` — 3 pages | `04-Ubhejane-Design-and-Implementation-Comprehensive-2026-10-03.pdf` — 12 pages |
| Progress and review | `05-Ubhejane-Progress-and-Review-Simple-2026-10-03.pdf` — 2 pages | `06-Ubhejane-Progress-and-Review-Comprehensive-2026-10-03.pdf` — 7 pages |

All six use plain English. The assessment covers people/place, climate and
seasons, soils/terrain, water, natural systems, bioresource information, crop/tree
and animal potential, local economy and the field checks still needed. The
design preserves the current saved map, crop-summary rows and BOQ, with phase
dependencies and maintenance. The review is an honest evidence baseline: it
does not manufacture a project period, completion percentage, harvests or spending.

The local `site-evidence.json` is the common evidence record. `report-content.json`
contains editable page content; `editable-sources/` provides Markdown reading
copies. `sources/` preserves the native PDF, current map and provider snapshots.
`author_reports.py` reconstructs authored content and `build_reports.py` renders
it. Edit the authoring source when continuing so regeneration retains changes.
`manifest.json` identifies the outputs, and `qa/` holds every rendered page.
Keep the preceding edition when preparing a new dated report set.

Personal site details, precise location, private finance/production records,
source snapshots, map and report PDFs remain outside Git. This shared record is
the discovery and continuity pointer. A cloud agent without the local folder
must request the set rather than inventing its contents.

## Findings and disposition

| ID | Current disposition | Evidence and next action |
| --- | --- | --- |
| SS-001–SS-007 | Previous disposition retained | Reading a signed-in site and exporting its saved facts does not re-test the open draft-recovery/visual changes, paid generation, language or offline behaviour. |
| SS-008 | Prepared-sample coverage gap remains | These reports use current private records. Producing them does not change sample Generate or establish that its selected depth/sections are honoured. |
| SS-009 | Six concrete staged outputs produced; app-stage improvement still proposed | The local set explicitly identifies assessment, design and review, each with a short/full edition. No new stage selector, in-app report history or generation flow was implemented. |
| SS-010 | Evidence improved for these outputs; generator gap remains | Current primary municipal context is dated and bounded. Administrative geocoding is explicitly provisional; nearby municipal material is not assigned to the parcel. No unsupported buyer demand, eligibility or income is asserted. The narrative route still needs structured dated economic evidence. |

Additional evidence limits to carry forward:

- Survey statements, drawing statuses and physical completion are different
  evidence. A reported current activity conflicts with proposed item statuses;
  reconcile on site rather than deriving a completion percentage.
- Account examples and unassigned account totals cannot establish site-linked
  outcomes. The next review needs a reporting period, physical inventory and
  dated work, harvest, destination, cost and sales records.
- Fresh ecology data fell back to an estimated biome with no vegetation detail.
  The official point lookup was unavailable. The BRU response's approximate
  matched name is not a verified unit name or livestock carrying capacity.
- Model climate/soil/terrain values are not field/laboratory measurements. Climate
  and BRU temperature indicators differ. Preserve source/definition labels;
  do not convert them into a frost guarantee or engineering levels.
- The native PDF's UTC date differs from the local preparation date. Both dates
  are explained in the source record; new reports use Europe/Vienna consistently.

## Verification

- Six PDFs / 37 pages rendered and inspected; exact saved plan downloaded and
  inspected before use. Layout and content checks are recorded in local `qa/`.
- Typecheck: `npx tsc --noEmit` clean on bundled Node 24.19.0.
- Full suite: `npm test` exit 0; 4,484 tests, 4,483 pass, zero failures,
  zero skipped and one existing shape-sync TODO (about 90 seconds).
- Whitespace: `git diff --check` clean. No test assertions changed.
- No paid report-generation or image-render call was used to author the reports.
- No app code, saved geometry, plant inventory, lessons or `PLAN_VERSION` changed.
  The new local reports change the picture only by presenting the existing map
  and current evidence in a new dated report layout.
- No new site visit, actual installation check, laboratory result, current quote,
  verified buyer interview, isiZulu review or in-app save of the six reports is claimed.

## Next continuation

1. Read the six local reports and their evidence record before another audit;
   retain the crop follow-up's existing provenance and area-counting rules.
2. Obtain field evidence and dated site-linked outcomes to replace marked unknowns,
   reconcile existing/proposed statuses and choose an affordable first phase.
3. If implementing report stages/history, extend the existing saved-facts/report
   document authorities. Preserve simple wording for comprehensive depth and
   show source snapshot, purpose, edition and generation/preparation date.
4. Verify deployed survey fixes separately from report authorship. Do not close
   SS-008–SS-010 merely because this local six-report set exists.

The work remains on `codex/site-survey-visual-review-20261002`, in the stack above
the open draft-recovery branch (PR #883); PR #885 carries the visual/report audit
continuations. Final branch/SHA/check results are posted on issue #35.
