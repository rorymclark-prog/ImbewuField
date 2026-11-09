import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { CROPS, hasPlanningYield } from '@/lib/crop-catalog';
import type { CropPlanState, PlanBed } from '@/lib/crop-plan';
import type { SavedPlace } from '@/lib/saved-places';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';

const sourceUrl = new URL('../lib/finance-plan-source.ts', import.meta.url).href;
const rootUrl = new URL('../', import.meta.url).href;
const probe = { React, uid: 'finance-a', canvases: new Map<string, PlanBed[]>(), legacy: null as unknown,
  forwardCalls: 0, comparisonCalls: 0, geometryReads: 0, forbidden: false,
  forward: null as unknown as (...args: unknown[]) => unknown,
  comparison: null as unknown as (...args: unknown[]) => unknown,
};
Object.assign(globalThis, { __internationalFinanceContext: probe, IS_REACT_ACT_ENVIRONMENT: true });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './firebase/init' && /\/lib\/(saved-places|account-local-storage|user-sync)\.ts$/.test(context.parentURL ?? '')) return {
      shortCircuit: true, url: moduleUrl(`const state=globalThis.__internationalFinanceContext;
export const isBackendConfigured=()=>true;
export const getFirebase=()=>({db:null,auth:{currentUser:state.uid?{uid:state.uid}:null}});`),
    };
    if (specifier === 'next/link') return { shortCircuit: true, url: moduleUrl(`const React=globalThis.__internationalFinanceContext.React;
export default function Link({children,...props}){return React.createElement('a',props,children);}`) };
    if (specifier === '@/lib/i18n') return { shortCircuit: true,
      url: moduleUrl("export const useLanguage=()=>({lang:'en',t:key=>key});") };
    if (context.parentURL === sourceUrl) {
      if (specifier === '@/lib/design-canvas') return { shortCircuit: true, url: moduleUrl("export const DESIGN_CANVAS_CHANGED_EVENT='finance-fixture-canvas'; export const loadCanvasState=siteId=>{globalThis.__internationalFinanceContext.geometryReads++;return {siteId};};") };
      if (specifier === '@/lib/design-beds-bridge') return { shortCircuit: true, url: moduleUrl(`export const bedsFromDesignCanvas=state=>structuredClone(globalThis.__internationalFinanceContext.canvases.get(state.siteId)??[]);`) };
      if (specifier === '@/lib/facilitator-design') return { shortCircuit: true, url: moduleUrl('export const loadFacilitatorState=()=>globalThis.__internationalFinanceContext.legacy;') };
    }
    if (context.parentURL?.endsWith('/components/ComingUpHarvests.tsx') && specifier === '@/lib/forward-harvests') return {
      shortCircuit: true, url: moduleUrl(`const p=globalThis.__internationalFinanceContext;
export function buildForwardHarvests(...args){p.forwardCalls++;if(p.forbidden)throw Error('Unsupported finance forecast executed');return p.forward(...args);}
export const forwardValueRows=(...args)=>globalThis.__internationalFinanceValueRows(...args);`),
    };
    if (context.parentURL?.endsWith('/components/FinanceGraphs.tsx') && specifier === '@/lib/plan-vs-actual') return {
      shortCircuit: true, url: moduleUrl(`const p=globalThis.__internationalFinanceContext;
export function buildPlanVsActual(...args){p.comparisonCalls++;if(p.forbidden)throw Error('Unsupported finance benchmark executed');return p.comparison(...args);}`),
    };
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
const { buildForwardHarvests, forwardValueRows } = await import('../lib/forward-harvests.ts');
const { buildPlanVsActual } = await import('../lib/plan-vs-actual.ts');
probe.forward = buildForwardHarvests as typeof probe.forward;
probe.comparison = buildPlanVsActual as typeof probe.comparison;
// Use the real projection-to-value adapter too; only observe whether forecasting runs.
Object.assign(globalThis, { __internationalFinanceValueRows: forwardValueRows });
const { loadFinancePlanSource, useFinancePlanSource } = await import('../lib/finance-plan-source.ts');
const { default: ComingUpHarvests } = await import('../components/ComingUpHarvests.tsx');
const { default: FinanceGraphs } = await import('../components/FinanceGraphs.tsx');
const { default: HarvestReconciliation } = await import('../components/HarvestReconciliation.tsx');
const { loadPlaces, updateSiteCountryContext } = await import('../lib/saved-places.ts');
const { createSiteCountryContext } = await import('../lib/international/site-context.ts');
const { createWorkspacePlanningReference } = await import('../lib/international/workspace-context.ts');
const { activeAccountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { buildFarmMetrics } = await import('../lib/farm-metrics.ts');
const { buildFinanceSeries } = await import('../lib/finance-series.ts');
after(() => { releaseCropPlanFixture(); hooks.deregister(); Reflect.deleteProperty(globalThis, '__internationalFinanceContext'); Reflect.deleteProperty(globalThis, '__internationalFinanceValueRows'); });

class MemoryStorage {
  rows = new Map<string, string>();
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
Object.assign(globalThis, { window: browser, localStorage: local, sessionStorage: session });
const siteId = 'site:0.00000,0.00000', otherSite = 'site:1.00000,1.00000';
const bed: PlanBed = { id: 'finance-bed', label: 'Fictional measured bed', areaM2: 1, minDimM: 1 };
const crop = CROPS.find(hasPlanningYield)!;
const now = new Date();
const production: ProductionLog[] = [{ id: 'observed-picking', profile_id: 'fixture-owner', garden_id: null, crop: crop.name,
  kg: 5, photo_url: null, logged_at: now.toISOString(), created_at: now.toISOString() }];
const sales: SalesLog[] = [{ id: 'recorded-sale', profile_id: 'fixture-owner', garden_id: null, crop: crop.name,
  kg: 2, amount: 10, buyer: null, sold_at: now.toISOString(), created_at: now.toISOString() }];
const settings = { lossPercent: 0, sellPercent: 100, confirmed: true };
const plan = (): CropPlanState => ({ version: 1, plantings: [{ id: 'own-sowing', bedId: bed.id, cropKey: crop.key, sowMonth: now.getMonth() + 1 }], updatedAt: 100 });
const place = (id = 'main-place', lat = 0, lon = 0): SavedPlace => ({ id, name: 'Fictional source boundary', lat, lon,
  biome: 'Recorded', rainfall: 0, elevation: 0, savedAt: '2026-11-01T00:00:00.000Z', updatedAt: id === 'main-place' ? 100 : 50 });

function savePlan(value: CropPlanState) { replaceCanonicalCropPlanFixtureRaw(JSON.stringify(value)); }
function savePlaces(rows: SavedPlace[]) { local.setItem(activeAccountLocalStorageKey('permamap_saved_places'), JSON.stringify(rows)); }
function confirm(code: string) {
  const context = createSiteCountryContext({ siteId, countryCode: code, confirmed: true })!;
  assert.equal(updateSiteCountryContext(siteId, context).status, 'local-saved');
}
function text(node: ReactTestInstance | string): string { return typeof node === 'string' ? node : node.children.map(child => text(child as ReactTestInstance | string)).join(''); }

test.beforeEach(async () => {
  releaseCropPlanFixture();
  probe.uid = 'finance-a'; bindMountedAccountLocalStorageUid(probe.uid);
  local.rows.clear(); session.rows.clear(); probe.canvases.clear(); probe.legacy = null;
  probe.forwardCalls = 0; probe.comparisonCalls = 0; probe.geometryReads = 0; probe.forbidden = false;
  savePlaces([place()]); probe.canvases.set(siteId, [bed]);
  // Import the existing account's legacy plan through the actual cutover/lease.
  // Later fixture edits target canonical evidence; writing v1 would instead
  // simulate an old app's divergent save and correctly withhold the forecast.
  local.setItem(activeAccountLocalStorageKey('imbewu_crop_plan_v1'), JSON.stringify(plan()));
  await initialiseCropPlanFixture();
});

test('finance withholds unknown and foreign forecasts while retaining raw measured allocations and unchanged actual books', () => {
  const original = structuredClone({ production, sales });
  for (const code of [undefined, 'KE', 'GB', 'US', 'BR']) {
    savePlaces([place()]); if (code) confirm(code);
    const source = loadFinancePlanSource();
    assert.equal(source.forecastAvailable, false, String(code));
    assert.deepEqual(source.forecastPlantings, []);
    assert.equal(source.withheldPlantingCount, 1);
    assert.deepEqual(source.plantings, plan().plantings, 'Measured crop-area allocations do not become a forecast');
    assert.equal(source.areaM2, 1);
    const measured = buildFarmMetrics(source.plantings, source.beds, production, sales, [], 'year', now);
    assert.equal(measured.crops.find(row => row.cropKey === crop.key)?.yieldKgPerM2, 5);
    const recorded = buildFinanceSeries(production, sales, [], [], now, 12);
    assert.equal(recorded.totalProducedKg, 5); assert.equal(recorded.totalSoldKg, 2); assert.equal(recorded.totalInZar, 10);
    assert.deepEqual({ production, sales }, original, 'Country selection cannot relabel or rewrite recorded money/quantities');
  }
});

test('only the selected supported source contributes forecast sowings, and colliding bed IDs are unavailable', () => {
  confirm('ZA');
  const other = place('other-place', 1, 1);
  savePlaces([...loadPlaces(), other]); probe.canvases.set(otherSite, [{ ...bed, id: 'other-bed' }]);
  savePlan({ ...plan(), plantings: [...plan().plantings, { ...plan().plantings[0], id: 'other-sowing', bedId: 'other-bed' }] });
  let source = loadFinancePlanSource();
  assert.equal(source.forecastAvailable, true);
  assert.equal(source.forecastPlantings?.length, 1);
  assert.equal(source.forecastPlantings?.[0].bedId, bed.id);
  probe.canvases.set(otherSite, [bed]);
  source = loadFinancePlanSource();
  assert.equal(source.forecastAvailable, false);
  assert.match(source.forecastReason!, /more than one design/);
  assert.deepEqual(source.forecastPlantings, []);
  assert.deepEqual(source.plantings, [], 'An ambiguous ID cannot supply a crop-area allocation either');
});

test('an explicit local-workspace reference enables its measured beds but cannot approve a mapped foreign source', () => {
  savePlaces([]); probe.canvases.clear();
  probe.legacy = { items: [{ id: bed.id, type: 'bed', wM: 1, hM: 1 }] };
  assert.equal(loadFinancePlanSource().forecastAvailable, false);
  savePlan({ ...plan(), workspaceReferences: [createWorkspacePlanningReference('design:local', true)!] });
  assert.equal(loadFinancePlanSource().forecastAvailable, true);
  savePlaces([place()]); probe.canvases.set(siteId, [bed]); confirm('KE');
  assert.equal(loadFinancePlanSource().forecastAvailable, false);
  savePlaces([]); probe.canvases.clear(); probe.legacy = null;
  savePlan({ ...plan(), workspaceReferences: [createWorkspacePlanningReference('virtual-bed', true)!] });
  const virtual = loadFinancePlanSource();
  assert.equal(virtual.origin, 'none'); assert.equal(virtual.areaM2, 0);
  assert.equal(virtual.forecastAvailable, false, 'An imaginary bed cannot supply financial area or yield');
  assert.match(virtual.forecastReason!, /virtual reference bed/);
});

test('conflicting country descriptions for aliases of one mapped site cannot be chosen by main-place order', () => {
  confirm('ZA');
  savePlaces([...loadPlaces(), place('unconfirmed-alias')]);
  const source = loadFinancePlanSource();
  assert.equal(source.forecastAvailable, false);
  assert.deepEqual(source.forecastPlantings, []);
  assert.equal(source.beds.length, 1, 'The physical canvas is still measured once');
  assert.deepEqual(source.plantings, plan().plantings, 'Its actual allocation is distinct from the unsupported forecast');
});

test('a persisted unmapped design uses its stable workspace ID and invalid IDs cannot borrow the local reference', () => {
  savePlaces([]); probe.canvases.clear();
  probe.legacy = { designId: 'stable-design', items: [{ id: bed.id, type: 'bed', wM: 1, hM: 1 }] };
  savePlan({ ...plan(), workspaceReferences: [createWorkspacePlanningReference('design:local', true)!] });
  assert.equal(loadFinancePlanSource().forecastAvailable, false);
  assert.equal(loadFinancePlanSource().workspaceId, 'design:stable-design');
  savePlan({ ...plan(), workspaceReferences: [createWorkspacePlanningReference('design:stable-design', true)!] });
  assert.equal(loadFinancePlanSource().forecastAvailable, true);
  probe.legacy = { designId: 'site:0.00000,0.00000', items: [{ id: bed.id, type: 'bed', wM: 1, hM: 1 }] };
  assert.equal(loadFinancePlanSource().workspaceId, null);
  assert.equal(loadFinancePlanSource().forecastAvailable, false);
});

function mountCards(source = loadFinancePlanSource()) {
  let renderer: ReactTestRenderer;
  const render = () => React.createElement(React.Fragment, null,
    React.createElement(ComingUpHarvests, { source, prices: {}, settings, horizonMonths: 12 }),
    React.createElement(FinanceGraphs, { source, production, sales, invoices: [], settings }),
    React.createElement(HarvestReconciliation, { plantings: source.plantings, beds: source.beds, planLoaded: source.loaded,
      forecastPlantings: source.forecastPlantings, forecastAvailable: source.forecastAvailable, forecastReason: source.forecastReason,
      production, sales, period: 'year', now, loading: false }),
  );
  act(() => { renderer = create(render()); });
  return {
    get renderer() { return renderer; }, text: () => text(renderer.root),
    planView() { const button = renderer.root.findAllByType('button').find(node => text(node).trim() === 'Plan vs actual'); assert.ok(button); act(() => button.props.onClick()); },
    update(next: typeof source) { source = next; act(() => renderer.update(render())); },
    dispose() { act(() => renderer.unmount()); },
  };
}

test('actual finance cards display unavailable forecasts rather than zero, while measured harvests and sales remain visible', () => {
  confirm('KE'); probe.forbidden = true;
  const cards = mountCards();
  try {
    assert.match(cards.text(), /Harvest forecast unavailable/);
    assert.match(cards.text(), /Crop-plan benchmark unavailable/);
    // Recorded quantities can legitimately be zero. The unavailable forecast
    // itself must not present a zero or claim that the saved plan is empty.
    assert.doesNotMatch(text(cards.renderer.root.findByType(ComingUpHarvests)), /Nothing due to be picked yet|Your crop plan is empty|\b0(?:\.0)?\s*kg/);
    cards.planView();
    assert.match(cards.text(), /Plan comparison unavailable/);
    assert.doesNotMatch(text(cards.renderer.root.findByType(FinanceGraphs)), /Nothing to compare yet|Your crop plan is empty|\b0(?:\.0)?\s*kg/);
    assert.equal(probe.forwardCalls, 0); assert.equal(probe.comparisonCalls, 0);
    assert.match(cards.text(), /Harvested 5/); assert.match(cards.text(), /Sold 2/);
  } finally { cards.dispose(); }
});

test('supported cards reach actual forecast producers and a later country change removes those forecasts', () => {
  confirm('ZA');
  const cards = mountCards();
  try {
    cards.planView();
    assert.ok(probe.forwardCalls > 0); assert.ok(probe.comparisonCalls > 0);
    confirm('US'); probe.forbidden = true;
    const forwardBefore = probe.forwardCalls, comparisonsBefore = probe.comparisonCalls;
    cards.update(loadFinancePlanSource());
    assert.match(cards.text(), /Harvest forecast unavailable/);
    assert.match(cards.text(), /Plan comparison unavailable/);
    assert.equal(probe.forwardCalls, forwardBefore); assert.equal(probe.comparisonCalls, comparisonsBefore);
    assert.match(cards.text(), /Harvested 5/); assert.match(cards.text(), /Sold 2/);
  } finally { cards.dispose(); }
});

test('finance source refreshes on saved-site and cross-tab events, then disposes its listeners', () => {
  confirm('ZA');
  let source: ReturnType<typeof useFinancePlanSource> | undefined;
  function Screen() { source = useFinancePlanSource(); return React.createElement('p', null, source.forecastAvailable ? 'Forecast supported' : 'Forecast unavailable'); }
  let renderer: ReactTestRenderer;
  act(() => { renderer = create(React.createElement(Screen)); });
  try {
    assert.equal(source?.forecastAvailable, true);
    act(() => { confirm('GB'); });
    assert.equal(source?.forecastAvailable, false);
    act(() => { confirm('ZA'); browser.dispatchEvent(new Event('storage')); });
    assert.equal(source?.forecastAvailable, true);
    act(() => { probe.uid = 'finance-b'; bindMountedAccountLocalStorageUid(probe.uid); browser.dispatchEvent(new Event('storage')); });
    assert.equal(source?.forecastAvailable, false);
    assert.deepEqual(source?.plantings, []);
  } finally { act(() => renderer.unmount()); }
  const readsAfterDisposal = probe.geometryReads;
  browser.dispatchEvent(new Event('permamap-places-changed'));
  browser.dispatchEvent(new Event('storage'));
  assert.equal(probe.geometryReads, readsAfterDisposal, 'Unmounted finance hooks must not retain storage/site listeners');
});
