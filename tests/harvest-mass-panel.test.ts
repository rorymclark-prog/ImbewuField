import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { reset, cleanup, probe, local, session, events, account, crop, samples, siteId, ownRow, stamp } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, initialiseCropPlanFixture, releaseCropPlanFixture } from './crop-plan-storage-fixture.ts';
import { CROPS, hasAutomaticPlanningBasis } from '../lib/crop-catalog.ts';
import type { HarvestTarget } from '../lib/crop-plan.ts';
import type { HarvestTargetsPanelProps } from '../components/crops/HarvestTargetsPanel.tsx';

const root = new URL('../', import.meta.url).href;
const observations = { forbidden: false, assessments: 0, suggestions: 0, forecasts: 0, defaults: 0 };
const replay = { stateUpdaters: false };
Object.assign(globalThis, { __harvestMassPanel: { observations, auth: probe.auth, React, replay } });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if ((context.parentURL?.endsWith('/lib/length-unit-preference.ts') || context.parentURL?.endsWith('/lib/nursery-save-receipt.ts')) && specifier === 'firebase/auth') return data(`export function onAuthStateChanged(_auth,next){const auth=globalThis.__harvestMassPanel.auth;auth.add(next);return()=>auth.delete(next);}`);
  if (context.parentURL?.endsWith('/components/crops/HarvestTargetsPanel.tsx')) {
    // Replay the updater with the same prior state, as the browser may do
    // before committing. Confirmation consumption belongs after that commit.
    if (specifier === 'react') return data(`
      const p=globalThis.__harvestMassPanel,React=p.React;
      export const useEffect=React.useEffect,useMemo=React.useMemo,useRef=React.useRef;
      export function useState(initial){const [value,set]=React.useState(initial);return [value,action=>set(
        typeof action==='function'&&p.replay.stateUpdaters
          ? previous=>{action(previous);return action(previous);} : action)];}`);

    if (specifier === '@/lib/harvest-targets') return data(`import {assessHarvestTarget as assess,targetMonthStamp as stamp,HARVEST_TARGET_BASIS} from ${JSON.stringify(new URL('../lib/harvest-targets.ts', import.meta.url).href)};
export {HARVEST_TARGET_BASIS};export function assessHarvestTarget(...args){const p=globalThis.__harvestMassPanel.observations;p.assessments++;if(p.forbidden)throw Error('Unapproved catalogue assessment');return assess(...args);}
export function targetMonthStamp(...args){const p=globalThis.__harvestMassPanel.observations;p.defaults++;if(p.forbidden)throw Error('Own record acquired catalogue month defaults');return stamp(...args);}`);
    if (specifier === '@/lib/crop-autosuggest') return data(`import {suggestHarvestTargets as build} from ${JSON.stringify(new URL('../lib/crop-autosuggest.ts', import.meta.url).href)};export function suggestHarvestTargets(...args){const p=globalThis.__harvestMassPanel.observations;p.suggestions++;if(p.forbidden)throw Error('Unapproved catalogue suggestion');return build(...args);}`);
    if (specifier === '@/lib/crop-export-schedule') return data(`import {buildNurseryForecast as build} from ${JSON.stringify(new URL('../lib/crop-export-schedule.ts', import.meta.url).href)};export function buildNurseryForecast(...args){const p=globalThis.__harvestMassPanel.observations;p.forecasts++;if(p.forbidden)throw Error('Unapproved catalogue nursery forecast');return build(...args);}`);
  }
  return next(specifier, context);
}, load(url, context, next) {
  if (url.startsWith(root) && url.endsWith('.tsx')) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
  return next(url, context);
} });
const { default: Panel } = await import('../components/crops/HarvestTargetsPanel.tsx');
const preferences = await import('../lib/length-unit-preference.ts');
const receipts = await import('../lib/nursery-save-receipt.ts');
const { createHarvestSaveFixture } = await import('./nursery-save-fixture.ts');
const { formatMassKilograms } = await import('../lib/mass-units.ts');
const { targetDemand } = await import('../lib/harvest-targets.ts');
const { growerDemandFromHarvestTarget } = await import('../lib/international/grower-harvest-demand.ts');
const { generateGrowerAutoPlan } = await import('../lib/international/grower-autoplan.ts');
const { normaliseGrowerCycleAttachment } = await import('../lib/international/grower-cycle.ts');
const { nurseryCeilRatio } = await import('../lib/crop-export-schedule.ts');
after(() => { hooks.deregister(); cleanup(); Reflect.deleteProperty(globalThis, '__harvestMassPanel'); });
beforeEach(async () => { await reset(); Object.assign(observations, { forbidden: false, assessments: 0, suggestions: 0, forecasts: 0, defaults: 0 }); replay.stateUpdaters = false; });
const cropDef = CROPS.find(hasAutomaticPlanningBasis)!;
const otherSite = 'site:2.00000,2.00000';
const weightTarget = (site = siteId): Extract<HarvestTarget, { weeklyKg: number }> => ({ id: site === siteId ? 'target-a' : 'target-b', siteId: site, cropKey: cropDef.key,
  weeklyKg: 7.123456789012345, outlet: site === siteId ? 'Private buyer A' : 'Other buyer', startMonth: '2028-02', endMonth: '2028-02' });
