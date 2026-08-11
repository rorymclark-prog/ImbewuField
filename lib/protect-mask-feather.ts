export interface ItemMaskFeatherLayer {
  width: number;
  height: number;
  eraseAlpha: number;
}

/**
 * A soft item-shaped hole that never expands the existing 1.7× editable bound.
 *
 * Canvas destination-out multiplies the alpha already present by (1 - eraseAlpha). Choosing
 * 1/N, 1/(N-1) … 1 makes the cumulative protection fall in equal steps from 1 at the real photo
 * to 0 in the editable core. The last silhouette is 13/17 of the outer one: because the caller's
 * outer cut is 1.7× the saved footprint, that leaves the same fully-editable 1.3× core and spends
 * only the old 1.3×–1.7× allowance on blending. No extra ground is handed to the model.
 */
export function buildItemMaskFeatherLayers(width: number, height: number): ItemMaskFeatherLayer[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Item mask dimensions must be finite and positive');
  }
  const steps = 17;
  const coreRatio = 13 / 17;
  return Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    const scale = 1 - (1 - coreRatio) * t;
    return {
      width: width * scale,
      height: height * scale,
      eraseAlpha: 1 / (steps - index),
    };
  });
}
