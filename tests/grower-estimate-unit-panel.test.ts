import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '../lib/crop-catalog.ts';
import { INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES, formatNurseryDimension } from '../lib/length-units.ts';
import { AVOIRDUPOIS_POUND_IN_KILOGRAMS, formatMassKilograms } from '../lib/mass-units.ts';
import { growerPlanningScopeKey, normaliseGrowerPlanningProfile, type GrowerPlanningProfile, type GrowerPlanningScope } from '../lib/international/grower-planning.ts';
import { growerEstimateDensityToCanonical, normaliseGrowerEstimateSourceReceipt, type GrowerEstimateDensityUnit } from '../lib/grower-estimate-units.ts';
import type { GrowerProfileChangeRequest } from '../lib/crop-plan.ts';
import type { GrowerPlanningPanelProps } from '../components/crops/GrowerPlanningPanel.tsx';

const panelUrl = new URL('../components/crops/GrowerPlanningPanel.tsx', import.meta.url).href;
const preferenceUrl = new URL('../lib/length-unit-preference.ts', import.meta.url).href;
const accountUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const probe = { actor: 'owner-a' as string | null, configured: true,
  auth: new Set<(user: { uid: string } | null) => void>(), errors: new Set<() => void>() };
Object.assign(globalThis, { __estimatePanel: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ([preferenceUrl, accountUrl].includes(context.parentURL ?? '') && specifier === './firebase/init') return data(`
    export const isBackendConfigured=()=>globalThis.__estimatePanel.configured;
    export const getFirebase=()=>({auth:{get currentUser(){const uid=globalThis.__estimatePanel.actor;return uid?{uid}:null;}}});`);
  if (context.parentURL === preferenceUrl && specifier === 'firebase/auth') return data(`
    export function onAuthStateChanged(_auth,next,error){const p=globalThis.__estimatePanel;p.auth.add(next);p.errors.add(error);return()=>{p.auth.delete(next);p.errors.delete(error);};}`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === panelUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/GrowerPlanningPanel.tsx');
const prefs = await import('../lib/length-unit-preference.ts');
const account = await import('../lib/account-local-storage.ts');
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
class MemoryStorage {
  rows = new Map<string, string>(); failRead = false; failWrite = false;
  onRead: (() => void) | null = null; onWrite: (() => void) | null = null;
  getItem(key: string) { this.onRead?.(); if (this.failRead) throw Error('unavailable'); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota'); this.rows.set(key, value); this.onWrite?.(); }
  removeItem(key: string) { this.rows.delete(key); }
}
let local: MemoryStorage, session: MemoryStorage, events: EventTarget, reloads: number;
const preferenceKey = () => account.accountLocalStorageKey('imbewu_grower_estimate_unit_v1', 'owner-a');
function actor(uid: string | null, observe = true) {
  probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid);
  if (observe) for (const next of probe.auth) next(uid ? { uid } : null);
}
function sample(value: boolean) {
  if (value) session.setItem('imbewu_sample_mode', '1'); else session.removeItem('imbewu_sample_mode');
  events.dispatchEvent(new Event('imbewu-sample-mode-changed'));
}
beforeEach(() => {
  probe.actor = 'owner-a'; probe.configured = true; account.bindMountedAccountLocalStorageUid('owner-a');
  local = new MemoryStorage(); session = new MemoryStorage(); reloads = 0;
  events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session, location: { reload() { ++reloads; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: events });
});
after(() => { hooks.deregister(); account.bindMountedAccountLocalStorageUid(null); delete (globalThis as Record<string, unknown>).__estimatePanel; });
const scope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' };
const otherScope: GrowerPlanningScope = { kind: 'mapped-site', siteId: 'site:2.00000,2.00000' };
const crop = CROPS[0];
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function mount(initialProfiles: GrowerPlanningProfile[] = [], initialScope: GrowerPlanningScope | null = scope, overrides: Partial<GrowerPlanningPanelProps> = {}) {
  let renderer!: ReactTestRenderer, fail = false;
  let profiles = structuredClone(initialProfiles);
  let onSave: (() => void) | null = null;
  const attempts: GrowerPlanningProfile[][] = [];
  const requests: Array<GrowerProfileChangeRequest | undefined> = [];
  const props: GrowerPlanningPanelProps = { scope: initialScope, beds: [{ id: 'synthetic-bed', label: 'Synthetic arithmetic area', areaM2: 12 }], profiles,
    onSaveProfiles(next, request) {
      attempts.push(structuredClone(next)); requests.push(structuredClone(request)); onSave?.();
      if (fail) return false;
      profiles = structuredClone(next); props.profiles = profiles; renderer.update(React.createElement(Panel, props)); return true;
    } };
  Object.assign(props, overrides);
  act(() => { renderer = create(React.createElement(Panel, props)); });
  const field = (label: string) => {
    const node = renderer.root.findAllByType('label').find(node => node.children.some(child => child === label));
    assert.ok(node, `Missing input: ${label}`); return node.findAll(node => node.type === 'input' || node.type === 'select')[0];
  };
  const button = (label: string) => { const node = renderer.root.findAllByType('button').find(node => text(node) === label); assert.ok(node, `Missing action: ${label}`); return node; };
  return { renderer, props, attempts, requests, field, button, text: () => text(renderer.root),
    get profiles() { return profiles; }, set fail(value: boolean) { fail = value; },
    // A callback can replace an earlier asserted-empty array. Read its current
    // typed result rather than extending that assertion's narrowing across saves.
    readProfiles(): GrowerPlanningProfile[] { return profiles; },
    handleSave(callback: () => void) { onSave = callback; },
    replaceProfiles(next: GrowerPlanningProfile[]) {
      profiles = structuredClone(next); props.profiles = profiles;
      act(() => renderer.update(React.createElement(Panel, props)));
    },
    change(label: string, value: string) { act(() => field(label).props.onChange({ target: { value } })); },
    check(label: string, checked = true) { act(() => field(label).props.onChange({ target: { checked } })); },
    click(label: string) { act(() => button(label).props.onClick()); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    update(next: Partial<GrowerPlanningPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { act(() => renderer.unmount()); } };
}
const plantMetric = 'Plant density (plants per m²)', harvestMetric = 'Harvest weight (kg per m² per cycle)';
const plantImperial = 'Plant density (plants per ft²)', harvestImperial = 'Harvest weight (lb per ft² per cycle)';
function fill(ui: ReturnType<typeof mount>) {
  // Synthetic arithmetic controls, not crop guidance or suggested durations.
  ui.change('Crop identity', crop.key); ui.change('Establishment method', 'direct');
  ui.change(plantMetric, '4'); ui.change(harvestMetric, '2');
  for (const [label, value] of [['Field entry to first harvest (days)', '20'], ['Picking duration (days)', '5'], ['Field occupancy (days)', '25'], ['Turnaround after clearing (days)', '0']]) ui.change(label, value);
  ui.check('I specify the allowed field-entry months'); ui.check('Dec'); ui.check('I supply these as my estimates');
  ui.change('Measured bed', 'synthetic-bed'); ui.change('Planned field-entry date (UTC)', '2026-12-01');
}
function savedProfile(plant: number, harvest: number): GrowerPlanningProfile {
  const missing = { state: 'missing', reason: 'not-entered' };
  const own = (value: number, unit: string) => ({ state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt: '2026-11-01T00:00:00.000Z' } });
  const result = normaliseGrowerPlanningProfile({ version: 1, profileId: 'precise-profile', cropKey: crop.key, scope, inputs: {
    plantsPerM2: own(plant, 'plants/m2'), yieldKgPerM2: own(harvest, 'kg/m2/cycle'), establishment: missing, nurseryDays: missing,
    fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing, turnaroundDays: missing, allowedEntryMonths: missing } });
  assert.ok(result); return result;
}
function provided(profile: GrowerPlanningProfile, name: 'plantsPerM2' | 'yieldKgPerM2') {
  const input = profile.inputs[name]; assert.equal(input.state, 'provided'); if (input.state !== 'provided') throw Error('missing estimate'); return input;
}

test('untouched loaded density survives repeated display switches exactly and saving still requires fresh grower confirmation', () => {
  const original = savedProfile(3.123456789012345, 0.234567890123456), before = JSON.stringify(original), ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`);
    for (let index = 0; index < 12; ++index) { ui.change('Estimate units', 'imperial'); ui.change('Estimate units', 'metric'); }
    ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /Confirm that you supply/);
    ui.check('I supply these as my estimates'); const start = new Date().toISOString(); ui.submit();
    const result = ui.profiles[0]; assert.equal(provided(result, 'plantsPerM2').value, provided(original, 'plantsPerM2').value);
    assert.equal(provided(result, 'yieldKgPerM2').value, provided(original, 'yieldKgPerM2').value);
    assert.ok(provided(result, 'plantsPerM2').provenance.recordedAt >= start);
    assert.equal(JSON.stringify(original), before); assert.equal(result.profileId, original.profileId);
  } finally { ui.dispose(); }
});

test('a remembered imperial choice loads with blank optional fields and never fills agronomy from the catalogue', () => {
  local.rows.set(preferenceKey(), JSON.stringify({ version: 1, unit: 'imperial' })); const ui = mount();
  try {
    assert.equal(ui.field('Estimate units').props.value, 'imperial'); assert.equal(ui.field(plantImperial).props.value, ''); assert.equal(ui.field(harvestImperial).props.value, '');
    ui.change('Crop identity', crop.key); ui.check('I supply these as my estimates'); ui.submit();
    assert.deepEqual(ui.profiles[0].inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' });
    assert.deepEqual(ui.profiles[0].inputs.yieldKgPerM2, { state: 'missing', reason: 'not-entered' });
    assert.equal(ui.field('Field occupancy (days)').props.value, ''); assert.equal(ui.field('Establishment method').props.value, '');
  } finally { ui.dispose(); }
});

test('edited imperial dot or comma decimals convert once while blank and explicit zero remain different canonical inputs', () => {
  const ui = mount(); try {
    ui.change('Estimate units', 'imperial'); ui.change('Crop identity', crop.key); ui.check('I supply these as my estimates');
    ui.change(plantImperial, '0,5'); ui.change(harvestImperial, '1'); ui.submit();
    assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 0.5 / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
    assert.equal(provided(ui.profiles[0], 'yieldKgPerM2').value, AVOIRDUPOIS_POUND_IN_KILOGRAMS / INTERNATIONAL_SQUARE_FOOT_IN_SQUARE_METRES);
    ui.change(plantImperial, ''); ui.change(harvestImperial, '0'); ui.submit();
    assert.deepEqual(ui.profiles[0].inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' }); assert.equal(provided(ui.profiles[0], 'yieldKgPerM2').value, 0);
    ui.change('Estimate units', 'metric'); assert.equal(ui.field(plantMetric).props.value, ''); assert.equal(ui.field(harvestMetric).props.value, '0');
  } finally { ui.dispose(); }
});

test('unit switches are atomic when either entry is unfinished or invalid and cannot remember the rejected choice', () => {
  const ui = mount(); try {
    ui.change(plantMetric, '3.123456789');
    for (const invalid of ['-', '.', ',', '1,000.5', '1e2', '2 kg', '-1']) {
      ui.change(harvestMetric, invalid); const before = new Map(local.rows); ui.change('Estimate units', 'imperial');
      assert.equal(ui.field('Estimate units').props.value, 'metric'); assert.equal(ui.field(plantMetric).props.value, '3.123456789'); assert.equal(ui.field(harvestMetric).props.value, invalid);
      assert.deepEqual(local.rows, before); assert.match(ui.text(), /Neither entry nor its unit was changed/);
      ui.change('Crop identity', crop.key); ui.check('I supply these as my estimates'); ui.submit(); assert.equal(ui.attempts.length, 0);
    }
    ui.change(harvestMetric, '.5'); ui.change('Estimate units', 'imperial'); assert.equal(ui.field('Estimate units').props.value, 'imperial');
  } finally { ui.dispose(); }
});

test('unit-only display changes preserve the canonical review, whole counts and dates without mutating measured area', () => {
  const ui = mount(); try {
    fill(ui); const bedsBefore = JSON.stringify(ui.props.beds); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Estimated plants: 48/); assert.match(ui.text(), /Estimated harvest weight per cycle: 24 kg/);
    ui.change('Estimate units', 'imperial');
    assert.match(ui.text(), /Estimated plants: 48/); assert.ok(ui.text().includes(`Measured area: ${formatNurseryDimension(12, 'ft2')} ft²`));
    assert.ok(ui.text().includes(`Estimated harvest weight per cycle: ${formatMassKilograms(24, 'lb')} lb`));
    assert.ok(ui.text().includes('2026-12-21')); assert.ok(ui.text().includes('2026-12-26')); assert.match(ui.text(), /Picking ends \(exclusive\) \(UTC\)/);
    assert.equal(JSON.stringify(ui.props.beds), bedsBefore); assert.equal(ui.attempts.length, 0);
    ui.change('Estimate units', 'metric'); assert.match(ui.text(), /Estimated harvest weight per cycle: 24 kg/);
  } finally { ui.dispose(); }
});

test('duration grammar and whole-day validation stay separate from decimal-comma density parsing', () => {
  const ui = mount(); try {
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '0,5'); ui.change('Field occupancy (days)', '1,5'); ui.check('I supply these as my estimates');
    assert.equal(ui.field('Field occupancy (days)').props.type, 'number'); ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /durations must be whole days/);
    ui.change('Field occupancy (days)', '1.5'); ui.submit(); assert.equal(ui.attempts.length, 0);
    ui.change('Field occupancy (days)', '2'); ui.submit(); assert.equal(ui.profiles[0].inputs.fieldOccupancyDays.state, 'provided');
    assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 0.5);
  } finally { ui.dispose(); }
});

test('same-actor preference and profile-save failures retain both exact draft strings, confirmation and chosen units', () => {
  const ui = mount(); try {
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '1,23456789'); ui.change(harvestMetric, '.5'); ui.check('I supply these as my estimates');
    local.failWrite = true; ui.change('Estimate units', 'imperial'); assert.match(ui.text(), /cannot be remembered/);
    const plant = ui.field(plantImperial).props.value, harvest = ui.field(harvestImperial).props.value;
    ui.fail = true; ui.submit(); assert.match(ui.text(), /Could not save on this device/);
    assert.equal(ui.field(plantImperial).props.value, plant); assert.equal(ui.field(harvestImperial).props.value, harvest); assert.equal(ui.field('I supply these as my estimates').props.checked, true);
    assert.equal(ui.field('Estimate units').props.value, 'imperial'); assert.deepEqual(ui.profiles, []);
    local.failWrite = false; ui.fail = false; ui.submit(); assert.equal(ui.profiles.length, 1); assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 1.23456789);
  } finally { ui.dispose(); }
});

test('preference read failure leaves a current actor able to enter and save estimates', () => {
  local.failRead = true; const ui = mount(); try {
    assert.match(ui.text(), /cannot be remembered/); ui.change('Crop identity', crop.key); ui.change(plantMetric, '1'); ui.check('I supply these as my estimates'); ui.submit();
    assert.equal(ui.profiles.length, 1); assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 1);
    assert.equal(ui.renderer.root.findAllByType('form').length, 1);
  } finally { ui.dispose(); }
});

test('an inaccessible preference storage object does not revoke a current actor or discard entered estimates', () => {
  Object.defineProperty(events, 'localStorage', { configurable: true, get() { throw Error('storage blocked'); } });
  const ui = mount(); try {
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '1,5'); ui.check('I supply these as my estimates');
    ui.change('Estimate units', 'imperial'); assert.match(ui.text(), /cannot be remembered/);
    ui.submit(); assert.equal(ui.profiles.length, 1); assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 1.5);
    assert.equal(ui.field('Estimate units').props.value, 'imperial');
  } finally { ui.dispose(); }
});

test('an actor switch before its observer refuses retained save, read, remove and unit callbacks without acquiring the new namespace', () => {
  const original = savedProfile(1, 0), ui = mount([original]); try {
    fill(ui); ui.click('Review estimated capacity and dates');
    const staleSave = ui.renderer.root.findByType('form').props.onSubmit;
    const staleEdit = ui.button(`Edit ${crop.name}`).props.onClick, staleRemove = ui.button(`Remove ${crop.name}`).props.onClick;
    const staleUnit = ui.field('Estimate units').props.onChange, rowsBefore = new Map(local.rows);
    act(() => { actor('owner-b', false); staleSave({ preventDefault() {} }); staleEdit(); staleRemove(); staleUnit({ target: { value: 'imperial' } }); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, [original]); assert.deepEqual(local.rows, rowsBefore);
    assert.equal(ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(ui.text(), /Estimated plants:|saved estimates/);
    assert.match(ui.text(), /previous private drafts will not be reused/); ui.click('Reload estimates'); assert.equal(reloads, 1);
    act(() => { actor('owner-a', false); staleSave({ preventDefault() {} }); staleEdit(); });
    assert.equal(ui.attempts.length, 0); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
  } finally { ui.dispose(); }
});

test('observed actor and sample changes withdraw private drafts immediately, and later returning cannot revive old handlers', () => {
  for (const transition of ['actor', 'sample', 'sign-out'] as const) {
    const ui = mount(); try {
      fill(ui); ui.click('Review estimated capacity and dates'); const save = ui.renderer.root.findByType('form').props.onSubmit;
      act(() => { if (transition === 'sample') sample(true); else actor(transition === 'sign-out' ? null : 'owner-b'); });
      assert.equal(ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(ui.text(), /Estimated plants:/);
      act(() => { if (transition === 'sample') sample(false); else actor('owner-a'); save({ preventDefault() {} }); });
      assert.equal(ui.attempts.length, 0); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    } finally { ui.dispose(); }
  }
});

test('scope replacement invalidates old handlers while a fresh editor starts empty in the new scope', () => {
  const ui = mount(); try {
    fill(ui); const save = ui.renderer.root.findByType('form').props.onSubmit, unit = ui.field('Estimate units').props.onChange;
    ui.update({ scope: otherScope }); act(() => { save({ preventDefault() {} }); unit({ target: { value: 'imperial' } }); });
    assert.equal(ui.attempts.length, 0); assert.equal(ui.field(plantMetric).props.value, ''); assert.equal(ui.field(harvestMetric).props.value, '');
    assert.equal(ui.field('I supply these as my estimates').props.checked, false); assert.equal(ui.field('Estimate units').props.value, 'metric');
    assert.equal(local.rows.size, 0);
  } finally { ui.dispose(); }
});

test('an external preference cannot reinterpret an unfinished local pair and a later completed pair switches without a save', () => {
  const ui = mount(), context = prefs.captureGrowerEstimateUnitPreferenceContext(); assert.ok(context);
  try {
    ui.change(plantMetric, '.'); ui.change(harvestMetric, '2');
    act(() => { prefs.writeGrowerEstimateUnitPreference(context, 'imperial'); });
    assert.equal(ui.field('Estimate units').props.value, 'metric'); assert.equal(ui.field(plantMetric).props.value, '.'); assert.equal(ui.field(harvestMetric).props.value, '2');
    ui.change(plantMetric, '1'); act(() => { prefs.writeGrowerEstimateUnitPreference(context, 'imperial'); });
    assert.equal(ui.field('Estimate units').props.value, 'imperial'); assert.equal(ui.attempts.length, 0);
  } finally { prefs.revokeGrowerEstimateUnitPreferenceContext(context); ui.dispose(); }
});

test('a nested preference write wins and a sample switch inside a unit write cannot restore the old private editor', () => {
  const context = prefs.captureGrowerEstimateUnitPreferenceContext(); assert.ok(context);
  let changeSample = false;
  const stop = prefs.subscribeGrowerEstimateUnitPreferenceValue(context, unit => {
    if (changeSample) sample(true); else if (unit === 'imperial') prefs.writeGrowerEstimateUnitPreference(context, 'metric');
  });
  const ui = mount(); try {
    fill(ui); ui.change('Estimate units', 'imperial'); assert.equal(ui.field('Estimate units').props.value, 'metric'); assert.equal(ui.field(plantMetric).props.value, '4');
    changeSample = true; ui.change('Estimate units', 'imperial'); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    assert.equal(ui.attempts.length, 0); assert.doesNotMatch(ui.text(), /Estimated plants:|Profile saved/);
  } finally { stop(); prefs.revokeGrowerEstimateUnitPreferenceContext(context); ui.dispose(); }
});

test('a reentrant actor change in parent persistence cannot publish success or retain private form state', () => {
  const ui = mount(); try {
    fill(ui); ui.handleSave(() => actor('owner-b'));
    ui.submit(); assert.equal(ui.attempts.length, 1, 'the current parent callback was invoked before its own actor transition');
    assert.equal(ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(ui.text(), /Profile saved on this device/);
  } finally { ui.dispose(); }
  assert.equal(probe.auth.size, 0); assert.equal(probe.errors.size, 0);
});


test('null or malformed scope mounts no private editor, numeric draft or preference lease', () => {
  const original = savedProfile(1, 0);
  for (const invalid of [null, { kind: 'mapped-site', siteId: 'not-a-canonical-site' }, { kind: 'unmapped-workspace', workspaceId: '' }] as const) {
    const before = new Map(local.rows), ui = mount([original], invalid);
    try {
      assert.match(ui.text(), /Choose a current site or unmapped workspace first/);
      assert.equal(ui.renderer.root.findAllByType('form').length, 0);
      assert.equal(ui.renderer.root.findAllByType('input').length, 0);
      assert.equal(ui.renderer.root.findAllByType('select').length, 0);
      assert.doesNotMatch(ui.text(), /saved estimates|Estimated plants:/);
      assert.equal(probe.auth.size, 0, 'invalid scope cannot capture an account preference lease');
      assert.deepEqual(local.rows, before); assert.equal(ui.attempts.length, 0);
    } finally { ui.dispose(); }
  }
});

test('withdrawing scope and reopening the same scope cannot revive old save, review or preference callbacks', () => {
  const ui = mount(); try {
    fill(ui);
    const save = ui.renderer.root.findByType('form').props.onSubmit;
    const review = ui.button('Review estimated capacity and dates').props.onClick;
    const units = ui.field('Estimate units').props.onChange;
    ui.update({ scope: null }); assert.equal(probe.auth.size, 0);
    const before = new Map(local.rows);
    act(() => { save({ preventDefault() {} }); review(); units({ target: { value: 'imperial' } }); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(local.rows, before);
    assert.equal(ui.renderer.root.findAllByType('form').length, 0);
    ui.update({ scope });
    act(() => { save({ preventDefault() {} }); review(); units({ target: { value: 'imperial' } }); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(local.rows, before);
    assert.equal(ui.field(plantMetric).props.value, ''); assert.equal(ui.field(harvestMetric).props.value, '');
    assert.equal(ui.field('Estimate units').props.value, 'metric');
    assert.equal(ui.field('I supply these as my estimates').props.checked, false);
    assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { ui.dispose(); }
});


test('same-scope source replacement withdraws the review and holds old edits until an explicit reload and new confirmation', () => {
  const original = savedProfile(1, 0), replacement = savedProfile(7, 3), ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`); fill(ui); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    const save = ui.renderer.root.findByType('form').props.onSubmit;
    const review = ui.button('Review estimated capacity and dates').props.onClick;
    const remove = ui.button(`Remove ${crop.name}`).props.onClick;
    ui.replaceProfiles([replacement]);
    assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.match(ui.text(), /saved estimate changed/);
    ui.submit(); ui.click('Review estimated capacity and dates');
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, [replacement]);
    const heldSave = ui.renderer.root.findByType('form').props.onSubmit;
    const reload = ui.button('Reload saved estimate'); assert.match(reload.props.className, /min-h-11/);
    ui.click('Reload saved estimate');
    assert.equal(ui.field(plantMetric).props.value, '7'); assert.equal(ui.field(harvestMetric).props.value, '3');
    assert.equal(ui.field('I supply these as my estimates').props.checked, false);
    act(() => { save({ preventDefault() {} }); heldSave({ preventDefault() {} }); review(); remove(); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, [replacement]);
    ui.submit(); assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /Confirm that you supply/);
    ui.check('I supply these as my estimates'); ui.submit(); assert.equal(ui.attempts.length, 1);
    assert.equal(ui.profiles[0].profileId, original.profileId); assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, 7);
  } finally { ui.dispose(); }
});

