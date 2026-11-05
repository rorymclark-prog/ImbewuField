import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import type { GrowerJournalLink, JournalEntry, JournalEntryInput, JournalNurseryProgressObservation } from '../lib/field-journal.ts';
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
  plantingId: 'historical-accepted-planting', bedId: 'historical-bed', eventKind: 'nursery-start', plannedDate: '2028-02-01' };
function payload(stage: JournalNurseryProgressObservation['stage'] = 'emerged',
  coverage: JournalNurseryProgressObservation['coverage'] = 'checked-subset', plantsObserved = 0): JournalNurseryProgressObservation {
  return { kind: 'nursery-progress-observation', version: 1, stage, coverage, plantsObserved,
    references: { variety: 'Entered variety', seedLotReference: 'Entered lot', raisingBatchReference: 'Entered raising label' } };
}
const legacyInput = (): JournalEntryInput => ({ date: '2028-02-09', title: 'Own observed count', notes: 'A synthetic explicit observation.',
  category: 'planting', bedId: link.bedId, photos: ['data:image/png;base64,AAAA'] });
function progress(value: unknown = payload()) {
  return journal.createJournalEntry({ ...legacyInput(), growerCycleLink: structuredClone(link), nurseryProgress: value }, 1000);
}
const sowing = () => ({ kind: 'nursery-sowing-observation', version: 1, traysUsed: 2, references: payload().references });
function observed(entry: unknown) {
  const result = journal.inspectJournalNurseryProgress(entry); assert.equal(result.status, 'observed');
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

test('explicit zero and every entered stage/coverage remain distinct dated observations with no inferred stock or rates', () => {
  for (const stage of ['emerged', 'alive', 'ready'] as const) for (const coverage of ['whole-batch', 'checked-subset'] as const) {
    for (const count of [0, 7, Number.MAX_SAFE_INTEGER]) {
      const entry = progress(payload(stage, coverage, count));
      assert.deepEqual(observed(entry), payload(stage, coverage, count));
      assert.equal(entry.date, '2028-02-09'); assert.equal((entry.growerCycleLink as GrowerJournalLink).plannedDate, '2028-02-01');
      assert.deepEqual(Object.keys(observed(entry)).sort(), ['coverage', 'kind', 'plantsObserved', 'references', 'stage', 'version']);
      for (const key of ['germinationPercent', 'stock', 'capacity', 'readyForTransplant', 'sowingEntryId', 'completed', 'consent']) {
        assert.equal(Object.hasOwn(entry, key), false);
      }
    }
  }
});

test('blank, null, fractional, coerced, unsafe or missing counts cannot become zero or planned quantities', () => {
  for (const count of [undefined, null, '', '0', true, false, 0.25, -1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, {}, []]) {
    assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...payload(), plantsObserved: count }), null);
  }
  const missing: Record<string, unknown> = { ...payload() }; delete missing.plantsObserved;
  assert.equal(journal.normaliseJournalNurseryProgressObservation(missing), null);
});

test('stage, coverage, version and exact own payload shape must be explicitly valid, with no defaults or silent extra facts', () => {
  for (const stage of [undefined, null, '', 'ready ', 'Ready', 'germinated', true, 0, {}, []]) {
    assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...payload(), stage }), null);
  }
  for (const coverage of [undefined, null, '', 'whole batch', 'whole-batch ', 'all', true, 0, {}, []]) {
    assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...payload(), coverage }), null);
  }
  for (const value of [undefined, null, false, 0, [], {}, { ...payload(), version: 2 }, { ...payload(), kind: 'planned-nursery-reference' },
    { ...payload(), germinationPercent: 100 }, { ...payload(), sowingEntryId: 'unverified-backlink' }]) {
    assert.equal(journal.normaliseJournalNurseryProgressObservation(value), null);
  }
  for (const field of Object.keys(payload())) {
    const missing: Record<string, unknown> = { ...payload() }; delete missing[field];
    assert.equal(journal.normaliseJournalNurseryProgressObservation(missing), null);
  }
});

