// Saved sowings that the site's sowing calendar no longer offers.
//
// WHY (10 November 2026, Rory: "go ahead with decisions 2 and 3"). The accuracy fixes of
// that day changed which calendar 11 of 44 audited places get and corrected 39
// sowing-month rows. Nothing rewrites a saved plan, which is right: a plan is the
// grower's. But a grower in Komatipoort whose plan sowed cabbage in January was left
// with a January cabbage on screen and no word that the calendar now sows it February
// to June. The same happens whenever a grower changes their own calendar. This module
// finds those sowings so the page can list them. It never moves or removes one.

import { cropByKey, type RainPattern } from '@/lib/crop-catalog';
import type { Planting } from '@/lib/crop-plan';
import { formatMonthSpan } from '@/lib/perennial-harvest';

/** The day sowing months and calendars were corrected (UTC). A plan accepted before it
 * can be out of season through no choice of the grower's. */
export const SOWING_CALENDAR_CORRECTED_AT = Date.UTC(2026, 10, 10);

export interface OutOfCalendarSowing {
  plantingId: string;
  bedId: string;
  cropKey: string;
  cropName: string;
  /** 1-12: the month the saved plan sows it. */
  sowMonth: number;
  /** The months this site's calendar gives the crop; empty when it gives none. */
  calendarMonths: readonly number[];
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function stampIndex(stamp: unknown): number | null {
  if (typeof stamp !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(stamp);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? Number(match[1]) * 12 + month - 1 : null;
}

/**
 * The plan's sowings that are still ahead of the grower and fall in a month the
 * calendar does not give that crop.
 *
 * Left out, each for a reason:
 *  - a crop already in the ground (`existing`), a one-time sowing whose month has
 *    passed or is awaiting confirmation, and a finished one: the sowing is behind the
 *    grower, and a calendar cannot un-sow it;
 *  - a row planned on the grower's own growing estimates (`growerCycle`): the
 *    catalogue's months were never its basis;
 *  - a crop whose timing the catalogue does not vouch for (`timingVerified: false`),
 *    which the crop picker does not warn about either;
 *  - a crop key the catalogue does not know.
 */
export function sowingsOutsideCalendar(
  plantings: readonly Planting[],
  pattern: RainPattern,
  now: { year: number; month: number },
): OutOfCalendarSowing[] {
  const nowIndex = now.year * 12 + now.month - 1;
  const out: OutOfCalendarSowing[] = [];
  for (const planting of plantings) {
    if (planting.existing || planting.growerCycle !== undefined) continue;
    if (planting.awaitingSowingConfirmation || planting.finishedOnceSowing || planting.confirmedOnceSowing) continue;
    if (planting.once !== undefined) {
      const index = stampIndex(planting.once);
      if (index === null || index < nowIndex) continue;
    }
    const crop = cropByKey(planting.cropKey);
    if (!crop || crop.timingVerified === false) continue;
    if (!Number.isInteger(planting.sowMonth) || planting.sowMonth < 1 || planting.sowMonth > 12) continue;
    const calendarMonths = crop.sowMonths[pattern];
    if (calendarMonths.includes(planting.sowMonth)) continue;
    out.push({ plantingId: planting.id, bedId: planting.bedId, cropKey: crop.key, cropName: crop.name, sowMonth: planting.sowMonth, calendarMonths });
  }
  return out;
}

/** "Cabbage on Bed 1: planned for January. This calendar sows it Feb–Jun." */
export function outOfCalendarLine(row: OutOfCalendarSowing, bedLabel?: string | null): string {
  const where = bedLabel ? ` on ${bedLabel}` : '';
  const instead = row.calendarMonths.length
    ? `This calendar sows it ${formatMonthSpan(row.calendarMonths)}.`
    : 'This calendar has no sowing month for it.';
  return `${row.cropName}${where}: planned for ${MONTH_NAMES[row.sowMonth - 1]}. ${instead}`;
}

/**
 * Identifies one set of out-of-season sowings under one calendar, so a grower who
 * hides the notice is not shown the same list again, and is shown it again as soon as
 * the list or the calendar changes.
 */
export function outOfCalendarSignature(rows: readonly OutOfCalendarSowing[], pattern: RainPattern): string {
  return `${pattern}|${rows.map((row) => `${row.plantingId}:${row.cropKey}:${row.sowMonth}`).sort().join(',')}`;
}

/**
 * True when the plan's accepted suggestion predates the correction, or carries no date
 * at all. Only then may the page say the months changed under the grower: a plan made
 * after it is out of season because of something they or their calendar choice did.
 */
export function planMayPredateCorrection(planNotesAt: number | undefined | null): boolean {
  return typeof planNotesAt !== 'number' || !Number.isFinite(planNotesAt) || planNotesAt < SOWING_CALENDAR_CORRECTED_AT;
}
