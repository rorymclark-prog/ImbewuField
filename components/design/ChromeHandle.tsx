'use client';

import { useRef } from 'react';
import { DRAG_THRESHOLD_PX, nextStop, stopFromDrag, stopIndex } from '@/lib/design-chrome';

/**
 * The grab handle on an edge of the Design Studio: a pill, a tick per stop, and a count of what
 * is currently folded away.
 *
 * TAP IS PRIMARY, DRAG IS AN ACCELERATOR. A tap always advances one stop and wraps at the end, so
 * one thumb on one control can reach every state and come back — there is no dead end and no
 * second control to hunt for. A drag only contributes a DIRECTION: metering by distance asks a
 * thumb to judge bands it cannot see, in sunlight, and one over-long shove would slam straight to
 * fully hidden.
 *
 * The ticks are the whole instruction manual, and they cost nothing to translate into the app's
 * eleven languages. The active one is drawn LARGER and DARKER rather than merely tinted, because
 * a colour-only difference is the first thing to disappear in direct sun.
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
  /** Top edge: dragging DOWN opens. Both handles read as "drag the edge, not the panel". */
  invert?: boolean;
  label: string;
}) {
  const dragRef = useRef<{ y: number; id: number } | null>(null);
  const index = stopIndex(stop, stops);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={stops.length - 1}
      onPointerDown={(e) => {
        dragRef.current = { y: e.clientY, id: e.pointerId };
        try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      }}
      onPointerUp={(e) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (!d || d.id !== e.pointerId) return;
        const next = stopFromDrag(stop, e.clientY - d.y, stops, invert);
        onChange(next === 'tap' ? nextStop(stop, stops) : next);
      }}
      onPointerCancel={() => { dragRef.current = null; }}
      onKeyDown={(e) => {
        // Keyboard gets the two directions explicitly rather than the wrapping tap, because a
        // wrap is a surprise when you cannot see the ticks move under your thumb.
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(nextStop(stop, stops)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); onChange(stopFromDrag(stop, invert ? DRAG_THRESHOLD_PX : -DRAG_THRESHOLD_PX, stops, invert) as T); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); onChange(stopFromDrag(stop, invert ? -DRAG_THRESHOLD_PX : DRAG_THRESHOLD_PX, stops, invert) as T); }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        // 44 is the touch-target floor this app holds itself to; the old 28px handle was under it.
        minHeight: 44,
        flexShrink: 0,
        touchAction: 'none',
        userSelect: 'none',
        cursor: 'grab',
      }}
    >
      {/* JUST A HANDLE. It carried a tick per stop and a "3 hidden" count, and the verdict on
          seeing it was "i dont understand this" — then, plainly: "cant we just have a handle its
          more intuitive". A grabber pill is one of the few affordances that needs no explanation
          in any of eleven languages: it says "drag me" by shape alone. The stops still exist
          underneath; the farmer just does not have to read a diagram to use them. */}
      <span
        aria-hidden
        style={{
          width: 44,
          height: 5,
          borderRadius: 3,
          // Solid enough to read as a grip rather than a divider line, on paper and over imagery.
          background: 'rgba(11,18,11,0.34)',
        }}
      />
    </div>
  );
}
