import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { account, crop, samples, local, probe, events, reset, cleanup } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, readCanonicalCropPlanFixtureRaw, canonicalCropPlanFixtureKey } from './crop-plan-storage-fixture.ts';
import type { RecordedHarvestPreviewProps } from '../components/international/projects/RecordedHarvestPreview.tsx';
import { coordinateSiteIdForPlace } from '../lib/international/site-context.ts';

// The real controller, actor/sample proof, raw crop reader and source adapter
// execute. Only AuthProvider input, IO timing and the presentational boundary
// are controlled; these checks do not establish browser or cloud freshness.
const state = { owner: 'owner-a' as string | null, loading: false,
  props: null as RecordedHarvestPreviewProps | null, reads: 0, afterRead: null as (() => void) | null };
Object.assign(globalThis, { __projectHarvestControllerFixture: state });
const controllerUrl = new URL('../components/international/projects/RecordedHarvestPreviewController.tsx', import.meta.url).href;
const readViewUrl = new URL('../lib/crop-plan-read-view.ts', import.meta.url).href;
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === controllerUrl && specifier === '@/lib/auth') return data(`
    export const useAuth=()=>{const p=globalThis.__projectHarvestControllerFixture;
    return {user:p.owner?{uid:p.owner}:null,loading:p.loading};};`);
  if (context.parentURL === controllerUrl && specifier === './RecordedHarvestPreview') return data(`
    export default function Preview(props){globalThis.__projectHarvestControllerFixture.props=props;return null;}`);
  if (context.parentURL === controllerUrl && specifier === '@/lib/crop-plan-read-view') return data(`
    import * as actual from ${JSON.stringify(readViewUrl)};
    export const rawCropPlanReadViewIsCurrent=actual.rawCropPlanReadViewIsCurrent;
    export const releaseRawCropPlanReadView=actual.releaseRawCropPlanReadView;
    export function readRawCropPlanReadView(){const p=globalThis.__projectHarvestControllerFixture;p.reads++;
      const view=actual.readRawCropPlanReadView();p.afterRead?.();return view;}`);
  return next(specifier, context);
}, load(url, context, next) {
  if (url === controllerUrl) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText };
  return next(url, context);
} });
const { default: Controller } = await import('../components/international/projects/RecordedHarvestPreviewController.tsx');
const context = await import('../lib/length-unit-preference.ts');
const ownSite = 'site:0.00000,0.00000';
const place = { id: 'source-place', name: 'Saved engineering site', lat: 0, lon: 0,
  biome: 'Engineering fixture', rainfall: 0, elevation: 0, savedAt: '2026-01-01T00:00:00.000Z' };
const record = (quantity = 3) => ({ id: 'source-month', siteId: ownSite, sourceIconKey: 'crop:cabbage', label: 'Recorded fixture',
  date: { year: 2026, month: 1 }, quantity, unit: 'kg', status: 'actual', provenance: 'farm-record' });
const book = (records: unknown = [record()]) => ({ version: 1, updatedAt: 1, plantings: [], productionRecords: records });
let renderer: ReactTestRenderer | null = null;
function view() { assert.ok(state.props); return state.props; }
function mount() { act(() => { renderer = create(React.createElement(Controller)); }); }
function render() { act(() => renderer!.update(React.createElement(Controller))); }
function fill(siteId = ownSite) {
  act(() => view().onSiteChange(siteId));
  act(() => view().onPeriodStartChange('2026-01-01'));
  act(() => view().onPeriodEndChange('2026-01-31'));
}
function load() { act(() => view().onLoad()); }
function readySubtotal() {
  const review = view().review; assert.equal(review?.status, 'ready');
  assert.ok(review && review.status === 'ready'); return review.knownSubtotalKg;
}
function observedActor(uid: string | null) {
  probe.actor = uid;
  for (const notify of [...probe.auth]) notify(uid ? { uid } : null);
}
beforeEach(async () => {
  if (renderer) { act(() => renderer!.unmount()); renderer = null; }
  await reset(); state.owner = 'owner-a'; state.loading = false; state.props = null; state.reads = 0; state.afterRead = null;
  local.rows.set(account.activeAccountLocalStorageKey('permamap_saved_places'), JSON.stringify([place]));
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book()));
  crop.releaseAllDocumentCropPlanLeases();
});
after(() => {
  if (renderer) act(() => renderer!.unmount());
  hooks.deregister(); cleanup(); Reflect.deleteProperty(globalThis, '__projectHarvestControllerFixture');
});

