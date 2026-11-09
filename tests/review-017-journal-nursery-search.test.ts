// REVIEW-017 additive repro (scratch only, not part of the frozen candidate).
// Mounts the shipped FieldJournal through the existing journal-workflow-renderer
// fixture: real FieldJournal handlers, real lib/journal-view filtering, real
// nursery summary components and real entry creation/normalisation. Bounded as
// that fixture already discloses: journal load/save, export delivery and auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { act } from 'react-test-renderer';
import * as journal from '../lib/field-journal.ts';
import { buildJournalCsv } from '../lib/journal-export.ts';
import { mountJournal as mount, renderedText as text, renderedButton as button } from './journal-workflow-renderer.ts';

// Synthetic engineering fixture: identifiers, dates and counts are not farming data.
const scope = { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' };
const start: journal.GrowerJournalLink = { version: 1, scope: scope as journal.GrowerJournalLink['scope'], plantingId: 'review-planting', bedId: 'review-bed', eventKind: 'nursery-start', plannedDate: '2028-02-01' };
const entry: journal.GrowerJournalLink = { ...start, eventKind: 'field-entry', plannedDate: '2028-02-09' };
const references = { variety: 'Review variety label', seedLotReference: 'R017-LOT-7', raisingBatchReference: 'Review raising label' };
const base = (date: string, title: string): journal.JournalEntryInput => ({ date, title, notes: 'Synthetic grower note.', category: 'planting', bedId: 'review-bed', bedLabel: 'Review bed' });
function rows() {
  const sowing = journal.createJournalEntry({ ...base('2028-02-02', 'Nursery sowing'), growerCycleLink: start,
    nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: 0, references } }, 1000);
  const progress = journal.createJournalEntry({ ...base('2028-02-05', 'Nursery count'), growerCycleLink: start,
    nurseryProgress: { kind: 'nursery-progress-observation', version: 1, plantsObserved: 31, stage: 'alive', coverage: 'checked-subset', references } }, 2000);
  const planting = journal.createJournalEntry({ ...base('2028-02-09', 'Field planting'), growerCycleLink: entry,
    nurseryFieldPlanting: { kind: 'nursery-field-planting-observation', version: 1, plantsPlanted: 29, references } }, 3000);
  // Held control: same label in a malformed payload must never become searchable.
  const held = journal.createJournalEntry({ ...base('2028-02-03', 'Nursery sowing'), growerCycleLink: start,
    nurserySowing: { kind: 'nursery-sowing-observation', version: 1, traysUsed: -1, references } }, 4000);
  const loaded = journal.normaliseJournal([sowing, progress, planting, held]);
  return { loaded, ids: { sowing: loaded.find(r => r.title === 'Nursery sowing' && journal.inspectJournalNurserySowing(r).status === 'observed')!.id,
    progress: loaded.find(r => r.title === 'Nursery count')!.id, planting: loaded.find(r => r.title === 'Field planting')!.id,
    held: loaded.find(r => r.title === 'Nursery sowing' && journal.inspectJournalNurserySowing(r).status === 'held')!.id } };
}
const search = async (app: Awaited<ReturnType<typeof mount>>, value: string) =>
  act(async () => app.renderer.root.findByProps({ type: 'search' }).props.onChange({ target: { value } }));
const articleIds = (app: Awaited<ReturnType<typeof mount>>) => app.renderer.root.findAllByType('article').length;

test('fixture integrity: each observation inspects as intended through the real inspectors', () => {
  const { loaded, ids } = rows(); const by = (id: string) => loaded.find(r => r.id === id)!;
  assert.equal(journal.inspectJournalNurserySowing(by(ids.sowing)).status, 'observed');
  assert.equal(journal.inspectJournalNurseryProgress(by(ids.progress)).status, 'observed');
  assert.equal(journal.inspectJournalNurseryFieldPlanting(by(ids.planting)).status, 'observed');
  assert.equal(journal.inspectJournalNurserySowing(by(ids.held)).status, 'held');
});

test('R-B1 the batch seed-lot label shown on sowing and count cards finds every observation of that batch, and the filtered CSV carries them', async () => {
  const { loaded, ids } = rows();
  const app = await mount({ entries: loaded });
  try {
    // Unfiltered, the real summary components display the lot on each observed card.
    const all = text(app.renderer.root);
    assert.match(all, /Recorded nursery sowing/); assert.match(all, /Recorded nursery plant count/); assert.match(all, /R017-LOT-7/);
    await search(app, 'r017-lot-7');
    await act(async () => button(app.renderer, 'CSV').props.onClick());
    const exported = app.exports.at(-1)!.entries.map(row => row.id).sort();
    assert.deepEqual(exported, [ids.sowing, ids.progress, ids.planting].sort(),
      `search/export for the batch label returned ${JSON.stringify(exported)}; sowing=${ids.sowing} progress=${ids.progress} planting=${ids.planting}`);
    assert.equal(articleIds(app), 3);
    const csv = buildJournalCsv(app.exports.at(-1)!.entries);
    assert.equal(csv.split('R017-LOT-7').length - 1 >= 3, true, 'each exported observation carries its snapshot label');
  } finally { await app.close(); }
});

test('R-B2 an explicit observed count is searchable for sowing/count entries as it already is for field planting', async () => {
  const { loaded, ids } = rows();
  const app = await mount({ entries: loaded });
  try {
    await search(app, '31');
    assert.equal(articleIds(app), 1, 'the entered count 31 must find its count observation');
    await act(async () => button(app.renderer, 'CSV').props.onClick());
    assert.deepEqual(app.exports.at(-1)?.entries.map(row => row.id), [ids.progress]);
  } finally { await app.close(); }
});

test('R-B-NC1 negative control: field planting stays searchable by its snapshot label and count (existing behaviour)', async () => {
  const { loaded, ids } = rows();
  const app = await mount({ entries: loaded });
  try {
    await search(app, '29 r017-lot-7');
    await act(async () => button(app.renderer, 'CSV').props.onClick());
    assert.deepEqual(app.exports.at(-1)!.entries.map(row => row.id), [ids.planting]);
  } finally { await app.close(); }
});

test('R-B-NC2 negative control: a held (malformed) payload never exposes its raw label to search', async () => {
  const { loaded, ids } = rows();
  const app = await mount({ entries: loaded });
  try {
    await search(app, 'r017-lot-7');
    await act(async () => button(app.renderer, 'CSV').props.onClick());
    assert.equal(app.exports.at(-1)!.entries.some(row => row.id === ids.held), false);
  } finally { await app.close(); }
});

test('R-B-NC3 negative control: ordinary note text still matches every entry and unrelated words match none', async () => {
  const { loaded } = rows();
  const app = await mount({ entries: loaded });
  try {
    await search(app, 'synthetic grower note');
    assert.equal(articleIds(app), 4);
    await search(app, 'no-such-review-word');
    assert.equal(articleIds(app), 0);
  } finally { await app.close(); }
});
