'use client';

import { useEffect, useRef } from 'react';
import { DRAG_THRESHOLD_PX, followStop, nextStop, stopFromDrag } from '@/lib/design-chrome';

/**
 * The grab handle on an edge of the Design Studio.
 *
 * TWO THINGS WENT WRONG IN THE FIRST TWO CUTS, and this is the fix for both.
 *
 * 1. IT WAS A BAND, NOT AN EDGE. A 44px-tall full-width row with a small pill in the middle reads
 *    as an empty box, not a grip — "there is still a big gap now where the minimise tool is". It
 *    is now a 20px strip. The touch target is restored by an invisible expander that reaches 8px
 *    past the strip in each direction (36px total): short of the app's 44px floor, deliberately,
 *    because reaching 44 here means stealing a thumb's worth of the controls immediately above and
 *    below, and this control forgives a miss — the whole ladder wraps, so a mis-tap costs one more
 *    tap and never strands anyone.
 *
 * 2. A DRAG WAS WORTH ONE STOP. Pull it down, one band goes, everything else stays — which is why
 *    the ladder looked like it could not close any further. The edge now follows the finger: at
 *    pointerdown we record how much chrome stands between this handle and its screen edge, and on
 *    every frame we shed or restore a band until the measurement matches where the finger has
 *    dragged to. One long pull closes the lot; a short pull moves one band; a tap still advances
 *    one stop and wraps, for anyone who would rather poke than drag.
 */
export default function ChromeHandle<T extends string>({
  stop,
  stops,
  onChange,
  invert = false,
  label,
}: {
  stop: T;
  stops: readonly T[];
  onChange: (next: T) => void;
  /** Top edge: dragging UP closes. Both handles read as "drag the edge, not the panel". */
  invert?: boolean;
  label: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ y: number; id: number; chrome0: number } | null>(null);
  const targetRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // The follow loop runs on animation frames, so it must read the CURRENT stop and callback, not
  // the ones captured when the drag started — otherwise it would keep re-issuing the same step.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
  }, []);

  /**
   * How much chrome currently stands between this handle and its edge of the screen.
   *
   * `isConnected` is load-bearing, not defensive. The last rung swaps this handle for the little
   * restore rail (a different mount), so a drag that crosses that boundary leaves the follow loop
   * measuring a DETACHED node — whose rect is all zeros, which reads as "the chrome fills the
   * whole screen" and sends the ladder oscillating back the way it came. NaN stops the loop
   * cleanly instead: the drag ends one rung past the swap, which is where the farmer's eye is.
   */
  function chromePx(): number {
    const el = elRef.current;
    if (!el || !el.isConnected || typeof window === 'undefined') return NaN;
    const r = el.getBoundingClientRect();
    return invert ? r.bottom : window.innerHeight - r.top;
  }

  /**
   * Walk one band per frame toward whatever the finger last asked for, re-measuring each time.
   * Rescheduling itself (rather than looping) is load-bearing: the next measurement is only true
   * after React has committed the previous band's removal, which happens before the next frame.
   */
  function pump() {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const target = targetRef.current;
      if (target == null) return;
      const current = stopRef.current;
      const next = followStop(current, chromePx(), target, stops);
      if (next === current) return;
      onChangeRef.current(next);
      pump();
    });
  }

  return (
    <div
      ref={elRef}
      className="chrome-handle"
      role="button"
      tabIndex={0}
      aria-label={label}
      title={label}
      onPointerDown={(e) => {
        dragRef.current = { y: e.clientY, id: e.pointerId, chrome0: chromePx() };
        targetRef.current = null;
        try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d || d.id !== e.pointerId) return;
        const dy = e.clientY - d.y;
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        // Top edge: pulling UP (negative dy) asks for less chrome above. Bottom edge: pulling
        // DOWN asks for less chrome below. One expression, both edges.
        targetRef.current = d.chrome0 + (invert ? dy : -dy);
        pump();
      }}
      onPointerUp={(e) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.id !== e.pointerId) return;
        if (Math.abs(e.clientY - d.y) < DRAG_THRESHOLD_PX) {
          // A tap, not a drag. Cancel any pending follow so it cannot undo the tap on the next
          // frame, then advance one stop with a wrap — the reason one control is sufficient.
          targetRef.current = null;
          onChange(nextStop(stop, stops));
          return;
        }
        // Let the follow loop finish settling against the release position; it stops on its own
        // once the measurement matches, or once the ladder runs out of rungs.
        targetRef.current = d.chrome0 + (invert ? e.clientY - d.y : d.y - e.clientY);
        pump();
      }}
      onPointerCancel={() => { dragRef.current = null; targetRef.current = null; }}
      onKeyDown={(e) => {
        // Keyboard gets the two directions explicitly rather than the wrapping tap, because a
        // wrap is a surprise when you cannot see the edge move under your thumb.
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(nextStop(stop, stops)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onChange(stopFromDrag(stop, invert ? DRAG_THRESHOLD_PX : -DRAG_THRESHOLD_PX, stops, invert) as T); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(stopFromDrag(stop, invert ? -DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX, stops, invert) as T); }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        height: 20,
        flexShrink: 0,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'ns-resize',
      }}
    >
      {/* The touch target, which is bigger than the thing you can see. Absolute rather than
          padding so it costs the layout nothing — the strip stays 20px tall. */}
      <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: -8, bottom: -8 }} />
      {/* JUST A HANDLE. It carried a tick per stop and a "3 hidden" count, and the verdict on
          seeing it was "i dont understand this" — then, plainly: "cant we just have a handle its
          more intuitive". A grabber pill is one of the few affordances that needs no explanation
          in any of eleven languages: it says "drag me" by shape alone. */}
      <span
        aria-hidden
        style={{
          width: 56,
          height: 4,
          borderRadius: 999,
          // Solid enough to read as a grip rather than a divider line, on paper and over imagery.
          background: 'rgba(11,18,11,0.32)',
        }}
      />
    </div>
  );
}
