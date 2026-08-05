import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOURNAL_CATEGORIES,
  MAX_ENTRIES,
  MAX_PHOTOS_PER_ENTRY,
  createJournalEntry,
  daysBetween,
  editJournalEntry,
  formatJournalDate,
  groupJournalByMonth,
  isJournalDate,
  journalByteSize,
  journalSummary,
  monthLabelOf,
  normaliseJournal,
  recentJournalPhotos,
  removeJournalEntry,
  sortJournal,
  trimJournalForStorage,
  upsertJournalEntry,
  type JournalEntry,
} from '@/lib/field-journal';
import { buildDemoJournal, buildDemoStorageSeeds, buildDemoCropPlan, buildDemoDesignCanvasState } from '@/lib/demo-farm';

function entry(over: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: over.id ?? 'je_1',
    date: over.date ?? '2026-08-01',
    title: over.title ?? 'Cut chard',
    notes: over.notes ?? 'Outer leaves only.',
    category: over.category ?? 'harvest',
    bedId: over.bedId ?? null,
    bedLabel: over.bedLabel ?? null,
    cropName: over.cropName ?? null,
    photos: over.photos ?? [],
    createdAt: over.createdAt ?? 0,
    updatedAt: over.updatedAt ?? 0,
  };
}

/* ── Normalisation ───────────────────────────────────────────────────────── */

test('normaliseJournal drops everything it cannot trust', () => {
  const out = normaliseJournal([
    null,
    'not an object',
    42,
    { id: '', date: '2026-08-01', title: 'no id' },
    { id: 'a', date: '2026-13-01', title: 'impossible month' },
    { id: 'b', date: '2026-02-31', title: 'impossible day' },
    { id: 'c', date: '01/08/2026', title: 'wrong format' },
    { id: 'd', date: '2026-08-01', title: '   ', notes: '  ' }, // blank both sides
    { id: 'e', date: '2026-08-01', title: 'keeper', category: 'not-a-category' },
    { id: 'e', date: '2026-08-02', title: 'duplicate id' },
    { id: 'f', date: '2026-07-15', notes: 'notes only is enough' },
  ]);

  assert.deepEqual(out.map((e) => e.id), ['e', 'f']);
  assert.equal(out[0].category, 'other', 'an unknown category falls back to other, it does not drop the note');
  assert.equal(out[1].title, '', 'a notes-only entry survives with an empty title');
});

test('normaliseJournal trims, caps lengths and rejects non-image photo payloads', () => {
  const [out] = normaliseJournal([{
    id: 'x',
    date: '2026-08-01',
    title: `  ${'t'.repeat(400)}  `,
    notes: 'n'.repeat(5000),
    category: 'harvest',
    bedLabel: '  Bed 4  ',
    cropName: 12345,
    photos: ['data:image/jpeg;base64,AAA', 'javascript:alert(1)', 'https://example.com/a.jpg', 'data:image/png;base64,BBB', 'data:image/jpeg;base64,CCC', 'data:image/jpeg;base64,DDD'],
  }]);

  assert.equal(out.title.length, 120);
  assert.equal(out.notes.length, 2000);
  assert.equal(out.bedLabel, 'Bed 4');
  assert.equal(out.cropName, null, 'a non-string crop is dropped, not stringified');
  assert.equal(out.photos!.length, MAX_PHOTOS_PER_ENTRY);
  assert.ok(out.photos!.every((p) => p.startsWith('data:image/')), 'only data-image URLs survive');
});

test('normaliseJournal caps the list and keeps the newest entries', () => {
  const many = Array.from({ length: MAX_ENTRIES + 25 }, (_, i) => ({
    id: `id-${i}`,
    // i = 0 is the oldest day, so the highest i must survive.
    date: `2026-0${1 + Math.floor(i / 28) % 9}-${String((i % 28) + 1).padStart(2, '0')}`,
    title: `entry ${i}`,
  }));
  const out = normaliseJournal(many);
  assert.equal(out.length, MAX_ENTRIES);
  assert.ok(out[0].date >= out[out.length - 1].date, 'the survivors are the newest, still newest-first');
});

/* ── Ordering + grouping ─────────────────────────────────────────────────── */

test('sortJournal is newest-first by date, then by write time within a day', () => {
  const sorted = sortJournal([
    entry({ id: 'old', date: '2026-06-02' }),
    entry({ id: 'same-early', date: '2026-08-01', createdAt: 100 }),
    entry({ id: 'newest', date: '2026-09-01' }),
    entry({ id: 'same-late', date: '2026-08-01', createdAt: 900 }),
  ]);
  assert.deepEqual(sorted.map((e) => e.id), ['newest', 'same-late', 'same-early', 'old']);
});

