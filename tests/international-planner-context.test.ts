import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS } from '@/lib/crop-catalog';
import { bindSiteContext, createSiteCountryContext } from '@/lib/international/site-context';
import type { SavedPlace } from '@/lib/saved-places';
import type { AutoSuggestResult } from '@/lib/crop-autosuggest';
import { IDEAL_PLAN_COPY, suggestIdealYearPlan } from '@/lib/crop-plan-ideal';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { createWorkspacePlanningReference, type WorkspacePlanningReference } from '@/lib/international/workspace-context';
import { normaliseGrowerPlanningProfile, type GrowerPlanningProfile, type GrowerPlanningScope } from '@/lib/international/grower-planning';
import { initialiseCropPlanFixture, releaseCropPlanFixture, canonicalCropPlanFixtureKey, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';

const siteId = 'site:0.00000,0.00000';
const query = new URLSearchParams({ canvasSite: siteId, auto: '1' });
const fixtureBed: PlanBed = { id: 'fixture-bed', label: 'Saved bed', areaM2: 1, minDimM: 1 };
const probe = { React, query, climateRequests: 0, idealRuns: 0, IDEAL_PLAN_COPY, suggestIdealYearPlan,
  beds: [fixtureBed] as PlanBed[] };
Object.assign(globalThis, { __internationalPlannerContext: probe, IS_REACT_ACT_ENVIRONMENT: true });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const routeUrl = new URL('../app/facilitator/crops/page.tsx', import.meta.url).href;
const workflowHookUrl = new URL('../components/crops/useGrowerWorkflow.ts', import.meta.url).href;
const rootUrl = new URL('../', import.meta.url).href;
const boundary = (name: string) => moduleUrl(`
const React = globalThis.__internationalPlannerContext.React;
function Boundary(props) { return React.createElement('div', { 'data-boundary': ${JSON.stringify(name)}, 'data-props': props }); }
export default Boundary;
export const PRODUCT_ICON = {};
export const VarietyGuidance = Boundary;
// This is only the independent notice presentation. The real page, storage
// initializer/admission and country policy below are never replaced by it.
export const CropPlanStorageNotice = Boundary;
`);
// Keep the real page, its state/mutation handlers, country form, storage and hold
// view. Stub independent UI widgets and geometry/network inputs, never the policy.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './firebase/init' && /\/lib\/(?:saved-places|account-local-storage|user-sync)\.ts/.test(context.parentURL ?? '')) {
      return { url: moduleUrl('export const getFirebase = () => null; export const isBackendConfigured = () => false;'), shortCircuit: true };
    }
    if (specifier === 'next/link') return { url: moduleUrl(`
      const React = globalThis.__internationalPlannerContext.React;
      export default function Link({children,...props}) { return React.createElement('a', props, children); }
    `), shortCircuit: true };
    // The page now mounts a named coordinator hook. Keep that real hook so its
    // source/book invalidation still runs; only its external cloud query is a
    // controlled boundary, just like the existing route-level design list.
    if (context.parentURL === workflowHookUrl && specifier === '@/lib/db/queries') {
      return { url: moduleUrl('export const myDesigns = async () => [];'), shortCircuit: true };
    }
    if (context.parentURL === routeUrl) {
      if (specifier === '@/lib/firebase/init') return { url: moduleUrl('export const getFirebase = () => null; export const isBackendConfigured = () => false;'), shortCircuit: true };
      if (specifier === 'next/navigation') return { url: moduleUrl('export const useSearchParams = () => globalThis.__internationalPlannerContext.query;'), shortCircuit: true };
      if (specifier === '@/lib/i18n') return { url: moduleUrl("export const useLanguage = () => ({lang:'en'});"), shortCircuit: true };
      if (specifier === '@/lib/app-level') return { url: moduleUrl("export const useAppLevel = () => 'simple';"), shortCircuit: true };
      if (specifier === '@/components/BackControl') return { url: moduleUrl('export const useRegisterBackControl = () => {};'), shortCircuit: true };
      if (specifier === '@/lib/db/queries') return { url: moduleUrl('export const myDesigns = async () => [];'), shortCircuit: true };
      if (specifier === '@/lib/design-canvas') return { url: moduleUrl("export const loadCanvasState = () => ({items:[]}); export const DESIGN_CANVAS_CHANGED_EVENT = 'fixture-canvas-changed';"), shortCircuit: true };
      if (specifier === '@/lib/design-beds-bridge') return { url: moduleUrl(`
        export const bedsFromDesignCanvas = () => structuredClone(globalThis.__internationalPlannerContext.beds);
        export const canvasSiteIdForPlace = () => ${JSON.stringify(siteId)};
        export const studioPlanChoices = () => [];
      `), shortCircuit: true };
      if (specifier === '@/lib/crop-plan-ideal') return { url: moduleUrl(`
        const probe = globalThis.__internationalPlannerContext;
        export const IDEAL_PLAN_COPY = probe.IDEAL_PLAN_COPY;
        export function suggestIdealYearPlan(...args) { probe.idealRuns++; return probe.suggestIdealYearPlan(...args); }
      `), shortCircuit: true };
      if (specifier === '@/lib/site-climate') return { url: moduleUrl(`
        export const resolveSiteClimate = async () => {globalThis.__internationalPlannerContext.climateRequests++; return null;};
        export const driestMonths = () => [];
      `), shortCircuit: true };
      if (specifier.startsWith('@/components/') && specifier !== '@/components/crops/useGrowerWorkflow'
        && !specifier.startsWith('@/components/international/') && !specifier.endsWith('.format')) {
        return { url: boundary(specifier), shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith(rootUrl) && url.endsWith('.tsx')) return { format: 'module', shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX,
      } }).outputText };
    return nextLoad(url, context);
  },
});
const { default: Planner } = await import('../app/facilitator/crops/page.tsx');
const { loadPlaces, loadPlaces: reloadPlaces } = await import('../lib/saved-places.ts');
const { bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__internationalPlannerContext'); });

function text(node: ReactTestInstance | string): string {
  return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join('');
}
class MemoryStorage {
  rows = new Map<string, string>();
  failWrite = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}

const countryContext = (countryCode: string) => createSiteCountryContext({ siteId, countryCode, confirmed: true }, '2026-11-02T12:00:00.000Z')!;
const fixturePlace = (countryCode?: string): SavedPlace => {
  const place: SavedPlace = { id: 'fictional-place', name: 'Fictional fixture', lat: 0, lon: 0,
    biome: 'Recorded value', rainfall: 0, elevation: 0, savedAt: '2026-11-01T12:00:00.000Z' };
  // Stored confirmations describe an exact place revision; a form's transient input cannot approve it.
  return { ...place, ...(countryCode ? { siteCountryContext: bindSiteContext(countryContext(countryCode), place)! } : {}) };
};
const crop = CROPS.find(candidate => candidate.yieldKgPerM2 !== 0)!;
const fixturePlan = { version: 1, plantings: [{ id: 'saved-sowing', bedId: 'fixture-bed', cropKey: crop.key, sowMonth: 1 }], updatedAt: 100 };

async function mount(countryCode?: string, options: {
  querySiteId?: string | null;
  plantings?: Planting[];
  designFallback?: boolean;
  localDesign?: boolean;
  noSavedPlaces?: boolean;
  auto?: boolean;
  workspaceReferences?: WorkspacePlanningReference[];
  growerPlanningProfiles?: GrowerPlanningProfile[];
} = {}) {
  const originals = new Map(['self', 'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'setTimeout', 'clearTimeout'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const localStorage = new MemoryStorage(), sessionStorage = new MemoryStorage();
  const browser = Object.assign(new EventTarget(), { localStorage, sessionStorage, innerHeight: 844, innerWidth: 390 });
  const document = Object.assign(new EventTarget(), { body: { style: { overflow: '' } } });
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  for (const [key, value] of Object.entries({ self: globalThis, window: browser, document, navigator: { onLine: true }, localStorage, sessionStorage,
    setTimeout(callback: () => void, delay: number) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id: number) { timers.delete(id); },
  })) Object.defineProperty(globalThis, key, { configurable: true, value });
  bindMountedAccountLocalStorageUid(null);
  if (options.querySiteId === null) query.delete('canvasSite');
  else query.set('canvasSite', options.querySiteId ?? siteId);
  if (options.auto === false) query.delete('auto'); else query.set('auto', '1');
  probe.beds = [structuredClone(fixtureBed)];
  localStorage.setItem('permamap_saved_places', JSON.stringify(options.noSavedPlaces ? [] : [fixturePlace(countryCode)]));
  localStorage.setItem('imbewu_crop_plan_v1', JSON.stringify({ ...fixturePlan, plantings: options.plantings ?? fixturePlan.plantings,
    ...(options.growerPlanningProfiles ? { growerPlanningProfiles: options.growerPlanningProfiles } : {}),
    ...(options.workspaceReferences ? { workspaceReferences: options.workspaceReferences } : {}) }));
  if (options.designFallback) localStorage.setItem('imbewu_facilitator_design_v1', JSON.stringify({
    version: 1, items: [], lines: [], sectors: [], pxPerM: 1, activeLayer: 'planting', hiddenLayers: [], savedAt: 100,
    bgSite: { lat: 0, lon: 0, name: 'Existing mapped fixture' },
  }));
  if (options.localDesign) localStorage.setItem('imbewu_facilitator_design_v1', JSON.stringify({
    version: 1, items: [{ id: fixtureBed.id, type: 'bed', x: 0, y: 0, wM: 1, hM: 1, rotation: 0 }],
    lines: [], sectors: [], pxPerM: 1, activeLayer: 'planting', hiddenLayers: [], savedAt: 100,
  }));
  probe.climateRequests = 0; probe.idealRuns = 0;
  // v1 is retained import evidence after the schema cutover. Acquire the real
  // lease and inspect the actual canonical book, rather than making old-key
  // assertions accidentally validate a copy that current writers never touch.
  const legacyBytes = localStorage.getItem('imbewu_crop_plan_v1');
  await initialiseCropPlanFixture();
  const canonicalKey = canonicalCropPlanFixtureKey();
  const savedRaw = () => {
    const envelope = JSON.parse(localStorage.getItem(canonicalKey)!);
    assert.equal(envelope.storageVersion, 2);
    assert.equal(typeof envelope.bookRaw, 'string');
    return envelope.bookRaw as string;
  };
  let renderer: ReactTestRenderer;
  await act(async () => { renderer = create(React.createElement(Planner)); });
  const field = (prefix: string) => {
    const label = renderer.root.findAllByType('label').find(node => typeof node.children[0] === 'string' && node.children[0].startsWith(prefix));
    assert.ok(label, `Missing country control: ${prefix}`);
    return label.findAll(node => node.type === 'input' || node.type === 'select')[0];
  };
  const saveTimers = () => {
    for (const [id, timer] of [...timers]) if (timer.delay === 400) { timers.delete(id); timer.callback(); }
  };
  return {
    get renderer() { return renderer; }, localStorage, timers, field, savedRaw, replaceSavedRaw: replaceCanonicalCropPlanFixtureRaw,
    text: () => text(renderer.root),
    boundaries(name: string) { return renderer.root.findAll(node => node.props['data-boundary'] === `@/components/crops/${name}`); },
    async change(prefix: string, value: string) { await act(async () => field(prefix).props.onChange({ target: { value } })); },
    async confirm() { await act(async () => renderer.root.findAllByType('input').find(node => node.props.type === 'checkbox' && node.parent?.type === 'label' && text(node.parent).includes('I confirm these details'))!.props.onChange({ target: { checked: true } })); },
    async submit() { await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} })); },
    async click(label: string) {
      const button = renderer.root.findAllByType('button').find(node => text(node).trim() === label);
      assert.ok(button, `Missing action: ${label}`);
      assert.notEqual(button.props.disabled, true, `Disabled action: ${label}`);
      await act(async () => button.props.onClick());
    },
    async acknowledgeReference() {
      const checkbox = renderer.root.findAllByType('input').find(node => node.props.type === 'checkbox'
        && node.parent?.type === 'label' && text(node.parent).includes('I choose South African reference planning'));
      assert.ok(checkbox, 'The grower must explicitly choose the reference basis');
      await act(async () => checkbox.props.onChange({ target: { checked: true } }));
    },
    async submitReference() {
      const form = renderer.root.findAllByType('form').find(node => node.findAllByType('button').some(button => text(button) === 'Save reference choice'));
      assert.ok(form, 'Missing explicit reference-choice form');
      await act(async () => form.props.onSubmit({ preventDefault() {} }));
    },
    async setStoredCountry(code: string, notify = true) {
      localStorage.setItem('permamap_saved_places', JSON.stringify([fixturePlace(code)]));
      if (notify) await act(async () => { browser.dispatchEvent(new Event('storage')); });
    },
    async changeBedKind(kind: 'plot') {
      probe.beds = [{ ...fixtureBed, kind }];
      await act(async () => { browser.dispatchEvent(new Event('fixture-canvas-changed')); });
    },
    async queueIdeal() {
      const irrigation = renderer.root.findAllByType('button').find(node => text(node).includes('Reliable irrigation for every crop cycle'));
      assert.ok(irrigation, 'The real planning questionnaire still asks about irrigation');
      await act(async () => irrigation.props.onClick());
      const generate = renderer.root.findAllByType('button').find(node => text(node).includes('Suggest a plan'));
      assert.ok(generate);
      assert.equal(generate.props.disabled, false, 'Generate through a valid questionnaire, not by bypassing its disabled button');
      await act(async () => generate.props.onClick());
      const queued = [...timers].find(([, timer]) => timer.delay === 30);
      assert.ok(queued, 'The ideal-year producer has been queued');
      return async () => { timers.delete(queued[0]); await act(async () => queued[1].callback()); };
    },
    async flushSave() { await act(async () => saveTimers()); },
    async remount() { await act(async () => { renderer.unmount(); }); await act(async () => { renderer = create(React.createElement(Planner)); }); },
    async dispose() {
      await act(async () => { renderer.unmount(); });
      releaseCropPlanFixture();
      assert.equal(localStorage.getItem('imbewu_crop_plan_v1'), legacyBytes, 'current planner actions must leave retired import evidence unchanged');
      for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); }
    },
  };
}

