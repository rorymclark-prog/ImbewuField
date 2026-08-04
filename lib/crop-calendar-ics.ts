// ── Crop plan tasks → an .ics calendar file ─────────────────────────────────
//
// "All tasks need to be able to be exported to google calendar or calendar."
// The plan already knows every job of the year (tasksForPlan); this turns them
// into a file Google Calendar and Apple Calendar both import without argument.
//
// PURE MODULE — no browser APIs. It returns a string; the caller turns that
// into a Blob and hands it to the device (lib/crop-export-deliver.ts). Same
// discipline as lib/offline-pack.ts, and the reason the escaping, the folding
// and the year arithmetic below are all testable without a browser.
//
// ── The four decisions that matter ─────────────────────────────────────────
//
// 1. MONTH PRECISION, HONESTLY. A crop task is "sow in October". It is NOT
//    "sow at 09:00 on 12 October", and writing a DTSTART with a time would
//    invent a precision the agronomy does not have — the farmer would then be
//    late by a clock we made up. So every event is an ALL-DAY event
//    (DTSTART;VALUE=DATE, per RFC 5545 §3.8.2.4, never DATETIME), one day
//    long, on the FIRST of its month. The 1st is a marker for "this month",
//    not a claim about the day, and the DESCRIPTION says so in words. DTEND
//    is exclusive, so a one-day all-day event ends on the 2nd.
//
// 2. A REMINDER BEFORE, NOT ON THE DAY. A VALARM at -P3D fires three days
//    ahead — i.e. in the last days of the previous month — which is when a
//    farmer can still do something about it (fetch seed, book the tractor)
//    rather than being told on the morning it is already due.
//
// 3. STABLE UIDs, WITH NO DATE IN THEM. UID = the task's own id (which is
//    `${planting.id}:${action}` — stable across recomputation) plus a domain.
//    Re-importing the same export therefore UPDATES the events instead of
//    duplicating them. Deliberately NO year/month in the UID: if a farmer
//    moves a sowing from October to November and re-exports, a date-bearing
//    UID would leave the October event orphaned in their calendar forever,
//    whereas this way the existing event simply moves. LAST-MODIFIED and
//    DTSTAMP carry the "this is a newer version" signal.
//
// 4. NO RRULE. The plan repeats annually, so FREQ=YEARLY is tempting — but a
//    yearly-repeating event never stops, and this app tells the farmer to
//    re-run the planner every season with rotation on, which means next
//    year's October is deliberately NOT this year's October. A forever-repeat
//    would quietly become wrong. One dated occurrence per task, one year of
//    calendar, re-export when the plan changes.

import type { CropTask } from '@/lib/crop-plan';
import { cropByKey } from '@/lib/crop-catalog';
import { monthLong, resolveMonthYear, sowingInstruction, taskLine, taskTitle, wrapMonth } from '@/lib/crop-export-schedule';

const PRODID = '-//ImbewuField//Crop Plan//EN';
const UID_DOMAIN = 'imbewufield.app';
/** Days before the task's month starts that the farmer gets nudged. */
const ALARM_LEAD_DAYS = 3;

export interface IcsOptions {
  /** "Today" — decides which calendar year each month-only task lands in. Defaults to now. */
  now?: Date;
  /** DTSTAMP/LAST-MODIFIED for every event. Defaults to `now`; injectable so tests are deterministic. */
  stamp?: Date;
  /** Shown as the calendar name on import (X-WR-CALNAME). */
  calendarName?: string;
}

// ── Line-level RFC 5545 mechanics ───────────────────────────────────────────

/**
 * Escape a TEXT value: backslash first (or it would double-escape the
 * backslashes the later rules introduce), then the two list separators, then
 * real newlines into the literal two-character `\n` sequence.
 *
 * Colons and double quotes are NOT escaped — RFC 5545 §3.3.11 only lists
 * backslash, semicolon, comma and newline for TEXT, and escaping a colon
 * makes some parsers show a stray backslash to the farmer.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    // RFC 5545 §3.3.11 forbids CONTROL characters in a TEXT value (everything
    // in %x00-08 / %x0A-1F / %x7F except HTAB). A stray NUL or vertical tab out
    // of pasted data corrupts the file for every parser that reads it, so they
    // are dropped rather than smuggled through. Real newlines are already gone
    // by this point — the rule above turned them into a literal backslash-n.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

/** UTF-8 length of a single code point — folding is measured in OCTETS, not characters. */
function octetLength(codePoint: number): number {
  if (codePoint <= 0x7f) return 1;
  if (codePoint <= 0x7ff) return 2;
  if (codePoint <= 0xffff) return 3;
  return 4;
}

