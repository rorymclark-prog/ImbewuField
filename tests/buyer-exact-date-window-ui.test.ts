import test, { after, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, events, account, crop, samples, siteId } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, initialiseCropPlanFixture, releaseCropPlanFixture } from './crop-plan-storage-fixture.ts';
import { CROPS, hasAutomaticPlanningBasis } from '../lib/crop-catalog.ts';
import type { DatedHarvestTarget, HarvestTarget, MonthlyHarvestTarget } from '../lib/crop-plan.ts';
import type { HarvestTargetsPanelProps } from '../components/crops/HarvestTargetsPanel.tsx';
import type { GrowerAutoPlanPanelProps } from '../components/crops/GrowerAutoPlanPanel.tsx';
import type { HarvestSaveRequest, HarvestSaveResult } from '../lib/nursery-save-receipt.ts';

const root = new URL('../', import.meta.url).href;
const controls = { replay: false, assessments: 0 };
Object.assign(globalThis, { __exactBuyerUi: { React, controls, auth: probe.auth } });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
// Actual editor, canonical target normalization, mass drafts, actor/sample
// epochs and source-bound parent persistence/readback execute. Only TSX loading,
// Firebase observation and Next navigation use the established fixture seams.
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if ((context.parentURL?.endsWith('/lib/length-unit-preference.ts') || context.parentURL?.endsWith('/lib/nursery-save-receipt.ts')) && specifier === 'firebase/auth') {
      return data('export function onAuthStateChanged(_auth,next){const auth=globalThis.__exactBuyerUi.auth;auth.add(next);return()=>auth.delete(next);}');
    }
    if (context.parentURL?.endsWith('/components/crops/HarvestTargetsPanel.tsx')) {
      if (specifier === 'react') return data(`const p=globalThis.__exactBuyerUi,React=p.React;
export const useEffect=React.useEffect,useMemo=React.useMemo,useRef=React.useRef;
export function useState(initial){const [value,set]=React.useState(initial);return[value,action=>set(typeof action==='function'&&p.controls.replay?previous=>{action(previous);return action(previous);}:action)];}`);
      if (specifier === '@/lib/harvest-targets') return data(`export * from ${JSON.stringify(new URL('../lib/harvest-targets.ts', import.meta.url).href)};
import {assessHarvestTarget as actual} from ${JSON.stringify(new URL('../lib/harvest-targets.ts', import.meta.url).href)};
export function assessHarvestTarget(...args){globalThis.__exactBuyerUi.controls.assessments++;return actual(...args);}`);
    }
    if (context.parentURL?.endsWith('/components/crops/GrowerAutoPlanPanel.tsx') && specifier === 'next/link') {
      return data(`import React from ${JSON.stringify(import.meta.resolve('react'))};export default function Link({children,...props}){return React.createElement('a',props,children);}`);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return next(url, context);
  },
});
const { default: Panel } = await import('../components/crops/HarvestTargetsPanel.tsx');
const { default: AutoPanel } = await import('../components/crops/GrowerAutoPlanPanel.tsx');
const { createHarvestSaveFixture } = await import('./nursery-save-fixture.ts');
const { targetDemand, targetMonthStamp } = await import('../lib/harvest-targets.ts');
const cropDef = CROPS.find(hasAutomaticPlanningBasis); assert.ok(cropDef);
const otherSite = 'site:2.00000,2.00000';
// Engineering records only; requested dates and rates are not crop guidance.
function monthly(site = siteId): MonthlyHarvestTarget { return { id: site === siteId ? 'buyer-monthly' : 'buyer-foreign-monthly', siteId: site,
  cropKey: cropDef!.key, weeklyKg: 7, startMonth: '2028-02', endMonth: '2028-02', outlet: 'Private monthly buyer' }; }
function dated(site = siteId): DatedHarvestTarget { return { id: site === siteId ? 'buyer-dated' : 'buyer-foreign-dated', siteId: site,
  cropKey: cropDef!.key, timing: 'date-window', window: { start: '2028-02-28', endExclusive: '2028-03-02' },
  weeklyKg: 7.123456789012345, outlet: site === siteId ? 'Private dated buyer' : 'Other dated buyer' }; }
