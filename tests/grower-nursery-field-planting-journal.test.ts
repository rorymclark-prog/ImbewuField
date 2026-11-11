import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import type { GrowerJournalLink, JournalEntry, JournalEntryInput, JournalNurseryFieldPlantingObservation } from '../lib/field-journal.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// The real journal/cutover/saver run; only browser storage, auth and Web Locks
// are controlled. Synthetic counts are engineering fixtures, not grower advice.
const fixture = await import('./international-grower-operations-fixture.ts');
const journal = await import('../lib/field-journal.ts');
const storage = await import('../lib/journal-storage.ts');
const { local, account } = fixture;
const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
class Locks implements JournalStorageLocks {
  held = new Set<string>();
  async request<T>(name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown | null) => T | PromiseLike<T>): Promise<T> {
    await Promise.resolve();
    if (this.held.has(name)) return await run(null);
    this.held.add(name); try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const loaded = new Set<JournalEntry[]>();
const load = () => { const entries = journal.loadJournal(); loaded.add(entries); return entries; };
const key = () => account.activeAccountLocalStorageKey(storage.JOURNAL_STORAGE_KEY);
const legacyKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_LEGACY_KEY);
const rawRows = () => JSON.parse(JSON.parse(local.rows.get(key())!).journalRaw) as Record<string, unknown>[];
async function ready(entries: unknown[]) {
  local.rows.set(legacyKey(), JSON.stringify(entries));
  const result = await storage.initialiseJournalStorage(); assert.equal(result.writable, true, result.reason);
}
const link: GrowerJournalLink = { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'historical-accepted-planting', bedId: 'historical-bed', eventKind: 'field-entry', plannedDate: '2028-02-01' };
function payload(plantsPlanted = 0): JournalNurseryFieldPlantingObservation {
  return { kind: 'nursery-field-planting-observation', version: 1, plantsPlanted,
    references: { variety: 'Entered variety', seedLotReference: 'Entered lot', raisingBatchReference: 'Entered raising label' } };
}
const legacyInput = (): JournalEntryInput => ({ date: '2028-02-09', title: 'Field planting', notes: 'An explicit observed quantity.',
  category: 'planting', bedId: link.bedId, photos: ['data:image/png;base64,AAAA'] });
function planting(value: unknown = payload()) {
  return journal.createJournalEntry({ ...legacyInput(), growerCycleLink: structuredClone(link), nurseryFieldPlanting: value }, 1000);
}
const sowing = () => ({ kind: 'nursery-sowing-observation', version: 1, traysUsed: 2, references: payload().references });
const progress = () => ({ kind: 'nursery-progress-observation', version: 1, plantsObserved: 2, stage: 'alive', coverage: 'checked-subset', references: payload().references });
function observed(entry: unknown) {
  const result = journal.inspectJournalNurseryFieldPlanting(entry); assert.equal(result.status, 'observed');
  if (result.status !== 'observed') throw Error('Fixture must inspect'); return result.observation;
}
beforeEach(async () => {
  for (const entries of loaded) journal.releaseJournalRead(entries); loaded.clear();
  storage.releaseAllDocumentJournalLeases(); await Promise.resolve(); await fixture.reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
});
after(() => {
  for (const entries of loaded) journal.releaseJournalRead(entries);
  storage.releaseAllDocumentJournalLeases(); fixture.cleanup();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
});

test('explicit field-planting zero is a dated entered quantity, never missing, establishment, stock or a computed survival rate', () => {
  for (const count of [0, 7, Number.MAX_SAFE_INTEGER]) {
    const entry = planting(payload(count)); assert.deepEqual(observed(entry), payload(count));
    assert.equal(entry.date, '2028-02-09'); assert.equal((entry.growerCycleLink as GrowerJournalLink).plannedDate, '2028-02-01');
    assert.deepEqual(Object.keys(observed(entry)).sort(), ['kind', 'plantsPlanted', 'references', 'version']);
    for (const key of ['established', 'stock', 'survivalPercent', 'germinationPercent', 'completed', 'sowingEntryId', 'progressEntryId']) {
      assert.equal(Object.hasOwn(entry, key), false); assert.equal(Object.hasOwn(observed(entry), key), false);
    }
  }
});

