// Root-owned additive checks, SOURCE REVIEWED / NOT EXECUTED in this lane.
// Real observation inspectors/filter/export builders and shipped FieldJournal
// through its existing renderer. That fixture mocks auth/storage and delivery;
// it is not proof of real account access, persistence or a downloaded file.
import assert from 'node:assert/strict';
import test from 'node:test';
import { act } from 'react-test-renderer';
import * as journal from '../lib/field-journal.ts';
import { filterJournalEntries } from '../lib/journal-view.ts';
import { buildJournalCsv, buildJournalHtml } from '../lib/journal-export.ts';
import { farmMemoryText } from '../lib/farm-memory-copy.ts';
import { mountJournal, renderedButton, renderedText } from './journal-workflow-renderer.ts';

const scope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } as const;
const link: journal.GrowerJournalLink = { version: 1, scope, plantingId: 'root-parent', bedId: 'root-bed',
  eventKind: 'nursery-start', plannedDate: '2028-02-01' };
const emptyRefs = { variety: null, seedLotReference: null, raisingBatchReference: null };
const heldRefs = { variety: 'private-held-variety', seedLotReference: 'private-held-lot', raisingBatchReference: 'private-held-batch' };
function entry(extra: Partial<journal.JournalEntryInput>, createdAt: number) {
  return journal.createJournalEntry({ date: '2028-02-02', title: 'Observed work', notes: 'Recorded engineering fixture.',
    category: 'planting', bedId: 'root-bed', bedLabel: 'Seedling bed', growerCycleLink: link, ...extra }, createdAt);
}

test('ROOT-B zero counts remain searchable while an unknown count never becomes a fabricated numeric or null match', async () => {
  const zeroSowing = entry({ nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: 0, references: emptyRefs } }, 1000);
  const zeroProgress = entry({ nurseryProgress: { kind: 'nursery-progress-observation', version: 1, stage: 'alive', coverage: 'checked-subset', plantsObserved: 0, references: emptyRefs } }, 2000);
  const unknownSowing = entry({ nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: null, references: emptyRefs } }, 3000);
  const entries = journal.normaliseJournal([zeroSowing, zeroProgress, unknownSowing]);
  const before = JSON.stringify(entries);
  assert.deepEqual(filterJournalEntries(entries, { query: '0' }).map(row => row.id).sort(), [zeroSowing.id, zeroProgress.id].sort());
  assert.equal(filterJournalEntries(entries, { query: 'null' }).length, 0);
  const app = await mountJournal({ entries });
  try {
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: '0' } }));
    await act(async () => renderedButton(app.renderer, 'CSV').props.onClick());
    await act(async () => renderedButton(app.renderer, farmMemoryText('en', 'printableCopy')).props.onClick());
    for (const exported of app.exports) assert.deepEqual(exported.entries.map(row => row.id).sort(), [zeroSowing.id, zeroProgress.id].sort());
    assert.deepEqual(app.exports.map(item => item.format), ['csv', 'html']);
    assert.equal(app.renderer.root.findAllByType('article').length, 2);
    assert.match(buildJournalCsv(app.exports[0].entries), /Observed/);
    assert.match(buildJournalHtml(app.exports[1].entries, { generatedAt: '2028-02-03T00:00:00Z' }), /Recorded nursery/);
  } finally { await app.close(); }
  assert.equal(JSON.stringify(entries), before, 'search and export must not mutate stored snapshots');
});

test('ROOT-B mixed, malformed, future and wrong-link evidence stays visibly held and its raw snapshot labels remain unindexed', async () => {
  const progress = { kind: 'nursery-progress-observation', version: 1, stage: 'alive', coverage: 'whole-batch', plantsObserved: 7, references: heldRefs };
  const sowing = { kind: 'nursery-sowing-observation', version: 1, traysUsed: 2, references: heldRefs };
  const entries = journal.normaliseJournal([
    entry({ nurseryProgress: { ...progress, plantsObserved: -1 } }, 1000),
    entry({ nurseryProgress: { ...progress, version: 99 } }, 2000),
    entry({ nurseryProgress: progress, growerCycleLink: { ...link, eventKind: 'field-entry' } }, 3000),
    entry({ nurseryProgress: progress, nurserySowing: sowing }, 4000),
  ]);
  for (const row of entries) assert.equal(journal.inspectJournalNurseryProgress(row).status, 'held');
  for (const query of Object.values(heldRefs)) assert.deepEqual(filterJournalEntries(entries, { query }), [], 'held payload values are not part of the search index');
  assert.equal(filterJournalEntries(entries, { query: 'Recorded engineering fixture' }).length, entries.length, 'ordinary notes remain searchable');
  assert.equal(filterJournalEntries(entries, { query: 'evidence needs review' }).length, entries.length);
  const csv = buildJournalCsv(entries), html = buildJournalHtml(entries, { generatedAt: '2028-02-03T00:00:00Z' });
  for (const value of Object.values(heldRefs)) { assert.ok(!csv.includes(value)); assert.ok(!html.includes(value)); }
  const app = await mountJournal({ entries });
  try {
    assert.match(renderedText(app.renderer.root), /Stored nursery count evidence needs review/);
    await act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value: 'private-held-lot' } }));
    assert.equal(app.renderer.root.findAllByType('article').length, 0);
  } finally { await app.close(); }
});

test('ROOT-B observed snapshots stay historical and intersect existing bed/date/category filters', () => {
  const refs = { variety: 'Ｃａｆé cultivar', seedLotReference: 'history-lot', raisingBatchReference: 'historic batch' };
  const row = entry({ nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: 1, references: refs } }, 1000);
  const before = JSON.stringify(row);
  const matching = { query: 'café history-lot', bed: 'id:root-bed', category: 'planting' as const, from: '2028-02-02', to: '2028-02-02' };
  assert.deepEqual(filterJournalEntries([row], matching).map(item => item.id), [row.id]);
  assert.deepEqual(filterJournalEntries([row], { ...matching, bed: 'id:other-bed' }), []);
  assert.deepEqual(filterJournalEntries([row], { ...matching, from: '2028-02-03', to: '2028-02-04' }), []);
  assert.deepEqual(filterJournalEntries([row], { ...matching, category: 'weather' }), []);
  assert.equal(JSON.stringify(row), before, 'no current-plan lookup or label rewrite is needed');
});
