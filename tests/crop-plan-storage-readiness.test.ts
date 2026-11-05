import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import ts from 'typescript';
import { crop, account, samples, local, events, probe, reset, cleanup, useGrowerOperations, ownRow } from './international-grower-operations-fixture.ts';
import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixture,
  readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import * as storage from '../lib/crop-plan-storage.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import { hasGrowerCycleMarker, isProvenForeignGrowerCycle } from '../lib/international/grower-cycle.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';

beforeEach(async () => {
  await reset(); releaseCropPlanFixture(); await new Promise<void>(done => setImmediate(done)); local.clear();
});
after(cleanup);
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'rememberStoredPlan', 'refreshAdmittedStoredPlan', 'addPlanting', 'openAutoSuggest', 'runAutoSuggest', 'acceptAutoSuggest'];
const bodies = new Map<string, string>();
let mount = '', autosave = '', listeners = '', commit = '', addGuard = '';
function inspect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name && names.includes(node.name.text)) bodies.set(node.name.text, node.getText(page));
  if (ts.isVariableDeclaration(node) && node.name.getText(page) === 'legacyAddBlocked') addGuard = node.getText(page);
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect') {
    const body = node.arguments[0]?.getText(page) ?? '';
    if (body.includes('setPlan(storedPlan)') && body.includes('planWriteBase.current = base')) mount = body;
    if (node.arguments[1]?.getText(page) === '[plan, planSaveConflict]') autosave = body;
    if (body.includes('setPlanStorageRevision(value => value + 1)')) listeners = body;
    if (node.arguments[1]?.getText(page) === '[planStorageRevision, plan]') commit = body;
  }
  ts.forEachChild(node, inspect);
}
inspect(page);
assert.equal(bodies.size, names.length); assert.ok(mount && autosave && listeners && commit && addGuard);
const compiled = ts.transpileModule([...bodies.values(), `const ${addGuard}; const runMount=${mount}; const runAutosave=${autosave}; const installListeners=${listeners}; const commitRefresh=${commit};`].join('\n'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

/** Real planner mount/event/committed-effect/edit/autosave bodies run against
 * the actual raw reader, Web Lock initializer, admission and receipt writer.
 * Only unrelated screen startup and the React state/timer boundary are controlled. */
function planner() {
  const timers = new Map<number, () => void>(); let timerId = 0;
  const state: any = { plan: null, planWriteBase: { current: null }, planSaveConflict: false, planSaveFailed: false,
    planStorageRevision: 0, handledPlanStorageRevision: { current: 0 }, saveTimer: { current: null }, writes: 0, history: 0,
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode,
    isBackendConfigured: () => probe.configured, getFirebase: () => ({ auth: { currentUser: probe.actor ? { uid: probe.actor } : null } }),
    loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission, cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless, cropPlanWriteToken: crop.cropPlanWriteToken,
    saveCropPlanWithReceipt(value: CropPlanState) { ++state.writes; return crop.saveCropPlanWithReceipt(value); },
    setPlan(value: any) { state.plan = typeof value === 'function' ? value(state.plan) : value; },
    setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; }, setPlanSaveFailed(value: boolean) { state.planSaveFailed = value; },
    setPlanStorageRevision(value: any) { state.planStorageRevision = typeof value === 'function' ? value(state.planStorageRevision) : value; },
    setTimeout(action: () => void) { const id = ++timerId; timers.set(id, action); return id; }, clearTimeout(id: number) { timers.delete(id); },
    CROP_PLAN_CHANGED_EVENT: crop.CROP_PLAN_CHANGED_EVENT, CROP_PLAN_STORAGE_EVENT: storage.CROP_PLAN_STORAGE_EVENT,
    currentPlanningScopeAllowed: () => true, pushPlanHistory() { ++state.history; }, genId: () => `synthetic-row-${state.history}`,
    hasOwnRecords: false, beds: [{ id: 'fixture-bed', areaM2: 1 }], planningScopeKey: 'same-synthetic-scope', suggestionScopeRef: { current: null },
    autoPhase: 'idle', autoResult: null, idealMeta: null, autoGenerating: false, pickerBedId: null, pickerCrop: null, activePlanting: null,
    planHistory: [], planHistoryContext: { current: new WeakMap() }, suggestedPlanHistory: { current: new WeakMap() },
    setAutoPhase(value: string) { state.autoPhase = value; }, setAutoResult(value: unknown) { state.autoResult = value; },
    setIdealMeta(value: unknown) { state.idealMeta = value; }, setAutoGenerating(value: boolean) { state.autoGenerating = value; },
    setPickerBedId(value: unknown) { state.pickerBedId = value; }, setPickerCrop(value: unknown) { state.pickerCrop = value; }, setActivePlanting(value: unknown) { state.activePlanting = value; },
    setPlanHistory(value: unknown) { state.planHistory = value; },
    hasGrowerCycleMarker, isProvenForeignGrowerCycle, currentBedIds: new Set(['fixture-bed']), selectedGrowerSource: null, growerScope: null,
    setDesign() {}, loadFacilitatorState: () => null, setCurrentMonth() {}, setCurrentYear() {}, setFavouriteCropKeys() {}, loadFavouriteCropKeys: () => new Set(),
    setAllowBedSharing() {}, loadAllowBedSharing: () => false, setPriceOverrides() {}, loadCropPriceOverrides: () => ({}), setCashflowSettings() {}, loadCashflowSettings: () => ({}),
    setMounted() {}, myDesigns: () => Promise.resolve([]), setMyDesignsList() {}, setStudioChoices() {}, studioPlanChoices: () => [], loadPlaces: () => [], loadCanvasState: () => null };
  const actual = Function('state', `with(state){${compiled};return {${names.join(',')},runMount,runAutosave,installListeners,commitRefresh};}`)(state);
  const unsubscribe = actual.installListeners(); actual.runMount();
  return { state, ...actual, commit() { actual.commitRefresh(); },
    retainedCallbacks() { return Function('state', `with(state){${compiled};return {openAutoSuggest,runAutoSuggest,acceptAutoSuggest};}`)({ ...state }); },
    edit() { actual.addPlanting('fixture-bed', CROPS[0].key, 12, 1, false, ''); },
    flushAutosave() { actual.runAutosave(); while (timers.size) { const [id, action] = timers.entries().next().value!; timers.delete(id); action(); } },
    dispose() { unsubscribe(); }, timerCount: () => timers.size };
}
function legacy(book: CropPlanState = { version: 1, plantings: [], updatedAt: 1 }) {
  local.setItem(account.activeAccountLocalStorageKey(storage.CROP_PLAN_LEGACY_KEY), JSON.stringify(book));
}

test('a cold planner mounted before asynchronous storage setup obtains a fresh admitted base and actually saves a subsequent edit without reload', async () => {
  legacy(); const ui = planner();
  try {
    assert.equal(ui.state.planSaveConflict, true); assert.equal(ui.state.planWriteBase.current.token, null);
    await initialiseCropPlanFixture(); ui.commit();
    assert.equal(ui.state.planSaveConflict, false); assert.equal(ui.state.planWriteBase.current.admission.status, 'ready');
    assert.equal(ui.state.plan.updatedAt, 1); assert.equal(ui.state.writes, 0, 'refreshing a clean display never saves records');
    ui.edit(); ui.flushAutosave(); ui.commit();
    assert.equal(ui.state.writes, 1); assert.equal(readCanonicalCropPlanFixture<CropPlanState>().plantings.length, 1);
    assert.equal(ui.state.planSaveConflict, false, 'its own synchronous save event cannot be mistaken for a dirty external overwrite');
    ui.commit(); assert.equal(ui.state.writes, 1, 'unchanged refresh cannot create an autosave loop');
  } finally { ui.dispose(); }
});

test('the same readiness event preserves unsaved inputs and holds their original unreadable provenance instead of replacing or blessing them', async () => {
  legacy(); const ui = planner();
  try {
    ui.edit(); const dirty = JSON.stringify(ui.state.plan);
    const draft = { marker: 'unsaved-review' }; ui.state.autoResult = draft; ui.state.pickerBedId = 'fixture-bed';
    await initialiseCropPlanFixture(); ui.commit();
    assert.equal(JSON.stringify(ui.state.plan), dirty); assert.equal(ui.state.planSaveConflict, true);
    assert.equal(ui.state.autoResult, draft); assert.equal(ui.state.pickerBedId, 'fixture-bed', 'a dirty view must not have its editing inputs cleared');
    assert.equal(ui.state.planWriteBase.current.token, null); ui.flushAutosave();
    assert.equal(ui.state.writes, 0); assert.deepEqual(readCanonicalCropPlanFixture<CropPlanState>().plantings, []);
  } finally { ui.dispose(); }
});

test('a cold read-only planner displays its actual canonical cycles and profiles without acquiring write admission or saving an empty substitute', async () => {
  const { row } = await ownRow();
  const profile = row.growerCycle.assessmentSnapshot.profile;
  legacy({ version: 1, plantings: [row], growerPlanningProfiles: [profile], updatedAt: 7 });
  await initialiseCropPlanFixture(); releaseCropPlanFixture(); await new Promise<void>(done => setImmediate(done));
  const original = readCanonicalCropPlanFixtureRaw(), ui = planner();
  try {
    assert.equal(ui.state.plan.plantings[0].id, row.id); assert.equal(ui.state.plan.growerPlanningProfiles[0].profileId, profile.profileId);
    assert.equal(ui.state.planWriteBase.current.admission.status, 'held'); assert.equal(ui.state.planWriteBase.current.token, null);
    assert.equal(ui.state.planSaveConflict, true); ui.flushAutosave();
    assert.equal(ui.state.writes, 0); assert.equal(readCanonicalCropPlanFixtureRaw(), original);
  } finally { ui.dispose(); }
});

test('a clean view refreshes newer saved content while corruption and a late actor switch retain the displayed inputs under a hold', async () => {
  legacy(); const ui = planner();
  try {
    await initialiseCropPlanFixture(); ui.commit();
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [], rainPattern: 'winter', updatedAt: 8 }));
    events.dispatchEvent(new Event('storage')); ui.commit();
    assert.equal(ui.state.plan.rainPattern, 'winter'); assert.equal(ui.state.plan.updatedAt, 8); assert.equal(ui.state.planSaveConflict, false);
    const displayed = JSON.stringify(ui.state.plan), base = ui.state.planWriteBase.current;
    replaceCanonicalCropPlanFixtureRaw('{broken'); events.dispatchEvent(new Event('storage')); ui.commit();
    assert.equal(JSON.stringify(ui.state.plan), displayed); assert.equal(ui.state.planWriteBase.current, base); assert.equal(ui.state.planSaveConflict, true);
    replaceCanonicalCropPlanFixtureRaw(displayed); probe.actor = 'owner-b';
    events.dispatchEvent(new Event('focus')); ui.commit();
    assert.equal(JSON.stringify(ui.state.plan), displayed); assert.equal(ui.state.planWriteBase.current, base); assert.equal(ui.state.planSaveConflict, true);
    assert.equal(ui.state.writes, 0);
  } finally { ui.dispose(); }
});

