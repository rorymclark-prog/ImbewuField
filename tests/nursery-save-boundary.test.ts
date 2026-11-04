import assert from 'node:assert/strict';
import test, { after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import React, { useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { crop, account, samples, local, events, probe, reset, cleanup, siteId } from './international-grower-operations-fixture.ts';
import { replaceCanonicalCropPlanFixtureRaw, readCanonicalCropPlanFixtureRaw, releaseCropPlanFixture, initialiseCropPlanFixture } from './crop-plan-storage-fixture.ts';
import { sanitiseNurserySettings, type NurserySettings } from '../lib/nursery-settings.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL?.endsWith('/lib/nursery-save-receipt.ts') && specifier === './firebase/init') return { shortCircuit: true,
    url: 'data:text/javascript,' + encodeURIComponent(`export const isBackendConfigured=()=>globalThis.__growerOperationsFixture.configured;
      export const getFirebase=()=>{const p=globalThis.__growerOperationsFixture;if(p.initThrows)throw Error('synthetic unavailable auth');
        return p.configured&&!p.receiptNoAuth?{auth:{get currentUser(){return p.actor?{uid:p.actor}:null;}}}:null;};`) };
  if (context.parentURL?.endsWith('/lib/nursery-save-receipt.ts') && specifier === 'firebase/auth') return { shortCircuit: true,
    url: 'data:text/javascript,' + encodeURIComponent(`export function onAuthStateChanged(_auth,callback){const p=globalThis.__growerOperationsFixture;p.auth.add(callback);return()=>p.auth.delete(callback);}`) };
  return next(specifier, context);
} });
const api = await import('../lib/nursery-save-receipt.ts');
const storage = await import('../lib/crop-plan-storage.ts');
beforeEach(async () => { Object.assign(probe, { receiptNoAuth: false }); await reset(); }); after(() => { hooks.deregister(); cleanup(); });
const otherSite = 'site:2.00000,2.00000';
const empty = (): NurserySettings => ({ version: 1, spaces: [], containers: [], profiles: [] });
const book = (): CropPlanState => ({ version: 1, plantings: [], updatedAt: 7, nursery: { ...empty(), spaces: [
  { id: 'own-space', siteId, name: 'Synthetic own space', usableM2: 2 },
  { id: 'other-space', siteId: otherSite, name: 'Synthetic other space', usableM2: 3 }] } });
