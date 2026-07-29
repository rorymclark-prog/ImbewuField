/**
 * Space left between legend rows after their measured text/symbol blocks are known.
 *
 * The slack is shared out across the column rather than capped at a map-width-derived rhythm. That
 * old cap was harmless on the short 3:2 sheet but left two thirds of a boundary-framed panel empty.
 *
 * BUT A LEGEND IS A LIST, NOT A JUSTIFIED COLUMN, and distributing without a ceiling is its own
 * defect. Rendered water sheet 04 of the Ubhejane demo has three rows in a full-height panel:
 * sharing all the slack put a visible hole between each one, so the legend read as broken rather
 * than full — and, because the same gap is also left after the last row, the panel was STILL empty
 * at the bottom. Worse than the problem it replaced.
 *
 * So the gap is capped at a multiple of the natural row rhythm. A well-populated legend still
 * spreads to fill its column; a short one stays a compact block at the top with honest white space
 * below it, which is what a legend on a large sheet is supposed to look like.
 */
export const MAX_GAP_TO_ROW_RHYTHM = 1.15;

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
  const shared = Math.max(0, (availableHeight - usedHeight) / rowCount);
  const ceiling = Number.isFinite(rowRhythm) ? Math.max(0, rowRhythm) * MAX_GAP_TO_ROW_RHYTHM : Infinity;
  return Math.min(shared, ceiling);
}

/** Countable map content always says how many markers/routes the row represents. An omitted count
 * used to mean either "one" or "not counted", which a farmer could not distinguish. */
export function countedLegendText(label: string, count: number): string {
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError('Legend count must be a non-negative safe integer');
  }
  return `${label} ×${count}`;
}