test('page suspension revokes the old admission even with unchanged bytes and a clean resumed planner explicitly binds a fresh lease', async () => {
  legacy(); const ui = planner();
  try {
    await initialiseCropPlanFixture(); ui.commit();
    const original = ui.state.planWriteBase.current, raw = readCanonicalCropPlanFixtureRaw();
    const history = [{ version: 1, plantings: [], updatedAt: 1 }], proposal = { retained: true };
    ui.state.planHistory = history; ui.state.autoResult = proposal;
    releaseCropPlanFixture(); ui.commit();
    assert.equal(ui.state.planSaveConflict, true);
    assert.equal(crop.cropPlanWriteAdmissionMatches(original.admission, original.planKey, original.token), false);
    await initialiseCropPlanFixture(); ui.commit();
    assert.equal(readCanonicalCropPlanFixtureRaw(), raw); assert.equal(ui.state.planSaveConflict, false);
    assert.equal(ui.state.planHistory, history); assert.equal(ui.state.autoResult, proposal, 'lease renewal alone does not erase unchanged inputs');
    assert.notEqual(ui.state.planWriteBase.current.token, original.token);
    assert.equal(crop.cropPlanWriteAdmissionMatches(original.admission, original.planKey, original.token), false);
    assert.equal(crop.cropPlanWriteAdmissionMatches(ui.state.planWriteBase.current.admission, ui.state.planWriteBase.current.planKey, ui.state.planWriteBase.current.token), true);
    ui.edit(); ui.flushAutosave(); ui.commit(); assert.equal(ui.state.writes, 1);
  } finally { ui.dispose(); }
});

