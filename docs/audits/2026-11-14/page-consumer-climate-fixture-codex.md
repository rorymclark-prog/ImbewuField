# Buyer-page climate revision fixture — 14 November 2026

- Auditor: Codex implementation owner; independent correction review remains separate.
- Starting revision: `ecd4442599deffb5f32b6c721aa586315de09907`, tree `f220bdddac394cff8f3fe7f29efe8d92095e2961`, PR #1378.
- Branch: `codex/page-consumer-climate-fixture-20261114`, stacked on #1378.
- Previous audit: [Proposed field-period comparison](field-period-temperature-codex.md). Retain its source, applicability, external-review and release limits.
- Scope: the existing AST-extracted buyer-page consumer fixture. No application, provider, farming value, saved data, geometry, species, lesson or PLAN_VERSION change. This does not change the picture.

## Finding and disposition

| ID | Observed gap | Correction and scope |
| --- | --- | --- |
| PAGE-CONSUMER-CLIMATE-REVISION-01 | Current-head PR full test job `132279281804` finished with 11,192 passes and eight failures out of 11,200 tests. All eight fail before buyer-editor assertions because extracted route JSX references `provisionalClimateRevision`, absent from the fixture's lexical environment. | Local unmodified reproduction gives the same eight failures. The real page already declares the state and callback. Supply an explicit nonzero revision and functional setter in the fixture, preserving all existing buyer/editor assertions. Add a test that executes the actual route's callback and re-extracts its next revision without plan writes. |

The fixture still evaluates actual page JSX/prop expressions; boundary components remain markers, not mounted editors or live account authority. It does not replace the separate mounted preview or real hosted evidence. The change repairs missing test context, rather than weakening a failing product assertion.

## Verification

- Typecheck: passes before baseline reproduction and after correction.
- Unmodified baseline: eight failures in the consumer file, matching terminal PR CI.
- Affected set: **137 passes, zero failures**, six existing files, concurrency two: buyer exact-window page consumer, buyer exact-date-window arithmetic/UI, provisional preview UI, grower workflow UI and monthly-temperature UI.
- Negative controls: a private in-memory inert climate callback and an omitted live revision each fail only the new regression. No application source was mutated.
- Whitespace and actual pending release-note gate: checked before commit. No new farmer-facing note is warranted for tests/documentation only.
- Full suite: parent PR job failed as described; the same parent's separate push job was still running at discovery and is not restarted. Successor full CI remains required; 137 affected passes are not a full-suite pass.
- Output: inspected the actual CI failure footer/stack and original/corrected consumer results. Existing application/report/calendar/browser observations remain scoped to their unchanged application source. No new visual or agronomic validation claimed.
- Private raw logs and negative-control artifacts remain outside the repository.

## Next continuation

Push this completed correction once, obtain its bounded independent review and inspect successor CI. Preserve the parent branch and original full-test failure. Same-final Claude/authorised external outcomes remain open under the existing AGY service hold; no retry, account/model/key switch, production merge or release is authorised here.
