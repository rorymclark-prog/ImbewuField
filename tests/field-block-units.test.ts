import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { configureFieldBlock, bedsInsideField, type FieldBlockConfig } from '../lib/bed-block.ts';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { generateGrowerAutoPlan } from '../lib/international/grower-autoplan.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { GrowerInput, GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import { normaliseCanvasState, type CanvasFrame, type DesignCanvasState } from '../lib/design-canvas.ts';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';

const panelUrl = new URL('../components/design/FieldBlocksPanel.tsx', import.meta.url).href;
const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const probe = { React, configured: true, actor: 'owner-a' as string | null, auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __fieldUnitsProbe: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === preferenceUrl && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>globalThis.__fieldUnitsProbe.configured;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__fieldUnitsProbe.actor;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__fieldUnitsProbe;p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  if (context.parentURL === panelUrl && specifier === 'next/link') return data(`
    const React=globalThis.__fieldUnitsProbe.React;export default function Link({children,...props}){return React.createElement('a',props,children);}`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === panelUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/design/FieldBlocksPanel.tsx');
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
class MemoryStorage {
  rows = new Map<string, string>(); writes = 0; fail = false; onRead: (() => void) | null = null;
  getItem(key: string) { this.onRead?.(); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw Error('synthetic quota'); ++this.writes; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}
let local = new MemoryStorage(), session = new MemoryStorage(), events: EventTarget;
beforeEach(() => {
  probe.configured = true; probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
after(() => { hooks.deregister(); account.bindMountedAccountLocalStorageUid(null); delete (globalThis as Record<string, unknown>).__fieldUnitsProbe; });
const frame: CanvasFrame = { centerLat: 0, centerLng: 0, zoom: 18, imgW: 100, imgH: 100, mPerPx: 0.2, satDataUrl: null };
const original: FieldBlockConfig = { mode: 'beds', bedLengthM: 3.123456789012345, bedWidthM: 1.23456789012345, pathWidthM: 0.456789012345678, angleDeg: 17.123456789 };
function canvas(config: FieldBlockConfig | undefined = original): DesignCanvasState {
  return { siteId: 'site:0.00000,0.00000', frame: { ...frame }, items: [], lines: [],
    zones: [{ id: 'field-a', zone: 2, feature: 'staple_garden', name: 'Synthetic field', points: [[0.1,0.1],[0.9,0.1],[0.9,0.9],[0.1,0.9]], ...(config ? { fieldBlock: { ...config } } : {}) }],
    step: 'planting', updatedAt: '2026-11-03T12:00:00.000Z', rev: 1 };
}
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function mount(state = canvas(), selectedId = 'field-a') {
  let renderer!: ReactTestRenderer;
  const calls: Array<{ id: string; name: string; config: FieldBlockConfig }> = [];
  let apply: ((id: string, name: string, config: FieldBlockConfig) => void) | null = null;
  const props = { state, frame: { ...state.frame!, satDataUrl: null } as CanvasFrame, selectedId, applyError: null as string | null, onDraw() {}, onSelect() {}, onApply(id: string, name: string, config: FieldBlockConfig) {
    apply?.(id, name, config); calls.push({ id, name, config });
  } };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => renderer.root.findAll(node => node.props['aria-label'] === label)[0];
  const button = (label: string) => renderer.root.findAllByType('button').find(node => text(node) === label)!;
  return { props, calls, renderer, field, button, text: () => text(renderer.root),
    change(label: string, value: string) { const control = field(label); assert.ok(control, `Missing actual field: ${label}`); act(() => control.props.onChange({ target: { value } })); },
    click(label: string) { const target = button(label); assert.ok(target); assert.notEqual(target.props.disabled, true, `${label} must be available`); act(() => target.props.onClick()); },
    update(next: Partial<typeof props>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    handle(callback: typeof apply) { apply = callback; }, dispose() { act(() => renderer.unmount()); } };
}
const key = (owner = 'owner-a') => account.accountLocalStorageKey('imbewu_length_unit_v1', owner);

test('rendering, previewing and repeatedly switching unit display never applies geometry or rounds untouched canonical dimensions', () => {
  const state = canvas(), before = JSON.stringify(state), ui = mount(state);
  try {
    assert.equal(ui.field('Length unit').props.value, 'm'); assert.equal(ui.calls.length, 0);
    for (let i = 0; i < 20; ++i) { ui.change('Length unit', 'ft'); ui.change('Length unit', 'm'); }
    assert.equal(ui.calls.length, 0); assert.equal(JSON.stringify(state), before);
    ui.click('Save field layout'); assert.deepEqual(ui.calls[0].config, original); assert.equal(JSON.stringify(state), before);
  } finally { ui.dispose(); }
  const reopened = mount(state); try { reopened.click('Save field layout'); assert.deepEqual(reopened.calls[0].config, original); }
  finally { reopened.dispose(); }
});

test('a saved explicit feet preference loads after mount while applying the untouched source still preserves its exact metre floats', () => {
  local.rows.set(key(), JSON.stringify({ version: 1, unit: 'ft' })); const ui = mount();
  try {
    assert.equal(ui.field('Length unit').props.value, 'ft'); assert.match(ui.text(), /Unit choice remembered/); assert.equal(ui.calls.length, 0);
    ui.click('Save field layout'); assert.deepEqual(ui.calls[0].config, original);
  } finally { ui.dispose(); }
});

test('a saved preference arriving after actual typing preserves the draft and original entry unit rather than reinterpreting it', () => {
  local.rows.set(key(), JSON.stringify({ version: 1, unit: 'ft' }));
  let renderer!: ReactTestRenderer, once = true;
  local.onRead = () => {
    if (!once) return; once = false;
    const control = renderer.root.findAll(node => node.props['aria-label'] === 'Bed length (m)')[0];
    control.props.onChange({ target: { value: '7' } });
  };
  try {
    const state = canvas();
    act(() => { renderer = create(React.createElement(Panel, { state, frame, selectedId: 'field-a', onDraw() {}, onSelect() {}, onApply() {} })); });
    assert.equal(renderer.root.findAll(node => node.props['aria-label'] === 'Length unit')[0].props.value, 'm');
    assert.equal(renderer.root.findAll(node => node.props['aria-label'] === 'Bed length (m)')[0].props.value, '7');
    assert.match(text(renderer.root), /entries keep their original unit/);
  } finally { if (renderer) act(() => renderer.unmount()); }
});

test('actual feet edits reach generated metric beds and the automatic planner through the existing measured-area bridge', async () => {
  const ui = mount(canvas({ ...original, angleDeg: 0 })); let generated: DesignCanvasState | null = null;
  try {
    ui.change('Length unit', 'ft'); ui.change('Bed length (ft)', '10'); ui.change('Bed width (ft)', '4'); ui.change('Path width (ft)', '1');
    ui.handle((id, name, config) => { generated = configureFieldBlock(ui.props.state, id, name, config, ui.props.frame); });
    ui.click('Save field layout'); assert.deepEqual(ui.calls[0].config, { mode: 'beds', bedLengthM: 3.048, bedWidthM: 1.2192, pathWidthM: 0.3048, angleDeg: 0 });
    assert.ok(generated); const saved = generated as DesignCanvasState;
    const planned = bedsInsideField(saved.zones[0].points, ui.calls[0].config, frame);
    assert.equal(saved.items.length, planned.beds.length); assert.ok(saved.items.length > 0);
    assert.equal(saved.items[0].hM, 3.048); assert.equal(saved.items[0].wM, 1.2192);
    const bytes=JSON.stringify(saved), parsed=JSON.parse(bytes), reloaded=normaliseCanvasState(parsed,saved.siteId);assert.ok(reloaded);
    assert.deepEqual(reloaded.zones[0].fieldBlock,ui.calls[0].config);
    const metric=configureFieldBlock(ui.props.state,'field-a',ui.calls[0].name,{mode:'beds',bedLengthM:3.048,bedWidthM:1.2192,pathWidthM:0.3048,angleDeg:0},frame);
    const metricBytes=JSON.stringify(metric), metricParsed=JSON.parse(metricBytes), metricReloaded=normaliseCanvasState(metricParsed,metric.siteId);assert.ok(metricReloaded);
    assert.equal(reloaded.items.length,metricReloaded.items.length);assert.deepEqual(reloaded.items.map(item=>item.id),metricReloaded.items.map(item=>item.id));
    assert.deepEqual(reloaded.lines.map(line=>({id:line.id,widthM:line.widthM})),metricReloaded.lines.map(line=>({id:line.id,widthM:line.widthM})));
    const beds = bedsFromDesignCanvas(reloaded); assert.equal(beds[0].areaM2, 3.7, 'retain the existing bridge presentation precision');
    assert.deepEqual(beds.map(bed=>({id:bed.id,areaM2:bed.areaM2})),bedsFromDesignCanvas(metricReloaded).map(bed=>({id:bed.id,areaM2:bed.areaM2})));
    const inspected=inspectGrowerWorkflowSource({kind:'studio-canvas',sourceId:saved.siteId,raw:parsed,sourceRevision:bytes});
    assert.equal(inspected.status,'inspected');if(inspected.status!=='inspected')throw Error('Actual saved source held');
    assert.equal(inspected.sourceRevision,bytes);
    const checked=await fingerprintGrowerWorkflowSource(inspected);
    const metricChecked=await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({kind:'studio-canvas',sourceId:metric.siteId,raw:metricParsed,sourceRevision:metricBytes}));
    assert.equal(checked.status,'ready');assert.equal(metricChecked.status,'ready');if(checked.status!=='ready'||metricChecked.status!=='ready')throw Error('Actual field source held');
    // The real fingerprint authority hashes the exact source-revision bytes.
    assert.equal(checked.sourceRevision,createHash('sha256').update(bytes).digest('hex'));assert.equal(checked.geometryFingerprint,metricChecked.geometryFingerprint);
    assert.equal(JSON.stringify(parsed),bytes,'inspection cannot edit the saved source bytes');assert.equal(JSON.stringify(saved),bytes);
    assert.equal(JSON.stringify(metricParsed),metricBytes);assert.deepEqual(checked.beds,beds);
    const scope = checked.scope, recordedAt = '2026-11-03T12:00:00.000Z';
    const own = <T, U extends string>(value: T, unit: U): GrowerInput<T,U> => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt } });
    // Synthetic arithmetic inputs only: neither these durations nor capacities are farming instructions.
    const profile: GrowerPlanningProfile = { version: 1, profileId: 'unit-profile', cropKey: CROPS[0].key, scope, inputs: {
      plantsPerM2: own(1,'plants/m2'), yieldKgPerM2: own(1,'kg/m2/cycle'), establishment: own('direct','method'), nurseryDays: {state:'missing',reason:'not-applicable'},
      fieldEntryToFirstHarvestDays: own(1,'days'), pickingDays: own(1,'days'), fieldOccupancyDays: own(2,'days'), turnaroundDays: own(0,'days'), allowedEntryMonths: own([1],'utc-months') } };
    const result = generateGrowerAutoPlan({ requestedAt: recordedAt, scope, geometryFingerprint: checked.geometryFingerprint, profiles: [profile],
      beds: [{ bed: beds[0], scope, measuredAreaM2: own(beds[0].areaM2,'m2') }], planningStart: own('2028-01-01','utc-date'), planningEndExclusive: own('2028-01-05','utc-date'),
      availability: [{bedId:beds[0].id,scope,window:own({start:'2028-01-01',endExclusive:'2028-01-05'},'utc-date-window')}], reserved: [],
      demands: [{demandId:'unit-demand',profileId:profile.profileId,scope,totalKg:own(1,'kg-total'),harvestWindow:own({start:'2028-01-02',endExclusive:'2028-01-04'},'utc-date-window')}],maxAssessments:100 });
    assert.equal(result.status, 'ready', JSON.stringify(result)); assert.equal(result.cycles[0].assessment.capacity.measuredAreaM2, beds[0].areaM2);
  } finally { ui.dispose(); }
});

test('incomplete or mixed-unit text cannot be reinterpreted by switching units, while decimal comma and leading decimal remain editable', () => {
  const ui = mount();
  try {
    for (const invalid of ['.', '-', '2 ft', '1,000.5', '1e2', '2/3']) {
      ui.change('Bed width (m)', invalid); ui.change('Length unit', 'ft');
      assert.equal(ui.field('Length unit').props.value, 'm'); assert.equal(ui.field('Bed width (m)').props.value, invalid);
      assert.equal(ui.button('Save field layout').props.disabled, true); assert.equal(ui.calls.length, 0);
    }
    ui.change('Bed width (m)', '.5'); ui.change('Path width (m)', '0,25'); ui.change('Direction (degrees)', '-45,5');
    ui.click('Save field layout'); assert.equal(ui.calls[0].config.bedWidthM, 0.5); assert.equal(ui.calls[0].config.pathWidthM, 0.25); assert.equal(ui.calls[0].config.angleDeg, -45.5);
    ui.change('Path width (m)', '-1'); assert.equal(ui.button('Save field layout').props.disabled, true); assert.match(ui.text(), /valid bed dimensions/);
  } finally { ui.dispose(); }
});

test('the shared real allocation and exclusion engine still rejects a rebuild instead of moving occupied beds', () => {
  const state = configureFieldBlock(canvas(), 'field-a', 'Synthetic field', { mode:'beds',bedLengthM:3,bedWidthM:1.2,pathWidthM:0.5,angleDeg:0 }, frame);
  const before = JSON.stringify(state), ui = mount(state);
  try {
    ui.handle((id,name,config) => { configureFieldBlock(state,id,name,config,frame,new Set([state.items[0].id])); });
    ui.change('Length unit', 'ft'); ui.change('Bed length (ft)', '12'); ui.click('Save field layout');
    assert.equal(ui.calls.length, 0); assert.match(ui.text(), /crop allocations/); assert.equal(JSON.stringify(state), before);
  } finally { ui.dispose(); }
});

test('open-field apply generates no synthetic beds and still supplies one real polygon area to crop planning', () => {
  const ui = mount(); let generated: DesignCanvasState | null = null;
  try {
    ui.change('Length unit','ft'); ui.change('Growing layout','open');
    ui.handle((id,name,config) => { generated = configureFieldBlock(ui.props.state,id,name,config,frame); });
    ui.click('Save field layout'); assert.equal(ui.calls[0].config.mode,'open'); assert.deepEqual(ui.calls[0].config,{...original,mode:'open'});
    assert.ok(generated); const saved = generated as DesignCanvasState;
    assert.deepEqual(saved.items,[]); assert.deepEqual(saved.lines,[]);
    const beds = bedsFromDesignCanvas(saved); assert.equal(beds.length,1); assert.equal(beds[0].kind,'plot'); assert.equal(beds[0].id,'field-a');
  } finally { ui.dispose(); }
});

test('switching to an unconfigured field loads its own defaults while identical-value parent clones preserve dirty input', () => {
  const state=canvas(); state.zones.push({id:'field-b',zone:2,feature:'staple_garden',points:[[0,0],[0.1,0],[0.1,0.1],[0,0.1]]});
  const ui=mount(state);
  try {
    ui.change('Bed length (m)','7'); ui.change('Direction (degrees)','-30');
    const clone=structuredClone(state); clone.zones[0].fieldBlock={angleDeg:original.angleDeg,pathWidthM:original.pathWidthM,bedWidthM:original.bedWidthM,bedLengthM:original.bedLengthM,mode:'beds'};
    ui.update({state:clone}); assert.equal(ui.field('Bed length (m)').props.value,'7');
    ui.update({selectedId:'field-b'}); assert.equal(ui.field('Bed length (m)').props.value,'3'); assert.equal(ui.field('Bed width (m)').props.value,'1.2'); assert.equal(ui.field('Path width (m)').props.value,'0.5'); assert.equal(ui.field('Direction (degrees)').props.value,'0');
    assert.equal(ui.calls.length,0);
  } finally {ui.dispose();}
});

test('unrelated revision, timestamp and image changes neither discard nor revoke a draft bound to identical measured field values', () => {
  const ui=mount();try{
    ui.change('Bed length (m)','7');const state=structuredClone(ui.props.state);state.rev=99;state.updatedAt='2026-11-04T12:00:00.000Z';
    ui.update({state,frame:{...ui.props.frame,satDataUrl:'data:image/png;base64,synthetic-paint-only'}});
    assert.equal(ui.field('Bed length (m)').props.value,'7');assert.equal(ui.button('Save field layout').props.disabled,false);assert.equal(ui.calls.length,0);
  }finally{ui.dispose();}
});

test('same-field external edits keep the dirty draft under a hold, and retained Apply cannot cross changed site, polygon, scale or selection', () => {
  for(const change of ['site','polygon','scale','config'] as const){
    const ui=mount();try{
      ui.change('Bed length (m)','7'); const retained=ui.button('Save field layout').props.onClick;
      const state=structuredClone(ui.props.state), nextFrame={...ui.props.frame};
      if(change==='site')state.siteId='site:1.00000,1.00000';
      if(change==='polygon')state.zones[0].points[0][0]=0.12;
      if(change==='scale')nextFrame.mPerPx=0.25;
      if(change==='config')state.zones[0].fieldBlock!.bedLengthM=5;
      ui.update({state,frame:nextFrame});act(()=>retained());assert.equal(ui.calls.length,0);
      if(change!=='site'){assert.equal(ui.field('Bed length (m)').props.value,'7');assert.equal(ui.button('Save field layout').props.disabled,true);}
      ui.click('Reload field settings');assert.equal(ui.button('Save field layout').props.disabled,false);
    }finally{ui.dispose();}
  }
});

test('an in-place source mutation and a later local edit both revoke an earlier Apply callback before it can alter geometry', () => {
  const ui=mount();try{
    const retained=ui.button('Save field layout').props.onClick;ui.props.state.zones[0].points[0][0]=0.11;
    act(()=>retained());assert.equal(ui.calls.length,0);
    ui.update({state:structuredClone(ui.props.state)});ui.click('Reload field settings');
    const earlier=ui.button('Save field layout').props.onClick;ui.change('Bed length (m)','4');act(()=>earlier());assert.equal(ui.calls.length,0);
  }finally{ui.dispose();}
});

test('retained field inputs cannot restore a previous selection and two legitimate batched edits merge instead of overwriting each other', () => {
  const state=canvas();state.zones.push({id:'field-b',zone:2,feature:'staple_garden',name:'Second field',points:[[0,0],[0.1,0],[0.1,0.1],[0,0.1]]});
  const ui=mount(state);try{
    const length=ui.field('Bed length (m)').props.onChange,width=ui.field('Bed width (m)').props.onChange;
    act(()=>{length({target:{value:'7'}});width({target:{value:'2'}});});
    assert.equal(ui.field('Bed length (m)').props.value,'7');assert.equal(ui.field('Bed width (m)').props.value,'2');
    const old=ui.field('Field name').props.onChange;ui.update({selectedId:'field-b'});act(()=>old({target:{value:'Old private name'}}));
    assert.equal(ui.field('Field name').props.value,'Second field');assert.equal(ui.field('Bed length (m)').props.value,'3');
  }finally{ui.dispose();}
});

test('an account or sample authority transition with identical field IDs withholds the preceding private field and dirty measurements', () => {
  for(const transition of ['account','sample'] as const){
    const state=canvas();state.zones[0].name='Owner-A private field';const ui=mount(state);
    try{
      ui.change('Bed length (m)','7.654321');
      act(()=>{
        if(transition==='account'){probe.actor='owner-b';account.bindMountedAccountLocalStorageUid('owner-b');for(const callback of probe.auth)callback({uid:'owner-b'});}
        else{session.setItem('imbewu_sample_mode','1');events.dispatchEvent(new Event('imbewu-sample-mode-changed'));}
      });
      assert.equal(ui.field('Field name'),undefined);assert.equal(ui.field('Bed length (m)'),undefined);
      assert.doesNotMatch(ui.text(),/Owner-A private field|7\.654321/);
      assert.match(ui.text(),/account or sample/);
    }finally{ui.dispose();probe.actor='owner-a';account.bindMountedAccountLocalStorageUid('owner-a');session.removeItem('imbewu_sample_mode');}
  }
});

test('quota failure leaves the explicit unit working in the panel without claiming that the choice was remembered', () => {
  const ui=mount();try{
    local.fail=true;ui.change('Length unit','ft');assert.equal(ui.field('Length unit').props.value,'ft');assert.match(ui.text(),/could not be remembered/);assert.equal(local.rows.size,0);
    ui.click('Save field layout');assert.deepEqual(ui.calls[0].config,original);
  }finally{ui.dispose();}
});

test('actual account and sample lifecycle events revoke old unit/Apply callbacks even after returning to the original identity', () => {
  const ui=mount();try{
    const unit=ui.field('Length unit').props.onChange,apply=ui.button('Save field layout').props.onClick;
    act(()=>{probe.actor='owner-b';account.bindMountedAccountLocalStorageUid('owner-b');for(const callback of probe.auth)callback({uid:'owner-b'});});
    act(()=>{probe.actor='owner-a';account.bindMountedAccountLocalStorageUid('owner-a');for(const callback of probe.auth)callback({uid:'owner-a'});});
    const writes=local.writes;act(()=>unit({target:{value:'ft'}}));act(()=>apply());assert.equal(local.writes,writes);assert.equal(ui.calls.length,0);
    assert.equal(ui.field('Field name'),undefined,'returning to A cannot revive private inputs in the revoked component');
  }finally{ui.dispose();}
  const reopened=mount();try{
    reopened.change('Length unit','ft');assert.equal(JSON.parse(local.getItem(key())!).unit,'ft');
    const sampleApply=reopened.button('Save field layout').props.onClick;
    act(()=>{session.setItem('imbewu_sample_mode','1');events.dispatchEvent(new Event('imbewu-sample-mode-changed'));});
    act(()=>{session.removeItem('imbewu_sample_mode');events.dispatchEvent(new Event('imbewu-sample-mode-changed'));});
    act(()=>sampleApply());assert.equal(reopened.calls.length,0);assert.equal(reopened.field('Field name'),undefined);
  }finally{reopened.dispose();}
});

test('sample unit choices remain ephemeral and never read or overwrite the real account preference', () => {
  local.rows.set(key(),JSON.stringify({version:1,unit:'ft'}));session.setItem('imbewu_sample_mode','1');
  const ui=mount();try{
    assert.equal(ui.field('Length unit').props.value,'m');const before=[...local.rows];
    ui.change('Length unit','ft');assert.match(ui.text(),/only to this sample session/);assert.deepEqual([...local.rows],before);assert.equal(local.writes,0);
  }finally{ui.dispose();}
});

test('opaque preference contexts reject forgery, stale storage/owner and cleanup, without acquiring another account namespace', () => {
  const context=prefs.captureLengthUnitPreferenceContext();assert.ok(context);
  try{
    assert.equal(prefs.writeLengthUnitPreference(context,'ft').remembered,true);assert.equal(prefs.readLengthUnitPreference(context).unit,'ft');
    assert.equal(prefs.writeLengthUnitPreference({kind:'length-unit-preference'},'m').remembered,false);
    account.bindMountedAccountLocalStorageUid('owner-b');probe.actor='owner-b';assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(context),false);
    account.bindMountedAccountLocalStorageUid('owner-a');probe.actor='owner-a';assert.equal(prefs.lengthUnitPreferenceContextIsCurrent(context),false);
    assert.equal(prefs.writeLengthUnitPreference(context,'m').remembered,false);assert.equal(local.getItem(key('owner-b')),null);
  }finally{prefs.revokeLengthUnitPreferenceContext(context);}
  assert.equal(probe.auth.size,0);
});

test('cleanup revokes retained UI callbacks and malformed preferences cannot infer a country or silently become a saved unit', () => {
  local.rows.set(key(),JSON.stringify({version:1,unit:'yards'}));const ui=mount();const unit=ui.field('Length unit').props.onChange,apply=ui.button('Save field layout').props.onClick;
  assert.equal(ui.field('Length unit').props.value,'m');ui.dispose();const writes=local.writes;
  act(()=>unit({target:{value:'ft'}}));act(()=>apply());assert.equal(local.writes,writes);assert.equal(ui.calls.length,0);assert.equal(probe.auth.size,0);
});

test('a rejected queued parent edit remains visible beside the form after the initial Apply callback has returned', () => {
  const ui=mount();try{ui.change('Bed length (m)','7');ui.click('Save field layout');
    const changed=structuredClone(ui.props.state);changed.zones[0].fieldBlock!.bedLengthM=5;
    ui.update({state:changed,applyError:'The saved field changed before this edit could be applied.'});
    assert.match(ui.text(),/saved field changed before this edit could be applied/);
    assert.equal(ui.field('Bed length (m)').props.value,'7','a void callback is not evidence that the queued parent accepted the draft');
    assert.equal(ui.button('Save field layout').props.disabled,true);
    ui.click('Reload field settings');assert.equal(ui.field('Bed length (m)').props.value,'5');
  }finally{ui.dispose();}
});