test('changed saved occupancy invalidates old catalogue review/edit/history and retained geometry-only callbacks cannot reapply their old book', async () => {
  legacy(); const ui = planner();
  try {
    await initialiseCropPlanFixture(); ui.commit();
    ui.state.autoResult = { plantings: [{ id: 'old-proposal', cropKey: CROPS[0].key, bedId: 'fixture-bed', sowMonth: 12 }], notes: [] };
    ui.state.autoPhase = 'review'; ui.state.idealMeta = { old: true }; ui.state.autoGenerating = true;
    ui.state.suggestionScopeRef.current = ui.state.planningScopeKey;
    ui.state.pickerBedId = 'fixture-bed'; ui.state.pickerCrop = CROPS[0].key; ui.state.activePlanting = 'old-edit';
    ui.state.planHistory = [{ version: 1, plantings: [], updatedAt: 1 }];
    const oldHistoryBindings = ui.state.planHistoryContext.current, retained = ui.retainedCallbacks();
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: [{ id: 'new-saved-row', bedId: 'fixture-bed', cropKey: CROPS[0].key, sowMonth: 12 }], updatedAt: 9 }));
    events.dispatchEvent(new Event('storage')); ui.commit();
    assert.equal(ui.state.planSaveConflict, false); assert.equal(ui.state.plan.plantings[0].id, 'new-saved-row');
    assert.equal(ui.state.autoResult, null); assert.equal(ui.state.autoPhase, 'idle'); assert.equal(ui.state.idealMeta, null); assert.equal(ui.state.autoGenerating, false);
    assert.equal(ui.state.pickerBedId, null); assert.equal(ui.state.pickerCrop, null); assert.equal(ui.state.activePlanting, null);
    assert.deepEqual(ui.state.planHistory, []); assert.notEqual(ui.state.planHistoryContext.current, oldHistoryBindings);
    assert.equal(ui.state.suggestionScopeRef.current, null);
    const current = JSON.stringify(ui.state.plan);
    retained.openAutoSuggest(); retained.runAutoSuggest();
    assert.equal(ui.state.suggestionScopeRef.current, null, 'a retained generator cannot recreate its old geometry grant');
    // Even if a current review later has the same geometry key, an old accept
    // closure still carries its original book and cannot append the old rows.
    ui.state.suggestionScopeRef.current = ui.state.planningScopeKey;
    retained.acceptAutoSuggest();
    assert.equal(JSON.stringify(ui.state.plan), current); assert.equal(ui.state.writes, 0);
  } finally { ui.dispose(); }
});

