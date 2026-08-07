import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCropPlanIcs,
  cropPlanIcsFilename,
  escapeIcsText,
  foldIcsLine,
  icsUid,
  icsUtcTimestamp,
  resolveCropTaskDate,
  resolveTaskDate,
  resolveTaskYear,
} from '@/lib/crop-calendar-ics';
import { tasksForPlan, type CropTask, type PlanBed, type Planting } from '@/lib/crop-plan';

// ── A minimal, deliberately awkward parser ──────────────────────────────────
//
// Unfolds and splits the file the way a calendar client does, so the
// assertions below are about what a client SEES, not about the string we
// happened to build.

interface ParsedEvent {
  props: Map<string, string>;
  alarms: Map<string, string>[];
}

function unfold(ics: string): string[] {
  assert.ok(!/(?<!\r)\n/.test(ics), 'every line break must be CRLF, never a bare LF');
  const raw = ics.split('\r\n');
  const lines: string[] = [];
  for (const line of raw) {
    if (line.startsWith(' ') && lines.length) lines[lines.length - 1] += line.slice(1);
    else if (line !== '') lines.push(line);
  }
  return lines;
}

function parseIcs(ics: string): { calendar: Map<string, string>; events: ParsedEvent[] } {
  const calendar = new Map<string, string>();
  const events: ParsedEvent[] = [];
  let event: ParsedEvent | null = null;
  let alarm: Map<string, string> | null = null;

  for (const line of unfold(ics)) {
    if (line === 'BEGIN:VEVENT') { event = { props: new Map(), alarms: [] }; continue; }
    if (line === 'END:VEVENT') { events.push(event!); event = null; continue; }
    if (line === 'BEGIN:VALARM') { alarm = new Map(); continue; }
    if (line === 'END:VALARM') { event!.alarms.push(alarm!); alarm = null; continue; }
    if (line === 'BEGIN:VCALENDAR' || line === 'END:VCALENDAR') continue;
    const idx = line.indexOf(':');
    const name = line.slice(0, idx);
    const value = line.slice(idx + 1);
    if (alarm) alarm.set(name, value);
    else if (event) event.props.set(name, value);
    else calendar.set(name, value);
  }
  return { calendar, events };
}

/** The inverse of escapeIcsText — what a client does before showing text to a human. */
function unescapeIcsText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

