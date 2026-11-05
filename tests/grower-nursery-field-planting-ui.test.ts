import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { registerHooks } from 'node:module';
import test, { after, beforeEach, afterEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import type { GrowerNurseryFieldPlantingInput } from '../lib/grower-field-observation.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import type { JournalStorageLocks } from '../lib/journal-storage.ts';

// Firebase transport/Auth and browser/Web Locks are boundaries. The accepted
// cycle, raw saved source, original hook, writer and canonical journal are real.
const fixture = await import('./international-grower-operations-fixture.ts');
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
Object.defineProperty(globalThis, 'self', { configurable: true, value: globalThis });
const hook = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts') && specifier === '@/lib/db/queries') return {
    shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const myDesigns=()=>globalThis.__growerOperationsFixture.cloud();'),
  };
  if (context.parentURL?.startsWith(new URL('../', import.meta.url).href) && specifier.endsWith('.module.css')) return { shortCircuit: true, url: 'data:text/javascript,export default {};' };
  return next(specifier, context);
}, load(url, context, next) {
  if (url.startsWith(new URL('../', import.meta.url).href) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
} });
const { local, probe, account, samples, core, crop, store, studio, studioKey, reset, cleanup, pauseHashes } = fixture;
const journal = await import('../lib/field-journal.ts');
const { filterJournalEntries } = await import('../lib/journal-view.ts');
const storage = await import('../lib/journal-storage.ts');
const { default: Form } = await import('../components/crops/NurseryFieldPlantingObservationForm.tsx');
const { default: SavedPanel } = await import('../components/crops/SavedGrowerNurseryReviewPanel.tsx');
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
const input: GrowerNurseryFieldPlantingInput = { observedDate: '2028-12-14', note: 'I observed plants being planted in the assigned growing space.', plantsPlanted: 0, confirmed: true };
const labels = { variety: 'Entered variety A', seedLotReference: 'Entered lot A', raisingBatchReference: 'Entered raising A' };
const loaded = new Set<ReturnType<typeof journal.loadJournal>>();
const load = () => { const rows = journal.loadJournal(); loaded.add(rows); return rows; };
async function readyJournal(rows: unknown[] = []) {
  local.rows.set(legacy(), JSON.stringify(rows));
  assert.equal((await storage.initialiseJournalStorage()).writable, true);
}
async function source(labelled = true, establishment: 'transplant' | 'direct' = 'transplant') {
  const canvas = studio(); local.setItem(studioKey(), JSON.stringify(canvas));
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: fixture.siteId,
    raw: canvas, sourceRevision: JSON.stringify(canvas) }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('source held');
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit,
    provenance: { kind: 'grower-estimate' as const, recordedAt: fixture.stamp } });
  const profile = { version: 1 as const, profileId: 'field-planting-profile', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own(establishment, 'method'),
    nurseryDays: establishment === 'transplant' ? own(2, 'days') : { state: 'missing' as const, reason: 'not-applicable' as const }, fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months') } };
  const proposal = generateGrowerAutoPlan({ requestedAt: fixture.stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [profile], beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-12-01', 'utc-date'), planningEndExclusive: own('2029-01-01', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'field-planting-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2028-12-10', endExclusive: '2028-12-12' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'field-planting-member', acceptedAt: fixture.stamp, geometryFingerprint: source.geometryFingerprint });
  assert.ok(row);
  const context = { scope: source.scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint };
  let book: CropPlanState = { version: 1, plantings: [row], updatedAt: 1 };
  if (labelled && establishment === 'transplant') {
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
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  // Firebase queues a delivery for existing observers and skips unsubscribed
  // callbacks. A live Set loop would revisit replacements added by a listener.
  for (const notify of [...probe.auth]) if (probe.auth.has(notify)) notify({ uid });
}
const mounted = new Set<ReactTestRenderer>();
afterEach(() => { for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear(); });
beforeEach(async () => {
  for (const rows of loaded) journal.releaseJournalRead(rows); loaded.clear();
  storage.releaseAllDocumentJournalLeases(); await reset();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: new Locks() } });
});
after(() => {
  for (const rows of loaded) journal.releaseJournalRead(rows);
  storage.releaseAllDocumentJournalLeases(); hook.deregister(); cleanup();
  if (originalSelf) Object.defineProperty(globalThis, 'self', originalSelf); else Reflect.deleteProperty(globalThis, 'self');
  if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore); else Reflect.deleteProperty(globalThis, 'navigator');
});


