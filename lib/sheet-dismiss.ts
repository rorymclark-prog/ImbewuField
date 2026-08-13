'use client';

// DRAG THE GRABBER DOWN AND THE SHEET CLOSES.
//
// Rory, 13 August: "I want to be able to drag any of those top closing buttons in the modals and
// it closes."
//
// Every bottom sheet in the app already draws the little horizontal bar at its top — the
// `u-sheet-grabber` in globals.css. On a phone that bar means one thing, and every farmer who has
// used a phone knows it: pull me down. Ours was `aria-hidden` decoration. Some sheets closed if
// you TAPPED it; none closed if you dragged, which is the gesture the bar is actually promising.
//
// Two ways to dismiss, both of which a farmer will try:
//   · a short drag past the threshold — deliberate, distance-based
//   · a quick flick — velocity-based, so a fast small flick still counts
// Anything less springs back, so a mis-touch while scrolling does not lose their place.
//
// UPWARD DRAG IS CLAMPED, not followed. A sheet that lifts off the bottom edge shows a gap of
// background beneath it and reads as broken.

import { useCallback, useRef, useState } from 'react';

/** Drag distance, in px, that dismisses on release. About a thumb-joint. */
export const DISMISS_DISTANCE_PX = 88;
/** Or this fast downward, in px per ms — a flick, however short. */
export const DISMISS_VELOCITY = 0.5;

export interface SheetDismiss {
  /** Spread onto the grabber. Pointer events, so one path covers touch, pen and mouse. */
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
  };
  /** px to translate the sheet down by while dragging. 0 when idle. */
  dragY: number;
  /** True mid-drag — use it to drop the sheet's transition so it tracks the finger. */
  dragging: boolean;
}

/**
 * @param onClose called once, when the drag has earned a dismissal.
 * @param enabled when false the handlers no-op — a closed sheet must not capture the pointer.
 */
export function useSheetDismiss(onClose: () => void, enabled = true): SheetDismiss {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!enabled) return;
    start.current = { y: e.clientY, t: e.timeStamp };
    setDragging(true);
    // Capture, so a finger that slides off the 36px bar keeps dragging the sheet rather than
    // dropping it half-open.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
  }, [enabled]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!start.current) return;
    setDragY(Math.max(0, e.clientY - start.current.y));
  }, []);

  const finish = useCallback((e: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const from = start.current;
    start.current = null;
    setDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* not fatal */ }
    if (!from || cancelled) { setDragY(0); return; }

    const travelled = e.clientY - from.y;
    const elapsed = Math.max(1, e.timeStamp - from.t);
    const flicked = travelled > 0 && travelled / elapsed > DISMISS_VELOCITY;

    if (travelled > DISMISS_DISTANCE_PX || flicked) {
      onClose();
      // Reset AFTER closing so a sheet reopened later does not start life shoved down the screen.
      setDragY(0);
      return;
    }
    // A tap — no movement at all — still closes. That is what the grabber did before this hook
    // existed on the sheets that had it wired, and taking it away would be a regression dressed
    // up as a feature.
    if (Math.abs(travelled) < 4) { onClose(); return; }
    setDragY(0);
  }, [onClose]);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e) => finish(e, false),
      onPointerCancel: (e) => finish(e, true),
    },
    dragY,
    dragging,
  };
}
