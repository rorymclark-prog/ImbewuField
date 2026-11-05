import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import type { GrowerJournalLink, JournalEntry, JournalEntryInput, JournalNurserySowingObservation } from '../lib/field-journal.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// The shared fixture controls only browser storage, Firebase auth and Web Locks.
// Journal loading, raw admission, cutover and ordinary saving remain real.
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
    this.held.add(name);
    try { return await run({ name }); } finally { this.held.delete(name); }
  }
}
const loaded = new Set<JournalEntry[]>();
const load = () => { const entries = journal.loadJournal(); loaded.add(entries); return entries; };
const canonicalKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_STORAGE_KEY);
const legacyKey = () => account.activeAccountLocalStorageKey(storage.JOURNAL_LEGACY_KEY);
const rawRows = () => JSON.parse(JSON.parse(local.rows.get(canonicalKey())!).journalRaw) as Record<string, unknown>[];
async function ready(entries: unknown[]) {
  local.rows.set(legacyKey(), JSON.stringify(entries));
  const result = await storage.initialiseJournalStorage();
  assert.equal(result.writable, true, `Actual journal initialization must succeed: ${result.reason}`);
}
const link: GrowerJournalLink = { version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'historical-accepted-planting', bedId: 'historical-bed', eventKind: 'nursery-start', plannedDate: '2028-02-01' };
const legacyInput = (): JournalEntryInput => ({ date: '2028-02-03', title: 'Entered sowing observation',
  notes: 'A synthetic grower-entered note.', category: 'planting', bedId: link.bedId, photos: ['data:image/png;base64,c3ludGhldGlj'] });
function observation(traysUsed: number | null = null): JournalNurserySowingObservation {
  return { kind: 'nursery-sowing-observation', version: 1, traysUsed,
    references: { variety: 'Entered variety label', seedLotReference: 'Entered lot label', raisingBatchReference: 'Entered raising label' } };
}
function observedInput(payload: unknown = observation()): JournalEntryInput {
  return { ...legacyInput(), growerCycleLink: structuredClone(link), nurserySowing: payload };
}
const observedEntry = (payload: unknown = observation()) => journal.createJournalEntry(observedInput(payload), 1000);
const inspection = (entry: unknown) => journal.inspectJournalNurserySowing(entry);
function observed(entry: unknown) {
  const result = inspection(entry); assert.equal(result.status, 'observed');
  if (result.status !== 'observed') throw Error('Synthetic observation must inspect');
  return result.observation;
}
beforeEach(async () => {
  for (const entries of loaded) journal.releaseJournalRead(entries); loaded.clear();
  storage.releaseAllDocumentJournalLeases(); await Promise.resolve();
  await fixture.reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
});
after(() => {
  for (const entries of loaded) journal.releaseJournalRead(entries);
  storage.releaseAllDocumentJournalLeases(); fixture.cleanup();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
});

test('unknown physical tray count stays null and explicit zero stays zero, separately from the entered observation day', () => {
  for (const count of [null, 0, 7, Number.MAX_SAFE_INTEGER]) {
    const entry = observedEntry(observation(count));
    assert.equal(observed(entry).traysUsed, count);
    assert.equal(entry.date, '2028-02-03');
    assert.equal((entry.growerCycleLink as GrowerJournalLink).plannedDate, '2028-02-01');
    assert.deepEqual(Object.keys(observed(entry)).sort(), ['kind', 'references', 'traysUsed', 'version']);
    for (const key of ['stock', 'harvest', 'seedQuantity', 'completed', 'consent', 'germinationPercent', 'plannedTrays']) {
      assert.equal(Object.hasOwn(entry, key), false);
    }
  }
});

test('strict shape decoding detaches and freezes label snapshots without trimming identity or consulting the current plan', () => {
  const input = observation(3);
  const raw = { ...input, references: { variety: '  Entered label  ', seedLotReference: null, raisingBatchReference: 'Λот / 批次' } };
  const decoded = journal.normaliseJournalNurserySowingObservation(raw);
  assert.deepEqual(decoded, raw); assert.notEqual(decoded, raw); assert.notEqual(decoded?.references, raw.references);
  assert.equal(Object.isFrozen(decoded), true); assert.equal(Object.isFrozen(decoded?.references), true);
  raw.references.variety = 'Later reference edit';
  assert.equal(decoded?.references.variety, '  Entered label  ');
  assert.equal(Object.isFrozen(raw), false);
  const entry = observedEntry(decoded);
  assert.equal(fixture.crop.loadCropPlan().plantings.length, 0, 'There is deliberately no live accepted planting in this history fixture');
  assert.equal(inspection(entry).status, 'observed', 'Stored structural provenance remains readable after its plan is gone');
});

