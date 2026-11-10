# Crop planning checklist

This is the shared acceptance checklist for crop-planning work in ImbewuField.
Read it before changing crop data, climate classification, planning calculations,
saved-plan behaviour or their displays. Use it with the latest dated crop audit
in [the audit index](README.md#crop-and-production-planning-start-here).
Verification and merge authority remains [AGENTS.md §1](../../AGENTS.md);
this checklist does not replace its required checks.

A green software suite does not establish that farming advice fits a real site.
Keep software correctness, source alignment, independent regional evidence and
local farming validation separate in every release summary.

## Before changing anything

- [ ] Record the exact starting commit, previous audit and carried-forward finding IDs.
- [ ] Reproduce the reported problem with the app's actual functions or user flow.
- [ ] Record inputs, expected outcome, observed outcome and the evidence supporting the expectation.
- [ ] Assign one owner for shared crop, climate and persistence files before parallel work.
- [ ] Keep unresolved findings visible. An unknown or unperformed check is not a pass.

## Sources and farming values

- [ ] Trace each changed month, duration, spacing, yield or threshold to its source,
      with URL, title, relevant page/table, region, units and retrieval date.
- [ ] Preserve a permitted source extract or checksum and the exact transcription
      used. An inaccessible primary document remains unverified; label a secondary
      source or earlier transcription explicitly.
- [ ] Separate quoted values from derived rules and named exceptions. Do not turn
      an illustrative range or borrowed crop's value into a verified local rule.
- [ ] Check every changed calendar column, not only the warm/light-frost column.
- [ ] Compare the same crop, planting method and regional scope. Keep missing
      evidence missing; do not fill an unsupported calendar by guessing.

## Site to calendar to sowing month

- [ ] Run fixed real-site regression cases spanning the climates the feature claims
      to support. For South Africa include hot frost-free summer-rainfall sites,
      light-frost coast, hard-frost interior, winter-rainfall Western Cape, arid
      areas and locations near classification boundaries.
- [ ] Check missing climate, provider provenance, missing-value sentinels, valid
      negative/zero values, threshold boundaries and disagreement between datasets.
- [ ] Distinguish rainfall season from frost/calendar selection, including downstream
      water calculations. Check observed frost answers and explicit calendar choices.
- [ ] Retain the original before/after matrix and named residual failures. Explain
      regional regressions rather than hiding them in an improved overall average.
- [ ] Hold independent validation cases apart from cases used to design a rule.
      Once a case informs a fix it is regression evidence, not a fresh holdout.
- [ ] Do not call agreement with a guide an accuracy percentage. A source used to
      populate a calendar cannot independently validate that same calendar.
- [ ] Treat gridded weather as estimates, not station or on-farm measurements.
      Record geographic/period limits and unresolved local agronomy questions.
- [ ] For countries without supported local calendars, verify the existing
      unsupported/manual behaviour. South African results do not validate global advice.

## Calculations and grower decisions

- [ ] Independently recompute representative area, yield, units and weekly-target
      examples; retain the arithmetic and catalogue/source version.
- [ ] Keep earliest/likely harvest, conservative bed release and buyer-window
      matching distinct. Check nursery time, planting method and year rollover.
- [ ] Check bed occupancy, rotations, crop whitelist and missing yield/spacing
      evidence through the complete generated plan, not just isolated helpers.
- [ ] A regression test must fail for the reproduced bad behaviour. If an expected
      result changes, record the source or product decision behind that change.

## Saved plans and what the grower receives

- [ ] Test fresh and existing saved plans, explicit override and automatic choice,
      reload/sync and clearing an override where the changed feature supports them.
- [ ] Do not silently rewrite an existing planting plan. Check which affected
      sowings are identified and what the grower can review or change.
- [ ] Check that the planner, calendar, Atlas and printed/PDF output agree on the
      changed calendar, dates, units and qualifications. Mark untouched or untested
      surfaces explicitly; a screenshot of one surface does not validate the others.
- [ ] Inspect affected phone/desktop and light/dark flows. Keep actual output
      evidence separate from source-code assertions.
- [ ] Record language review and genuine account/device checks separately from
      synthetic or unsigned-preview checks.

## Record results and decide release readiness

Use a new dated record under `docs/audits/YYYY-MM-DD/`, following
[TEMPLATE.md](TEMPLATE.md). Link it from that date's index and the crop section of
[README.md](README.md), and put the branch, exact commit and result in issue #35.

For each case retain: case ID; related finding ID; commit; inputs/fixture identity;
expected outcome and its source; actual outcome; evidence path; reviewer; and one
of **passed**, **failed**, **unverified** or **not applicable with reason**.
For each finding retain severity, owner and the evidence needed to close it.
A code fix awaiting its checks is not a verified closure.

Existing source and real-site tests should be extended rather than duplicated.
Keep executable cases and fixtures under the repository's existing `tests/`
conventions; source dossiers belong in `research/crop-sources/`. New CI wiring
belongs to its existing owner and needs the verification required by AGENTS.md.
This document itself adds no executable check and provides no new evidence of
farming accuracy.

Release summaries must list required current-head CI results, source-backed
changes, remaining failures, unverified surfaces and unsupported regions. Resolve
a known related failure before release as required by AGENTS.md. Record remaining
source/local-validation limits explicitly; do not substitute an overall overlap
score or a large test count for a release decision.

## Starting evidence and known limits

The [August truth audit](../CROP-PLAN-TRUTH-AUDIT-2026-08-06.md) records the earlier
source, arithmetic and packing checks. PR
[#1328](https://github.com/rorymclark-prog/ImbewuField/pull/1328) adds the November
real-location audit and proposed fixes. Its dated records and tests are branch
work until their merge is verified; consult the current PR before treating them
as production.

At the initial checklist review, the primary KZN table could not be re-read,
regional guide overlap was not field validation, local agronomy remained open,
and the new farming-data head still needed its own release checks. Carry those
limits forward until evidence closes them. Do not overwrite the historical
records when their status changes.