test('deleted edited profiles cannot be recreated under the old ID and Start new profile requires a fresh confirmation', () => {
  const original = savedProfile(1, 0), ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates');
    const save = ui.renderer.root.findByType('form').props.onSubmit;
    const review = ui.button('Review estimated capacity and dates').props.onClick;
    ui.replaceProfiles([]); ui.submit(); ui.click('Review estimated capacity and dates');
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, []);
    assert.match(ui.text(), /was removed/); assert.equal(ui.renderer.root.findAllByType('button').filter(node => text(node) === 'Reload saved estimate').length, 0);
    assert.match(ui.button('Start a new profile').props.className, /min-h-11/); ui.click('Start a new profile');
    assert.equal(ui.field('Crop identity').props.value, ''); assert.equal(ui.field(plantMetric).props.value, '');
    assert.equal(ui.field('I supply these as my estimates').props.checked, false);
    act(() => { save({ preventDefault() {} }); review(); }); assert.equal(ui.attempts.length, 0);
    ui.change('Crop identity', crop.key); ui.submit(); assert.equal(ui.attempts.length, 0);
    ui.check('I supply these as my estimates'); ui.submit(); assert.equal(ui.profiles.length, 1);
    assert.notEqual(ui.readProfiles()[0].profileId, original.profileId);
  } finally { ui.dispose(); }
});