function utf8Length(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const BEDS: PlanBed[] = [
  { id: 'bed-1', label: 'Bed 1', areaM2: 6, minDimM: 1.2 },
  { id: 'bed-2', label: 'Hügel 1', areaM2: 8, minDimM: 1.5 },
  { id: 'plot-1', label: 'Plot 1', areaM2: 400, kind: 'plot' },
];

const PLANTINGS: Planting[] = [
  { id: 'pl-a', bedId: 'bed-1', cropKey: 'carrots', sowMonth: 3 },
  { id: 'pl-b', bedId: 'bed-2', cropKey: 'onions', sowMonth: 4 },   // transplant: true
  // Groundnuts has verified duration and full field geometry. Grain maize is
  // deliberately legacy-only until those two facts are sourced for that crop.
  { id: 'pl-c', bedId: 'plot-1', cropKey: 'groundnuts', sowMonth: 10 },
  { id: 'pl-d', bedId: 'bed-1', cropKey: 'swiss-chard', sowMonth: 2, existing: true },
];

const NOW = new Date('2026-08-04T09:30:00Z');
const STAMP = new Date('2026-08-04T09:30:15Z');

function build(tasks = tasksForPlan(PLANTINGS, BEDS)): string {
  return buildCropPlanIcs(tasks, { now: NOW, stamp: STAMP });
}

// ── Escaping ────────────────────────────────────────────────────────────────

test('escapeIcsText escapes exactly the four RFC 5545 TEXT specials', () => {
  assert.equal(escapeIcsText('a,b'), 'a\\,b');
  assert.equal(escapeIcsText('a;b'), 'a\\;b');
  assert.equal(escapeIcsText('a\\b'), 'a\\\\b');
  assert.equal(escapeIcsText('a\nb'), 'a\\nb');
  assert.equal(escapeIcsText('a\r\nb'), 'a\\nb');
  assert.equal(escapeIcsText('a\rb'), 'a\\nb');
  // A colon is legal in a TEXT value — escaping it makes clients show a stray
  // backslash to the farmer.
  assert.equal(escapeIcsText('9:00'), '9:00');
});

test('escapeIcsText escapes the backslash BEFORE the specials it introduces', () => {
  // Wrong order double-escapes: "a,b" would become "a\\,b" (a literal
  // backslash then a comma), which a client renders as "a\,b".
  assert.equal(escapeIcsText('a\\,b'), 'a\\\\\\,b');
  assert.equal(unescapeIcsText(escapeIcsText('a\\,b')), 'a\\,b');
});

test('escapeIcsText round-trips a nasty real-world string', () => {
  const nasty = 'Sow beans, kale; and 100% "cover" \\ mulch\nthen water';
  assert.equal(unescapeIcsText(escapeIcsText(nasty)), nasty);
});

test('escapeIcsText drops control characters a TEXT value cannot carry', () => {
  assert.equal(escapeIcsText('a\u0000b\u0007c'), 'abc');
  // HTAB is explicitly allowed by the CONTROL production and is kept.
  assert.equal(escapeIcsText('a\tb'), 'a\tb');
});

// ── Folding ─────────────────────────────────────────────────────────────────

test('foldIcsLine leaves a short line alone', () => {
  assert.equal(foldIcsLine('SUMMARY:Sow carrots'), 'SUMMARY:Sow carrots');
});

test('foldIcsLine folds at 75 octets with a single-space continuation', () => {
  const folded = foldIcsLine(`DESCRIPTION:${'x'.repeat(200)}`);
  const segments = folded.split('\r\n');
  assert.ok(segments.length > 1, 'a 212-character line must fold');
  assert.equal(utf8Length(segments[0]), 75);
  for (const seg of segments.slice(1)) {
    assert.ok(seg.startsWith(' '), 'continuation lines start with a single space');
    assert.ok(utf8Length(seg) <= 75, `continuation line is ${utf8Length(seg)} octets`);
  }
  assert.equal(segments.map((s, i) => (i ? s.slice(1) : s)).join(''), `DESCRIPTION:${'x'.repeat(200)}`);
});

test('foldIcsLine counts OCTETS, not characters', () => {
  // 40 maize emoji = 160 octets but only 40 code points; a character-counted
  // fold would emit one 160-octet line and call it done.
  const line = `SUMMARY:${'🌽'.repeat(40)}`;
  for (const seg of foldIcsLine(line).split('\r\n')) {
    assert.ok(utf8Length(seg) <= 75, `segment is ${utf8Length(seg)} octets`);
  }
});

test('foldIcsLine never splits a surrogate pair', () => {
  const line = `SUMMARY:${'🌽'.repeat(40)}`;
  const folded = foldIcsLine(line);
  assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(folded), 'a high surrogate was orphaned by the fold');
  assert.ok(!/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(folded), 'a low surrogate was orphaned by the fold');
  assert.equal(folded.split('\r\n').map((s, i) => (i ? s.slice(1) : s)).join(''), line);
});

test('every line of a real export is within 75 octets', () => {
  for (const line of build().split('\r\n')) {
    assert.ok(utf8Length(line) <= 75, `line over the limit (${utf8Length(line)}): ${line}`);
  }
});

// ── Month → date mapping ────────────────────────────────────────────────────

test('resolveTaskYear maps a month already past to next year', () => {
  // "Today" is August 2026.
  assert.equal(resolveTaskYear(3, NOW), 2027, 'March is behind us — next March');
  assert.equal(resolveTaskYear(7, NOW), 2027, 'last month is a full cycle away');
  assert.equal(resolveTaskYear(10, NOW), 2026, 'October is still ahead this year');
  assert.equal(resolveTaskYear(12, NOW), 2026);
});

test('resolveTaskYear treats the CURRENT month as this year, not next', () => {
  assert.equal(resolveTaskYear(8, NOW), 2026, 'a task due this month is due now');
});