const packTarget = (): HarvestTarget => ({ id: 'target-a', siteId, cropKey: cropDef.key, unit: 'crates', weeklyQuantity: 4,
  kgPerUnit: 1.23456789012345, marketablePercent: 70, outlet: 'Private buyer A', startMonth: '2028-02', endMonth: '2028-02' });
const text = (node: ReactTestInstance | string): string => typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
function mount(targets: HarvestTarget[] = [weightTarget()], overrides: Partial<HarvestTargetsPanelProps> = {}) {
  let renderer!: ReactTestRenderer;
  const calls: HarvestTarget[][] = [], accepts: unknown[] = [];
  const props: HarvestTargetsPanelProps = { siteId, targets, beds: [{ id: 'bed-a', label: 'Synthetic measured bed', areaM2: 12 }], plantings: [], pattern: 'mild-frost', climate: {}, basis: 'own-records',
    onTargets(next) { calls.push(structuredClone(next)); return true; }, onAccept(result) { accepts.push(result); }, ...overrides };
  act(() => { renderer = create(React.createElement(Panel, props)); });
  function field(prefix: string) { const label = renderer.root.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix)); assert.ok(label, `Missing field ${prefix}`); return label.findAll(node => node.type === 'input' || node.type === 'select')[0]; }
  const button = (label: string) => renderer.root.findAllByType('button').find(node => text(node) === label)!;
  return { renderer, props, calls, accepts, field, button, text: () => text(renderer.root),
    change(prefix: string, value: string) { act(() => field(prefix).props.onChange({ target: { value } })); },
    massUnit(value: string) { act(() => renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.onChange({ target: { value } })); },
    click(label: string) { const item = button(label); assert.ok(item, label); act(() => item.props.onClick()); },
    edit() { this.click('Edit'); },
    remove() { const item = renderer.root.findAllByType('button').find(node => typeof node.props['aria-label'] === 'string' && node.props['aria-label'].startsWith('Remove ')); assert.ok(item); act(() => item.props.onClick()); },
    submit() { act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    update(next: Partial<HarvestTargetsPanelProps>) { Object.assign(props, next); act(() => renderer.update(React.createElement(Panel, props))); },
    dispose() { act(() => renderer.unmount()); } };
}
function boundMount(targets: HarvestTarget[] = [weightTarget()], options: { basis?: HarvestTargetsPanelProps['basis']; deferContext?: boolean; legacyBeforeContext?: boolean; useSave?: boolean } = {}) {
  const raw = { version: 1 as const, plantings: [], updatedAt: 1, harvestTargets: targets };
  if (samples.isSampleMode()) samples.setSandboxCropPlan(raw); else replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw));
  const parent = createHarvestSaveFixture(siteId);
  let ui!: ReturnType<typeof mount>, delay = false, postContextDelayed = false, release: (() => void) | null = null;
  let saves = 0;
  function save(next: HarvestTarget[], request?: import('../lib/nursery-save-receipt.ts').HarvestSaveRequest) {
    ++saves;
    const commit = () => { const result = parent.submit(next, request); if (result?.status === 'confirmed') ui.update({ targets: parent.state.plan.harvestTargets, ...(postContextDelayed ? {} : { saveContext: parent.context() }) }); return result; };
    if (delay) return new Promise<import('../lib/nursery-save-receipt.ts').HarvestSaveResult | false>(resolve => { release = () => resolve(commit()); });
    return commit();
  }
  ui = mount(targets, { basis: options.basis ?? 'own-records', saveContext: options.legacyBeforeContext ? undefined : null,
    onTargets: save, ...(options.useSave ? { onSaveTargets: save } : {}) });
  if (!options.deferContext) ui.update({ saveContext: parent.context() });
  return { ui, parent, get saves() { return saves; }, ready() { ui.update({ saveContext: parent.context() }); },
    reissue() { ui.update({ targets: structuredClone(parent.state.plan.harvestTargets), saveContext: parent.reissueContext() }); },
    delayPostContext() { postContextDelayed = true; }, flushPostContext() { postContextDelayed = false; ui.update({ saveContext: parent.context() }); },
    delay() { delay = true; }, release() { assert.ok(release); release(); }, dispose() { ui.dispose(); parent.dispose(); } };
}

