import { useEffect, type MutableRefObject } from 'react';

import type { StylePreset } from '@/lib/producer-prompt';

// Three output modes, one for every sheet — the farmer's own words: "straight canvas render",
// "hybrid AI polish underlayer + our polished elements overlayed", "full treatment hybrid + 2nd
// step AI polish". 'full' always builds on 'hybrid' — it is never a shortcut back to 'exact'.
export type SheetOutputMode = 'exact' | 'hybrid' | 'full';

/**
 * Full Treatment starts from the completed Hybrid sheet. Its second paid pass must be free to
 * improve the complete artwork and page design. Real production A/Bs showed that copying the
 * Hybrid's satellite exterior, house or driveway back afterwards creates the ragged photographic
 * keyholes the paid pass had already removed. Only the narrow boundary ring remains byte-locked;
 * the saved Hybrid is still the rollback if the polish pass fails its difference gate.
 */
export interface FullTreatmentProtectPolicy {
  protectOutside: boolean;
  protectBoundary: boolean;
  protectDriveway: boolean;
  protectHouse: boolean;
  protectLines: boolean;
  protectItems: boolean;
  protectUnmarkedGround: boolean;
  houseHaloRatio: number;
  houseFeatherRatio: number;
}

export function fullTreatmentProtectPolicy(): FullTreatmentProtectPolicy {
  return {
    protectOutside: false,
    protectBoundary: true,
    protectDriveway: false,
    protectHouse: false,
    protectLines: false,
    protectItems: false,
    protectUnmarkedGround: false,
    houseHaloRatio: 0.003,
    houseFeatherRatio: 0.0012,
  };
}

export type LockedPolishAction =
  | 'wait'
  | 'render-exact'
  | 'switch-to-hybrid'
  | 'render-hybrid'
  | 'switch-to-polish'
  | 'render-polish';

export interface LockedPolishState {
  /** Stable farmer-selected finish. Never derive this from a pending transition flag: those flags
   *  are consumed between stages, while the requested finish must remain `full` through enqueue 2. */
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
    state.outputMode !== 'exact'
    && state.hybridAfterExactPending
    && state.mode === 'exact'
    && state.isExactRender
    && !state.loading
    && state.hasResult
  ) {
    return 'switch-to-hybrid';
  }

  if (
    state.outputMode !== 'exact'
    && state.hybridFlipPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
  ) {
    return 'render-hybrid';
  }

  if (
    state.outputMode === 'full'
    && state.polishAfterHybridPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
    && state.hasResult
  ) {
    return 'switch-to-polish';
  }

  if (
    state.outputMode === 'full'
    && state.polishFlipPending
    && state.mode === 'ai'
    && !state.isExactRender
    && !state.loading
  ) {
    return 'render-polish';
  }

  return 'wait';
}

export type LockedPolishStage = 'exact' | 'hybrid' | 'polish' | null;

/** Queue provenance follows the committed stage, never a style or a transition ref. */
export function lockedPolishResultKind(stage: LockedPolishStage): 'hybrid' | 'ai-polished' {
  return stage === 'polish' ? 'ai-polished' : 'hybrid';
}

export interface LockedPolishHandoffSnapshot extends Omit<LockedPolishState, 'outputMode'> {
  stage: LockedPolishStage;
  hybridHandoffReady: boolean;
}

export interface LockedPolishHandoffControls {
  requestedModeRef: MutableRefObject<SheetOutputMode>;
  polishAfterHybridRef: MutableRefObject<boolean>;
  polishAfterFlipRef: MutableRefObject<boolean>;
  hybridResultRef: MutableRefObject<string | null>;
  setHybridHandoffReady: (ready: boolean) => void;
  setStage: (stage: LockedPolishStage) => void;
  setError: (message: string) => void;
  missingHybridMessage: string;
  setNotice: (message: string) => void;
  startingPolishMessage: string;
  polishingMessage: string;
  clearResult: () => void;
  renderCurrentSheet: () => void | Promise<void>;
}

/**
 * The real React handoff between paid jobs.
 *
 * Keep this as a hook rather than five unrelated ref mutations in a page component: a pending flag
 * is consumed during the first effect, React commits `stage: 'polish'`, and only the next render may
 * dispatch with the polish-stage callback. Tests mount this hook and flush those actual effects.
 */
export function useLockedPolishHandoff(
  snapshot: LockedPolishHandoffSnapshot,
  controls: LockedPolishHandoffControls,
): void {
  const {
    requestedModeRef,
    polishAfterHybridRef,
    polishAfterFlipRef,
    hybridResultRef,
    setHybridHandoffReady,
    setStage,
    setError,
    missingHybridMessage,
    setNotice,
    startingPolishMessage,
    polishingMessage,
    clearResult,
    renderCurrentSheet,
  } = controls;

  useEffect(() => {
    if (snapshot.stage !== 'hybrid') return;
    const action = lockedPolishAction({
      ...snapshot,
      outputMode: requestedModeRef.current,
      hasResult: snapshot.hybridHandoffReady,
    });
    if (action !== 'switch-to-polish') return;
    if (!hybridResultRef.current) {
      polishAfterHybridRef.current = false;
      setHybridHandoffReady(false);
      setStage(null);
      setError(missingHybridMessage);
      return;
    }
    polishAfterHybridRef.current = false;
    polishAfterFlipRef.current = true;
    setHybridHandoffReady(false);
    setStage('polish');
    setNotice(startingPolishMessage);
    clearResult();
  }, [
    snapshot.exactFlipPending,
    snapshot.hybridAfterExactPending,
    snapshot.hybridFlipPending,
    snapshot.polishAfterHybridPending,
    snapshot.polishFlipPending,
    snapshot.mode,
    snapshot.isExactRender,
    snapshot.loading,
    snapshot.hybridHandoffReady,
    snapshot.stage,
    requestedModeRef,
    polishAfterHybridRef,
    polishAfterFlipRef,
    hybridResultRef,
    setHybridHandoffReady,
    setStage,
    setError,
    missingHybridMessage,
    setNotice,
    startingPolishMessage,
    clearResult,
  ]);

  useEffect(() => {
    // The first effect mutates refs before React commits its state update. This stage gate prevents
    // the adjacent effect from invoking a stale Hybrid closure in the same passive-effect flush.
    if (snapshot.stage !== 'polish') return;
    const action = lockedPolishAction({
      ...snapshot,
      outputMode: requestedModeRef.current,
    });
    if (action !== 'render-polish') return;
    polishAfterFlipRef.current = false;
    setNotice(polishingMessage);
    void renderCurrentSheet();
  }, [
    snapshot.exactFlipPending,
    snapshot.hybridAfterExactPending,
    snapshot.hybridFlipPending,
    snapshot.polishAfterHybridPending,
    snapshot.polishFlipPending,
    snapshot.mode,
    snapshot.isExactRender,
    snapshot.loading,
    snapshot.hasResult,
    snapshot.stage,
    requestedModeRef,
    polishAfterFlipRef,
    setNotice,
    polishingMessage,
    renderCurrentSheet,
  ]);
}

/** Keep the farmer's chosen visual style while the flow temporarily switches render modes. */
export function lockedPolishStyle(
  selectedStyle: StylePreset | null | undefined,
  fallbackStyle: StylePreset,
): StylePreset {
  return selectedStyle ?? fallbackStyle;
}
