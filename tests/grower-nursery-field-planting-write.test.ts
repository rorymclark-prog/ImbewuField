import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import type { GrowerNurseryFieldPlantingInput } from '../lib/grower-field-observation.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// Firebase transport/Auth and browser/Web Locks are boundaries. The accepted
// cycle, raw saved source, original hook, writer and canonical journal are real.
const fixture = await import('./international-grower-operations-fixture.ts');
const { local, probe, account, samples, core, crop, store, studio, studioKey, reset, cleanup, pauseHashes } = fixture;
const journal = await import('../lib/field-journal.ts');
const { filterJournalEntries } = await import('../lib/journal-view.ts');
const storage = await import('../lib/journal-storage.ts');
const { recordGrowerNurseryFieldPlanting, recordGrowerFieldObservation } = await import('../lib/grower-field-observation.ts');
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
const { generateGrowerAutoPlan } = await import('../lib/international/grower-autoplan.ts');
const { createGrowerCyclePlanting } = await import('../lib/international/grower-cycle.ts');
const { prepareGrowerNurseryBatchReferenceChanges } = await import('../lib/international/grower-nursery.ts');
const { buildGrowerBoardTasks } = await import('../lib/task-board.ts');
const { CROPS } = await import('../lib/crop-catalog.ts');
const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
class Locks implements JournalStorageLocks {
  async request<T>(_name: string, _options: { mode: 'exclusive'; ifAvailable: true }, run: (lock: unknown) => T | PromiseLike<T>): Promise<T> {
    await Promise.resolve(); return await run({});
  }
}
const key = () => account.activeAccountLocalStorageKey(storage.JOURNAL_STORAGE_KEY);
const legacy = () => account.activeAccountLocalStorageKey(storage.JOURNAL_LEGACY_KEY);
const raw = () => JSON.parse(local.rows.get(key())!).journalRaw as string;
const input: GrowerNurseryFieldPlantingInput = { observedDate: '2028-12-14', note: 'Entered field planting quantity from my own check.', plantsPlanted: 0, confirmed: true };
const labels = { variety: 'Entered variety A', seedLotReference: 'Entered lot A', raisingBatchReference: 'Entered raising A' };
const loaded = new Set<ReturnType<typeof journal.loadJournal>>();
const load = () => { const rows = journal.loadJournal(); loaded.add(rows); return rows; };
async function readyJournal(rows: unknown[] = []) {
  local.rows.set(legacy(), JSON.stringify(rows));
  assert.equal((await storage.initialiseJournalStorage()).writable, true);
}
async function source(labelled = true, direct = false) {
  const canvas = studio(); local.setItem(studioKey(), JSON.stringify(canvas));
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: fixture.siteId,
    raw: canvas, sourceRevision: JSON.stringify(canvas) }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('source held');
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit,
    provenance: { kind: 'grower-estimate' as const, recordedAt: fixture.stamp } });
  const profile = { version: 1 as const, profileId: 'sowing-profile', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own(direct ? 'direct' as const : 'transplant' as const, 'method'),
    nurseryDays: direct ? { state: 'missing' as const, reason: 'not-applicable' as const } : own(2, 'days'), fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months') } };
  const proposal = generateGrowerAutoPlan({ requestedAt: fixture.stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [profile], beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-12-01', 'utc-date'), planningEndExclusive: own('2029-01-01', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'sowing-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2028-12-10', endExclusive: '2028-12-12' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'sowing-member', acceptedAt: fixture.stamp, geometryFingerprint: source.geometryFingerprint });
  assert.ok(row);
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  let book: CropPlanState = { version: 1, plantings: [row], updatedAt: 1 };
  if (labelled && !direct) {
    const prepared = prepareGrowerNurseryBatchReferenceChanges({ book, originalRows: book.plantings, originalContext: context, currentContext: context,
      changes: [{ plantingId: row.id, ...labels }] });
    assert.equal(prepared.status, 'prepared'); if (prepared.status !== 'prepared') throw Error('labels held'); book = prepared.book;
  }
  assert.equal(crop.saveCropPlan(book), true, 'seed through the real canonical saver for a clean hook admission');
  // First sample access initializes demo geometry. Author this synthetic saved
  // canvas after that initialization, as an actual sample edit would.
  local.setItem(studioKey(), JSON.stringify(canvas));
  const current = await core.loadGrowerOperationsSources(); assert.equal(current.status, 'ready');
  if (current.status !== 'ready') throw Error('operations held');
  const tasks = buildGrowerBoardTasks(current.book.plantings, current.contexts, new Date(), new Set()).tasks;
  const task = tasks.find(task => task.growerEventKind === 'field-entry'); assert.ok(task?.growerJournalLink, JSON.stringify(current.heldSources));
  return { current, task, source, tasks };
}
function actor(uid: string) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid); for (const notify of probe.auth) notify({ uid });
}
beforeEach(async () => {
  for (const rows of loaded) journal.releaseJournalRead(rows); loaded.clear();
  storage.releaseAllDocumentJournalLeases(); await reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
});
after(() => {
  for (const rows of loaded) journal.releaseJournalRead(rows);
  storage.releaseAllDocumentJournalLeases(); cleanup();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
});