test('SSR starts in kg and withholds private buyer fields before the actor context exists', () => {
  const html = renderToString(React.createElement(Panel, { siteId, targets: [weightTarget()], beds: [], plantings: [], pattern: 'mild-frost', climate: {}, basis: 'own-records', onTargets() {}, onAccept() {} }));
  assert.match(html, /Kilograms \(kg\)/); assert.doesNotMatch(html, /Private buyer A/);
});

test('weight and optional pack-weight toggles preserve exact canonical values, counts, months and share through untouched saves and reopen', () => {
  for (const target of [weightTarget(), packTarget()]) {
    const before = JSON.stringify(target), ui = mount([target]);
    try {
      ui.edit(); for (let i = 0; i < 12; ++i) { ui.massUnit('lb'); ui.massUnit('kg'); }
      assert.equal(ui.calls.length, 0); ui.submit(); assert.deepEqual(ui.calls[0], [target]); assert.equal(JSON.stringify(target), before);
      assert.match(ui.text(), /Save outcome is not confirmed/); assert.equal(ui.field('For (optional)').props.value, 'Private buyer A');
    } finally { ui.dispose(); }
    const reopened = mount([target]); try { reopened.edit(); reopened.massUnit('lb'); reopened.submit(); assert.deepEqual(reopened.calls[0], [target]); } finally { reopened.dispose(); }
  }
});

test('pound edits convert weekly weight once while counts and unknown pack weights are never inferred', () => {
  const ui = mount([]);
  try {
    ui.massUnit('lb'); assert.equal(ui.field('Weekly quantity').props.value, '');
    ui.change('Crop', cropDef.key); ui.change('Weekly quantity', '10'); ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.submit();
    assert.equal(ui.calls[0][0].weeklyKg, 4.5359237); assert.equal(ui.calls[0][0].marketablePercent, undefined);
  } finally { ui.dispose(); }
  const unknown = { ...packTarget(), kgPerUnit: undefined, marketablePercent: undefined }, packs = mount([unknown]);
  try { packs.edit(); packs.massUnit('lb'); packs.submit(); assert.deepEqual(packs.calls[0][0], crop.sanitiseHarvestTargets([unknown])[0]); assert.equal(packs.calls[0][0].weeklyQuantity, 4); assert.equal(packs.calls[0][0].kgPerUnit, undefined); } finally { packs.dispose(); }
});

test('optional own pack-weight entry uses pounds but leaves pack quantity, pack unit and missing own saleable share untouched', () => {
  const target = { ...packTarget(), kgPerUnit: undefined, marketablePercent: undefined }, ui = mount([target]);
  try { ui.edit(); ui.massUnit('lb'); ui.change('Harvest lb per', '2'); ui.submit(); const saved = ui.calls[0][0]; assert.equal(saved.kgPerUnit, 0.90718474); assert.equal(saved.weeklyQuantity, 4); assert.equal(saved.unit, 'crates'); assert.equal(saved.marketablePercent, undefined); } finally { ui.dispose(); }
});

test('incomplete, dirty-cleared and domain-invalid weights hold the original unit without publishing or remembering a relabel', () => {
  const ui = mount();
  try { ui.edit(); for (const invalid of [',', '', '0', '-1', '1,2.3']) { ui.change('Weekly quantity', invalid); ui.massUnit('lb'); assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.value, 'kg'); assert.equal(ui.field('Weekly quantity').props.value, invalid); ui.submit(); assert.equal(ui.calls.length, 0); } } finally { ui.dispose(); }
});

