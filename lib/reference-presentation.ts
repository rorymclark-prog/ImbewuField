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

export const MAX_PRESENTATION_MAP_ASPECT = 2.35;
export const MAX_PRESENTATION_SHEET_ASPECT = 3;

export function styleSheetLegendWidth(mapWidth: number): number {
  return Math.min(620, Math.max(360, Math.round(mapWidth * 0.3)));
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
    const legendWidth = styleSheetLegendWidth(mapWidth);
    const sheetWidth = mapWidth + legendWidth;
    return {
      ...dimensions,
      legendWidth,
      sheetAspect: Math.max(sheetWidth / mapHeight, mapHeight / sheetWidth),
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

  const { imgW, imgH, legendWidth, sheetAspect } = sheetMetrics;
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