test('ambiguous or malformed current rows hold save, review and retained remove instead of choosing a row or repairing evidence', () => {
  const original = savedProfile(1, 0);
  const malformed: GrowerPlanningProfile = { ...original, inputs: { ...original.inputs,
    plantsPerM2: { state: 'provided', value: Number.POSITIVE_INFINITY, unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-01T00:00:00.000Z' } } } };
  for (const rows of [[original, original], [original, { ...original, scope: otherScope }], [malformed]]) {
    const ui = mount([original]); try {
      ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates'); const remove = ui.button(`Remove ${crop.name}`).props.onClick;
      ui.replaceProfiles(rows); ui.submit(); ui.click('Review estimated capacity and dates'); act(() => remove());
      assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, rows); assert.match(ui.text(), /cannot be read uniquely/);
      assert.doesNotMatch(ui.text(), /Estimated plants:/);
      assert.equal(ui.renderer.root.findAllByType('button').filter(node => text(node) === 'Reload saved estimate').length, 0);
    } finally { ui.dispose(); }
  }
});

test('a retained Edit or Remove button cannot select a replacement row that was never shown by that button', () => {
  const original = savedProfile(1, 0), replacement = savedProfile(9, 0), ui = mount([original]);
  try {
    const edit = ui.button(`Edit ${crop.name}`).props.onClick, remove = ui.button(`Remove ${crop.name}`).props.onClick;
    ui.replaceProfiles([replacement]); act(() => { edit(); remove(); });
    assert.equal(ui.field(plantMetric).props.value, ''); assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, [replacement]);
    assert.match(ui.text(), /saved estimate changed/);
    ui.click(`Edit ${crop.name}`); assert.equal(ui.field(plantMetric).props.value, '9');
    ui.click(`Remove ${crop.name}`); assert.equal(ui.attempts.length, 1); assert.deepEqual(ui.profiles, []);
  } finally { ui.dispose(); }
});

test('source provenance changes count as a changed row even when its numeric estimates are identical, and returning old bytes does not revive it', () => {
  const original = savedProfile(1, 0), changed: GrowerPlanningProfile = { ...original, inputs: { ...original.inputs,
    plantsPerM2: { ...provided(original, 'plantsPerM2'), unit: 'plants/m2', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-02T00:00:00.000Z', note: 'Revised source claim' } } } };
  const ui = mount([original]); try {
    ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates'); ui.replaceProfiles([changed]);
    assert.match(ui.text(), /saved estimate changed/); ui.replaceProfiles([original]); ui.submit();
    assert.equal(ui.attempts.length, 0); assert.match(ui.text(), /saved estimate changed/);
    ui.click('Reload saved estimate'); assert.equal(ui.field('I supply these as my estimates').props.checked, false);
    ui.check('I supply these as my estimates'); ui.submit(); assert.equal(ui.attempts.length, 1);
  } finally { ui.dispose(); }
});

test('unrelated row updates and unit display changes preserve a loaded draft and same-row failed-save entries', () => {
  const original = savedProfile(1.23456789012345, 0), unrelated = { ...savedProfile(2, 3), profileId: 'unrelated-profile' }, ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`); ui.change(plantMetric, '2,345678901'); ui.check('I supply these as my estimates');
    ui.replaceProfiles([original, unrelated]); ui.change('Estimate units', 'imperial');
    const plant = ui.field(plantImperial).props.value, harvest = ui.field(harvestImperial).props.value;
    ui.fail = true; ui.submit(); assert.equal(ui.attempts.length, 1); assert.match(ui.text(), /Could not save on this device/);
    assert.equal(ui.field(plantImperial).props.value, plant); assert.equal(ui.field(harvestImperial).props.value, harvest);
    assert.equal(ui.field('I supply these as my estimates').props.checked, true); assert.deepEqual(ui.profiles, [original, unrelated]);
    assert.doesNotMatch(ui.text(), /saved estimate changed/);
    ui.fail = false; ui.submit(); assert.equal(ui.attempts.length, 2);
    assert.equal(provided(ui.profiles.find(row => row.profileId === original.profileId)!, 'plantsPerM2').value, 2.345678901);
    assert.deepEqual(ui.profiles.find(row => row.profileId === unrelated.profileId), unrelated);
    ui.change('Estimate units', 'metric'); ui.submit(); assert.equal(ui.attempts.length, 3, 'successful save binds the new row for a later current save');
  } finally { ui.dispose(); }
});

test('a current same-source reload generation cannot be adopted by older callbacks even after fresh confirmation', () => {
  const original = savedProfile(1, 0), ui = mount([original]); try {
    ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates');
    const save = ui.renderer.root.findByType('form').props.onSubmit, review = ui.button('Review estimated capacity and dates').props.onClick;
    const remove = ui.button(`Remove ${crop.name}`).props.onClick;
    ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates');
    act(() => { save({ preventDefault() {} }); review(); remove(); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.profiles, [original]);
    assert.doesNotMatch(ui.text(), /Estimated plants:/); ui.submit(); assert.equal(ui.attempts.length, 1);
  } finally { ui.dispose(); }
});


function sourcedProfile(decimal: string, unit: GrowerEstimateDensityUnit): GrowerPlanningProfile {
  const value = growerEstimateDensityToCanonical(Number(decimal.replace(',', '.')), unit); assert.notEqual(value, null);
  if (value === null) throw Error('Invalid synthetic source fixture');
  const legacy = savedProfile(value, 0), scopeKey = growerPlanningScopeKey(legacy.scope); assert.ok(scopeKey);
  const owner = { scopeKey, profileId: legacy.profileId, cropKey: legacy.cropKey, field: 'plantsPerM2' as const };
  const receipt = normaliseGrowerEstimateSourceReceipt({ ...owner, version: 1, conversion: 'density-si-v1', decimal, unit }, owner, value);
  assert.ok(receipt);
  const profile = normaliseGrowerPlanningProfile({ ...legacy, exactDensitySources: { plantsPerM2: receipt } }); assert.ok(profile); return profile;
}

test('original imperial tokens survive display toggles, confirmed save and JSON reopen without inverse guessing', () => {
  const plantToken = '0,100000000000000000001', yieldToken = '1.250000000000000000001';
  const ui = mount(); let saved: GrowerPlanningProfile[] = [];
  try {
    ui.change('Estimate units', 'imperial'); ui.change('Crop identity', crop.key);
    ui.change(plantImperial, plantToken); ui.change(harvestImperial, yieldToken); ui.check('I supply these as my estimates');
    for (let index = 0; index < 4; ++index) { ui.change('Estimate units', 'metric'); ui.change('Estimate units', 'imperial'); }
    ui.submit(); assert.equal(ui.attempts.length, 1); saved = JSON.parse(JSON.stringify(ui.profiles));
    const plant = saved[0].exactDensitySources?.plantsPerM2, harvest = saved[0].exactDensitySources?.yieldKgPerM2;
    assert.ok(plant); assert.ok(harvest); assert.equal(plant.decimal, plantToken); assert.equal(plant.unit, 'plants/ft2');
    assert.equal(harvest.decimal, yieldToken); assert.equal(harvest.unit, 'lb/ft2/cycle');
    assert.equal(plant.profileId, saved[0].profileId); assert.equal(harvest.profileId, saved[0].profileId);
    assert.equal(plant.scopeKey, growerPlanningScopeKey(scope)); assert.equal(plant.cropKey, crop.key); assert.equal(plant.field, 'plantsPerM2');
    assert.equal(plant.conversion, 'density-si-v1'); assert.equal(plant.version, 1);
    assert.notEqual(plant.decimal, String(Number(plantToken.replace(',', '.'))), 'Number cannot reconstruct the entered lexical precision');
  } finally { ui.dispose(); }
  const reopened = mount(saved); try {
    reopened.click(`Edit ${crop.name}`); reopened.change('Estimate units', 'metric'); reopened.check('I supply these as my estimates'); reopened.submit();
    assert.equal(reopened.attempts.length, 1); assert.deepEqual(reopened.profiles[0].exactDensitySources, saved[0].exactDensitySources);
  } finally { reopened.dispose(); }
});

test('pristine legacy numbers gain no source receipt from toggles or unchanged displayed input events', () => {
  const original = savedProfile(1.23456789012345, 0.345678901234567), ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`); ui.change('Estimate units', 'imperial');
    ui.change(plantImperial, ui.field(plantImperial).props.value); ui.change(harvestImperial, ui.field(harvestImperial).props.value);
    ui.change('Estimate units', 'metric'); ui.check('I supply these as my estimates'); ui.submit();
    assert.equal(ui.attempts.length, 1); assert.equal(Object.hasOwn(ui.profiles[0], 'exactDensitySources'), false);
    assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, provided(original, 'plantsPerM2').value);
    assert.equal(provided(ui.profiles[0], 'yieldKgPerM2').value, provided(original, 'yieldKgPerM2').value);
  } finally { ui.dispose(); }
});

test('validated loaded source survives untouched display events, while an explicit metric re-entry records that new token', () => {
  const original = sourcedProfile('0.100000000000000000001', 'plants/ft2'), ui = mount([original]);
  try {
    ui.click(`Edit ${crop.name}`); ui.change(plantMetric, ui.field(plantMetric).props.value); ui.check('I supply these as my estimates'); ui.submit();
    assert.deepEqual(ui.profiles[0].exactDensitySources, original.exactDensitySources);
    const canonical = provided(ui.profiles[0], 'plantsPerM2').value;
    ui.change(plantMetric, ''); ui.change(plantMetric, String(canonical)); ui.submit();
    const source = ui.profiles[0].exactDensitySources?.plantsPerM2; assert.ok(source);
    assert.equal(source.decimal, String(canonical)); assert.equal(source.unit, 'plants/m2');
    assert.equal(provided(ui.profiles[0], 'plantsPerM2').value, canonical);
    ui.change(plantMetric, ''); ui.submit();
    assert.deepEqual(ui.profiles[0].inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' });
    assert.equal(Object.hasOwn(ui.profiles[0], 'exactDensitySources'), false, 'clearing the only captured field must omit the marker, not emit an empty one');
  } finally { ui.dispose(); }
});

test('a confirmed crop identity edit rebinds preserved source to that identity rather than dropping its exact digits', () => {
  const original = sourcedProfile('0,100000000000000000001', 'plants/ft2'), nextCrop = CROPS.find(row => row.key !== crop.key); assert.ok(nextCrop);
  const ui = mount([original]); try {
    ui.click(`Edit ${crop.name}`); ui.change('Crop identity', nextCrop.key); ui.check('I supply these as my estimates'); ui.submit();
    const source = ui.profiles[0].exactDensitySources?.plantsPerM2; assert.ok(source);
    assert.equal(source.cropKey, nextCrop.key); assert.equal(source.profileId, original.profileId);
    assert.equal(source.decimal, original.exactDensitySources?.plantsPerM2?.decimal); assert.equal(source.unit, 'plants/ft2');
  } finally { ui.dispose(); }
});

test('same-number lexical edits withdraw a review, while toggling an unchanged source keeps its review current', () => {
  const ui = mount(); try {
    fill(ui); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.change(plantMetric, '4.000000000000000000001'); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.change('Estimate units', 'imperial'); ui.change('Estimate units', 'metric'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.submit(); assert.equal(ui.profiles[0].exactDensitySources?.plantsPerM2?.decimal, '4.000000000000000000001');
  } finally { ui.dispose(); }
});

test('unfinished entries emit no receipts or operation requests and a failed save retains original source digits', () => {
  const ui = mount(); try {
    ui.change('Estimate units', 'imperial'); ui.change('Crop identity', crop.key); ui.check('I supply these as my estimates');
    ui.change(plantImperial, '0,100000000000000000001'); ui.change(harvestImperial, '-'); ui.submit();
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.requests, []); assert.equal(ui.field(harvestImperial).props.value, '-');
    ui.change('Estimate units', 'metric'); assert.equal(ui.field('Estimate units').props.value, 'imperial');
    ui.change(harvestImperial, '0'); ui.fail = true; ui.submit(); assert.equal(ui.attempts.length, 1);
    assert.match(ui.text(), /Could not save on this device/); assert.equal(ui.field(plantImperial).props.value, '0,100000000000000000001');
    assert.equal(ui.attempts[0][0].exactDensitySources?.plantsPerM2?.decimal, '0,100000000000000000001');
    ui.change('Estimate units', 'metric'); ui.fail = false; ui.submit(); assert.equal(ui.attempts.length, 2);
    assert.equal(ui.profiles[0].exactDensitySources?.plantsPerM2?.decimal, '0,100000000000000000001');
    assert.equal(ui.profiles[0].exactDensitySources?.plantsPerM2?.unit, 'plants/ft2');
  } finally { ui.dispose(); }
});

test('source origins cannot follow an actor transition into a new mounted account editor', () => {
  const ui = mount(); try {
    ui.change('Estimate units', 'imperial'); ui.change('Crop identity', crop.key); ui.change(plantImperial, '0.100000000000000000001'); ui.check('I supply these as my estimates');
    const save = ui.renderer.root.findByType('form').props.onSubmit;
    act(() => { actor('owner-b'); save({ preventDefault() {} }); });
    assert.equal(ui.attempts.length, 0); assert.deepEqual(ui.requests, []); assert.equal(ui.renderer.root.findAllByType('form').length, 0);
  } finally { ui.dispose(); }
  const reopened = mount(); try {
    reopened.change('Crop identity', crop.key); reopened.check('I supply these as my estimates'); reopened.submit();
    assert.equal(reopened.profiles.length, 1); assert.equal(Object.hasOwn(reopened.profiles[0], 'exactDensitySources'), false);
    assert.deepEqual(reopened.profiles[0].inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' });
  } finally { reopened.dispose(); }
});

test('confirmed save and removal send explicit full-row requests while review and display changes send none', () => {
  const ui = mount(); try {
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '1,000000000000000000001'); ui.check('I supply these as my estimates');
    ui.click('Review estimated capacity and dates'); ui.change('Estimate units', 'imperial'); assert.equal(ui.requests.length, 0);
    ui.submit(); assert.equal(ui.requests.length, 1);
    const created = ui.readProfiles()[0], first = ui.requests[0];
    assert.deepEqual(first, { kind: 'edit', profileId: created.profileId, expectedProfile: null });
    ui.click(`Edit ${crop.name}`); ui.change(harvestImperial, '0'); ui.check('I supply these as my estimates'); ui.submit();
    const second = ui.requests[1]; assert.deepEqual(second, { kind: 'edit', profileId: created.profileId, expectedProfile: created });
    const latest = structuredClone(ui.readProfiles()[0]); ui.click(`Remove ${crop.name}`);
    assert.deepEqual(ui.requests[2], { kind: 'remove', profileId: latest.profileId, expectedProfile: latest });
    assert.deepEqual(ui.profiles, []); assert.equal(ui.attempts.length, 3);
  } finally { ui.dispose(); }
});

test('exact source metadata replacement holds an open edit even when canonical values and ordinary provenance are identical', () => {
  const original = sourcedProfile('1.000000000000000000001', 'plants/m2');
  const replacement = sourcedProfile('1.000000000000000000002', 'plants/m2');
  assert.equal(provided(original, 'plantsPerM2').value, provided(replacement, 'plantsPerM2').value);
  assert.deepEqual(original.inputs, replacement.inputs);
  const ui = mount([original]); try {
    ui.click(`Edit ${crop.name}`); ui.check('I supply these as my estimates');
    const save = ui.renderer.root.findByType('form').props.onSubmit;
    ui.replaceProfiles([replacement]); ui.submit(); assert.equal(ui.attempts.length, 0); assert.equal(ui.requests.length, 0);
    assert.match(ui.text(), /saved estimate changed/); ui.click('Reload saved estimate');
    ui.check('I supply these as my estimates'); act(() => save({ preventDefault() {} })); assert.equal(ui.attempts.length, 0);
    ui.submit(); assert.equal(ui.attempts.length, 1);
    assert.equal(ui.profiles[0].exactDensitySources?.plantsPerM2?.decimal, '1.000000000000000000002');
    assert.deepEqual(ui.requests[0], { kind: 'edit', profileId: replacement.profileId, expectedProfile: replacement });
  } finally { ui.dispose(); }
});

test('clearing one captured density omits only that source while retaining an explicitly entered zero source in the other field', () => {
  const ui = mount(); try {
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '1.000000000000000000001'); ui.change(harvestMetric, '0,000'); ui.check('I supply these as my estimates'); ui.submit();
    assert.ok(ui.profiles[0].exactDensitySources?.plantsPerM2); assert.equal(ui.profiles[0].exactDensitySources?.yieldKgPerM2?.decimal, '0,000');
    ui.change(plantMetric, ''); ui.submit();
    assert.equal(Object.hasOwn(ui.profiles[0].exactDensitySources!, 'plantsPerM2'), false);
    assert.equal(ui.profiles[0].exactDensitySources?.yieldKgPerM2?.decimal, '0,000'); assert.equal(provided(ui.profiles[0], 'yieldKgPerM2').value, 0);
    assert.deepEqual(ui.profiles[0].inputs.plantsPerM2, { state: 'missing', reason: 'not-entered' });
  } finally { ui.dispose(); }
});

async function measurementSource(widthM = 3, heightM = 4, x = 0.5) {
  const siteId = 'site:1.00000,1.00000';
  const raw = { siteId, frame: { centerLng: 1, centerLat: 1, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
    items: [{ id: 'synthetic-bed', defId: 'veg_bed', x, y: 0.5, wM: widthM, hM: heightM, rot: 0 }],
    zones: [], lines: [], step: 'planting', updatedAt: '2026-11-04T12:00:00.000Z', rev: 1 };
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw, sourceRevision: JSON.stringify(raw) }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Synthetic measurement source held'); return source;
}
function deferredMeasurementCheck() {
  let resolve!: () => void, reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('required saved measurements hold manual review while profile saving remains usable, and the real refresh callback enables current-source review', async () => {
  const source = await measurementSource(); let checks = 0, ui!: ReturnType<typeof mount>;
  const check = async () => {
    ++checks;
    ui.update({ beds: source.beds, measuredAreas: source.measuredAreas, measurementsFingerprint: source.geometryFingerprint, measurementsReady: true });
  };
  ui = mount([], scope, { measurementsRequired: true, measurementsReady: false, onCheckMeasurements: check });
  try {
    fill(ui); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Check saved bed measurements before reviewing/); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.submit(); assert.equal(ui.attempts.length, 1, 'measurement admission must not disable independent profile persistence');
    const button = ui.button('Check saved bed measurements'); assert.match(button.props.className, /min-h-11/);
    await act(async () => { await button.props.onClick(); }); assert.equal(checks, 1);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    assert.equal(ui.attempts.length, 1); assert.match(ui.text(), /not an independent survey/);
  } finally { ui.dispose(); }
});

test('manual review forwards actual saved rectangle factors instead of treating their rounded product as a whole-plant count', async () => {
  const source = await measurementSource(0.75, 1.3333333333333333);
  assert.equal(source.beds[0].areaM2, 1, 'binary product alone would look like one full square metre');
  assert.deepEqual(source.measuredAreas[0].arithmeticBasis, { kind: 'saved-rectangle-metres-v1', widthM: 0.75, heightM: 1.3333333333333333 });
  const before = JSON.stringify(source), ui = mount([], scope, { beds: source.beds, measuredAreas: source.measuredAreas,
    measurementsRequired: true, measurementsReady: true, measurementsFingerprint: source.geometryFingerprint });
  try {
    fill(ui); ui.change(plantMetric, '1'); ui.click('Review estimated capacity and dates');
    assert.match(ui.text(), /Estimated plants: 0/); assert.doesNotMatch(ui.text(), /Estimated plants: 1/);
    assert.equal(ui.attempts.length, 0); assert.equal(JSON.stringify(source), before);
  } finally { ui.dispose(); }
});

test('supplied measurements must match one selected bed exactly and invalid arithmetic markers remain held by the shared normalizer', async () => {
  const source = await measurementSource(), row = source.measuredAreas[0];
  const ui = mount([], scope, { beds: source.beds, measuredAreas: source.measuredAreas,
    measurementsRequired: true, measurementsReady: true, measurementsFingerprint: source.geometryFingerprint });
  try {
    fill(ui);
    for (const measuredAreas of [[], [row, row], [{ ...row, areaM2: row.areaM2 + 1 }]]) {
      ui.update({ measuredAreas }); ui.click('Review estimated capacity and dates');
      assert.doesNotMatch(ui.text(), /Estimated plants:/); assert.match(ui.text(), /does not have one matching saved measurement/);
    }
    ui.update({ measuredAreas: [{ ...row, arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM: 1, heightM: 1 } }] });
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Invalid inputs/); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.update({ measuredAreas: source.measuredAreas }); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
  } finally { ui.dispose(); }
});