function pack(): DatedHarvestTarget { return { id: 'buyer-pack', siteId, cropKey: cropDef!.key,
  timing: 'date-window', window: { start: '2028-02-28', endExclusive: '2028-03-02' }, unit: 'crates', weeklyQuantity: 4, outlet: 'Private pack buyer' }; }
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }
const mounted = new Set<ReactTestRenderer>(), parents = new Set<ReturnType<typeof createHarvestSaveFixture>>();
function mount(targets: HarvestTarget[] = [], overrides: Partial<HarvestTargetsPanelProps> = {}) {
  let renderer!: ReactTestRenderer;
  const calls: HarvestTarget[][] = [];
  const props: HarvestTargetsPanelProps = { siteId, targets, beds: [{ id: 'bed-a', label: 'Engineering bed', areaM2: 12 }], plantings: [],
    pattern: 'mild-frost', climate: {}, basis: 'own-records', onTargets(next) { calls.push(structuredClone(next)); return true; }, onAccept() {}, ...overrides };
  act(() => { renderer = create(React.createElement(Panel, props)); }); mounted.add(renderer);
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(item => typeof item.children[0] === 'string' && item.children[0].startsWith(label)); assert.ok(node, label);
    const control = node.findAll(item => item.type === 'input' || item.type === 'select')[0]; assert.ok(control, label); return control;
  };
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(item => text(item) === label); assert.ok(node, label); return node; };
  return { props, renderer, calls, field, button, text: () => text(renderer.root),
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    click(label: string) { act(() => button(label).props.onClick()); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    massUnit(value: string) { act(() => renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.onChange({ target: { value } })); },
    update(next: Partial<HarvestTargetsPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { if (mounted.delete(renderer)) act(() => renderer.unmount()); },
  };
}
function boundMount(targets: HarvestTarget[] = [], basis: HarvestTargetsPanelProps['basis'] = 'own-records') {
  const raw = { version: 1 as const, plantings: [], updatedAt: 1, harvestTargets: targets };
  if (samples.isSampleMode()) samples.setSandboxCropPlan(raw); else replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw));
  const parent = createHarvestSaveFixture(siteId); parents.add(parent);
  let ui!: ReturnType<typeof mount>, delayed = false, postContextDelayed = false, release: (() => void) | null = null, saves = 0;
  function save(next: HarvestTarget[], request?: HarvestSaveRequest) {
    saves++;
    const commit = () => {
      const outcome = parent.submit(next, request);
      if (outcome?.status === 'confirmed') ui.update({ targets: parent.state.plan.harvestTargets,
        ...(postContextDelayed ? {} : { saveContext: parent.context() }) });
      return outcome;
    };
    if (delayed) return new Promise<HarvestSaveResult | false>(resolve => { release = () => resolve(commit()); });
    return commit();
  }
  ui = mount(targets, { basis, saveContext: null, onTargets: save }); ui.update({ saveContext: parent.context() });
  return { ui, parent, get saves() { return saves; }, delay() { delayed = true; }, release() { assert.ok(release); release(); },
    delayContext() { postContextDelayed = true; }, flushContext() { postContextDelayed = false; ui.update({ saveContext: parent.context() }); },
    dispose() { ui.dispose(); if (parents.delete(parent)) parent.dispose(); } };
}
function fillExact(ui: ReturnType<typeof mount>, start = '2028-02-28', endExclusive = '2028-03-02') {
  ui.change('Crop', cropDef!.key); ui.change('Weekly quantity', '7'); ui.change('Demand date entry', 'date-window');
  ui.change('Requested harvest from', start); ui.change('Requested harvest ends before', endExclusive);
}
function saved(id = 'buyer-dated') { const row = crop.loadCropPlan().harvestTargets?.find(target => target.id === id); assert.ok(row); return row; }
function exact(row: HarvestTarget) {
  assert.equal(row.timing, 'date-window'); if (row.timing !== 'date-window') assert.fail('Expected an actual dated target');
  assert.equal(Object.hasOwn(row, 'startMonth'), false); assert.equal(Object.hasOwn(row, 'endMonth'), false); return row;
}
beforeEach(async () => { await reset(); controls.replay = false; controls.assessments = 0; });
afterEach(() => {
  for (const renderer of mounted) act(() => renderer.unmount()); mounted.clear();
  for (const parent of parents) parent.dispose(); parents.clear();
});
after(() => { hooks.deregister(); cleanup(); Reflect.deleteProperty(globalThis, '__exactBuyerUi'); });