const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
async function controller(establishment: 'transplant' | 'direct' = 'transplant') {
  const setup = await source(true, establishment); await readyJournal();
  const admitted = crop.loadCropPlanWithWriteAdmission(), planKey = JSON.stringify(admitted.book), actor = actors.captureJournalObservationContext();
  let dirty = false, workflow!: ReturnType<typeof useGrowerWorkflow>;
  const proofs: (() => boolean)[] = [];
  const records: Promise<Awaited<ReturnType<typeof workflow.onRecordNurseryFieldPlanting>>>[] = [];
  function Harness() {
    workflow = useGrowerWorkflow({ selection: { kind: 'studio-canvas', sourceId: fixture.siteId }, scope: setup.source.scope,
      resourceSiteId: setup.source.resourceSiteId, book: admitted.book, actorIsCurrent: () => actors.journalObservationContextIsCurrent(actor),
      readCurrentBook: () => !dirty && crop.cropPlanWriteAdmissionMatches(admitted.admission, planKey, admitted.token)
        ? { status: 'ready', book: admitted.book, token: admitted.token!, isCurrent: () => !dirty && crop.cropPlanWriteAdmissionMatches(admitted.admission, planKey, admitted.token) }
        : { status: 'held', reason: 'pending-plan-edits' } });
    return React.createElement(SavedPanel, { review: workflow.savedNurseryReview, checking: workflow.savedNurseryChecking, contextRevision: workflow.contextRevision,
      onRefresh: workflow.onReadSavedNursery, onCheckCurrent: workflow.onCheckSavedNurseryCurrent, onSaveReferences: workflow.onSaveNurseryBatchReferences,
      onRecordSowing: workflow.onRecordNurserySowing, onRecordProgress: workflow.onRecordNurseryProgress,
      onRecordFieldPlanting: (view, id, value, isCurrent) => { proofs.push(isCurrent); const pending = workflow.onRecordNurseryFieldPlanting(view, id, value, isCurrent); records.push(pending); return pending; } });
  }
  let renderer!: ReactTestRenderer; await act(async () => { renderer = create(React.createElement(Harness)); }); mounted.add(renderer);
  let checked!: Awaited<ReturnType<typeof workflow.onReadSavedNursery>>;
  await act(async () => { checked = await workflow.onReadSavedNursery(); });
  assert.equal(checked.status, 'ready', checked.status === 'held' ? checked.reason : ''); if (checked.status !== 'ready') throw Error('saved view required');
  const field = (prefix: string) => { const label = renderer.root.findAllByType('label').find(node => text(node).startsWith(prefix)); assert.ok(label, prefix); return label.findAll(node => node.type === 'input' || node.type === 'textarea')[0]; };
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(row => text(row) === label); assert.ok(node, label); return node; };
  return { renderer, setup, view: checked.view, proofs, records, field, button, get workflow() { return workflow; }, dirty() { dirty = true; },
    open() { act(() => button('Record field planting').props.onClick()); },
    edit(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    confirm(value = true) { act(() => field('I confirm this day').props.onChange({ target: { checked: value } })); },
    async save() { const before = records.length; await act(async () => { button('Save field planting observation').props.onClick(); if (records.length > before) await records[records.length - 1]; }); },
    close() { if (mounted.delete(renderer)) act(() => renderer.unmount()); actors.revokeJournalObservationContext(actor); } };
}
function fill(ui: Awaited<ReturnType<typeof controller>>, count = '0') {
  ui.edit('Actual observed day', input.observedDate); ui.edit('What you observed', input.note); ui.edit('Plants you planted', count); ui.confirm();
}

