# Second AI style: Editorial Atlas — 2026-11-07

- Auditor: Codex, following Rory’s supplied circular Sector reference and request for a second companion style.
- Reviewed revision: production base `4c5d1735a86f9e46ce48d0cfa068c80bc4747371`; branch `codex/editorial-map-style`.
- Deployment inspected: native current-branch outputs; preview/current-head CI and release identity follow on the PR and issue #35.
- Previous audit: [Approved map styling and cross-location checks](../2026-11-06/approved-map-style-runtime-codex.md). AI-MAP-069 and AI-MAP-026/042 remain open for fresh model fidelity.
- Scope: appearance preset, picker, Sector page composition, durable-style propagation and style-specific oblique description. No saved schemas/measurements, model/provider dispatch, permissions, billing or worker changes.
- Evidence: actual native canvas outputs, frozen-scene non-mutation checks and automated render contracts. No fresh paid AI generation or physical-device test.

## What was already done

Reference Blueprint stays the default. Its finer wire, round symbolic posts, native contours and existing page remain unchanged. The additional Editorial Atlas preset appears beside it before older optional packs. Other sheets receive a lighter orthographic illustration brief and keep their existing app-owned layouts; this is the first Sector-specific editorial page, not a claim that every sheet has received a new layout.

The actual user reference is preserved privately as `Rory supplied editorial reference.png` alongside the native comparison gallery, `Documents/ImbewuField App/Map style samples/2026-11-07/Editorial Atlas/`. It is a visual reference, not a scientific data source. No reference-farm heights, gradients, bearings, climate assumptions or design recommendations are copied. The raw private farm image is not committed or sent to a model by this change.

## Findings and disposition

| ID | User-visible issue or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-073 | No selectable clean circular editorial companion to the approved illustrated style | Implemented; native output inspected | New `editorial_atlas` prompt/picker; white page, serif title, coloured wind ring, clear callouts and sun graphics. Current-head release gates follow on PR/#35. |
| AI-MAP-074 | A circular viewport could discard proposed boundary extensions or compress the site | Verified in native checks | Uniform circle fit encloses all saved ring vertices with clearance. Panorama, portrait and outside-frame polygons tested. Saved state serialization unchanged. |
| AI-MAP-075 | Applying a selected style at completion could use the current picker instead of the paid job’s style | Verified | Baseline and final Sector compositions both receive the durable job style. Regression executes the actual finisher callback and checks both completion call sites. |
| AI-MAP-076 | Reduced circular map made boundary and contour labels too small | Corrected and visually inspected | Shared fine-wire painter and DEM captions draw at final page size after fitting, not shrunk with the raster. |
| AI-MAP-069 | A new style brief cannot prove the provider painted the desired material appearance or geometry | Open | Ubhejane native page uses retained AI artwork; other-location pages use actual satellite context, not newly painted Editorial AI. Normal owner paid generation remains to review. |
| AI-MAP-026/042 | Provider-painted excavation, bed and plant geometry | Open, unchanged | Adding this style cannot certify these shapes. |

## Verification

- Typecheck: clean.
- Affected checks: 490 pass, including style routing, oblique descriptions, prompt contracts, solar anchor variation and frozen completion style.
- Broader canonical render plus oblique/typography/release checks: 687 pass. Updated source-bound release descriptions and map guide use the existing four-language draft mechanism. Unreviewed exact pairs are retained in `editorial-release-drafts.json`.
- Whitespace: clean.
- Native outputs inspected: Ubhejane with retained AI artwork and real saved proposed polygon; Cape Town, Pretoria and Hoedspruit over actual licensed satellite and regional DEM contours. Other-location polygons explicitly say TEST EXTENT, not customer boundaries. File provenance is beside the private gallery.
- The solar curve is explicitly schematic between existing computed sunrise, noon and sunset anchors. No intermediate hours are invented. Polar/missing paths are unavailable. Regional weather comes from the existing gated model; unsupported places get no borrowed KZN arrows. Terrain detail remains on Terrain & Sections; no new farming calculations/advice.
- This changes the picture for the selected second style. PLAN_VERSION v93 and render recipe remain untouched. No permanent server, browser or watcher is needed for native rendering.

### Known baseline full-suite failure

Production-base run [42294630673](https://github.com/rorymclark-prog/ImbewuField/actions/runs/42294630673) finished with 19 failures, all update-notice/guide contracts; the shape-sync assertion is an existing TODO. Eighteen notice/guide failures are resolved by current visible map guide stops and missing exact-source release description drafts, with no assertion removal. One remains: `tests/feature-update-preview.test.ts:32`, historical assistant-animation replay expects one image but gets zero because reopening the guide uses the current catalog. The same 0 versus 1 failure is present at base SHA `4c5d173` before this style existed. No assistant preview component/logic or test is edited by this branch. Record this baseline and the focused release results explicitly rather than representing the full suite as green.

## Next continuation

Run the current-head rules/focused-render and preview gates and record exact evidence before merging. Inspect a normal new paid Editorial Atlas Sector job on the owner’s site before calling its model-drawn material appearance approved. Build other sheet-specific editorial compositions gradually from the same factual authorities, preserving both style choices.
