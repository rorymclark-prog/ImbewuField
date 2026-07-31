// HOW MUCH CHROME THE DESIGN STUDIO SHOWS — the ladder behind the drag handles.
//
// Rory: "i want a little handle thingy on the lower tool bar to be able to close it even further
// if i want and on the top we should actually be able to close both fully so just the map shows
// and many adjustments inbetween".
//
// Pure and DOM-free on purpose: the interaction is fiddly (tap wraps, drag is direction-only,
// bounds must never strand a farmer with no tools) and all of that is checkable without React.
//
// TAP IS PRIMARY, DRAG IS AN ACCELERATOR. A drag needs continuous visual tracking and clean
// capacitive contact — both unreliable for a farmer outdoors in glare with dusty or wet hands —
// and this canvas already owns dragging for drawing and panning. So a tap always advances one
// stop, and a drag only says "more" or "less", never how much.

/** Bottom stack, most open first. */
export const BOTTOM_STOPS = ['full', 'compact', 'bar', 'hidden'] as const;
export type BottomStop = (typeof BOTTOM_STOPS)[number];

/** Top chrome, most open first. */
export const TOP_STOPS = ['full', 'slim', 'hidden'] as const;
export type TopStop = (typeof TOP_STOPS)[number];

/** A drag shorter than this is a tap, not a direction. */
export const DRAG_THRESHOLD_PX = 24;

/**
 * One tap: advance toward MORE CLOSED, wrapping back to fully open at the end.
 *
 * Wrapping is what makes a single control sufficient. Without it the farmer reaches the last stop
 * and the handle goes dead, which reads as broken — and on a phone there is no second control to
 * come back with.
 */
export function nextStop<T extends string>(current: T, stops: readonly T[]): T {
  const i = stops.indexOf(current);
  if (i < 0) return stops[0];
  return stops[(i + 1) % stops.length];
}

/**
 * A drag: one stop in the dragged direction, or 'tap' when it was too short to be a direction.
 *
 * Deliberately NOT metered by distance. Metering asks a thumb to judge three distance bands it
 * cannot see, and a single over-long shove would slam straight to hidden.
 *
 * `invert` is for the top chrome: both handles read as "drag the edge, not the panel", so on the
 * bottom, up = more chrome, while on the top, down = more chrome.
 */
export function stopFromDrag<T extends string>(
  current: T,
  dy: number,
  stops: readonly T[],
  invert = false,
): T | 'tap' {
  if (!Number.isFinite(dy) || Math.abs(dy) < DRAG_THRESHOLD_PX) return 'tap';
  const towardClosed = invert ? dy < 0 : dy > 0;
  return towardClosed ? moreClosed(current, stops) : moreOpen(current, stops);
}

/** One stop more open. Clamps at fully open — a drag must never wrap, only a tap may. */
export function moreOpen<T extends string>(current: T, stops: readonly T[]): T {
  const i = stops.indexOf(current);
  if (i < 0) return stops[0];
  return stops[Math.max(0, i - 1)];
}

/** One stop more closed. Clamps at fully hidden. */
export function moreClosed<T extends string>(current: T, stops: readonly T[]): T {
  const i = stops.indexOf(current);
  if (i < 0) return stops[0];
  return stops[Math.min(stops.length - 1, i + 1)];
}

/** Which tick is lit, for the dots beside the grab pill. */
export function stopIndex<T extends string>(current: T, stops: readonly T[]): number {
  const i = stops.indexOf(current);
  return i < 0 ? 0 : i;
}

/**
 * A stop read back from storage, coerced to something real.
 *
 * `hidden` is deliberately NOT persisted: reopening the Studio to a screen with no visible tools
 * and no visible steps looks like a broken app, and the farmer has no memory of having hidden
 * them. Hiding is a working state for the session you are in, not a preference.
 */
export function restoreStop<T extends string>(value: unknown, stops: readonly T[], fallback: T): T {
  if (typeof value !== 'string') return fallback;
  const found = stops.find((s) => s === value);
  if (!found || found === 'hidden') return fallback;
  return found;
}

export const CHROME_PREF_KEY = 'imbewu_design_chrome_v1';

export interface ChromePref {
  top: TopStop;
  bottom: BottomStop;
}

/** What is safe to write down — see restoreStop for why `hidden` never is. */
export function persistableChrome(pref: ChromePref): ChromePref {
  return {
    top: pref.top === 'hidden' ? 'slim' : pref.top,
    bottom: pref.bottom === 'hidden' ? 'bar' : pref.bottom,
  };
}