test('a revoked lease cancels a queued autosave and reacquisition preserves dirty inputs rather than granting them the clean saved base', async () => {
  legacy(); const ui = planner();
  try {
    await initialiseCropPlanFixture(); ui.commit(); ui.edit();
    ui.runAutosave(); assert.equal(ui.timerCount(), 1); const dirty = JSON.stringify(ui.state.plan);
    releaseCropPlanFixture(); assert.equal(ui.timerCount(), 0); ui.commit();
    await initialiseCropPlanFixture(); ui.commit();
    assert.equal(JSON.stringify(ui.state.plan), dirty); assert.equal(ui.state.planSaveConflict, true);
    ui.flushAutosave(); assert.equal(ui.state.writes, 0); assert.deepEqual(readCanonicalCropPlanFixture<CropPlanState>().plantings, []);
  } finally { ui.dispose(); }
});

test('an event arriving before the first committed plan waits for that plan and listener cleanup prevents later refreshes', async () => {
  legacy(); const ui = planner();
  const initial = ui.state.plan;
  try {
    ui.state.plan = null; await initialiseCropPlanFixture(); ui.commit();
    assert.notEqual(ui.state.handledPlanStorageRevision.current, ui.state.planStorageRevision);
    ui.state.plan = initial; ui.commit(); assert.equal(ui.state.planSaveConflict, false);
    const revision = ui.state.planStorageRevision; ui.dispose();
    events.dispatchEvent(new Event(crop.CROP_PLAN_CHANGED_EVENT)); assert.equal(ui.state.planStorageRevision, revision);
  } finally { ui.dispose(); }
});