test('same-value source clones preserve dirty entries; changed same-site targets hold them until explicit reload, and stale unit callbacks cannot reinterpret text', () => {
  const ui = mount();
  try {
    ui.edit(); ui.change('Weekly quantity', '8'); const stale = ui.field('Weekly quantity').props.onChange;
    ui.update({ targets: [structuredClone(weightTarget())] }); assert.equal(ui.field('Weekly quantity').props.value, '8'); ui.massUnit('lb'); const shown = ui.field('Weekly quantity').props.value;
    act(() => stale({ target: { value: '99' } })); assert.equal(ui.field('Weekly quantity').props.value, shown);
    ui.update({ targets: [{ ...weightTarget(), weeklyKg: 9 }] }); ui.submit(); assert.equal(ui.calls.length, 0); assert.equal(ui.field('Weekly quantity').props.value, shown);
    ui.click('Reload saved harvest targets'); ui.edit(); ui.submit(); assert.equal(ui.calls[0][0].weeklyKg, 9);
  } finally { ui.dispose(); }
});

test('actual readback confirmations clear their original edit and support a subsequent legitimate edit after equivalent context reissue', () => {
  const parent = boundMount(), ui = parent.ui;
  try { ui.edit(); ui.massUnit('lb'); ui.change('Weekly quantity', '10'); parent.reissue(); ui.submit(); assert.match(ui.text(), /Buyer targets saved on this device/); assert.equal(ui.field('Weekly quantity').props.value, ''); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 4.5359237);
    ui.edit(); ui.change('Weekly quantity', '20'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 9.0718474); } finally { parent.dispose(); }
});

test('catalogue and own-record deletions both use the same actual acknowledged persist path, including the fallback onTargets consumer', () => {
  for (const basis of ['catalogue', 'own-records'] as const) for (const useSave of [false, true]) {
    const parent = boundMount([weightTarget(), weightTarget(otherSite)], { basis, useSave });
    try { parent.ui.remove(); assert.equal(parent.saves, 1); assert.deepEqual(crop.loadCropPlan().harvestTargets, [weightTarget(otherSite)]); assert.match(parent.ui.text(), /Buyer targets saved on this device/); } finally { parent.dispose(); }
  }
});

test('a pending original result holds entries and prevents a duplicate save until its real confirmation returns', async () => {
  const parent = boundMount(); parent.delay();
  try { parent.ui.edit(); parent.ui.change('Weekly quantity', '11'); parent.ui.submit(); assert.equal(parent.ui.field('Weekly quantity').props.value, '11'); parent.ui.submit(); assert.equal(parent.saves, 1);
    await act(async () => { parent.release(); await Promise.resolve(); }); assert.match(parent.ui.text(), /Buyer targets saved on this device/); assert.equal(parent.ui.field('Weekly quantity').props.value, ''); } finally { parent.dispose(); }
});

test('Boolean, void and thrown callbacks may follow a real performed write but cannot clear entries, claim rollback or duplicate an uncertain save', () => {
  for (const outcome of ['true', 'false', 'void', 'throw'] as const) {
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], updatedAt: 1, harvestTargets: [weightTarget()] }));
    let attempts = 0;
    const ui = mount(undefined, { onTargets(next) { ++attempts; assert.equal(crop.saveCropPlan({ ...crop.loadCropPlan(), harvestTargets: next }), true); if (outcome === 'throw') throw Error('After actual write'); return outcome === 'void' ? undefined : outcome === 'true'; } });
    try { ui.edit(); ui.change('Weekly quantity', '12'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 12); assert.equal(ui.field('Weekly quantity').props.value, '12'); assert.match(ui.text(), /Save outcome is not confirmed/); assert.doesNotMatch(ui.text(), /saved targets remain unchanged|Buyer targets saved on this device/); ui.submit(); assert.equal(attempts, 1); } finally { ui.dispose(); }
  }
});

