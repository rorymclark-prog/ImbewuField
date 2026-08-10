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

/**
 * THE THIRD OPTION IS NO PHOTOGRAPH AT ALL. Rory: "i think there need to be a third option —
 * satellite, my photo, and white background?", asked in the same breath as "the quality of the
 * image is very poor please ramp up the quality".
 *
 * Those two are the same request. Aerial imagery over rural South Africa is low-resolution at
 * source (see docs and the Esri stitcher work) and no amount of render scale sharpens a picture
 * that was never sharp — but every OTHER mark on a plan sheet is vector, and on a plain ground it
 * is drawn at the sheet's full resolution with nothing soft behind it. So "plain" is not merely a
 * style: it is the only underlay whose crispness we control, and it is the one to print from.
 *
 * It is also what a plan sheet conventionally IS. A published planting or earthworks drawing is
 * ink on paper — the photograph is a survey aid. A farmer handing a plan to a funder, a contractor
 * or an extension officer usually wants the drawing, not the picture of their yard underneath it.
 */
export type SheetUnderlay = 'photo' | 'satellite' | 'plain';

/**
 * True only where there is genuinely a choice BETWEEN THE TWO PHOTOGRAPHS.
 *
 * `underlayDataUrl` is populated ONLY while a custom base is in use, so its presence is exactly the
 * condition "this farmer supplied their own aerial, and we still hold the satellite". Kept as its
 * own question rather than folded into sheetUnderlayOptions: 'plain' needs no imagery whatsoever,
 * so it can never stand in for having a second photograph, and a caller asking "are there two
 * pictures here" must not be answered yes because a paper option exists.
 */
export function canChooseUnderlay(frame: Pick<CanvasFrame, 'satDataUrl' | 'underlayDataUrl'>): boolean {
  return Boolean(frame.underlayDataUrl) && Boolean(frame.satDataUrl);
}

/**
 * Every underlay this frame can actually be drawn on, in the order to offer them.
 *
 * The photo leads because it is the default and the one that shows the farmer their own land.
 * 'plain' is always available — it needs nothing — which is what makes this control worth showing
 * on a site with only one photograph, where the old two-position switch was correctly hidden.
 */
export function sheetUnderlayOptions(
  _frame?: Pick<CanvasFrame, 'satDataUrl' | 'underlayDataUrl'>,
): readonly SheetUnderlay[] {
  return ['photo', 'satellite', 'plain'];
}

/**
 * Whether this frame actually holds a farmer-supplied aerial.
 *
 * `underlayDataUrl` exists ONLY while a custom base occupies `satDataUrl`, so its presence is
 * exactly "this farmer imported their own photo, and we still hold the satellite beside it".
 *
 * The picker shows all three underlays either way. When this is false, the drone-photo pill is an
 * INVITATION — it opens the importer — rather than a selection, because choosing it would quietly
 * render the satellite under a pill that says "Your photo". Rory: "Underlay must have 3 options
 * you now removed drone photo!" — the third option must be visible and reachable on every site,
 * and it must not lie about which picture it is.
 */
export function hasFarmerPhoto(frame: Pick<CanvasFrame, 'underlayDataUrl'>): boolean {
  return Boolean(frame.underlayDataUrl);
}

/**
 * THE GROUND THE AI IS SHOWN WHEN THERE IS NO PHOTOGRAPH — and it must be the white the words
 * promise, because a model believes the picture over the prompt.
 *
 * How this was found: buildLockedIllustrationPrompt gained a 'paper' contract ("every part of the
 * sheet the source leaves blank is drawing paper and must come back the same white") and Rory's
 * very next plain-paper render STILL came back as a khaki field — "What ever you doing it's not
 * working!". The prompt was fine. The INPUT was not: buildComposite's no-photo branch filled the
 * model's source image with #CBB98A, a khaki, before drawing the marks. So every earlier "the AI
 * invented a ground" diagnosis was wrong too — Photo Plan's contract is "keep every pixel of the
 * supplied image", and the model was keeping the khaki we supplied. The locked pipeline then
 * RESTORES unmarked pixels from that same source, so even a model that disobeyed and painted white
 * would have had the khaki put back by our own code.
 *
 * Painted through this one function (and the colour through this one constant, which
 * lib/design-canvas.ts's photo-bake backdrop shares) so the fact can be pixel-tested from node:
 * a rule that lives only inside DesignGlossy.tsx can never be more than source-grepped.
 */
export const PLAIN_PAPER_GROUND = '#FFFFFF';

type GroundPaintContext = Pick<CanvasRenderingContext2D, 'fillStyle' | 'fillRect'>;

export function paintPlainPaperGround(ctx: GroundPaintContext, width: number, height: number): void {
  ctx.fillStyle = PLAIN_PAPER_GROUND;
  ctx.fillRect(0, 0, width, height);
}

/**
 * The frame a sheet should be rendered from.
 *
 * Returns the SAME OBJECT for the default so that referential equality holds and nothing downstream
 * re-renders or re-fetches merely because this function was called. Falls back to the frame
 * unchanged when the satellite is asked for but absent — a missing base must never become a blank
 * sheet, and there is no second image to fall back to in that case.
 *
 * 'plain' drops the base image, which every renderer already handles: drawBlueprintBase falls back
 * to a warm paper ground when satDataUrl is absent, and the structure-lock and AI-composite paths
 * are each guarded on it. It deliberately does NOT clear underlayDataUrl, so switching back to a
 * photograph is a state change in the control and never a lost image.
 */
export function frameForUnderlay(frame: CanvasFrame, choice: SheetUnderlay): CanvasFrame {
  if (choice === 'plain') return frame.satDataUrl === null ? frame : { ...frame, satDataUrl: null };
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
export function underlayCacheSuffix(
  choice: SheetUnderlay,
  frame?: Pick<CanvasFrame, 'underlayDataUrl'>,
): string {
  // On a site with no imported aerial, 'satellite' IS the base picture — the same one the old
  // default rendered under an empty suffix. Keying it ':satellite' there would strand every sheet
  // already in that farmer's gallery behind a key nothing looks up, which reads as paid renders
  // vanishing. Same picture, same key.
  if (choice === 'satellite') return frame && !hasFarmerPhoto(frame) ? '' : ':satellite';
  if (choice === 'plain') return ':plain';
  return '';
}