test('real saved-batch controller shows explicit planned field entry while the observed form starts blank and saves zero through canonical journal receipt', async () => {
  const ui = await controller();
  try {
    const plan = local.rows.get(fixture.bookKey()), geometry = local.rows.get(studioKey());
    assert.equal(ui.view.references[0].plannedFieldEntryDate, ui.setup.task.dueDate);
    assert.notEqual(ui.view.references[0].plannedFieldEntryDate, ui.view.references[0].startDate);
    assert.ok(ui.button('Record nursery sowing')); assert.ok(ui.button('Record nursery plant count')); ui.open();
    for (const label of ['Actual observed day', 'What you observed', 'Plants you planted']) {
      const control = ui.field(label); assert.equal(control.props.value, ''); assert.equal(control.parent!.props.htmlFor, control.props.id); assert.match(control.props.className, /min-h-11/);
    }
    assert.equal(ui.field('I confirm this day').props.checked, false); assert.equal(ui.button('Save field planting observation').props.disabled, true);
    assert.match(text(ui.renderer.root), new RegExp(`Planned field-entry day \\(UTC\\): ${ui.setup.task.dueDate}`));
    assert.match(text(ui.renderer.root), /not the day you observed/); assert.match(text(ui.renderer.root), /do not verify seed identity/);
    fill(ui); const writes = local.writes; await ui.save(); assert.equal(local.writes, writes + 1);
    const rows = load(); assert.equal(rows.length, 1); assert.equal(rows[0].date, input.observedDate); assert.equal(rows[0].notes, input.note);
    const linkInspection = journal.inspectJournalGrowerLink(rows[0]); assert.equal(linkInspection.status, 'linked');
    if (linkInspection.status !== 'linked') throw Error('Canonical planning link required');
    assert.equal(linkInspection.link.eventKind, 'field-entry'); assert.equal(linkInspection.link.plannedDate, ui.setup.task.dueDate);
    const checked = journal.inspectJournalNurseryFieldPlanting(rows[0]); assert.equal(checked.status, 'observed'); if (checked.status !== 'observed') throw Error('observation required');
    assert.deepEqual(checked.observation, { kind: 'nursery-field-planting-observation', version: 1, plantsPlanted: 0, references: labels });
    assert.equal(local.rows.get(fixture.bookKey()), plan); assert.equal(local.rows.get(studioKey()), geometry);
    const link = ui.renderer.root.findByType('a'); assert.equal(link.props.href, '/journal'); assert.equal(typeof link.props.onClick, 'function', 'actual Next client link avoids resetting sample journal on full navigation');
  } finally { ui.close(); }
});

test('blank and invalid planted counts do not become zero, and actual day/note/confirmation are required before any write', async () => {
  const ui = await controller(); try {
    ui.open(); fill(ui); const before = raw(), writes = local.writes;
    for (const value of ['', '-1', '1.5', '1e2', '9007199254740992']) { ui.edit('Plants you planted', value); await ui.save(); assert.equal(raw(), before); }
    ui.edit('Plants you planted', '0'); ui.confirm(false); await ui.save(); assert.equal(raw(), before); ui.confirm();
    ui.edit('Actual observed day', '2028-02-30'); await ui.save(); assert.equal(raw(), before);
    ui.edit('Actual observed day', input.observedDate); ui.edit('What you observed', ' '); await ui.save(); assert.equal(raw(), before); assert.equal(local.writes, writes);
    ui.edit('What you observed', input.note); await ui.save(); assert.equal(load().length, 1);
  } finally { ui.close(); }
});

test('one confirmed field-planting intent is consumed and a deliberate new intent clears every observed field', async () => {
  const ui = await controller(); try {
    ui.open(); fill(ui, '2'); const save = ui.button('Save field planting observation').props.onClick; await ui.save();
    await act(async () => save()); await ui.save(); assert.equal(load().length, 1);
    const another = ui.button('Record another field planting').props.onClick; act(() => another());
    for (const label of ['Actual observed day', 'What you observed', 'Plants you planted']) assert.equal(ui.field(label).props.value, '');
    assert.equal(ui.field('I confirm this day').props.checked, false);
    ui.edit('What you observed', 'Later explicit intent'); act(() => another()); assert.equal(ui.field('What you observed').props.value, 'Later explicit intent');
    fill(ui, '3'); await ui.save(); assert.equal(load().length, 2); assert.notEqual(ui.proofs[0], ui.proofs[1]);
  } finally { ui.close(); }
});

test('prewrite quota hold retains entered fields and one stable proof for an explicit retry without silently adopting another source', async () => {
  const ui = await controller(), original = local.setItem; try {
    ui.open(); fill(ui); const before = raw();
    local.setItem = function(name, value) { if (name === key()) throw Error('synthetic quota'); original.call(this, name, value); };
    await ui.save(); assert.equal(raw(), before); assert.equal(ui.field('Plants you planted').props.value, '0');
    local.setItem = original; await ui.save(); assert.equal(load().length, 1); assert.equal(ui.proofs[0], ui.proofs[1]);
  } finally { local.setItem = original; ui.close(); }
});

