import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowerTasksIcs, buildTaskIcs, type BoardTask } from '../lib/task-board.ts';

// These already-projected DTOs exercise the calendar boundary only. They are
// synthetic engineering dates/text, not source receipts, farm guidance or stock.
const clock = new Date('2031-06-01T12:34:56.000Z');
const stamp = '20310601T123456Z';
type Options = { now?: Date; sample?: boolean };
function task(index = 1, patch: Partial<BoardTask> = {}): BoardTask {
  return { id: `grower-cycle-v1-${index.toString(16).padStart(32, '0')}`, kind: 'grower-cycle',
    title: `Planned engineering event ${index}`, subtitle: 'Synthetic estimate only', icon: '',
    growerEventKind: 'field-entry', dueDate: '2028-02-29', dueMonth: 2, monthsAway: -40, completed: false, ...patch };
}
const build = (tasks: readonly BoardTask[], options: Options = { now: clock }) => buildGrowerTasksIcs(tasks, options);
const unfold = (value: string) => value.replace(/\r\n[ \t]/g, '');
function eventBodies(value: string): string[] {
  return [...unfold(value).matchAll(/(?:^|\r\n)BEGIN:VEVENT\r\n([\s\S]*?)\r\nEND:VEVENT(?=\r\n)/g)].map(match => match[1]);
}
function property(body: string, name: string): string {
  const values = body.split('\r\n').filter(line => line.startsWith(name + ':')).map(line => line.slice(name.length + 1));
  assert.equal(values.length, 1, `exactly one ${name} property is required`);
  return values[0];
}
function calendar(value: string, count: number): string[] {
  assert.ok(value.startsWith('BEGIN:VCALENDAR\r\n')); assert.ok(value.endsWith('END:VCALENDAR\r\n'));
  const lines = unfold(value).split('\r\n');
  for (const name of ['BEGIN:VCALENDAR', 'END:VCALENDAR']) assert.equal(lines.filter(line => line === name).length, 1);
  for (const name of ['BEGIN:VEVENT', 'END:VEVENT']) assert.equal(lines.filter(line => line === name).length, count);
  assert.doesNotMatch(value, /(?<!\r)\n|\r(?!\n)/, 'calendar content uses CRLF rather than bare line endings');
  assert.doesNotMatch(unfold(value), /(?:^|\r\n)(?:RRULE|RDATE|EXDATE|TRIGGER|DURATION|BEGIN:VALARM)(?::|;|\r\n)/);
  const events = eventBodies(value); assert.equal(events.length, count); return events;
}
function held(tasks: unknown, options: unknown = { now: clock }): void {
  assert.equal(buildGrowerTasksIcs(tasks as readonly BoardTask[], options as Options), '', 'unsafe selections must return no calendar, including no surviving partial events');
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

test('one calendar contains every represented event in caller order with one supplied timestamp', () => {
  const selected = [task(3, { dueDate: '2028-12-31' }), task(1), task(2, { dueDate: '2027-12-25' })];
  const output = build(selected), events = calendar(output, selected.length);
  assert.deepEqual(events.map(event => property(event, 'SUMMARY')), selected.map(item => item.title));
  assert.deepEqual(events.map(event => property(event, 'UID')), selected.map(item => `${item.id}@imbewufield.app`));
  assert.deepEqual(events.map(event => property(event, 'DTSTAMP')), selected.map(() => stamp));
  assert.match(property(unfold(output), 'X-WR-CALNAME'), /planned.*(?:work|date)|(?:work|date).*planned/i);
});

test('completed checklist items remain in the calendar without becoming observed or completed work', () => {
  const selected = [task(1, { completed: true }), task(2, { completed: false })];
  const events = calendar(build(selected), 2);
  for (const event of events) {
    assert.match(property(event, 'DESCRIPTION'), /planned cycle from your own estimates/);
    assert.match(property(event, 'DESCRIPTION'), /not recorded work/);
    assert.doesNotMatch(event, /(?:^|\r\n)(?:STATUS:COMPLETED|COMPLETED:|PERCENT-COMPLETE:)/);
  }
  assert.deepEqual(events.map(event => property(event, 'UID')), selected.map(item => `${item.id}@imbewufield.app`));
});

test('absolute UTC years, leap days and exclusive next days never borrow month-only metadata', () => {
  const dates = [['2027-12-31', '20271231', '20280101'], ['2028-02-29', '20280229', '20280301'],
    ['2028-12-31', '20281231', '20290101'], ['2011-12-30', '20111230', '20111231']] as const;
  const selected = dates.map(([date], index) => task(index + 1, { dueDate: date, dueMonth: 7, monthsAway: 1200 }));
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'Pacific/Apia';
    const events = calendar(build(selected), dates.length);
    assert.deepEqual(events.map(event => property(event, 'DTSTART;VALUE=DATE')), dates.map(row => row[1]));
    assert.deepEqual(events.map(event => property(event, 'DTEND;VALUE=DATE')), dates.map(row => row[2]));
    assert.doesNotMatch(unfold(build(selected)), /whole month|marker for the month|Any time during|TZID/);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('all existing grower event kinds remain independent events even when their dates coincide', () => {
  const kinds: NonNullable<BoardTask['growerEventKind']>[] = ['nursery-start', 'field-entry', 'first-pick', 'picking-end', 'field-clear', 'next-entry'];
  const selected = kinds.map((kind, index) => task(index + 1, { growerEventKind: kind }));
  assert.equal(calendar(build(selected), 6).length, 6);
});

test('normal bulk event bytes reuse the actual single-task event authority, including opaque UIDs', () => {
  const selected = [task(1), task(2, { dueDate: '2028-12-31', subtitle: 'Boundary; not recorded work' })];
  const events = calendar(build(selected), 2);
  assert.deepEqual(events, selected.map(item => eventBodies(buildTaskIcs(item, clock))[0]));
  assert.doesNotMatch(unfold(build(selected)), /demo-|DEMO/);
});

test('revising dates or displayed labels preserves normal event identity instead of orphaning the previous date', () => {
  const original = task(), revised = { ...original, dueDate: '2029-03-04', title: 'Revised engineering label', subtitle: 'Different display context' };
  const before = calendar(build([original]), 1)[0], after = calendar(build([revised]), 1)[0];
  assert.equal(property(before, 'UID'), property(after, 'UID'));
  assert.equal(property(after, 'DTSTART;VALUE=DATE'), '20290304');
  assert.notEqual(property(before, 'DTSTART;VALUE=DATE'), property(after, 'DTSTART;VALUE=DATE'));
});

test('demo files label the calendar and every event while using an identity namespace separate from real work', () => {
  const selected = [task(1), task(2, { completed: true })], output = build(selected, { now: clock, sample: true });
  const demo = calendar(output, 2), normal = calendar(build(selected), 2);
  assert.match(property(unfold(output), 'X-WR-CALNAME'), /DEMO/);
  for (let index = 0; index < demo.length; index++) {
    assert.equal(property(demo[index], 'UID'), 'demo-' + property(normal[index], 'UID'));
    assert.match(property(demo[index], 'SUMMARY'), /DEMO/); assert.match(property(demo[index], 'DESCRIPTION'), /DEMO/);
    assert.match(property(demo[index], 'DESCRIPTION'), /not recorded work/);
    assert.equal(property(demo[index], 'DTSTART;VALUE=DATE'), property(normal[index], 'DTSTART;VALUE=DATE'));
  }
  assert.deepEqual(selected.map(item => item.id), [task(1).id, task(2).id]);
});

test('empty or malformed collections cannot manufacture an empty-success or partial calendar', () => {
  for (const selected of [[], null, undefined, {}, 'tasks', [task(1), null], [undefined, task(1)], [task(1), false], [task(1), 7]]) held(selected);
  const hole = [task(1), task(2)]; delete hole[0]; held(hole);
});

test('duplicate identities hold the entire calendar even when dates, kinds or completion flags differ', () => {
  const first = task(1), second = task(2);
  for (const duplicate of [{ ...first }, { ...first, dueDate: '2029-01-01' },
    { ...first, growerEventKind: 'next-entry' as const, completed: true }]) {
    held([first, second, duplicate]); held([duplicate, second, first]);
  }
});

test('a missing, malformed or unrepresentable exact day refuses every event rather than dropping the invalid member', () => {
  const invalid = [undefined, null, '', '2027-02-29', '2028-2-29', '2028-02-29T00:00:00Z', '2028-02-30', '9999-12-31', '10000-01-01'];
  for (const dueDate of invalid) {
    const bad = { ...task(2), dueDate } as unknown as BoardTask;
    for (const selected of [[bad, task(1), task(3)], [task(1), bad, task(3)], [task(1), task(3), bad]]) held(selected);
  }
});

test('catalogue and unrelated task kinds cannot borrow the exact-date bulk export path', () => {
  for (const kind of ['crop', 'survey', 'lesson', '', 'GROWER-CYCLE', 'grower-cycle ', null, undefined]) {
    held([task(1), { ...task(2), kind }]);
  }
});

test('unknown or absent grower event kinds cannot be silently promoted into a valid schedule', () => {
  for (const growerEventKind of [undefined, null, '', 'harvest', 'field-entry ', 'FIELD-ENTRY', 0, {}]) {
    held([task(1), { ...task(2), growerEventKind }, task(3)]);
  }
});

test('raw private, malformed and noncanonical identifiers cannot become calendar UIDs', () => {
  for (const id of [undefined, null, '', 'private-planting-id', 'site:synthetic-private', 'grower-cycle-v1-' + 'a'.repeat(31),
    'grower-cycle-v1-' + 'a'.repeat(33), 'grower-cycle-v1-' + 'A'.repeat(32), 'grower-cycle-v1-' + 'g'.repeat(32),
    task(2).id + ' ', ' ' + task(2).id, task(2).id + '\r\nUID:injected', new String(task(2).id)]) {
    held([task(1), { ...task(2), id }]);
  }
});

test('bad title and subtitle types stay held without calling their coercion hooks', () => {
  let coercions = 0;
  const unsafe = { toString() { coercions++; throw Error('must not coerce'); }, valueOf() { coercions++; throw Error('must not coerce'); } };
  for (const title of ['', ' \t\n ', undefined, null, 0, false, unsafe, new String('Engineering title')]) {
    held([task(1), { ...task(2), title }]);
  }
  for (const subtitle of [undefined, null, 0, false, unsafe, new String('Engineering subtitle')]) {
    held([task(1), { ...task(2), subtitle }]);
  }
  assert.equal(coercions, 0);
});

test('an explicitly empty subtitle is legitimate free text rather than a missing exact date', () => {
  const event = calendar(build([task(1, { subtitle: '' })]), 1)[0];
  assert.equal(property(event, 'DTSTART;VALUE=DATE'), '20280229');
  assert.match(property(event, 'DESCRIPTION'), /planned cycle from your own estimates/);
});

test('unknown source and journal metadata never enters public event text or identity', () => {
  const clean = task(1);
  const cycle: { privateValue: string; self?: unknown } = { privateValue: 'private-unknown-source-marker' }; cycle.self = cycle;
  const withMetadata = { ...clean, privateSource: cycle, actorId: 'private-actor-marker',
    bedId: 'private-bed-marker', bedLabel: 'private-hidden-bed-label', cropKey: 'private-crop-marker', icon: 'private-icon-marker',
    growerJournalLink: { version: 1, scope: { kind: 'mapped-site', siteId: 'private-site-marker' },
      plantingId: 'private-planting-marker', bedId: 'private-bed-marker', eventKind: 'field-entry', plannedDate: clean.dueDate },
  } as unknown as BoardTask;
  assert.equal(build([withMetadata]), build([clean]));
  assert.doesNotMatch(unfold(build([withMetadata])), /private-|growerJournalLink|actorId|scope|plantingId/);
});

test('Unicode free text is escaped and folded without admitting injected events or splitting code points', () => {
  const title = 'Engineering, semicolon; slash\\colon: ' + 'ü🌱'.repeat(40);
  const subtitle = 'Line one\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:injected\ncomma, semi; slash\\';
  const output = build([task(1, { title, subtitle })]), event = calendar(output, 1)[0];
  assert.equal(property(event, 'SUMMARY'), 'Engineering\\, semicolon\\; slash\\\\colon: ' + 'ü🌱'.repeat(40));
  assert.ok(property(event, 'DESCRIPTION').includes('Line one\\nEND:VEVENT\\nBEGIN:VEVENT\\nUID:injected\\ncomma\\, semi\\; slash\\\\'));
  assert.equal(unfold(output).split('\r\n').filter(line => line.startsWith('UID:')).length, 1);
  assert.ok(output.includes('\r\n '), 'long non-ASCII free text must exercise real line folding');
  for (const line of output.split('\r\n')) {
    assert.ok(Buffer.byteLength(line, 'utf8') <= 75, 'folding limit is octets, including continuation whitespace');
    assert.equal(Buffer.from(line, 'utf8').toString('utf8'), line, 'a physical line must not contain an unpaired surrogate');
  }
});

test('supplied invalid clocks and nonboolean sample flags are held instead of silently selecting defaults', () => {
  for (const now of [new Date(NaN), null, '2031-06-01', 0, false, {}]) held([task(1)], { now });
  for (const sample of [null, 'false', 'true', 0, 1, {}, new Boolean(false)]) held([task(1)], { now: clock, sample });
  assert.equal(build([task(1)], { now: clock, sample: false }), build([task(1)]));
});

test('the default clock is captured once so slower construction cannot give different stamps to neighbouring events', () => {
  const OriginalDate = globalThis.Date, base = clock.getTime(); let captures = 0;
  class AdvancingDate extends OriginalDate {
    constructor(value?: string | number) {
      if (arguments.length === 0) super(base + captures++ * 1000);
      else super(value as string | number);
    }
    static now() { return base + captures++ * 1000; }
  }
  try {
    globalThis.Date = AdvancingDate as DateConstructor;
    const events = calendar(build([task(1), task(2), task(3)], {}), 3);
    assert.deepEqual(events.map(event => property(event, 'DTSTAMP')), [stamp, stamp, stamp]);
    assert.equal(captures, 1, 'the default timestamp is one captured clock, not an event-by-event clock read');
  } finally { globalThis.Date = OriginalDate; }
});

test('pure calendar construction leaves frozen task arrays, saved links, options and the caller clock unchanged without storage or network', () => {
  const selected = deepFreeze([task(1, { completed: true }), task(2)]);
  const options = Object.freeze({ now: clock, sample: false });
  const before = JSON.stringify(selected), clockBefore = clock.getTime(); let externalReads = 0;
  const names = ['window', 'document', 'localStorage', 'sessionStorage', 'fetch'];
  const descriptors = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, get() { externalReads++; throw Error('pure calendar must not touch external state'); } });
    assert.equal(calendar(buildGrowerTasksIcs(selected, options), 2).length, 2);
    assert.equal(calendar(buildGrowerTasksIcs(selected, { now: clock, sample: true }), 2).length, 2);
    assert.equal(JSON.stringify(selected), before); assert.equal(clock.getTime(), clockBefore); assert.equal(externalReads, 0);
    assert.equal(options.sample, false); assert.equal(options.now, clock);
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
    }
  }
});