const page = ts.createSourceFile('page.tsx', readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['plannerActorIsCurrent', 'growerActorIsCurrent', 'rememberStoredPlan', 'saveScopedGrowerInputs', 'saveNurserySettings', 'refreshAdmittedStoredPlan'];
const bodies = new Map<string,string>();
let authorityEffect = '', contextEffect = '', readinessEffect = '', storageListeners = '';
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.body && node.name && names.includes(node.name.text)) bodies.set(node.name.text, node.getText(page));
  if (ts.isCallExpression(node) && node.expression.getText(page) === 'useEffect') {
    const body = node.arguments[0]?.getText(page) ?? '';
    if (body.includes('const authority = createNurserySaveAuthority')) authorityEffect = body;
    if (body.includes('setNurserySaveContext(createNurserySaveContext')) contextEffect = body;
    if (node.arguments[1]?.getText(page) === '[planStorageRevision, plan]') readinessEffect = body;
    if (body.includes('setPlanStorageRevision(value => value + 1)')) storageListeners = body;
  }
  ts.forEachChild(node, visit);
}
visit(page); assert.equal(bodies.size, names.length); assert.ok(authorityEffect && contextEffect && readinessEffect && storageListeners);
const compiled = ts.transpileModule([...bodies.values(), `const runAuthorityEffect=${authorityEffect};const runContextEffect=${contextEffect};const runReadinessEffect=${readinessEffect};const installStorageListeners=${storageListeners};`].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;

// Only the React setter boundary and Firebase identity are controlled. Admission,
// initialized storage lease, namespace merge, real saver and receipt readback run.
function parent(raw?: CropPlanState) {
  if (arguments.length === 0) raw = book();
  if (raw) replaceCanonicalCropPlanFixtureRaw(JSON.stringify(raw));
  const loaded = crop.loadCropPlanWithWriteAdmission(), owner = account.activeAccountUid(), sample = samples.isSampleMode();
  const state: any = { plan: loaded.book, planWriteBase: { current: { owner, sample, token: loaded.token, planKey: JSON.stringify(loaded.book), admission: loaded.admission } },
    nurseryProducerLive: { current: { plan: loaded.book, conflict: false } }, nurserySaveContext: null,
    planSaveConflict: false, planSaveFailed: false, growerOwner: owner, growerSample: sample, productionSiteId: siteId, growerScopeKey: 'mapped-source',
    growerBookContext: { current: { owner, sample, siteId, scopeKey: 'mapped-source' } }, saveTimer: { current: null }, clearTimeout() {},
    activeAccountUid: account.activeAccountUid, isSampleMode: samples.isSampleMode, isBackendConfigured: () => probe.configured,
    getFirebase: () => ({ auth: { currentUser: probe.actor ? { uid: probe.actor } : null } }),
    loadCropPlanWithWriteAdmission: crop.loadCropPlanWithWriteAdmission, cropPlanWriteAdmissionMatches: crop.cropPlanWriteAdmissionMatches,
    cropPlanWriteCandidateIsLossless: crop.cropPlanWriteCandidateIsLossless, cropPlanWriteToken: crop.cropPlanWriteToken,
    saveCropPlanWithReceipt: crop.saveCropPlanWithReceipt, sanitiseNurserySettings, sanitiseHarvestTargets: crop.sanitiseHarvestTargets,
    createNurserySaveAuthority: api.createNurserySaveAuthority, revokeNurserySaveAuthority: api.revokeNurserySaveAuthority, createNurserySaveContext: api.createNurserySaveContext,
    CROP_PLAN_CHANGED_EVENT: crop.CROP_PLAN_CHANGED_EVENT, CROP_PLAN_STORAGE_EVENT: storage.CROP_PLAN_STORAGE_EVENT,
    SAMPLE_MODE_EVENT: samples.SAMPLE_MODE_EVENT,
    planStorageRevision: 0, handledPlanStorageRevision: { current: 0 },
    beginNurserySaveRequest: api.beginNurserySaveRequest, commitNurserySaveRequest: api.commitNurserySaveRequest, readNurserySaveConfirmation: api.readNurserySaveConfirmation,
    setPlan(value: CropPlanState) { state.plan = value; }, setPlanSaveConflict(value: boolean) { state.planSaveConflict = value; }, setPlanSaveFailed(value: boolean) { state.planSaveFailed = value; } };
  const methods = Function('state', `with(state){${compiled};return {${names.join(',')},runAuthorityEffect,runContextEffect,runReadinessEffect,installStorageListeners};}`)(state);
  const authority = api.createNurserySaveAuthority({ siteId, scopeKey: state.growerScopeKey,
    current: () => ({ book: state.nurseryProducerLive.current.plan, base: state.planWriteBase.current }),
    isCurrent: () => !state.planSaveConflict && methods.growerActorIsCurrent() });
  state.nurserySaveContext = api.createNurserySaveContext(authority);
  return { state, ...methods, authority, context: state.nurserySaveContext,
    next(area = 4): NurserySettings { return { ...state.plan.nursery, spaces: state.plan.nursery.spaces.map((row: any) => row.siteId === siteId ? { ...row, usableM2: area } : row) }; },
    request(next: NurserySettings) {
      if (!api.nurserySaveContextIsCurrent(state.nurserySaveContext)) state.nurserySaveContext = api.createNurserySaveContext(authority);
      const request = api.createNurserySaveRequest(state.nurserySaveContext, next); assert.ok(request, 'use an actual admitted original context'); return request;
    },
    dispose() { api.revokeNurserySaveAuthority(authority); } };
}

test('the actual parent acknowledges the original request after installing its own new admitted base, and a copied result or replay cannot clear another draft', () => {
  const c = parent(); try {
    const next = c.next(), request = c.request(next), original = c.state.planWriteBase.current;
    c.state.plan = structuredClone(c.state.plan); c.state.nurseryProducerLive.current.plan = c.state.plan;
    c.state.nurserySaveContext = api.createNurserySaveContext(c.authority);
    assert.notEqual(c.context, c.state.nurserySaveContext); assert.equal(api.nurserySaveContextIsCurrent(c.context), true);
    const result = c.saveNurserySettings(next, request);
    assert.equal(result.status, 'confirmed'); assert.notEqual(c.state.planWriteBase.current, original);
    assert.equal(api.nurserySaveContextIsCurrent(c.context), false, 'the prewrite base really is spent');
    assert.equal(api.nurserySaveResultMatches({ ...result }, request), null);
    // A harmless repeat admission must not invalidate the same actually saved bytes.
    const refreshed = crop.loadCropPlanWithWriteAdmission();
    c.state.planWriteBase.current = { ...c.state.planWriteBase.current, admission: refreshed.admission };
    const other = c.request(c.next(5)); assert.equal(api.nurserySaveResultMatches(result, other), null);
    assert.equal(api.nurserySaveResultMatches(result, request), 'device'); assert.equal(api.nurserySaveResultMatches(result, request), null);
    assert.equal(JSON.parse(readCanonicalCropPlanFixtureRaw()).nursery.spaces.find((row: any) => row.siteId === siteId).usableM2, 4);
  } finally { c.dispose(); }
});

test('a real saved receipt followed by changed readback is unconfirmed rather than the old true-plus-conflict success', () => {
  const c = parent(), originalSet = local.setItem; let changed = false;
  try {
    const next = c.next(), request = c.request(next);
    local.setItem = function(key, value) {
      originalSet.call(this, key, value);
      if (!changed && key.includes('imbewu_crop_plan_v2')) {
        changed = true; const envelope = JSON.parse(value), actual = JSON.parse(envelope.bookRaw);
        actual.nursery.spaces.find((row: any) => row.siteId === siteId).usableM2 = 99; this.rows.set(key, JSON.stringify({ ...envelope, bookRaw: JSON.stringify(actual) }));
      }
    };
    const result = c.saveNurserySettings(next, request);
    assert.equal(changed, true); assert.equal(result.status, 'performed-unconfirmed'); assert.equal(c.state.planSaveConflict, true);
    assert.equal(api.nurserySaveResultMatches(result, request), null); assert.equal(c.state.plan.nursery.spaces[0].usableM2, 2);
    assert.equal(JSON.parse(readCanonicalCropPlanFixtureRaw()).nursery.spaces.find((row: any) => row.siteId === siteId).usableM2, 99);
    const writes = local.writes; c.saveNurserySettings(next, request); assert.equal(local.writes, writes, 'never replay a possibly performed write');
  } finally { local.setItem = originalSet; c.dispose(); }
});

test('false or thrown actual storage attempts preserve ambiguity even if bytes were performed before the throw', () => {
  for (const partial of [false, true]) {
    const c = parent(), originalSet = local.setItem;
    try {
      const next = c.next(), request = c.request(next), before = readCanonicalCropPlanFixtureRaw();
      local.setItem = function(key, value) { if (partial) originalSet.call(this, key, value); throw Error('synthetic quota boundary'); };
      const result = c.saveNurserySettings(next, request); assert.equal(result.status, 'performed-unconfirmed');
      assert.equal(api.nurserySaveResultMatches(result, request), null); assert.equal(c.state.plan.nursery.spaces[0].usableM2, 2);
      local.setItem = originalSet; assert.equal(readCanonicalCropPlanFixtureRaw() === before, !partial);
      const writes = local.writes; c.saveNurserySettings(next, request); assert.equal(local.writes, writes);
    } finally { local.setItem = originalSet; c.dispose(); }
  }
});

test('the existing foreign-only rebase preserves new foreign data and the original nursery request provenance', () => {
  const c = parent(); try {
    const next = c.next(), request = c.request(next), originalBase = c.state.planWriteBase.current;
    const fresh = book(); fresh.nursery!.spaces[1].usableM2 = 17; fresh.updatedAt = Date.now();
    assert.equal(crop.saveCropPlan(fresh), true);
    assert.equal(c.state.planWriteBase.current, originalBase); assert.equal(api.nurserySaveContextIsCurrent(c.context), true);
    const result = c.saveNurserySettings(next, request); assert.equal(result.status, 'confirmed');
    const saved = JSON.parse(readCanonicalCropPlanFixtureRaw()); assert.equal(saved.nursery.spaces.find((row: any) => row.siteId === otherSite).usableM2, 17); assert.equal(saved.nursery.spaces.find((row: any) => row.siteId === siteId).usableM2, 4);
    assert.notEqual(api.nurserySaveResultSourceKey(result, request), api.nurserySettingsSourceKey(siteId, next));
    assert.equal(api.nurserySaveResultSourceKey(result, request), api.nurserySettingsSourceKey(siteId, saved.nursery));
    assert.equal(api.nurserySaveResultMatches(result, request), 'device');
    assert.equal(api.nurserySaveResultSourceKey(result, request), api.nurserySettingsSourceKey(siteId, saved.nursery), 'a consumed acknowledgment still exposes only its actual bound readback identity');
  } finally { c.dispose(); }
});

test('a new own-site source or dirty original display cannot be blessed by a fresh current token', () => {
  for (const dirty of [false, true]) {
    const c = parent(); try {
      const next = c.next(), request = c.request(next);
      if (dirty) { c.state.plan = { ...c.state.plan, updatedAt: 999 }; c.state.nurseryProducerLive.current.plan = c.state.plan; }
      else { const fresh = book(); fresh.nursery!.spaces[0].usableM2 = 8; fresh.updatedAt = Date.now(); assert.equal(crop.saveCropPlan(fresh), true); }
      const before = readCanonicalCropPlanFixtureRaw(), writes = local.writes;
      const result = c.saveNurserySettings(next, request); assert.notEqual(result.status, 'confirmed');
      assert.equal(local.writes, writes); assert.equal(readCanonicalCropPlanFixtureRaw(), before);
    } finally { c.dispose(); }
  }
});

test('retained nursery requests reject actual actor, sample, site, scope, cleanup and same-bytes lease replacement', async () => {
  for (const change of ['actor', 'sample', 'site', 'scope', 'cleanup', 'lease'] as const) {
    await reset(); const c = parent(); try {
      const next = c.next(), request = c.request(next);
      if (change === 'actor') probe.actor = 'owner-b';
      if (change === 'sample') { sessionStorage.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); }
      if (change === 'site') c.state.growerBookContext.current.siteId = otherSite;
      if (change === 'scope') c.state.growerBookContext.current.scopeKey = 'changed-scope';
      if (change === 'cleanup') c.dispose();
      if (change === 'lease') { releaseCropPlanFixture(); await initialiseCropPlanFixture(); }
      const writes = local.writes, result = c.saveNurserySettings(next, request);
      assert.notEqual(result.status, 'confirmed', change); assert.equal(local.writes, writes, change);
    } finally { c.dispose(); }
  }
});