test('resolveTaskYear rolls the year over correctly from December', () => {
  const december = new Date('2026-12-20T00:00:00Z');
  assert.equal(resolveTaskYear(12, december), 2026);
  assert.equal(resolveTaskYear(1, december), 2027);
  assert.equal(resolveTaskYear(11, december), 2027);
});

test('resolveTaskDate puts the task on the FIRST of its month', () => {
  assert.deepEqual(resolveTaskDate(10, NOW), { year: 2026, month: 10, day: 1 });
  assert.deepEqual(resolveTaskDate(3, NOW), { year: 2027, month: 3, day: 1 });
});

test('a cohort harvest crossing a second year is dated after its own sowing', () => {
  const november = new Date('2026-11-06T09:00:00Z');
  const tasks = tasksForPlan([{
    id: 'next-september-beans',
    bedId: 'bed-1',
    cropKey: 'green-beans',
    sowMonth: 9,
  }], BEDS);
  const sow = tasks.find((task) => task.action === 'sow')!;
  const harvest = tasks.find((task) => task.action === 'harvest')!;

  assert.deepEqual(resolveCropTaskDate(sow, november), { year: 2027, month: 9, day: 1 });
  assert.deepEqual(resolveCropTaskDate(harvest, november), { year: 2027, month: 11, day: 1 });

  const { events } = parseIcs(buildCropPlanIcs(tasks, { now: november, stamp: STAMP }));
  const sowDate = events.find((event) => event.props.get('UID')!.includes('next-september-beans-sow'))!
    .props.get('DTSTART;VALUE=DATE');
  const harvestDate = events.find((event) => event.props.get('UID')!.includes('next-september-beans-harvest'))!
    .props.get('DTSTART;VALUE=DATE');
  assert.equal(sowDate, '20270901');
  assert.equal(harvestDate, '20271101');
  assert.ok(harvestDate! > sowDate!, 'the exported harvest must not predate its sowing');
});

test('a month-precision task becomes an all-day DATE event, never a DATETIME', () => {
  const { events } = parseIcs(build());
  for (const event of events) {
    assert.ok(event.props.has('DTSTART;VALUE=DATE'), 'DTSTART must carry VALUE=DATE');
    assert.ok(!event.props.has('DTSTART'), 'no bare DTSTART — that would be a made-up time of day');
    assert.match(event.props.get('DTSTART;VALUE=DATE')!, /^\d{8}$/);
    assert.match(event.props.get('DTSTART;VALUE=DATE')!, /01$/, 'events land on the 1st');
  }
});

test('DTEND is the exclusive next day, so the event is exactly one day long', () => {
  // Date arithmetic is the rule under test; an audited crop duration should
  // not make this fixture lose its October event.
  const octoberTask: CropTask[] = [{
    id: 'pl-oct:sow', plantingId: 'pl-oct', month: 10, bedLabel: 'Bed 1',
    cropName: 'Carrots', cropKey: 'carrots', icon: '🥕', action: 'sow',
  }];
  const { events } = parseIcs(buildCropPlanIcs(octoberTask, { now: NOW, stamp: STAMP }));
  const october = events.find((e) => e.props.get('DTSTART;VALUE=DATE') === '20261001');
  assert.ok(october, 'expected a task in October 2026');
  assert.equal(october.props.get('DTEND;VALUE=DATE'), '20261002');
});

test('DTEND rolls the month and the year over, not 20261232', () => {
  const decemberTask: CropTask[] = [{
    id: 'pl-x:sow', plantingId: 'pl-x', month: 12, bedLabel: 'Bed 1', cropName: 'Carrots', cropKey: 'carrots', icon: '🥕', action: 'sow',
  }];
  const { events } = parseIcs(buildCropPlanIcs(decemberTask, { now: NOW, stamp: STAMP }));
  assert.equal(events[0].props.get('DTSTART;VALUE=DATE'), '20261201');
  assert.equal(events[0].props.get('DTEND;VALUE=DATE'), '20261202');

  const janTask: CropTask[] = [{ ...decemberTask[0], month: 1 }];
  const nearYearEnd = new Date('2026-12-31T00:00:00Z');
  const { events: rolled } = parseIcs(buildCropPlanIcs(janTask, { now: nearYearEnd, stamp: STAMP }));
  assert.equal(rolled[0].props.get('DTSTART;VALUE=DATE'), '20270101');
  assert.equal(rolled[0].props.get('DTEND;VALUE=DATE'), '20270102');
});