for (const plantsPlanted of [0, 7, Number.MAX_SAFE_INTEGER]) test(`observed field-planting ${plantsPlanted} appends once with historical labels, never establishment or stock movement`, async () => {
  const { current, task } = await source();
  const prior = { ...journal.createJournalEntry({ date: '2028-12-01', title: 'Earlier note', notes: '', category: 'other' }), futureEvidence: { keep: [null, 0] } };
  await readyJournal([prior]); const before = new Map(local.rows), writes = local.writes;
  const result = await recordGrowerNurseryFieldPlanting(current, task, { ...input, plantsPlanted }, { isCurrent: () => true });
  assert.equal(result.status, 'saved'); assert.ok(result.journalEntryId); assert.equal(local.writes, writes + 1);
  const entries = load(), entry = entries.find(row => row.id === result.journalEntryId)!;
  const inspection = journal.inspectJournalNurseryFieldPlanting(entry); assert.equal(inspection.status, 'observed');
  if (inspection.status !== 'observed') throw Error('field planting missing');
  assert.equal(inspection.observation.plantsPlanted, plantsPlanted); assert.deepEqual(inspection.observation.references, labels);
  assert.equal(entry.date, input.observedDate); assert.notEqual(entry.date, task.dueDate);
  const link = journal.inspectJournalGrowerLink(entry); assert.equal(link.status, 'linked');
  if (link.status !== 'linked') throw Error('planning reference missing');
  assert.equal(link.link.eventKind, 'field-entry'); assert.equal(link.link.plannedDate, task.dueDate);
  assert.equal(entry.title, 'Field planting'); assert.equal(entry.category, 'planting');
  assert.deepEqual(filterJournalEntries(entries, { category: 'planting', query: 'Field planting' }).map(row => row.id), [entry.id]);
  for (const key of ['nurserySowing', 'nurseryProgress', 'sowingEntryId', 'progressEntryId', 'established', 'stock', 'completed']) assert.equal(Object.hasOwn(entry, key), false);
  assert.match(result.message, /does not confirm establishment/); assert.match(result.message, /stock/);
  assert.deepEqual(JSON.parse(raw())[0], prior);
  for (const [name, bytes] of before) if (name !== key()) assert.equal(local.rows.get(name), bytes, name);
  store(current.book.plantings.map(row => ({ ...row, variety: 'Later planned label' })));
  assert.deepEqual(journal.inspectJournalNurseryFieldPlanting(load().find(row => row.id === entry.id)), inspection);
});

test('missing or coerced quantity, blank fields and unsafe input/task descriptors hold without getter execution', async () => {
  const { current, task } = await source(); await readyJournal(); const before = raw(), writes = local.writes;
  const { plantsPlanted: _missing, ...missing } = input;
  for (const invalid of [missing, { ...input, plantsPlanted: undefined }, { ...input, plantsPlanted: null }, { ...input, plantsPlanted: '' },
    { ...input, plantsPlanted: '0' }, { ...input, plantsPlanted: .5 }, { ...input, plantsPlanted: -1 }, { ...input, plantsPlanted: Infinity },
    { ...input, plantsPlanted: Number.MAX_SAFE_INTEGER + 1 }, { ...input, observedDate: '' }, { ...input, observedDate: '2028-02-31' },
    { ...input, note: ' ' }, { ...input, confirmed: false }, { ...input, references: labels }])
    assert.equal((await recordGrowerNurseryFieldPlanting(current, task, invalid as GrowerNurseryFieldPlantingInput, { isCurrent: () => true })).status, 'held');
  let getters = 0;
  for (const key of ['observedDate', 'note', 'confirmed', 'plantsPlanted'] as const) {
    const unsafe = { ...input }; Object.defineProperty(unsafe, key, { enumerable: true, get() { getters++; return input[key]; } });
    assert.equal((await recordGrowerNurseryFieldPlanting(current, task, unsafe, { isCurrent: () => true })).status, 'held');
  }
  const unsafeTask = { ...task }; Object.defineProperty(unsafeTask, 'growerJournalLink', { enumerable: true, get() { getters++; return task.growerJournalLink; } });
  assert.equal((await recordGrowerNurseryFieldPlanting(current, unsafeTask, input, { isCurrent: () => true })).status, 'held');
  assert.equal(getters, 0); assert.equal(raw(), before); assert.equal(local.writes, writes);
});

