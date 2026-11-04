import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { configureFieldBlock } from '../lib/bed-block.ts';
import { fieldBlockSourceKey } from '../lib/field-block-allocations.ts';
import type { CanvasFrame, DesignCanvasState } from '../lib/design-canvas.ts';
import type { FieldLayoutExportRequest, FieldLayoutExportResult } from '../components/design/FieldBlocksPanel.tsx';

const panelUrl = new URL('../components/design/FieldBlocksPanel.tsx', import.meta.url).href;
const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { React, actor: 'owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __fieldExportPanel: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>true;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__fieldExportPanel.actor;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__fieldExportPanel;p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  if (context.parentURL === panelUrl && specifier === 'next/link') return data(`
    const React=globalThis.__fieldExportPanel.React;export default function Link({children,...props}){return React.createElement('a',props,children);}`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === panelUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/design/FieldBlocksPanel.tsx');
const account = await import('../lib/account-local-storage.ts');
class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, value); }
  removeItem(key: string) { this.rows.delete(key); }
}
let local: MemoryStorage, session: MemoryStorage, events: EventTarget;
beforeEach(() => {
  probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
after(() => { hooks.deregister(); account.bindMountedAccountLocalStorageUid(null); delete (globalThis as Record<string, unknown>).__fieldExportPanel; });
const frame: CanvasFrame = { centerLat: 0, centerLng: 0, zoom: 18, imgW: 100, imgH: 100, mPerPx: 0.2, satDataUrl: null };
function canvas(): DesignCanvasState {
  // Synthetic applied geometry only, not a planting recommendation or survey.
  return { siteId: 'site:0.00000,0.00000', frame: { ...frame }, step: 'planting', updatedAt: '2026-11-04T12:00:00.000Z', rev: 1,
    zones: [
      { id: 'field-a', feature: 'staple_garden', zone: 2, name: 'Private field A', points: [[0.1,0.1],[0.45,0.1],[0.45,0.9],[0.1,0.9]], fieldBlock: { mode:'beds',bedLengthM:3,bedWidthM:1,pathWidthM:0.5,angleDeg:0 } },
      { id: 'field-b', feature: 'staple_garden', zone: 2, name: 'Private field B', points: [[0.6,0.1],[0.9,0.1],[0.9,0.9],[0.6,0.9]], fieldBlock: { mode:'open',bedLengthM:3,bedWidthM:1,pathWidthM:0.5,angleDeg:0 } },
    ],
    items: [{ id:'field-a:bed:1',defId:'veg_bed',fieldBlockId:'field-a',x:0.2,y:0.3,wM:1,hM:3,rot:0,label:'Private field A / Bed 1' }],
    lines: [{ id:'field-a:path:1',kind:'bedpath',fieldBlockId:'field-a',points:[[0.15,0.2],[0.4,0.2]],widthM:0.5,name:'Private field path' }] };
}
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const exportLabel = 'Export field layout for Google Earth';
type Props = React.ComponentProps<typeof Panel>;
function mount(overrides: Partial<Props> = {}, enabled = true) {
  let renderer!: ReactTestRenderer;
  const requests: FieldLayoutExportRequest[] = [], guards: Array<() => boolean> = [], applied: unknown[] = [];
  let applyHandler: Props['onApply'] | null = null;
  let handler: NonNullable<Props['onExport']> = async () => ({ status: 'downloaded', message: 'Synthetic file delivered.' });
  const props: Props = { state: canvas(), frame: { ...frame }, selectedId: 'field-a', onDraw() {},
    onSelect(id) { props.selectedId = id; renderer.update(React.createElement(Panel, props)); },
    onApply(...args) { applied.push(args); applyHandler?.(...args); },
    ...(enabled ? { onExport: async (request: FieldLayoutExportRequest, current: () => boolean) => {
      requests.push(structuredClone(request)); guards.push(current); return handler(request, current);
    } } : {}), ...overrides };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => { const node = renderer.root.findAll(node => node.props['aria-label'] === label)[0]; assert.ok(node, `Missing field ${label}`); return node; };
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(node, `Missing action ${label}`); return node; };
  return { renderer, props, requests, guards, applied, field, button, text: () => text(renderer.root),
    handle(next: typeof handler) { handler = next; },
    handleApply(next: Props['onApply']) { applyHandler = next; },
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(value: boolean) { act(() => field('Include saved field labels').props.onChange({ target: { checked: value } })); },
    update(next: Partial<Props>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    async export() { await act(async () => { await button(exportLabel).props.onClick(); }); },
    dispose() { act(() => renderer.unmount()); } };
}
function pending() {
  let resolve!: (result: FieldLayoutExportResult) => void, reject!: (error: Error) => void;
  const promise = new Promise<FieldLayoutExportResult>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function actor(uid: string | null, observe = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observe) for (const next of probe.auth) next(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.setItem('imbewu_sample_mode', '1'); else session.removeItem('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}

test('the optional export extension adds no action when absent and preserves the existing editor and planner link', () => {
  const ui = mount({}, false); try {
    assert.equal(ui.renderer.root.findAllByType('button').filter(node => text(node) === exportLabel).length, 0);
    assert.equal(ui.field('Bed width (m)').props.value, '1'); assert.ok(ui.button('Save field layout'));
    assert.equal(ui.renderer.root.findAllByType('a')[0].props.href, '/facilitator/crops?canvasSite=site%3A0.00000%2C0.00000&auto=1');
    assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('a deliberate selected export sends only the saved-field request, with labels private by default and unfinished editor dimensions retained', async () => {
  const ui = mount(); try {
    const before = JSON.stringify(ui.props.state); ui.change('Bed width (m)', '-');
    assert.equal(ui.field('Include saved field labels').props.checked, false); assert.equal(ui.requests.length, 0);
    assert.equal(ui.button(exportLabel).props.style.minHeight, 44); assert.equal(ui.field('Export fields').props.style.minHeight, 44);
    await ui.export(); assert.deepEqual(ui.requests, [{ fieldId:'field-a',allFields:false,includeLabels:false }]);
    assert.equal(ui.guards[0](), true); assert.equal(ui.applied.length, 0); assert.equal(JSON.stringify(ui.props.state), before);
    assert.equal(ui.field('Bed width (m)').props.value, '-'); assert.match(ui.text(), /Synthetic file delivered/);
  } finally { ui.dispose(); }
});

test('All fields remains available with no selection, while selected export is disabled and label inclusion is deliberate', async () => {
  const ui = mount({ selectedId: null }); try {
    assert.equal(ui.button(exportLabel).props.disabled, true); await ui.export(); assert.equal(ui.requests.length, 0);
    ui.change('Export fields', 'all'); ui.check(true); assert.equal(ui.button(exportLabel).props.disabled, false);
    await ui.export(); assert.deepEqual(ui.requests, [{fieldId:null,allFields:true,includeLabels:true}]); assert.equal(ui.guards[0](), true);
    assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('a selected generated bed resolves to its parent field without changing canvas selection or geometry', async () => {
  const ui = mount({ selectedId: 'field-a:bed:1' }); try {
    const before = JSON.stringify(ui.props.state); await ui.export();
    assert.equal(ui.requests[0].fieldId, 'field-a'); assert.equal(ui.props.selectedId, 'field-a:bed:1');
    assert.equal(JSON.stringify(ui.props.state), before); assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('busy export refuses duplicate clicks, reports cancellation or held results truthfully and keeps entered settings', async () => {
  const gate = pending(), ui = mount(); let completion!: Promise<void>;
  try {
    ui.change('Bed length (m)', '7,25'); ui.handle(() => gate.promise);
    const click = ui.button(exportLabel).props.onClick; act(() => { completion = click(); });
    assert.equal(ui.button(exportLabel).props.disabled, true); act(() => { void click(); }); assert.equal(ui.requests.length, 1);
    await act(async () => { gate.resolve({status:'cancelled',message:'Export cancelled.'}); await completion; });
    assert.match(ui.text(), /Export cancelled/); assert.equal(ui.field('Bed length (m)').props.value, '7,25'); assert.equal(ui.applied.length, 0);
    ui.handle(async () => ({status:'held',message:'Check the saved map reference first.'})); await ui.export();
    assert.match(ui.text(), /Check the saved map reference/); assert.equal(ui.field('Bed length (m)').props.value, '7,25');
    ui.handle(async () => { throw Error('private raw source'); }); await ui.export();
    assert.match(ui.text(), /Could not export the field layout/); assert.doesNotMatch(ui.text(), /private raw source/);
    assert.equal(ui.field('Bed length (m)').props.value, '7,25'); assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('changing export options withdraws the parent delivery guard permanently for the pending request, even after reverting', async () => {
  const gate = pending(), ui = mount(); let completion!: Promise<void>;
  try {
    ui.handle(() => gate.promise); act(() => { completion = ui.button(exportLabel).props.onClick(); });
    const current = ui.guards[0]; assert.equal(current(), true);
    act(() => {
      ui.field('Include saved field labels').props.onChange({target:{checked:true}});
      assert.equal(current(), false, 'withdraw before React commits so a reentrant fallback cannot deliver old label options');
    });
    ui.check(false); assert.equal(current(), false);
    await act(async () => { gate.resolve({status:'downloaded',message:'Obsolete private file success.'}); await completion; });
    assert.doesNotMatch(ui.text(), /Obsolete private file success/); assert.equal(ui.requests.length, 1); assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('geometry, paths, saved names and child labels each withdraw an awaiting export without changing the dimension editor authority', async () => {
  const changes: Array<(state: DesignCanvasState) => void> = [
    state => { state.zones[0].points[0][0] += 0.01; },
    state => { state.zones[0].name = 'Changed saved field name'; },
    state => { state.items[0].label = 'Changed private child label'; },
    state => { state.lines[0].points[0][1] += 0.01; },
    state => { state.lines[0].widthM = 0.75; },
    state => { state.lines[0].name = 'Changed saved path name'; },
    state => { state.zones[1].name = 'Changed second field name'; },
    state => { state.frame.mPerPx = 0.25; },
    state => { state.rev = 2; },
  ];
  for (const change of changes) {
    const gate = pending(), ui = mount(); let completion!: Promise<void>;
    try {
      ui.handle(() => gate.promise); act(() => { completion = ui.button(exportLabel).props.onClick(); });
      const replacement = structuredClone(ui.props.state); change(replacement); ui.update({state:replacement});
      assert.equal(ui.guards[0](), false);
      await act(async () => { gate.resolve({status:'shared',message:'Obsolete shared file success.'}); await completion; });
      assert.doesNotMatch(ui.text(), /Obsolete shared file success/); assert.equal(ui.applied.length, 0);
    } finally { ui.dispose(); }
  }
});

test('selection or live frame changes withdraw pending delivery and retained callbacks cannot acquire the new export generation', async () => {
  for (const selection of [true, false]) {
    const gate = pending(), ui = mount(); let completion!: Promise<void>;
    try {
      const staleClick = ui.button(exportLabel).props.onClick; ui.handle(() => gate.promise);
      act(() => { completion = staleClick(); });
      ui.update(selection ? {selectedId:'field-b'} : {frame:{...frame,centerLng:0.001}});
      assert.equal(ui.guards[0](), false); act(() => { void staleClick(); }); assert.equal(ui.requests.length, 1);
      await act(async () => { gate.resolve({status:'downloaded',message:'Obsolete selected result.'}); await completion; });
      act(() => { void staleClick(); }); assert.equal(ui.requests.length, 1);
      assert.doesNotMatch(ui.text(), /Obsolete selected result/);
    } finally { ui.dispose(); }
  }
});

test('actor and sample round trips before completion revoke file delivery independently of whether an old callback was attempted while away', async () => {
  for (const transition of ['actor','sample'] as const) {
    const gate = pending(), ui = mount(); let completion!: Promise<void>;
    try {
      ui.handle(() => gate.promise); act(() => { completion = ui.button(exportLabel).props.onClick(); });
      const current = ui.guards[0];
      act(() => { if (transition === 'actor') { actor('owner-b'); actor('owner-a'); } else { sample(true); sample(false); } });
      assert.equal(current(), false);
      await act(async () => { gate.resolve({status:'downloaded',message:'Obsolete actor result.'}); await completion; });
      assert.doesNotMatch(ui.text(), /Obsolete actor result/); assert.equal(ui.applied.length, 0);
      assert.equal(ui.requests.length, 1);
    } finally { ui.dispose(); }
  }
});

test('a pre-observer account change refuses the click before invoking the exporter and never recaptures the next account', async () => {
  const ui = mount(); try {
    const click = ui.button(exportLabel).props.onClick;
    actor('owner-b', false); await act(async () => { await click(); }); assert.equal(ui.requests.length, 0);
    actor('owner-a', false); await act(async () => { await click(); }); assert.equal(ui.requests.length, 0);
    assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});

test('unmount immediately withdraws the actual delivery guard and suppresses late messages without applying a layout', async () => {
  const gate = pending(), ui = mount(); let completion!: Promise<void>;
  ui.handle(() => gate.promise); act(() => { completion = ui.button(exportLabel).props.onClick(); });
  const current = ui.guards[0]; assert.equal(current(), true); ui.dispose(); assert.equal(current(), false);
  await act(async () => { gate.resolve({status:'shared',message:'Detached success.'}); await completion; });
  assert.equal(ui.applied.length, 0); assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
});


test('retained click callbacks cannot acquire new options before first invocation, while the current action still works', async () => {
  const ui = mount(); try {
    const staleClick = ui.button(exportLabel).props.onClick; ui.check(true);
    await act(async () => { await staleClick(); }); assert.equal(ui.requests.length, 0);
    await ui.export(); assert.deepEqual(ui.requests, [{fieldId:'field-a',allFields:false,includeLabels:true}]);
    assert.equal(ui.guards[0](), true); assert.equal(ui.applied.length, 0);
  } finally { ui.dispose(); }
});


test('the exact acknowledged committed own-save loads its applied canonical settings and keeps preview and Save usable without Reload', () => {
  const ui = mount(); try {
    ui.change('Field name', 'Applied synthetic field'); ui.change('Bed length (m)', '4'); ui.change('Bed width (m)', '1'); ui.change('Path width (m)', '0,75');
    const oldSave = ui.button('Save field layout').props.onClick;
    ui.handleApply((id, name, config, acknowledge) => {
      const next = configureFieldBlock(ui.props.state, id, name, config, ui.props.frame);
      acknowledge?.(fieldBlockSourceKey(next, id, ui.props.frame));
      ui.update({state:next,applyError:null});
    });
    act(() => ui.button('Save field layout').props.onClick());
    const count = ui.props.state.items.filter(item => item.fieldBlockId === 'field-a').length; assert.ok(count > 0);
    assert.equal(ui.field('Field name').props.value, 'Applied synthetic field'); assert.equal(ui.field('Bed length (m)').props.value, '4');
    assert.equal(ui.field('Path width (m)').props.value, '0.75'); assert.equal(ui.button('Save field layout').props.disabled, false);
    assert.ok(ui.text().includes(`${count} full-size beds fit.`)); assert.doesNotMatch(ui.text(), /saved field, map scale or account context changed/);
    assert.equal(ui.applied.length, 1); act(() => oldSave()); assert.equal(ui.applied.length, 1, 'old Save cannot reapply after its acknowledged source generation');
    ui.change('Bed length (m)', '5'); assert.equal(ui.button('Save field layout').props.disabled, false);
    act(() => ui.button('Save field layout').props.onClick()); assert.equal(ui.applied.length, 2);
    assert.doesNotMatch(ui.text(), /saved field, map scale or account context changed/);
  } finally { ui.dispose(); }
});

test('staging an acknowledgement cannot clear a draft before the parent actually commits its matching source', () => {
  const ui = mount(); let acknowledge!: NonNullable<Parameters<Props['onApply']>[3]>, next!: DesignCanvasState;
  try {
    ui.change('Bed length (m)', '4,0');
    ui.handleApply((id,name,config,ack) => { assert.ok(ack); acknowledge = ack; next = configureFieldBlock(ui.props.state,id,name,config,ui.props.frame); ack(fieldBlockSourceKey(next,id,ui.props.frame)); });
    act(() => ui.button('Save field layout').props.onClick());
    assert.equal(ui.field('Bed length (m)').props.value, '4,0', 'a staged receipt is not a committed source');
    const changed = structuredClone(ui.props.state); changed.zones[0].fieldBlock!.bedLengthM = 5;
    ui.update({state:changed,applyError:'Queued layout was rejected.'});
    assert.equal(ui.field('Bed length (m)').props.value, '4,0'); assert.equal(ui.button('Save field layout').props.disabled, true);
    ui.update({state:next,applyError:null}); act(() => acknowledge(fieldBlockSourceKey(next,'field-a',ui.props.frame)));
    assert.equal(ui.field('Bed length (m)').props.value, '4,0', 'rejected receipt cannot revive when the expected source later appears');
    assert.equal(ui.button('Save field layout').props.disabled, true);
  } finally { ui.dispose(); }
});

test('a late queued acknowledgement cannot discard newer typing or survive source movement and reversion', () => {
  for (const change of ['typing','source'] as const) {
    const ui = mount(); let acknowledge!: NonNullable<Parameters<Props['onApply']>[3]>, next!: DesignCanvasState;
    try {
      ui.change('Bed length (m)', '4'); const original = structuredClone(ui.props.state);
      ui.handleApply((id,name,config,ack) => { assert.ok(ack); acknowledge=ack; next=configureFieldBlock(ui.props.state,id,name,config,ui.props.frame); });
      act(() => ui.button('Save field layout').props.onClick());
      if (change === 'typing') ui.change('Bed length (m)', '5,0');
      else { const moved=structuredClone(original);moved.zones[0].points[0][0]+=0.01;ui.update({state:moved});ui.update({state:original}); }
      act(() => acknowledge(fieldBlockSourceKey(next,'field-a',ui.props.frame))); ui.update({state:next});
      assert.equal(ui.field('Bed length (m)').props.value, change === 'typing' ? '5,0' : '4');
      assert.equal(ui.button('Save field layout').props.disabled, true);
    } finally { ui.dispose(); }
  }
});

test('actor or sample ABA revokes an unused own-save acknowledgement before any attempted return', () => {
  for (const transition of ['actor','sample'] as const) {
    const ui = mount(); let acknowledge!: NonNullable<Parameters<Props['onApply']>[3]>, next!: DesignCanvasState;
    try {
      ui.change('Bed length (m)', '4'); ui.handleApply((id,name,config,ack) => { assert.ok(ack);acknowledge=ack;next=configureFieldBlock(ui.props.state,id,name,config,ui.props.frame); });
      act(() => ui.button('Save field layout').props.onClick());
      act(() => { if(transition==='actor'){actor('owner-b');actor('owner-a');}else{sample(true);sample(false);} });
      act(() => acknowledge(fieldBlockSourceKey(next,'field-a',ui.props.frame))); ui.update({state:next});
      assert.match(ui.text(), /account or sample context changed/); assert.equal(ui.applied.length, 1);
      assert.equal(ui.renderer.root.findAll(node => node.props['aria-label'] === 'Bed length (m)').length,0);
    } finally { ui.dispose(); }
  }
});

test('an acknowledged retry may clear an older parent error only after the current committed source clears it', () => {
  const ui = mount({applyError:'Previous queued edit failed.'}); try {
    ui.change('Bed length (m)', '4');
    ui.handleApply((id,name,config,ack) => { const next=configureFieldBlock(ui.props.state,id,name,config,ui.props.frame);ack?.(fieldBlockSourceKey(next,id,ui.props.frame));ui.update({state:next,applyError:null}); });
    act(() => ui.button('Save field layout').props.onClick());
    assert.equal(ui.button('Save field layout').props.disabled,false);assert.equal(ui.field('Bed length (m)').props.value,'4');
    assert.doesNotMatch(ui.text(), /Previous queued edit failed|saved field, map scale or account context changed/);
  } finally { ui.dispose(); }
});
