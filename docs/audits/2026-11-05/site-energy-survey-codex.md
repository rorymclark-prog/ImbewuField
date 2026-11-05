# Site survey elevation and energy — 5 November 2026

- Auditor: Codex site-energy child, coordinated by Rory's voice chat and international owner.
- Reviewed base: `06315a74ae03d6cb771c659776e09ce47f1d4a2b`, branch `codex/site-energy-survey`; implementation accompanies this record.
- Deployment inspected: none for this candidate; existing hosting retained.
- Previous audit: [Survey recovery](../2026-10-22/survey-draft-recovery-codex.md), carrying SS-002/SS-004 language and physical-device limits.
- Scope: optional site-survey evidence, read-only public solar lookup, review and report context. No map renderer, geometry, nursery, species, lessons, rules or workflow changes.
- Evidence: source review, synthetic response/React interaction tests, current component HTML in Chrome at desktop and 390 px width.

## What was already done

The assessment already provides elevation, indicative slope and aspect. The model
uses OpenTopoData SRTM30m samples; its sampling metadata distinguishes a successful
sample, including a real zero, from older fallback zeros. No new terrain lookup or
contour interpolation is added. Terrain-map placement belongs to the map owner.
The existing account/site survey save, cloud sync and recoverable draft authority
is retained; energy is not saved in a separate store.

## Findings and disposition

| ID | User-visible problem or coverage gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| SE-001 | Survey had no elevation reference or separately sourced benchmark | Implemented; integrated preview pending | Land & Location shows the proven model reference and optional benchmark/source/datum/date. Missing source metadata stays unknown. Zero and negative benchmarks are covered. |
| SE-002 | No actual solar-resource workflow | Implemented; deployment gate pending | Explicit authenticated Fetch calls the fixed PVGIS5.3 public service server-side. Validates site, units, complete months, annual consistency, source period and fixed 1 kWp assumptions. Unsupported results never produce substitute estimates. |
| SE-003 | Sector winds could be mistaken for turbine energy potential | Implemented evidence workflow; automatic atlas import not implemented | Resources & Inputs records manually selected GWA point or local measurement, height, mean speed, period, source, exposure and obstacles. No turbine-kWh calculation. |
| SE-004 | Late lookup could be inserted into another account/site | Covered by synthetic interaction/route tests | Verified actor response plus active account/site draft scope, token captured for actor, abort on unmount/site change; no shared response cache. |
| SE-005 | Removing solar during pending Refresh could re-add it on completion | Corrected after independent Codex source review | Removal aborts/invalidates the pending request; interaction test resolves the old reply after removal and checks no second write. |
| SE-006 | Invalid manual numeric entries could be silently lost on save/recovery | Corrected after independent Codex source review | Raw elevation/wind strings persist in optional draft inputs; field errors and the actual survey save gate require correction. Zero and unknown remain distinct. |
| SE-007 | New release tour was filtered out and displaced the two-stop guide | Corrected in actual release note | Query-string href was unsupported by the existing guide validator; both visible stops now use the real farmer route and name the correct survey sections. Existing guide/community assertions retained. |
| SE-008 | Acknowledgment/history test assumed the rolling latest release must still contain the old assistant animation | Test fixture corrected; original assertions retained | The test seeds an assistant offer but its History event reloads current release notes. It now explicitly supplies that same release fixture; unrelated future releases remain free to replace it. No app behavior or assertion was weakened. |
| SS-002 | New consequential wording lacks fluent review | Open | New controls explicitly use English; no claim of reviewed localisation. Coordinator arranges source-paired drafts. |
| SS-004 | Physical phone/Safari and complete authenticated in-app journey | Open | Chrome390px component rendering is not a physical-device or full application test. |

## Provider decision and reproducible constraints