test('SSR withholds dated private buyer fields before actor context, and own-record date mode starts blank explicitly', () => {
  const html = renderToString(React.createElement(Panel, { siteId, targets: [dated()], beds: [], plantings: [], pattern: 'mild-frost', climate: {}, basis: 'own-records', onTargets() {}, onAccept() {} }));
  assert.doesNotMatch(html, /Private dated buyer|2028-02-28/);
  const ui = mount(); assert.equal(ui.field('Demand date entry').props.value, 'monthly');
  ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-04'); ui.change('Demand date entry', 'date-window');
  assert.equal(ui.field('Requested harvest from').props.value, ''); assert.equal(ui.field('Requested harvest ends before').props.value, '');
  assert.equal(ui.renderer.root.findAllByType('input').some(node => node.props.type === 'month'), false);
  assert.match(ui.text(), /not delivery appointments or observed picking/); assert.match(ui.text(), /weekly supply is not promised/);
  for (const label of ['Demand date entry', 'Requested harvest from', 'Requested harvest ends before']) assert.match(ui.field(label).props.className, /min-h-11/);
});

test('actual create/save/reload/edit keeps a leap-day exact interval without month mirrors or inclusive-end widening', () => {
  const parent = boundMount(), ui = parent.ui; fillExact(ui); ui.submit(); assert.equal(parent.saves, 1);
  const rows = crop.loadCropPlan().harvestTargets; assert.equal(rows?.length, 1); assert.ok(rows);
  const first = exact(rows[0]); assert.deepEqual(first.window, { start: '2028-02-28', endExclusive: '2028-03-02' });
  assert.equal(targetDemand(first)?.days, 3); assert.match(ui.text(), /2028-02-28 to before 2028-03-02 \(UTC, exclusive\)/);
  assert.match(ui.text(), /Buyer targets saved on this device/); assert.equal(ui.field('Demand date entry').props.value, 'monthly');
  ui.click('Edit'); assert.equal(ui.field('Demand date entry').props.value, 'date-window'); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-02');
  ui.change('Requested harvest ends before', '2028-03-03'); ui.submit(); assert.deepEqual(exact(saved(first.id)).window, { start: '2028-02-28', endExclusive: '2028-03-03' });
  ui.click('Reload saved harvest targets'); ui.click('Edit'); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-03');
  ui.click('Cancel edit'); assert.equal(ui.field('Demand date entry').props.value, 'monthly'); assert.equal(ui.field('First harvest month').props.value, '');
});

test('dated mass-unit toggles and untouched saves preserve exact quantities, dates, sales units and unknown pack weight', () => {
  for (const target of [dated(), pack()]) {
    const parent = boundMount([target]), ui = parent.ui;
    ui.click('Edit'); for (let i = 0; i < 4; i++) { ui.massUnit('lb'); ui.massUnit('kg'); }
    ui.submit(); assert.deepEqual(saved(target.id), target);
    ui.click('Edit'); assert.equal(ui.field('Demand date entry').props.value, 'date-window');
    assert.equal(ui.field('Requested harvest from').props.value, target.window.start);
    if (target.unit === 'crates') { assert.equal(saved(target.id).kgPerUnit, undefined); assert.equal(targetDemand(saved(target.id))?.demandKg, null); }
    parent.dispose();
  }
});

for (const [start, end] of [['', '2028-03-02'], ['2028-02-28', ''], ['2028-02-30', '2028-03-02'], ['2028-02-28', '2028-02-28'],
  ['2028-03-02', '2028-02-28'], ['2019-12-31', '2020-01-02'], ['2028-01-01', '2029-01-02']] as const) {
  test(`invalid exact entry ${start || 'blank'} to ${end || 'blank'} remains editable and never saves or becomes monthly`, () => {
    const ui = mount(); fillExact(ui, start, end); ui.submit(); assert.equal(ui.calls.length, 0);
    assert.equal(ui.field('Demand date entry').props.value, 'date-window'); assert.equal(ui.field('Requested harvest from').props.value, start);
    assert.equal(ui.field('Requested harvest ends before').props.value, end); assert.notEqual(ui.field('Requested harvest ends before').props.disabled, true);
    assert.match(ui.text(), /valid UTC start and a later end-before date/);
    ui.change('Requested harvest from', '2028-02-28'); ui.change('Requested harvest ends before', '2028-03-02'); ui.submit();
    assert.equal(ui.calls.length, 1); assert.deepEqual(exact(ui.calls[0][0]).window, { start: '2028-02-28', endExclusive: '2028-03-02' });
  });
}

test('retained month/date callbacks cannot author dual timing when the editor switches modes', () => {
  const ui = mount(); ui.change('Crop', cropDef!.key); ui.change('Weekly quantity', '7');
  const oldMonth = ui.field('First harvest month').props.onChange; ui.change('Demand date entry', 'date-window');
  act(() => oldMonth({ target: { value: '2028-01' } })); ui.change('Requested harvest from', '2028-02-28'); ui.change('Requested harvest ends before', '2028-03-02');
  const oldDate = ui.field('Requested harvest from').props.onChange; ui.change('Demand date entry', 'monthly');
  act(() => oldDate({ target: { value: '2028-01-01' } })); assert.equal(ui.field('First harvest month').props.value, '');
  ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.submit();
  assert.equal(ui.calls.length, 1); assert.equal(Object.hasOwn(ui.calls[0][0], 'timing'), false); assert.equal(Object.hasOwn(ui.calls[0][0], 'window'), false);
});

