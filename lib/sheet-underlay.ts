/**
 * Which picture a plan sheet is drawn on.
 *
 * Rory: "I want the option when rendering the map to have the drone image as underlay or satellite."
 *
 * Both images already exist and are already aligned. When a farmer brings their own aerial, the
 * Studio swaps it INTO `frame.satDataUrl` — the single field every sheet, composite and export
 * reads — and keeps the true satellite tile beside it in `underlayDataUrl` so the two can be lined
 * up. So this is not a new pipeline: it is which of two images that one field carries.
 *
 * Neither is correct in general, which is why it is a control and not a constant. A drone photo is
 * sharper and current, and it is the farmer's own view of their own land. The satellite is what the
 * neighbours, the roads and the surrounding country are on — the context a funder, an extension
 * officer or anyone who has not stood on the site needs in order to place it.
 *
 * These two functions are here rather than inline in DesignGlossy because they are a rule, and a
 * rule that lives in a component cannot be tested without a canvas. The pairing matters: swapping
 * the image without changing the cache key re-serves the picture you just switched away from, and
 * they are easy to change independently by accident.
 */

import type { CanvasFrame } from '@/lib/design-canvas';

export type SheetUnderlay = 'photo' | 'satellite';

/**
 * True only where there is genuinely a choice to offer.
 *
 * `underlayDataUrl` is populated ONLY while a custom base is in use, so its presence is exactly the
 * condition "this farmer supplied their own aerial, and we still hold the satellite". On every
 * other site the control would be a switch with one position, which is worse than no switch.
 */
export function canChooseUnderlay(frame: Pick<CanvasFrame, 'satDataUrl' | 'underlayDataUrl'>): boolean {
  return Boolean(frame.underlayDataUrl) && Boolean(frame.satDataUrl);
}

/**
 * The frame a sheet should be rendered from.
 *
 * Returns the SAME OBJECT for the default so that referential equality holds and nothing downstream
 * re-renders or re-fetches merely because this function was called. Falls back to the frame
 * unchanged when the satellite is asked for but absent — a missing base must never become a blank
 * sheet, and there is no second image to fall back to in that case.
 */
export function frameForUnderlay(frame: CanvasFrame, choice: SheetUnderlay): CanvasFrame {
  if (choice !== 'satellite' || !frame.underlayDataUrl) return frame;
  return { ...frame, satDataUrl: frame.underlayDataUrl };
}

/**
 * What to append to a sheet's cache key.
 *
 * The same sheet on two different underlays is two different pictures, so the underlay is part of a
 * sheet's identity. Empty on the default deliberately: every sheet already sitting in a farmer's
 * gallery stays addressable under the key it was stored with, so this change cannot orphan work
 * they have already paid for.
 */
export function underlayCacheSuffix(choice: SheetUnderlay): string {
  return choice === 'satellite' ? ':satellite' : '';
}