test('whole physical tray counts reject fractions, coercions, missing fields and nonfinite or negative values', () => {
  for (const count of [undefined, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '0', '', true, false, {}, []]) {
    assert.equal(journal.normaliseJournalNurserySowingObservation({ ...observation(), traysUsed: count }), null);
  }
  const missing: Record<string, unknown> = { ...observation() }; delete missing.traysUsed;
  assert.equal(journal.normaliseJournalNurserySowingObservation(missing), null);
});

test('payload and all three nullable snapshot labels require exact own fields and cannot silently truncate future evidence', () => {
  for (const value of [undefined, null, false, 1, [], {}, { ...observation(), version: 2 },
    { ...observation(), kind: 'planned-nursery-reference' }, { ...observation(), date: '2028-02-01' },
    { ...observation(), references: { ...observation().references, extra: true } }]) {
    assert.equal(journal.normaliseJournalNurserySowingObservation(value), null);
  }
  for (const field of ['kind', 'version', 'traysUsed', 'references']) {
    const missing: Record<string, unknown> = { ...observation() }; delete missing[field];
    assert.equal(journal.normaliseJournalNurserySowingObservation(missing), null);
  }
  for (const field of ['variety', 'seedLotReference', 'raisingBatchReference'] as const) {
    for (const value of [undefined, '', ' ', 'x'.repeat(121), 'a\nb', 'a\0b', 'a\u007fb', 0, true, {}, []]) {
      const raw = { ...observation(), references: { ...observation().references, [field]: value } };
      assert.equal(journal.normaliseJournalNurserySowingObservation(raw), null);
    }
    const missing: Record<string, unknown> = { ...observation().references }; delete missing[field];
    assert.equal(journal.normaliseJournalNurserySowingObservation({ ...observation(), references: missing }), null);
    const boundary = { ...observation(), references: { ...observation().references, [field]: 'x'.repeat(120) } };
    assert.deepEqual(journal.normaliseJournalNurserySowingObservation(boundary), boundary);
  }
  const absentLabels = { ...observation(), references: { variety: null, seedLotReference: null, raisingBatchReference: null } };
  assert.deepEqual(journal.normaliseJournalNurserySowingObservation(absentLabels), absentLabels);
});

test('an observation requires its structural nursery-start link and consistent bed rather than becoming an unlinked note', () => {
  for (const changed of [undefined, null, { ...link, eventKind: 'field-entry' }, { ...link, plannedDate: 'not-a-date' },
    { ...link, scope: { kind: 'mapped-site', siteId: 'not-a-site' } }]) {
    const entry = observedEntry();
    if (changed === undefined) delete entry.growerCycleLink; else entry.growerCycleLink = changed;
    assert.equal(inspection(entry).status, 'held');
    assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([entry])), null);
  }
  const wrongBed = { ...observedEntry(), bedId: 'different-bed' };
  assert.equal(inspection(wrongBed).status, 'held');
  assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify([wrongBed])), null);
});

test('factory, normalization and legacy edits retain valid and malformed original payloads without shared aliases', () => {
  const future = { kind: 'nursery-sowing-observation', version: 99, retained: { values: ['keep', 0, false, null] } };
  for (const payload of [observation(0), null, { ...observation(), traysUsed: -1 }, future]) {
    const created = observedEntry(payload);
    const normalized = journal.normaliseJournal(JSON.parse(JSON.stringify([created])))[0];
    assert.deepEqual(normalized.nurserySowing, payload);
    const edited = journal.editJournalEntry(normalized, { ...legacyInput(), notes: 'Ordinary corrected words', nurserySowing: observation(99) }, 2000);
    assert.deepEqual(edited.nurserySowing, payload);
    assert.equal(edited.id, normalized.id); assert.equal(edited.createdAt, normalized.createdAt); assert.equal(edited.updatedAt, 2000);
    if (payload !== null) assert.notEqual(edited.nurserySowing, normalized.nurserySowing);
    assert.equal(inspection(edited).status, payload === null || 'retained' in payload || payload.traysUsed === -1 ? 'held' : 'observed');
  }
  const raw = { ...observedEntry(), nurserySowing: future };
  const normalized = journal.normaliseJournal([raw])[0];
  future.retained.values[0] = 'Changed outside history';
  assert.equal((normalized.nurserySowing as typeof future).retained.values[0], 'keep');
});