// ── Calendar and event structure ────────────────────────────────────────────

test('the file is a well-formed VCALENDAR with the required properties', () => {
  const ics = build();
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'), 'the last line must be CRLF-terminated too');
  const { calendar, events } = parseIcs(ics);
  assert.equal(calendar.get('VERSION'), '2.0');
  assert.equal(calendar.get('PRODID'), '-//ImbewuField//Crop Plan//EN');
  assert.equal(calendar.get('CALSCALE'), 'GREGORIAN');
  assert.equal(calendar.get('METHOD'), 'PUBLISH');
  assert.ok(calendar.get('X-WR-CALNAME'));
  assert.ok(events.length > 0);
  // Every BEGIN has its END.
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, (ics.match(/END:VEVENT/g) ?? []).length);
  assert.equal((ics.match(/BEGIN:VALARM/g) ?? []).length, (ics.match(/END:VALARM/g) ?? []).length);
});

test('every event carries the properties a calendar client needs', () => {
  const { events } = parseIcs(build());
  for (const event of events) {
    for (const required of ['UID', 'DTSTAMP', 'DTSTART;VALUE=DATE', 'DTEND;VALUE=DATE', 'SUMMARY', 'DESCRIPTION']) {
      assert.ok(event.props.get(required), `missing ${required}`);
    }
    assert.match(event.props.get('DTSTAMP')!, /^\d{8}T\d{6}Z$/);
    assert.equal(event.props.get('TRANSP'), 'TRANSPARENT');
  }
});

test('every event has one VALARM a few days before, with the DESCRIPTION Apple requires', () => {
  const { events } = parseIcs(build());
  for (const event of events) {
    assert.equal(event.alarms.length, 1);
    assert.equal(event.alarms[0].get('ACTION'), 'DISPLAY');
    assert.equal(event.alarms[0].get('TRIGGER'), '-P3D');
    assert.ok(event.alarms[0].get('DESCRIPTION'), 'a DISPLAY alarm without a DESCRIPTION is dropped by Apple Calendar');
  }
});

test('one event per task, and the file covers every task the plan generates', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const { events } = parseIcs(build(tasks));
  assert.equal(events.length, tasks.length);
  assert.ok(tasks.length > 10, 'fixture should be big enough to be interesting');
});

test('UIDs are unique, stable and carry no date', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const uids = parseIcs(build(tasks)).events.map((e) => e.props.get('UID')!);
  assert.equal(new Set(uids).size, uids.length, 'duplicate UID — a re-import would collide two tasks into one');
  for (const uid of uids) {
    assert.match(uid, /^imbewu-crop-[A-Za-z0-9._-]+@imbewufield\.app$/);
    assert.ok(!/\d{8}/.test(uid), 'a date in the UID orphans the old event when a sow month changes');
  }
  assert.equal(icsUid('pl-abc:sow'), 'imbewu-crop-pl-abc-sow@imbewufield.app');
});

test('re-exporting the same plan produces identical UIDs, so a re-import updates', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  const first = parseIcs(buildCropPlanIcs(tasks, { now: NOW, stamp: STAMP })).events.map((e) => e.props.get('UID'));
  const later = new Date('2026-08-20T06:00:00Z');
  const second = parseIcs(buildCropPlanIcs(tasks, { now: later, stamp: later })).events.map((e) => e.props.get('UID'));
  assert.deepEqual(first, second);
});

test('moving a sowing to another month keeps the UID, so the event moves instead of duplicating', () => {
  const moved = PLANTINGS.map((p) => (p.id === 'pl-a' ? { ...p, sowMonth: 5 } : p));
  const before = parseIcs(build()).events.find((e) => e.props.get('UID')!.includes('pl-a-sow'))!;
  const after = parseIcs(build(tasksForPlan(moved, BEDS))).events.find((e) => e.props.get('UID')!.includes('pl-a-sow'))!;
  assert.equal(before.props.get('UID'), after.props.get('UID'));
  assert.notEqual(before.props.get('DTSTART;VALUE=DATE'), after.props.get('DTSTART;VALUE=DATE'));
});