test('a performed storage write followed by quota failure retains draft uncertainty and cannot automatically retry', () => {
  const parent = boundMount(), original = local.setItem;
  try { parent.ui.edit(); parent.ui.change('Weekly quantity', '13'); let writes = 0;
    local.setItem = function(key, value) { original.call(this, key, value); if (key.includes('imbewu_crop_plan_v2')) { ++writes; throw Error('Performed then quota'); } };
    parent.ui.submit(); assert.equal(writes, 1); assert.equal(parent.ui.field('Weekly quantity').props.value, '13'); assert.match(parent.ui.text(), /Save outcome is not confirmed/); parent.ui.submit(); assert.equal(writes, 1); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 13);
  } finally { local.setItem = original; parent.dispose(); }
});

test('explicit-null producer preparation holds inputs, then its first valid context enables the first save without losing a pristine editor', () => {
  const parent = boundMount([], { deferContext: true });
  try { const ui = parent.ui; assert.equal(ui.field('Weekly quantity').props.disabled, true); parent.ready(); assert.notEqual(ui.field('Weekly quantity').props.disabled, true);
    ui.change('Crop', cropDef.key); ui.change('Weekly quantity', '14'); ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 14); assert.match(ui.text(), /Buyer targets saved on this device/); } finally { parent.dispose(); }
});

test('a newly arriving actual producer cannot silently bless earlier legacy intent', () => {
  const parent = boundMount([weightTarget()], { deferContext: true, legacyBeforeContext: true });
  try { const ui = parent.ui; ui.edit(); ui.change('Weekly quantity', '15'); parent.ready(); assert.equal(ui.button('Save target changes').props.disabled, true); const before = crop.cropPlanWriteToken(); ui.submit(); assert.equal(crop.cropPlanWriteToken(), before); assert.equal(ui.field('Weekly quantity').props.value, '15'); ui.click('Reload saved harvest targets'); ui.edit(); ui.change('Weekly quantity', '16'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 16); } finally { parent.dispose(); }
});

test('a confirmed foreign-site rebase preserves new foreign targets and keeps the original own editor usable for its next save', () => {
  const parent = boundMount([weightTarget(), weightTarget(otherSite)]);
  try { const ui = parent.ui; ui.edit(); ui.change('Weekly quantity', '17'); const fresh = crop.loadCropPlan(); fresh.harvestTargets![1] = { ...weightTarget(otherSite), weeklyKg: 18 }; fresh.updatedAt = Date.now(); assert.equal(crop.saveCropPlan(fresh), true); ui.submit(); assert.match(ui.text(), /Buyer targets saved on this device/); assert.equal(crop.loadCropPlan().harvestTargets?.find(row => row.siteId === otherSite)?.weeklyKg, 18); ui.edit(); ui.change('Weekly quantity', '19'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.find(row => row.siteId === siteId)?.weeklyKg, 19); assert.equal(crop.loadCropPlan().harvestTargets?.find(row => row.siteId === otherSite)?.weeklyKg, 18); } finally { parent.dispose(); }
});

test('same-bytes lease replacement holds the original dirty target source despite identical saved bytes', async () => {
  const parent = boundMount();
  try { parent.ui.edit(); parent.ui.change('Weekly quantity', '20'); releaseCropPlanFixture(); await initialiseCropPlanFixture(); const before = crop.cropPlanWriteToken(); parent.ui.submit(); assert.equal(crop.cropPlanWriteToken(), before); assert.equal(parent.ui.field('Weekly quantity').props.value, '20'); } finally { parent.dispose(); }
});

test('account and sample changes withhold private buyer fields and invalidate retained valid edits and deletions', () => {
  for (const change of ['actor', 'sample'] as const) {
    const ui = mount([weightTarget()], { basis: 'catalogue' }); ui.edit(); ui.change('Weekly quantity', '21');
    const submit = ui.renderer.root.findByType('form').props.onSubmit;
    const remove = ui.renderer.root.findAllByType('button').find(node => typeof node.props['aria-label'] === 'string' && node.props['aria-label'].startsWith('Remove '))!.props.onClick;
    try { act(() => { if (change === 'actor') { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); }
      else { session.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); } });
      assert.doesNotMatch(ui.text(), /Private buyer A/); assert.equal(ui.renderer.root.findAllByType('form').length, 0); act(() => { submit({ preventDefault() {} }); remove(); }); assert.equal(ui.calls.length, 0);
    } finally { ui.dispose(); probe.actor = 'owner-a'; account.bindMountedAccountLocalStorageUid('owner-a'); session.removeItem('imbewu_sample_mode'); }
  }
});