test('legacy editors cannot introduce even an own-undefined sowing property on an original legacy note', () => {
  const legacy = journal.createJournalEntry(legacyInput(), 1000);
  for (const payload of [observation(), undefined, null]) {
    const edited = journal.editJournalEntry(legacy, { ...observedInput(), nurserySowing: payload }, 2000);
    assert.equal(Object.hasOwn(edited, 'nurserySowing'), false);
    assert.deepEqual(inspection(edited), { status: 'legacy' });
  }
  for (const entry of [legacy, journal.normaliseJournal([legacy])[0]]) {
    assert.equal(Object.hasOwn(entry, 'nurserySowing'), false);
    assert.deepEqual(inspection(entry), { status: 'legacy' });
  }
});

test('unsafe getters at the entry, payload, references and count boundaries are never executed or silently omitted', () => {
  let calls = 0;
  const accessor = { enumerable: true, configurable: true, get() { calls++; throw Error('Do not execute'); } };
  for (const field of ['kind', 'version', 'traysUsed', 'references']) {
    const payload = { ...observation() }; Object.defineProperty(payload, field, accessor);
    assert.equal(journal.normaliseJournalNurserySowingObservation(payload), null);
    const entry = observedEntry(payload); assert.equal(inspection(entry).status, 'held');
  }
  for (const field of ['variety', 'seedLotReference', 'raisingBatchReference']) {
    const references = { ...observation().references }; Object.defineProperty(references, field, accessor);
    assert.equal(journal.normaliseJournalNurserySowingObservation({ ...observation(), references }), null);
  }
  const raw = observedEntry(); Object.defineProperty(raw, 'nurserySowing', accessor);
  assert.equal(inspection(raw).status, 'held');
  const normalized = journal.normaliseJournal([raw])[0];
  assert.equal(Object.hasOwn(normalized, 'nurserySowing'), true); assert.equal(inspection(normalized).status, 'held');
  const edited = journal.editJournalEntry(raw, legacyInput(), 2000);
  assert.equal(inspection(edited).status, 'held');
  const inherited = Object.create({ nurserySowing: observation() }); Object.assign(inherited, observedEntry());
  delete inherited.nurserySowing;
  const heldInherited = journal.normaliseJournal([inherited])[0];
  assert.equal(Object.hasOwn(heldInherited, 'nurserySowing'), true); assert.equal(inspection(heldInherited).status, 'held');
  const hidden = observedEntry(); Object.defineProperty(hidden, 'nurserySowing', { value: observation(), enumerable: false });
  assert.equal(inspection(journal.normaliseJournal([hidden])[0]).status, 'held');
  assert.equal(calls, 0);
});

test('functions, cycles, extra keys and throwing reflection remain held rather than forging a serializable observation', () => {
  const cyclic: Record<string, unknown> = { ...observation() }; cyclic.self = cyclic;
  const throwing = new Proxy({}, { ownKeys() { throw Error('Unavailable reflection'); } });
  const malformed = [cyclic, throwing, { ...observation(), toJSON() { throw Error('Do not call JSON hooks'); } }];
  for (const payload of malformed) {
    assert.equal(journal.normaliseJournalNurserySowingObservation(payload), null);
    const entry = observedEntry(payload);
    assert.equal(Object.hasOwn(entry, 'nurserySowing'), true);
    assert.equal(inspection(entry).status, 'held');
  }
});

test('raw write inspection admits exact legacy and observed history but rejects duplicate, malformed or downgraded evidence', () => {
  const legacy = { ...journal.createJournalEntry(legacyInput(), 1000), id: 'legacy-note' };
  const actual = { ...observedEntry(), id: 'observed-note', futureEvidence: { private: ['keep', null] } };
  const inspected = journal.inspectJournalRowsForWrite(JSON.stringify([legacy, actual]));
  assert.ok(inspected); assert.deepEqual(inspected.rows, [legacy, actual]);
  assert.deepEqual(observed(inspected.entries.find(entry => entry.id === actual.id)), observation());
  for (const entries of [[actual, actual], [{ ...actual, nurserySowing: null }], [{ ...actual, nurserySowing: { ...observation(), version: 2 } }],
    [{ ...actual, growerCycleLink: null }]]) assert.equal(journal.inspectJournalRowsForWrite(JSON.stringify(entries)), null);
});

