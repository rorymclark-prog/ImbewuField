# White Water sheets, retained AI roofs and reachable styling — 31 October 2026

- Auditor: Codex, following Rory's missing-step-4 and poor Water-image screenshots.
- Reviewed base: deployed 0d99bebf2ff3f78573cb3a47ac95ff3fa895bd47; branch codex/paper-map-finish.
- Deployment inspected: production base above; final release evidence on PR / issue #35.
- Previous: [Style picker](../2026-10-30/oblique-style-picker-codex.md), [roof recovery](../2026-10-30/aerial-roof-detail-codex.md).
- Scope: UI presentation and saved paid-art finishing; no provider, worker, access/spend controls, schema or measured geometry changes.
- Evidence: actual latest owned Ubhejane plain-paper Water job, its raw/input/mask and frozen scene; actual compositor before/after at original scale 3; executable affected tests. No new AI generation.

## What was already done

Oblique and its nine styles are live. The previous fix exposed styles on Oblique but deliberately kept them hidden in exact top-down mode. Rory's screenshot demonstrates why that remaining condition is wrong: AI engine controls are visible at step 5 while the styling entry at step 4 is unreachable. Selection must be available before changing finish mode; selection does not start generation.

## Findings and disposition

| ID | Problem | Disposition / evidence |
| --- | --- | --- |
| AI-MAP-020 | Missing step 4 in exact top-down Water. | Implemented: approved users with a selected sheet can choose styles in either mode/view. Simple, AI-off and no-sheet gates retained. Top-down Base/Sector style restrictions now depend on the selected sheet, not the previous render mode. The earlier assertion expecting hidden exact styles was explicitly superseded by this user-visible requirement; denial/no-purchase coverage remains. |
| AI-MAP-022 | Plain-paper Water has a grey exterior and muted artwork. | Implemented and locally visually verified: the photographic Reference Blueprint Water focus/palette treatment was applied even with no photo. It now requires a photographic frame. Recovered paper is white and the model's property colour is retained. |
| AI-MAP-023 | Satellite roof patches cover already completed AI roofs. | Implemented and locally visually verified: factual roof recovery is limited to old strict-paper prompts whose original model left a blank roof. New painted jobs keep their completed roof art and no longer fetch/credit an unused satellite roof. Legacy seven-section roof recovery remains covered. |
| AI-MAP-019 | Existing canopy clipping. | Open; this release does not claim complete foreground segmentation. |

## Verification

- Actual saved Water raw art inspected: white exterior, detailed roofs and brighter garden. Actual deployed finisher reproduced grey/muted output with satellite roof patches. Corrected finisher inspected at scale 3: white exterior, intact AI roofs, original labels/legend and scene unchanged. Private originals and recovered PNG remain outside Git.
- Tests execute the real finisher and assert photographic treatment/focus only for photo frames, no source-roof credit for new painted jobs, retained old-paper recovery, reachable exact Water styles, denied AI-off/no-sheet controls and no paid request on selection.
- Typecheck, render/UI/security-control tests, whitespace/notes and current-head release checks recorded in PR / issue #35 before merge. No full-suite pass claimed.
- No new provider image, geometry mutation or physical-device certification. Native compositor uses fallback fonts. Four notice translations are unreviewed drafts.
- **This changes the picture.** PLAN_VERSION v93 and recipe r8 are unchanged, preserving free recovery of this existing paid job.

## Next continuation

Merge after focused-render, rules and preview succeed. Verify production SHA. Use the existing Water map's Reassemble artwork at original High/scale-3 print quality, keeping the old copy. Continue canopy clipping separately.