test('groupJournalByMonth returns months newest-first with readable labels', () => {
  const groups = groupJournalByMonth([
    entry({ id: '1', date: '2026-06-30' }),
    entry({ id: '2', date: '2026-08-05' }),
    entry({ id: '3', date: '2026-08-01' }),
    entry({ id: '4', date: '2025-12-31' }),
  ]);

  assert.deepEqual(groups.map((g) => g.key), ['2026-08', '2026-06', '2025-12']);
  assert.deepEqual(groups.map((g) => g.label), ['August 2026', 'June 2026', 'December 2025']);
  assert.deepEqual(groups[0].entries.map((e) => e.id), ['2', '3'], 'entries inside a month stay newest-first');
  assert.equal(
    groups.reduce((n, g) => n + g.entries.length, 0), 4,
    'grouping never loses or duplicates an entry',
  );
});

test('month labels and date formatting do not drift with the local timezone', () => {
  // A date-only string parsed as local time lands on the previous day west of UTC.
  // formatJournalDate must read the string, not a Date built from it.
  assert.equal(formatJournalDate('2026-08-01'), 'Sat 1 Aug');
  assert.equal(formatJournalDate('2026-01-01'), 'Thu 1 Jan');
  assert.equal(monthLabelOf('2026-01'), 'January 2026');
  assert.equal(monthLabelOf('nonsense'), 'Undated');
  assert.equal(daysBetween('2026-07-30', '2026-08-05'), 6);
  assert.ok(isJournalDate('2026-02-28') && !isJournalDate('2026-02-30'));
});

/* ── Create / edit / delete ──────────────────────────────────────────────── */

test('createJournalEntry sanitises input and editJournalEntry keeps identity', () => {
  const created = createJournalEntry({
    date: 'yesterday-ish',
    title: '  Cut chard  ',
    notes: '  outer leaves  ',
    category: 'harvest',
    bedId: 'demo-bed-1',
    bedLabel: 'Bed 1',
    cropName: '',
  }, Date.UTC(2026, 7, 5));

  assert.ok(isJournalDate(created.date), 'an unusable date falls back to a real one');
  assert.equal(created.title, 'Cut chard');
  assert.equal(created.cropName, null, 'an empty crop is stored as null, not ""');

  const edited = editJournalEntry(created, {
    date: '2026-07-04', title: 'Cut chard again', notes: 'second cut',
    category: 'weather', bedId: null, bedLabel: null, cropName: null,
  }, Date.UTC(2026, 7, 9));

  assert.equal(edited.id, created.id, 'editing never mints a new id');
  assert.equal(edited.createdAt, created.createdAt, 'createdAt is the write date, it does not move');
  assert.ok(edited.updatedAt > created.updatedAt);
  assert.equal(edited.category, 'weather');
});

test('upsert replaces by id rather than duplicating, and remove deletes exactly one', () => {
  const a = entry({ id: 'a', date: '2026-08-01' });
  const b = entry({ id: 'b', date: '2026-08-02' });
  const list = upsertJournalEntry([a, b], { ...a, title: 'edited' });

  assert.equal(list.length, 2);
  assert.equal(list.find((e) => e.id === 'a')!.title, 'edited');
  assert.deepEqual(removeJournalEntry(list, 'a').map((e) => e.id), ['b']);
  assert.equal(removeJournalEntry(list, 'nope').length, 2, 'removing an unknown id is a no-op');
});

/* ── Summary + photo strip ───────────────────────────────────────────────── */

test('journalSummary counts the month and the gap since the last note', () => {
  const s = journalSummary([
    entry({ id: '1', date: '2026-08-04' }),
    entry({ id: '2', date: '2026-08-01' }),
    entry({ id: '3', date: '2026-06-11' }),
  ], '2026-08-05');

  assert.equal(s.total, 3);
  assert.equal(s.thisMonth, 2);
  assert.equal(s.daysSinceLast, 1);
  assert.equal(journalSummary([], '2026-08-05').daysSinceLast, null);
});

test('recentJournalPhotos walks newest-first and honours the limit', () => {
  const photos = recentJournalPhotos([
    entry({ id: 'old', date: '2026-06-01', photos: ['data:image/jpeg;base64,OLD'] }),
    entry({ id: 'new', date: '2026-08-01', photos: ['data:image/jpeg;base64,N1', 'data:image/jpeg;base64,N2'] }),
  ], 2);

  assert.deepEqual(photos.map((p) => p.src), ['data:image/jpeg;base64,N1', 'data:image/jpeg;base64,N2']);
});