test('a delayed result from a departed account cannot write to or certify the next account', async () => {
  const parent = boundMount(); parent.delay();
  try { parent.ui.edit(); parent.ui.change('Weekly quantity', '22'); parent.ui.submit(); const before = structuredClone([...local.rows]); act(() => { probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); for (const callback of probe.auth) callback({ uid: 'owner-b' }); }); await act(async () => { parent.release(); await Promise.resolve(); }); assert.deepEqual([...local.rows], before); assert.equal(parent.ui.renderer.root.findAllByType('form').length, 0); assert.doesNotMatch(parent.ui.text(), /Buyer targets saved on this device/); } finally { parent.dispose(); }
});

test('sample acknowledgment describes memory only and remembers no real device mass preference', () => {
  samples.enterSampleMode(); const before = structuredClone([...local.rows]), parent = boundMount([]);
  try { const ui = parent.ui; ui.massUnit('lb'); ui.change('Crop', cropDef.key); ui.change('Weekly quantity', '10'); ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.submit(); assert.equal(samples.getSandboxCropPlan().harvestTargets?.[0].weeklyKg, 4.5359237); assert.match(ui.text(), /Buyer targets kept in this sample session/); assert.doesNotMatch(ui.text(), /Buyer targets saved on this device/); assert.deepEqual([...local.rows], before); } finally { parent.dispose(); }
});

test('harvest mass remembering is account scoped and independent from original field and nursery preferences', () => {
  const context = preferences.captureHarvestMassUnitPreferenceContext()!, field = preferences.captureLengthUnitPreferenceContext()!, nursery = preferences.captureNurseryUnitPreferenceContext()!;
  try { assert.equal(preferences.writeHarvestMassUnitPreference(context, 'lb').remembered, true); assert.equal(preferences.readLengthUnitPreference(field).unit, 'm'); assert.equal(preferences.readNurseryUnitPreference(nursery).unit, 'metric');
    const ui = mount(); try { assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.value, 'lb'); } finally { ui.dispose(); }
    probe.actor = 'owner-b'; account.bindMountedAccountLocalStorageUid('owner-b'); assert.equal(preferences.readHarvestMassUnitPreference(context).destination, 'unavailable');
  } finally { preferences.revokeHarvestMassUnitPreferenceContext(context); preferences.revokeLengthUnitPreferenceContext(field); preferences.revokeNurseryUnitPreferenceContext(nursery); }
});

test('own buyer records never invoke catalogue assessment, suggestions, nursery forecast or default months, including pound edits', () => {
  observations.forbidden = true; const ui = mount([packTarget()]);
  try { ui.edit(); ui.massUnit('lb'); ui.change('Harvest lb per', '3'); ui.submit(); assert.deepEqual(observations, { forbidden: true, assessments: 0, suggestions: 0, forecasts: 0, defaults: 0 }); assert.equal(ui.button('Suggest target sowings'), undefined); } finally { ui.dispose(); }
});

test('catalogue assessment and review masses use the selected display unit without altering their canonical targets or proposal source', () => {
  const targets = [weightTarget()], before = JSON.stringify(targets), ui = mount(targets, { basis: 'catalogue' });
  try { assert.ok(observations.assessments > 0); ui.massUnit('lb'); assert.match(ui.text(), new RegExp(`${formatMassKilograms(targets[0].weeklyKg!, 'lb')} lb/week`)); ui.click('Suggest target sowings'); assert.ok(observations.suggestions > 0); const reviews = ui.renderer.root.findAllByProps({ 'aria-label': 'Target sowing review' }); assert.equal(reviews.length, 1); ui.massUnit('kg'); assert.equal(ui.renderer.root.findAllByProps({ 'aria-label': 'Target sowing review' }).length, 1); assert.equal(JSON.stringify(targets), before); assert.equal(ui.calls.length, 0); } finally { ui.dispose(); }
});