test('ordinary canonical edits preserve actual count, historical labels, photos and raw unknown metadata with a real receipt', async () => {
  const original = { ...observedEntry(observation(0)), id: 'observed-note', futureEvidence: { preserve: [false, null, 'private metadata'] } };
  const legacy = { ...journal.createJournalEntry(legacyInput(), 500), id: 'legacy-note' };
  await ready([original, legacy]);
  const entries = load(); const target = entries.find(entry => entry.id === original.id)!;
  const edited = journal.editJournalEntry(target, { ...legacyInput(), notes: 'Explicit corrected observation', date: '2028-02-04' }, 3000);
  const writes = local.writes;
  const result = journal.saveJournal(journal.upsertJournalEntry(entries, edited), entries); loaded.add(result.entries);
  assert.equal(result.ok, true); assert.equal(result.unconfirmed, undefined); assert.equal(local.writes - writes, 1);
  const reloaded = load().find(entry => entry.id === original.id)!;
  assert.deepEqual(observed(reloaded), observation(0)); assert.equal(reloaded.date, '2028-02-04');
  assert.deepEqual(reloaded.photos, original.photos);
  assert.deepEqual(rawRows().find(entry => entry.id === original.id)?.futureEvidence, original.futureEvidence);
  assert.equal(local.rows.get(legacyKey()), JSON.stringify([original, legacy]), 'Retired v1 evidence is read-only after cutover');
});

test('ordinary saves reject changed, discarded or accessor-backed payloads and forged new observations without physical writes', async () => {
  const original = { ...observedEntry(observation(2)), id: 'observed-note' };
  const legacy = { ...journal.createJournalEntry(legacyInput(), 500), id: 'legacy-note' };
  await ready([original, legacy]);
  const entries = load(); const before = local.rows.get(canonicalKey()), writes = local.writes;
  let getters = 0;
  const candidates: JournalEntry[][] = [];
  for (const change of ['count', 'labels', 'discard', 'undefined', 'inject-legacy', 'new-observation', 'getter'] as const) {
    const candidate = structuredClone(entries); const target = candidate.find(entry => entry.id === original.id)!;
    if (change === 'count') target.nurserySowing = observation(99);
    if (change === 'labels') target.nurserySowing = { ...observation(2), references: { ...observation().references, seedLotReference: 'New lot' } };
    if (change === 'discard') delete target.nurserySowing;
    if (change === 'undefined') target.nurserySowing = undefined;
    if (change === 'inject-legacy') {
      const legacyCandidate = candidate.find(entry => entry.id === legacy.id)!;
      legacyCandidate.growerCycleLink = link; legacyCandidate.nurserySowing = observation();
    }
    if (change === 'new-observation') candidate.push({ ...observedEntry(), id: 'forged-new-note' });
    if (change === 'getter') Object.defineProperty(target, 'nurserySowing', { enumerable: true, get() { getters++; throw Error('Must not execute'); } });
    candidates.push(candidate);
  }
  for (const candidate of candidates) {
    const result = journal.saveJournal(candidate, entries);
    assert.equal(result.ok, false); assert.equal(result.held, true);
    assert.equal(local.rows.get(canonicalKey()), before); assert.equal(local.writes, writes);
  }
  assert.equal(getters, 0);
});

test('malformed retained history remains visible and prevents a lossy ordinary save or empty overwrite', async () => {
  const future = { ...observedEntry({ kind: 'nursery-sowing-observation', version: 2, future: { retained: [0, false, null] } }), id: 'future-note' };
  await ready([future]);
  const entries = load(); assert.equal(entries.length, 1); assert.deepEqual(entries[0].nurserySowing, future.nurserySowing);
  assert.equal(inspection(entries[0]).status, 'held');
  const before = local.rows.get(canonicalKey()), writes = local.writes;
  for (const candidate of [entries, [], [journal.editJournalEntry(entries[0], legacyInput(), 3000)]]) {
    assert.equal(journal.saveJournal(candidate, entries).ok, false);
    assert.equal(local.rows.get(canonicalKey()), before); assert.equal(local.writes, writes);
  }
});

test('legacy ordinary journal creation and note editing remain supported and never gain a nursery property', async () => {
  await ready([]);
  const entries = load(), note = journal.createJournalEntry(legacyInput(), 1000);
  const first = journal.saveJournal([note], entries); loaded.add(first.entries);
  assert.equal(first.ok, true);
  const current = load(); const edited = journal.editJournalEntry(current[0], { ...legacyInput(), notes: 'Legacy correction' }, 2000);
  const second = journal.saveJournal([edited], current); loaded.add(second.entries);
  assert.equal(second.ok, true); assert.equal(load()[0].notes, 'Legacy correction');
  assert.equal(Object.hasOwn(load()[0], 'nurserySowing'), false);
  assert.deepEqual(inspection(load()[0]), { status: 'legacy' });
});
