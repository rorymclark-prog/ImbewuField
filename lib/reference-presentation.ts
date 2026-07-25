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

  // Compact rural plots must remain legible rather than being held to 24% of a broad aerial.
  const margin = Math.max(0.025, boundarySpan * 0.12);
  const cropFraction = Math.min(1, Math.max(0.08, boundarySpan + margin * 2));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const cropX = Math.max(0, Math.min(1 - cropFraction, centerX - cropFraction / 2));
  const cropY = Math.max(0, Math.min(1 - cropFraction, centerY - cropFraction / 2));

  return { cropX, cropY, cropFraction };
}