test('the existing single grower event retains its exact envelope, UID, escaping, folded description and CRLF bytes', () => {
  const item = task(1, { id: 'grower-cycle-v1-' + '1'.repeat(32), title: 'Planned engineering event', subtitle: 'Synthetic estimate' });
  const expected = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ImbewuField//Task//EN', 'BEGIN:VEVENT',
    'UID:grower-cycle-v1-' + '1'.repeat(32) + '@imbewufield.app', 'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:20280229', 'DTEND;VALUE=DATE:20280301', 'SUMMARY:Planned engineering event',
    'DESCRIPTION:ImbewuField planned cycle from your own estimates\\; not recorde',
    ' d work — Synthetic estimate', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  assert.equal(buildTaskIcs(item, clock), expected);
});

test('the existing single catalogue event retains its month marker and original unfurled bytes', () => {
  const item: BoardTask = { id: 'crop;one', kind: 'crop', title: 'Engineering, label\\path\nnow', subtitle: 'Bed; synthetic, row\\2',
    icon: '', dueMonth: 1, monthsAway: 1, completed: false };
  const expected = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ImbewuField//Task//EN', 'BEGIN:VEVENT',
    'UID:crop\\;one@imbewufield.app', 'DTSTAMP:20261215T120000Z',
    'DTSTART;VALUE=DATE:20270101', 'DTEND;VALUE=DATE:20270102', 'SUMMARY:Engineering\\, label\\\\path\\nnow',
    'DESCRIPTION:ImbewuField crop plan — Bed\\; synthetic\\, row\\\\2', 'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
  assert.equal(buildTaskIcs(item, new Date('2026-12-15T12:00:00.000Z')), expected);
});

