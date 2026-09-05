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
   * APP-OWNED PIXELS — the ones the farmer sees the app's version of, whatever the model painted
   * underneath them. Two things put a pixel in this set: the Hybrid tier restores it byte-for-byte
   * after the model returns (the boundary ring, the driveway, outside the plot, the house halo),
   * and the Full Treatment tier redraws it as vector chrome in the same pass as the labels and the
   * legend (the boundary ring — see fullTreatmentProtectPolicy). Either way the model's work there
   * is invisible, so including it would guarantee a large unchanged-looking region and drag every
   * score toward "unchanged", punishing a pass that did redraw everything it was allowed to touch.
   *
   * Every pixel marked here is a pixel the model is no longer asked to have changed, so a mask
   * that covers more than the app genuinely owns weakens this gate. Alpha 255 is fully protected;
   * intermediate alpha is scored after the same proportional blend the compositor applies. Omit to
   * compare the whole frame — which is what the paths that restore and redraw nothing now do.
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
  /** How many fully protected pixels were changed. */
  protectedMismatches: number;
  /**
   * Fraction of comparable, non-paper SOURCE content that came back as near-white paper. This
   * catches a destructive redraw that the ordinary difference score calls a success precisely
   * because erasing a photograph — or the sparse marks on a paper plan — changes so many pixels.
   */
  blankedFraction: number;
  verdict: 'redrawn' | 'content-erased' | 'filtered-only' | 'unchanged';
}

export type PaidRenderStage = 'hybrid' | 'polish';

export interface PaidRenderDecision {
  keep: boolean;
  message: string | null;
}

/** After composition, most of a page may be identical source pixels and app-owned chrome.
 * Reusing the raw pass's 10% redraw floor would reject a useful repaint of a small feature.
 * This check only asks whether visible model work survived the overlays. It does not certify
 * quality, feature counts, positions or fidelity; the result remains a review candidate. */
export function retainedRenderHasVisibleChange(report: DifferenceReport): boolean {
  return report.verdict !== 'content-erased'
    && report.redrawnFraction * report.comparedPixels >= 8;
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
 * A painted map may be light, but it may not turn a substantial part of a supplied photograph
 * into empty paper. The broken Whole-design Gemini result measured 69% blank in the map panel;
 * its exact satellite source measured effectively 0%. Losing 30% of the source's actual content is
 * already a visibly missing region, while leaving ample room for white roofs, paths and highlights.
 */
const CONTENT_ERASED_FRACTION_CEILING = 0.3;

/** Near-white and neutral enough to read as untouched paper rather than a painted material. */
function isBlankPaper(r: number, g: number, b: number): boolean {
  return Math.min(r, g, b) >= 240 && Math.max(r, g, b) - Math.min(r, g, b) <= 12;
}

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
  if (before.length % 4 !== 0) {
    throw new Error(`compareRenders: RGBA buffers must contain whole pixels (${before.length} bytes)`);
  }
  const { protectMask } = options;
  if (protectMask && protectMask.length !== before.length) {
    throw new Error(`compareRenders: mask size mismatch (${protectMask.length} vs ${before.length})`);
  }

  let compared = 0;
  let touched = 0;
  let redrawn = 0;
  let deltaSum = 0;
  let protectedMismatches = 0;
  let blanked = 0;
  let sourceContent = 0;

  for (let i = 0; i < before.length; i += 4) {
    const protection = protectMask ? protectMask[i + 3] / 255 : 0;
    if (protection >= 1) {
      if (
        before[i] !== after[i] ||
        before[i + 1] !== after[i + 1] ||
        before[i + 2] !== after[i + 2] ||
        before[i + 3] !== after[i + 3]
      ) {
        protectedMismatches++;
      }
      continue; // restored byte-for-byte afterwards — not the model's work
    }
    compared++;

    // Score what the farmer will actually see after restoreProtectedPixels.
    // Anti-aliased/soft masks blend the source and model proportionally; an
    // alpha of 1 is almost entirely editable, not equivalent to alpha 255.
    const visible = (channel: number): number =>
      Math.round(before[i + channel] * protection + after[i + channel] * (1 - protection));
    const visibleR = visible(0);
    const visibleG = visible(1);
    const visibleB = visible(2);
    const dr = Math.abs(before[i] - visibleR);
    const dg = Math.abs(before[i + 1] - visibleG);
    const db = Math.abs(before[i + 2] - visibleB);
    const delta = Math.max(dr, dg, db);

    deltaSum += (dr + dg + db) / 3;
    if (delta > TRIVIAL_DELTA) touched++;
    if (delta >= VISIBLE_DELTA) redrawn++;
    if (!isBlankPaper(before[i], before[i + 1], before[i + 2])) {
      sourceContent++;
      if (isBlankPaper(visibleR, visibleG, visibleB)) blanked++;
    }
  }

  if (compared === 0) {
    // everything was protected, so the model was never allowed to change anything. That is a
    // configuration mistake rather than a bad render, and calling it "unchanged" would send
    // someone to re-prompt a model that was given no canvas to work on.
    return {
      touchedFraction: 0,
      redrawnFraction: 0,
      blankedFraction: 0,
      meanDelta: 0,
      comparedPixels: 0,
      protectedMismatches,
      verdict: 'unchanged',
    };
  }

  const touchedFraction = touched / compared;
  const redrawnFraction = redrawn / compared;
  const blankedFraction = sourceContent > 0 ? blanked / sourceContent : 0;
  const meanDelta = deltaSum / compared;

  let verdict: DifferenceReport['verdict'] = 'redrawn';
  if (blankedFraction >= CONTENT_ERASED_FRACTION_CEILING) {
    // This must outrank the ordinary redraw score: deleting a satellite image into white paper
    // moves nearly every channel and otherwise looks like an exceptionally strong redraw.
    verdict = 'content-erased';
  } else if (redrawnFraction < REDRAWN_FRACTION_FLOOR) {
    // Almost nothing was genuinely redrawn. If nearly every pixel still shifted slightly, the model
    // applied a global treatment; if not, it handed back the input.
    verdict = touchedFraction >= FILTER_TOUCHED_FLOOR ? 'filtered-only' : 'unchanged';
  }

  return {
    touchedFraction,
    redrawnFraction,
    blankedFraction,
    meanDelta,
    comparedPixels: compared,
    protectedMismatches,
    verdict,
  };
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
  if (report.verdict === 'content-erased') {
    return `The ${pass} erased a large part of the map into blank paper instead of illustrating it, so it was not kept. Your ${fallback} is unchanged.`;
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