// Unsupported mapped sites now have a record-only target form. Its presence is
// intentional: assert its explicit basis and safe save boundary instead of the old
// blanket absence claim, while keeping catalogue advice and exports held below.
function assertOwnTargetRecords(screen: Awaited<ReturnType<typeof mount>>) {
  const targets = screen.boundaries('HarvestTargetsPanel');
  assert.equal(targets.length, 1);
  const props = targets[0].props['data-props'];
  assert.equal(props.basis, 'own-records');
  assert.equal(typeof props.onSaveTargets, 'function');
  assert.deepEqual(props.climate, {});
}

test('the real planner withholds recommendation and export widgets for unknown and foreign sites even with auto=1', async () => {
  for (const code of [undefined, 'KE', 'GB', 'US', 'BR']) {
    const screen = await mount(code);
    try {
      assert.match(screen.text(), code ? /Local crop planning is not available/ : /Confirm the site country/);
      assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
      assertOwnTargetRecords(screen);
      assert.equal(screen.boundaries('ProductionAvailabilityGraphs').length, 0);
      assert.equal(screen.renderer.root.findAllByProps({ 'aria-label': 'Planning support' }).length, 1);
      assert.equal(screen.text().includes('Auto-suggest a plan'), false);
      assert.equal(probe.climateRequests, 0);
      const nursery = screen.boundaries('NurseryPlanPanel');
      assert.equal(nursery.length, 1);
      assert.equal(nursery[0].props['data-props'].allowCatalogueForecast, false);
      assert.equal(screen.boundaries('ProductionRecordsEditor').length, 1);
      await screen.flushSave();
      assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
    } finally { await screen.dispose(); }
  }
});

