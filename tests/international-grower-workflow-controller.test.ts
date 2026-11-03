import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import type { CropPlanState, HarvestTarget } from '../lib/crop-plan.ts';
import type { GrowerPlanningProfile } from '../lib/international/grower-planning.ts';
import type { GrowerWorkflowDraft, GrowerWorkflowReview } from '../lib/international/grower-workflow.ts';

class MemoryStorage {
  rows = new Map<string, string>(); failWrites = false; writes = 0;
  get length() { return this.rows.size; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrites) throw Error('synthetic quota'); this.writes++; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.failWrites = false; this.writes = 0; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
}
interface Boundary {
  raw: unknown;
  actorUid: string | null;
  cloud: () => Promise<unknown[]>;
  sourceReads: number;
  cloudReads: number;
}
const boundary: Boundary = { raw: null, actorUid: 'owner-a', cloud: async () => [], sourceReads: 0, cloudReads: 0 };
const local = new MemoryStorage(), session = new MemoryStorage();
const originals = new Map(['window', 'localStorage', 'sessionStorage', 'Storage', '__growerControllerBoundary']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
Object.assign(globalThis, { window: events, localStorage: local, sessionStorage: session, Storage: MemoryStorage,
  __growerControllerBoundary: boundary });
const dataModule = (source: string) => ({ url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true });
const rawModule = `const b=()=>globalThis.__growerControllerBoundary;
  const read=()=>{b().sourceReads++;return {status:'ready',raw:structuredClone(b().raw),revision:JSON.stringify(b().raw),ownerUid:'owner-a',sample:false}};
  export const readCanvasSourceReceipt=read;export const readFacilitatorSourceReceipt=read;
  export const DESIGN_CANVAS_CHANGED_EVENT='imbewu-design-canvas-changed';`;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/components/crops/useGrowerWorkflow.ts')) {
      if (specifier === '@/lib/design-canvas' || specifier === '@/lib/facilitator-design') return dataModule(rawModule);
      if (specifier === '@/lib/db/queries') return dataModule(`export const myDesigns=()=>{const b=globalThis.__growerControllerBoundary;b.cloudReads++;return b.cloud()}`);
    }
    if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return dataModule(
      `export const isBackendConfigured=()=>true;export const getFirebase=()=>({auth:{currentUser:globalThis.__growerControllerBoundary.actorUid?{uid:globalThis.__growerControllerBoundary.actorUid}:null}});`);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('/components/crops/useGrowerWorkflow.ts')) return { shortCircuit: true, format: 'module',
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      } }).outputText };
    return next(url, context);
  },
});
const cropBook = await import('../lib/crop-plan.ts');
const { sanitiseNurserySettings } = await import('../lib/nursery-settings.ts');
const { activeAccountUid, activeAccountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { isSampleMode } = await import('../lib/sample-mode.ts');
const { CROPS } = await import('../lib/crop-catalog.ts');
const { growerPlanningScopeKey, normaliseGrowerPlanningProfiles } = await import('../lib/international/grower-planning.ts');
const { createWorkspacePlanningReference, replaceWorkspacePlanningReference, sanitiseWorkspacePlanningReferences } = await import('../lib/international/workspace-context.ts');
const { useGrowerWorkflow } = await import('../components/crops/useGrowerWorkflow.ts');

after(() => {
  hooks.deregister(); bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});
test.beforeEach(() => {
  local.clear(); session.clear(); bindMountedAccountLocalStorageUid('owner-a');
  boundary.actorUid = 'owner-a'; boundary.sourceReads = 0; boundary.cloudReads = 0; boundary.cloud = async () => [];
});

// Dates, geometry and quantities are engineering fixtures, not farming advice.
const siteId = 'site:0.00000,0.00000';
const otherSite = 'site:1.00000,1.00000';
const scope = { kind: 'mapped-site' as const, siteId };
const recordedAt = '2026-11-04T12:00:00.000Z';
function canvas() {
  return { siteId, frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
    items: [{ id: 'bed-a', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4, rot: 0 }],
    zones: [], lines: [], step: 'planting', updatedAt: recordedAt, rev: 1 };
}
const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit,
  provenance: { kind: 'grower-estimate' as const, recordedAt } });
