/**
 * Calendar tags for a rolling month axis that starts at the current month.
 *
 * The planner's charts run 24 columns from today, but a column only ever carried a month name
 * ("Sep", "Oct", …) and a ↻ glyph where year two began. Rory, 2026-09-29, looking at the
 * availability chart: "i dont know what month this is?". Nothing on it said which column was
 * today, or which of the two Septembers was this year's. Each slot now knows its calendar year,
 * whether it is the current month, and whether it should print that year (the first column and
 * every January), so a farmer can read any column as a real month.
 */
export interface MonthAxisSlot {
  /** 1–12. */
  month: number;
  /** Calendar year of this column. */
  year: number;
  /** The first column: the month the plan is being read in. */
  isNow: boolean;
  /** Print the year under this column: the first column and every January after it. */
  showYear: boolean;
}

export function monthAxisSlots(startMonth: number, startYear: number, count: number): MonthAxisSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const offset = startMonth - 1 + i;
    const month = (offset % 12) + 1;
    const year = startYear + Math.floor(offset / 12);
    return { month, year, isNow: i === 0, showYear: i === 0 || month === 1 };
  });
}
