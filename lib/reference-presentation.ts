export interface BoundaryPresentationCrop {
  cropX: number;
  cropY: number;
  cropFraction: number;
}

/**
 * Calculate a square, north-up presentation crop around a normalised property boundary.
 *
 * The crop is only for finished sheets. Equal X/Y fractions retain the source aspect ratio and
 * the caller remaps both coordinates and metres-per-pixel together, so saved geometry is untouched.
 */
export function calculateBoundaryPresentationCrop(
  boundary: Array<[number, number]>,
): BoundaryPresentationCrop | null {
  if (boundary.length < 3) return null;

  const xs = boundary.map(([x]) => x);
  const ys = boundary.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const boundarySpan = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(boundarySpan) || boundarySpan <= 0 || boundarySpan >= 0.76) return null;

  // WHY ONE FRACTION FROM THE LARGER SPAN, AND WHY THAT IS NOT THE BUG IT LOOKS LIKE.
  //
  // Rory: the plot fills roughly 40% of the map area, with wide empty margins. The obvious reading
  // is that this line should derive independent X and Y fractions — and that is wrong, so it is
  // written down here rather than discovered again.
  //
  // The caller crops `cropFraction * source.width` by `cropFraction * source.height` into a canvas
  // of the FULL source dimensions. The crop therefore always carries the source's own aspect ratio
  // and the mapping is a uniform zoom, which is the entire reason mPerPx stays valid on both axes
  // after the crop. An accurately sized bed stays accurately sized, and the scale bar keeps telling
  // the truth. Splitting X and Y would break that: metres per pixel would differ between axes, and
  // a plan whose scale bar lies is far worse than one with generous margins.
  //
  // Given that constraint this is already optimal. The crop must contain spanX of the width AND
  // spanY of the height, so it can be no smaller than max(spanX, spanY) plus margin. The plot then
  // fills ~81% of its longer axis and proportionally less of the shorter one — that is the shape of
  // the farm, not slack in the code.
  //
  // Filling the frame properly needs the SHEET to adopt the boundary's aspect ratio, so the map
  // panel is drawn tall for a tall plot and wide for a wide one. That is a layout change across
  // extendWithLegendPanel and every sheet composer, and it needs a rendered sheet to judge.
  //
  // Compact rural plots must remain legible rather than being held to 24% of a broad aerial.
  const margin = Math.max(0.025, boundarySpan * 0.12);
  const cropFraction = Math.min(1, Math.max(0.08, boundarySpan + margin * 2));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const cropX = Math.max(0, Math.min(1 - cropFraction, centerX - cropFraction / 2));
  const cropY = Math.max(0, Math.min(1 - cropFraction, centerY - cropFraction / 2));

  return { cropX, cropY, cropFraction };
}
