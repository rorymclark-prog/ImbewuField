import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { GrowerNurserySowingInput } from '../lib/grower-field-observation.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// Firebase transport/Auth and browser/Web Locks are boundaries. The accepted
// cycle, raw saved source, original hook, writer and canonical journal are real.
const fixture = await import('./international-grower-operations-fixture.ts');
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();'),
  };
  return next(specifier, context);
} });
const { local, probe, account, samples, core, crop, store, studio, studioKey, reset, cleanup, pauseHashes } = fixture;
const journal = await import('../lib/field-journal.ts');
const { filterJournalEntries } = await import('../lib/journal-view.ts');
const storage = await import('../lib/journal-storage.ts');
const { recordGrowerNurserySowing, recordGrowerFieldObservation } = await import('../lib/grower-field-observation.ts');
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');
const actors = await import('../lib/length-unit-preference.ts');
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
const input: GrowerNurserySowingInput = { observedDate: '2028-12-14', note: 'Entered physical containers used.', traysUsed: null, confirmed: true };
const labels = { variety: 'Entered variety A', seedLotReference: 'Entered lot A', raisingBatchReference: 'Entered raising A' };
const loaded = new Set<ReturnType<typeof journal.loadJournal>>();
const load = () => { const rows = journal.loadJournal(); loaded.add(rows); return rows; };
async function readyJournal(rows: unknown[] = []) {
  local.rows.set(legacy(), JSON.stringify(rows));
  assert.equal((await storage.initialiseJournalStorage()).writable, true);
}
async function source(labelled = true) {
  const canvas = studio(); local.setItem(studioKey(), JSON.stringify(canvas));
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: fixture.siteId,
    raw: canvas, sourceRevision: JSON.stringify(canvas) }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('source held');
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit,
    provenance: { kind: 'grower-estimate' as const, recordedAt: fixture.stamp } });
  const profile = { version: 1 as const, profileId: 'sowing-profile', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('transplant' as const, 'method'),
    nurseryDays: own(2, 'days'), fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'),
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
  if (labelled) {
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
  const task = tasks.find(task => task.growerEventKind === 'nursery-start'); assert.ok(task?.growerJournalLink, JSON.stringify(current.heldSources));
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
  storage.releaseAllDocumentJournalLeases(); hook.deregister(); cleanup();
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
});

for (const traysUsed of [null, 0, 3]) test(`physical tray count ${traysUsed} survives actual append/load and references stay historical`, async () => {
  const { current, task } = await source();
  const prior = { ...journal.createJournalEntry({ date: '2028-12-01', title: 'Earlier note', notes: '', category: 'other' }), futureEvidence: { keep: [null, 0] } };
  await readyJournal([prior]); const before = new Map(local.rows), writes = local.writes;
  const result = await recordGrowerNurserySowing(current, task, { ...input, traysUsed }, { isCurrent: () => true });
  assert.equal(result.status, 'saved'); assert.equal(local.writes, writes + 1);
  const rows = load(), observed = rows.find(row => row.id === result.journalEntryId)!;
  assert.equal(observed.date, input.observedDate); assert.notEqual(observed.date, task.dueDate);
  assert.equal(observed.title, 'Nursery sowing'); assert.equal(observed.category, 'planting');
  assert.deepEqual(filterJournalEntries(rows, { category: 'planting' }).map(row => row.id), [observed.id],
    'the journal Planting filter must retain the newly recorded sowing');
  assert.deepEqual(filterJournalEntries(rows, { query: 'Nursery sowing' }).map(row => row.id), [observed.id]);
  assert.match(result.message, /Nursery sowing.*journal/); assert.match(result.message, /Planned batches.*have not changed/);
  const inspection = journal.inspectJournalNurserySowing(observed); assert.equal(inspection.status, 'observed');
  if (inspection.status !== 'observed') throw Error('sowing lost');
  assert.equal(inspection.observation.traysUsed, traysUsed); assert.deepEqual(inspection.observation.references, labels);
  assert.equal(journal.inspectJournalGrowerLink(observed).status, 'linked');
  assert.deepEqual(JSON.parse(raw())[0], prior);
  for (const [name, bytes] of before) if (name !== key()) assert.equal(local.rows.get(name), bytes, name);
  const replacement = current.book.plantings.map(row => ({ ...row, variety: 'Later entered label' })); store(replacement);
  assert.deepEqual(journal.inspectJournalNurserySowing(load().find(row => row.id === observed.id)), inspection);
});

