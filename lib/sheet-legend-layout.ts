/**
 * Space left between legend rows after their measured text/symbol blocks are known.
 *
 * The slack is shared out across the column rather than capped at a map-width-derived rhythm. That
 * old cap was harmless on the short 3:2 sheet but left two thirds of a boundary-framed panel empty.
 *
 * BUT A SPARSE LEGEND IS A LIST, NOT A JUSTIFIED COLUMN. Rendered water sheet 04 of the Ubhejane
 * demo has only three rows: sharing all the slack put a visible hole between each one, so the
 * legend read as broken rather than full. Sparse lists therefore retain the rhythm ceiling.
 *
 * A populated legend is different. Rory's saved Water sheet has six real inventory rows, yet the
 * same universal ceiling ended the final row at y=604 while its notes began at y=1520: 71% of the
 * row band was blank. Six rows establish enough repeated anchors to read as one column, so they
 * span the actual reserved height. Four- and five-row legends interpolate towards that treatment
 * instead of crossing a hard sparse/populated threshold. The divisor is the number of BETWEEN-row
 * slots, never the number of rows — dividing by rowCount manufactures a trailing blank gap after
 * the last row.
 */
export const MAX_GAP_TO_ROW_RHYTHM = 1.15;
export const COMPACT_LEGEND_MAX_ROWS = 3;
export const FULL_HEIGHT_LEGEND_MIN_ROWS = 6;

export interface LegendRowMetric {
  /** Complete row block, including any section heading printed above it. */
  height: number;
}

export interface LegendColumnLayout {
  /** Top offset of each complete row block from the reserved legend-row band. */
  offsets: number[];
  /** Bottom of the final visible row block, in the same coordinate space as offsets. */
  contentBottom: number;
  /** Shared space between consecutive row blocks. */
  rowGap: number;
  /** True when even zero-gap rows cannot fit the reserved height. */
  overflow: boolean;
}

export interface LegendColumnRange {
  /** Inclusive row index. */
  start: number;
  /** Exclusive row index. */
  end: number;
}

/**
 * Smoothly transitions from a compact three-row list to a full-height six-row inventory.
 *
 * A hard cutoff concentrated all lower-panel expansion into one row-count transition. The linear
 * ramp apportions that expansion across four-, five-, and six-row inventories. Adding a static
 * legend fact still reflows the existing rows; the purpose here is to avoid an all-or-nothing mode
 * switch while preserving both rendered acceptance fixtures that motivated the policy.
 */
export function legendHeightFillRatio(rowCount: number): number {
  if (!Number.isSafeInteger(rowCount) || rowCount <= 0) return 0;
  return Math.max(
    0,
    Math.min(
      1,
      (rowCount - COMPACT_LEGEND_MAX_ROWS)
        / (FULL_HEIGHT_LEGEND_MIN_ROWS - COMPACT_LEGEND_MAX_ROWS),
    ),
  );
}

/** Width establishes the normal type scale; a genuinely populated tall column may grow to 1.44×. */
export function legendRowFontSize(
  legendWidth: number,
  availableHeight: number,
  rowCount: number,
): number {
  const safeWidth = Number.isFinite(legendWidth) && legendWidth >= 0 ? legendWidth : 0;
  const baseSize = Math.max(14, Math.round(safeWidth * 0.036));
  if (
    !Number.isFinite(availableHeight)
    || availableHeight <= 0
    || !Number.isSafeInteger(rowCount)
    || rowCount <= 0
  ) return baseSize;
  const widthCap = Math.max(baseSize, Math.round(safeWidth * 0.052));
  const trackTarget = Math.max(baseSize, Math.round((availableHeight / rowCount) * 0.11));
  const tallTarget = Math.min(widthCap, trackTarget);
  const fillRatio = legendHeightFillRatio(rowCount);
  return Math.round(baseSize + (tallTarget - baseSize) * fillRatio);
}

export function legendRowGap(
  availableHeight: number,
  usedHeight: number,
  rowCount: number,
  /** The natural line rhythm of this legend — the gap is never allowed to dwarf it. */
  rowRhythm = Number.POSITIVE_INFINITY,
): number {
  // Both halves of this guard earned their place. The negative/non-integer rejections came from a
  // hardening pass; the rhythm ceiling below came from looking at a rendered sheet. Merging kept
  // both, because the hardening branch was cut before the ceiling existed and taking its side
  // wholesale would have quietly restored the over-justified legend it never knew about.
  if (
    !Number.isFinite(availableHeight)
    || availableHeight < 0
    || !Number.isFinite(usedHeight)
    || usedHeight < 0
    || !Number.isSafeInteger(rowCount)
    || rowCount <= 0
  ) return 0;
  if (rowCount === 1) return 0;
  const fullHeightGap = Math.max(0, (availableHeight - usedHeight) / (rowCount - 1));
  if (!Number.isFinite(rowRhythm)) return fullHeightGap;
  const compactGap = Math.min(
    fullHeightGap,
    Math.max(0, rowRhythm) * MAX_GAP_TO_ROW_RHYTHM,
  );
  const fillRatio = legendHeightFillRatio(rowCount);
  return compactGap + (fullHeightGap - compactGap) * fillRatio;
}

