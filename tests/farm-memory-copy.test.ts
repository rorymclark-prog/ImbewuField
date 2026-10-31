import test from 'node:test';
import assert from 'node:assert/strict';
import { JOURNAL_CATEGORIES, type JournalEntry } from '@/lib/field-journal';
import { FARM_MEMORY_EN, FARM_MEMORY_ZU, farmMemoryCategoryLabel, farmMemoryText, type FarmMemoryKey } from '@/lib/farm-memory-copy';
import { journalCategoryLabel } from '@/components/journal/journal-labels';
import { filterJournalEntries, journalBedFilterValue, journalDateRangeError, journalFilterOptions } from '@/lib/journal-view';

const placeholders = (value: string) => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();

test('every Farm memory control and saved-copy label has an isiZulu draft with the same data slots', () => {
  assert.deepEqual(Object.keys(FARM_MEMORY_ZU).sort(), Object.keys(FARM_MEMORY_EN).sort());
  for (const key of Object.keys(FARM_MEMORY_EN) as FarmMemoryKey[]) {
    assert.ok(FARM_MEMORY_ZU[key].trim().length > 0, `${key}: isiZulu must not be blank`);
    assert.deepEqual(placeholders(FARM_MEMORY_ZU[key]), placeholders(FARM_MEMORY_EN[key]), `${key}: counts and original labels remain usable`);
    if (key !== 'csv') assert.notEqual(FARM_MEMORY_ZU[key], FARM_MEMORY_EN[key], `${key}: English must not masquerade as an isiZulu translation`);
    assert.equal(farmMemoryText('zu', key), FARM_MEMORY_ZU[key]);
    assert.equal(farmMemoryText('en', key), FARM_MEMORY_EN[key]);
  }
});

test('translated controls retain a farmer label literally, including braces and replacement symbols', () => {
  const original = 'Bed {n} $& $1';
  assert.equal(farmMemoryText('zu', 'bedHistory', { value: original }), `Bonisa umlando wejenali wombhede: ${original}`);
  assert.equal(farmMemoryText('zu', 'recordedGroup', { label: original, n: 2 }), `${original} (iqembu eliqoshiwe 2)`);
  assert.equal(farmMemoryText('xh', 'clearFilters'), FARM_MEMORY_EN.clearFilters, 'a language without this draft keeps an explicit English fallback');
});

test('isiZulu category names have one authority across the journal controls and exported copies', () => {
  for (const category of JOURNAL_CATEGORIES) {
    assert.equal(farmMemoryCategoryLabel('en', category.key), category.label);
    assert.equal(farmMemoryCategoryLabel('zu', category.key), journalCategoryLabel(category.key));
    assert.notEqual(farmMemoryCategoryLabel('zu', category.key), category.label);
  }
  assert.equal(farmMemoryCategoryLabel('zu', 'harvest'), 'Ukuvuna');
});

test('isiZulu dates explain an invalid range without changing filtering or the recorded bed identity', () => {
  assert.equal(journalDateRangeError({ from: '2026-02-30' }, 'zu'), FARM_MEMORY_ZU.invalidStart);
  assert.equal(journalDateRangeError({ to: 'not a date' }, 'zu'), FARM_MEMORY_ZU.invalidEnd);
  assert.equal(journalDateRangeError({ from: '2026-10-29', to: '2026-10-01' }, 'zu'), FARM_MEMORY_ZU.invalidRange);
  assert.equal(journalDateRangeError({ from: '2024-02-29', to: '2024-02-29' }, 'zu'), null);
  assert.equal(journalBedFilterValue({ bedId: 'same-id', bedLabel: 'Original label' }), 'id:same-id');
  assert.equal(journalBedFilterValue({ bedLabel: 'Original label' }), 'label:Original label');
  assert.equal(journalBedFilterValue({}), null);
});

test('isiZulu filter labels retain old names, distinguish duplicate names and never translate a farmer crop tag', () => {
  const rows: JournalEntry[] = ['first-id', 'second-id'].map(id => ({ id, bedId: id, bedLabel: 'Original wording', cropName: 'My crop wording', date: '2026-10-29', title: 'My note', notes: '', category: 'other', createdAt: 0, updatedAt: 0 }));
  rows.push({ ...rows[0], id: 'unnamed', bedId: 'unnamed', bedLabel: null });
  const before = structuredClone(rows);
  const options = journalFilterOptions(rows, 'zu');
  assert.deepEqual(options.crops, ['My crop wording']);
  assert.ok(options.beds.some(option => option.label === FARM_MEMORY_ZU.unnamedBed));
  assert.ok(options.beds.some(option => option.label === 'Original wording (iqembu eliqoshiwe 1)'));
  assert.ok(options.beds.some(option => option.label === 'Original wording (iqembu eliqoshiwe 2)'));
  assert.deepEqual(filterJournalEntries(rows, { bed: 'id:first-id' }).map(row => row.id), ['first-id']);
  assert.deepEqual(rows, before);
});

test('isiZulu UI copy marks the language draft and keeps a planned task separate from saved field evidence', () => {
  assert.match(FARM_MEMORY_ZU.draftNotice, /uhlaka olungakabuyekezwa/);
  assert.match(FARM_MEMORY_EN.draftNotice, /unreviewed draft/);
  assert.match(FARM_MEMORY_EN.taskDraftNotice, /does not record a harvest quantity or mark the task complete/);
  assert.match(FARM_MEMORY_ZU.taskDraftNotice, /akurekhodi inani lesivuno noma kuphawule umsebenzi njengoqediwe/);
});