test('the actual global provider readiness event also withdraws and refreshes the real Task Planner hook after asynchronous setup', async () => {
  legacy();
  const url = new URL('../components/CropPlanStorageStatus.tsx', import.meta.url).href;
  const auth = { user: { uid: 'owner-a' }, loading: false, cropPlanMigrationHold: null, retryCropPlanMigration: async () => {} };
  Object.assign(globalThis, { __cropReadinessAuth: auth });
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (context.parentURL === url && specifier === '@/lib/auth') return { shortCircuit: true, url: 'data:text/javascript,export const useAuth=()=>globalThis.__cropReadinessAuth;' };
    return next(specifier, context);
  }, load(sourceUrl, context, next) {
    if (sourceUrl === url) return { shortCircuit: true, format: 'module', source: ts.transpileModule(readFileSync(new URL(sourceUrl), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return next(sourceUrl, context);
  } });
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const lockNames = new Set<string>();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { async request(name: string, _options: unknown, run: (lock: unknown) => Promise<unknown>) {
    await Promise.resolve(); if (lockNames.has(name)) return run(null); lockNames.add(name);
    try { return await run({ name }); } finally { lockNames.delete(name); }
  } } } });
  let renderer!: ReactTestRenderer, state!: ReturnType<typeof useGrowerOperations>;
  try {
    const { default: Provider } = await import('../components/CropPlanStorageStatus.tsx');
    function Task() { state = useGrowerOperations(); return null; }
    act(() => { renderer = create(React.createElement(Provider, { children: React.createElement(Task) })); });
    const deadline = Date.now() + 2_000;
    while (state.status !== 'ready' && Date.now() < deadline) await act(async () => { await new Promise(done => setTimeout(done, 1)); });
    assert.equal(state.status, 'ready'); assert.equal(state.isCurrent(), true);
    act(() => { events.dispatchEvent(new Event('pagehide')); });
    await act(async () => { await new Promise(done => setImmediate(done)); });
    assert.notEqual(state.status, 'ready');
    act(() => { events.dispatchEvent(new Event('pageshow')); });
    while (state.status !== 'ready' && Date.now() < deadline) await act(async () => { await new Promise(done => setTimeout(done, 1)); });
    assert.equal(state.status, 'ready'); assert.equal(state.isCurrent(), true);
  } finally {
    if (renderer) act(() => { renderer.unmount(); }); hook.deregister();
    delete (globalThis as Record<string, unknown>).__cropReadinessAuth;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});