test('blank, coerced, fractional, missing and unsafe quantities or extra payload fields cannot turn into observed zero', () => {
  for (const count of [undefined, null, '', '0', true, false, .5, -1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []])
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation({ ...payload(), plantsPlanted: count }), null);
  for (const value of [undefined, null, [], {}, { ...payload(), kind: 'nursery-progress-observation' }, { ...payload(), version: 99 },
    { ...payload(), stock: 0 }, { ...payload(), sowingEntryId: 'invented-backlink' }])
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation(value), null);
  for (const key of Object.keys(payload())) {
    const missing: Record<string, unknown> = { ...payload() }; delete missing[key];
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation(missing), null);
    const hidden = { ...payload() }; Object.defineProperty(hidden, key, { value: hidden[key as keyof typeof hidden], enumerable: false });
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation(hidden), null);
  }
});

test('all three nursery observations use the same exact nullable reference shape and detached immutable snapshots', () => {
  const references = { variety: '  Exact entered label  ', seedLotReference: null, raisingBatchReference: 'Λот / 批次' };
  const original = { ...payload(), references }, result = journal.normaliseJournalNurseryFieldPlantingObservation(original);
  assert.deepEqual(result, original); assert.notEqual(result, original); assert.notEqual(result?.references, references);
  assert.equal(Object.isFrozen(result), true); assert.equal(Object.isFrozen(result?.references), true);
  references.variety = 'Later label'; assert.equal(result?.references.variety, '  Exact entered label  ');
  for (const field of ['variety', 'seedLotReference', 'raisingBatchReference'] as const) {
    for (const label of [undefined, '', ' ', 'x'.repeat(121), 'a\nb', 'a\0b', 'a\u007fb', 0, {}, []]) {
      const refs = { ...payload().references, [field]: label };
      assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation({ ...payload(), references: refs }), null);
      assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...progress(), references: refs }), null);
      assert.equal(journal.normaliseJournalNurserySowingObservation({ ...sowing(), references: refs }), null);
    }
  }
});

test('historical planting requires a structural field-entry link and consistent bed without requiring a surviving crop plan', () => {
  const entry = planting(); assert.equal(fixture.crop.loadCropPlan().plantings.length, 0); assert.deepEqual(observed(entry), payload());
  for (const changed of [undefined, null, { ...link, eventKind: 'nursery-start' }, { ...link, eventKind: 'first-pick' }, { ...link, plannedDate: 'not-a-date' }]) {
    const candidate = planting(); if (changed === undefined) delete candidate.growerCycleLink; else candidate.growerCycleLink = changed;
    assert.equal(journal.inspectJournalNurseryFieldPlanting(candidate).status, 'held');
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([candidate])), null);
  }
  assert.equal(journal.inspectJournalNurseryFieldPlanting({ ...entry, bedId: 'another-bed' }).status, 'held');
});

test('mixed typed presences hold their own inspectors while absent schema stays legacy without inventing new evidence', () => {
  const fields = ['nurserySowing', 'nurseryProgress', 'nurseryFieldPlanting'] as const;
  const values = [sowing(), progress(), payload()];
  for (const selected of [[0, 1], [0, 2], [1, 2], [0, 1, 2]]) for (const second of ['valid', 'null', 'undefined', 'future']) {
    const entry: JournalEntry = journal.createJournalEntry({ ...legacyInput(), growerCycleLink: link }, 1000);
    selected.forEach((index, position) => { entry[fields[index]] = position === 1
      ? second === 'null' ? null : second === 'undefined' ? undefined : second === 'future' ? { version: 99, keep: [0, false] } : values[index]
      : values[index]; });
    const inspectors = [journal.inspectJournalNurserySowing, journal.inspectJournalNurseryProgress, journal.inspectJournalNurseryFieldPlanting];
    inspectors.forEach((inspect, index) => assert.equal(inspect(entry).status, selected.includes(index) ? 'held' : 'legacy'));
    // An absent newer property must not widen historical export/search scope.
    const normalized = journal.normaliseJournal([entry])[0], edited = journal.editJournalEntry(normalized, legacyInput(), 2000);
    for (const index of selected) {
      assert.equal(Object.hasOwn(normalized, fields[index]), true); assert.equal(Object.hasOwn(edited, fields[index]), true);
      assert.deepEqual(edited[fields[index]], normalized[fields[index]]);
      if (entry[fields[index]] !== undefined) assert.deepEqual(normalized[fields[index]], entry[fields[index]]);
    }
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([normalized])), null);
  }
});

