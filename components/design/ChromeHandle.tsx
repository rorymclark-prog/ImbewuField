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
  hidden,
  label,
}: {
  stop: T;
  stops: readonly T[];
  onChange: (next: T) => void;
  /** Top edge: dragging DOWN opens. Both handles read as "drag the edge, not the panel". */
  invert?: boolean;
  /** How many bands are folded away right now — shown so "where did it go" has an on-screen answer. */
  hidden: number;
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
      <span aria-hidden style={{ width: 36, height: 5, borderRadius: 3, background: 'rgba(11,18,11,0.3)' }} />
      <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {stops.map((s, i) => (
          <span
            key={s}
            style={{
              width: i === index ? 7 : 5,
              height: i === index ? 7 : 5,
              borderRadius: '50%',
              background: i === index ? 'rgba(11,18,11,0.68)' : 'rgba(11,18,11,0.22)',
            }}
          />
        ))}
      </span>
      {hidden > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(11,18,11,0.5)' }}>
          {hidden} hidden
        </span>
      )}
    </div>
  );
}