test('actor and sample ABA events cannot revive a request even when all ordinary values return', () => {
  for (const change of ['actor', 'sample'] as const) {
    const c = parent(); try {
      const next = c.next(), request = c.request(next);
      if (change === 'actor') { for (const uid of ['owner-b', 'owner-a']) { probe.actor = uid; account.bindMountedAccountLocalStorageUid(uid); for (const callback of probe.auth) callback({ uid }); } }
      else { sessionStorage.setItem('imbewu_sample_mode', '1'); events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); sessionStorage.removeItem('imbewu_sample_mode'); events.dispatchEvent(new Event(samples.SAMPLE_MODE_EVENT)); }
      const writes = local.writes; assert.notEqual(c.saveNurserySettings(next, request).status, 'confirmed'); assert.equal(local.writes, writes);
    } finally { c.dispose(); }
  }
});

test('sample nursery acknowledgment clears only the same sample request and never writes physical device records', () => {
  assert.equal(samples.enterSampleMode(), true); samples.setSandboxCropPlan(book()); const c = parent(undefined);
  try {
    const before = JSON.stringify([...local.rows]), writes = local.writes, next = c.next(), request = c.request(next);
    const result = c.saveNurserySettings(next, request); assert.equal(result.status, 'confirmed'); assert.equal(result.sample, true);
    assert.equal(api.nurserySaveResultMatches(result, request), 'sample'); assert.equal(JSON.stringify([...local.rows]), before); assert.equal(local.writes, writes);
  } finally { c.dispose(); }
});