test('genuinely absent references snapshot null while generic nursery-start notes remain the original three-field behavior', async () => {
  const { current, task } = await source(false); await readyJournal();
  assert.equal((await recordGrowerNurserySowing(current, task, input, { isCurrent: () => true })).status, 'saved');
  const entry = load()[0], inspection = journal.inspectJournalNurserySowing(entry); assert.equal(inspection.status, 'observed');
  if (inspection.status !== 'observed') throw Error('sowing lost');
  assert.deepEqual(inspection.observation.references, { variety: null, seedLotReference: null, raisingBatchReference: null });
  const { traysUsed: _unused, ...generic } = input;
  const genericResult = await recordGrowerFieldObservation(current, task, generic, { isCurrent: () => true });
  assert.equal(genericResult.status, 'saved');
  const entries = load(); assert.equal(entries.length, 2);
  const genericEntry = entries.find(row => row.id === genericResult.journalEntryId)!;
  assert.equal(journal.inspectJournalNurserySowing(genericEntry).status, 'legacy');
  assert.equal(genericEntry.title, 'Field note'); assert.equal(genericEntry.category, 'other');
  assert.equal(filterJournalEntries(entries, { category: 'planting' }).some(row => row.id === genericEntry.id), false);
  assert.equal(filterJournalEntries(entries, { category: 'other' }).some(row => row.id === genericEntry.id), true);
  assert.equal(genericResult.message, 'Field note saved in your journal with the day you entered. Checklist, harvest, stock and sales records have not changed.');
});

test('invalid counts, dates, extra fields and accessor-backed input/task cannot write or execute getters', async () => {
  const { current, task } = await source(); await readyJournal(); const before = raw(), writes = local.writes;
  for (const bad of [{ ...input, traysUsed: undefined }, { ...input, traysUsed: -1 }, { ...input, traysUsed: .5 },
    { ...input, traysUsed: Infinity }, { ...input, traysUsed: Number.MAX_SAFE_INTEGER + 1 }, { ...input, traysUsed: '2' },
    { ...input, observedDate: '' }, { ...input, note: '' }, { ...input, confirmed: false }, { ...input, references: labels }]) {
    assert.equal((await recordGrowerNurserySowing(current, task, bad as GrowerNurserySowingInput, { isCurrent: () => true })).status, 'held');
  }
  let getters = 0; const bad = { ...input };
  Object.defineProperty(bad, 'traysUsed', { enumerable: true, get() { getters++; return 2; } });
  assert.equal((await recordGrowerNurserySowing(current, task, bad, { isCurrent: () => true })).status, 'held');
  const unsafeTask = { ...task }; Object.defineProperty(unsafeTask, 'growerJournalLink', { enumerable: true, get() { getters++; return task.growerJournalLink; } });
  assert.equal((await recordGrowerNurserySowing(current, unsafeTask, input, { isCurrent: () => true })).status, 'held');
  assert.equal(getters, 0); assert.equal(raw(), before); assert.equal(local.writes, writes);
});

test('foreign/proposed/duplicate members, forged links and malformed saved references never append', async () => {
  const { current, task, tasks } = await source(); await readyJournal(); const before = raw();
  assert.equal((await recordGrowerNurserySowing(structuredClone(current), task, input, { isCurrent: () => true })).status, 'held');
  const nonNursery = tasks.find(row => row.growerEventKind === 'field-entry')!;
  assert.equal((await recordGrowerNurserySowing(current, nonNursery, input, { isCurrent: () => true })).status, 'held');
  for (const patch of [{ plantingId: 'proposed-only' }, { bedId: 'foreign-bed' }, { plannedDate: '2028-12-31' }]) {
    assert.equal((await recordGrowerNurserySowing(current, { ...task, growerJournalLink: { ...task.growerJournalLink!, ...patch } }, input, { isCurrent: () => true })).status, 'held');
  }
  for (const plantings of [[...current.book.plantings, ...current.book.plantings],
    current.book.plantings.map(row => ({ ...row, nurseryBatchReference: null }))]) {
    store(plantings); const fresh = await core.loadGrowerOperationsSources();
    assert.equal((await recordGrowerNurserySowing(fresh, task, input, { isCurrent: () => true })).status, 'held');
  }
  assert.equal(raw(), before);
});