test('moving equal-area saved geometry, clearing its source or changing its arithmetic basis withdraws a displayed review', async () => {
  const source = await measurementSource(), moved = await measurementSource(3, 4, 0.6);
  assert.equal(source.beds[0].areaM2, moved.beds[0].areaM2); assert.notEqual(source.geometryFingerprint, moved.geometryFingerprint);
  const ui = mount([], scope, { beds: source.beds, measuredAreas: source.measuredAreas,
    measurementsRequired: true, measurementsReady: true, measurementsFingerprint: source.geometryFingerprint });
  try {
    fill(ui); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    const review = ui.button('Review estimated capacity and dates').props.onClick;
    ui.update({ beds: moved.beds, measuredAreas: moved.measuredAreas, measurementsFingerprint: moved.geometryFingerprint });
    assert.doesNotMatch(ui.text(), /Estimated plants:/); act(() => review()); assert.doesNotMatch(ui.text(), /Estimated plants:/);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.update({ measurementsReady: false, measurementsFingerprint: null, measuredAreas: undefined });
    assert.doesNotMatch(ui.text(), /Estimated plants:/); ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Check saved bed measurements before reviewing/);
    ui.update({ measurementsReady: true, measurementsFingerprint: moved.geometryFingerprint, measuredAreas: moved.measuredAreas });
    assert.doesNotMatch(ui.text(), /Estimated plants:/, 'restoring checked source does not revive a withdrawn review without a new review action');
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Estimated plants: 48/);
    ui.update({ measuredAreas: [{ ...moved.measuredAreas[0], arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM: 2, heightM: 6 } }] });
    assert.doesNotMatch(ui.text(), /Estimated plants:/, 'basis identity matters even if an upstream caller mistakenly retains the same fingerprint and area');
  } finally { ui.dispose(); }
});