test('monthly catalogue defaults and legacy saved target shape remain unchanged; exact entry is not offered', () => {
  const target = monthly(), ui = mount([target], { basis: 'catalogue' }); const today = new Date(), month = today.getFullYear() * 12 + today.getMonth();
  assert.equal(ui.renderer.root.findAllByType('select').some(node => node.props.value === 'date-window' || node.props.value === 'monthly'), false);
  assert.equal(ui.field('First harvest month').props.value, targetMonthStamp(month)); assert.equal(ui.field('Last harvest month').props.value, targetMonthStamp(month + 11));
  ui.click('Edit'); ui.submit(); assert.deepEqual(ui.calls[0], [target]); assert.equal(Object.hasOwn(ui.calls[0][0], 'timing'), false);
});

test('catalogue shows dated own-estimate records, refuses retained Edit, and never calls a dated benchmark assessment', () => {
  const parent = boundMount([dated()], 'catalogue'), ui = parent.ui;
  assert.equal(controls.assessments, 0); assert.match(ui.text(), /Exact-date records require your own growing estimates/);
  assert.match(ui.text(), /2028-02-28 to before 2028-03-02/); assert.equal(ui.button('Edit').props.disabled, true);
  const firstMonth = ui.field('First harvest month').props.value, lastMonth = ui.field('Last harvest month').props.value;
  ui.click('Edit'); assert.equal(ui.field('First harvest month').props.value, firstMonth); assert.equal(ui.field('Last harvest month').props.value, lastMonth);
  assert.match(ui.text(), /exact dates cannot be edited as catalogue months/); assert.equal(parent.saves, 0);
  ui.click('Suggest target sowings'); assert.equal(controls.assessments, 0); assert.doesNotMatch(ui.text(), /NaN|undefined/);
  ui.click('Remove'); assert.equal(parent.saves, 1); assert.deepEqual(crop.loadCropPlan().harvestTargets, []);
});

test('a malformed dual-intent source is labelled held instead of being edited into valid monthly dates', () => {
  const malformed = Object.assign(dated(), { startMonth: '2028-02', endMonth: '2028-02' }), ui = mount([malformed]);
  assert.match(ui.text(), /Requested dates need review/); ui.click('Edit'); assert.equal(ui.field('Weekly quantity').props.value, '');
  assert.match(ui.text(), /exact dates cannot be edited as catalogue months/); assert.equal(ui.calls.length, 0);
});

test('a same-value clone keeps dirty exact dates; changed dates hold edits until explicit reload and retired callbacks stay held', () => {
  const ui = mount([dated()]); ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04');
  const oldDate = ui.field('Requested harvest from').props.onChange, oldSubmit = ui.renderer.root.findByType('form').props.onSubmit;
  ui.update({ targets: [structuredClone(dated())] }); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04');
  ui.update({ targets: [{ ...dated(), window: { start: '2028-03-01', endExclusive: '2028-03-05' } }] });
  act(() => { oldDate({ target: { value: '2028-01-01' } }); oldSubmit({ preventDefault() {} }); }); assert.equal(ui.calls.length, 0);
  assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04'); ui.click('Reload saved harvest targets'); ui.click('Edit');
  assert.equal(ui.field('Requested harvest from').props.value, '2028-03-01'); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-05');
});

for (const context of ['actor', 'sample'] as const) test(`${context} change withdraws dated private fields and held timing/mass/save/removal callbacks cannot act`, () => {
  const ui = mount([dated()]); ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04');
  const change = ui.field('Demand date entry').props.onChange, date = ui.field('Requested harvest from').props.onChange,
    mass = ui.renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.onChange, submit = ui.renderer.root.findByType('form').props.onSubmit, remove = ui.button('Remove').props.onClick;
  act(() => {
    if (context === 'actor') { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); }
    else { session.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); }
  });
  assert.equal(ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(ui.text(), /Private dated buyer|2028-02-28/);
  act(() => { change({ target: { value: 'monthly' } }); date({ target: { value: '2028-01-01' } }); mass({ target: { value: 'lb' } }); submit({ preventDefault() {} }); remove(); });
  assert.equal(ui.calls.length, 0);
});

