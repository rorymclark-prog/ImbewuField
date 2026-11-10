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
import type { CalendarBasis } from '@/lib/site-climate';

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

/**
 * May the plan's saved sowings be called out of season on the calendar in use?
 *
 * Yes when the calendar is the site's own climate reading, the grower's frost answer or
 * the grower's choice. Yes, too, when no site is mapped at all: the cautious fallback
 * is then the only calendar the plan was ever made on.
 *
 * No when a site IS mapped and its climate has not been read (still loading, offline
 * with nothing cached, or the provider is down). The page is then on the nearest
 * reference region, a labelled guess that is never the hot-area calendar. The plan may
 * well have been made on the site's real calendar, and judging it against the guess
 * tells a Lowveld grower their in-season sowings are wrong, then takes it back when
 * the climate loads. Seen on the hosted preview at 0c00546: a fresh visitor to the
 * sample farm got the Durban light-frost fallback and two "out of season" sowings
 * that are in season on the farm's own hot-area calendar (independent review of
 * PR #1328, comment 6762970071). The crop picker still offers the fallback's months,
 * and the header still says the calendar is a fallback.
 */
export function calendarCanJudgeSavedSowings(basis: CalendarBasis | 'reference', hasMappedSite: boolean): boolean {
  return basis !== 'reference' || !hasMappedSite;
}

/** "Cabbage on Bed 1: planned for January. This calendar sows it Feb–Jun." */
export function outOfCalendarLine(row: OutOfCalendarSowing, bedLabel?: string | null): string {
  const where = bedLabel ? ` on ${bedLabel}` : '';
  const instead = row.calendarMonths.length
    ? `This calendar sows it ${formatMonthSpan(row.calendarMonths)}.`
    : 'This calendar has no sowing month for it.';
  return `${row.cropName}${where}: planned for ${MONTH_NAMES[row.sowMonth - 1]}. ${instead}`;
}

/** The months a row recommends, as one stable token: valid months only, each once, in
 * calendar order. A catalogue row listed [10, 11, 12, 1] and one listed [1, 10, 11, 12]
 * say the same thing to a grower and must not look like a change. */
function recommendedMonthsToken(months: readonly number[]): string {
  return [...new Set(months.filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))]
    .sort((a, b) => a - b)
    .join('.');
}

/**
 * Identifies one set of out-of-season sowings under one calendar, so a grower who
 * hides the notice is not shown the same list again, and is shown it again as soon as
 * anything they were told changes: the calendar, which sowings are listed, the month
 * a sowing is planned for, or the months the calendar recommends instead.
 *
 * The recommended months were left out until 10 November 2026. Every line of the list
 * ends "This calendar sows it Feb–Jun", so a later correction to a crop's months
 * changed what the list says while the signature stayed the same, and a grower who
 * had hidden the old list was never shown the corrected one (independent review of
 * PR #1328, comment 6762918246).
 */
export function outOfCalendarSignature(rows: readonly OutOfCalendarSowing[], pattern: RainPattern): string {
  return `${pattern}|${rows
    .map((row) => `${row.plantingId}:${row.cropKey}:${row.sowMonth}:${recommendedMonthsToken(row.calendarMonths)}`)
    .sort()
    .join(',')}`;
}

/**
 * Base name of the browser record of hidden lists: site scope id → the signature the
 * grower hid. The page must store it through activeAccountLocalStorageKey, never under
 * this bare name. The record names a farm (the scope id is its coordinates) and its
 * crops, and this app keeps one account's farm data out of the next account's reach on
 * a shared phone (lib/account-local-storage.ts). The first version of the list wrote
 * the bare name; found on 10 November 2026 while checking the hosted build, before the
 * feature was released.
 */
export const SOWING_CALENDAR_NOTICE_HIDDEN_KEY = 'imbewu_sowing_calendar_notice_hidden_v1';

/** Reads a stored record of hidden lists. Anything that is not scope → signature text is dropped. */
export function parseHiddenCalendarNotices(raw: string | null | undefined): Record<string, string> {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [scope, signature] of Object.entries(parsed)) {
      if (typeof signature === 'string' && scope !== '__proto__') out[scope] = signature;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * What to store when a grower taps "Hide this list", or null when the tap must do nothing.
 *
 * The tap handler belongs to the render that drew the list: its site scope and its list
 * signature are that render's. A handler kept past a change of account, sample mode or
 * site still holds them. The first per-account version worked out the destination key at
 * the moment of the tap and wrote the old render's site into it, so account A's farm
 * landed in account B's record (independent review of PR #1328, comment 6765460003).
 * Choosing the right key is not enough: old-render data has no right destination.
 *
 * So the write is admitted only when BOTH hold at the moment of the tap:
 *  - the page's own actor and context admission says this render is still current
 *    (same account, the browser's signed-in user agrees with it, same sample state,
 *    same site and planning scope); and
 *  - the account key now is the key this render was drawn for.
 * Then the record stored under that key RIGHT NOW is read again and added to, so entries
 * for the account's other sites, or written by another tab, are kept. A refused tap
 * writes nothing anywhere: a newer account's record is left exactly as it was.
 */
export function hiddenCalendarNoticeWrite(input: {
  renderedStorageKey: string;
  currentStorageKey: string;
  actorIsCurrent: boolean;
  scope: string;
  signature: string;
  storedRaw: string | null | undefined;
}): { storageKey: string; byScope: Record<string, string> } | null {
  if (input.actorIsCurrent !== true) return null;
  if (!input.renderedStorageKey || input.renderedStorageKey !== input.currentStorageKey) return null;
  if (!input.scope || input.scope === '__proto__') return null;
  return {
    storageKey: input.currentStorageKey,
    byScope: { ...parseHiddenCalendarNotices(input.storedRaw), [input.scope]: input.signature },
  };
}

/**
 * True when the plan's accepted suggestion predates the correction, or carries no date
 * at all. Only then may the page say the months changed under the grower: a plan made
 * after it is out of season because of something they or their calendar choice did.
 */
export function planMayPredateCorrection(planNotesAt: number | undefined | null): boolean {
  return typeof planNotesAt !== 'number' || !Number.isFinite(planNotesAt) || planNotesAt < SOWING_CALENDAR_CORRECTED_AT;
}