test('progress and sowing share the exact nullable label authority while historical snapshots are detached and immutable', () => {
  const references = { variety: '  Exact entered label  ', seedLotReference: null, raisingBatchReference: 'Λот / 批次' };
  const raw = { ...payload(), references }, decoded = journal.normaliseJournalNurseryProgressObservation(raw);
  assert.deepEqual(decoded, raw); assert.notEqual(decoded, raw); assert.notEqual(decoded?.references, references);
  assert.equal(Object.isFrozen(decoded), true); assert.equal(Object.isFrozen(decoded?.references), true);
  references.variety = 'Later planned label'; assert.equal(decoded?.references.variety, '  Exact entered label  ');
  for (const field of ['variety', 'seedLotReference', 'raisingBatchReference'] as const) {
    for (const label of [undefined, '', ' ', 'x'.repeat(121), 'a\nb', 'a\0b', 'a\u007fb', true, 0, {}, []]) {
      const refs = { ...payload().references, [field]: label };
      assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...payload(), references: refs }), null);
      assert.equal(journal.normaliseJournalNurserySowingObservation({ ...sowing(), references: refs }), null);
    }
    const refs = { ...payload().references, [field]: 'x'.repeat(120) };
    assert.deepEqual(journal.normaliseJournalNurseryProgressObservation({ ...payload(), references: refs })?.references, refs);
  }
});

test('historical progress needs a structural nursery-start link and consistent bed but no surviving live crop plan', () => {
  const entry = progress(); assert.equal(fixture.crop.loadCropPlan().plantings.length, 0);
  assert.equal(journal.inspectJournalNurseryProgress(entry).status, 'observed');
  for (const changed of [undefined, null, { ...link, eventKind: 'field-entry' }, { ...link, plannedDate: 'not-a-date' }]) {
    const candidate = progress();
    if (changed === undefined) delete candidate.growerCycleLink; else candidate.growerCycleLink = changed;
    assert.equal(journal.inspectJournalNurseryProgress(candidate).status, 'held');
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([candidate])), null);
  }
  assert.equal(journal.inspectJournalNurseryProgress({ ...entry, bedId: 'different-bed' }).status, 'held');
});

test('dual sowing/progress property presence is held by both inspectors without dropping either original payload', () => {
  for (const other of [sowing(), undefined, null, { version: 99, evidence: [0, false] }]) {
    const entry = { ...progress(), nurserySowing: other };
    assert.equal(journal.inspectJournalNurseryProgress(entry).status, 'held');
    assert.equal(journal.inspectJournalNurserySowing(entry).status, 'held');
    const normalized = journal.normaliseJournal([entry])[0];
    assert.equal(Object.hasOwn(normalized, 'nurserySowing'), true); assert.equal(Object.hasOwn(normalized, 'nurseryProgress'), true);
    assert.equal(journal.inspectJournalNurseryProgress(normalized).status, 'held');
    if (other !== undefined) assert.deepEqual(normalized.nurserySowing, other);
    assert.deepEqual(normalized.nurseryProgress, entry.nurseryProgress);
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([normalized])), null);
  }
});

test('create, normalize and ordinary edit retain malformed/future evidence and cannot silently replace it with valid fields', () => {
  const future = { kind: 'nursery-progress-observation', version: 99, future: { retained: ['keep', 0, false, null] } };
  for (const value of [payload(), null, { ...payload(), plantsObserved: -1 }, future]) {
    const created = progress(value), normalized = journal.normaliseJournal(JSON.parse(JSON.stringify([created])))[0];
    const edited = journal.editJournalEntry(normalized, { ...legacyInput(), notes: 'Explicit correction', nurseryProgress: payload('ready', 'whole-batch', 99) }, 2000);
    assert.deepEqual(created.nurseryProgress, value); assert.deepEqual(normalized.nurseryProgress, value); assert.deepEqual(edited.nurseryProgress, value);
    assert.equal(edited.id, created.id); assert.equal(edited.createdAt, 1000); assert.equal(edited.updatedAt, 2000);
    if (value !== null) assert.notEqual(edited.nurseryProgress, normalized.nurseryProgress);
  }
  const normalized = journal.normaliseJournal([progress(future)])[0]; future.future.retained[0] = 'Changed outside';
  assert.equal((normalized.nurseryProgress as typeof future).future.retained[0], 'keep');
});

