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

/** Keep the farmer's chosen AI style while the component temporarily switches to exact mode. */
export function lockedPolishStyle<T extends string>(
  selectedStyle: T | null | undefined,
  fallbackStyle: T,
): T {
  return selectedStyle ?? fallbackStyle;
}
