import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { BoardTask } from '../lib/task-board.ts';
import type { GrowerOperationsPanelProps, GrowerObservationInput, GrowerObservationResult } from '../components/crops/GrowerOperationsPanel.tsx';

// These tests control only the panel's already-checked task/callback boundary.
// Canonical cycle links, actual storage and account authority have separate tests.
const probe = { tasks: [] as BoardTask[], generated: [] as BoardTask[], sample: false, checklistWrites: 0, calendars: 0 };
Object.assign(globalThis, { __observationPanel: probe, IS_REACT_ACT_ENVIRONMENT: true });
const panelUrl = new URL('../components/crops/GrowerOperationsPanel.tsx', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === panelUrl && specifier === '@/lib/task-board') return data(`
    const p=globalThis.__observationPanel;
    export function buildGrowerBoardTasks(){p.generated=p.tasks.map(task=>({...task}));return {tasks:p.generated,heldPlantings:0};}
    export const loadCompletedTaskIds=()=>new Set();
    export const setCompletedTaskState=(id,done)=>{p.checklistWrites++;return new Set(done?[id]:[]);};
    export const downloadTaskIcs=()=>{p.calendars++;return true;};`);
  if (context.parentURL === panelUrl && specifier === '@/lib/sample-mode') return data(`
    export const SAMPLE_MODE_EVENT='imbewu-sample-mode-changed';
    export const isSampleMode=()=>globalThis.__observationPanel.sample;`);
  if (context.parentURL?.endsWith('/lib/account-local-storage.ts') && specifier === './firebase/init')
    return data('export const isBackendConfigured=()=>false;export const getFirebase=()=>null;');
  return next(specifier, context);
}, load(url, context, next) {
  if (url === panelUrl) return { format: 'module', shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText };
  return next(url, context);
} });
const priorWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let events: EventTarget;
beforeEach(() => {
  events = new EventTarget(); Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
  probe.tasks = [task()]; probe.sample = false; probe.checklistWrites = 0; probe.calendars = 0;
});
after(() => {
  hooks.deregister(); Reflect.deleteProperty(globalThis, '__observationPanel');
  if (priorWindow) Object.defineProperty(globalThis, 'window', priorWindow); else Reflect.deleteProperty(globalThis, 'window');
});
const { default: Panel } = await import('../components/crops/GrowerOperationsPanel.tsx');
function task(id = 'fixture-task', kind: BoardTask['growerEventKind'] = 'next-entry'): BoardTask {
  const value: BoardTask = { id, kind: 'grower-cycle', title: 'Planned next-entry boundary', subtitle: 'Availability boundary only',
    icon: '', dueDate: '2028-03-07', dueMonth: 3, monthsAway: 0, completed: false, growerEventKind: kind };
  // An opaque fixture marker stands in for the real producer's validated link.
  return Object.assign(value, { growerJournalLink: Object.freeze({ fixture: id }) });
}
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function state(): GrowerOperationsPanelProps['state'] {
  return { status: 'ready', book: { version: 1, plantings: [], updatedAt: 1 }, contexts: [], heldSources: [] };
}
function mount(overrides: Partial<GrowerOperationsPanelProps> = {}) {
  const attempts: Array<{ task: BoardTask; input: GrowerObservationInput; current: () => boolean }> = [];
  let handler: NonNullable<GrowerOperationsPanelProps['onRecordObservation']> = async () => ({ status: 'saved', message: 'Observation saved in your journal.', journalEntryId: 'fixture-entry' });
  let check: () => Promise<boolean> = async () => true, checks = 0, current = true;
  const props: GrowerOperationsPanelProps = { state: state(), refresh: async () => {},
    checkCurrent: () => { checks++; return check(); }, isCurrent: () => current,
    onRecordObservation: async (task, input, isCurrent) => { attempts.push({ task, input, current: isCurrent }); return handler(task, input, isCurrent); }, ...overrides };
  let renderer!: ReactTestRenderer, disposed = false;
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const buttons = (label: string) => renderer.root.findAllByType('button').filter(node => text(node) === label);
  const button = (label: string) => { const result = buttons(label)[0]; assert.ok(result, `Missing action ${label}`); return result; };
  const field = (label: string) => renderer.root.findByProps({ 'aria-label': label });
  return { renderer, props, attempts, button, buttons, field, text: () => text(renderer.root), checks: () => checks,
    open(index = 0) { act(() => buttons('Record what happened')[index].props.onClick()); },
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    confirm(value = true) { act(() => field('Confirm own observation').props.onChange({ target: { checked: value } })); },
    fill() { this.change('Date you observed this', '2028-03-09'); this.change('What happened', 'I checked the ground and recorded what I saw.'); this.confirm(); },
    async submit() { await act(async () => { const result = renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }); await result; await Promise.resolve(); }); },
    cancel() { act(() => button('Cancel observation').props.onClick()); },
    update(next: Partial<GrowerOperationsPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    setCheck(next: typeof check) { check = next; }, setCurrent(value: boolean) { current = value; }, setSave(next: typeof handler) { handler = next; },
    dispose() { if (!disposed) { disposed = true; act(() => renderer.unmount()); } },
  };
}
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

