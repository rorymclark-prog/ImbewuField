export type LockedPolishAction =
  | 'wait'
  | 'render-exact'
  | 'switch-to-ai'
  | 'render-ai';

export interface LockedPolishState {
  exactFlipPending: boolean;
  polishAfterExactPending: boolean;
  aiFlipPending: boolean;
  mode: 'ai' | 'exact';
  isExactRender: boolean;
  loading: boolean;
  hasResult: boolean;
}

/**
 * Keeps the paid render behind a completed exact render without relying on cancellable timers.
 * The caller consumes only the returned action, then React state changes unlock the next action.
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
    state.polishAfterExactPending
    && state.mode === 'exact'
    && state.isExactRender
    && !state.loading
    && state.hasResult
  ) {
    return 'switch-to-ai';
  }

  if (
    state.aiFlipPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
  ) {
    return 'render-ai';
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
