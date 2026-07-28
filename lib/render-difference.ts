// Did the paid render actually change anything?
//
// WHY THIS EXISTS: Rory paid for Full Treatment — a second AI pass over the free Hybrid sheet —
// and got back a picture he could not tell apart from the one he already had. That happened
// repeatedly over two days across six commits, each honestly reported as fixed with a green test
// suite behind it, because NOTHING IN THIS CODEBASE HAS EVER LOOKED AT THE OUTPUT. The render
// path checks that the protected pixels were restored correctly (countProtectedPixelMismatches)
// and that a mask is not degenerate (maskEditableFraction). Neither can notice that the model
// handed back its own input. A pass that returned the input verbatim would clear every check,
// be stored, be labelled "AI polished", and be charged for.
//
// So this measures the one thing that matters to the person paying: is the new image different
// from the old one, in a way a human would see?
//
// PURE MODULE — no canvas, no fetch, no DOM. It takes raw RGBA bytes so it can be tested honestly
// against constructed images rather than mocked around.

export interface DifferenceOptions {
  /**
   * Pixels the app restores byte-for-byte after the model returns — the boundary ring, the
   * driveway, outside the plot, the house halo. Including them would guarantee a large identical
   * region and drag every score toward "unchanged", punishing a pass that did redraw everything
   * it was allowed to touch. Alpha > 0 means protected. Omit to compare the whole frame.
   */
  protectMask?: Uint8ClampedArray;
}

export interface DifferenceReport {
  /** Fraction of comparable pixels that moved at all. Near 0 means a literal copy. */
  touchedFraction: number;
  /**
   * Fraction that moved enough to be seen — a redrawn surface, not a tint. This is the number the
   * verdict is based on.
   */
  redrawnFraction: number;
  /** Mean absolute channel change across comparable pixels, 0..255. A filter shows up here. */
  meanDelta: number;
  /** How many pixels were actually compared, after the protect mask. */
  comparedPixels: number;
  verdict: 'redrawn' | 'filtered-only' | 'unchanged';
}

export type PaidRenderStage = 'hybrid' | 'polish';

export interface PaidRenderDecision {
  keep: boolean;
  message: string | null;
}

/** Below this per-channel delta a pixel is the same pixel — encoder noise, not a decision. */
const TRIVIAL_DELTA = 4;
/** At or above this, a human sees a different surface rather than a shifted tone. */
const VISIBLE_DELTA = 32;
/** A genuine second pass redraws materials across the sheet. Under this, it did not. */
const REDRAWN_FRACTION_FLOOR = 0.1;
/** A global filter moves almost every pixel a little. That is the signature to catch separately. */
const FILTER_TOUCHED_FLOOR = 0.6;

/**
 * Compare a paid render against the image it was given.
 *
 * Two numbers, because there are two distinct failure modes and they need different words:
 *   - a literal copy      → nothing moved            → 'unchanged'
 *   - a filter or grain   → everything moved a little → 'filtered-only'
 * Both are worthless to a farmer, and both have been sold as "AI polished".
 */
export function compareRenders(
  before: Uint8ClampedArray,
  after: Uint8ClampedArray,
  options: DifferenceOptions = {},
): DifferenceReport {
  if (before.length !== after.length) {
    throw new Error(`compareRenders: size mismatch (${before.length} vs ${after.length})`);
  }
  const { protectMask } = options;
  if (protectMask && protectMask.length !== before.length) {
    throw new Error(`compareRenders: mask size mismatch (${protectMask.length} vs ${before.length})`);
  }

  let compared = 0;
  let touched = 0;
  let redrawn = 0;
  let deltaSum = 0;

  for (let i = 0; i < before.length; i += 4) {
    if (protectMask && protectMask[i + 3] > 0) continue; // restored afterwards — not the model's work
    compared++;

    const dr = Math.abs(before[i] - after[i]);
    const dg = Math.abs(before[i + 1] - after[i + 1]);
    const db = Math.abs(before[i + 2] - after[i + 2]);
    const delta = Math.max(dr, dg, db);

    deltaSum += (dr + dg + db) / 3;
    if (delta > TRIVIAL_DELTA) touched++;
    if (delta >= VISIBLE_DELTA) redrawn++;
  }

  if (compared === 0) {
    // Everything was protected, so the model was never allowed to change anything. That is a
    // configuration mistake rather than a bad render, and calling it "unchanged" would send
    // someone to re-prompt a model that was given no canvas to work on.
    return { touchedFraction: 0, redrawnFraction: 0, meanDelta: 0, comparedPixels: 0, verdict: 'unchanged' };
  }

  const touchedFraction = touched / compared;
  const redrawnFraction = redrawn / compared;
  const meanDelta = deltaSum / compared;

  let verdict: DifferenceReport['verdict'] = 'redrawn';
  if (redrawnFraction < REDRAWN_FRACTION_FLOOR) {
    // Almost nothing was genuinely redrawn. If nearly every pixel still shifted slightly, the model
    // applied a global treatment; if not, it handed back the input.
    verdict = touchedFraction >= FILTER_TOUCHED_FLOOR ? 'filtered-only' : 'unchanged';
  }

  return { touchedFraction, redrawnFraction, meanDelta, comparedPixels: compared, verdict };
}

/**
 * What to tell the farmer. Deliberately plain and non-technical — the person reading this paid
 * money and deserves to know what they got, in the words they would use themselves.
 */
export function differenceMessage(
  report: DifferenceReport,
  stage: PaidRenderStage = 'polish',
): string | null {
  if (report.verdict === 'redrawn') return null;
  const pass = stage === 'hybrid' ? 'AI pass' : 'polish pass';
  const fallback = stage === 'hybrid' ? 'exact map' : 'hybrid map';
  if (report.comparedPixels === 0) {
    return `The ${pass} had nothing it was allowed to change on this sheet. Your ${fallback} is unchanged.`;
  }
  if (report.verdict === 'filtered-only') {
    return `The ${pass} only tinted the map instead of redrawing it, so it is not worth keeping. Your ${fallback} is unchanged.`;
  }
  return `The ${pass} returned the same map it was given, so there is nothing new to show. Your ${fallback} is unchanged.`;
}

/** The one keep/reject decision shared by the Hybrid and polish completion gates. */
export function paidRenderDecision(
  report: DifferenceReport,
  stage: PaidRenderStage,
): PaidRenderDecision {
  return {
    keep: report.verdict === 'redrawn',
    message: differenceMessage(report, stage),
  };
}