test('legacy and sowing-only note edits cannot introduce even an own-undefined progress property', () => {
  for (const original of [journal.createJournalEntry(legacyInput(), 1000),
    journal.createJournalEntry({ ...legacyInput(), growerCycleLink: link, nurserySowing: sowing() }, 1000)]) {
    for (const value of [payload(), null, undefined]) {
      const edited = journal.editJournalEntry(original, { ...legacyInput(), nurseryProgress: value }, 2000);
      assert.equal(Object.hasOwn(edited, 'nurseryProgress'), false);
      assert.deepEqual(journal.inspectJournalNurseryProgress(edited), { status: 'legacy' });
      assert.deepEqual(edited.nurserySowing, original.nurserySowing);
    }
  }
});

test('unsafe descriptors, inherited presence, cycles and reflection failures hold with zero payload getter calls', () => {
  let getters = 0;
  const accessor = { enumerable: true, configurable: true, get() { getters++; throw Error('Do not read'); } };
  for (const field of Object.keys(payload())) {
    const raw = { ...payload() }; Object.defineProperty(raw, field, accessor);
    assert.equal(journal.normaliseJournalNurseryProgressObservation(raw), null);
    assert.equal(journal.inspectJournalNurseryProgress(progress(raw)).status, 'held');
  }
  const refs = { ...payload().references }; Object.defineProperty(refs, 'seedLotReference', accessor);
  assert.equal(journal.normaliseJournalNurseryProgressObservation({ ...payload(), references: refs }), null);
  const entry = progress(); Object.defineProperty(entry, 'nurseryProgress', accessor);
  assert.equal(journal.inspectJournalNurseryProgress(entry).status, 'held');
  const normalized = journal.normaliseJournal([entry])[0];
  assert.equal(Object.hasOwn(normalized, 'nurseryProgress'), true); assert.equal(journal.inspectJournalNurseryProgress(normalized).status, 'held');
  const inherited = Object.assign(Object.create({ nurseryProgress: payload() }), journal.createJournalEntry(legacyInput(), 1000));
  assert.equal(journal.inspectJournalNurseryProgress(journal.normaliseJournal([inherited])[0]).status, 'held');
  const cyclic: Record<string, unknown> = { ...payload() }; cyclic.self = cyclic;
  const throwing = new Proxy({}, { ownKeys() { throw Error('Reflection'); } });
  for (const value of [cyclic, throwing, { ...payload(), toJSON() { getters++; throw Error('JSON hook'); } }]) {
    assert.equal(journal.normaliseJournalNurseryProgressObservation(value), null);
    assert.equal(journal.inspectJournalNurseryProgress(progress(value)).status, 'held');
  }
  assert.equal(getters, 0);
});

test('raw journal inspection keeps valid records and unknown metadata but holds duplicate, malformed and dual history', () => {
  const valid = { ...progress(), id: 'progress', futureMetadata: { keep: [0, false, null] } };
  const old = { ...journal.createJournalEntry(legacyInput(), 500), id: 'old' };
  const inspected = journal.inspectJournalRowsForWrite(JSON.stringify([old, valid]));
  assert.ok(inspected); assert.deepEqual(inspected.rows, [old, valid]); assert.deepEqual(observed(inspected.entries.find(row => row.id === 'progress')), payload());
  for (const rows of [[valid, valid], [{ ...valid, nurseryProgress: null }], [{ ...valid, nurseryProgress: { ...payload(), version: 2 } }],
    [{ ...valid, nurserySowing: sowing() }]]) assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify(rows)), null);
});