test('independent kilogram and pound UI entries preserve the actual one-cycle eight-position and nursery-ceiling boundary', async () => {
  // Synthetic engineering capacity from the existing real source fixture. This
  // checks a discrete planning boundary, not a recommended yield or tray size.
  const { row, source } = await ownRow();
  const attachment = normaliseGrowerCycleAttachment(row.growerCycle); assert.ok(attachment);
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit, provenance: { kind: 'grower-estimate' as const, recordedAt: stamp } });
  const profile: import('../lib/international/grower-planning.ts').GrowerPlanningProfile = { ...attachment.assessmentSnapshot.profile,
    inputs: { ...attachment.assessmentSnapshot.profile.inputs, allowedEntryMonths: own([2], 'utc-months'), yieldKgPerM2: own(2.3489604875, 'kg/m2/cycle') } };
  assert.equal(source.beds[0].areaM2, 8);
  const results: unknown[] = [];
  for (const [unit, entered] of [['kg', '4.5359237'], ['lb', '10']] as const) {
    const parent = boundMount([]), ui = parent.ui;
    try {
      ui.massUnit(unit); ui.change('Crop', profile.cropKey); ui.change('Weekly quantity', entered);
      ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.change('Saleable share', '100'); ui.submit();
      assert.match(ui.text(), /Buyer targets saved on this device/);
      const target = crop.loadCropPlan().harvestTargets![0];
      assert.equal(target.weeklyKg, 4.5359237, 'Independent physically equivalent entry must not retain the extra ULP that doubles a whole planning cycle');
      const aggregate = targetDemand(target); assert.ok(aggregate); assert.equal(aggregate.days, 29); assert.equal(aggregate.demandKg, 18.7916839);
      const adapted = growerDemandFromHarvestTarget({ target, profile, source, scope: source.scope, recordedAt: stamp });
      assert.equal(adapted.status, 'ready'); if (adapted.status !== 'ready') throw Error('Synthetic own demand held');
      const request: import('../lib/international/grower-autoplan.ts').GrowerAutoPlanRequest = { requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint, profiles: [profile],
        beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
        planningStart: own('2028-02-01', 'utc-date'), planningEndExclusive: own('2028-03-01', 'utc-date'),
        availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-02-01', endExclusive: '2028-03-01' }, 'utc-date-window') })),
        reserved: [], demands: [adapted.demand], maxAssessments: 1000 };
      const plan = generateGrowerAutoPlan(request); assert.equal(plan.status, 'ready'); assert.equal(plan.cycles.length, 1);
      const positions = plan.cycles.reduce((sum, cycle) => sum + cycle.assessment.capacity.estimatedPlantCount!, 0); assert.equal(positions, 8);
      const ceiling = nurseryCeilRatio([adapted.grossCapacityRequiredKg], [18.7916839]); assert.equal(ceiling, 1);
      results.push({ weeklyKg: target.weeklyKg, demandKg: aggregate.demandKg, grossKg: adapted.grossCapacityRequiredKg, cycles: plan.cycles.length, positions, ceiling });
    } finally { parent.dispose(); }
  }
  assert.deepEqual(results[1], results[0]);
});

test('a quota-limited remembered choice keeps its explicit unit usable without claiming it was remembered or touching other preference purposes', () => {
  const ui = mount([]), original = local.setItem, before = structuredClone([...local.rows]);
  try {
    local.setItem = () => { throw Error('Synthetic preference quota'); };
    ui.massUnit('lb'); assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.value, 'lb');
    assert.match(ui.text(), /Harvest weight unit works here, but could not be remembered on this device/);
    assert.equal(ui.calls.length, 0); assert.deepEqual([...local.rows], before);
  } finally { local.setItem = original; ui.dispose(); }
});

test('explicitly changing from weight to pack counts cannot leave an invisible invalid mass blocking the new pack editor', () => {
  const ui = mount([]);
  try {
    ui.change('Crop', cropDef.key); ui.change('Weekly quantity', '0'); ui.change('Sales unit', 'crates'); ui.change('Weekly quantity', '5');
    ui.massUnit('lb'); assert.equal(ui.renderer.root.findByProps({ 'aria-label': 'Harvest weight unit' }).props.value, 'lb');
    ui.change('First harvest month', '2028-02'); ui.change('Last harvest month', '2028-02'); ui.submit();
    assert.equal(ui.calls[0][0].weeklyQuantity, 5); assert.equal(ui.calls[0][0].kgPerUnit, undefined); assert.equal(ui.calls[0][0].weeklyKg, undefined);
  } finally { ui.dispose(); }
});