test('the real country form requires renewed confirmation and persists metadata while preserving sowings on reload', async () => {
  const screen = await mount();
  try {
    await screen.change('Site country', 'ZA');
    assert.equal(screen.renderer.root.findAllByType('button').find(node => text(node) === 'Save country details')!.props.disabled, true);
    await screen.confirm();
    await screen.change('Agricultural region reference', 'Grower description');
    assert.equal(screen.renderer.root.findAllByType('button').find(node => text(node) === 'Save country details')!.props.disabled, true);
    await screen.confirm();
    await screen.submit();
    assert.equal(loadPlaces()[0].siteCountryContext?.countryCode, 'ZA');
    assert.equal(loadPlaces()[0].siteCountryContext?.agriculturalRegionReference, 'Grower description');
    assert.equal(screen.boundaries('CropPlanExportCard').length, 1);
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 1);
    assert.notEqual(screen.boundaries('HarvestTargetsPanel')[0].props['data-props'].basis, 'own-records');
    assert.equal(screen.renderer.root.findAllByProps({ 'aria-label': 'Planning support' }).length, 0);
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
    await screen.remount();
    assert.match(screen.text(), /Saved country: South Africa/);
    assert.equal(reloadPlaces()[0].siteCountryContext?.countryCode, 'ZA');
    assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
  } finally { await screen.dispose(); }
});