function profile(): GrowerPlanningProfile {
  return { version: 1, profileId: 'own-profile', cropKey: CROPS[0].key, scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct', 'method'),
    nurseryDays: { state: 'missing', reason: 'not-applicable' }, fieldEntryToFirstHarvestDays: own(2, 'days'),
    pickingDays: own(2, 'days'), fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'),
    allowedEntryMonths: own([12], 'utc-months') } };
}
function target(id = 'own-target', site = siteId): HarvestTarget {
  return { id, siteId: site, cropKey: CROPS[0].key, startMonth: '2028-12', endMonth: '2028-12', weeklyKg: 7, marketablePercent: 100 };
}
function withWeeklyKg(row: HarvestTarget, weeklyKg: number): HarvestTarget {
  if (row.weeklyKg === undefined) throw Error('This engineering fixture expects a kilogram target');
  return { ...row, weeklyKg };
}
function book(): CropPlanState {
  return { version: 1, plantings: [], harvestTargets: [target(), target('other-target', otherSite)],
    growerPlanningProfiles: [profile()], nursery: { version: 1, profiles: [], containers: [], spaces: [
      { id: 'own-space', siteId, name: 'Own fixture space', usableM2: 2 },
      { id: 'other-space', siteId: otherSite, name: 'Other fixture space', usableM2: 3 }] }, updatedAt: Date.now() - 1000 };
}
function draft(): GrowerWorkflowDraft {
  return { planningStart: '2028-12-01', planningEndExclusive: '2029-01-01', maxAssessments: '1000',
    targetProfiles: [{ targetId: 'own-target', profileId: 'own-profile' }],
    available: [{ bedId: 'bed-a', start: '2028-12-01', endExclusive: '2029-01-01', confirmed: true }], assumptionsConfirmed: true };
}

/** Execute the actual page functions with real book storage helpers. Source
 * syntax may change; the test depends on their user-visible runtime behavior. */
