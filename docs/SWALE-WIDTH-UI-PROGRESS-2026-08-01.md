# Swale width UI progress — 2026-08-01

- Started from the existing worktree without network or Git write commands, per the sandbox constraints.
- Baseline: `npm test 2>&1 | grep "pass"` reported `ℹ pass 1541`.
- Existing unrelated worktree changes were found in `functions/src/index.ts`, `lib/render-jobs.ts`, `.playwright-cli/console-2026-08-01T07-09-34-923Z.log`, and `docs/EXACT-SHEET-SWEEP-2026-08-01.md`; these are being left untouched.
- Browser/visual verification is unavailable in this sandbox and will remain explicitly unverified.
- Added `parseSwaleWidthM` and `MAX_SWALE_WIDTH_M` in `lib/design-canvas.ts`; the persisted-state
  loader now accepts only positive finite swale widths within the typo-safety cap.
- Extended the existing line-label editor in `components/design/DesignCanvas.tsx` with a swale-only
  `Swale width (m)` field. Blank clears the optional field; invalid input leaves the saved value
  unchanged. No renderer/default or saved geometry was changed.
- Added the two pending i18n strings to `lib/i18n.tsx` and focused save/load, clear, and rejection
  coverage to the already-registered `tests/design-canvas-helpers.test.ts`.
- The width cap is `100` metres only as an input typo guard; it is not shown as a recommendation and
  is not used by the renderer as a default.
- Verification: full `npm test` passes 1542/1542; `git diff --check` passes. `npx tsc --noEmit`
  remains non-zero only for existing missing `RenderQuality`, `I18nKey`, `quality`, and
  `setQuality` symbols in the untouched, in-flight `components/design/DesignGlossy.tsx`.
- No browser is available here, so the inline editor layout and live swale appearance were not
  visually verified. No paid AI render was triggered and `PLAN_VERSION` was not touched.