test('a stale harvest-target accept callback rereads the current country before mutating the saved plan', async () => {
  const screen = await mount('ZA');
  try {
    const accept = screen.boundaries('HarvestTargetsPanel')[0].props['data-props'].onAccept as (result: AutoSuggestResult) => void;
    await screen.setStoredCountry('KE', false);
    const result = { plantings: [{ ...fixturePlan.plantings[0], id: 'stale-suggestion' }], notes: [] } as unknown as AutoSuggestResult;
    await act(async () => accept(result));
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
    await screen.setStoredCountry('KE');
    assertOwnTargetRecords(screen);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    assert.match(screen.text(), /Local crop planning is not available/);
  } finally { await screen.dispose(); }
});

test('an already-open auto-suggest cannot queue generation after another tab changes the country', async () => {
  const screen = await mount('ZA');
  try {
    assert.match(screen.text(), /Auto-suggest a plan/);
    const generate = screen.renderer.root.findAllByType('button').find(node => text(node).includes('Suggest a plan'));
    assert.ok(generate);
    await screen.setStoredCountry('US', false);
    await act(async () => generate.props.onClick());
    assert.equal([...screen.timers.values()].filter(timer => timer.delay === 30).length, 0);
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
  } finally { await screen.dispose(); }
});

test('invalid and noncanonical deep links cannot borrow a confirmed saved site or legacy design context', async () => {
  for (const querySiteId of ['site:0,0', 'site:91.00000,0.00000', 'design:local', '']) {
    const screen = await mount('ZA', { querySiteId, designFallback: true });
    try {
      assert.equal(screen.renderer.root.findAllByProps({ 'aria-label': 'Invalid site link' }).length, 1, querySiteId);
      assert.match(screen.text(), /No other site’s planning context has been substituted/);
      assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
      assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
      assert.equal(screen.boundaries('ProductionRecordsEditor').length, 0);
      assert.equal(screen.text().includes('Auto-suggest a plan'), false);
      assert.equal(probe.climateRequests, 0);
      await screen.flushSave();
      assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
    } finally { await screen.dispose(); }
  }
});

