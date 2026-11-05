# Sector rich-aerial release continuation — 2026-11-05

- Auditor: Codex; C selected by the coordinating chat within Rory's existing instruction to research/audit and decide. Rory has not personally selected C; no personal preference is attributed to him.
- Reviewed revision: C implementation `2fbfe97b5` on `codex/sector-illustrated-graphics`, continuation after draft head `8ccd08217a0c744ef008746a1e3e5ad1c10b2d07`, based on main `a43b411ea12111d28352e916357326adcd9cd374`.
- Deployment inspected: production before this release; final release identity, current-head checks and actual owner reassembly/export evidence are recorded on PR #1274 and issue #35.
- Previous audit: [Three researched Sector samples](sector-illustrated-graphics-codex.md). Preserved unchanged as the draft comparison; this record supersedes its statement that branch code represents A.
- Scope: publish C's actual original-artwork colour alongside this branch's richer Sector graphics/labels/contours. Exact Sector, registrations, saved geometry, terrain calculations/qualifications, other layers, paid dispatch/gates, schema and access remain unchanged.
- Evidence: real native app compositor from the frozen owner scene and original paid artwork, original cached Terrain-RGB pixels, executable affected contracts; supported browser owner check follows release gates. No paid generation.

## What was already done

Draft #1274 introduced the illustrated graphics and source-raster supplemental contours but still implemented muted A in app code. C was initially a local visual variant. The coordinator inspected the actual C image and chose it as the implementation direction under the delegated design decision. This continuation makes the actual app output match C before releasing it; publishing A with a C screenshot would not satisfy that decision.

## Findings and disposition

| ID | User-visible problem or gap | Status | Evidence and next action |
| --- | --- | --- | --- |
| AI-MAP-058 | App implementation still uses A although C better retains historical-site colour and detail | Implemented; native verified, release gates pending | Remove the artwork recolouring operation. The source is copied directly at its original registered frame; white label cards/cased contours keep contrast. The real app composer now produces C byte-for-byte. Shared new sun/flame/card/key/wind graphics remain. No model generation or silent extra charge. |
| AI-MAP-059 | Contours are weak and omit available source detail | Retained and native verified | Stronger 5 m main lines and 2.5 m interpolated supplemental isolines from original Terrain-RGB pixels. Same missing-raster fallback and unchanged exact 5 m overview. Original data accuracy/datum remain unverified and not suitable for set-out. |
| AI-MAP-063/064 | Double model annotations and stray rain marks | Retained | Corrected raw-artwork polish handoff and paid-difference gates are untouched; no loose illustrated rain drops or invented photo coverage. |
| AI-MAP-042/026/019/033/051 | Other-map fidelity, canopy, oblique and editable archive labels | Open, carried forward | Stay on Sector before any Zone redesign. No other-map or fresh-provider acceptance claimed. Physical phone/iPad and paper print remain unverified. |

## Actual output and tests

Local review folder: `/Users/roryclark/Documents/Codex/2026-11-05/sector-review/`.

- `sector-C-release-candidate.png`: actual unchanged native compositor from this implementation, 3462 × 2448, SHA-256 `e926ad0def70525899d2912afff9208ff22bad9e87adbfa8f271d1ebee6e5e18`.
- Matches the previously inspected `sector-C-richer-aerial.png` byte-for-byte. C is now real code behaviour, not just the local variant.
- `exact-reference.png`: SHA-256 `775244ed9ad84622ce6a1e17071fb703d7965ab23c19ac0726e85db363dc723d`, byte-identical to the prior exact baseline.
- The native harness asserts the serialized scene remains unchanged. It uses the original cached raster source separately from legacy overview contours.
- The prior tests required deliberate lightening/desaturation; that A-specific claim is now superseded by the documented C decision. Rewritten claims require a direct source copy at unchanged frame/scale, original colour, normal opacity and no filter/recolouring. Existing exact-base, source-image-release, attribution, saved-scene and geometry checks remain. The guard fails on a missing draw, shifted frame, recolour operation, filter or opacity fade; assertions were not removed to conceal a failure.

## Verification

- Typecheck: clean before affected tests.
- Focused-render: 639 passed, 0 failed, two workers.
- Affected Sector/release/label/tour: 34 passed, 0 failed. Final note-stamp checks follow the implementation commit.
- Whitespace: clean. Full suite is separate CI work; no new local full-suite pass is claimed.
- Output inspected: actual native full sheet (3462 × 2448) and previously identical 1123 × 794 C digital A4 preview. Final supported owner browser reassembly/download/save-readback remains a release verification step, not satisfied by this sample.
- This changes the picture. `PLAN_VERSION` stays `v93`; recipe counters are unchanged as required. Existing saved artwork is updated through the free reassembly action, not paid regeneration.

## Next continuation

Finish notes, push the finished C head once and wait for that head's rules, focused-render and successful preview. Merge using the checked head, preserve current-main assistant/update work, deploy through existing hosting, verify exact live build identity, then use the normal owner app to reassemble/download and reopen the saved Sector artwork. Record real CI results and actual browser evidence on #1274/#35. Preserve the historical comparison and never treat the old A preview as C release evidence.