const MAX_OCTETS = 75;

/**
 * Fold a content line to 75 octets (RFC 5545 §3.1), continuation lines
 * starting with a single space.
 *
 * Two things this gets right that a naive `slice(0, 75)` does not:
 *  - it counts OCTETS, not JS characters. Crop names carry an emoji icon
 *    (🌽 is four octets) and bed labels carry 'ü' (Hügel, two) — a
 *    character-counted fold produces lines that are over the limit.
 *  - it iterates by CODE POINT, so an emoji's surrogate pair is never split
 *    down the middle into two invalid halves.
 * The leading space on a continuation line is itself an octet, so those lines
 * carry 74 octets of content.
 */
export function foldIcsLine(line: string): string {
  const pieces: string[] = [];
  let current = '';
  let used = 0;
  for (const ch of line) {
    const n = octetLength(ch.codePointAt(0) ?? 0);
    if (used + n > MAX_OCTETS) {
      pieces.push(current);
      current = '';
      used = 1; // the continuation line's leading space
    }
    current += ch;
    used += n;
  }
  pieces.push(current);
  return pieces.join('\r\n ');
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0');
}

/** `YYYYMMDD` — the DATE value form used by all-day events. */
export function icsDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}${pad(month)}${pad(day)}`;
}

/** `YYYYMMDDTHHMMSSZ` in UTC — DTSTAMP/LAST-MODIFIED. */
export function icsUtcTimestamp(d: Date): string {
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

/** Day after `YYYYMMDD`-style parts — the exclusive DTEND of a one-day all-day event. */
function nextDay(year: number, month: number, day: number): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

// ── Month number → real calendar date ───────────────────────────────────────

/**
 * Which YEAR a month-only task belongs to.
 *
 * The plan has no year field anywhere — it is a repeating annual cycle of
 * month numbers. Resolution is FORWARD-ONLY: the next occurrence of that month
 * on or after the current month. Sowing in March, exported in August, means
 * March NEXT year; sowing in October means October this year.
 *
 * The CURRENT month resolves to offset 0, i.e. this year — a task due "this
 * month" is due now, not in eleven months' time. Its event therefore lands on
 * the 1st, which may be a few days in the past; that is correct, and matches
 * what the app's own task list shows ("Aug: sow …" is live all month).
 *
 * Forward-only is also exactly how the on-screen task list resolves months
 * (its rolling window starts at the current month), including for the harvest
 * of an already-growing crop. The calendar and the screen agree by design.
 */
export function resolveTaskYear(month: number, now: Date): number {
  return resolveMonthYear(month, now);
}

/** The concrete all-day date for a month-precision task: the 1st of its resolved month. */
export function resolveTaskDate(month: number, now: Date): { year: number; month: number; day: number } {
  return { year: resolveTaskYear(month, now), month: wrapMonth(month), day: 1 };
}

// ── Event text ──────────────────────────────────────────────────────────────

/**
 * What the event says when the app is nowhere in sight. A calendar entry read
 * in five months has to answer, on its own: what am I doing, to which crop, on
 * which piece of ground, and how precise is this date really.
 */
export function icsDescription(task: CropTask): string {
  const lines: string[] = [`${taskLine(task)}.`];

  // A sow task already carries spacing inside taskLine; a transplant one does
  // not, and "where does this go" is the question at transplant time.
  if (task.action === 'transplant') {
    const crop = cropByKey(task.cropKey);
    if (crop) lines.push(`Move the tray seedlings into ${task.bedLabel} — ${sowingInstruction(crop)}.`);
  }

  lines.push(
    `Any time during ${monthLong(task.month)} is fine — this plan works in whole months, `
    + 'so the date on this entry is a marker for the month, not the exact day.',
  );
  lines.push('From your ImbewuField crop plan.');
  return lines.join('\n');
}

/** `${planting.id}:${action}` → a UID with no characters that would need escaping. */
export function icsUid(taskId: string): string {
  const safe = taskId.replace(/[^A-Za-z0-9._-]/g, '-');
  return `imbewu-crop-${safe}@${UID_DOMAIN}`;
}

// ── The file ────────────────────────────────────────────────────────────────

function push(out: string[], name: string, value: string): void {
  out.push(foldIcsLine(`${name}:${value}`));
}

function pushText(out: string[], name: string, value: string): void {
  push(out, name, escapeIcsText(value));
}

/**
 * The whole plan as one VCALENDAR. Deterministic: the same tasks + the same
 * `now`/`stamp` always produce byte-identical output, which is what makes
 * re-import an update rather than a pile of duplicates.
 */
export function buildCropPlanIcs(tasks: CropTask[], options: IcsOptions = {}): string {
  const now = options.now ?? new Date();
  const stamp = icsUtcTimestamp(options.stamp ?? now);
  const calendarName = options.calendarName ?? 'ImbewuField crop plan';

  const out: string[] = [];
  out.push('BEGIN:VCALENDAR');
  push(out, 'VERSION', '2.0');
  push(out, 'PRODID', PRODID);
  push(out, 'CALSCALE', 'GREGORIAN');
  // PUBLISH = "here are some events", not an invitation expecting a reply.
  push(out, 'METHOD', 'PUBLISH');
  // Non-standard, but Google and Apple both honour it: without a name the
  // import lands in a calendar called after the filename.
  pushText(out, 'X-WR-CALNAME', calendarName);
  pushText(out, 'X-WR-CALDESC', 'Ground prep, sowing, transplanting, weeding and harvest for the year ahead.');

  // Sorted by resolved date so the file reads chronologically if anyone opens
  // it in a text editor, and so the output order cannot depend on the order
  // tasksForPlan happened to return.
  const dated = tasks
    .map((task) => ({ task, date: resolveTaskDate(task.month, now) }))
    .sort((a, b) =>
      a.date.year - b.date.year
      || a.date.month - b.date.month
      || a.task.bedLabel.localeCompare(b.task.bedLabel)
      || a.task.id.localeCompare(b.task.id));

  for (const { task, date } of dated) {
    const end = nextDay(date.year, date.month, date.day);
    out.push('BEGIN:VEVENT');
    push(out, 'UID', icsUid(task.id));
    push(out, 'DTSTAMP', stamp);
    push(out, 'LAST-MODIFIED', stamp);
    push(out, 'DTSTART;VALUE=DATE', icsDate(date.year, date.month, date.day));
    push(out, 'DTEND;VALUE=DATE', icsDate(end.year, end.month, end.day));
    pushText(out, 'SUMMARY', `${task.icon} ${taskTitle(task)}`);
    pushText(out, 'DESCRIPTION', icsDescription(task));
    pushText(out, 'LOCATION', task.bedLabel);
    push(out, 'CATEGORIES', 'ImbewuField');
    // A whole-month gardening job must not make the farmer look busy all day
    // to anyone checking their availability.
    push(out, 'TRANSP', 'TRANSPARENT');
    out.push('BEGIN:VALARM');
    push(out, 'ACTION', 'DISPLAY');
    // Apple Calendar drops a DISPLAY alarm that has no DESCRIPTION.
    pushText(out, 'DESCRIPTION', taskTitle(task));
    push(out, 'TRIGGER', `-P${ALARM_LEAD_DAYS}D`);
    out.push('END:VALARM');
    out.push('END:VEVENT');
  }

  out.push('END:VCALENDAR');
  // CRLF between every line AND after the last one — RFC 5545 §3.1 wants the
  // final line terminated too, and some strict parsers drop END:VCALENDAR
  // without it.
  return `${out.join('\r\n')}\r\n`;
}

/** File-system-safe download name, same shape as the report export's. */
export function cropPlanIcsFilename(planTitle?: string, date = new Date()): string {
  const safe = (planTitle || 'Crop-plan')
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48) || 'Crop-plan';
  const stamp = Number.isNaN(date.getTime()) ? 'undated' : date.toISOString().slice(0, 10);
  return `ImbewuField-Crop-Plan-${safe}-${stamp}.ics`;
}