test('recording is optional and only an own dated task with a real supplied link can open the form', () => {
  let ui = mount({ onRecordObservation: undefined });
  try { assert.equal(ui.buttons('Record what happened').length, 0); } finally { ui.dispose(); }
  const plain = task(); Reflect.deleteProperty(plain, 'growerJournalLink'); probe.tasks = [plain]; ui = mount();
  try { assert.equal(ui.buttons('Record what happened').length, 0); } finally { ui.dispose(); }
  probe.tasks = [{ ...task(), kind: 'crop' }]; ui = mount();
  try { assert.equal(ui.buttons('Record what happened').length, 0); } finally { ui.dispose(); }
});

test('the observed date and note start blank with no confirmation or planned-date substitution', async () => {
  const ui = mount(); try {
    ui.open(); assert.equal(ui.field('Date you observed this').props.value, ''); assert.equal(ui.field('What happened').props.value, '');
    assert.equal(ui.field('Confirm own observation').props.checked, false);
    assert.match(ui.text(), /2028-03-07 \(UTC date\)/); assert.match(ui.text(), /not another planting or proof that the bed is free/);
    assert.match(ui.text(), /does not mark the checklist done/); await ui.submit(); assert.equal(ui.attempts.length, 0);
    assert.match(ui.text(), /Enter the date you observed/);
    ui.change('Date you observed this', '2028-02-31'); ui.change('What happened', 'A real note.'); ui.confirm(); await ui.submit(); assert.equal(ui.attempts.length, 0);
    ui.change('Date you observed this', '2028-03-09'); assert.equal(ui.field('Confirm own observation').props.checked, false);
    ui.confirm(); ui.change('What happened', '  '); ui.confirm(); await ui.submit(); assert.equal(ui.attempts.length, 0);
  } finally { ui.dispose(); }
});

test('a successful save passes the exact shown task and confirmed observation once, then offers the actual journal without ticking a task', async () => {
  const gate = deferred<boolean>(), ui = mount();
  try {
    const shown = probe.generated[0]; ui.open(); ui.fill(); ui.setCheck(() => gate.promise);
    const submit = ui.renderer.root.findByType('form').props.onSubmit;
    act(() => { submit({ preventDefault() {} }); submit({ preventDefault() {} }); });
    assert.equal(ui.checks(), 1); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /Checking and saving/);
    await act(async () => { gate.resolve(true); await Promise.resolve(); await Promise.resolve(); }); await flush();
    assert.equal(ui.attempts.length, 1); assert.equal(ui.attempts[0].task, shown);
    assert.deepEqual(ui.attempts[0].input, { observedDate: '2028-03-09', note: 'I checked the ground and recorded what I saw.', confirmed: true });
    assert.equal(Object.isFrozen(ui.attempts[0].input), true); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    assert.match(ui.text(), /Observation saved in your journal/); assert.equal(ui.renderer.root.findByType('a').props.href, '/journal');
    await act(async () => { submit({ preventDefault() {} }); }); assert.equal(ui.attempts.length, 1);
    assert.equal(probe.checklistWrites, 0); assert.equal(probe.calendars, 0);
  } finally { ui.dispose(); }
});

test('failed source checks and held receipts keep the note without claiming a journal save', async () => {
  const ui = mount(); try {
    ui.open(); ui.fill(); ui.setCheck(async () => false); await ui.submit(); assert.equal(ui.attempts.length, 0);
    assert.match(ui.text(), /saved plan or design changed/); assert.equal(ui.field('What happened').props.value, 'I checked the ground and recorded what I saw.');
    ui.setCheck(async () => true); ui.setSave(async () => ({ status: 'held', message: 'The journal is held. Check its current records.' })); await ui.submit();
    assert.equal(ui.attempts.length, 1); assert.match(ui.text(), /journal is held/); assert.equal(ui.renderer.root.findAllByType('a').length, 0);
    assert.equal(ui.button('Save observation in journal').props.disabled, false);
  } finally { ui.dispose(); }
});