test('legacy absence, forged contexts and getter-bearing inputs cannot manufacture a receipt or execute accessors', () => {
  const c = parent(); try {
    const writes = local.writes, next = c.next(); let getters = 0;
    assert.equal(c.saveNurserySettings(next).status, 'held'); assert.equal(c.saveNurserySettings(next, { kind: 'nursery-save-request' }).status, 'held');
    assert.equal(api.createNurserySaveRequest({ kind: 'nursery-save-context' }, next), null);
    const unsafe = { ...next }; Object.defineProperty(unsafe, 'spaces', { enumerable: true, get() { ++getters; return next.spaces; } });
    assert.equal(api.nurserySettingsSourceKey(siteId, unsafe), null); assert.equal(api.createNurserySaveRequest(c.context, unsafe), null);
    assert.equal(getters, 0); assert.equal(local.writes, writes); assert.ok(api.nurserySettingsSourceKey(siteId, undefined));
  } finally { c.dispose(); }
});

test('legitimate legacy settlement and foreign held evidence remain canonical while unknown book metadata is held unchanged', () => {
  const raw = book(); raw.plantings = [{ id: 'legacy', bedId: 'bed-a', cropKey: CROPS[0].key, sowMonth: 1, once: '2020-01' }];
  raw.nursery = sanitiseNurserySettings({ ...raw.nursery, heldInputs: [{ collection: 'containers', reason: 'ambiguous-identities', rows: [{ id: 'foreign', siteId: otherSite, note: 'retain raw evidence' }] }], sourceIssues: ['nursery-held-inputs-unresolved'] });
  const c = parent(raw); try {
    const next = c.next(), request = c.request(next), result = c.saveNurserySettings(next, request); assert.equal(result.status, 'confirmed');
    const saved = JSON.parse(readCanonicalCropPlanFixtureRaw()); assert.equal(saved.plantings[0].awaitingSowingConfirmation, true); assert.equal(saved.plantings[0].confirmedOnceSowing, undefined);
    assert.deepEqual(saved.nursery.heldInputs, raw.nursery.heldInputs); assert.equal(api.nurserySaveResultMatches(result, request), 'device');
  } finally { c.dispose(); }
  const unknown = { ...book(), unknownProjectEvidence: { retain: true } }, held = parent(unknown);
  try { const before = readCanonicalCropPlanFixtureRaw(); assert.equal(held.context, null); assert.equal(held.saveNurserySettings(held.next()).status, 'held'); assert.equal(readCanonicalCropPlanFixtureRaw(), before); }
  finally { held.dispose(); }
});