test('actual canonical ordinary save preserves count/stage/subset/history references/photos and original unknown raw metadata', async () => {
  const original = { ...progress(payload('ready', 'checked-subset', 0)), id: 'observed', rawMetadata: { keep: ['private', null] } };
  await ready([original]); const entries = load();
  const edited = journal.editJournalEntry(entries[0], { ...legacyInput(), date: '2028-02-10', notes: 'Explicit note correction' }, 3000);
  const writes = local.writes, saved = journal.saveJournal([edited], entries); loaded.add(saved.entries);
  assert.equal(saved.ok, true); assert.equal(saved.unconfirmed, undefined); assert.equal(local.writes - writes, 1);
  const current = load()[0]; assert.deepEqual(observed(current), payload('ready', 'checked-subset', 0));
  assert.equal(current.date, '2028-02-10'); assert.deepEqual(current.photos, original.photos);
  assert.deepEqual(rawRows()[0].rawMetadata, original.rawMetadata);
  assert.equal(local.rows.get(legacyKey()), JSON.stringify([original]));
});

test('ordinary saves cannot change/drop/inject progress, replace a sowing marker or append forged linked counts', async () => {
  const actual = { ...progress(), id: 'actual' };
  const linked = { ...journal.createJournalEntry({ ...legacyInput(), growerCycleLink: link }, 500), id: 'linked' };
  await ready([actual, linked]); const entries = load(); const before = local.rows.get(key()), writes = local.writes; let getters = 0;
  for (const change of ['count', 'stage', 'coverage', 'references', 'drop', 'undefined', 'inject', 'new', 'getter', 'dual'] as const) {
    const candidate = structuredClone(entries), row = candidate.find(row => row.id === 'actual')!;
    if (change === 'count') row.nurseryProgress = payload('emerged', 'checked-subset', 99);
    if (change === 'stage') row.nurseryProgress = payload('ready');
    if (change === 'coverage') row.nurseryProgress = payload('emerged', 'whole-batch');
    if (change === 'references') row.nurseryProgress = { ...payload(), references: { ...payload().references, seedLotReference: 'Changed lot' } };
    if (change === 'drop') delete row.nurseryProgress;
    if (change === 'undefined') row.nurseryProgress = undefined;
    if (change === 'inject') candidate.find(row => row.id === 'linked')!.nurseryProgress = payload();
    if (change === 'new') candidate.push({ ...progress(), id: 'new-forged' });
    if (change === 'getter') Object.defineProperty(row, 'nurseryProgress', { enumerable: true, get() { getters++; throw Error('Do not read'); } });
    if (change === 'dual') row.nurserySowing = sowing();
    const saved = journal.saveJournal(candidate, entries);
    assert.equal(saved.ok, false, change); assert.equal(saved.held, true, change);
    assert.equal(local.rows.get(key()), before, change); assert.equal(local.writes, writes, change);
  }
  assert.equal(getters, 0);
});

test('future or dual retained history stays visible and cannot be normalized into an empty canonical overwrite', async () => {
  const dual = { ...progress({ version: 99, future: { keep: ['evidence', 0] } }), nurserySowing: sowing() };
  await ready([dual]); const entries = load();
  assert.equal(entries.length, 1); assert.deepEqual(entries[0].nurseryProgress, dual.nurseryProgress); assert.deepEqual(entries[0].nurserySowing, dual.nurserySowing);
  assert.equal(journal.inspectJournalNurseryProgress(entries[0]).status, 'held'); assert.equal(journal.inspectJournalNurserySowing(entries[0]).status, 'held');
  const before = local.rows.get(key()), writes = local.writes;
  for (const candidate of [[], entries, [journal.editJournalEntry(entries[0], legacyInput(), 3000)]]) {
    assert.equal(journal.saveJournal(candidate, entries).ok, false); assert.equal(local.rows.get(key()), before); assert.equal(local.writes, writes);
  }
});