function parent() {
  const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'readCurrentGrowerBook', 'saveScopedGrowerInputs',
    'saveGrowerProfiles', 'saveWorkspaceReference', 'rememberStoredPlan'];
  const functions = new Map<string, string>();
  let autosave: string | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) functions.set(node.name.text, node.getText(page));
    if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect'
      && node.arguments[1]?.getText(page) === '[plan, planSaveConflict]') autosave = node.arguments[0].getText(page);
    ts.forEachChild(node, visit);
  };
  visit(page); assert.equal(functions.size, names.length, 'the current page integration must expose its guarded callbacks');
  assert.ok(autosave, 'exercise the actual queued page writer, not a second implementation of its guard');
  const source = ts.transpileModule([...functions.values(), `const runAutosaveEffect = ${autosave};`].join('\n'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const initial = book(); assert.equal(cropBook.saveCropPlan(initial), true);
  const initialAdmission = cropBook.loadCropPlanWithWriteAdmission();
  const current = initialAdmission.book;
  const queued: Array<() => void> = [];
  const state = {
    plan: current, productionSiteId: siteId, growerOwner: 'owner-a' as string | null, growerSample: false,
    surveySiteId: null as string | null, planningWorkspaceId: 'virtual-bed',
    growerScopeKey: growerPlanningScopeKey(scope),
    growerWriteScope: { current: { key: growerPlanningScopeKey(scope), owner: 'owner-a' as string | null, sample: false } },
    growerBookContext: { current: { siteId, owner: 'owner-a' as string | null, sample: false, scopeKey: growerPlanningScopeKey(scope) } },
    planWriteBase: { current: { owner: 'owner-a' as string | null, sample: false, token: initialAdmission.token, planKey: JSON.stringify(current), admission: initialAdmission.admission } },
    planSaveConflict: false, planSaveFailed: false, saveTimer: { current: null as ReturnType<typeof setTimeout> | null },
    setTimeout(callback: () => void) { queued.push(callback); return 1; },
    clearTimeout() {},
    activeAccountUid, isSampleMode, isBackendConfigured: () => true,
    getFirebase: () => ({ auth: { currentUser: boundary.actorUid ? { uid: boundary.actorUid } : null } }),
    cropPlanWriteToken: cropBook.cropPlanWriteToken, loadCropPlan: cropBook.loadCropPlan,
    // The actual parent now admits authored rows through the raw receipt authority.
    readRawCropPlanReceipt: cropBook.readRawCropPlanReceipt,
    loadCropPlanWithWriteAdmission: cropBook.loadCropPlanWithWriteAdmission,
    cropPlanWriteAdmissionMatches: cropBook.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless: cropBook.cropPlanWriteCandidateIsLossless,
    sanitiseHarvestTargets: cropBook.sanitiseHarvestTargets, sanitiseNurserySettings,
    normaliseGrowerPlanningProfiles, growerPlanningScopeKey, replaceWorkspacePlanningReference, sanitiseWorkspacePlanningReferences,
    saveCropPlanWithReceipt: cropBook.saveCropPlanWithReceipt,
    setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; },
    setPlanSaveFailed(value: boolean) { state.planSaveFailed = value; },
    setPlan(value: CropPlanState) { state.plan = value; },
  };
  const callbacks = new Function('context', `with(context){${source};return {${names.join(',')},runAutosaveEffect}}`)(state) as {
    growerActorIsCurrent: () => boolean;
    readCurrentGrowerBook: () => import('../components/crops/useGrowerWorkflow.ts').GrowerWorkflowBookReceipt;
    saveScopedGrowerInputs: (field: 'nursery' | 'harvestTargets', value: unknown) => boolean;
    saveGrowerProfiles: (value: GrowerPlanningProfile[]) => boolean;
    saveWorkspaceReference: (value: ReturnType<typeof createWorkspacePlanningReference>) => boolean;
    runAutosaveEffect: () => (() => void) | undefined;
  };
  return { state, ...callbacks, flushAutosave() { assert.ok(queued.length, 'the actual page must have queued its save'); queued.shift()!(); } };
}
function cloudRow() {
  return { id: 'cloud-fixture', owner_id: 'owner-a', data: { version: 1, geomVersion: 2,
    designId: 'cloud-fixture', pxPerM: 10, savedAt: 1, activeLayer: 'planting', hiddenLayers: [],
    items: [{ id: 'bed-a', type: 'bed', x: 10, y: 10, xM: 1, yM: 1, wM: 2, hM: 4, rotation: 0 }],
    lines: [], sectors: [], bgSite: { lat: 0, lon: 0, name: 'Synthetic cloud fixture' } } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function mount(controller = parent()) {
  boundary.raw = canvas();
  let renderer!: ReactTestRenderer, latest!: ReturnType<typeof useGrowerWorkflow>;
  const input: Parameters<typeof useGrowerWorkflow>[0] = { selection: { kind: 'studio-canvas', sourceId: siteId }, scope,
    resourceSiteId: siteId, book: controller.state.plan, actorIsCurrent: controller.growerActorIsCurrent, readCurrentBook: controller.readCurrentGrowerBook };
  function Harness() { latest = useGrowerWorkflow(input); return null; }
  act(() => { renderer = create(React.createElement(Harness)); });
  return { controller, input, get latest() { return latest; },
    sourceNow: () => latest.source,
    update(changes: Partial<typeof input> = {}) { Object.assign(input, changes); act(() => renderer.update(React.createElement(Harness))); },
    async refresh() { await act(async () => { await latest.onRefresh(); }); },
    async review() { let result!: GrowerWorkflowReview; await act(async () => { result = await latest.onReview(draft()); }); return result; },
    async current(review: Extract<GrowerWorkflowReview, { status: 'review' }>) { let result = false; await act(async () => { result = await latest.onCheckCurrent(review); }); return result; },
    dispose() { act(() => renderer.unmount()); },
  };
}
async function readyReview(ui: ReturnType<typeof mount>) {
  await ui.refresh(); assert.equal(ui.latest.source?.status, 'ready');
  const result = await ui.review(); assert.equal(result.status, 'review', result.issues.join(','));
  if (result.status !== 'review') throw Error('Ready engineering fixture held');
  assert.equal(result.proposal.status, 'ready'); assert.ok(result.proposal.cycles.length > 0); return result;
}

test('real hook reads current saved geometry and book, reviews actual engine output and rechecks the same snapshot without writing', async () => {
  const ui = mount(); try {
    const bytes = JSON.stringify([...local.rows]), writes = local.writes;
    const review = await readyReview(ui); assert.equal(await ui.current(review), true);
    assert.equal(JSON.stringify([...local.rows]), bytes); assert.equal(local.writes, writes);
    assert.ok(boundary.sourceReads >= 6, 'each delivery re-reads the source around actual hashing');
    assert.equal(await ui.current({ ...review }), false, 'a copied result has no controller review binding');
  } finally { ui.dispose(); }
});

test('an equal-area source move invalidates a checked proposal rather than trusting unchanged bed metrics', async () => {
  const ui = mount(); try {
    const review = await readyReview(ui), area = review.request.beds[0].bed.areaM2;
    (boundary.raw as ReturnType<typeof canvas>).items[0].x += 0.1;
    assert.equal(await ui.current(review), false);
    const held = await ui.review(); assert.equal(held.status, 'held'); assert.ok(held.issues.includes('source-changed'));
    assert.equal(ui.latest.source, null); await ui.refresh();
    assert.equal(ui.sourceNow()?.beds[0].areaM2, area);
  } finally { ui.dispose(); }
});

test('pending page edits and externally changed stored targets block review and scoped writes without dropping either book', async () => {
  const ui = mount(); try {
    await ui.refresh(); const old = ui.controller.state.plan;
    ui.controller.state.plan = { ...old, plantings: [{ id: 'unsaved', bedId: 'elsewhere', cropKey: CROPS[0].key, sowMonth: 12 }] };
    ui.update({ book: ui.controller.state.plan });
    const bytes = JSON.stringify([...local.rows]);
    let held = await ui.review(); assert.ok(held.issues.includes('pending-plan-edits'));
    assert.equal(ui.controller.saveScopedGrowerInputs('harvestTargets', old.harvestTargets), false);
    assert.equal(JSON.stringify([...local.rows]), bytes);
    ui.controller.state.plan = old; ui.update({ book: old });
    const external = { ...old, harvestTargets: old.harvestTargets!.map(row => row.siteId === siteId ? withWeeklyKg(row, 14) : row), updatedAt: Date.now() };
    assert.equal(cropBook.saveCropPlan(external), true);
    held = await ui.review(); assert.ok(held.issues.includes('saved-plan-changed'));
    assert.equal(ui.controller.saveScopedGrowerInputs('harvestTargets', old.harvestTargets), false);
    assert.deepEqual(cropBook.loadCropPlan().harvestTargets, external.harvestTargets);
  } finally { ui.dispose(); }
});

test('a raw authentication transition blocks cloud fetches and writers even while the mounted account still says A', async () => {
  const ui = mount(); try {
    ui.update({ selection: { kind: 'facilitator-cloud', sourceId: 'cloud-fixture' }, resourceSiteId: 'design:cloud-fixture' });
    boundary.actorUid = 'owner-b'; assert.equal(activeAccountUid(), 'owner-a');
    const before = JSON.stringify([...local.rows]); await ui.refresh();
    assert.equal(boundary.cloudReads, 0); assert.equal(ui.latest.source, null);
    assert.equal(ui.controller.readCurrentGrowerBook().status, 'held');
    assert.equal(ui.controller.saveScopedGrowerInputs('harvestTargets', ui.controller.state.plan.harvestTargets), false);
    assert.equal(JSON.stringify([...local.rows]), before);
  } finally { ui.dispose(); }
});

test('growing estimates and workspace choices reject a changed raw account before reading or writing the mounted owner’s book', () => {
  for (const writer of ['profiles', 'workspace'] as const) {
    boundary.actorUid = 'owner-a';
    const c = parent(), before = JSON.stringify([...local.rows]), writes = local.writes;
    let reads = 0;
    c.state.loadCropPlanWithWriteAdmission = () => { reads++; throw Error('a changed actor must be rejected before reading the old book'); };
    c.state.cropPlanWriteToken = () => { reads++; throw Error('a changed actor must be rejected before reading the old revision'); };
    boundary.actorUid = 'owner-b';
    assert.equal(activeAccountUid(), 'owner-a', 'reproduce the observer gap, not a completed remount');
    const saved = writer === 'profiles' ? c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles!)
      : c.saveWorkspaceReference(createWorkspacePlanningReference('virtual-bed', true, recordedAt));
    assert.equal(saved, false, writer); assert.equal(reads, 0, writer);
    assert.equal(local.writes, writes, writer); assert.equal(JSON.stringify([...local.rows]), before, writer);
  }
});

test('an actor transition or replaced loaded base during a fresh read cannot authorize an old profile or workspace write', () => {
  for (const writer of ['profiles', 'workspace'] as const) for (const change of ['actor', 'base'] as const) {
    boundary.actorUid = 'owner-a';
    const c = parent(), before = JSON.stringify([...local.rows]), writes = local.writes;
    // The fresh read now includes actual raw/display admission, not display-only load.
    c.state.loadCropPlanWithWriteAdmission = () => {
      const book = cropBook.loadCropPlanWithWriteAdmission();
      if (change === 'actor') boundary.actorUid = 'owner-b';
      else c.state.planWriteBase.current = { ...c.state.planWriteBase.current };
      return book;
    };
    const saved = writer === 'profiles' ? c.saveGrowerProfiles(c.state.plan.growerPlanningProfiles!)
      : c.saveWorkspaceReference(createWorkspacePlanningReference('virtual-bed', true, recordedAt));
    assert.equal(saved, false, `${writer}/${change}`); assert.equal(local.writes, writes, `${writer}/${change}`);
    assert.equal(JSON.stringify([...local.rows]), before, `${writer}/${change}`);
  }
});

test('a queued autosave rejects account changes before the timer and during its revision check, and rejects replaced bases or external overwrites', () => {
  for (const change of ['actor-before-timer', 'actor-during-token', 'base-before-timer', 'base-during-token', 'external-book'] as const) {
    boundary.actorUid = 'owner-a';
    const c = parent(); c.runAutosaveEffect();
    if (change === 'actor-before-timer') boundary.actorUid = 'owner-b';
    if (change === 'base-before-timer') c.state.planWriteBase.current = { ...c.state.planWriteBase.current };
    if (change === 'actor-during-token' || change === 'base-during-token') c.state.cropPlanWriteToken = () => {
      const token = cropBook.cropPlanWriteToken();
      if (change === 'actor-during-token') boundary.actorUid = 'owner-b';
      else c.state.planWriteBase.current = { ...c.state.planWriteBase.current };
      return token;
    };
    if (change === 'external-book') assert.equal(cropBook.saveCropPlan({ ...c.state.plan,
      harvestTargets: c.state.plan.harvestTargets!.map(row => withWeeklyKg(row, 19)), updatedAt: Date.now() }), true);
    const before = JSON.stringify([...local.rows]), writes = local.writes;
    c.flushAutosave();
    assert.equal(local.writes, writes, change); assert.equal(JSON.stringify([...local.rows]), before, change);
    if (change === 'external-book') assert.equal(c.state.planSaveConflict, true);
  }
});

test('the unchanged account can save profiles, workspace choices and queued ordinary edits while held nursery inputs survive', () => {
  const c = parent();
  const nursery = sanitiseNurserySettings({ ...c.state.plan.nursery, containers: [
    { id: 'held-tray', siteId, name: 'First saved claim', cells: 12 },
    { id: 'held-tray', siteId, name: 'Conflicting saved claim', cells: 24 },
  ] });
  assert.ok(nursery.heldInputs?.length);
  assert.equal(cropBook.saveCropPlan({ ...c.state.plan, nursery }), true);
  const reloadedAdmission = cropBook.loadCropPlanWithWriteAdmission();
  c.state.plan = reloadedAdmission.book;
  c.state.planWriteBase.current = { ...c.state.planWriteBase.current,
    token: reloadedAdmission.token, planKey: JSON.stringify(c.state.plan), admission: reloadedAdmission.admission };
  const held = structuredClone(c.state.plan.nursery!.heldInputs);
  const updatedProfiles = c.state.plan.growerPlanningProfiles!.map(row => ({ ...row,
    inputs: { ...row.inputs, yieldKgPerM2: own(3, 'kg/m2/cycle') } }));
  assert.equal(c.saveGrowerProfiles(updatedProfiles), true);
  assert.deepEqual(cropBook.loadCropPlan().growerPlanningProfiles, normaliseGrowerPlanningProfiles(updatedProfiles));
  assert.deepEqual(cropBook.loadCropPlan().nursery!.heldInputs, held);
  const reference = createWorkspacePlanningReference('virtual-bed', true, recordedAt)!;
  assert.equal(c.saveWorkspaceReference(reference), true);
  assert.deepEqual(cropBook.loadCropPlan().workspaceReferences, [reference]);
  assert.deepEqual(cropBook.loadCropPlan().nursery!.heldInputs, held);
  c.state.plan = { ...c.state.plan, plantings: [{ id: 'ordinary-edit', bedId: 'other-bed', cropKey: CROPS[0].key, sowMonth: 12 }], updatedAt: Date.now() };
  c.runAutosaveEffect(); c.flushAutosave();
  assert.deepEqual(cropBook.loadCropPlan().plantings, c.state.plan.plantings);
  assert.deepEqual(cropBook.loadCropPlan().nursery!.heldInputs, held);
  assert.equal(c.state.planWriteBase.current.token, cropBook.cropPlanWriteToken());
});

test('late cloud source replies cannot cross an account, sample or selection transition', async () => {
  for (const transition of ['account', 'sample', 'selection'] as const) {
    local.clear(); session.clear(); bindMountedAccountLocalStorageUid('owner-a'); boundary.actorUid = 'owner-a';
    const ui = mount(); const pending = deferred<unknown[]>(); boundary.cloud = () => pending.promise;
    try {
      ui.update({ selection: { kind: 'facilitator-cloud', sourceId: 'cloud-fixture' }, resourceSiteId: 'design:cloud-fixture' });
      let work!: Promise<void>; await act(async () => { work = ui.latest.onRefresh(); });
      assert.equal(ui.latest.checking, true);
      if (transition === 'account') boundary.actorUid = 'owner-b';
      if (transition === 'sample') session.setItem('imbewu_sample_mode', '1');
      if (transition === 'selection') ui.update({ selection: { kind: 'studio-canvas', sourceId: otherSite }, scope: { kind: 'mapped-site', siteId: otherSite }, resourceSiteId: otherSite });
      await act(async () => { pending.resolve([cloudRow()]); await work; });
      assert.equal(ui.latest.source, null, transition); assert.equal(ui.latest.checking, false, transition);
    } finally { ui.dispose(); session.clear(); }
  }
});

test('a synchronous book event cancels source checking without leaving a permanent busy indicator', async () => {
  const ui = mount(); const pending = deferred<unknown[]>(); boundary.cloud = () => pending.promise;
  try {
    ui.update({ selection: { kind: 'facilitator-cloud', sourceId: 'cloud-fixture' }, resourceSiteId: 'design:cloud-fixture' });
    let work!: Promise<void>; await act(async () => { work = ui.latest.onRefresh(); });
    assert.equal(ui.latest.checking, true);
    act(() => { events.dispatchEvent(new Event(cropBook.CROP_PLAN_CHANGED_EVENT)); });
    assert.equal(ui.latest.checking, false);
    await act(async () => { pending.resolve([cloudRow()]); await work; });
    assert.equal(ui.latest.source, null); assert.equal(ui.latest.checking, false);
  } finally { ui.dispose(); }
});

test('a changed planning book prop also cancels an in-flight source check without a storage event', async () => {
  const ui = mount(); const pending = deferred<unknown[]>(); boundary.cloud = () => pending.promise;
  try {
    ui.update({ selection: { kind: 'facilitator-cloud', sourceId: 'cloud-fixture' }, resourceSiteId: 'design:cloud-fixture' });
    let work!: Promise<void>; await act(async () => { work = ui.latest.onRefresh(); });
    const changed = { ...ui.controller.state.plan, harvestTargets: [target('changed-target')] };
    ui.update({ book: changed });
    await act(async () => { pending.resolve([cloudRow()]); await work; });
    assert.equal(ui.latest.source, null); assert.equal(ui.latest.checking, false);
  } finally { ui.dispose(); }
});

test('scoped target and nursery saves rebase only their own namespace while preserving fresh unrelated book data', () => {
  const c = parent(), original = c.state.plan;
  const external = { ...original, plantings: [{ id: 'fresh-other-sowing', bedId: 'other-bed', cropKey: CROPS[0].key, sowMonth: 12 }],
    harvestTargets: original.harvestTargets!.map(row => row.siteId === otherSite ? withWeeklyKg(row, 21) : row), updatedAt: Date.now() };
  assert.equal(cropBook.saveCropPlan(external), true);
  const changed = original.harvestTargets!.map(row => row.siteId === siteId ? withWeeklyKg(row, 14) : row);
  assert.equal(c.saveScopedGrowerInputs('harvestTargets', changed), true);
  assert.deepEqual(cropBook.loadCropPlan().plantings, external.plantings);
  assert.equal(cropBook.loadCropPlan().harvestTargets!.find(row => row.siteId === otherSite)!.weeklyKg, 21);
  const beforeNursery = c.state.plan, updated = structuredClone(beforeNursery.nursery!);
  updated.spaces.find(row => row.siteId === siteId)!.usableM2 = 5;
  const freshNursery = structuredClone(beforeNursery.nursery!); freshNursery.spaces.find(row => row.siteId === otherSite)!.usableM2 = 7;
  assert.equal(cropBook.saveCropPlan({ ...beforeNursery, nursery: freshNursery, updatedAt: Date.now() }), true);
  assert.equal(c.saveScopedGrowerInputs('nursery', updated), true);
  assert.equal(cropBook.loadCropPlan().nursery!.spaces.find(row => row.siteId === siteId)!.usableM2, 5);
  assert.equal(cropBook.loadCropPlan().nursery!.spaces.find(row => row.siteId === otherSite)!.usableM2, 7);
  const foreignEdit = structuredClone(c.state.plan.nursery!); foreignEdit.spaces.find(row => row.siteId === otherSite)!.usableM2 = 99;
  const bytes = JSON.stringify([...local.rows]); assert.equal(c.saveScopedGrowerInputs('nursery', foreignEdit), false);
  assert.equal(JSON.stringify([...local.rows]), bytes);
});

test('a device-write failure retains old state and receipt authority instead of publishing the new inputs', () => {
  const c = parent(), old = c.state.plan, base = c.state.planWriteBase.current, bytes = JSON.stringify([...local.rows]);
  local.failWrites = true;
  assert.equal(c.saveScopedGrowerInputs('harvestTargets', old.harvestTargets!.map(row => row.siteId === siteId ? withWeeklyKg(row, 14) : row)), false);
  assert.equal(c.state.plan, old); assert.equal(c.state.planWriteBase.current, base);
  assert.equal(c.state.planSaveFailed, true); assert.equal(JSON.stringify([...local.rows]), bytes);
});

test('a write-event overwrite cannot become the successful writer receipt or authorize a stale next review', () => {
  const c = parent(), old = c.state.plan;
  const overwrite = () => {
    events.removeEventListener(cropBook.CROP_PLAN_CHANGED_EVENT, overwrite);
    const saved = cropBook.loadCropPlan();
    const replacement = { ...saved, harvestTargets: saved.harvestTargets!.map(row => row.siteId === siteId ? { ...row, weeklyKg: 28 } : row), updatedAt: Date.now() };
    local.setItem(activeAccountLocalStorageKey('imbewu_crop_plan_v1'), JSON.stringify(replacement));
  };
  events.addEventListener(cropBook.CROP_PLAN_CHANGED_EVENT, overwrite);
  try {
    const wanted = old.harvestTargets!.map(row => row.siteId === siteId ? { ...row, weeklyKg: 14 } : row);
    assert.equal(c.saveScopedGrowerInputs('harvestTargets', wanted), true);
    assert.notEqual(c.state.planWriteBase.current.token, cropBook.cropPlanWriteToken());
    assert.equal(c.readCurrentGrowerBook().status, 'held');
    const bytes = JSON.stringify([...local.rows]);
    assert.equal(c.saveScopedGrowerInputs('harvestTargets', wanted), false);
    assert.equal(JSON.stringify([...local.rows]), bytes);
  } finally { events.removeEventListener(cropBook.CROP_PLAN_CHANGED_EVENT, overwrite); }
});

test('equipment-only own saves retain a current crop proposal, while changed profiles and targets invalidate its request', async () => {
  const ui = mount(); try {
    const reviewed = await readyReview(ui), old = ui.controller.state.plan;
    const settings = structuredClone(old.nursery!); settings.spaces.find(row => row.siteId === siteId)!.usableM2 = 8;
    await act(async () => { assert.equal(ui.controller.saveScopedGrowerInputs('nursery', settings), true); });
    ui.update({ book: ui.controller.state.plan });
    assert.equal(await ui.current(reviewed), true);
    const updatedProfile = structuredClone(ui.controller.state.plan);
    updatedProfile.growerPlanningProfiles = updatedProfile.growerPlanningProfiles!.map(row => ({ ...row,
      inputs: { ...row.inputs, yieldKgPerM2: own(3, 'kg/m2/cycle') } }));
    updatedProfile.updatedAt = Date.now(); assert.equal(cropBook.saveCropPlan(updatedProfile), true);
    const reloadedAdmission = cropBook.loadCropPlanWithWriteAdmission();
    ui.controller.state.plan = reloadedAdmission.book;
    ui.controller.state.planWriteBase.current = { ...ui.controller.state.planWriteBase.current,
      token: reloadedAdmission.token, planKey: JSON.stringify(ui.controller.state.plan), admission: reloadedAdmission.admission };
    ui.update({ book: ui.controller.state.plan });
    assert.equal(await ui.current(reviewed), false);
    const next = await ui.review(); assert.equal(next.status, 'review');
    if (next.status !== 'review') return;
    const changedTargets = ui.controller.state.plan.harvestTargets!.map(row => row.siteId === siteId ? { ...row, weeklyKg: 14 } : row);
    await act(async () => { assert.equal(ui.controller.saveScopedGrowerInputs('harvestTargets', changedTargets), true); });
    ui.update({ book: ui.controller.state.plan }); assert.equal(await ui.current(next), false);
  } finally { ui.dispose(); }
});

test('a genuinely reloaded saved crop occupation invalidates the old automatic proposal and cannot be overridden as available', async () => {
  const ui = mount(); try {
    const reviewed = await readyReview(ui);
    const changed: CropPlanState = { ...ui.controller.state.plan,
      plantings: [{ id: 'newly-saved-occupation', bedId: 'bed-a', cropKey: CROPS[0].key, sowMonth: 12 }], updatedAt: Date.now() };
    await act(async () => { assert.equal(cropBook.saveCropPlan(changed), true); });
    const reloadedAdmission = cropBook.loadCropPlanWithWriteAdmission();
    ui.controller.state.plan = reloadedAdmission.book;
    ui.controller.state.planWriteBase.current = { ...ui.controller.state.planWriteBase.current,
      token: reloadedAdmission.token, planKey: JSON.stringify(ui.controller.state.plan), admission: reloadedAdmission.admission };
    ui.update({ book: ui.controller.state.plan });
    assert.equal(await ui.current(reviewed), false);
    const held = await ui.review(); assert.equal(held.status, 'held');
    assert.ok(held.issues.includes('availability-bed-blocked'));
    assert.equal(cropBook.loadCropPlan().plantings[0].id, 'newly-saved-occupation');
  } finally { ui.dispose(); }
});
