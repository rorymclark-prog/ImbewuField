# Proposed field-period monthly temperature comparison — 14 November 2026

- Auditor: Codex implementation owner; prior independent Codex source/architecture assessment. Not Claude/AGY.
- Starting revision: `37972be8ec793c4b26386d75dff50d0a79c697d2`, tree `81f1bf029e5e7baac26780f8cb770a9c8b6570a6`, PR #1377.
- Branch: `codex/field-period-temperature-20261114`, stacked on #1377.
- Previous audits: [Entry-month comparison](../2026-11-13/provisional-temperature-comparison-codex.md), [Report pagination](provisional-print-pagination-codex.md). Their source/reuse/transfer/local-validation and release limits remain open as applicable.
- Scope: opt-in repeated monthly comparison, origin3 compatibility, automatic-plan review, shared live/saved/print evidence. This changes the picture. Existing data, geometry, species, lessons and PLAN_VERSION remain unchanged.
- Hosted successor interaction: not inspected at implementation handoff. Static original outputs and mounted component checks are separate evidence.

## Findings and disposition

| ID | User-visible gap or defect | Disposition |
| --- | --- | --- |
| FIELD-PERIOD-01 | Entry-month comparison omits later historical monthly values during the grower’s proposed field period | Explicit period choice repeats the admitted comparison per touched year-month, preserving unknown rows and exact overlaps. No aggregate season classification or calendar. |
| FIELD-PERIOD-02 | Changing the old assessment could invalidate historical saved origins | Distinct input/result discriminator, fingerprint tag and saved origin3. Origin1/2 and absent-extension paths remain exact; strict pairing rejects malformed/downgraded records. |
| FIELD-PERIOD-03 | Actual automatic search skipped an exact reviewed mid-month date after holding the first day of that month | Reproduced with actual generated proposal and retained negative control. Origin3 search can consider the grower’s existing reviewed date, then fully reassesses it. No new unreviewed dates or climate-derived calendar. |
| FIELD-PERIOD-04 | Period/occupancy round trips could revive prior consent/actions; two origin2-only consumers could skip origin3 checks | Explicit nested override/reset and mode consent retirement; origin3 enters preflight and complete climate/period equality checks. Pending save/download tests cover both round trips. |
| FIELD-PERIOD-05 | Unbounded preview intervals or duplicate climate copies could overwhelm output/persistence | Precomputed 128-row software output ceiling, explicit unavailable result without truncation; separate entry comparison retained. One serialized source copy. Existing persistence limits unchanged. |
| FIELD-PERIOD-06 | Successor CI/external/local approval | Open. No production merge/release or agricultural accuracy claim. |

## Source and application convention

Ethiopia Ministry of Agriculture, *SSIGL 8: Irrigation Agronomy and Agricultural Development Plan*, November 2018, §4.4.2, printed19–20 / PDF41–42:

https://www.moa.gov.et/wp-content/uploads/2024/11/201811_SSIGL-8-Irrigation-Agronomy-and-Agricultural-Development-Plan-compressed-1.pdf

Original SHA256 `483a3443d6c63c1ba137f790890ea058337699574fa87141c8219c3db5f312f0`, accessed13 November2026. The original expressly compares long-term monthly means with the reported tomato optimum18–25°C. General irrigated field-cropping methodology only; no duration, cultivar or stage-specific threshold. Document copyright remains MOA2018; document licence not established. Reused narrow independently worded fact/method admission, attribution and source link; no new document reproduction permission. The immutable earlier criterion is unchanged.

Repeating that one-month operation across the grower’s own field interval is an application inference, not an explicit source instruction or whole-season approval. Use only an independently ready clear date from existing occupancy arithmetic: `[entry, clear)` in UTC. A clear date on the first day excludes that month. Partial overlaps still receive whole-month historical means, not daily weather. Repeated calendar months reuse the same climatology, not independent yearly predictions. Inclusive endpoints and unrounded Celsius values retain the existing convention; they are not exact physiological failure thresholds.

The qualified NASA POWER T2M receipt retains period, point, metric, missingness, raw-response checksum, API/dataset/time standard, receipt date, attribution and reuse limits. No legacy display substitute, new provider call, forecast, frost safety, field duration, yield, water demand or allowed-month inference. Country remains grower-declared. Climate evidence alone does not establish current/local farming suitability.

## Saved and action boundaries

Old temperature v1 requests and origin2, and absent-temperature origin1, retain their exact request shape/algorithm/fingerprint. New request temperatureComparison v2 explicitly selects proposed-field-period and saves origin3/provisional-crop-v3. Planning profile.version1/2 remains the separate positive-window contract. Existing cycle context v2 retains policy/cache binding; full period start/end/overlaps/input provenance participate in review equality. Same-month temperature equality cannot approve a different date.

Malformed version/mode/criterion/extra data are unsavable. Valid missing occupancy or source remains unavailable while other independent values survive. Exact source/actor/site/country/generation/raw-climate guards remain. Occupancy clear/reset and mode A→B→A retire consent and awaited actions. The older guarded reader/writer holds the raw new-origin book and refuses a lossy write; this is a finite exact-baseline probe, not an all-client/sync claim.

## Verification

- Ordered final typecheck: clean.
- Affected contracts: 799 checks across58 existing files, zero failures; includes actual mounted save/readback, nested clear/reset and pending save/download round trips, strict origin pairing, large valid retained response, UTC boundaries, missing/zero values and actual automatic-plan regression.
- Six actual historical origins replay with exact original fingerprints. Six actual parent-Git printable originals are byte-identical after the extension.
- Five actual generated originals: public Nairobi/London climatologies with explicitly synthetic date/area/duration, deliberate withheld June control, year rollover and a canonical accepted cycle using separate synthetic own count/yield/harvest/window inputs. All25 printed pages inspected in montage and full-size result/source boundaries. All HTML paragraphs/cells survive actual PDF extraction. Sparse legitimate final tails remain.
- Actual origin3 save/reload, original adopted record and report evidence agree; old guarded writer retains raw bytes unchanged. Initial automatic-search failure retained privately as a counterexample.
- Whitespace and actual pending-note gate required at finished candidate. Full exact-successor CI, independent affected-delta review and hosted/browser/physical output remain separate; parent checks do not approve the successor.

## Next continuation

Review the exact successor source, original files and compatibility probes; resolve related findings, push the finished branch once and inspect its own full CI/rules/render/preview. Keep original P01–P24 active and applicable same-final-candidate external outcomes separate. No AI agreement or engineering pass rate is agricultural validation. AGY consumer orchestration remains disabled; no review relabelled as Claude or AGY.