test('pending exact saves prevent duplicate work, preserve intent, and use actual confirmation before clearing', async () => {
  const parent = boundMount([dated()]), ui = parent.ui; parent.delay(); ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04');
  const change = ui.field('Demand date entry').props.onChange; ui.submit(); act(() => change({ target: { value: 'monthly' } })); ui.submit();
  assert.equal(parent.saves, 1); assert.equal(ui.field('Demand date entry').props.value, 'date-window');
  assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04');
  await act(async () => { parent.release(); await Promise.resolve(); }); assert.match(ui.text(), /Buyer targets saved on this device/);
  assert.equal(ui.field('Demand date entry').props.value, 'monthly'); assert.equal(exact(saved()).window.endExclusive, '2028-03-04');
});

test('a legacy unconfirmed result cannot clear exact intent, claim a save, change timing or automatically retry', () => {
  const ui = mount([dated()]); ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04'); ui.submit();
  assert.match(ui.text(), /Save outcome is not confirmed/); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04');
  const change = ui.field('Demand date entry').props.onChange; act(() => change({ target: { value: 'monthly' } })); ui.submit();
  assert.equal(ui.field('Demand date entry').props.value, 'date-window'); assert.equal(ui.calls.length, 1);
  assert.doesNotMatch(ui.text(), /Buyer targets saved on this device/);
});

test('actual delayed source handoff and replayed state updates preserve exact target confirmation for the next edit', () => {
  controls.replay = true; const parent = boundMount([dated()]), ui = parent.ui; parent.delayContext();
  ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04'); ui.submit();
  assert.match(ui.text(), /Buyer targets saved on this device/); assert.equal(ui.field('Demand date entry').props.disabled, true);
  parent.flushContext(); assert.notEqual(ui.field('Demand date entry').props.disabled, true);
  ui.click('Edit'); assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04'); ui.change('Requested harvest ends before', '2028-03-05'); ui.submit();
  assert.equal(exact(saved()).window.endExclusive, '2028-03-05');
});

test('same-bytes lease replacement cannot grant an old exact-date intent to a new producer', async () => {
  const parent = boundMount([dated()]), ui = parent.ui; ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04');
  releaseCropPlanFixture(); await initialiseCropPlanFixture(); const token = crop.cropPlanWriteToken(); ui.submit();
  assert.equal(crop.cropPlanWriteToken(), token); assert.equal(exact(saved()).window.endExclusive, '2028-03-02');
  assert.equal(ui.field('Requested harvest ends before').props.value, '2028-03-04');
});

test('a delayed exact save from a departed account cannot certify or write into the next account', async () => {
  const parent = boundMount([dated()]), ui = parent.ui; parent.delay(); ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04'); ui.submit();
  act(() => { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); });
  const rows = structuredClone([...local.rows]); await act(async () => { parent.release(); await Promise.resolve(); });
  assert.deepEqual([...local.rows], rows); assert.equal(ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(ui.text(), /Buyer targets saved on this device/);
});

test('sample dated acknowledgment stays in the sample book and does not change real device records', () => {
  samples.enterSampleMode(); const before = structuredClone([...local.rows]); const parent = boundMount([dated()]), ui = parent.ui;
  ui.click('Edit'); ui.change('Requested harvest ends before', '2028-03-04'); ui.submit();
  assert.match(ui.text(), /Buyer targets kept in this sample session/); assert.equal(exact(saved()).window.endExclusive, '2028-03-04'); assert.deepEqual([...local.rows], before);
});

test('automatic-plan selection labels exact UTC/exclusive dates and leaves monthly labels unchanged', () => {
  const props: GrowerAutoPlanPanelProps = { scope: { kind: 'mapped-site', siteId }, source: null, sourceName: 'Engineering source', sourceIssue: null,
    checking: false, contextRevision: 1, profiles: [], targets: [dated(), monthly()], targetSiteId: siteId, onRefresh: async () => {},
    onReview: async () => ({ status: 'held', issues: [], blockedBeds: [], targetMetadata: [], existingOwnCycles: [] }) };
  let renderer!: ReactTestRenderer; act(() => { renderer = create(React.createElement(AutoPanel, props)); }); mounted.add(renderer);
  const labels = renderer.root.findAllByType('label').map(node => text(node)).filter(value => value.startsWith('Include '));
  assert.ok(labels.some(value => value.endsWith(': 2028-02-28 to before 2028-03-02 (UTC, exclusive)')));
  assert.ok(labels.some(value => value.endsWith(': 2028-02 to 2028-02')));
  assert.ok(labels.every(value => !value.includes('buyer-dated') && !value.includes(siteId)));
});