test('unsafe live sample evidence is held without calling its getter or replacing it with a nursery proposal', () => {
  assert.equal(samples.enterSampleMode(), true); let getters = 0;
  const unsafe = book(); const accessor = () => { ++getters; return empty(); };
  Object.defineProperty(unsafe, 'nursery', { enumerable: true, get: accessor }); samples.setSandboxCropPlan(unsafe);
  const c = parent(undefined); try {
    assert.equal(c.context, null); assert.equal(c.saveNurserySettings(empty()).status, 'held'); assert.equal(getters, 0);
    assert.equal(Object.getOwnPropertyDescriptor(samples.getSandboxCropPlan(), 'nursery')?.get, accessor);
  } finally { c.dispose(); }
});


test('actual mounted parent effects acquire an initially absent nursery context after asynchronous storage readiness, then revoke and renew a same-bytes lease', async () => {
  releaseCropPlanFixture(); await Promise.resolve(); const c = parent(); c.dispose();
  let renderer!: ReactTestRenderer; let observedContext: import('../lib/nursery-save-receipt.ts').NurserySaveContext | null = null;
  let destination: string | null = null; const arrivals: boolean[] = [];
  function Lifecycle() {
    const [authority, setAuthority] = useState<import('../lib/nursery-save-receipt.ts').NurserySaveAuthority | null>(null);
    const [context, setContext] = useState<import('../lib/nursery-save-receipt.ts').NurserySaveContext | null>(null);
    const [plan, setPlan] = useState(c.state.plan), [conflict, setConflict] = useState(c.state.planWriteBase.current.admission.status !== 'ready'), [revision, setRevision] = useState(0);
    Object.assign(c.state, { nurserySaveAuthority: authority, nurserySaveContext: context, plan, planSaveConflict: conflict,
      planStorageRevision: revision, setNurserySaveAuthority: setAuthority, setNurserySaveContext: setContext,
      setPlan, setPlanSaveConflict: setConflict, setPlanStorageRevision: setRevision });
    c.state.nurseryProducerLive.current = { plan, conflict }; observedContext = context;
    useEffect(c.installStorageListeners, []);
    useEffect(c.runReadinessEffect, [revision, plan]);
    useEffect(c.runAuthorityEffect, [c.state.growerOwner, c.state.growerSample, c.state.productionSiteId, c.state.growerScopeKey, conflict]);
    useEffect(c.runContextEffect, [authority, plan, conflict, revision]);
    const ready = api.nurserySaveContextIsCurrent(context); arrivals.push(ready);
    return React.createElement('button', { disabled: !ready, onClick() {
      const next = c.next(6), request = api.createNurserySaveRequest(context, next); assert.ok(request);
      const result = c.saveNurserySettings(next, request); destination = api.nurserySaveResultMatches(result, request);
    } }, 'Actual parent nursery save');
  }
  try {
    act(() => { renderer = create(React.createElement(Lifecycle)); });
    assert.equal(arrivals[0], false); assert.equal(renderer.root.findByType('button').props.disabled, true);
    await act(async () => { await initialiseCropPlanFixture(); });
    assert.equal(renderer.root.findByType('button').props.disabled, false); assert.ok(arrivals.includes(true));
    act(() => renderer.root.findByType('button').props.onClick()); assert.equal(destination, 'device');
    const oldContext = observedContext, bytes = readCanonicalCropPlanFixtureRaw(); assert.ok(oldContext);
    act(() => { releaseCropPlanFixture(); });
    assert.equal(api.nurserySaveContextIsCurrent(oldContext), false); assert.equal(renderer.root.findByType('button').props.disabled, true);
    await act(async () => { await initialiseCropPlanFixture(); });
    assert.equal(readCanonicalCropPlanFixtureRaw(), bytes); assert.equal(renderer.root.findByType('button').props.disabled, false);
    assert.equal(api.nurserySaveContextIsCurrent(oldContext), false, 'identical stored values cannot revive the old lease proof');
    act(() => renderer.root.findByType('button').props.onClick()); assert.equal(destination, 'device');
  } finally { if (renderer) act(() => renderer.unmount()); c.dispose(); }
});