PVGIS5.3 remains the documented production API; PVGIS6 is offered for testing.
The [JRC API manual](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en)
documents server-side GET access and disallows AJAX, so the browser uses an authenticated
same-origin route. The [usage conditions](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/general-information/usage-conditions-data-protection_en)
permit use of the information without restrictions. Version/source metadata is retained;
coverage is established by a validated provider result, not a universal availability claim.
An actual public probe used the manual's generic45N,8E example only, not a private site.

The [Global Wind Atlas GIS/API page](https://globalwindatlas.info/en/download/gis-files)
offers file-download URLs, including selected-area GIS downloads in its desktop interface;
it does not document a JSON point-response contract. No private frontend backend,
scraping, bulk country raster download or undocumented API was used.
[GWA terms](https://globalwindatlas.info/en/about/TermsOfUse) specify CC BY4.0 attribution
and restrict automated access to the application. The supported first workflow is
therefore an explicit provider visit plus source/height/period transcription, clearly
labelled in the UI. A future automatic import needs a supported bounded GIS sampling
contract and a separately verified implementation. This is an implementation limit,
not a claim that wind-resource automation is impossible.

The solar reference assumes1kWp c-Si, free-standing,14% system losses and PVGIS-optimised
tilt/orientation, with the terrain horizon. It is not installed capacity, a roof survey,
a quotation, battery sizing or promised actual output. Nearby shade remains separate.
Wind means are not converted to turbine yield; hub height, distribution, power curve,
local measurements and siting evidence remain necessary.

## Verification

- Node24.22.2 typecheck: pass.
- First frozen candidate `a7991dc57`:96/96 focused checks passed. Its full suite later
  exposed SE-007 and the SE-008 fixture coupling; it is not a passing release.
  Its local run ended during an interrupted turn without a suite footer and no
  surviving test PIDs; classify it as interrupted, not a completed full pass.
  The frozen checkout and original log are preserved.
- Repair candidate:149/149 affected checks passed, including pending-removal and raw
  input recovery interactions, plus the existing update-guide/community contracts.
- Full suite/current-head CI/rules/preview: pending; **not merge-ready or live**.
- Whitespace: pass before freeze.
- Output inspected: synthetic current-component preview in Chrome desktop and390px,
  with no horizontal overflow at390px. Controls/chart/source text visually inspected.
  These captures use fixture numbers and an isolated HTML harness, not a full Next/Firebase session.
  Repair error states (preserved11000m benchmark /101m/s wind) were also inspected
  in Chrome; invalid wind no longer claims it is recorded.
- External calls: one generic public PVGIS documentation example; no private coordinates,
  production records, paid AI/provider calls, keys or secrets.
- Temporary Python preview process PID88053, port3217, command
  `python3 -m http.server 3217 --bind 127.0.0.1 --directory output/site-energy-survey`,
  owned by this child, verified and stopped after inspection. Own Chrome tab closed and viewport reset.
- Repair preview: own temporary PythonPID15438/port3217 in the corrections checkout
  was verified and stopped; own Chrome tab closed.
- Independent review attribution: `/root/claude_patch_review` supplied a **Codex
  source-only** review of `a7991dc57`, not a Claude-provider calculation or provider
  review call. Receipt SHA256 `b471c11505c5d1be8280ec69e296e907b788884c61793b514d84084ffbf7a928`.
  Both SE-005/SE-006 were accepted and repaired. Root Codex independently inspected
  the actual6ca528779 repair delta and relevant scope/recovery/save callbacks:
  SE-005 and SE-006 are addressed in source and synthetic tests. This is a second
  source-only disposition, not a Claude call, full suite or customer-flow certification.

This changes the picture: survey elevation/energy cards, monthly solar bars and
review rows. `PLAN_VERSION` is unchanged.

## Next continuation

Freeze/review the candidate, complete full checks and configured preview, then exercise
the actual survey save/reopen/report flow in an isolated test context. Attach the actual
screenshots when handing off (local artifacts are under `output/site-energy-survey/`).
Do not merge while the required full gates are pending. Keep SE-003 automatic import,
SS-002 fluent review and SS-004 physical-device limits visible.