test('valid early UTC clock years retain four digits in every bulk timestamp without changing task dates', () => {
  for (const [now, expected] of [['0001-01-02T03:04:05.000Z', '00010102T030405Z'],
    ['0099-12-31T23:59:59.000Z', '00991231T235959Z']] as const) {
    const events = calendar(build([task(1), task(2)], { now: new Date(now) }), 2);
    assert.deepEqual(events.map(event => property(event, 'DTSTAMP')), [expected, expected]);
    assert.deepEqual(events.map(event => property(event, 'DTSTART;VALUE=DATE')), ['20280229', '20280229']);
  }
});

test('finite clocks outside the four-digit UTC year range hold the whole bulk calendar', () => {
  for (const value of ['0000-01-01T00:00:00.000Z', '+010000-01-01T00:00:00.000Z', '-000001-12-31T23:59:59.000Z']) {
    const now = new Date(value);
    assert.equal(Number.isFinite(now.getTime()), true, 'this control must exercise a finite extended-year clock rather than Invalid Date');
    held([task(1), task(2)], { now });
  }
});

test('explicit undefined optional values use the same captured-clock and normal-identity defaults as omitted options', () => {
  const selected = [task(1), task(2)], expected = build(selected, { now: clock, sample: false });
  assert.equal(build(selected, { now: clock, sample: undefined }), expected);
  const OriginalDate = globalThis.Date, base = clock.getTime();
  class FixedDate extends OriginalDate {
    constructor(value?: string | number) {
      if (arguments.length === 0) super(base);
      else super(value as string | number);
    }
    static now() { return base; }
  }
  try {
    globalThis.Date = FixedDate as DateConstructor;
    assert.equal(build(selected, {}), expected);
    assert.equal(build(selected, { now: undefined }), expected);
    assert.equal(build(selected, { now: undefined, sample: undefined }), expected);
  } finally { globalThis.Date = OriginalDate; }
});