test('an unsupported grower can record an existing crop identity without first accepting a proposed planting', async () => {
  const screen = await mount('KE', { plantings: [] });
  try {
    const editor = screen.boundaries('ProductionRecordsEditor')[0].props['data-props'];
    const option = editor.products.find((product: { iconKey: string }) => product.iconKey === `crop:${crop.key}`);
    assert.ok(option);
    const existingKeys = new Set(CROPS.map(value => `crop:${value.key}`));
    assert.ok(editor.products.every((product: { iconKey: string }) => existingKeys.has(product.iconKey)));
    assertOwnTargetRecords(screen);
    await act(async () => editor.onProductionRecordsChange([{ id: 'own-observation', siteId,
      sourceIconKey: option.iconKey, label: option.label, date: { year: 2026, month: 11 },
      quantity: 0, unit: 'kg', status: 'actual', provenance: 'fictional-example' }]));
    await screen.flushSave();
    const saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.plantings, []);
    assert.equal(saved.productionRecords.length, 1);
    assert.equal(saved.productionRecords[0].status, 'actual');
    assert.equal(saved.productionRecords[0].siteId, siteId);
    assert.equal(saved.productionRecords[0].quantity, 0);
  } finally { await screen.dispose(); }
});

test('the queued ideal producer runs for its supported scope but cannot run after a silent country change', async () => {
  const positive = await mount('ZA');
  try {
    const run = await positive.queueIdeal();
    assert.equal(probe.idealRuns, 0);
    await run();
    assert.equal(probe.idealRuns, 1, 'Positive control reaches the real producer');
  } finally { await positive.dispose(); }
  const changed = await mount('ZA');
  try {
    const run = await changed.queueIdeal();
    await changed.setStoredCountry('KE', false);
    await run();
    assert.equal(probe.idealRuns, 0);
    await changed.flushSave();
    assert.deepEqual(JSON.parse(changed.savedRaw()).plantings, fixturePlan.plantings);
  } finally { await changed.dispose(); }
});

