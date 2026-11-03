import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerPlanningProfile, GrowerInput } from '../lib/international/grower-planning.ts';
import type { GrowerOperationsPanelProps } from '../components/crops/GrowerOperationsPanel.tsx';

const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/lib/account-local-storage.ts') && specifier === './firebase/init') return {
      shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const isBackendConfigured=()=>false; export const getFirebase=()=>null;'),
    };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/crops/GrowerOperationsPanel.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
class Storage {
  rows = new Map<string, string>(); fail = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw Error('quota'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.fail = false; }
}
const local = new Storage(), session = new Storage();
Object.assign(globalThis, { Storage, localStorage: local, sessionStorage: session, IS_REACT_ACT_ENVIRONMENT: true,
  window: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }) });
const { default: Panel } = await import('../components/crops/GrowerOperationsPanel.tsx');
const { loadCompletedTaskIds } = await import('../lib/task-board.ts');
const { enterSampleMode, exitSampleMode } = await import('../lib/sample-mode.ts');
after(() => hooks.deregister());
beforeEach(() => { exitSampleMode(); local.clear(); session.clear(); });

// Engineering fixtures with explicit inputs; these durations are not crop guidance.
const recordedAt = '2028-11-01T00:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const scope = { kind: 'unmapped-workspace', workspaceId: 'design:fixture' } as const;
const bed = { id: 'private-fixture-bed', label: 'Measured fixture', areaM2: 2 };
const profile: GrowerPlanningProfile = { version: 1, profileId: 'private-fixture-profile', cropKey: CROPS[0].key, scope, inputs: {
  plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own('direct', 'method'),
  nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(1, 'days'),
  pickingDays: own(1, 'days'), fieldOccupancyDays: own(2, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months'),
} };
const proposal = generateGrowerAutoPlan({ requestedAt: recordedAt, scope, geometryFingerprint: 'private-fixture-geometry', profiles: [profile],
  beds: [{ bed, scope, measuredAreaM2: own(2, 'm2') }], planningStart: own('2028-12-30', 'utc-date'), planningEndExclusive: own('2029-01-05', 'utc-date'),
  availability: [{ bedId: bed.id, scope, window: own({ start: '2028-12-30', endExclusive: '2029-01-05' }, 'utc-date-window') }], reserved: [],
  demands: [{ demandId: 'private-fixture-demand', profileId: profile.profileId, scope, totalKg: own(1, 'kg-total'),
    harvestWindow: own({ start: '2028-12-31', endExclusive: '2029-01-02' }, 'utc-date-window') }], maxAssessments: 1000 });
assert.equal(proposal.status, 'ready');
const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: 'private-fixture-row', acceptedAt: recordedAt, geometryFingerprint: 'private-fixture-geometry' });
assert.ok(row);
const ready: GrowerOperationsPanelProps['state'] = { status: 'ready', book: { version: 1, plantings: [row], updatedAt: 1 },
  contexts: [{ scope, beds: [bed], geometryFingerprint: 'private-fixture-geometry' }], heldSources: [] };
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function mount(overrides: Partial<GrowerOperationsPanelProps> = {}) {
  const props: GrowerOperationsPanelProps = { state: ready, now: new Date('2030-02-01T00:00:00Z'),
    refresh: async () => {}, checkCurrent: async () => true, isCurrent: () => true, ...overrides };
  let renderer!: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Panel, props)); });
  return { props, text: () => text(renderer.root), get renderer() { return renderer; },
    update(patch: Partial<GrowerOperationsPanelProps>) { Object.assign(props, patch); act(() => renderer.update(React.createElement(Panel, props))); },
    click(label: string) { const button = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(button); return button.props.onClick(); },
    dispose() { act(() => renderer.unmount()); } };
}

test('dated work keeps actual years and planned boundaries without exposing private receipts or making records', () => {
  const screen = mount({ sample: true });
  try {
    assert.match(screen.text(), /2028-12-30/); assert.match(screen.text(), /2029-01-01/);
    assert.match(screen.text(), /DEMO — example planning data/); assert.match(screen.text(), /not observed work/);
    assert.match(screen.text(), /do not start another planting/);
    assert.doesNotMatch(screen.text(), /private-fixture|Prep bed|Weed|This month|2030-12/);
    assert.deepEqual(screen.renderer.root.findAllByType('a'), [], 'own cycles must not link into catalogue task/query instructions');
    assert.equal(local.rows.size, 0);
  } finally { screen.dispose(); }
});

test('device tour state cannot change initial server/client markup before effects mount the DEMO label', () => {
  const props: GrowerOperationsPanelProps = { state: ready, now: new Date('2030-02-01T00:00:00Z'),
    refresh: async () => {}, checkCurrent: async () => true, isCurrent: () => true };
  const server = renderToStaticMarkup(React.createElement(Panel, props));
  assert.equal(enterSampleMode(), true);
  try {
    const initialClientShape = renderToStaticMarkup(React.createElement(Panel, props));
    assert.equal(initialClientShape, server, 'device-only sample state must not insert an extra paragraph during hydration');
    const screen = mount();
    try { assert.match(screen.text(), /DEMO — example planning data/, 'the actual mounted UI must still disclose demo data'); }
    finally { screen.dispose(); }
  } finally { exitSampleMode(); }
});

