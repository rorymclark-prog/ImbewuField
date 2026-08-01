# Design Studio polish audit — 2026-08-01

Audit started from `24dc3ed` on the working tree's `main` branch. Remote and Git write checks are intentionally skipped per sandbox instructions.

## Findings

- Baseline: `npm test 2>&1 | grep "pass"` reports 1,514 passing; `npx tsc --noEmit` passes.
- Existing untracked `.playwright-cli/console-2026-08-01T07-09-34-923Z.log` is preserved.
- Visual check blocked: the Playwright package is not cached and both available Chrome executables abort under this sandbox; exact-sheet output remains unverified.
- Finding: `components/design/DesignGlossy.tsx:438` and the picker comment around `11467` still described Earthworks as Water-only/unreachable after Earthworks became a real wizard step. Safe comment-only cleanup.
- Finding: `components/design/DesignGlossy.tsx:585` declared `UNUSED_OVERLAY_PROTECT_MASK_OPTIONS` with no caller. Safe dead-code removal; its rationale remains as a comment.
- Finding: the shared exact legend symbol at `components/design/DesignGlossy.tsx:7835` drew every route as a flat line, while Earthworks swales are drawn as ditch + berm + hachures. Safe Earthworks-only legend treatment, with other route symbols unchanged.
- Finding: `components/design/SpeciesPicker.tsx:60` had an unlabeled 18px close control; `DesignAdvisor.tsx:377` lacked `aria-expanded`; the Design Studio mode toggle lacked `aria-pressed`. Safe accessibility semantics added; compact controls with documented density tradeoffs are reported rather than resized.
- Finding: remaining hand-kept plan-set/filter and line-kind lists are documented for owner review; no merge attempted because their scopes and ordering semantics are not provably identical.
- Finding: `components/design/DesignGlossy.tsx:9797` and `10141` omit Earthworks from both five-sheet AI batch paths, while the exact batch at `9746` is filter-driven and includes it. Reported, not changed: adding sheet 05 changes paid batch behavior and the five-sheet quota contract.
- Safe test cleanup: `tests/sheet-render-route.test.ts` still described eight sheets and omitted Earthworks, so it now covers all nine canonical sheet routes without changing production code.
- Finding/fix: `components/design/DesignCanvas.tsx:4404` had three icon-only zoom controls without accessible names; added `aria-label` values while keeping their existing 40px geometry. The remaining under-44px target-size issue is reported rather than resized because changing this floating control would alter the canvas layout.
- Report-only finding: `components/design/DesignGlossy.tsx:2530` documents that Blueprint sheets intentionally omit a north arrow, while `composeStyleSheet` owns the arrow for the newer styled path. Harmonising this would change the established Blueprint sheets, so it was left alone.
- Report-only finding: `components/design/DesignGlossy.tsx:2559` documents the analysis sheets' lightened/desaturated base treatment versus the design sheets' scrim. This is an intentional presentation distinction, not residue to flatten.
- Report-only finding: `components/design/DesignPalette.tsx:1205`, `1229`, `1289`, `1892` and `components/design/DesignWizard.tsx:167`, `359`, `399`, `419` retain compact 28–36px controls. Their labels/pressed state are present where applicable, but resizing them would change dense palette/wizard geometry; recommend a separately rendered touch-target pass.
- Report-only finding: `components/design/StepGuide.tsx:229`, `components/design/DesignGlossy.tsx:12249`, `12374`, and `components/design/DesignAdvisor.tsx:360` have named overlay controls below 44px. Recommend invisible hit-area wrappers or equivalent spacing in a focused interaction pass; not changed because the overlay layout was not visually verifiable here.
- Report-only finding: the design UI has only a scoped `.chrome-handle:focus-visible` rule in `app/globals.css`; a broader Studio focus treatment is absent. Recommend a rendered, keyboard-focused pass rather than adding an unverified global visual treatment during this cleanup.
- Report-only finding: `components/design/DesignGlossy.tsx:5543` exports `buildBlueprintWholeMap` without a live importer. The dead-code report retains it for owner review; recommend removal only after confirming rollback/visual-comparison policy, so it was not deleted.