test('a same-coordinate bed-kind change invalidates queued production and stale harvest-target acceptance', async () => {
  const screen = await mount('ZA');
  try {
    const accept = screen.boundaries('HarvestTargetsPanel')[0].props['data-props'].onAccept as (result: AutoSuggestResult) => void;
    const run = await screen.queueIdeal();
    await screen.changeBedKind('plot');
    await run();
    assert.equal(probe.idealRuns, 0);
    const result = { plantings: [{ ...fixturePlan.plantings[0], id: 'old-bed-kind-suggestion' }], notes: [] } as unknown as AutoSuggestResult;
    await act(async () => accept(result));
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()).plantings, fixturePlan.plantings);
  } finally { await screen.dispose(); }
});

test('the unmapped virtual planner needs an explicit reference choice, reloads it and withholds planning after revocation', async () => {
  const sowings = [{ ...fixturePlan.plantings[0], bedId: 'virtual-bed-1' }];
  const screen = await mount(undefined, { querySiteId: null, noSavedPlaces: true, auto: false, plantings: sowings });
  try {
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    await screen.click('Try a virtual reference bed');
    assert.equal(screen.renderer.root.findAllByType('button').find(node => text(node) === 'Save reference choice')!.props.disabled, true);
    await screen.submitReference();
    assert.equal(JSON.parse(screen.savedRaw()).workspaceReferences, undefined);
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
    await screen.acknowledgeReference(); await screen.submitReference();
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 1);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 1);
    assert.match(screen.text(), /South African reference planning selected/);
    assert.equal(probe.climateRequests, 0, 'An unmapped reference does not supply site coordinates');
    await screen.click('Auto-suggest a plan');
    const produce = await screen.queueIdeal();
    await produce();
    assert.equal(probe.idealRuns, 1, 'The explicit reference basis reaches the actual existing planner');
    const close = screen.renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Close');
    assert.ok(close, 'Close the proposal before using the workspace controls again');
    await act(async () => close.props.onClick());
    await screen.flushSave();
    let saved = JSON.parse(screen.savedRaw());
    assert.equal(saved.workspaceReferences[0].workspaceId, 'virtual-bed');
    assert.deepEqual(saved.plantings, sowings);
    assert.deepEqual(JSON.parse(screen.localStorage.getItem('permamap_saved_places')!), []);
    await screen.remount();
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 1);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 1);
    await screen.click('Remove reference choice');
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    await screen.flushSave();
    saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.workspaceReferences, []);
    assert.deepEqual(saved.plantings, sowings);
  } finally { await screen.dispose(); }
});

test('an unmapped local design keeps its own reference choice separate from a saved virtual-bed acknowledgement', async () => {
  const virtual = createWorkspacePlanningReference('virtual-bed', true)!;
  const screen = await mount(undefined, { querySiteId: null, noSavedPlaces: true, localDesign: true,
    auto: false, workspaceReferences: [virtual] });
  try {
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    assert.equal(screen.text().includes('South African reference planning selected'), false);
    await screen.acknowledgeReference(); await screen.submitReference();
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 1);
    await screen.flushSave();
    let saved = JSON.parse(screen.savedRaw());
    assert.equal(saved.workspaceReferences.length, 2);
    assert.deepEqual(saved.workspaceReferences.find((row: WorkspacePlanningReference) => row.workspaceId === 'virtual-bed'), virtual);
    assert.ok(saved.workspaceReferences.some((row: WorkspacePlanningReference) => row.workspaceId === 'design:local'));
    assert.deepEqual(saved.plantings, fixturePlan.plantings);
    await screen.click('Remove reference choice');
    await screen.flushSave();
    saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.workspaceReferences, [virtual]);
    assert.equal(screen.boundaries('HarvestTargetsPanel').length, 0);
  } finally { await screen.dispose(); }
});

test('a mapped foreign site cannot inherit an unmapped reference choice in the real planner', async () => {
  const reference = createWorkspacePlanningReference('virtual-bed', true)!;
  const local = createWorkspacePlanningReference('design:local', true)!;
  const screen = await mount('KE', { auto: false, workspaceReferences: [reference, local] });
  try {
    assertOwnTargetRecords(screen);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    assert.equal(screen.renderer.root.findAllByProps({ 'aria-label': 'Unmapped workspace reference basis' }).length, 0);
    assert.match(screen.text(), /Local crop planning is not available/);
    assert.equal(probe.climateRequests, 0);
    await screen.flushSave();
    const saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.workspaceReferences, [reference, local]);
    assert.deepEqual(saved.plantings, fixturePlan.plantings);
  } finally { await screen.dispose(); }
});