test('held measurements remain visible as unresolved work, never empty-plan or free-capacity claims', () => {
  const screen = mount({ state: { ...ready, contexts: [], heldSources: [{ reason: 'private-unrendered-source' }] } });
  try {
    assert.match(screen.text(), /work remains withheld/); assert.match(screen.text(), /saved records are retained/);
    assert.doesNotMatch(screen.text(), /private-unrendered-source|2028-12-30|Mark checklist item done/);
  } finally { screen.dispose(); }
});

test('late account or source changes cannot mark a dated task complete after its asynchronous check', async () => {
  const pending = deferred<boolean>(); let actor = true;
  const screen = mount({ checkCurrent: () => pending.promise, isCurrent: () => actor });
  try {
    await act(async () => { screen.click('Mark checklist item done'); });
    actor = false;
    await act(async () => { pending.resolve(true); await pending.promise; });
    assert.equal(loadCompletedTaskIds().size, 0); assert.match(screen.text(), /saved plan or design changed/);
  } finally { screen.dispose(); }
});

test('a withdrawn ready result cannot complete or export an earlier dated task', async () => {
  const pending = deferred<boolean>(); const screen = mount({ checkCurrent: () => pending.promise });
  try {
    await act(async () => { screen.click('Mark checklist item done'); });
    screen.update({ state: { status: 'held', book: null, contexts: [], heldSources: [] } });
    await act(async () => { pending.resolve(true); await pending.promise; });
    assert.equal(loadCompletedTaskIds().size, 0); assert.doesNotMatch(screen.text(), /Checklist updated|2028-12-30/);
  } finally { screen.dispose(); }
});

test('calendar delivery uses the checked absolute date and refuses an invalidated source before downloading', async () => {
  const documentBefore = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const createBefore = URL.createObjectURL, revokeBefore = URL.revokeObjectURL;
  const blobs: Blob[] = []; let clicks = 0;
  Object.assign(globalThis, { document: { createElement: () => ({ href: '', download: '', click() { clicks++; } }),
    body: { appendChild() {}, removeChild() {} } } });
  URL.createObjectURL = blob => { blobs.push(blob as Blob); return 'blob:synthetic-calendar'; };
  URL.revokeObjectURL = () => {};
  const screen = mount({ checkCurrent: async () => false });
  try {
    await act(async () => { screen.click('Download planned-date calendar'); });
    assert.equal(clicks, 0); assert.equal(blobs.length, 0);
    screen.update({ checkCurrent: async () => true });
    await act(async () => { screen.click('Download planned-date calendar'); });
    assert.equal(clicks, 1); assert.equal(blobs.length, 1);
    const calendar = await blobs[0].text();
    assert.match(calendar, /DTSTART;VALUE=DATE:20281230/);
    assert.match(calendar, /DTEND;VALUE=DATE:20281231/);
    assert.doesNotMatch(calendar, /private-fixture|2030|RRULE|VALARM|first of/i);
    assert.match(screen.text(), /Calendar file prepared/);
  } finally {
    screen.dispose(); URL.createObjectURL = createBefore; URL.revokeObjectURL = revokeBefore;
    if (documentBefore) Object.defineProperty(globalThis, 'document', documentBefore); else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('a truly absent book is neutral while unreadable saved data remains explicitly held', () => {
  const screen = mount({ state: { status: 'held', book: null, contexts: [], heldSources: [{ reason: 'no-saved-plan' }] } });
  try {
    assert.match(screen.text(), /No saved dated plan yet/); assert.doesNotMatch(screen.text(), /could not be checked/);
    screen.update({ state: { status: 'held', book: null, contexts: [], heldSources: [{ reason: 'book-unavailable' }] } });
    assert.match(screen.text(), /Current saved records could not be checked/); assert.doesNotMatch(screen.text(), /No saved dated plan yet/);
  } finally { screen.dispose(); }
});

test('checklist persistence preserves unrelated work and a failed save never claims an update', async () => {
  local.setItem('imbewu_completed_tasks_v1', JSON.stringify(['unrelated-existing-task']));
  const screen = mount();
  try {
    local.fail = true;
    await act(async () => { screen.click('Mark checklist item done'); });
    assert.match(screen.text(), /checklist could not be saved/); assert.doesNotMatch(screen.text(), /Checklist updated/);
    local.fail = false;
    await act(async () => { screen.click('Mark checklist item done'); });
    assert.ok(loadCompletedTaskIds().has('unrelated-existing-task'));
    assert.match(screen.text(), /Production and stock records have not changed/);
    assert.equal(ready.book?.plantings.length, 1);
  } finally { screen.dispose(); }
});

test('the actual task-planner route mounts checked own work separately from month-only catalogue jobs', () => {
  const source = readFileSync(new URL('../app/cropplan/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /const operations = useGrowerOperations\(\)/);
  assert.match(source, /<GrowerOperationsPanel state=\{operations\} refresh=\{operations.refresh\}[\s\S]*checkCurrent=\{operations.checkCurrent\} isCurrent=\{operations.isCurrent\}/);
  assert.match(source, /operations.status === 'ready' && !hasOwnCycles/);
});
