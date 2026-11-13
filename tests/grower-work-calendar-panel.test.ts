import { provisionalCalendarFixture } from './provisional-calendar-fixture.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { createGrowerCyclePlanting } from '../lib/international/grower-cycle.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerOperationsPanelProps } from '../components/crops/GrowerOperationsPanel.tsx';

// Keep the actual cycle projector, checklist, sample mode and calendar writer.
// Firebase is the same unavailable-backend boundary as the existing panel suite.
const panelUrl = new URL('../components/crops/GrowerOperationsPanel.tsx', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/lib/account-local-storage.ts') && specifier === './firebase/init') return {
      shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent('export const isBackendConfigured=()=>false; export const getFirebase=()=>null;'),
    };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === panelUrl) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
class Storage {
  rows = new Map<string, string>(); writes = 0;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
  clear() { this.writes++; this.rows.clear(); }
}
const local = new Storage(), session = new Storage();
const originalGlobals = new Map(['Storage', 'localStorage', 'sessionStorage', 'window', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { Storage, localStorage: local, sessionStorage: session, IS_REACT_ACT_ENVIRONMENT: true,
  window: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }) });
const { default: Panel } = await import('../components/crops/GrowerOperationsPanel.tsx');
const { buildGrowerBoardTasks, loadCompletedTaskIds } = await import('../lib/task-board.ts');
const { enterSampleMode, exitSampleMode } = await import('../lib/sample-mode.ts');
after(() => {
  exitSampleMode(); hooks.deregister();
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
beforeEach(() => { exitSampleMode(); local.clear(); session.clear(); local.writes = 0; session.writes = 0; });

// Explicit engineering estimates exercise dates across a year boundary. They
// are accepted through the real planner, never offered as crop recommendations.
const recordedAt = '2028-11-01T00:00:00.000Z';
const own = <T, U extends string>(value: T, unit: U): GrowerInput<T, U> => ({ state: 'provided', value, unit,
  provenance: { kind: 'grower-estimate', recordedAt } });
const scope = { kind: 'unmapped-workspace', workspaceId: 'design:private-calendar-fixture' } as const;
const geometryFingerprint = 'private-calendar-geometry';
function acceptedFixture(method: 'direct' | 'transplant') {
  const bed = { id: `private-calendar-bed-${method}`, label: `Measured ${method} fixture`, areaM2: 2 };
  const profile: GrowerPlanningProfile = { version: 1, profileId: `private-calendar-profile-${method}`, cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(1, 'kg/m2/cycle'), establishment: own(method, 'method'),
    nurseryDays: method === 'transplant' ? own(1, 'days') : { state: 'missing', reason: 'not-applicable' },
    fieldEntryToFirstHarvestDays: own(1, 'days'), pickingDays: own(1, 'days'), fieldOccupancyDays: own(2, 'days'),
    turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months'),
  } };
  const proposal = generateGrowerAutoPlan({ requestedAt: recordedAt, scope, geometryFingerprint, profiles: [profile],
    beds: [{ bed, scope, measuredAreaM2: own(2, 'm2') }], planningStart: own('2028-12-29', 'utc-date'),
    planningEndExclusive: own('2029-01-05', 'utc-date'),
    availability: [{ bedId: bed.id, scope, window: own({ start: '2028-12-30', endExclusive: '2029-01-05' }, 'utc-date-window') }],
    reserved: [], demands: [{ demandId: `private-calendar-demand-${method}`, profileId: profile.profileId, scope,
      totalKg: own(1, 'kg-total'), harvestWindow: own({ start: '2028-12-31', endExclusive: '2029-01-02' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready'); assert.equal(proposal.cycles.length, 1);
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId: `private-calendar-row-${method}`, acceptedAt: recordedAt, geometryFingerprint });
  assert.ok(row); return { bed, row };
}
const direct = acceptedFixture('direct'), transplant = acceptedFixture('transplant');
const now = new Date('2030-02-01T00:00:00.000Z');
function ready(): GrowerOperationsPanelProps['state'] {
  return { status: 'ready', book: { version: 1, plantings: [direct.row, transplant.row], updatedAt: 1 },
    contexts: [{ scope, beds: [direct.bed, transplant.bed], geometryFingerprint }], heldSources: [] };
}
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node
  : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const allLabel = 'Download all checked planned dates';
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function mount(overrides: Partial<GrowerOperationsPanelProps> = {}) {
  let props: GrowerOperationsPanelProps = { state: ready(), now, refresh: async () => {},
    checkCurrent: async () => true, isCurrent: () => true, ...overrides };
  let renderer!: ReactTestRenderer, disposed = false;
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const buttons = (label: string) => renderer.root.findAllByType('button').filter(node => text(node) === label);
  const button = (label: string) => { const found = buttons(label)[0]; assert.ok(found, `Missing action: ${label}`); return found; };
  const renderUpdate = (patch: Partial<GrowerOperationsPanelProps>) => { props = { ...props, ...patch }; renderer.update(React.createElement(Panel, props)); };
  return { renderer, buttons, button, get props() { return props; }, text: () => text(renderer.root),
    handler(label = allLabel): () => void { return button(label).props.onClick; },
    update(patch: Partial<GrowerOperationsPanelProps>) { act(() => renderUpdate(patch)); },
    // A source callback can synchronously commit a parent update. Force that
    // real React commit before the callback returns, rather than merely enqueue it.
    syncUpdate(patch: Partial<GrowerOperationsPanelProps>) {
      const syncRenderer = renderer as ReactTestRenderer & { unstable_flushSync: (fn: () => void) => void };
      syncRenderer.unstable_flushSync(() => renderUpdate(patch));
    },
    dispose() { if (!disposed) { disposed = true; act(() => renderer.unmount()); } },
  };
}
async function invoke(handler: () => void) {
  await act(async () => { handler(); await Promise.resolve(); await Promise.resolve(); });
}
async function resolveCheck(gate: ReturnType<typeof deferred<boolean>>, value = true) {
  await act(async () => { gate.resolve(value); await gate.promise; await Promise.resolve(); await Promise.resolve(); });
}
type DeliveryPhase = 'url' | 'anchor' | 'append';
function delivery(onPhase: (phase: DeliveryPhase) => void = () => {}) {
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const priorCreate = URL.createObjectURL, priorRevoke = URL.revokeObjectURL;
  const blobs: Blob[] = [], downloads: Array<{ href: string; filename: string }> = [], revoked: string[] = [];
  const appended = new Set<object>(); let createdAnchors = 0, removed = 0;
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement(tag: string) {
      assert.equal(tag, 'a'); createdAnchors++; onPhase('anchor');
      return { href: '', download: '', click() { downloads.push({ href: this.href, filename: this.download }); } };
    },
    body: {
      appendChild(anchor: object) { appended.add(anchor); onPhase('append'); },
      removeChild(anchor: object) { assert.equal(appended.delete(anchor), true); removed++; },
    },
  } });
  URL.createObjectURL = blob => { blobs.push(blob as Blob); onPhase('url'); return `blob:calendar-${blobs.length}`; };
  URL.revokeObjectURL = url => { revoked.push(url); };
  return { blobs, downloads, revoked, appended, get createdAnchors() { return createdAnchors; }, get removed() { return removed; },
    restore() {
      URL.createObjectURL = priorCreate; URL.revokeObjectURL = priorRevoke;
      if (priorDocument) Object.defineProperty(globalThis, 'document', priorDocument); else Reflect.deleteProperty(globalThis, 'document');
    },
  };
}
function events(content: string) {
  assert.match(content, /^BEGIN:VCALENDAR\r\n/); assert.match(content, /END:VCALENDAR\r\n$/);
  assert.equal((content.match(/BEGIN:VCALENDAR/g) ?? []).length, 1);
  const unfolded = content.replace(/\r\n[ \t]/g, '');
  return [...unfolded.matchAll(/BEGIN:VEVENT\r\n([\s\S]*?)\r\nEND:VEVENT/g)].map(match => {
    const fields = new Map(match[1].split('\r\n').map(line => { const colon = line.indexOf(':'); return [line.slice(0, colon), line.slice(colon + 1)]; }));
    return { uid: fields.get('UID'), start: fields.get('DTSTART;VALUE=DATE'), end: fields.get('DTEND;VALUE=DATE'),
      summary: fields.get('SUMMARY'), description: fields.get('DESCRIPTION') };
  });
}
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

test('one bulk action downloads every displayed accepted event, including done items, with exact one-time UTC dates', async () => {
  const state = ready();
  const projected = buildGrowerBoardTasks(state.book!.plantings, state.contexts, now, new Set());
  assert.equal(projected.heldPlantings, 0); assert.equal(projected.tasks.length, 11);
  assert.deepEqual([...new Set(projected.tasks.map(task => task.growerEventKind))].sort(),
    ['field-clear', 'field-entry', 'first-pick', 'next-entry', 'nursery-start', 'picking-end']);
  local.setItem('imbewu_completed_tasks_v1', JSON.stringify([projected.tasks[0].id, 'unrelated-completed-item']));
  // Unrelated stored journal evidence is never an authority for these events.
  local.setItem('imbewu_field_journal_v1', JSON.stringify([{ id: 'saved-note', date: '2028-11-01', category: 'other', note: 'Existing observation' }]));
  const stored = [...local.rows], writes = local.writes, book = JSON.stringify(state.book); let observationWrites = 0;
  const transport = delivery(), ui = mount({ state, onRecordObservation: async () => { observationWrites++; return { status: 'held', message: 'Unexpected observation' }; } });
  try {
    assert.equal(ui.buttons(allLabel).length, 1); assert.equal(ui.button(allLabel).props.disabled, false);
    assert.match(ui.button(allLabel).props.className, /min-h-11/);
    assert.equal(ui.buttons('Reopen checklist item').length, 1);
    await invoke(ui.handler());
    assert.equal(transport.downloads.length, 1); assert.equal(transport.blobs.length, 1);
    assert.equal(transport.downloads[0].filename, 'grower-planned-dates.ics');
    assert.equal(transport.blobs[0].type, 'text/calendar;charset=utf-8');
    const content = await transport.blobs[0].text(), exported = events(content);
    assert.equal(exported.length, projected.tasks.length);
    assert.deepEqual(exported.map(event => event.uid).sort(), projected.tasks.map(task => `${task.id}@imbewufield.app`).sort());
    for (const task of projected.tasks) {
      const event = exported.find(event => event.uid === `${task.id}@imbewufield.app`); assert.ok(event);
      assert.equal(event.start, task.dueDate!.replace(/-/g, ''));
      const next = new Date(`${task.dueDate}T00:00:00.000Z`); next.setUTCDate(next.getUTCDate() + 1);
      assert.equal(event.end, next.toISOString().slice(0, 10).replace(/-/g, ''));
      assert.equal(event.summary, icsText(task.title)); assert.match(event.description ?? '', /not recorded work/);
    }
    assert.ok(exported.some(event => event.start === '20281229'));
    assert.ok(exported.some(event => event.start === '20281231' && event.end === '20290101'));
    assert.ok(exported.some(event => event.start === '20290102'));
    assert.doesNotMatch(content, /private-calendar|workspaceId|assessmentSnapshot|plantingId|journalLink|RRULE|VALARM/);
    assert.match(ui.text(), /all represented checked planned dates/); assert.match(ui.text(), /records no observed work/);
    assert.deepEqual(transport.revoked, ['blob:calendar-1']); assert.equal(transport.removed, 1); assert.equal(transport.appended.size, 0);
    assert.deepEqual([...local.rows], stored); assert.equal(local.writes, writes);
    assert.deepEqual(loadCompletedTaskIds(), new Set([projected.tasks[0].id, 'unrelated-completed-item']));
    assert.equal(JSON.stringify(state.book), book); assert.equal(observationWrites, 0);
  } finally { ui.dispose(); transport.restore(); }
});

for (const demo of ['prop', 'device'] as const) test(`${demo} demo exports disclose the example on every event and in the file name`, async () => {
  if (demo === 'device') assert.equal(enterSampleMode(), true);
  const transport = delivery(), ui = mount(demo === 'prop' ? { sample: true } : {});
  try {
    assert.match(ui.text(), /DEMO — example planning data/); await invoke(ui.handler());
    assert.equal(transport.downloads.length, 1); assert.equal(transport.downloads[0].filename, 'DEMO-grower-planned-dates.ics');
    const content = await transport.blobs[0].text(), exported = events(content);
    assert.equal(exported.length, 11);
    for (const event of exported) assert.match(`${event.summary} ${event.description}`, /DEMO/);
    assert.doesNotMatch(content, /private-calendar|RRULE|VALARM/);
    assert.equal(local.writes, 0, 'calendar delivery must not create observed, checklist or stock records');
  } finally { ui.dispose(); transport.restore(); exitSampleMode(); }
});

test('a represented held source or held planting prevents a partial bulk download even while other dated work remains visible', async () => {
  const base = ready();
  const malformed = { ...transplant.row, id: 'held-private-calendar-row', growerCycle: null };
  const variants: GrowerOperationsPanelProps['state'][] = [
    { ...base, heldSources: [{ reason: 'unchecked-current-design' }] },
    { ...base, book: { ...base.book!, plantings: [direct.row, malformed] } },
  ];
  for (const state of variants) {
    let checks = 0; const transport = delivery(), ui = mount({ state, checkCurrent: async () => { checks++; return true; } });
    try {
      assert.ok(ui.buttons('Download planned-date calendar').length > 0);
      assert.equal(ui.button(allLabel).props.disabled, true); assert.match(ui.text(), /before downloading all dates together/);
      await invoke(ui.handler()); assert.equal(checks, 0); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
    } finally { ui.dispose(); transport.restore(); }
  }
});

for (const unavailable of ['loading', 'absent', 'held', 'empty'] as const) test(`${unavailable} work cannot reuse an earlier bulk action to invent an empty or partial calendar`, async () => {
  let checks = 0; const transport = delivery(), ui = mount({ checkCurrent: async () => { checks++; return true; } });
  try {
    const retained = ui.handler();
    const state: GrowerOperationsPanelProps['state'] = unavailable === 'empty'
      ? { ...ready(), book: { version: 1, plantings: [], updatedAt: 2 } }
      : { status: unavailable === 'loading' ? 'loading' : 'held', book: null, contexts: [],
        heldSources: [{ reason: unavailable === 'absent' ? 'no-saved-plan' : 'book-unavailable' }] };
    ui.update({ state }); assert.equal(ui.buttons(allLabel).length, 0);
    await invoke(retained); assert.equal(checks, 0); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
  } finally { ui.dispose(); transport.restore(); }
});

for (const rejected of [false, 1, 'true', {}, null, undefined]) test(`an asynchronous checker result ${String(rejected)} grants no calendar authority unless it is boolean true`, async () => {
  const transport = delivery(), ui = mount({ checkCurrent: async () => rejected as boolean });
  try {
    await invoke(ui.handler()); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
    assert.match(ui.text(), /saved plan or design changed/); assert.doesNotMatch(ui.text(), /Calendar file prepared/);
  } finally { ui.dispose(); transport.restore(); }
});

for (const result of ['false', 'throw', 'truthy'] as const) test(`a ${result} current-source callback cannot download, before or after asynchronous checking`, async () => {
  for (const phase of ['before', 'after'] as const) {
    let checked = false, checks = 0;
    const transport = delivery(), ui = mount({ checkCurrent: async () => { checked = true; checks++; return true; }, isCurrent: () => {
      if (phase === 'after' && !checked) return true;
      if (result === 'throw') throw Error('private-current-source-receipt');
      return result === 'truthy' ? 1 as unknown as boolean : false;
    } });
    try {
      await invoke(ui.handler()); assert.equal(checks, phase === 'before' ? 0 : 1);
      assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
      assert.doesNotMatch(ui.text(), /private-current-source-receipt|Calendar file prepared/);
    } finally { ui.dispose(); transport.restore(); }
  }
});

test('a rejected asynchronous source check creates no file and a fresh checked attempt can recover', async () => {
  const transport = delivery(), ui = mount({ checkCurrent: async () => { throw Error('private-source-check-details'); } });
  try {
    await invoke(ui.handler()); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
    assert.doesNotMatch(ui.text(), /private-source-check-details|Calendar file prepared/);
    ui.update({ checkCurrent: async () => true }); await invoke(ui.handler()); assert.equal(transport.downloads.length, 1);
  } finally { ui.dispose(); transport.restore(); }
});

test('a detached handler cannot acquire export authority from a later render even if the same source state is still ready', async () => {
  let checks = 0; const transport = delivery(), ui = mount({ checkCurrent: async () => { checks++; return true; } });
  try {
    const retained = ui.handler(); ui.update({ now: new Date('2031-01-01T00:00:00Z') });
    await invoke(retained); assert.equal(checks, 0); assert.equal(transport.downloads.length, 0);
    await invoke(ui.handler()); assert.equal(checks, 1); assert.equal(transport.downloads.length, 1);
  } finally { ui.dispose(); transport.restore(); }
});

for (const transition of ['state', 'actor', 'checker', 'current-callback', 'sample-prop', 'device-demo', 'unmount'] as const) {
  test(`${transition} changing during a pending check withdraws its original complete calendar`, async () => {
    const gate = deferred<boolean>(); let actor = true;
    const transport = delivery(), ui = mount({ checkCurrent: () => gate.promise, isCurrent: () => actor });
    try {
      act(() => ui.handler()()); assert.equal(ui.button(allLabel).props.disabled, true);
      if (transition === 'state') ui.update({ state: ready() });
      if (transition === 'actor') actor = false;
      if (transition === 'checker') ui.update({ checkCurrent: async () => true });
      if (transition === 'current-callback') ui.update({ isCurrent: () => true });
      if (transition === 'sample-prop') ui.update({ sample: true });
      if (transition === 'device-demo') act(() => { assert.equal(enterSampleMode(), true); });
      if (transition === 'unmount') ui.dispose();
      await resolveCheck(gate); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
      if (transition !== 'unmount') assert.doesNotMatch(ui.text(), /Calendar file prepared/);
      assert.equal(local.writes, 0);
    } finally { ui.dispose(); transport.restore(); exitSampleMode(); }
  });
}

for (const transition of ['state', 'checker', 'current-callback', 'sample-prop', 'device-demo'] as const) {
  test(`${transition} changing away and back cannot revive the original pending calendar authority`, async () => {
    const gate = deferred<boolean>(); const transport = delivery(), ui = mount({ checkCurrent: () => gate.promise });
    try {
      const original = ui.props; act(() => ui.handler()());
      if (transition === 'state') { ui.update({ state: ready() }); ui.update({ state: original.state }); }
      if (transition === 'checker') { ui.update({ checkCurrent: async () => true }); ui.update({ checkCurrent: original.checkCurrent }); }
      if (transition === 'current-callback') { ui.update({ isCurrent: () => true }); ui.update({ isCurrent: original.isCurrent }); }
      if (transition === 'sample-prop') { ui.update({ sample: true }); ui.update({ sample: original.sample }); }
      if (transition === 'device-demo') { act(() => { assert.equal(enterSampleMode(), true); }); act(() => exitSampleMode()); }
      await resolveCheck(gate); assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
      assert.doesNotMatch(ui.text(), /Calendar file prepared/); assert.equal(local.writes, 0);
    } finally { ui.dispose(); transport.restore(); exitSampleMode(); }
  });
}

test('a duplicate click and task actions cannot overlap one pending complete-calendar check', async () => {
  const gate = deferred<boolean>(); let checks = 0, observations = 0;
  const transport = delivery(), ui = mount({ checkCurrent: () => { checks++; return gate.promise; },
    onRecordObservation: async () => { observations++; return { status: 'held', message: 'Unexpected recording' }; } });
  try {
    const retained = ui.handler(), checklist = ui.handler('Mark checklist item done'), single = ui.handler('Download planned-date calendar');
    act(() => { retained(); retained(); checklist(); single(); });
    assert.equal(checks, 1); assert.equal(ui.button(allLabel).props.disabled, true);
    await invoke(ui.handler('Record what happened'));
    assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    await resolveCheck(gate); assert.equal(transport.downloads.length, 1); assert.equal(checks, 1);
    assert.equal(local.writes, 0); assert.equal(observations, 0); assert.equal(loadCompletedTaskIds().size, 0);
  } finally { ui.dispose(); transport.restore(); }
});

test('a pending single-task check and a pending observation each block the retained bulk action', async () => {
  for (const operation of ['checklist', 'observation'] as const) {
    const gate = deferred<boolean>(); let checks = 0, observations = 0;
    const transport = delivery(), ui = mount({ checkCurrent: () => { checks++; return gate.promise; },
      onRecordObservation: async () => { observations++; return { status: 'held', message: 'Observation was held' }; } });
    try {
      const retained = ui.handler();
      if (operation === 'checklist') act(() => ui.handler('Mark checklist item done')());
      else {
        act(() => ui.handler('Record what happened')());
        const field = (label: string) => ui.renderer.root.findByProps({ 'aria-label': label });
        act(() => field('Date you observed this').props.onChange({ target: { value: '2028-12-30' } }));
        act(() => field('What happened').props.onChange({ target: { value: 'Engineering observation fixture.' } }));
        act(() => field('Confirm own observation').props.onChange({ target: { checked: true } }));
        act(() => ui.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }));
      }
      await invoke(retained); await invoke(ui.handler()); assert.equal(checks, 1);
      await resolveCheck(gate, false); assert.equal(transport.downloads.length, 0); assert.equal(transport.blobs.length, 0); assert.equal(observations, 0);
    } finally { ui.dispose(); transport.restore(); }
  }
});