test('source reading is explicit and reads canonical monthly data without a writer lease, storage writes or preference writes', () => {
  const bytes = new Map(local.rows), writes = local.writes;
  mount(); assert.equal(state.reads, 0); assert.equal(view().siteId, ''); assert.equal(view().periodStart, '');
  assert.equal(view().periodEnd, ''); assert.equal(view().review, null); assert.equal(view().canLoad, false);
  assert.deepEqual(view().sites, [{ id: ownSite, label: place.name }]);
  act(() => view().onLoad()); assert.equal(state.reads, 0);
  fill(); assert.equal(view().canLoad, true); assert.equal(state.reads, 0);
  load(); assert.equal(state.reads, 1); assert.equal(readySubtotal(), 3);
  assert.match(view().sourceNotice, /Cloud freshness has not been verified/);
  assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
  assert.equal([...local.rows.keys()].some(key => key.includes('project_harvest_read_context')), false);
});

test('missing and held source cannot become an empty harvest or recorded zero', () => {
  mount(); fill();
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], updatedAt: 1 }));
  load(); assert.equal(view().review?.status, 'held'); assert.equal(view().review?.knownSubtotalKg, null);
  local.rows.set(canonicalCropPlanFixtureKey(), '{unreadable');
  load(); assert.equal(view().review?.status, 'held'); assert.equal(view().review?.knownSubtotalKg, null);
});

test('a genuinely empty record array and a recorded zero retain different read results', () => {
  mount(); fill(); replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([]))); load();
  assert.equal(readySubtotal(), null); assert.equal(view().review?.rows.length, 0);
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([record(0)]))); load();
  assert.equal(readySubtotal(), 0); assert.equal(view().review?.rows.length, 1);
});

test('an actor changed before an old callback cannot read the other account namespace', () => {
  mount(); fill(); const oldLoad = view().onLoad, before = state.reads;
  const bytes = new Map(local.rows);
  probe.actor = 'owner-b';
  act(() => oldLoad()); assert.equal(state.reads, before);
  render(); assert.equal(view().review, null); assert.equal(view().canLoad, false); assert.deepEqual(view().sites, []);
  assert.deepEqual(local.rows, bytes);
});

test('an actor transition after the actual raw reader cannot publish the earlier account result', () => {
  mount(); fill(); state.afterRead = () => { state.afterRead = null; probe.actor = 'owner-b'; };
  load(); assert.equal(state.reads, 1); assert.equal(view().review, null);
  render(); assert.equal(view().canLoad, false); assert.deepEqual(view().sites, []);
});

test('the shared A to B to A epoch revokes a retained load even when the final UID matches again', () => {
  mount(); fill(); load(); const oldLoad = view().onLoad, before = state.reads;
  act(() => { observedActor('owner-b'); observedActor('owner-a'); oldLoad(); });
  assert.equal(state.reads, before); assert.equal(view().review, null); assert.equal(view().siteId, '');
  act(() => oldLoad()); assert.equal(state.reads, before);
  fill(); load(); assert.equal(readySubtotal(), 3);
});