test('an accepted direct-sown field-entry task remains a generic note source but cannot claim a nursery field planting', async () => {
  const { current, task } = await source(false, true); await readyJournal(); const before = raw(), writes = local.writes;
  assert.equal(task.growerEventKind, 'field-entry');
  assert.equal((await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => true })).status, 'held');
  assert.equal(raw(), before); assert.equal(local.writes, writes);
  const { plantsPlanted: _removed, ...generic } = input;
  assert.equal((await recordGrowerFieldObservation(current, task, generic, { isCurrent: () => true })).status, 'saved');
  assert.equal(journal.inspectJournalNurseryFieldPlanting(load()[0]).status, 'legacy');
});

test('field planting requires the exact current field-entry task, day, bed, crop and persistent whole-book membership', async () => {
  const { current, task, tasks } = await source(); await readyJournal(); const before = raw();
  assert.equal((await recordGrowerNurseryFieldPlanting(structuredClone(current), task, input, { isCurrent: () => true })).status, 'held');
  for (const other of tasks.filter(row => row.growerEventKind !== 'field-entry'))
    assert.equal((await recordGrowerNurseryFieldPlanting(current, other, input, { isCurrent: () => true })).status, 'held');
  for (const candidate of [{ ...task, dueDate: '2028-12-31' }, { ...task, bedId: 'foreign-bed' }, { ...task, cropKey: 'unknown-key' },
    ...[{ plantingId: 'proposed-only' }, { bedId: 'foreign-bed' }, { plannedDate: '2028-12-31' }].map(patch => ({ ...task, growerJournalLink: { ...task.growerJournalLink!, ...patch } }))])
    assert.equal((await recordGrowerNurseryFieldPlanting(current, candidate, input, { isCurrent: () => true })).status, 'held');
  for (const plantings of [[...current.book.plantings, ...current.book.plantings], current.book.plantings.map(row => ({ ...row, nurseryBatchReference: null }))]) {
    store(plantings); const fresh = await core.loadGrowerOperationsSources();
    assert.equal((await recordGrowerNurseryFieldPlanting(fresh, task, input, { isCurrent: () => true })).status, 'held');
  }
  assert.equal(raw(), before);
});

for (const transition of ['source', 'frame', 'book', 'account-ABA', 'sample-ABA', 'form', 'journal'] as const) test(`${transition} during the checked source await prevents field-planting append`, async () => {
  const { current, task } = await source(); await readyJournal(); const before = raw();
  const pause = pauseHashes(); let form = true;
  const pending = recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => form }); await pause.started;
  if (transition === 'source' || transition === 'frame') { const changed = studio(); if (transition === 'source') changed.items[0].x = .6; else changed.frame.mPerPx = 2; local.rows.set(studioKey(), JSON.stringify(changed)); }
  if (transition === 'book') store([...current.book.plantings, ...current.book.plantings]);
  if (transition === 'account-ABA') { actor('owner-b'); actor('owner-a'); }
  if (transition === 'sample-ABA') { samples.enterSampleMode(); samples.exitSampleMode(); }
  if (transition === 'form') form = false;
  if (transition === 'journal') { const envelope = JSON.parse(local.rows.get(key())!); local.rows.set(key(), JSON.stringify({ ...envelope, journalRaw: '[null]' })); }
  const writes = local.writes; pause.resume(); assert.equal((await pending).status, 'held'); assert.equal(local.writes, writes);
  if (transition !== 'journal') assert.equal(raw(), before); else assert.equal(raw(), '[null]');
});

