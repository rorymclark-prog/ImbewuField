import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, events, account, crop, ownRow, studio, studioKey, siteId, samples } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, initialiseCropPlanFixture, releaseCropPlanFixture } from './crop-plan-storage-fixture.ts';
import type { NurserySettings } from '../lib/nursery-settings.ts';
import type { NurseryPlanPanelProps } from '../components/crops/NurseryPlanPanel.tsx';

const root = new URL('../', import.meta.url).href;
const observations = { forecasts: 0, forbidden: false, deliveries: 0 };
const actualForecast = await import('../lib/crop-export-schedule.ts');
const replay = { stateUpdaters: false };
Object.assign(globalThis, { __nurseryUnitPanel: { observations, actualForecast, auth: probe.auth, React, replay } });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ((context.parentURL?.endsWith('/lib/length-unit-preference.ts') || context.parentURL?.endsWith('/lib/nursery-save-receipt.ts')) && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next){const auth=globalThis.__nurseryUnitPanel.auth;auth.add(next);return()=>auth.delete(next);}`);
  if (context.parentURL?.endsWith('/components/crops/NurseryPlanPanel.tsx')) {
    // The real browser can replay a state updater before committing its result.
    // The renderer fixture otherwise misses a confirmation consumed in that discarded call.
    if (specifier === 'react') return data(`
      const p=globalThis.__nurseryUnitPanel,React=p.React;
      export const useEffect=React.useEffect,useMemo=React.useMemo,useRef=React.useRef;
      export function useState(initial){const [value,set]=React.useState(initial);return [value,action=>set(
        typeof action==='function'&&p.replay.stateUpdaters
          ? previous=>{action(previous);return action(previous);} : action)];}`);

    if (specifier === '@/lib/crop-export-schedule') return data(`export function buildNurseryForecast(...args){const p=globalThis.__nurseryUnitPanel;p.observations.forecasts++;if(p.observations.forbidden)throw Error('Unapproved catalogue forecast');return p.actualForecast.buildNurseryForecast(...args);}`);
    if (specifier === '@/lib/file-delivery') return data(`export async function deliverFile(_blob,_name,_title,current){if(current&&!current())return 'cancelled';globalThis.__nurseryUnitPanel.observations.deliveries++;return 'downloaded';}`);
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/NurseryPlanPanel.tsx');
const prefs = await import('../lib/length-unit-preference.ts');
const nursery = await import('../lib/nursery-settings.ts');
const receipts = await import('../lib/nursery-save-receipt.ts');
const { createNurserySaveFixture } = await import('./nursery-save-fixture.ts');
const growerNursery = await import('../lib/international/grower-nursery.ts');
const { generateGrowerAutoPlan } = await import('../lib/international/grower-autoplan.ts');
after(() => { hooks.deregister(); cleanup(); Reflect.deleteProperty(globalThis, '__nurseryUnitPanel'); });
beforeEach(async () => { await reset(); observations.forecasts = 0; observations.forbidden = false; observations.deliveries = 0; replay.stateUpdaters = false; });
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
const blank = (): NurserySettings => ({ version: 1, spaces: [], containers: [], profiles: [] });
const initial = (): NurserySettings => ({ version: 1, spaces: [{ id: 'space-a', siteId, name: 'Private bench A', usableM2: 1.2345678901234567 }],
  containers: [{ id: 'tray-a', siteId, name: 'Private tray A', widthCm: 30.123456789012345, lengthCm: 50.23456789012345, cells: 40, owned: 0 }], profiles: [] });
function mount(settings: NurserySettings | undefined = initial(), overrides: Partial<NurseryPlanPanelProps> = {}) {
  let renderer!: ReactTestRenderer;
  const calls: NurserySettings[] = [];
  const props: NurseryPlanPanelProps = { siteId, settings, now: { year: 2028, month: 12 }, plantings: [], beds: [], allowCatalogueForecast: false,
    onSettings(next) { calls.push(structuredClone(next)); return true; }, ...overrides };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  function field(prefix: string) {
    const label = renderer.root.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix));
    assert.ok(label, `Missing input ${prefix}`); return label.findAll(node => node.type === 'input' || node.type === 'select')[0];
  }
  const button = (label: string) => renderer.root.findAllByType('button').find(node => text(node) === label)!;
  return { renderer, props, calls, field, button, text: () => text(renderer.root),
    change(prefix: string, value: string) { act(() => field(prefix).props.onChange({ target: { value } })); },
    unit(value: string) { act(() => renderer.root.findByProps({ 'aria-label': 'Nursery units' }).props.onChange({ target: { value } })); },
    click(label: string) { const target = button(label); assert.ok(target, label); act(() => target.props.onClick()); },
    edit(collection: 'space' | 'container') { const details = renderer.root.findAllByType('details').find(node => text(node.findAllByType('summary')[0]!).startsWith(collection === 'space' ? '1.' : '2.'))!;
      const target = details.findAllByType('button').find(node => text(node) === 'Edit')!; act(() => target.props.onClick()); },
    submit(label: string) { const form = renderer.root.findAllByType('form').find(node => node.findAllByType('button').some(button => text(button) === label)); assert.ok(form); act(() => form.props.onSubmit({ preventDefault() {} })); },
    update(next: Partial<NurseryPlanPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { act(() => renderer.unmount()); } };
}

test('SSR withholds private nursery fields and starts with the explicit metric unit choice', () => {
  const html = renderToString(React.createElement(Panel, { siteId, settings: initial(), plantings: [], beds: [], now: { year: 2028, month: 12 }, onSettings() {} }));
  assert.match(html, /Centimetres and square metres/); assert.doesNotMatch(html, /Private bench A|Private tray A/);
});

test('tray and surface toggles preserve exact untouched canonical values without writes, including reopen', () => {
  for (const collection of ['container', 'space'] as const) {
    const settings = initial(), before = JSON.stringify(settings), ui = mount(settings);
    try {
      ui.edit(collection);
      for (let i = 0; i < 12; ++i) { ui.unit('imperial'); ui.unit('metric'); }
      assert.equal(ui.calls.length, 0); assert.equal(JSON.stringify(settings), before);
      ui.submit(collection === 'space' ? 'Save space changes' : 'Save container changes');
      assert.deepEqual(ui.calls[0], settings); assert.match(ui.text(), /Save outcome is not confirmed/);
      assert.notEqual(ui.field(collection === 'space' ? 'Space name' : 'Container name').props.value, '', 'An unbranded boolean cannot clear entered private values');
    } finally { ui.dispose(); }
    const reopened = mount(settings); try { reopened.edit(collection); reopened.submit(collection === 'space' ? 'Save space changes' : 'Save container changes'); assert.deepEqual(reopened.calls[0], settings); } finally { reopened.dispose(); }
  }
});

test('fresh blank area accepts an explicit imperial choice without becoming zero, while incomplete entered text holds the switch', () => {
  const ui = mount(blank());
  try {
    ui.unit('imperial'); assert.equal(ui.field('Net usable surface').props.value, '');
    ui.change('Space name', 'Zero is explicit'); ui.submit('Add nursery space'); assert.equal(ui.calls.length, 0);
    ui.change('Net usable surface', ','); ui.unit('metric'); assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Nursery units' }).props.value, 'imperial');
    ui.change('Net usable surface', '0'); ui.submit('Add nursery space'); assert.equal(ui.calls[0].spaces[0].usableM2, 0);
  } finally { ui.dispose(); }
});

test('imperial entries convert only tray footprint and net surface; unknowns, zero stock and independent counts remain intact', () => {
  const ui = mount(blank());
  try {
    ui.unit('imperial'); ui.change('Container name', 'Engineering tray'); ui.change('Outer width', '12'); ui.change('Outer length', '20'); ui.change('Cells per container', '40'); ui.change('Owned containers', '0');
    ui.submit('Add container type'); const row = ui.calls[0].containers[0];
    assert.equal(row.widthCm, 30.48); assert.equal(row.lengthCm, 50.8); assert.equal(row.cells, 40); assert.equal(row.owned, 0);
  } finally { ui.dispose(); }
  const unknown = mount(blank()); try { unknown.unit('imperial'); unknown.change('Container name', 'Unknown footprint'); unknown.submit('Add container type'); assert.equal(unknown.calls[0].containers[0].widthCm, undefined); assert.equal(unknown.calls[0].containers[0].owned, undefined); } finally { unknown.dispose(); }
});

test('same-value clones retain dirty input, changed saved settings hold it until explicit reload, and stale callbacks cannot relabel text', () => {
  const ui = mount();
  try {
    ui.edit('container'); ui.change('Outer width', '37'); const stale = ui.field('Outer width').props.onChange;
    ui.update({ settings: structuredClone(initial()) }); assert.equal(ui.field('Outer width').props.value, '37');
    ui.unit('imperial'); const converted = ui.field('Outer width').props.value;
    act(() => stale({ target: { value: '99' } })); assert.equal(ui.field('Outer width').props.value, converted);
    const beforeSourceChange = ui.field('Outer width').props.onChange;
    ui.update({ settings: { ...initial(), containers: [{ ...initial().containers[0], widthCm: 60 }] } });
    act(() => beforeSourceChange({ target: { value: '88' } }));
    assert.equal(ui.field('Outer width').props.value, converted);
    ui.submit('Save container changes'); assert.equal(ui.calls.length, 0); assert.equal(ui.field('Outer width').props.value, converted);
    ui.click('Reload saved nursery settings'); ui.edit('container'); assert.equal(ui.field('Outer width').props.value, '23.622047');
    ui.submit('Save container changes'); assert.equal(ui.calls[0].containers[0].widthCm, 60, 'Rounded display must not round an untouched reopened canonical value');
  } finally { ui.dispose(); }
});

test('account and sample transitions withhold prior private fields and retained submit/export callbacks cannot use their old context', async () => {
  const ui = mount(initial(), { allowCatalogueForecast: true });
  ui.change('Space name', 'Private unfinished bench'); ui.change('Net usable surface', '9');
  const submit = ui.renderer.root.findAllByType('form')[0].props.onSubmit, exporting = ui.button('Download nursery CSV').props.onClick;
  try {
    act(() => { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); });
    assert.doesNotMatch(ui.text(), /Private bench A|Private tray A|Outer width/);
    act(() => submit({ preventDefault() {} })); await exporting(); assert.equal(ui.calls.length, 0); assert.equal(observations.deliveries, 0);
  } finally { ui.dispose(); }
  await reset(); const sample = mount();
  try { act(() => { session.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event('imbewu-sample-mode-changed')); }); assert.doesNotMatch(sample.text(), /Private bench A|Private tray A/); } finally { sample.dispose(); }
});

test('nursery remembering is independent of field choice, actor scoped, sample-only and honest about unavailable storage', () => {
  const ctx = prefs.captureNurseryUnitPreferenceContext()!; const field = prefs.captureLengthUnitPreferenceContext()!;
  try {
    assert.equal(prefs.writeNurseryUnitPreference(ctx, 'imperial').remembered, true);
    assert.equal(prefs.readLengthUnitPreference(field).unit, 'm');
    const ui = mount(); try { assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Nursery units' }).props.value, 'imperial'); } finally { ui.dispose(); }
    probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b');
    assert.equal(prefs.readNurseryUnitPreference(ctx).destination, 'unavailable');
  } finally { prefs.revokeNurseryUnitPreferenceContext(ctx); prefs.revokeLengthUnitPreferenceContext(field); }
});

test('an unapproved nursery context never executes the catalogue producer or offers its export', () => {
  observations.forbidden = true; const ui = mount(initial(), { allowCatalogueForecast: false });
  // The separate own-estimate review can calculate requirements. This hold applies
  // to the catalogue producer; a blanket claim would hide that grower workflow.
  try { assert.equal(observations.forecasts, 0); assert.equal(ui.button('Download nursery CSV'), undefined); assert.match(ui.text(), /catalogue demand forecast is unavailable/); assert.match(ui.text(), /Automatic plan from your estimates/); } finally { ui.dispose(); }
});

function boundMount(settings = initial(), deferContext = false, legacyBeforeContext = false) {
  if (samples.isSampleMode()) samples.setSandboxCropPlan({ version: 1, plantings: [], updatedAt: 1, nursery: settings });
  else replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], updatedAt: 1, nursery: settings }));
  const parent = createNurserySaveFixture(siteId);
  let ui!: ReturnType<typeof mount>, delay = false, postContextDelayed = false, release: (() => void) | null = null;
  function commit(next: NurserySettings, request?: import('../lib/nursery-save-receipt.ts').NurserySaveRequest) {
    const result = parent.submit(next, request);
    if (result?.status === 'confirmed') ui.update({ settings: parent.state.plan.nursery, ...(postContextDelayed ? {} : { saveContext: parent.context() }) });
    return result;
  }
  ui = mount(settings, { saveContext: legacyBeforeContext ? undefined : null, onSettings(next, request) {
    if (delay) return new Promise(resolve => { release = () => resolve(commit(next, request)); });
    return commit(next, request);
  } });
  if (!deferContext) ui.update({ saveContext: parent.context() });
  return { ui, state: parent.state, reissueContext() { ui.update({ settings: structuredClone(parent.state.plan.nursery), saveContext: parent.reissueContext() }); }, ready() { ui.update({ saveContext: parent.context() }); }, delayPostContext() { postContextDelayed = true; }, flushPostContext() { postContextDelayed = false; ui.update({ saveContext: parent.context() }); }, delay() { delay = true; }, release() { assert.ok(release); release(); },
    dispose() { ui.dispose(); parent.dispose(); } };
}

test('a real parent storage/readback acknowledgment clears only the saved form and remains usable for the next legitimate save', () => {
  const parent = boundMount(), ui = parent.ui;
  try {
    ui.change('Space name', 'Unfinished second form'); ui.change('Net usable surface', '4');
    ui.edit('container'); ui.unit('imperial'); ui.change('Outer width', '12'); ui.change('Outer length', '20'); ui.submit('Save container changes');
    assert.match(ui.text(), /Saved on this device/); assert.equal(ui.field('Container name').props.value, '');
    assert.equal(ui.field('Space name').props.value, 'Unfinished second form');
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 30.48);
    ui.submit('Add nursery space'); assert.match(ui.text(), /Saved on this device/);
    assert.equal(ui.field('Space name').props.value, '');
    assert.equal(crop.loadCropPlan().nursery?.spaces.find(row => row.name === 'Unfinished second form')?.usableM2, 4);
  } finally { parent.dispose(); }
});

test('a pending real parent acknowledgment keeps entries and blocks duplicate submission until its exact performed result is confirmed', async () => {
  const parent = boundMount(), ui = parent.ui; parent.delay();
  try {
    ui.edit('container'); ui.change('Outer width', '35'); ui.submit('Save container changes');
    assert.equal(ui.field('Container name').props.value, 'Private tray A'); assert.match(ui.text(), /Checking nursery save/);
    ui.submit('Save container changes');
    await act(async () => { parent.release(); await Promise.resolve(); });
    assert.match(ui.text(), /Saved on this device/); assert.equal(ui.field('Container name').props.value, '');
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 35);
  } finally { parent.dispose(); }
});

test('a real write that throws afterwards remains unconfirmed, preserves entered dimensions and never claims storage was unchanged', () => {
  for (const outcome of ['false', 'void', 'throw'] as const) {
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], updatedAt: 1, nursery: initial() }));
    const before = crop.cropPlanWriteToken();
    const ui = mount(initial(), { onSettings(next) {
      const write = crop.saveCropPlanWithReceipt({ ...crop.loadCropPlan(), nursery: next }); assert.equal(write.saved, true);
      if (outcome === 'throw') throw Error('Callback failed after actual write');
      return outcome === 'false' ? false : undefined;
    } });
    try {
      ui.edit('container'); ui.change('Outer width', '36'); ui.submit('Save container changes');
      assert.notEqual(crop.cropPlanWriteToken(), before); assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 36);
      assert.equal(ui.field('Outer width').props.value, '36'); assert.match(ui.text(), /Save outcome is not confirmed/);
      assert.doesNotMatch(ui.text(), /settings remain unchanged|Saved on this device/);
    } finally { ui.dispose(); }
  }
});

test('a real performed-but-unconfirmed quota result cannot clear entries or automatically retry its uncertain write', () => {
  const parent = boundMount(), ui = parent.ui, original = local.setItem;
  let attempts = 0;
  try {
    ui.edit('container'); ui.change('Outer width', '38');
    local.setItem = function(key, value) { original.call(this, key, value); if (key.includes('imbewu_crop_plan_v2')) { ++attempts; throw Error('Write performed, then quota signal'); } };
    ui.submit('Save container changes'); assert.equal(attempts, 1); assert.equal(ui.field('Outer width').props.value, '38');
    assert.match(ui.text(), /Save outcome is not confirmed/); ui.submit('Save container changes'); assert.equal(attempts, 1);
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 38);
  } finally { local.setItem = original; parent.dispose(); }
});

test('sample acknowledgments describe memory only and unit remembering never writes to the real device namespace', () => {
  samples.enterSampleMode(); const before = structuredClone([...local.rows]);
  const parent = boundMount(blank()), ui = parent.ui;
  try {
    ui.unit('imperial'); ui.change('Container name', 'Demo tray'); ui.change('Outer width', '12'); ui.change('Outer length', '20'); ui.submit('Add container type');
    assert.match(ui.text(), /Kept in this sample session/); assert.doesNotMatch(ui.text(), /Saved on this device/);
    assert.equal(samples.getSandboxCropPlan().nursery?.containers[0].widthCm, 30.48);
    assert.deepEqual([...local.rows], before);
  } finally { parent.dispose(); }
});

test('metric and imperial nursery entry reach equivalent actual settings, forecast demand and own-cycle quantities', async () => {
  const { row, source } = await ownRow(); local.setItem(studioKey(), JSON.stringify(studio()));
  const settings: NurserySettings = { version: 1, spaces: [{ id: 'space-a', siteId, name: 'Engineering surface', usableM2: 0.9290304 }],
    containers: [{ id: 'tray-a', siteId, name: 'Engineering tray', widthCm: 30.48, lengthCm: 50.8, cells: 40, owned: 0 }],
    profiles: [{ id: 'recipe-a', siteId, cropKey: row.cropKey, containerId: 'tray-a', spaceId: 'space-a', model: 'seed-cell', germinationPercent: 80, nurserySurvivalPercent: 90, fieldSurvivalPercent: 90, nurseryWeeks: 2 }] };
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit, provenance: { kind: 'grower-estimate' as const, recordedAt: '2026-11-05T12:00:00.000Z' } });
  const scope = source.scope;
  const profile = { version: 1 as const, profileId: 'nursery-unit-estimate', cropKey: row.cropKey, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('transplant' as const, 'method'), nurseryDays: own(10, 'days'),
    fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'), fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months') } };
  const request: import('../lib/international/grower-autoplan.ts').GrowerAutoPlanRequest = {
    requestedAt: '2026-11-05T12:00:00.000Z', scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
    beds: source.beds.map(bed => ({ bed, scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-11-01', 'utc-date'), planningEndExclusive: own('2029-01-01', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope, window: own({ start: '2028-11-01', endExclusive: '2029-01-01' }, 'utc-date-window') })), reserved: [],
    demands: [{ demandId: 'nursery-unit-demand', profileId: profile.profileId, scope, totalKg: own(1, 'kg-total'), harvestWindow: own({ start: '2028-12-10', endExclusive: '2028-12-12' }, 'utc-date-window') }], maxAssessments: 1000 };
  const proposal = generateGrowerAutoPlan(request); assert.equal(proposal.status, 'ready', proposal.issues.join(','));
  const ownForecast = (settings: NurserySettings) => growerNursery.buildGrowerNurseryForecast({
    source: { kind: 'proposal', proposal, currentRequest: request, competingDemand: 'assessed-none' }, resourceContext: source, settings,
    settingsReview: own(growerNursery.nurserySettingsFingerprint(settings)!, 'nursery-settings-fingerprint'),
    horizon: own({ start: '2028-11-01', endExclusive: '2029-01-01' }, 'utc-date-window'),
    availability: own([], 'nursery-resource-windows'), otherReservations: own([], 'nursery-resource-reservations') });
  const baseline = actualForecast.buildNurseryForecast([], [], siteId, settings, { year: 2028, month: 12 });
  const ownBaseline = ownForecast(settings); assert.ok(ownBaseline.batches.length > 0); assert.ok(ownBaseline.batches[0].trays! > 0);
  const parent = boundMount(settings), ui = parent.ui;
  try {
    ui.edit('container'); ui.unit('imperial'); ui.change('Outer width', '12'); ui.change('Outer length', '20'); ui.submit('Save container changes');
    ui.edit('space'); ui.change('Net usable surface', '10'); ui.submit('Save space changes');
    const saved = crop.loadCropPlan().nursery!; assert.deepEqual(saved, nursery.sanitiseNurserySettings(settings));
    assert.deepEqual(actualForecast.buildNurseryForecast([], [], siteId, saved, { year: 2028, month: 12 }), baseline);
    assert.deepEqual(ownForecast(saved), ownBaseline, 'Actual own-profile starts, seeds, trays and surface demand retain their original canonical input');
  } finally { parent.dispose(); }
});

test('a delayed original save cannot write or clear another account after its context was withdrawn', async () => {
  const parent = boundMount(), ui = parent.ui; parent.delay();
  try {
    ui.edit('container'); ui.change('Outer width', '39'); ui.submit('Save container changes');
    const before = structuredClone([...local.rows]);
    act(() => { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); });
    await act(async () => { parent.release(); await Promise.resolve(); });
    assert.deepEqual([...local.rows], before); assert.doesNotMatch(ui.text(), /Private tray A|Private bench A|Saved on this device/);
  } finally { parent.dispose(); }
});

test('sample-only and quota-limited preference writes preserve the original field preference and report their real destination', () => {
  const oldSet = local.setItem; const context = prefs.captureNurseryUnitPreferenceContext(); assert.ok(context);
  try {
    local.setItem = () => { throw Error('Synthetic quota'); };
    assert.deepEqual(prefs.writeNurseryUnitPreference(context, 'imperial'), { remembered: false, destination: 'unavailable' });
  } finally { local.setItem = oldSet; prefs.revokeNurseryUnitPreferenceContext(context); }
  samples.enterSampleMode(); const sample = prefs.captureNurseryUnitPreferenceContext(); assert.ok(sample);
  const before = structuredClone([...local.rows]);
  try {
    assert.deepEqual(prefs.writeNurseryUnitPreference(sample, 'imperial'), { remembered: false, destination: 'sample' });
    assert.equal(prefs.readNurseryUnitPreference(sample).unit, 'imperial'); assert.deepEqual([...local.rows], before);
  } finally { prefs.revokeNurseryUnitPreferenceContext(sample); }
});

test('a confirmed foreign-only namespace rebase keeps another dirty form usable under the actual saved nursery source', () => {
  const settings = initial(); const otherSite = 'site:2.00000,2.00000';
  settings.spaces.push({ id: 'foreign-space', siteId: otherSite, name: 'Other nursery', usableM2: 3 });
  const parent = boundMount(settings), ui = parent.ui;
  try {
    ui.change('Space name', 'Another open form'); ui.change('Net usable surface', '5');
    ui.edit('container'); ui.change('Outer width', '31');
    const fresh = crop.loadCropPlan(); fresh.nursery!.spaces[1].usableM2 = 17; fresh.updatedAt = Date.now(); assert.equal(crop.saveCropPlan(fresh), true);
    ui.submit('Save container changes'); assert.match(ui.text(), /Saved on this device/);
    assert.equal(ui.field('Space name').props.value, 'Another open form');
    ui.submit('Add nursery space'); assert.equal(ui.field('Space name').props.value, '', 'A confirmed foreign rebase must not strand the original own-site draft');
    const saved = crop.loadCropPlan().nursery!;
    assert.equal(saved.spaces.find(row => row.id === 'foreign-space')?.usableM2, 17);
    assert.equal(saved.spaces.find(row => row.name === 'Another open form')?.usableM2, 5);
  } finally { parent.dispose(); }
});

test('the actual producer context may arrive after mount: pristine inputs become usable without a failed first save', () => {
  const parent = boundMount(initial(), true), ui = parent.ui;
  try {
    assert.equal(ui.field('Container name').props.disabled, true);
    assert.match(ui.text(), /Preparing the nursery save context/);
    const stale = ui.field('Container name').props.onChange;
    parent.ready(); assert.notEqual(ui.field('Container name').props.disabled, true);
    act(() => stale({ target: { value: 'Unbound old input' } })); assert.equal(ui.field('Container name').props.value, '');
    ui.edit('container'); ui.change('Outer width', '41'); ui.submit('Save container changes');
    assert.match(ui.text(), /Saved on this device/); assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 41);
  } finally { parent.dispose(); }
});

test('a producer context arriving after legacy interaction cannot silently approve that earlier unbound intent', () => {
  const parent = boundMount(initial(), true, true), ui = parent.ui;
  try {
    ui.edit('container'); ui.change('Outer width', '42'); parent.ready();
    assert.equal(ui.field('Outer width').props.value, '42'); assert.equal(ui.button('Save container changes').props.disabled, true);
    const before = crop.cropPlanWriteToken(); ui.submit('Save container changes'); assert.equal(crop.cropPlanWriteToken(), before);
    ui.click('Reload saved nursery settings'); ui.edit('container'); assert.notEqual(ui.field('Outer width').props.value, '42');
    ui.change('Outer width', '43'); ui.submit('Save container changes'); assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 43);
  } finally { parent.dispose(); }
});

test('withdrawing local catalogue support revokes a retained forecast export before any delivery attempt', async () => {
  const ui = mount(initial(), { allowCatalogueForecast: true });
  try {
    const retained = ui.button('Download nursery CSV').props.onClick;
    observations.forbidden = true; ui.update({ allowCatalogueForecast: false });
    await retained(); assert.equal(observations.deliveries, 0);
  } finally { ui.dispose(); }
});

test('an equivalent parent context reissue keeps the original dirty request usable against the same private saved base', () => {
  const parent = boundMount(), ui = parent.ui;
  try {
    ui.edit('container'); ui.change('Outer width', '44'); parent.reissueContext();
    assert.equal(ui.field('Outer width').props.value, '44'); ui.submit('Save container changes');
    assert.match(ui.text(), /Saved on this device/); assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 44);
  } finally { parent.dispose(); }
});

test('a previous confirmed source key cannot bless a later dirty nursery draft after an actual same-bytes lease replacement', async () => {
  const parent = boundMount(), ui = parent.ui;
  try {
    ui.edit('container'); ui.change('Outer width', '31'); ui.submit('Save container changes');
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 31);
    ui.edit('container'); ui.change('Outer width', '32');
    releaseCropPlanFixture(); await initialiseCropPlanFixture();
    const fresh = crop.loadCropPlanWithWriteAdmission(); assert.equal(fresh.admission.status, 'ready');
    parent.state.plan = fresh.book; parent.state.nurseryProducerLive.current = { plan: fresh.book, conflict: false };
    parent.state.planWriteBase.current = { owner: account.activeAccountUid(), sample: samples.isSampleMode(), token: fresh.token,
      planKey: JSON.stringify(fresh.book), admission: fresh.admission };
    ui.update({ saveContext: null });
    assert.ok(ui.text().includes('Editing is on hold. Reopen the crop plan to check saved nursery settings.'));
    assert.ok(!ui.text().includes('Reload saved nursery settings to continue editing.'));
    ui.click('Reload saved nursery settings');
    assert.equal(ui.field('Outer width').props.value, '32');
    parent.reissueContext(); assert.equal(ui.field('Outer width').props.value, '32');
    assert.ok(ui.text().includes('Reload saved nursery settings to continue editing.'));
    assert.equal(ui.button('Save container changes').props.disabled, true, 'Historical success cannot grant a new source/lease to this unfinished nursery edit');
    const before = crop.cropPlanWriteToken(); ui.submit('Save container changes'); assert.equal(crop.cropPlanWriteToken(), before);
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 31);
    ui.click('Reload saved nursery settings'); ui.edit('container'); ui.change('Outer width', '33'); ui.submit('Save container changes');
    assert.equal(crop.loadCropPlan().nursery?.containers[0].widthCm, 33);
  } finally { parent.dispose(); }
});

test('the exact completed nursery result hands a retained second form to its delayed current parent context once', () => {
  const parent = boundMount(), ui = parent.ui; parent.delayPostContext();
  try {
    ui.change('Space name', 'Retained bench'); ui.change('Net usable surface', '4');
    ui.edit('container'); ui.change('Outer width', '34'); ui.submit('Save container changes'); assert.match(ui.text(), /Saved on this device/);
    assert.equal(ui.field('Space name').props.value, 'Retained bench'); assert.equal(ui.field('Space name').props.disabled, true);
    parent.flushPostContext(); assert.notEqual(ui.field('Space name').props.disabled, true);
    ui.submit('Add nursery space'); assert.equal(crop.loadCropPlan().nursery?.spaces.find(row => row.name === 'Retained bench')?.usableM2, 4);
  } finally { parent.dispose(); }
});

test('a replayed nursery state update cannot spend the confirmation before a clean saved form becomes editable', () => {
  replay.stateUpdaters = true;
  const parent = boundMount(initial()), ui = parent.ui;
  parent.delayPostContext();
  try {
    ui.change('Container name', 'DEMO synthetic tray');
    ui.change('Outer width', '32');
    ui.change('Outer length', '48');
    ui.change('Cells per container', '50');
    ui.submit('Add container type');

    assert.match(ui.text(), /Saved on this device/);
    const saved = crop.loadCropPlan().nursery!;
    const created = saved.containers.find(row => row.name === 'DEMO synthetic tray');
    assert.ok(created);
    assert.equal(created.widthCm, 32);
    assert.equal(created.lengthCm, 48);
    assert.equal(created.cells, 50);

    // Form is cleared after confirmed save
    assert.equal(ui.field('Container name').props.value, '');

    // Intentional hold while post-context is delayed: editing disabled until current context arrives
    assert.equal(ui.field('Container name').props.disabled, true);
    assert.doesNotMatch(ui.text(), /Reload saved nursery settings to continue editing/);

    // Current context arrives via parent flush
    parent.flushPostContext();

    // Inputs become editable again without requiring an explicit reload action
    assert.notEqual(ui.field('Container name').props.disabled, true);
    assert.doesNotMatch(ui.text(), /Reload saved nursery settings to continue editing/);
  } finally {
    parent.dispose(); replay.stateUpdaters = false;
  }
});


test('replaying a nursery handoff keeps another unfinished form tied to the confirmed saved source', () => {
  replay.stateUpdaters = true;
  const parent = boundMount(), ui = parent.ui; parent.delayPostContext();
  try {
    ui.change('Space name', 'DEMO retained bench'); ui.change('Net usable surface', '4');
    ui.edit('container'); ui.change('Outer width', '34'); ui.submit('Save container changes');
    assert.match(ui.text(), /Saved on this device/);
    assert.equal(ui.field('Space name').props.value, 'DEMO retained bench');
    assert.equal(ui.field('Space name').props.disabled, true);
    parent.flushPostContext();
    assert.notEqual(ui.field('Space name').props.disabled, true);
    ui.submit('Add nursery space');
    assert.equal(crop.loadCropPlan().nursery?.spaces.find(row => row.name === 'DEMO retained bench')?.usableM2, 4);
  } finally { parent.dispose(); replay.stateUpdaters = false; }
});