test('sample transition during a personal read withdraws it, and DEMO reads stay in the actual sample book', () => {
  mount(); fill(); const oldLoad = view().onLoad;
  state.afterRead = () => { state.afterRead = null; samples.enterSampleMode(); };
  load(); assert.equal(view().review, null); assert.match(view().sourceNotice, /DEMO/);
  const before = state.reads; act(() => oldLoad()); assert.equal(state.reads, before);
  const samplePlace = samples.getSandboxPlaces()[0]; assert.ok(samplePlace);
  const siteId = coordinateSiteIdForPlace(samplePlace); assert.ok(siteId);
  samples.setSandboxCropPlan(book([{ ...record(0), siteId, provenance: 'fictional-example' }]) as never);
  fill(siteId); load(); assert.equal(readySubtotal(), null);
  assert.equal(view().review?.rows.length, 0); assert.equal(view().review?.excluded.length, 1);
  assert.match(view().sourceNotice, /DEMO/);
});

test('a raw revision changed during reading is held until a separate explicit review', () => {
  mount(); fill(); state.afterRead = () => { state.afterRead = null; replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([record(9)]))); };
  load(); assert.equal(view().review?.status, 'held'); assert.equal(view().review?.knownSubtotalKg, null); assert.equal(state.reads, 1);
  load(); assert.equal(state.reads, 2); assert.equal(readySubtotal(), 9);
});

test('source events and form edits revoke old callbacks before React publishes the new screen', () => {
  mount(); fill(); load(); const oldLoad = view().onLoad, oldChange = view().onPeriodStartChange;
  const before = state.reads;
  act(() => { events.dispatchEvent(new Event(crop.CROP_PLAN_CHANGED_EVENT)); oldLoad(); oldChange('2026-02-01'); });
  assert.equal(state.reads, before); assert.equal(view().review, null); assert.equal(view().periodStart, '2026-01-01');
  load(); assert.equal(readySubtotal(), 3);
  const beforeEdit = view().onLoad;
  act(() => { view().onPeriodEndChange('2026-02-28'); beforeEdit(); });
  assert.equal(view().review, null); assert.equal(state.reads, before + 1);
});

test('a silent raw change cannot keep an earlier subtotal visible on a later render', () => {
  mount(); fill(); load(); const oldLoad = view().onLoad;
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(book([record(9)]))); render();
  assert.equal(view().review?.status, 'held'); assert.equal(view().review?.knownSubtotalKg, null);
  const before = state.reads; act(() => oldLoad()); assert.equal(state.reads, before);
  assert.match(view().sourceNotice, /changed or became unavailable/);
});

test('saved-site withdrawal and page lifecycle revoke old choices without reading records again', () => {
  mount(); fill(); load(); const oldLoad = view().onLoad, before = state.reads;
  local.rows.set(account.activeAccountLocalStorageKey('permamap_saved_places'), '[]');
  act(() => { events.dispatchEvent(new Event('permamap-places-changed')); oldLoad(); });
  assert.deepEqual(view().sites, []); assert.equal(view().review, null); assert.equal(state.reads, before);
  act(() => { events.dispatchEvent(new Event('pagehide')); }); assert.equal(view().canLoad, false);
  act(() => oldLoad()); assert.equal(state.reads, before);
});

test('dedicated read-context capture observes epochs and releases observers without touching namespace rows', () => {
  const bytes = new Map(local.rows), writes = local.writes, authBefore = probe.auth.size;
  const proof = context.captureProjectHarvestReadContext(); assert.ok(proof);
  let withdrawn = 0; const stop = context.subscribeProjectHarvestReadContext(proof, () => withdrawn++);
  assert.equal(context.projectHarvestReadContextIsCurrent(proof), true);
  observedActor('owner-b'); observedActor('owner-a');
  assert.equal(context.projectHarvestReadContextIsCurrent(proof), false); assert.ok(withdrawn > 0);
  stop(); context.revokeProjectHarvestReadContext(proof);
  assert.equal(probe.auth.size, authBefore); assert.deepEqual(local.rows, bytes); assert.equal(local.writes, writes);
  assert.equal(readCanonicalCropPlanFixtureRaw(), JSON.stringify(book()));
});
