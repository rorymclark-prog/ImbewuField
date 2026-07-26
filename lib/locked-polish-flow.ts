import { isModelChromeStyle, type StylePreset } from '@/lib/producer-prompt';

// Three output modes, one for every sheet — the farmer's own words: "straight canvas render",
// "hybrid AI polish underlayer + our polished elements overlayed", "full treatment hybrid + 2nd
// step AI polish". 'full' always builds on 'hybrid' — it is never a shortcut back to 'exact'.
export type SheetOutputMode = 'exact' | 'hybrid' | 'full';

export type LockedPolishAction =
  | 'wait'
  | 'render-exact'
  | 'switch-to-hybrid'
  | 'render-hybrid'
  | 'switch-to-polish'
  | 'render-polish';

export interface LockedPolishState {
  outputMode: SheetOutputMode;
  exactFlipPending: boolean;
  hybridAfterExactPending: boolean;
  hybridFlipPending: boolean;
  polishAfterHybridPending: boolean;
  polishFlipPending: boolean;
  mode: 'ai' | 'exact';
  isExactRender: boolean;
  loading: boolean;
  hasResult: boolean;
}

/**
 * Keeps every paid render behind a completed prior stage without relying on cancellable timers.
 * The caller consumes only the returned action, then React state changes unlock the next action.
 *
 * Sequence per mode:
 *   exact  → render-exact, done.
 *   hybrid → render-exact, switch-to-hybrid, render-hybrid, done.
 *   full   → render-exact, switch-to-hybrid, render-hybrid, switch-to-polish, render-polish, done.
 * 'full' never skips 'hybrid' — that skip is the exact bug this replaces (Water's paid result
 * used to polish the bare exact sheet directly, so there was nothing painted to actually polish).
 */
export function lockedPolishAction(state: LockedPolishState): LockedPolishAction {
  if (
    state.exactFlipPending
    && state.mode === 'exact'
    && state.isExactRender
    && !state.loading
  ) {
    return 'render-exact';
  }

  if (
    state.hybridAfterExactPending
    && state.mode === 'exact'
    && state.isExactRender
    && !state.loading
    && state.hasResult
  ) {
    return 'switch-to-hybrid';
  }

  if (
    state.hybridFlipPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
  ) {
    return 'render-hybrid';
  }

  if (
    state.polishAfterHybridPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
    && state.hasResult
  ) {
    return 'switch-to-polish';
  }

  if (
    state.polishFlipPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
  ) {
    return 'render-polish';
  }

  return 'wait';
}

/**
 * Keep the farmer's chosen AI style while the guided flow temporarily switches to exact mode —
 * EXCEPT model-chrome styles (Satellite Overlay). The 3-button flow promises "AI underlayer +
 * your exact elements on top", which requires app authority (geometryLock:true). A model-chrome
 * style enqueues showcase:true/geometryLock:false instead, so the completion handler never
 * stashes the hybrid image and Full Treatment dies at switch-to-polish AFTER the paid hybrid
 * render was already consumed (hit live 2026-07-26). Site/Sector/Phasing already sanitise this
 * in applySheet; this function is the ONE authority for the guided layer-sheet flow.
 */
export function lockedPolishStyle(
  selectedStyle: StylePreset | null | undefined,
  fallbackStyle: StylePreset,
): StylePreset {
  if (!selectedStyle) return fallbackStyle;
  return isModelChromeStyle(selectedStyle) ? fallbackStyle : selectedStyle;
}
