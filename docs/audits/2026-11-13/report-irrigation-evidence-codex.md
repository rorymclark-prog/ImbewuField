# Report irrigation evidence — 13 November 2026

- Owner: Codex, `codex/report-irrigation-evidence-20261113`.
- Base: `3b47ecdc304718c7e3d862b50882e09286dd35bf`, draft PR1354.
- Previous: [Report water and climate corrections](../2026-11-12/report-water-climate-corrections-codex.md), [annual rainfall evidence](../2026-11-12/global-report-integration-codex.md) and [report source history](provisional-report-history-codex.md).
- Scope: generated report prompt and its actual-route regression. No farming value, species, geometry, persistence, auth, metering, provider or workflow change.

## Findings

| ID | Reproduced problem | Correction / disposition |
| --- | --- | --- |
| CSR-15A-F02 | The early water-storage paragraph still asked whether capacity was enough, contradicting later instructions that the storage gap was not calculated. | Capacity remains approximate and distinct from available supply. Adequacy and additional capacity remain unknown without supported quantities, timing and losses. Independent delta review and exact-head CI remain required. |
| REPORT-IRRIGATION-01 | The irrigation section supplied an unsourced universal daily watering depth and resulting daily litres despite missing crop demand. | Remove that recommendation; preserve the dimensional conversion only. Require supplied crop/stage/period evidence and explicit unknown demand/total/coverage cells. |
| REPORT-IRRIGATION-02 | The irrigation instruction scaled to the entire boundary even when a much smaller growing area was supplied. | Use the existing table's drawn growing areas for supported crop demand; no property-area substitution. |
| REPORT-IRRIGATION-REVIEW-01 | Independent Codex inspection of the complete prompts found a competing instruction to scale every recommendation to the boundary. | Actual successor-route regression reproduces that retained direction. The boundary paragraph now applies only to boundary-scale calculations, preserving independent growing and roof/catchment areas. Bounded correction review pending. |

The existing title and table structure remain compatible with report localization.
Method options require their evidence needs; the prompt no longer asserts a cheapest
effective option without local cost/performance evidence. No replacement daily
watering depth or crop coefficient was invented.

The first frozen-delta review closed the early storage and universal-depth issues
but kept the area-authority finding open. Its disposition and original six request
payloads are preserved. The corrected boundary directive was reproduced separately
before changing it; new final outputs are retained alongside those original files.

## Verification and actual output

The existing actual POST test has a mocked model/auth boundary and makes no paid
provider call. Its final fixture supplies a synthetic 10,000 m² boundary, one
20 m² bed, 10 kL drawn capacity and a stated 2,500 L tank. These are test inputs,
not crop recommendations or evidence of a real site.

Against the exact base route, the strengthened regression fails on all four
actual prompt fragments: adequacy request, fixed daily depth, its daily-litre
example and the whole-property scaling instruction. Eleven other cases pass;
the one failure is the intended assertion, not a module/import error. Restoring
the corrected route byte-for-byte makes all twelve cases pass.

Typecheck passes. The affected report group passes 178/178, with zero failures,
cancellations, skips or todos. Existing country-policy, report section, water
scope, localization, document/PDF and original water/climate assertions remain.
Each annual-rainfall request is now inspected independently rather than accumulating
previous prompts. Null, zero, fractional and positive annual totals cannot supply
missing demand or monthly seasons.

Six complete request payloads were captured from the actual mocked route, with
only an observer on the test's existing capture array. Their early storage and
irrigation sections were read directly. Recorded bed sizes/capacities, unit
conversion and unknown-demand instructions remain; the four erroneous instructions
are absent. No generated model prose, paid report, rendered account session or
physical print is claimed. The deterministic report/PDF renderer is unchanged;
its separately inspected source-history outputs remain under their own receipt.

Final notes/type-floor, whitespace, exact committed blob binding, independent
bounded review and required current-head full/rules/render/preview results belong
to the PR/issue35 ledger. An ancestor CI pass does not approve this successor.
The parent preview is accessible, but its signed-out sample report entry still
needs protected location data; it did not verify the live report viewer.

## Limits and next action

This removes contradictory directions; it cannot guarantee that a future model
response follows them. Agricultural accuracy, unsupported regional evidence and
local water-budget validation remain separate. The AGY and Claude-through-AGY
service/policy hold is unchanged; no alternate account, authentication route or
provider was tried. Keep the complete global milestone and its unresolved gates
open. Push the finished branch once after its bounded review and local checks,
then wait for its own required CI before release.