test('normalization and note edits preserve unknown future or malformed field evidence instead of reauthoring it', () => {
  const future = { version: 99, future: { retained: ['keep', null] } };
  for (const value of [null, false, {}, future]) {
    const entry = planting(value), normalized = journal.normaliseJournal([entry])[0];
    assert.deepEqual(normalized.nurseryFieldPlanting, value); assert.equal(journal.inspectJournalNurseryFieldPlanting(normalized).status, 'held');
    const edited = journal.editJournalEntry(normalized, { ...legacyInput(), nurseryFieldPlanting: payload(9) }, 2000);
    assert.deepEqual(edited.nurseryFieldPlanting, value); assert.equal(journal.inspectJournalNurseryFieldPlanting(edited).status, 'held');
  }
  const normalized = journal.normaliseJournal([planting(future)])[0]; future.future.retained[0] = 'Changed outside';
  assert.equal((normalized.nurseryFieldPlanting as typeof future).future.retained[0], 'keep');
});

test('ordinary editors cannot add field planting to legacy, sowing or progress notes even with an own undefined marker', () => {
  const originals = [journal.createJournalEntry(legacyInput(), 1000),
    journal.createJournalEntry({ ...legacyInput(), growerCycleLink: { ...link, eventKind: 'nursery-start' }, nurserySowing: sowing() }, 1000),
    journal.createJournalEntry({ ...legacyInput(), growerCycleLink: { ...link, eventKind: 'nursery-start' }, nurseryProgress: progress() }, 1000)];
  for (const original of originals) for (const value of [payload(), null, undefined]) {
    const edited = journal.editJournalEntry(original, { ...legacyInput(), nurseryFieldPlanting: value }, 2000);
    assert.equal(Object.hasOwn(edited, 'nurseryFieldPlanting'), false);
    assert.deepEqual(edited.nurserySowing, original.nurserySowing); assert.deepEqual(edited.nurseryProgress, original.nurseryProgress);
  }
});

test('unsafe payload/entry descriptors, inherited markers and reflection failures retain a hold with zero getter calls', () => {
  let getters = 0; const accessor = { enumerable: true, configurable: true, get() { getters++; throw Error('Do not read'); } };
  for (const field of Object.keys(payload())) {
    const unsafe = { ...payload() }; Object.defineProperty(unsafe, field, accessor);
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation(unsafe), null);
    assert.equal(journal.inspectJournalNurseryFieldPlanting(planting(unsafe)).status, 'held');
  }
  const refs = { ...payload().references }; Object.defineProperty(refs, 'seedLotReference', accessor);
  assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation({ ...payload(), references: refs }), null);
  const entry = planting(); Object.defineProperty(entry, 'nurseryFieldPlanting', accessor);
  const normalized = journal.normaliseJournal([entry])[0];
  assert.equal(Object.hasOwn(normalized, 'nurseryFieldPlanting'), true); assert.equal(journal.inspectJournalNurseryFieldPlanting(normalized).status, 'held');
  const inherited = Object.assign(Object.create({ nurseryFieldPlanting: payload() }), journal.createJournalEntry(legacyInput(), 1000));
  assert.equal(journal.inspectJournalNurseryFieldPlanting(journal.normaliseJournal([inherited])[0]).status, 'held');
  for (const other of ['nurserySowing', 'nurseryProgress']) {
    const mixed = planting(); Object.defineProperty(mixed, other, accessor);
    assert.equal(journal.inspectJournalNurseryFieldPlanting(mixed).status, 'held');
    assert.equal((other === 'nurserySowing' ? journal.inspectJournalNurserySowing : journal.inspectJournalNurseryProgress)(mixed).status, 'held');
    assert.equal((other === 'nurserySowing' ? journal.inspectJournalNurseryProgress : journal.inspectJournalNurserySowing)(mixed).status, 'legacy');
  }
  const cyclic: Record<string, unknown> = { ...payload() }; cyclic.self = cyclic;
  for (const value of [cyclic, new Proxy({}, { ownKeys() { throw Error('Reflection'); } }), { ...payload(), toJSON() { getters++; return {}; } }])
    assert.equal(journal.normaliseJournalNurseryFieldPlantingObservation(value), null);
  assert.equal(getters, 0);
});

