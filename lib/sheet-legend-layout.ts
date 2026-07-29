/**
 * Space left between legend rows after their measured text/symbol blocks are known.
 *
 * The remaining height is distributed across the complete column instead of capped at a
 * map-width-derived rhythm. That cap was harmless on the old short 3:2 sheet, but once the sheet
 * followed a tall boundary it left two thirds of the cream panel empty. Using the actual available
 * height preserves readable type and makes the final gap the same rhythm as every preceding gap.
 */
export function legendRowGap(availableHeight: number, usedHeight: number, rowCount: number): number {
  if (
    !Number.isFinite(availableHeight)
    || availableHeight < 0
    || !Number.isFinite(usedHeight)
    || usedHeight < 0
    || !Number.isSafeInteger(rowCount)
    || rowCount <= 0
  ) return 0;
  return Math.max(0, (availableHeight - usedHeight) / rowCount);
}

/** Countable map content always says how many markers/routes the row represents. An omitted count
 * used to mean either "one" or "not counted", which a farmer could not distinguish. */
export function countedLegendText(label: string, count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Legend count must be a non-negative safe integer');
  }
  return `${label} ×${count}`;
}