test('entering and leaving device demo cancels the old request, and only fresh requests use each explicit context', async () => {
  const gate = deferred<boolean>(); const transport = delivery(), ui = mount({ checkCurrent: () => gate.promise });
  try {
    const retained = ui.handler(); act(() => retained());
    act(() => { assert.equal(enterSampleMode(), true); });
    ui.update({ checkCurrent: async () => true }); await invoke(ui.handler());
    assert.equal(transport.downloads.length, 1); assert.equal(transport.downloads[0].filename, 'DEMO-grower-planned-dates.ics');
    await resolveCheck(gate); assert.equal(transport.downloads.length, 1);
    const demoHandler = ui.handler(); act(() => exitSampleMode());
    await invoke(retained); await invoke(demoHandler); assert.equal(transport.downloads.length, 1);
    await invoke(ui.handler()); assert.equal(transport.downloads.length, 2); assert.equal(transport.downloads[1].filename, 'grower-planned-dates.ics');
    assert.doesNotMatch(await transport.blobs[1].text(), /DEMO/);
  } finally { ui.dispose(); transport.restore(); exitSampleMode(); }
});

for (const phase of ['initial-current', 'checker', 'checked-current'] as const) test(`${phase} cannot synchronously replace the parent source and return authority for the earlier events`, async () => {
  let ui!: ReturnType<typeof mount>, sourceCalls = 0, checkCalls = 0;
  const transport = delivery();
  ui = mount({ isCurrent: () => {
    sourceCalls++;
    if ((phase === 'initial-current' && sourceCalls === 1) || (phase === 'checked-current' && sourceCalls === 2)) ui.syncUpdate({ state: ready() });
    return true;
  }, checkCurrent: async () => { checkCalls++; if (phase === 'checker') ui.syncUpdate({ state: ready() }); return true; } });
  try {
    await invoke(ui.handler()); assert.equal(checkCalls, phase === 'initial-current' ? 0 : 1);
    assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0); assert.doesNotMatch(ui.text(), /Calendar file prepared/);
  } finally { ui.dispose(); transport.restore(); }
});