test('raw inspection retains valid history and unknown metadata but holds duplicates, malformed payloads and mixed facts', () => {
  const valid = { ...planting(), id: 'field-observed', futureMetadata: { keep: [0, null, false] } };
  const inspection = journal.inspectJournalRowsForWrite(JSON.stringify([valid])); assert.ok(inspection);
  assert.deepEqual(inspection.rows, [valid]); assert.deepEqual(observed(inspection.entries[0]), payload());
  for (const rows of [[valid, valid], [{ ...valid, nurseryFieldPlanting: null }], [{ ...valid, nurseryFieldPlanting: { ...payload(), version: 99 } }],
    [{ ...valid, nurseryProgress: progress() }], [{ ...valid, nurserySowing: sowing() }]])
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify(rows)), null);
});

test('the actual canonical ordinary save preserves field quantity, reference snapshots, photos and unrelated raw metadata', async () => {
  const original = { ...planting(), id: 'field-observed', rawMetadata: { keep: ['private', null] } };
  await ready([original]); const entries = load();
  const edited = journal.editJournalEntry(entries[0], { ...legacyInput(), date: '2028-02-10', notes: 'Explicit note correction' }, 3000);
  const writes = local.writes, result = journal.saveJournal([edited], entries); loaded.add(result.entries);
  assert.equal(result.ok, true); assert.equal(local.writes - writes, 1);
  const current = load()[0]; assert.deepEqual(observed(current), payload()); assert.equal(current.date, '2028-02-10');
  assert.deepEqual(current.photos, original.photos); assert.deepEqual(rawRows()[0].rawMetadata, original.rawMetadata);
  assert.equal(local.rows.get(legacyKey()), JSON.stringify([original]));
});

test('ordinary canonical save cannot change, drop, inject or forge field observations or mix marker types', async () => {
  const actual = { ...planting(), id: 'actual' }, linked = { ...journal.createJournalEntry({ ...legacyInput(), growerCycleLink: link }, 500), id: 'linked' };
  await ready([actual, linked]); const entries = load(), before = local.rows.get(key()), writes = local.writes; let getters = 0;
  for (const change of ['quantity', 'references', 'drop', 'undefined', 'inject', 'new', 'getter', 'sowing', 'progress'] as const) {
    const candidate = structuredClone(entries), row = candidate.find(row => row.id === 'actual')!;
    if (change === 'quantity') row.nurseryFieldPlanting = payload(99);
    if (change === 'references') row.nurseryFieldPlanting = { ...payload(), references: { ...payload().references, seedLotReference: 'Changed lot' } };
    if (change === 'drop') delete row.nurseryFieldPlanting;
    if (change === 'undefined') row.nurseryFieldPlanting = undefined;
    if (change === 'inject') candidate.find(row => row.id === 'linked')!.nurseryFieldPlanting = payload();
    if (change === 'new') candidate.push({ ...planting(), id: 'forged-new' });
    if (change === 'getter') Object.defineProperty(row, 'nurseryFieldPlanting', { enumerable: true, get() { getters++; throw Error('Do not read'); } });
    if (change === 'sowing') row.nurserySowing = sowing();
    if (change === 'progress') row.nurseryProgress = progress();
    const result = journal.saveJournal(candidate, entries); assert.equal(result.ok, false, change);
    assert.equal(local.rows.get(key()), before, change); assert.equal(local.writes, writes, change);
  }
  assert.equal(getters, 0);
});

test('future and mixed retained history remains visible and cannot be normalized into an empty canonical overwrite', async () => {
  const mixed = { ...planting({ version: 99, future: { keep: ['evidence', 0] } }), nurserySowing: sowing(), nurseryProgress: progress() };
  await ready([mixed]); const entries = load(); assert.equal(entries.length, 1);
  for (const field of ['nurseryFieldPlanting', 'nurserySowing', 'nurseryProgress'] as const) assert.deepEqual(entries[0][field], mixed[field]);
  const before = local.rows.get(key()), writes = local.writes;
  for (const candidate of [[], entries, [journal.editJournalEntry(entries[0], legacyInput(), 3000)]]) {
    assert.equal(journal.saveJournal(candidate, entries).ok, false); assert.equal(local.rows.get(key()), before); assert.equal(local.writes, writes);
  }
});
