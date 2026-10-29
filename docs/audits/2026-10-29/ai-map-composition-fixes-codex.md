# Paid AI map composition corrections — 29 October 2026

- Auditor: Codex, implementing Rory’s request to correct, merge and deploy the audited map.
- Reviewed base: production `9e11f2396dadc84c2a8fb07bb89162007ba9e245`; implementation branch `codex/ai-map-composition-fixes`.
- Deployment: pending both required CI jobs, merge and the production deployment; this record does not claim release completion. The completion ledger on issue #35 records the eventual release revision and verification.
- Previous audit: [28 October paid composition audit, unchanged historical record](https://github.com/rorymclark-prog/ImbewuField/blob/88adb66a7199040ba527c94cfee9df3f69aaf5ac/docs/audits/2026-10-28/ai-map-composition-codex.md), PR #1142. Finding IDs are carried forward below.
- Scope: active paid design-layer queue finishers, both engines; effective recovery masks, roof appearance ownership, independent boundary drawing, export provenance and Whole label controls. Existing Site, Sector, Phasing and model-authored Satellite Overlay have separate composition contracts and are not newly certified here.
- Evidence: actual original paid Whole artwork reassembled locally with the production finisher and detached frozen scene; regional synthetic probes executed against extracted production helpers; source review and focused checks. No new provider generation.

## What was already done

The registration correction, white paper, fine legend frame, catalogue artwork loading and original saved paid maps from PRs #1139/#1140 are retained. This work changes presentation assembly, not the source image, the stored model output or the farmer’s saved geometry. The original paid-job mask remains stored unchanged. Its effective restoration mask is rebuilt locally from that job’s frozen scene; a stored mask with a genuinely incompatible aspect still fails validation.

## Findings and disposition

| ID | Problem | Status and evidence |
| --- | --- | --- |
| AI-MAP-001 | Whole restored photographic effort-zone strips through illustrated ground. | **Implemented; locally visually verified.** Painted Whole does not restore effort-zone outline bands. Dedicated Zones retains them and its exact zone overlay. Regional probe exercises the actual `buildProtectMask`, not just its policy flags. |
| AI-MAP-002 | Property-line restoration cut tree crowns. | **Implemented; locally visually verified with limits.** Painted masks allow planned growing-circle footprints beyond the property line. The finisher selects foliage within those windows, including a soft fringe for fine detail, instead of retaining circular soil tiles. Distant exterior remains factual. This colour-based foreground selection is a presentation heuristic: it is not species recognition, and unusual non-green foliage or a model crown outside its saved footprint is not guaranteed complete. Saved centres, dimensions, boundary and crop registration are untouched. |
| AI-MAP-003 | An additional grey corrugated roof covered each AI-painted roof. | **Implemented; locally visually verified.** Painted material has one owner: the model artwork. The deterministic second roof/driveway material overlay is omitted for painted ground. Photo and paper retain their own structure passes. The preserved model roof still requires comparison with the authoritative saved footprint; retaining its appearance does not certify its shape. |
| AI-MAP-004 | Locked Hybrid did not independently draw the surveyed boundary. | **Implemented; locally visually verified.** A shared boundary pass draws the saved line separately from land clipping, with planned foreground foliage in front of it. Hybrid and Full Treatment use this same pass. Ground outside the planned canopy windows remains restored rather than granting all neighbouring land to the model. |
| AI-MAP-005 | Standalone AI downloads claimed exact counts and no unsaved features. | **Implemented.** Both paid design-layer stages carry an explicit AI review notice in their exported legend/footer. It also survives custom Water notes and includes imagery credit when applicable. The generic illustrated footer no longer claims model-drawn elements are exact. Legitimate deterministic exact exports retain their provenance. |
| AI-MAP-006 | Whole offered plant-label modes its grouped renderer ignores. | **Implemented.** Individual Codes/Beside/On plant controls appear only on an individually named sheet. Whole explains its grouped legend and directs the farmer to Planting for individual names or codes. Catalogue names and species are unchanged. |
| AI-MAP-007 | Registered source photo has visible inset seams in surrounding context. | **Open.** These transitions exist in the frozen source itself. They remain visible near the top/bottom of this recovered sheet. This release does not claim to repair source registration or invent neighbouring imagery to conceal them. A separate presentation treatment needs its own visual acceptance check. |
| AI-MAP-008 | Existing checks accepted strips, clipped crowns and false export claims. | **Improved; broader provider coverage remains limited.** Six additional regional/policy/recovery/roof/provenance tests execute actual extracted production helpers or actual pixel-selection code. They distinguish editable zone ground from protected exterior, leaf foreground from soil, and rebuilt masks from old persisted masks. Both engine labels exercise the engine-independent frozen-scene finisher; no new Gemini provider image was purchased. Original paid whole-map image was also reassembled in a fresh local process, with catalogue artwork loaded from existing assets. |

## Verification

- Typecheck: `npx tsc --noEmit` passed before the full suite.
- Focused suite: **170 pass / 0 fail** across image producer, chrome after AI, locked flow, paid-render gate and legend agreement. Includes six new composition regressions.
- Full suite: running at branch preparation. The required `test` and `rules` CI jobs must both pass on the finished head before merge; final results are recorded on issue #35.
- Whitespace: `git diff --check` clean at branch preparation.
- Output inspected: original paid raw Whole art, original photo and prior restoration evidence; complete rebuilt Whole sheet with continuous interior, no second grey roof, boundary line, canopy foreground, white paper, catalogue legend and AI review footer. Frozen scene remained byte-identical before/after actual composition.
- Exact/different contracts: synthetic probes check Photo Plan and paper protection remains enabled and their structure passes remain used. These are not fresh provider-generated visual verifications for those styles. The six design-layer mask checks are not six independently generated AI sheets.
- Local render limits: native canvas uses Arial and rounds unsupported intermediate font weights; preview/live browser inspection is still required for the actual web fonts and UI. No physical-phone test or new paid call.
- **This changes the picture.** `PLAN_VERSION` and the paid recipe token remain unchanged so existing paid output can be recovered. No saved geometry, catalogue species, source registration, worker credentials or security rules changed.

Two existing source-location assertions were updated because policy authority moved into `lib/render-policy.ts` and both paid stages now share a boundary helper. Their original contracts remain asserted, with functional background-policy coverage added; no failed assertion or test was deleted.

## Next continuation

1. Read the current-head CI results, merge only after both required jobs pass, then verify the production build identifier.
2. Reconnect the existing completed job without a provider request; inspect the actual saved result after a page reload and leave the corrected map available to Rory. Keep earlier gallery entries and raw outputs.
3. Resolve AI-MAP-007 separately. Retain honest review status for model-drawn feature counts, positions and roof silhouettes; these have not been independently verified merely by assembling the sheet.