test('source callbacks reentering the exact retained bulk handler cannot create a second concurrent request or file', async () => {
  let retained!: () => void, checks = 0, reentries = 0;
  const transport = delivery(), ui = mount({ isCurrent: () => { if (retained) { reentries++; retained(); } return true; },
    checkCurrent: async () => { checks++; retained(); return true; } });
  try {
    retained = ui.handler(); await invoke(retained);
    assert.ok(reentries > 1); assert.equal(checks, 1); assert.equal(transport.downloads.length, 1); assert.equal(transport.blobs.length, 1);
  } finally { ui.dispose(); transport.restore(); }
});

for (const phase of ['url', 'anchor', 'append'] as const) test(`source invalidation during browser ${phase} preparation prevents the click and releases only the resources it created`, async () => {
  let actor = true;
  const transport = delivery(at => { if (at === phase) actor = false; }), ui = mount({ isCurrent: () => actor });
  try {
    await invoke(ui.handler()); assert.equal(transport.blobs.length, 1); assert.equal(transport.downloads.length, 0);
    assert.deepEqual(transport.revoked, ['blob:calendar-1']); assert.equal(transport.appended.size, 0);
    assert.equal(transport.createdAnchors, phase === 'url' ? 0 : 1); assert.equal(transport.removed, phase === 'append' ? 1 : 0);
    assert.doesNotMatch(ui.text(), /Calendar file prepared/); assert.equal(local.writes, 0);
  } finally { ui.dispose(); transport.restore(); }
});