for (const failure of ['quota', 'readback'] as const) test(`${failure} cannot become confirmed field planting or trigger an automatic second append`, async () => {
  const { current, task } = await source(); await readyJournal(); const before = raw(), original = local.setItem;
  try {
    local.setItem = function(name, value) { if (name === key() && failure === 'quota') throw Error('quota'); original.call(this, name, value);
      if (name === key() && failure === 'readback') this.onRead = readKey => { if (readKey === name) throw Error('readback'); }; };
    const result = await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => true });
    assert.equal(result.status, failure === 'quota' ? 'held' : 'unconfirmed'); local.onRead = null;
    if (failure === 'quota') assert.equal(raw(), before); else { assert.ok(result.journalEntryId); assert.equal(JSON.parse(raw()).length, 1); }
    await Promise.resolve(); if (failure === 'readback') assert.equal(JSON.parse(raw()).length, 1);
  } finally { local.setItem = original; local.onRead = null;
    if (failure === 'readback') { await Promise.resolve(); const context = storage.makeBrowserJournalStorageContext(); assert.ok(context); await storage.recoverJournalStorage(context); }
  }
});

test('a deliberate separate field observation appends separate evidence without an exactly-once or earlier-sowing inference', async () => {
  const { current, task } = await source(false); await readyJournal();
  const first = await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => true });
  const second = await recordGrowerNurseryFieldPlanting(current, task, { ...input, plantsPlanted: 4 }, { isCurrent: () => true });
  assert.equal(first.status, 'saved'); assert.equal(second.status, 'saved'); assert.notEqual(first.journalEntryId, second.journalEntryId);
  const entries = load(); assert.equal(entries.length, 2);
  for (const result of [first, second]) {
    const inspected = journal.inspectJournalNurseryFieldPlanting(entries.find(row => row.id === result.journalEntryId));
    assert.equal(inspected.status, 'observed'); if (inspected.status !== 'observed') throw Error('evidence missing');
    assert.deepEqual(inspected.observation.references, { variety: null, seedLotReference: null, raisingBatchReference: null });
  }
});

test('DEMO field planting uses only the sample journal and leaves personal canonical bytes intact', async () => {
  await readyJournal(); const personal = new Map(local.rows); assert.equal(samples.enterSampleMode(), true);
  try {
    const { current, task } = await source(); local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    const result = await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => true });
    assert.equal(result.status, 'saved'); assert.match(result.message, /DEMO field planting.*sample journal/); assert.match(result.message, /does not confirm establishment/);
    const entries = load(); assert.equal(entries.length, 1); const inspection = journal.inspectJournalNurseryFieldPlanting(entries[0]);
    assert.equal(inspection.status, 'observed'); if (inspection.status !== 'observed') throw Error('sample field planting missing'); assert.equal(inspection.observation.plantsPlanted, 0);
    for (const [name, bytes] of personal) assert.equal(local.rows.get(name), bytes, name);
  } finally { samples.exitSampleMode(); }
});

for (const withdrawal of ['journal-read', 'final-callback'] as const) test(`sample ${withdrawal} revocation is held before any field-planting write`, async () => {
  assert.equal(samples.enterSampleMode(), true); let original: typeof local.getItem | undefined;
  try {
    const { current, task } = await source(); local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    original = local.getItem; let reads = 0, finalRead = false, withdrawn = false;
    local.getItem = function(name) { const value = original!.call(this, name); if (name === storage.JOURNAL_LEGACY_KEY && ++reads === 3) {
      finalRead = true; if (withdrawal === 'journal-read') { withdrawn = true; fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); }
    } return value; };
    const result = await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent() {
      if (withdrawal === 'final-callback' && finalRead && !withdrawn) { withdrawn = true; fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); } return true;
    } });
    assert.equal(withdrawn, true); assert.equal(result.status, 'held'); assert.equal(original.call(local, storage.JOURNAL_LEGACY_KEY), '[]');
  } finally { if (original) local.getItem = original; samples.exitSampleMode(); }
});

test('a postwrite form withdrawal retains an uncertain entry ID and the attempted entry without rollback or automatic replay', async () => {
  const { current, task } = await source(); await readyJournal(); let form = true;
  const withdraw = () => { form = false; }; fixture.events.addEventListener(storage.JOURNAL_STORAGE_EVENT, withdraw);
  try {
    const result = await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => form });
    assert.equal(result.status, 'unconfirmed'); assert.ok(result.journalEntryId); assert.equal(JSON.parse(raw()).length, 1);
    const writes = local.writes; await Promise.resolve(); assert.equal(local.writes, writes);
    assert.equal((await recordGrowerNurseryFieldPlanting(current, task, input, { isCurrent: () => form })).status, 'held'); assert.equal(local.writes, writes);
  } finally { fixture.events.removeEventListener(storage.JOURNAL_STORAGE_EVENT, withdraw); }
});