for (const failure of ['unconfirmed', 'throw'] as const) {
  test(`${failure} after a save attempt offers the journal and prevents a duplicate retry`, async () => {
    const ui = mount(); try {
      ui.open(); ui.fill(); ui.setSave(async () => {
        if (failure === 'throw') throw Error('private raw journal bytes');
        return { status: 'unconfirmed', message: 'A note may have been saved; check the journal.' };
      }); await ui.submit();
      assert.equal(ui.attempts.length, 1); assert.equal(ui.button('Save observation in journal').props.disabled, true);
      assert.equal(ui.field('What happened').props.disabled, true); assert.equal(ui.renderer.root.findByType('a').props.href, '/journal');
      assert.match(ui.text(), /A note may already be saved/); assert.doesNotMatch(ui.text(), /private raw journal bytes/);
      await ui.submit(); assert.equal(ui.attempts.length, 1); ui.cancel();
      assert.equal(ui.button('Record what happened').props.disabled, true); ui.open(); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    } finally { ui.dispose(); }
  });
}

for (const phase of ['check', 'save'] as const) for (const transition of ['state', 'sample-event', 'sample-prop', 'cancel', 'unmount', 'actor'] as const) {
  test(`${transition} withdraws a pending ${phase} and its original form proof permanently`, async () => {
    const checkGate = deferred<boolean>(), saveGate = deferred<GrowerObservationResult>(), ui = mount();
    try {
      ui.open(); ui.fill();
      if (phase === 'check') ui.setCheck(() => checkGate.promise); else ui.setSave(() => saveGate.promise);
      act(() => ui.renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); await flush();
      const oldState = ui.props.state;
      if (transition === 'state') { ui.update({ state: state() }); ui.update({ state: oldState }); }
      if (transition === 'sample-event') act(() => { probe.sample = true; events.dispatchEvent(new Event('imbewu-sample-mode-changed')); probe.sample = false; events.dispatchEvent(new Event('imbewu-sample-mode-changed')); });
      if (transition === 'sample-prop') { ui.update({ sample: true }); ui.update({ sample: undefined }); }
      if (transition === 'cancel') ui.cancel();
      if (transition === 'unmount') ui.dispose();
      if (transition === 'actor') ui.setCurrent(false);
      if (phase === 'save') assert.equal(ui.attempts[0].current(), false);
      await act(async () => {
        if (phase === 'check') checkGate.resolve(true); else saveGate.resolve({ status: 'saved', message: 'Obsolete success from old context' });
        await Promise.resolve(); await Promise.resolve();
      }); await flush();
      if (phase === 'check') assert.equal(ui.attempts.length, 0);
      if (transition !== 'unmount') assert.doesNotMatch(ui.text(), /Obsolete success/);
      assert.equal(probe.checklistWrites, 0); assert.equal(probe.calendars, 0);
    } finally { ui.dispose(); }
  });
}

test('switching tasks discards the old draft, preserves each planned interval explanation, and old submit callbacks cannot acquire the new form', async () => {
  probe.tasks = [task('one', 'next-entry'), task('two', 'picking-end')];
  const ui = mount(); try {
    ui.open(); ui.fill(); const old = ui.renderer.root.findByType('form').props.onSubmit;
    ui.open(1); assert.equal(ui.field('Date you observed this').props.value, ''); assert.equal(ui.field('What happened').props.value, '');
    assert.match(ui.text(), /planned interval boundary/); assert.match(ui.text(), /does not prove that picking ended/);
    await act(async () => { old({ preventDefault() {} }); }); assert.equal(ui.attempts.length, 0);
  } finally { ui.dispose(); }
});

test('sample copy remains explicit and observation controls retain phone-sized touch targets', () => {
  probe.sample = true; const ui = mount({ sample: true }); try {
    ui.open(); assert.match(ui.text(), /DEMO observation — sample journal only/);
    assert.match(ui.button('Record what happened').props.className, /min-h-11/);
    assert.match(ui.button('Save observation in journal').props.className, /min-h-11/);
    assert.match(ui.field('Date you observed this').props.className, /min-h-11.*min-w-0/);
    assert.match(ui.field('What happened').props.className, /min-w-0/);
  } finally { ui.dispose(); }
});