for (const phase of ['url', 'anchor', 'append'] as const) test(`a parent source update during browser ${phase} preparation cannot deliver earlier checked dates`, async () => {
  let ui!: ReturnType<typeof mount>;
  const transport = delivery(at => { if (at === phase) ui.syncUpdate({ state: ready() }); }); ui = mount();
  try {
    await invoke(ui.handler()); assert.equal(transport.downloads.length, 0); assert.equal(transport.blobs.length, 1);
    assert.deepEqual(transport.revoked, ['blob:calendar-1']); assert.equal(transport.appended.size, 0); assert.doesNotMatch(ui.text(), /Calendar file prepared/);
  } finally { ui.dispose(); transport.restore(); }
});

for (const action of ['Mark checklist item done', 'Download planned-date calendar'] as const) {
  for (const transition of ['checker', 'current-callback', 'sample-prop', 'device-demo'] as const) {
    test(`${transition} during an individual ${action} check cannot leave the shared work controls permanently disabled`, async () => {
      const gate = deferred<boolean>(); let checks = 0, refreshes = 0;
      const transport = delivery(), ui = mount({ checkCurrent: () => { checks++; return gate.promise; },
        refresh: async () => { refreshes++; } });
      try {
        const originalState = ui.props.state;
        act(() => ui.handler(action)());
        assert.equal(checks, 1); assert.equal(ui.button(allLabel).props.disabled, true);
        assert.equal(ui.button('Check saved cycles and designs').props.disabled, true);
        if (transition === 'checker') ui.update({ checkCurrent: async () => true });
        if (transition === 'current-callback') ui.update({ isCurrent: () => true });
        if (transition === 'sample-prop') ui.update({ sample: true });
        if (transition === 'device-demo') act(() => { assert.equal(enterSampleMode(), true); });
        assert.equal(ui.props.state, originalState, 'recovery must not depend on receiving a replacement source object');
        // A refused old read grants no write authority. Its completion must
        // still release the busy state owned by that individual operation.
        await resolveCheck(gate, false);
        for (const label of [allLabel, 'Check saved cycles and designs', 'Mark checklist item done', 'Download planned-date calendar']) {
          assert.equal(ui.button(label).props.disabled, false, `${label} must recover after the individual check settles`);
        }
        assert.equal(checks, 1); assert.equal(transport.downloads.length, 0); assert.equal(transport.blobs.length, 0);
        assert.equal(local.writes, 0); assert.doesNotMatch(ui.text(), /Calendar file prepared|Checklist updated/);
        await invoke(ui.handler('Check saved cycles and designs')); assert.equal(refreshes, 1);
      } finally { ui.dispose(); transport.restore(); exitSampleMode(); }
    });
  }
}