for (const transition of ['source', 'frame', 'book', 'account-ABA', 'sample-ABA', 'form', 'journal'] as const) {
  test(`${transition} during current-source await holds the original observation without append`, async () => {
    const { current, task } = await source(); await readyJournal(); const before = raw();
    const pause = pauseHashes(); let form = true;
    const pending = recordGrowerNurserySowing(current, task, input, { isCurrent: () => form }); await pause.started;
    if (transition === 'source' || transition === 'frame') { const changed = studio(); if (transition === 'source') changed.items[0].x = .6; else changed.frame.mPerPx = 2; local.rows.set(studioKey(), JSON.stringify(changed)); }
    if (transition === 'book') store([...current.book.plantings, ...current.book.plantings]);
    if (transition === 'account-ABA') { actor('owner-b'); actor('owner-a'); }
    if (transition === 'sample-ABA') { samples.enterSampleMode(); samples.exitSampleMode(); }
    if (transition === 'form') form = false;
    if (transition === 'journal') { const envelope = JSON.parse(local.rows.get(key())!); local.rows.set(key(), JSON.stringify({ ...envelope, journalRaw: '[null]' })); }
    const writes = local.writes; pause.resume(); assert.equal((await pending).status, 'held'); assert.equal(local.writes, writes);
    if (transition !== 'journal') assert.equal(raw(), before); else assert.equal(raw(), '[null]');
  });
}

for (const failure of ['quota', 'readback'] as const) test(`${failure} never claims a confirmed nursery observation or automatically appends twice`, async () => {
  const { current, task } = await source(); await readyJournal(); const before = raw(), original = local.setItem;
  try {
    local.setItem = function(name, value) { if (name === key() && failure === 'quota') throw Error('quota'); original.call(this, name, value);
      if (name === key() && failure === 'readback') this.onRead = readKey => { if (readKey === name) throw Error('readback'); }; };
    const result = await recordGrowerNurserySowing(current, task, input, { isCurrent: () => true });
    assert.equal(result.status, failure === 'quota' ? 'held' : 'unconfirmed'); local.onRead = null;
    if (failure === 'quota') assert.equal(raw(), before); else assert.equal(JSON.parse(raw()).length, 1);
  } finally {
    local.setItem = original; local.onRead = null;
    if (failure === 'readback') { await Promise.resolve(); const context = storage.makeBrowserJournalStorageContext(); assert.ok(context); await storage.recoverJournalStorage(context); }
  }
});

async function mountedWorkflow() {
  const setup = await source(); await readyJournal();
  const admitted = crop.loadCropPlanWithWriteAdmission(), planKey = JSON.stringify(admitted.book);
  const actor = actors.captureJournalObservationContext(); let dirty = false;
  let workflow!: ReturnType<typeof useGrowerWorkflow>;
  function Harness() { workflow = useGrowerWorkflow({ selection: { kind: 'studio-canvas', sourceId: fixture.siteId }, scope: setup.source.scope,
    resourceSiteId: setup.source.resourceSiteId, book: admitted.book, actorIsCurrent: () => actors.journalObservationContextIsCurrent(actor),
    readCurrentBook: () => !dirty && crop.cropPlanWriteAdmissionMatches(admitted.admission, planKey, admitted.token)
      ? { status: 'ready', book: admitted.book, token: admitted.token!, isCurrent: () => !dirty && crop.cropPlanWriteAdmissionMatches(admitted.admission, planKey, admitted.token) }
      : { status: 'held', reason: 'pending-plan-edits' } }); return React.createElement('div'); }
  let renderer!: ReactTestRenderer; await act(async () => { renderer = create(React.createElement(Harness)); });
  let checked!: Awaited<ReturnType<typeof workflow.onReadSavedNursery>>;
  await act(async () => { checked = await workflow.onReadSavedNursery(); });
  assert.equal(checked.status, 'ready', checked.status === 'held' ? checked.reason : ''); if (checked.status !== 'ready') throw Error('saved view held');
  const view = checked.view;
  return { setup, view, get workflow() { return workflow; }, dirty() { dirty = true; }, close() { act(() => renderer.unmount()); actors.revokeJournalObservationContext(actor); } };
}