test('an optional crop refresh notification throwing cannot turn a genuinely written and read-back nursery save into failure', () => {
  const c = parent(), dispatch = events.dispatchEvent; try {
    const next = c.next(), request = c.request(next);
    events.dispatchEvent = () => { throw Error('synthetic optional notification failure'); };
    const result = c.saveNurserySettings(next, request); assert.equal(result.status, 'confirmed'); assert.equal(api.nurserySaveResultMatches(result, request), 'device');
  } finally { events.dispatchEvent = dispatch; c.dispose(); }
});


test('backendless device saves and a genuine configured guest remain usable, but absent configured Firebase cannot imitate a null guest identity', async () => {
  releaseCropPlanFixture(); account.bindMountedAccountLocalStorageUid(null); probe.actor = null; probe.configured = false;
  await initialiseCropPlanFixture(); const localOnly = parent(); try {
    const next = localOnly.next(), request = localOnly.request(next), result = localOnly.saveNurserySettings(next, request);
    assert.equal(result.status, 'confirmed'); assert.equal(api.nurserySaveResultMatches(result, request), 'device');
  } finally { localOnly.dispose(); }
  releaseCropPlanFixture(); probe.configured = true; await initialiseCropPlanFixture(); const guest = parent();
  try {
    assert.ok(guest.context, 'a real auth object with no signed-in user is a legitimate guest');
    Object.assign(probe, { receiptNoAuth: true });
    const denied = api.createNurserySaveAuthority({ siteId, scopeKey: guest.state.growerScopeKey,
      current: () => ({ book: guest.state.plan, base: guest.state.planWriteBase.current }), isCurrent: guest.growerActorIsCurrent });
    assert.equal(denied, null, 'unavailable configured Firebase is not evidence of a guest identity');
    const writes = local.writes; assert.equal(api.createNurserySaveRequest(guest.context, guest.next()), null); assert.equal(local.writes, writes);
  } finally { Object.assign(probe, { receiptNoAuth: false }); guest.dispose(); }
});