test('actual individual and detached bulk downloads retain a provisional cycle’s public evidence and current-source guards', async () => {
  const f = await provisionalCalendarFixture(), state = { status: 'ready' as const,
    book: { version: 1 as const, plantings: [f.row], updatedAt: 1 }, contexts: [f.context], heldSources: [] };
  const transport = delivery(), ui = mount({ state, sample: false });
  try {
    assert.match(ui.text(), /Provisional evidence and limits/); assert.match(ui.text(), /mipmcar9781.pdf/);
    await invoke(ui.handler()); assert.equal(transport.blobs.length, 1);
    const all = await transport.blobs[0].text(); assert.equal(events(all).length, 6);
    for (const event of events(all)) { assert.match(event.description!, /provisional planned cycle/); assert.match(event.description!, /mipmcar9781.pdf/); }
    await invoke(ui.handler('Download planned-date calendar')); assert.equal(transport.blobs.length, 2);
    assert.match((await transport.blobs[1].text()).replace(/\r\n[ \t]/g, ''), /mipmcar9781.pdf/);
    ui.update({ state: { ...state, contexts: [{ ...f.context, provisionalContext: { ...f.context.provisionalContext, countryCode: 'GB' } }] } });
    assert.doesNotMatch(ui.text(), /mipmcar9781.pdf/); assert.equal(ui.buttons(allLabel).length, 0);
  } finally { transport.restore(); ui.dispose(); }
});

test('pending provisional calendar cannot deliver its captured evidence after a country/source round trip', async () => {
  const f = await provisionalCalendarFixture(), state = { status: 'ready' as const,
    book: { version: 1 as const, plantings: [f.row], updatedAt: 1 }, contexts: [f.context], heldSources: [] };
  const gate = deferred<boolean>(), transport = delivery(), ui = mount({ state, checkCurrent: () => gate.promise });
  try {
    const old = ui.handler(); await invoke(old); assert.equal(transport.blobs.length, 0);
    ui.update({ state: { ...state, contexts: [{ ...f.context, provisionalContext: { ...f.context.provisionalContext, countryCode: 'GB' } }] } });
    ui.update({ state }); await resolveCheck(gate);
    assert.equal(transport.blobs.length, 0); assert.equal(transport.downloads.length, 0);
    await invoke(old); assert.equal(transport.downloads.length, 0);
  } finally { transport.restore(); ui.dispose(); }
});