test('the export is byte-for-byte deterministic for the same plan and clock', () => {
  const tasks = tasksForPlan(PLANTINGS, BEDS);
  assert.equal(buildCropPlanIcs(tasks, { now: NOW, stamp: STAMP }), buildCropPlanIcs(tasks, { now: NOW, stamp: STAMP }));
});

test('events are written in chronological order', () => {
  const { events } = parseIcs(build());
  const dates = events.map((e) => e.props.get('DTSTART;VALUE=DATE')!);
  assert.deepEqual(dates, [...dates].sort());
});

// ── What the farmer actually reads ──────────────────────────────────────────

test('the event text stands alone: action, crop and bed are all in the summary', () => {
  const { events } = parseIcs(build());
  const sowGroundnuts = events.find((e) => unescapeIcsText(e.props.get('SUMMARY')!).includes('Groundnuts'));
  assert.ok(sowGroundnuts, 'expected a supported groundnuts event');
  const summary = unescapeIcsText(sowGroundnuts.props.get('SUMMARY')!);
  assert.match(summary, /Groundnuts/);
  assert.match(summary, /Plot 1/, 'the bed/plot must be in the title — a calendar has no app beside it');
  assert.equal(unescapeIcsText(sowGroundnuts.props.get('LOCATION')!), 'Plot 1');
});

test('a prep task on a staple plot does not prescribe cultivation or manure without evidence', () => {
  const { events } = parseIcs(build());
  const prep = events.find((e) => e.props.get('UID')!.includes('pl-c-prep'))!;
  // Sentence-cased for standalone reading; the wording itself is tasksForPlan's.
  const description = unescapeIcsText(prep.props.get('DESCRIPTION')!);
  assert.match(description, /^Assess soil and drainage; use a soil test or local advice/i);
  assert.doesNotMatch(description, /plough|rip|manure|compost/i);
});

test('a sow event carries the spacing the farmer needs in the field', () => {
  const { events } = parseIcs(build());
  const sow = events.find((e) => e.props.get('UID')!.includes('pl-c-sow'))!;
  const description = unescapeIcsText(sow.props.get('DESCRIPTION')!);
  assert.match(description, /rows 30–45cm apart/);
  assert.match(description, /5–7\.5cm apart in the row/);
  assert.match(description, /sow 5–7\.5cm deep/);
});

test('every description says the date is a month marker, not an exact day', () => {
  const { events } = parseIcs(build());
  for (const event of events) {
    const description = unescapeIcsText(event.props.get('DESCRIPTION')!);
    assert.match(description, /whole months/);
    assert.match(description, /not the exact day/);
  }
});

test('descriptions survive escaping with their line breaks intact', () => {
  const { events } = parseIcs(build());
  for (const event of events) {
    assert.match(event.props.get('DESCRIPTION')!, /\\n/, 'multi-line descriptions must use the literal \\n escape');
    assert.ok(unescapeIcsText(event.props.get('DESCRIPTION')!).includes('\n'));
  }
});

// ── Odds and ends ───────────────────────────────────────────────────────────

test('an empty plan still produces a valid, empty calendar', () => {
  const ics = buildCropPlanIcs([], { now: NOW, stamp: STAMP });
  const { events } = parseIcs(ics);
  assert.equal(events.length, 0);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('icsUtcTimestamp is UTC and zero-padded', () => {
  assert.equal(icsUtcTimestamp(new Date('2026-01-02T03:04:05Z')), '20260102T030405Z');
});

test('the filename is file-system safe and dated', () => {
  assert.equal(
    cropPlanIcsFilename('Ubhejane Crèche / KZN', new Date('2026-08-04T00:00:00Z')),
    'ImbewuField-Crop-Plan-Ubhejane-Creche-KZN-2026-08-04.ics',
  );
  assert.match(cropPlanIcsFilename('', new Date('2026-08-04T00:00:00Z')), /Crop-Plan-Crop-plan-2026-08-04\.ics$/);
});
