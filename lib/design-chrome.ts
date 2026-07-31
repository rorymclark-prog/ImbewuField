// HOW MUCH CHROME THE DESIGN STUDIO SHOWS — the ladder behind the drag handles.
//
// Rory: "i want a little handle thingy on the lower tool bar to be able to close it even further
// if i want and on the top we should actually be able to close both fully so just the map shows
// and many adjustments inbetween".
//
// Pure and DOM-free on purpose: the interaction is fiddly (tap wraps, drag is direction-only,
// bounds must never strand a farmer with no tools) and all of that is checkable without React.
//
// A DRAG DRAGS. The first cut made a drag worth exactly one stop, on the theory that metering by
// distance asks a thumb to judge bands it cannot see. In the hand that read as broken: the owner
// pulled the handle down, one band went, the rest stayed, and the verdict was "i want to be able
// to collapse everything further and then completely… isnt it more intuitive to have a handle bar
// to just drag things closed". It is. The edge now FOLLOWS THE FINGER — see followStop, which
// compares how much chrome is actually on screen against how much the finger has asked for — so
// one long pull closes the lot. A tap still advances one stop and wraps, for the farmer who would
// rather poke than drag.

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

/**
 * How far a measurement may sit from the finger's request before the ladder moves. Wide enough
 * that a hand resting on the handle does not flap between two stops, narrow enough that the edge
 * still feels attached to the finger.
 */
export const FOLLOW_SLACK_PX = 14;

/**
 * THE DRAG, METERED AGAINST REALITY. `chromePx` is how much chrome is on screen between the
 * handle and its edge right now; `targetPx` is how much the finger has asked for (where it
 * started, minus how far it has pulled). One step per call — the caller re-measures and calls
 * again on the next frame, which is what makes a long pull walk all the way down instead of
 * guessing a distance-per-stop constant that would be wrong for every band.
 *
 * Measuring instead of guessing is the whole point: the bands are wildly different heights (a
 * photo-alignment strip is 40px, the element catalog is 200+), so any fixed px-per-stop would
 * either overshoot on one or stall on the other.
 */
export function followStop<T extends string>(
  current: T,
  chromePx: number,
  targetPx: number,
  stops: readonly T[],
  slack: number = FOLLOW_SLACK_PX,
): T {
  if (!Number.isFinite(chromePx) || !Number.isFinite(targetPx)) return current;
  if (chromePx > targetPx + slack) return moreClosed(current, stops);
  if (chromePx < targetPx - slack) return moreOpen(current, stops);
  return current;
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

/**
 * WHAT EACH STOP SHOWS. One table, not guards scattered through the render.
 *
 * THE ORDER WAS WRONG THE FIRST TIME. It shed the photo-alignment strip first, on the reasoning
 * that alignment is one-time setup. It is not one-time — it is the job in hand for as long as it
 * takes, and shedding it first meant the one band the owner was using vanished while the element
 * catalog he was not using stayed ("its annoying that i cant work with the map adjustment tools
 * without the huge tool section underneath"). Advice and shortcuts go first now, then the step
 * guide and the catalog; the alignment strip and the tool row survive to the last rung, because
 * those are the two things you actually operate the map with.
 */
export interface BottomVisibility {
  /** Nudge/rotate/size/see-through/reset — the photo alignment cluster. */
  droneTools: boolean;
  /** Satellite | My photo and Adjust photo: how you get BACK to alignment once it is folded. */
  droneEntry: boolean;
  /** "Just want beds & trees?" and other shortcut rows. */
  shortcuts: boolean;
  /** Lima's advice card. */
  advisor: boolean;
  /** The step/status bar. */
  stepBar: boolean;
  /** The palette body: element chips, zone chips, bed block, etc. */
  body: boolean;
  /** Select / Undo / Delete / Layers — never hidden except at `hidden`. */
  tools: boolean;
}

export function bottomVisibility(stop: BottomStop): BottomVisibility {
  switch (stop) {
    case 'full':
      return { droneTools: true, droneEntry: true, shortcuts: true, advisor: true, stepBar: true, body: true, tools: true };
    case 'compact':
      // Advice and the skip-ahead offer are the first things you stop reading; nothing you
      // operate goes yet.
      return { droneTools: true, droneEntry: true, shortcuts: false, advisor: false, stepBar: true, body: true, tools: true };
    case 'bar':
      // Map + the photo strip + the tool row. This is the working rung: everything that is
      // instruction or catalog is gone, everything you press is still there.
      return { droneTools: true, droneEntry: true, shortcuts: false, advisor: false, stepBar: false, body: false, tools: true };
    case 'hidden':
    default:
      return { droneTools: false, droneEntry: false, shortcuts: false, advisor: false, stepBar: false, body: false, tools: false };
  }
}

export interface TopVisibility {
  /** The full header: title, Learn, Print, build, save state. */
  header: boolean;
  /** The step wizard block. */
  wizard: boolean;
  /** The slim one-line step nav. */
  stepNav: boolean;
}

export function topVisibility(stop: TopStop): TopVisibility {
  switch (stop) {
    case 'full':
      return { header: true, wizard: true, stepNav: true };
    case 'slim':
      return { header: true, wizard: false, stepNav: true };
    case 'hidden':
    default:
      return { header: false, wizard: false, stepNav: false };
  }
}

/** How many bands a stop is currently hiding — shown beside the ticks so "where did it go" has an
 *  answer on screen rather than requiring the farmer to remember. */
export function hiddenCount(v: BottomVisibility | TopVisibility): number {
  return Object.values(v).filter((shown) => shown === false).length;
}

// ── CLOSING ONE SECTION ───────────────────────────────────────────────────────────────────────
//
// The ladder is a coarse control: it sheds bands in a fixed order, which is right when you just
// want room and wrong when you want ONE thing gone ("and also the option to collapse specific
// sections"). So every band that occupies a strip of the bottom stack also carries an ×, and a ×
// puts that band — and only that band — in this set.
//
// This DOES persist, unlike the ladder's `hidden` rung. The reasoning differs: a hidden rung
// leaves a screen with no controls and no memory of why, which reads as a broken app, whereas a
// dismissed section is a deliberate, named choice and the count chip beside the handle always says
// how many are folded and offers them back. A preference that announces itself is safe to keep.

export const DISMISSIBLE_BANDS = ['droneTools', 'shortcuts', 'stepGuide'] as const;
export type DismissibleBand = (typeof DISMISSIBLE_BANDS)[number];

export const DISMISSED_KEY = 'imbewu_design_sections_hidden_v1';

/** Whatever came back from storage, reduced to bands that still exist. */
export function restoreDismissed(raw: unknown): DismissibleBand[] {
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const known = new Set<string>(DISMISSIBLE_BANDS);
  return parsed.filter((b): b is DismissibleBand => typeof b === 'string' && known.has(b));
}
