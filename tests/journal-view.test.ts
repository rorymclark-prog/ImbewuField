import test from 'node:test';
import assert from 'node:assert/strict';
import type { JournalEntry } from '@/lib/field-journal';
import { filterJournalEntries, journalDateRangeError, journalFilterOptions } from '@/lib/journal-view';

function entry(id: string, overrides: Partial<JournalEntry> = {}): JournalEntry {
  return { id, date: '2026-10-12', title: 'Rain after planting', notes: 'The path stayed dry.', category: 'weather', createdAt: 1, updatedAt: 1, ...overrides };
}

test('a farmer can find an observation using words across its original note, bed and crop', () => {
  const rows = [entry('found', { title: 'CHECKED', notes: 'Leaves recovered\nafter rain', bedLabel: 'North bed', cropName: 'Spinach' }), entry('other')];
  assert.deepEqual(filterJournalEntries(rows, { query: '  spinach NORTH recovered  ' }).map(row => row.id), ['found']);
  assert.deepEqual(filterJournalEntries(rows, { query: 'nonexistent' }), []);
  assert.equal(filterJournalEntries(rows, { query: '\n\t' }).length, 2);
});

test('normalised Unicode search works without rewriting the saved words', () => {
  const rows = [entry('found', { title: 'Ｃｈｅｃｋｅｄ', notes: 'Cafe\u0301 recovered' })];
  assert.equal(filterJournalEntries(rows, { query: 'checked café' }).length, 1);
  assert.equal(rows[0].title, 'Ｃｈｅｃｋｅｄ');
});

test('date endpoints include both boundary days and intersect with every other filter', () => {
  const rows = [
    entry('before', { date: '2026-09-30' }),
    entry('first', { date: '2026-10-01', category: 'planting', bedId: 'a', cropName: 'Spinach' }),
    entry('last', { date: '2026-10-31', category: 'planting', bedId: 'a', cropName: 'Spinach' }),
    entry('other-bed', { category: 'planting', bedId: 'b', cropName: 'Spinach' }),
    entry('other-crop', { category: 'planting', bedId: 'a', cropName: 'Other' }),
    entry('other-category', { category: 'weather', bedId: 'a', cropName: 'Spinach' }),
    entry('after', { date: '2026-11-01' }),
  ];
  assert.deepEqual(filterJournalEntries(rows, { from: '2026-10-01', to: '2026-10-31', category: 'planting', bed: 'id:a', crop: 'Spinach' }).map(row => row.id), ['last', 'first']);
  assert.equal(filterJournalEntries(rows, { from: '2026-11-01' }).length, 1);
  assert.equal(filterJournalEntries(rows, { to: '2026-09-30' }).length, 1);
});

test('impossible or backwards date filters cannot silently export an unrestricted journal', () => {
  for (const filters of [{ from: '2026-02-30' }, { to: '2026-13-01' }, { from: 'yesterday' }, { from: '2026-10-02', to: '2026-10-01' }]) {
    assert.ok(journalDateRangeError(filters));
    assert.deepEqual(filterJournalEntries([entry('a')], filters), []);
  }
  assert.equal(journalDateRangeError({ from: '', to: '' }), null);
  assert.equal(journalDateRangeError({ from: '2024-02-29', to: '2024-02-29' }), null);
  assert.deepEqual(filterJournalEntries([entry('invalid', { date: '2026-02-30' })]), []);
});

test('a renamed or removed bed keeps its historic notes without merging a different bed of the same name', () => {
  const rows = [
    entry('old', { date: '2025-10-01', bedId: 'a', bedLabel: 'Bed 1' }),
    entry('new', { bedId: 'a', bedLabel: 'North bed' }),
    entry('different', { bedId: 'b', bedLabel: 'Bed 1' }),
    entry('free', { bedLabel: 'Bed 1' }),
  ];
  const options = journalFilterOptions(rows);
  assert.deepEqual(options.beds.find(option => option.value === 'id:a'), { value: 'id:a', label: 'North bed / Bed 1' });
  assert.equal(new Set(options.beds.map(option => option.label)).size, 3);
  assert.deepEqual(filterJournalEntries(rows, { bed: 'id:a' }).map(row => row.id), ['new', 'old']);
  assert.deepEqual(filterJournalEntries(rows, { bed: 'label:Bed 1' }).map(row => row.id), ['free']);
  assert.deepEqual(filterJournalEntries(rows, { bed: 'id:deleted' }), []);
});

test('crop options retain historical free text rather than depending on a current planting', () => {
  const rows = [entry('a', { cropName: 'Saved crop wording' }), entry('b', { cropName: 'Saved crop wording' }), entry('c', { cropName: 'Earlier crop' })];
  assert.deepEqual(journalFilterOptions(rows).crops, ['Earlier crop', 'Saved crop wording']);
  assert.equal(filterJournalEntries(rows, { crop: 'Saved crop wording' }).length, 2);
});

test('finding and sorting notes leaves the original entries, dates and photo order untouched', () => {
  const rows = [entry('early', { createdAt: 1, photos: ['first', 'second'] }), entry('later', { createdAt: 2 })];
  const before = structuredClone(rows);
  assert.deepEqual(filterJournalEntries(rows).map(row => row.id), ['later', 'early']);
  journalFilterOptions(rows);
  assert.deepEqual(rows, before);
  assert.deepEqual(journalFilterOptions([]), { beds: [], crops: [] });
});