function ownProfile(profileId = 'grower-fixture', scope: GrowerPlanningScope = { kind: 'mapped-site', siteId }): GrowerPlanningProfile {
  const missing = { state: 'missing', reason: 'not-entered' };
  const zero = { state: 'provided', value: 0, unit: 'kg/m2/cycle', provenance: { kind: 'grower-estimate', recordedAt: '2026-11-02T12:00:00.000Z' } };
  return normaliseGrowerPlanningProfile({ version: 1, profileId, cropKey: crop.key, scope,
    inputs: { plantsPerM2: missing, yieldKgPerM2: zero, establishment: missing, nurseryDays: missing,
      fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing,
      turnaroundDays: missing, allowedEntryMonths: missing } })!;
}
function growerProps(screen: Awaited<ReturnType<typeof mount>>) {
  const panels = screen.boundaries('GrowerPlanningPanel');
  assert.equal(panels.length, 1, 'one grower-input editor belongs to the current planner scope');
  return panels[0].props['data-props'] as {
    scope: GrowerPlanningScope | null; beds: PlanBed[]; profiles: GrowerPlanningProfile[];
    onSaveProfiles: (profiles: GrowerPlanningProfile[]) => boolean;
  };
}

test('a foreign grower saves partial own estimates in the real plan without enabling catalogue advice', async () => {
  const screen = await mount('KE', { auto: false });
  let savedProfile: GrowerPlanningProfile;
  try {
    const props = growerProps(screen);
    assert.deepEqual(props.scope, { kind: 'mapped-site', siteId });
    assert.deepEqual(props.beds, [fixtureBed]);
    savedProfile = ownProfile();
    await act(async () => { assert.equal(props.onSaveProfiles([savedProfile]), true); });
    await screen.flushSave();
    const saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.growerPlanningProfiles, [savedProfile]);
    assert.deepEqual(saved.plantings, fixturePlan.plantings);
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0);
    assert.equal(probe.climateRequests, 0);
  } finally { await screen.dispose(); }
  const reloaded = await mount('KE', { auto: false, growerPlanningProfiles: [savedProfile!] });
  try { assert.deepEqual(growerProps(reloaded).profiles, [savedProfile!]); }
  finally { await reloaded.dispose(); }
});

test('grower calculations never receive the invented virtual reference bed as measured area', async () => {
  const screen = await mount(undefined, { querySiteId: null, noSavedPlaces: true, auto: false });
  try {
    await screen.click('Try a virtual reference bed');
    const props = growerProps(screen);
    assert.deepEqual(props.scope, { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' });
    assert.deepEqual(props.beds, [], 'an arbitrary virtual reference area is not a measured field');
    assert.equal(screen.boundaries('CropPlanExportCard').length, 0, 'own estimates do not acknowledge the SA reference');
  } finally { await screen.dispose(); }
});

test('a late grower save cannot write into another mounted account or claim a failed device save', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const save = growerProps(screen).onSaveProfiles;
    const before = screen.savedRaw();
    bindMountedAccountLocalStorageUid('other-owner');
    await act(async () => { assert.equal(save([ownProfile()]), false); });
    assert.equal(screen.savedRaw(), before);
    bindMountedAccountLocalStorageUid(null);
    screen.localStorage.failWrite = true;
    await act(async () => { assert.equal(save([ownProfile()]), false); });
    assert.equal(screen.savedRaw(), before);
    assert.match(screen.text(), /Not saving[\s\S]*not being kept/);
  } finally { bindMountedAccountLocalStorageUid(null); await screen.dispose(); }
});

test('the actual planner gives exports a live check for their original account and workspace', async () => {
  const screen = await mount('ZA', { auto: false });
  try {
    const exports = screen.boundaries('CropPlanExportCard');
    assert.equal(exports.length, 1);
    const current = exports[0].props['data-props'].contextCurrent as () => boolean;
    assert.equal(current(), true);
    sessionStorage.setItem('imbewu_sample_mode', 'unreadable-mode');
    assert.equal(current(), false);
    sessionStorage.removeItem('imbewu_sample_mode');
    assert.equal(current(), true);
    bindMountedAccountLocalStorageUid('other-owner');
    assert.equal(current(), false);
  } finally { bindMountedAccountLocalStorageUid(null); await screen.dispose(); }
});