test('an existing awkward saved kilogram value is not silently migrated by its rounded pound display or an unchanged text event', () => {
  const originalKg = 4.535923700000001, parent = boundMount([{ ...weightTarget(), weeklyKg: originalKg }]);
  try {
    parent.ui.edit(); parent.ui.massUnit('lb'); assert.equal(parent.ui.field('Weekly quantity').props.value, '10');
    parent.ui.change('Weekly quantity', '10'); parent.ui.submit();
    assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, originalKg);
    assert.match(parent.ui.text(), /Buyer targets saved on this device/);
  } finally { parent.dispose(); }
});

test('a previous confirmed source key cannot bless a later dirty draft after an actual same-bytes lease replacement', async () => {
  const parent = boundMount(), ui = parent.ui;
  try {
    ui.edit(); ui.change('Weekly quantity', '23'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 23);
    ui.edit(); ui.change('Weekly quantity', '24');
    releaseCropPlanFixture(); await initialiseCropPlanFixture();
    // Model the actual readiness consumer installing its new, genuinely loaded
    // base. The old dirty UI intent must not borrow this replacement lease.
    const fresh = crop.loadCropPlanWithWriteAdmission(); assert.equal(fresh.admission.status, 'ready');
    const state = parent.parent.state;
    state.plan = fresh.book; state.nurseryProducerLive.current = { plan: fresh.book, conflict: false };
    state.planWriteBase.current = { owner: account.activeAccountUid(), sample: samples.isSampleMode(), token: fresh.token,
      planKey: JSON.stringify(fresh.book), admission: fresh.admission };
    ui.update({ saveContext: null });
    assert.ok(ui.text().includes('Editing is on hold. Reopen the crop plan to check saved harvest targets.'));
    assert.ok(!ui.text().includes('Reload saved harvest targets to continue editing.'));
    ui.click('Reload saved harvest targets');
    assert.equal(ui.field('Weekly quantity').props.value, '24');
    parent.reissue(); assert.equal(ui.field('Weekly quantity').props.value, '24');
    assert.ok(ui.text().includes('Reload saved harvest targets to continue editing.'));
    assert.equal(ui.button('Save target changes').props.disabled, true, 'Historical success cannot grant a new source/lease to this unfinished edit');
    const before = crop.cropPlanWriteToken(); ui.submit(); assert.equal(crop.cropPlanWriteToken(), before); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 23);
    ui.click('Reload saved harvest targets'); ui.edit(); ui.change('Weekly quantity', '25'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 25);
  } finally { parent.dispose(); }
});

test('the exact completed target result can hand off once to its delayed current parent context without reviving an unrelated lease', () => {
  const parent = boundMount(), ui = parent.ui; parent.delayPostContext();
  try {
    ui.edit(); ui.change('Weekly quantity', '26'); ui.submit(); assert.match(ui.text(), /Buyer targets saved on this device/);
    assert.equal(ui.field('Weekly quantity').props.value, ''); assert.equal(ui.field('Weekly quantity').props.disabled, true);
    parent.flushPostContext(); assert.notEqual(ui.field('Weekly quantity').props.disabled, true);
    ui.edit(); ui.change('Weekly quantity', '27'); ui.submit(); assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 27);
  } finally { parent.dispose(); }
});


test('a replayed target state update cannot spend the confirmation before the saved form becomes editable', () => {
  replay.stateUpdaters = true;
  const parent = boundMount(), ui = parent.ui; parent.delayPostContext();
  try {
    ui.edit(); ui.change('Weekly quantity', '26'); ui.submit();
    assert.match(ui.text(), /Buyer targets saved on this device/);
    assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 26);
    assert.equal(ui.field('Weekly quantity').props.value, '');
    assert.equal(ui.field('Weekly quantity').props.disabled, true);
    parent.flushPostContext();
    assert.notEqual(ui.field('Weekly quantity').props.disabled, true);
    ui.edit(); ui.change('Weekly quantity', '27'); ui.submit();
    assert.equal(crop.loadCropPlan().harvestTargets?.[0].weeklyKg, 27);
  } finally { parent.dispose(); replay.stateUpdaters = false; }
});