test('a pending measurement check has a visible busy state, does not admit data merely by fulfilling and cannot run twice', async () => {
  const gate = deferredMeasurementCheck(); let checks = 0;
  const ui = mount([], scope, { measurementsRequired: true, measurementsReady: false,
    onCheckMeasurements: () => { ++checks; return gate.promise; } });
  let completion!: Promise<void>;
  try {
    fill(ui); const action = ui.button('Check saved bed measurements').props.onClick;
    act(() => { completion = action(); }); assert.match(ui.text(), /Checking saved bed measurements/);
    assert.equal(ui.button('Check saved bed measurements').props.disabled, true);
    act(() => { void action(); }); assert.equal(checks, 1);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Wait for the saved bed measurement check/);
    await act(async () => { gate.resolve(); await completion; });
    assert.equal(ui.button('Check saved bed measurements').props.disabled, false);
    ui.click('Review estimated capacity and dates'); assert.match(ui.text(), /Check saved bed measurements before reviewing/);
    assert.doesNotMatch(ui.text(), /Estimated plants:/);
  } finally { ui.dispose(); }
});

test('same-context measurement failures show an actionable hold, while late actor or edit-generation errors stay withdrawn', async () => {
  const ui = mount([], scope, { measurementsRequired: true, measurementsReady: false,
    onCheckMeasurements: async () => { throw Error('private raw source details'); } });
  try {
    await act(async () => { await ui.button('Check saved bed measurements').props.onClick(); });
    assert.match(ui.text(), /Could not check saved bed measurements/); assert.doesNotMatch(ui.text(), /private raw source details/);
  } finally { ui.dispose(); }
  for (const transition of ['actor', 'generation', 'source'] as const) {
    const gate = deferredMeasurementCheck(), next = mount([], scope, { measurementsRequired: true, measurementsReady: false, onCheckMeasurements: () => gate.promise });
    let completion!: Promise<void>;
    try {
      const action = next.button('Check saved bed measurements').props.onClick;
      act(() => { completion = action(); });
      if (transition === 'actor') act(() => actor('owner-b')); else if (transition === 'generation') next.click('Start a new profile');
      else next.update({ measurementsFingerprint: 'b'.repeat(64) });
      await act(async () => { gate.reject(Error('private old context')); await completion; });
      assert.doesNotMatch(next.text(), /Could not check saved bed measurements|private old context|Checking saved bed measurements/);
      if (transition === 'actor') assert.equal(next.renderer.root.findAllByType('form').length, 0);
      else assert.equal(next.field(plantMetric).props.value, '');
    } finally { next.dispose(); }
    if (transition === 'actor') actor('owner-a');
  }
});