test('actual saved-view hook appends once for one form, allows a new intent and rejects cloned/altered/dirty views', async () => {
  const ui = await mountedWorkflow();
  try {
    const callback = () => true; const writes = local.writes;
    const first = await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', { ...input, traysUsed: 0 }, callback);
    assert.equal(first.status, 'saved'); assert.equal(local.writes, writes + 1);
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, callback)).status, 'held');
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, () => true)).status, 'saved');
    assert.equal((await ui.workflow.onRecordNurserySowing(structuredClone(ui.view), 'sowing-member', input, () => true)).status, 'held');
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'proposed-only', input, () => true)).status, 'held');
    ui.dirty(); const before = raw();
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, () => true)).status, 'held'); assert.equal(raw(), before);
  } finally { ui.close(); }
});

for (const transition of ['refresh', 'source-ABA', 'actor-ABA', 'sample-ABA', 'display', 'dirty'] as const) test(`saved-view hook preserves original ${transition} withdrawal across its await`, async () => {
  const ui = await mountedWorkflow();
  try {
    const pause = pauseHashes(); let displayed = true;
    const pending = ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, () => displayed); await pause.started;
    if (transition === 'refresh') { const refresh = ui.workflow.onRefresh(); pause.resume(); await act(async () => { await refresh; }); }
    if (transition === 'source-ABA') fixture.events.dispatchEvent(new Event('imbewu-design-canvas-changed'));
    if (transition === 'actor-ABA') { actor('owner-b'); actor('owner-a'); }
    if (transition === 'sample-ABA') { samples.enterSampleMode(); samples.exitSampleMode(); }
    if (transition === 'display') displayed = false;
    if (transition === 'dirty') ui.dirty();
    const writes = local.writes; pause.resume(); assert.equal((await pending).status, 'held'); assert.equal(local.writes, writes); assert.equal(JSON.parse(raw()).length, 0);
  } finally { ui.close(); }
});

test('a nursery observation in DEMO uses only the sample journal and preserves personal canonical bytes', async () => {
  await readyJournal(); const personal = new Map(local.rows);
  assert.equal(samples.enterSampleMode(), true);
  try {
    const { current, task } = await source(); local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    const result = await recordGrowerNurserySowing(current, task, { ...input, traysUsed: 0 }, { isCurrent: () => true });
    assert.equal(result.status, 'saved'); assert.match(result.message, /DEMO nursery sowing.*sample journal/);
    const entries = load(); assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'Nursery sowing'); assert.equal(entries[0].category, 'planting');
    const inspection = journal.inspectJournalNurserySowing(entries[0]); assert.equal(inspection.status, 'observed');
    if (inspection.status !== 'observed') throw Error('sample payload lost');
    assert.equal(inspection.observation.traysUsed, 0); assert.deepEqual(inspection.observation.references, labels);
    for (const [name, bytes] of personal) assert.equal(local.rows.get(name), bytes, name);
    assert.equal([...local.rows.keys()].filter(name => name.includes(storage.JOURNAL_STORAGE_KEY)).length, 1,
      'the only canonical v2 book is the untouched personal one');
  } finally { samples.exitSampleMode(); }
});

test('hook snapshots input before await and the immediate lock rejects a duplicate click', async () => {
  const ui = await mountedWorkflow();
  try {
    const mutable = { ...input }, intent = () => true, pause = pauseHashes();
    const pending = ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', mutable, intent); await pause.started;
    mutable.note = 'Later mutation must not become the observed note.'; mutable.traysUsed = 9;
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', mutable, intent)).status, 'held');
    pause.resume(); const result = await pending; assert.equal(result.status, 'saved');
    const entries = load(); assert.equal(entries.length, 1); assert.equal(entries[0].notes, input.note);
    const inspection = journal.inspectJournalNurserySowing(entries[0]); assert.equal(inspection.status, 'observed');
    if (inspection.status !== 'observed') throw Error('snapshot lost'); assert.equal(inspection.observation.traysUsed, null);
  } finally { ui.close(); }
});