test('actual uncertain readback retains exactly one attempted entry and blocks retries/reset while directing journal inspection', async () => {
  const ui = await controller(), original = local.setItem; try {
    ui.open(); fill(ui);
    local.setItem = function(name, value) { original.call(this, name, value); if (name === key()) this.onRead = readKey => { if (readKey === name) throw Error('readback unavailable'); }; };
    await ui.save(); local.onRead = null; local.setItem = original;
    assert.equal(JSON.parse(raw()).length, 1); assert.match(text(ui.renderer.root), /Inspect the journal before recording again/);
    assert.equal(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Record another field planting'), false);
    const writes = local.writes; await ui.save(); assert.equal(local.writes, writes); assert.equal(JSON.parse(raw()).length, 1);
  } finally {
    local.onRead = null; local.setItem = original; const context = storage.makeBrowserJournalStorageContext();
    if (context) await storage.recoverJournalStorage(context); ui.close();
  }
});

for (const transition of ['source', 'actor', 'sample', 'dirty', 'reference'] as const) test(`real pending controller keeps original ${transition} withdrawal through fresh source await`, async () => {
  const ui = await controller(); try {
    ui.open(); fill(ui); const save = ui.button('Save field planting observation').props.onClick, pause = pauseHashes();
    act(() => { save(); save(); }); await pause.started; assert.equal(ui.records.length, 1);
    if (transition === 'source') fixture.events.dispatchEvent(new Event('imbewu-design-canvas-changed'));
    if (transition === 'actor') { actor('owner-b'); actor('owner-a'); }
    if (transition === 'sample') { samples.enterSampleMode(); samples.exitSampleMode(); }
    if (transition === 'dirty') ui.dirty();
    if (transition === 'reference') act(() => ui.renderer.root.findByProps({ 'aria-label': 'Your seed-lot reference (optional) — saved batch 1' }).props.onChange({ target: { value: 'Uncommitted label' } }));
    const writes = local.writes; await act(async () => { pause.resume(); await ui.records[0]; });
    assert.equal(local.writes, writes); assert.equal(JSON.parse(raw()).length, 0);
    await act(async () => save()); assert.equal(local.writes, writes);
    if (transition === 'reference') assert.equal(ui.proofs[0](), false);
  } finally { ui.close(); }
});

test('copied/old DTOs, proposed IDs and missing field-entry date cannot spend a current nursery-start view', async () => {
  const ui = await controller(); try {
    const writes = local.writes;
    assert.equal((await ui.workflow.onRecordNurseryFieldPlanting(structuredClone(ui.view), 'field-planting-member', input, () => true)).status, 'held');
    assert.equal((await ui.workflow.onRecordNurseryFieldPlanting(ui.view, 'proposed-only', input, () => true)).status, 'held');
    const { plannedFieldEntryDate: _planned, ...row } = ui.view.references[0];
    const old = { ...ui.view, references: [row] }; let renderer!: ReactTestRenderer;
    act(() => { renderer = create(React.createElement(Form, { view: old, plantingId: row.plantingId, contextRevision: 1, onRecord: async () => { throw Error('must not record'); } })); }); mounted.add(renderer);
    assert.match(text(renderer.root), /earlier checked batch/); assert.equal(renderer.root.findAllByType('input').length, 0); assert.equal(local.writes, writes);
  } finally { ui.close(); }
});

test('a genuine direct-sown field-entry task cannot acquire this accepted-nursery UI or controller action', async () => {
  const ui = await controller('direct'); try {
    assert.equal(ui.setup.task.growerEventKind, 'field-entry'); assert.deepEqual(ui.view.references, []);
    assert.equal(ui.renderer.root.findAllByType('button').some(node => text(node) === 'Record field planting'), false);
    const before = raw(), writes = local.writes;
    assert.equal((await ui.workflow.onRecordNurseryFieldPlanting(ui.view, 'field-planting-member', input, () => true)).status, 'held');
    assert.equal(raw(), before); assert.equal(local.writes, writes);
  } finally { ui.close(); }
});

test('actual parent mounts the same controller callback rather than a generic field-note or nursery-start action', () => {
  const source = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');
  const tree = ts.createSourceFile('page.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const callbacks: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(tree) === 'SavedGrowerNurseryReviewPanel') {
      for (const prop of node.attributes.properties) if (ts.isJsxAttribute(prop) && prop.name.getText(tree) === 'onRecordFieldPlanting' && prop.initializer && ts.isJsxExpression(prop.initializer)) callbacks.push(prop.initializer.expression?.getText(tree) ?? '');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.deepEqual(callbacks, ['growerWorkflow.onRecordNurseryFieldPlanting']);
});
