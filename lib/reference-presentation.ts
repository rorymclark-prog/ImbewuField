export interface BoundaryPresentationCrop {
  cropX: number;
  cropY: number;
  cropFraction: number;
}

export interface BoundaryPresentationLayout {
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  imgW: number;
  imgH: number;
  sourcePixelsPerOutputPixel: number;
  legendWidth: number;
  sheetAspect: number;
}

export interface StyleSheetSize {
  mapW: number;
  mapH: number;
  legendWidth: number;
  W: number;
  H: number;
  aspect: number;
}

export const MAX_PRESENTATION_MAP_ASPECT = 2.35;
export const MAX_PRESENTATION_SHEET_ASPECT = 3;

export function styleSheetLegendWidth(mapWidth: number): number {
  return Math.min(620, Math.max(360, Math.round(mapWidth * 0.3)));
}

export function calculateStyleSheetSize(mapW: number, mapH: number): StyleSheetSize {
  const legendWidth = styleSheetLegendWidth(mapW);
  const W = mapW + legendWidth;
  return {
    mapW,
    mapH,
    legendWidth,
    W,
    H: mapH,
    aspect: Math.max(W / mapH, mapH / W),
  };
}

interface BoundaryBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boundaryBounds(boundary: Array<[number, number]>): BoundaryBounds | null {
  if (boundary.length < 3) return null;
  const xs = boundary.map(([x]) => x);
  const ys = boundary.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  if (![minX, maxX, minY, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) {
    return null;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Derive a finished-sheet map viewport from the boundary without changing the saved design.
 *
 * The output map keeps roughly the source frame's pixel area, but changes shape to follow the
 * boundary. One source-pixels-per-output-pixel value owns both axes; cropWidth/cropHeight are
 * consequences of that one scale and the derived output dimensions, never separate X/Y zooms.
 */
export function calculateBoundaryPresentationLayout(
  boundary: Array<[number, number]>,
  frame: { imgW: number; imgH: number },
  renderScale = 2,
): BoundaryPresentationLayout | null {
  const bounds = boundaryBounds(boundary);
  if (
    !bounds
    || !Number.isFinite(frame.imgW)
    || !Number.isFinite(frame.imgH)
    || frame.imgW <= 0
    || frame.imgH <= 0
    || !Number.isFinite(renderScale)
    || renderScale <= 0
  ) {
    return null;
  }

  const spanX = (bounds.maxX - bounds.minX) * frame.imgW;
  const spanY = (bounds.maxY - bounds.minY) * frame.imgH;
  if (spanX <= 0 || spanY <= 0) return null;

  const sourceArea = frame.imgW * frame.imgH;
  const dimensionsForAspect = (aspect: number): { imgW: number; imgH: number } => ({
    imgW: Math.max(1, Math.round(Math.sqrt(sourceArea * aspect))),
    imgH: Math.max(1, Math.round(Math.sqrt(sourceArea / aspect))),
  });
  const sheetMetricsForAspect = (aspect: number) => {
    const dimensions = dimensionsForAspect(aspect);
    const mapWidth = dimensions.imgW * renderScale;
    const mapHeight = dimensions.imgH * renderScale;
    const sheet = calculateStyleSheetSize(mapWidth, mapHeight);
    return {
      ...dimensions,
      legendWidth: sheet.legendWidth,
      sheetAspect: sheet.aspect,
    };
  };

  // The plot chooses the map shape. Extremely wide plots stop at 2.35:1 so the fixed readable
  // legend cannot push the complete AI sheet past 3:1. The extra map height is honest letterbox,
  // not a second Y zoom.
  let mapAspect = Math.min(MAX_PRESENTATION_MAP_ASPECT, spanX / spanY);
  let sheetMetrics = sheetMetricsForAspect(mapAspect);
  if (sheetMetrics.sheetAspect > MAX_PRESENTATION_SHEET_ASPECT) {
    // Very tall plots can also exceed the model's limit. Move only as far toward square as needed;
    // the resulting spare width is the same honest letterbox used for over-wide properties.
    let unsafeAspect = mapAspect;
    let safeAspect = 1;
    for (let i = 0; i < 48; i++) {
      const candidate = (unsafeAspect + safeAspect) / 2;
      const candidateMetrics = sheetMetricsForAspect(candidate);
      if (candidateMetrics.sheetAspect <= MAX_PRESENTATION_SHEET_ASPECT) {
        safeAspect = candidate;
        sheetMetrics = candidateMetrics;
      } else {
        unsafeAspect = candidate;
      }
    }
    mapAspect = safeAspect;
    sheetMetrics = sheetMetricsForAspect(mapAspect);
  }

  /**
   * Everything below the aspect choice: given a map shape, work out the crop that frames the
   * boundary inside it. Returns null when that crop would reach outside the source image, which
   * is the one thing this layout may never do — a crop wider than its photo would either clip the
   * farm or paint an edge of nothing.
   */
  const layoutForAspect = (aspect: number): BoundaryPresentationLayout | null => {
    const { imgW, imgH, legendWidth, sheetAspect } = sheetMetricsForAspect(aspect);
    // Apply the same relative breathing room to both boundary dimensions, then choose ONE scale
    // large enough to contain both. If the source is already tight, reduce that shared padding
    // factor rather than clipping or inventing axis-specific zoom.
    const outputAspect = imgW / imgH;
    const cropWidthAtUnitPadding = Math.max(spanX, spanY * outputAspect);
    const cropHeightAtUnitPadding = Math.max(spanY, spanX / outputAspect);
    const paddingFactor = Math.max(
      1,
      Math.min(
        1.24,
        frame.imgW / cropWidthAtUnitPadding,
        frame.imgH / cropHeightAtUnitPadding,
      ),
    );
    const sourcePixelsPerOutputPixel = Math.max(
      0.08,
      (spanX * paddingFactor) / imgW,
      (spanY * paddingFactor) / imgH,
    );
    const cropWidthPx = imgW * sourcePixelsPerOutputPixel;
    const cropHeightPx = imgH * sourcePixelsPerOutputPixel;
    if (cropWidthPx > frame.imgW + 1e-6 || cropHeightPx > frame.imgH + 1e-6) return null;

    const centerX = ((bounds.minX + bounds.maxX) / 2) * frame.imgW;
    const centerY = ((bounds.minY + bounds.maxY) / 2) * frame.imgH;
    const cropLeftPx = Math.max(0, Math.min(frame.imgW - cropWidthPx, centerX - cropWidthPx / 2));
    const cropTopPx = Math.max(0, Math.min(frame.imgH - cropHeightPx, centerY - cropHeightPx / 2));

    return {
      cropX: cropLeftPx / frame.imgW,
      cropY: cropTopPx / frame.imgH,
      cropWidth: cropWidthPx / frame.imgW,
      cropHeight: cropHeightPx / frame.imgH,
      imgW,
      imgH,
      sourcePixelsPerOutputPixel,
      legendWidth,
      sheetAspect,
    };
  };

  // ── Fill the paper with ground, not with cream ────────────────────────────────────────────────
  //
  // The finished sheet is centred on ISO 216 landscape paper at the very end of composeStyleSheet
  // (paperSheetCanvas → padToPaperSheet). Whatever the sheet does not fill shows up as a cream band
  // down two edges. Rory, looking at a rendered plan: "when we do a map it does[n't] fill out the
  // A3 ratio, we need to make the satellite image bigger so there is no blank space."
  //
  // So aim the MAP at the shape whose composed sheet is ALREADY 1:√2, and let the surplus be real
  // aerial photograph instead of blank paper. Neighbouring land is worth more to a farmer than a
  // margin is: it is where the water arrives from and where the wind comes over.
  //
  // WHY THIS IS A TARGET AND NOT A CONSTRAINT. The first attempt at A-series (see PAPER_SHEET_RATIO
  // below) forced the ratio through this viewport and returned null when the resulting crop fell
  // outside the source image — which silently dropped the whole sheet back to an unframed fallback.
  // That traded a regression for a ratio, and it is why the paper ended up applied as margin
  // instead. Here the paper ratio is only ever ATTEMPTED: if its crop does not fit the photo, we
  // walk back toward the boundary-derived shape until one does. The worst case is therefore exactly
  // the old sheet, with the old margin — never a fallback, never a clipped farm.
  const sheetRatioForAspect = (aspect: number): number => {
    const { imgW, imgH } = dimensionsForAspect(aspect);
    const sheet = calculateStyleSheetSize(imgW * renderScale, imgH * renderScale);
    return sheet.W / sheet.H;
  };

  // Sheet ratio rises monotonically with map aspect — a wider map can only make a wider sheet —
  // so bisection lands on the map shape that needs no padding at all.
  const paperMapAspect = (() => {
    let lo = 0.05;
    let hi = MAX_PRESENTATION_MAP_ASPECT;
    if (sheetRatioForAspect(lo) >= PAPER_SHEET_RATIO) return lo;
    if (sheetRatioForAspect(hi) <= PAPER_SHEET_RATIO) return hi;
    for (let i = 0; i < 48; i++) {
      const mid = (lo + hi) / 2;
      if (sheetRatioForAspect(mid) < PAPER_SHEET_RATIO) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  })();

  const paperLayout = layoutForAspect(paperMapAspect);
  if (paperLayout) return paperLayout;

  // The photo cannot cover a full A-series frame around this boundary. Fall back to the shape the
  // plot itself asks for, then creep as far toward the paper shape as the photo actually allows —
  // less cream than before, and never less sheet than before.
  const boundaryLayout = layoutForAspect(mapAspect);
  if (!boundaryLayout) return null;

  let best = boundaryLayout;
  let fits = mapAspect;
  let misses = paperMapAspect;
  for (let i = 0; i < 24; i++) {
    const candidate = (fits + misses) / 2;
    const layout = layoutForAspect(candidate);
    if (layout) {
      best = layout;
      fits = candidate;
    } else {
      misses = candidate;
    }
  }
  return best;
}

/**
 * Sheet 08 uses the same map-plus-column envelope as every other plan sheet. Keeping this beside
 * the boundary layout prevents its exact canvas, AI input, blank-out and protect mask from
 * independently rediscovering dimensions and exposing schedule text at the wrong coordinates.
 */
export function calculatePhasingSheetSize(
  boundary: Array<[number, number]>,
  frame: { imgW: number; imgH: number },
  renderScale = 2,
): StyleSheetSize {
  const layout = calculateBoundaryPresentationLayout(boundary, frame, renderScale);
  const mapW = (layout?.imgW ?? frame.imgW) * renderScale;
  const mapH = (layout?.imgH ?? frame.imgH) * renderScale;
  return calculateStyleSheetSize(mapW, mapH);
}

/**
 * Calculate the former source-aspect crop around a normalised property boundary.
 *
 * Kept as a small compatibility helper and regression guard. Finished sheets use
 * calculateBoundaryPresentationLayout, which changes the viewport shape without abandoning this
 * helper's central invariant: one zoom value must describe both axes.
 */
export function calculateBoundaryPresentationCrop(
  boundary: Array<[number, number]>,
): BoundaryPresentationCrop | null {
  const bounds = boundaryBounds(boundary);
  if (!bounds) return null;
  const { minX, maxX, minY, maxY } = bounds;
  const boundarySpan = Math.max(maxX - minX, maxY - minY);
  if (boundarySpan >= 0.76) return null;

  // Independent X/Y fractions would make metres-per-pixel disagree between axes. The finished-sheet
  // layout solves the empty-paper problem by changing output dimensions instead, never by accepting
  // that dishonest shortcut. Compact rural plots also remain legible rather than being held to 24%.
  const margin = Math.max(0.025, boundarySpan * 0.12);
  const cropFraction = Math.min(1, Math.max(0.08, boundarySpan + margin * 2));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const cropX = Math.max(0, Math.min(1 - cropFraction, centerX - cropFraction / 2));
  const cropY = Math.max(0, Math.min(1 - cropFraction, centerY - cropFraction / 2));

  return { cropX, cropY, cropFraction };
}

/**
 * ISO 216 ratio — 1:√2, shared by A0 through A6.
 *
 * THE PLAN SET PRINTS ON A2 LANDSCAPE. Rory: "don't you think maps should be standard A4 A3 A2
 * proportions?", then "A2 ... in landscape of course." A2 is the standard large-format sheet a
 * South African town print shop can produce, and it holds a nine-sheet set at a scale where a
 * 1.2 m bed is still a readable object. The renderer works in pixels, so what matters here is the
 * RATIO: a √2 sheet drops onto A2, A3 or A4 paper with no re-layout.
 *
 * HOW IT IS APPLIED MATTERS, and the first attempt got it wrong. Forcing the ratio through the MAP
 * viewport — making the map whatever shape leaves the sheet at √2 — trips the layout's "the crop
 * must fit inside the source image" guard on some farms, which returns null and silently drops the
 * sheet back to an unframed fallback. That trades a regression for a ratio. The paper is added as
 * MARGIN around the finished sheet instead: metres-per-pixel, the boundary framing and every saved
 * coordinate are untouched, and the surplus is a clean paper border — which is what a printed plan
 * has anyway.
 */
export const PAPER_SHEET_RATIO = Math.SQRT2;

/** The canvas a finished sheet must be padded to so it prints A-series landscape. Never smaller
 *  than the sheet itself: this only ever ADDS paper, so nothing composed can be cropped by it. */
export function paperSheetCanvas(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: Math.max(1, width || 1), height: Math.max(1, height || 1) };
  }
  const ratio = width / height;
  if (ratio > PAPER_SHEET_RATIO) return { width, height: Math.round(width / PAPER_SHEET_RATIO) };
  if (ratio < PAPER_SHEET_RATIO) return { width: Math.round(height * PAPER_SHEET_RATIO), height };
  return { width, height };
}