test('the hook retains an uncertain attempted-write receipt and consumes its original form without a duplicate append', async () => {
  const ui = await mountedWorkflow(); let displayed = true;
  const withdraw = () => { displayed = false; };
  fixture.events.addEventListener(storage.JOURNAL_STORAGE_EVENT, withdraw);
  try {
    const intent = () => displayed;
    const result = await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, intent);
    assert.equal(result.status, 'unconfirmed'); assert.ok(result.journalEntryId);
    assert.equal(JSON.parse(raw()).length, 1, 'uncertainty does not imply no write');
    const writes = local.writes;
    assert.equal((await ui.workflow.onRecordNurserySowing(ui.view, 'sowing-member', input, intent)).status, 'held');
    assert.equal(local.writes, writes);
  } finally { fixture.events.removeEventListener(storage.JOURNAL_STORAGE_EVENT, withdraw); ui.close(); }
});

test('malformed history and full canonical history hold without dropping earlier rows', async () => {
  const { current, task } = await source(); await readyJournal();
  const envelope = JSON.parse(local.rows.get(key())!);
  const prior = journal.createJournalEntry({ date: '2028-12-01', title: 'Keep this row', notes: '', category: 'other' });
  for (const journalRaw of ['[null]', '[{"id":"x","id":"y"}]', JSON.stringify(Array.from({ length: journal.MAX_ENTRIES }, (_, index) => ({ ...prior, id: `earlier-${index}` })))]) {
    local.rows.set(key(), JSON.stringify({ ...envelope, journalRaw })); const before = local.rows.get(key()), writes = local.writes;
    assert.equal((await recordGrowerNurserySowing(current, task, input, { isCurrent: () => true })).status, 'held');
    assert.equal(local.rows.get(key()), before); assert.equal(local.writes, writes);
  }
});

test('a sample source withdrawal during its last journal read cannot append before reporting uncertainty', async () => {
  assert.equal(samples.enterSampleMode(), true);
  let original: typeof local.getItem | undefined;
  try {
    const { current, task } = await source(); local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    original = local.getItem; let reads = 0, withdrawn = false;
    local.getItem = function(name) {
      const value = original!.call(this, name);
      if (name === storage.JOURNAL_LEGACY_KEY && ++reads === 3) {
        withdrawn = true; fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT));
      }
      return value;
    };
    const result = await recordGrowerNurserySowing(current, task, input, { isCurrent: () => true });
    assert.equal(withdrawn, true, 'exercise the prewrite journal re-read, not a preflight refusal');
    assert.equal(result.status, 'held');
    assert.equal(original.call(local, storage.JOURNAL_LEGACY_KEY), '[]', 'revoked source cannot commit before uncertainty is reported');
  } finally { if (original) local.getItem = original; samples.exitSampleMode(); }
});

test('sample actor revocation inside the final source callback is checked after that callback before append', async () => {
  assert.equal(samples.enterSampleMode(), true);
  let original: typeof local.getItem | undefined;
  try {
    const { current, task } = await source(); local.setItem(storage.JOURNAL_LEGACY_KEY, '[]');
    original = local.getItem; let reads = 0, finalRead = false, withdrawn = false;
    local.getItem = function(name) { const value = original!.call(this, name);
      if (name === storage.JOURNAL_LEGACY_KEY && ++reads === 3) finalRead = true; return value; };
    const result = await recordGrowerNurserySowing(current, task, input, { isCurrent() {
      if (finalRead && !withdrawn) { withdrawn = true; fixture.events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); }
      return true;
    } });
    assert.equal(withdrawn, true); assert.equal(result.status, 'held');
    assert.equal(original.call(local, storage.JOURNAL_LEGACY_KEY), '[]');
  } finally { if (original) local.getItem = original; samples.exitSampleMode(); }
});