/* ── Storage budget ──────────────────────────────────────────────────────── */

test('trimJournalForStorage sheds photos from the oldest entries before losing any words', () => {
  const bigPhoto = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
  const list = [
    entry({ id: 'newest', date: '2026-08-03', notes: 'keep me', photos: [bigPhoto] }),
    entry({ id: 'middle', date: '2026-08-02', notes: 'keep me too', photos: [bigPhoto] }),
    entry({ id: 'oldest', date: '2026-08-01', notes: 'keep me as well', photos: [bigPhoto] }),
  ];

  const trimmed = trimJournalForStorage(list, 9000);

  assert.deepEqual(trimmed.map((e) => e.id), ['newest', 'middle', 'oldest'], 'no entry is lost');
  assert.deepEqual(trimmed.map((e) => e.notes), ['keep me', 'keep me too', 'keep me as well']);
  assert.equal(trimmed[2].photos!.length, 0, 'the oldest entry loses its photo first');
  assert.equal(trimmed[0].photos!.length, 1, 'the newest entry keeps its photo');
  assert.ok(journalByteSize(trimmed) <= 9000);
});

test('trimJournalForStorage drops whole entries only when text alone still will not fit', () => {
  const list = Array.from({ length: 8 }, (_, i) => entry({
    id: `e-${i}`,
    date: `2026-08-0${i + 1}`,
    notes: 'x'.repeat(300),
    photos: [],
  }));
  const trimmed = trimJournalForStorage(list, 1200);
  assert.ok(trimmed.length < list.length);
  assert.ok(trimmed.length >= 1, 'it never empties the journal completely');
  assert.equal(trimmed[0].id, 'e-7', 'the newest entry is the last one standing');
});

test('a journal that already fits is returned untouched apart from ordering', () => {
  const list = [entry({ id: 'a', date: '2026-08-01' }), entry({ id: 'b', date: '2026-08-09' })];
  assert.deepEqual(trimJournalForStorage(list).map((e) => e.id), ['b', 'a']);
});

/* ── Demo seed ───────────────────────────────────────────────────────────── */

test('the demo journal survives its own normaliser and spans several months', () => {
  const demo = buildDemoJournal();
  const normalised = normaliseJournal(JSON.parse(JSON.stringify(demo)));

  assert.equal(normalised.length, demo.length, 'every seeded entry is valid on the way back in');
  assert.ok(demo.length >= 12, 'the demo timeline is full enough to scroll');
  assert.ok(groupJournalByMonth(normalised).length >= 3, 'the demo shows month grouping working');
  assert.equal(new Set(demo.map((e) => e.id)).size, demo.length, 'demo ids are unique');
  assert.ok(
    demo.every((e) => e.title.startsWith('Sample — ')),
    'every demo title carries the file-wide "Sample — " marker',
  );
  assert.ok(
    demo.every((e) => (e.photos?.length ?? 0) === 0),
    'the demo invents no ground-level photos of the real creche',
  );
});

test('demo journal beds and crops match the demo design canvas and crop plan', () => {
  const demo = buildDemoJournal();
  const canvasBedIds = new Set(buildDemoDesignCanvasState().items.map((i) => i.id));
  const canvasLabels = new Map(
    buildDemoDesignCanvasState().items.map((i) => [i.id, i.label]),
  );
  const plannedBedIds = new Set(buildDemoCropPlan().plantings.map((p) => p.bedId));

  const tagged = demo.filter((e) => e.bedId);
  assert.ok(tagged.length >= 6, 'a useful share of the demo notes are tied to a bed');
  for (const e of tagged) {
    assert.ok(canvasBedIds.has(e.bedId!), `${e.bedId} is a real design-canvas item`);
    assert.ok(plannedBedIds.has(e.bedId!), `${e.bedId} is a bed the crop plan actually plants`);
    assert.equal(e.bedLabel, canvasLabels.get(e.bedId!), 'the stored label matches the canvas label');
  }
});

test('every demo journal category is one the UI can render', () => {
  const known = new Set(JOURNAL_CATEGORIES.map((c) => c.key));
  for (const e of buildDemoJournal()) assert.ok(known.has(e.category), `${e.category} has a chip`);
});

test('the sample-mode storage seed carries the journal under the real storage key', () => {
  const seeds = buildDemoStorageSeeds();
  assert.ok(Object.hasOwn(seeds, 'imbewu_field_journal_v1'));
  const parsed = normaliseJournal(JSON.parse(seeds.imbewu_field_journal_v1));
  assert.deepEqual(parsed.map((e) => e.id).sort(), buildDemoJournal().map((e) => e.id).sort());
});