test('a current measurement check survives the parent replacing its inline refresh callback during checking renders', async () => {
  const gate = deferredMeasurementCheck(); let calls = 0;
  const ui = mount([], scope, { measurementsRequired: true, measurementsReady: false,
    onCheckMeasurements: () => { ++calls; return gate.promise; } });
  let completion!: Promise<void>;
  try {
    const action = ui.button('Check saved bed measurements').props.onClick;
    ui.update({ onCheckMeasurements: () => { ++calls; return gate.promise; } });
    act(() => { completion = action(); }); assert.equal(calls, 1, 'current context may call the current inline callback without treating its object identity as authority');
    ui.update({ checkingMeasurements: true, onCheckMeasurements: async () => {} });
    assert.match(ui.text(), /Checking saved bed measurements/);
    ui.change('Crop identity', crop.key); ui.change(plantMetric, '1'); ui.check('I supply these as my estimates');
    assert.equal(ui.field(plantMetric).props.value, '1', 'profile editing remains available during the measurement check');
    ui.update({ checkingMeasurements: false, onCheckMeasurements: async () => {} });
    await act(async () => { gate.reject(Error('current source unavailable')); await completion; });
    assert.match(ui.text(), /Could not check saved bed measurements/); assert.doesNotMatch(ui.text(), /current source unavailable/);
  } finally { ui.dispose(); }
});