/**
 * Places measured rows inside the exact vertical band reserved between LEGEND and the footer.
 *
 * Sparse legends remain one compact list. As factual density increases, every consecutive row
 * shares one progressively larger rhythm. This avoids both failure modes observed in rendered
 * sheets: three isolated islands on a sparse panel, and a six-row cluster abandoned above a blank
 * lower two thirds. Section headings travel with their first row instead of creating unbounded
 * holes between semantic groups.
 */
export function layoutLegendColumn(
  availableHeight: number,
  rows: LegendRowMetric[],
  rowRhythm: number,
): LegendColumnLayout {
  const invalid = !Number.isFinite(availableHeight)
    || availableHeight < 0
    || !Number.isFinite(rowRhythm)
    || rowRhythm < 0
    || rows.some((row) => !Number.isFinite(row.height) || row.height < 0);
  if (invalid) return { offsets: [], contentBottom: 0, rowGap: 0, overflow: rows.length > 0 };
  if (!rows.length) return { offsets: [], contentBottom: 0, rowGap: 0, overflow: false };

  const usedHeight = rows.reduce((sum, row) => sum + row.height, 0);
  const rowGap = usedHeight >= availableHeight
    ? 0
    : legendRowGap(availableHeight, usedHeight, rows.length, rowRhythm);
  const offsets: number[] = [];
  let y = 0;
  rows.forEach((row, index) => {
    offsets.push(y);
    y += row.height;
    if (index < rows.length - 1) y += rowGap;
  });
  return {
    offsets,
    contentBottom: y,
    rowGap,
    overflow: y > availableHeight + 0.001,
  };
}

/**
 * Partitions an ordered legend into contiguous columns while minimising the tallest column.
 *
 * Order never changes, every fact appears exactly once, and no column is empty. The renderer
 * remeasures each returned slice at its actual column width, so this helper owns only the stable
 * sequence partition—not typography.
 */
export function balancedLegendColumnRanges(
  rowHeights: number[],
  requestedColumns: number,
  /**
   * Optional exact cost of rendering one contiguous slice. The canvas renderer uses this to
   * include a repeated section heading when a section continues at the top of a new column.
   */
  rangeCost?: (start: number, end: number) => number,
): LegendColumnRange[] {
  if (
    !Number.isSafeInteger(requestedColumns)
    || requestedColumns <= 0
    || rowHeights.some((height) => !Number.isFinite(height) || height < 0)
  ) return [];
  if (!rowHeights.length) return [];

  const columnCount = Math.min(requestedColumns, rowHeights.length);
  const prefix = [0];
  rowHeights.forEach((height) => prefix.push(prefix[prefix.length - 1] + height));
  const rangeHeight = (start: number, end: number) => {
    const cost = rangeCost ? rangeCost(start, end) : prefix[end] - prefix[start];
    return Number.isFinite(cost) && cost >= 0 ? cost : Number.POSITIVE_INFINITY;
  };
  let bestRanges: LegendColumnRange[] | null = null;
  let bestTallest = Number.POSITIVE_INFINITY;
  let bestSpread = Number.POSITIVE_INFINITY;

  const visit = (start: number, columnIndex: number, ranges: LegendColumnRange[]) => {
    if (columnIndex === columnCount - 1) {
      const candidate = [...ranges, { start, end: rowHeights.length }];
      const heights = candidate.map((range) => rangeHeight(range.start, range.end));
      const tallest = Math.max(...heights);
      const spread = tallest - Math.min(...heights);
      if (
        tallest < bestTallest - 0.001
        || (Math.abs(tallest - bestTallest) <= 0.001 && spread < bestSpread)
      ) {
        bestRanges = candidate;
        bestTallest = tallest;
        bestSpread = spread;
      }
      return;
    }
    const remainingColumns = columnCount - columnIndex - 1;
    const finalSplit = rowHeights.length - remainingColumns;
    for (let end = start + 1; end <= finalSplit; end += 1) {
      visit(end, columnIndex + 1, [...ranges, { start, end }]);
    }
  };

  visit(0, 0, []);
  return bestRanges ?? [];
}

/** Countable map content always says how many markers/routes the row represents. An omitted count
 * used to mean either "one" or "not counted", which a farmer could not distinguish. */
export function countedLegendText(label: string, count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Legend count must be a non-negative safe integer');
  }
  return `${label} ×${count}`;
}