test('a grower profile edit preserves newer records and profiles from another scope', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const save = growerProps(screen).onSaveProfiles;
    const foreign = ownProfile('other-workspace', { kind: 'unmapped-workspace', workspaceId: 'design:other' });
    const newerRows = [{ ...fixturePlan.plantings[0], id: 'newer-sowing' }];
    screen.replaceSavedRaw(JSON.stringify({ ...fixturePlan, updatedAt: 200,
      plantings: newerRows, growerPlanningProfiles: [foreign] }));
    await act(async () => { assert.equal(save([ownProfile()]), true); });
    await screen.flushSave();
    const saved = JSON.parse(screen.savedRaw());
    assert.deepEqual(saved.plantings, newerRows);
    assert.deepEqual(saved.growerPlanningProfiles, [foreign, ownProfile()]);
  } finally { await screen.dispose(); }
});

test('another tab’s newer assumptions in this scope cannot be overwritten by the older editor', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const save = growerProps(screen).onSaveProfiles;
    const newer = { ...fixturePlan, updatedAt: 200, growerPlanningProfiles: [ownProfile('newer-profile')] };
    screen.replaceSavedRaw(JSON.stringify(newer));
    await act(async () => { assert.equal(save([ownProfile()]), false); });
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()), newer);
  } finally { await screen.dispose(); }
});

test('an already queued autosave cannot erase another tab’s assumptions even before a profile button is pressed', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const newer = { ...fixturePlan, updatedAt: 200, growerPlanningProfiles: [ownProfile('other-tab')] };
    screen.replaceSavedRaw(JSON.stringify(newer));
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()), newer);
    assert.match(screen.text(), /The saved plan changed or could not be checked/);
    await act(async () => { assert.equal(growerProps(screen).onSaveProfiles([ownProfile()]), false); });
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()), newer);
  } finally { await screen.dispose(); }
});

test('a queued autosave preserves newer sowings even when both books have no grower profiles', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const newer = { ...fixturePlan, updatedAt: 200, plantings: [{ ...fixturePlan.plantings[0], id: 'newer-real-sowing' }] };
    screen.replaceSavedRaw(JSON.stringify(newer));
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()), newer);
    assert.match(screen.text(), /The saved plan changed or could not be checked/);
  } finally { await screen.dispose(); }
});

test('a queued autosave is abandoned before reading or writing a different mounted account’s plan', async () => {
  const screen = await mount('KE', { auto: false });
  try {
    const otherKey = 'imbewu_crop_plan_v1::imbewu-owner::uid:other-owner';
    const other = { ...fixturePlan, updatedAt: 200, plantings: [{ ...fixturePlan.plantings[0], id: 'other-owner-sowing' }] };
    const original = screen.savedRaw();
    screen.localStorage.setItem(otherKey, JSON.stringify(other));
    bindMountedAccountLocalStorageUid('other-owner');
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.localStorage.getItem(otherKey)!), other);
    assert.equal(screen.localStorage.getItem('imbewu_crop_plan_v2::imbewu-owner::uid:other-owner'), null,
      'an old account callback must not create a new canonical book for the different mounted owner');
    assert.equal(screen.savedRaw(), original);
  } finally { bindMountedAccountLocalStorageUid(null); await screen.dispose(); }
});

test('a local record edit cannot bless stale assumptions merely by queueing a new autosave', async () => {
  const screen = await mount('KE', { auto: false, growerPlanningProfiles: [ownProfile('old-profile')] });
  try {
    const newer = { ...fixturePlan, updatedAt: 200, growerPlanningProfiles: [ownProfile('newer-profile')] };
    screen.replaceSavedRaw(JSON.stringify(newer));
    const editor = screen.boundaries('ProductionRecordsEditor')[0].props['data-props'];
    const product = editor.products.find((item: { iconKey: string }) => item.iconKey === `crop:${crop.key}`);
    assert.ok(product);
    await act(async () => editor.onProductionRecordsChange([{ id: 'local-observation', siteId, sourceIconKey: product.iconKey,
      label: product.label, date: { year: 2026, month: 11 }, quantity: 0, unit: 'kg', status: 'actual', provenance: 'fictional-example' }]));
    await screen.flushSave();
    assert.deepEqual(JSON.parse(screen.savedRaw()), newer);
    assert.equal(screen.boundaries('ProductionRecordsEditor')[0].props['data-props'].productionRecords[0].id, 'local-observation',
      'the unsaved observation remains visible for recovery');
    assert.match(screen.text(), /The saved plan changed or could not be checked/);
  } finally { await screen.dispose(); }
});
