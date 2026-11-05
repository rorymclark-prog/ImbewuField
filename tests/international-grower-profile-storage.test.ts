import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { initialiseCropPlanFixture, releaseCropPlanFixture, canonicalCropPlanFixtureKey, readCanonicalCropPlanFixtureRaw, readCanonicalCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import { CROPS } from '../lib/crop-catalog.ts';
import type { CropPlanState } from '../lib/crop-plan.ts';
import { createWorkspacePlanningReference } from '../lib/international/workspace-context.ts';
import { normaliseGrowerPlanningProfile, type GrowerInput, type GrowerPlanningProfile } from '../lib/international/grower-planning.ts';

// Only the auth transport is replaced. Profile validation, account key selection,
// sample isolation and the plan's load/save implementation remain the real ones.
const account = { backend: true, uid: 'grower-owner-a' as string | null };
Object.assign(globalThis, { __growerStorageAccount: account });
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './firebase/init' && context.parentURL?.endsWith('/lib/account-local-storage.ts')) return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
const state=globalThis.__growerStorageAccount;
export const isBackendConfigured=()=>state.backend;
export const getFirebase=()=>state.backend?{auth:{currentUser:state.uid?{uid:state.uid}:null}}:null;
`),
    };
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  rows = new Map<string, string>();
  failWrite = false;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota exceeded'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.failWrite = false; }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
Object.assign(globalThis, { Storage: MemoryStorage, window: browser, localStorage: local, sessionStorage: session });
const { loadCropPlan, saveCropPlan, cropPlanWriteToken, saveCropPlanWithReceipt, CROP_PLAN_CHANGED_EVENT } = await import('../lib/crop-plan.ts');
const { activeAccountLocalStorageKey, accountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { enterSampleMode, exitSampleMode, getSandboxCropPlan } = await import('../lib/sample-mode.ts');
hooks.deregister();

const storageKey = 'imbewu_crop_plan_v1';
const recordedAt = '2026-11-02T12:00:00.000Z';
const missing = { state: 'missing', reason: 'not-known' } as const;
function provided<T, U extends string>(value: T, unit: U): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance: { kind: 'grower-estimate', recordedAt, note: 'Synthetic storage fixture; not farming advice.' } };
}
function profile(profileId = 'own-assumptions'): GrowerPlanningProfile {
  return { version: 1, profileId, cropKey: CROPS[0].key, scope: { kind: 'unmapped-workspace', workspaceId: 'virtual-bed' },
    inputs: { plantsPerM2: provided(0, 'plants/m2'), yieldKgPerM2: provided(0, 'kg/m2/cycle'),
      establishment: missing, nurseryDays: { state: 'missing', reason: 'not-applicable' },
      fieldEntryToFirstHarvestDays: missing, pickingDays: missing, fieldOccupancyDays: missing,
      turnaroundDays: provided(0, 'days'), allowedEntryMonths: provided([], 'utc-months') } };
}

// Existing valid crop-plan content must survive profile sanitisation unchanged.
// Quantities are engineering fixtures, not agronomic recommendations.
function legacyPlan(): CropPlanState {
  return { version: 1, plantings: [{ id: 'existing-sowing', bedId: 'own-bed', cropKey: CROPS[0].key, sowMonth: 3,
      variety: 'Grower-entered fixture label', areaFraction: 0.5 }],
    workspaceReferences: [createWorkspacePlanningReference('virtual-bed', true, recordedAt)!], rainPattern: 'winter', updatedAt: 123,
    nursery: { version: 1, spaces: [{ id: 'bench', siteId: 'virtual-bed', name: 'Own bench', usableM2: 2 }],
      containers: [{ id: 'tray', siteId: 'virtual-bed', name: 'Own tray', cells: 20, owned: 0 }],
      profiles: [{ id: 'nursery-recipe', siteId: 'virtual-bed', cropKey: CROPS.find(crop => crop.transplant)!.key,
        model: 'measured-tray', containerId: 'tray', usableStartsPerTray: 10, nurseryWeeks: 2 }] },
    harvestTargets: [{ id: 'target', siteId: 'virtual-bed', cropKey: CROPS[0].key, startMonth: '2026-11', endMonth: '2026-12', weeklyKg: 1 }],
    productionRecords: [{ id: 'record', siteId: 'virtual-bed', sourceIconKey: `crop:${CROPS[0].key}`, label: 'Synthetic actual production',
      date: { year: 2026, month: 11 }, quantity: 0, unit: 'kg', status: 'actual', pricePerUnit: 0, provenance: 'fictional-example' }],
    preservedProducts: [{ id: 'stock', siteId: 'virtual-bed', sourceIconKey: `crop:${CROPS[0].key}`, label: 'Synthetic stock observation',
      method: 'stored', dates: [{ year: 2026, month: 11 }], quantities: [{ year: 2026, month: 11, kg: 0 }],
      provenance: 'fictional-example', note: 'Recorded stock fixture, not a storage-life recommendation.' }],
    planNotes: [{ kind: 'basis', text: 'Keep the grower’s original accepted-plan explanation.' }], planNotesAt: Date.UTC(2026, 10, 1) };
}
function withoutProfiles(plan: CropPlanState) {
  const { growerPlanningProfiles: _profiles, ...rest } = plan;
  return rest;
}
function switchAccount(uid: string | null) {
  account.uid = uid;
  bindMountedAccountLocalStorageUid(uid);
}

test.beforeEach(() => {
  releaseCropPlanFixture();
  exitSampleMode(); local.clear(); session.clear(); account.backend = true;
  switchAccount('grower-owner-a');
});
test.after(() => { releaseCropPlanFixture(); exitSampleMode(); bindMountedAccountLocalStorageUid(null); Reflect.deleteProperty(globalThis, '__growerStorageAccount'); });

test('a legacy crop book remains readable and saving it invents no grower assumptions or new ledger', async () => {
  const original = legacyPlan();
  local.setItem(activeAccountLocalStorageKey(storageKey), JSON.stringify(original));
  await initialiseCropPlanFixture();
  assert.deepEqual(loadCropPlan(), original);
  assert.equal(Object.hasOwn(loadCropPlan(), 'growerPlanningProfiles'), false);
  assert.equal(saveCropPlan(loadCropPlan()), true);
  assert.deepEqual(JSON.parse(local.getItem(activeAccountLocalStorageKey(storageKey))!), original);
  assert.deepEqual(readCanonicalCropPlanFixture(), original);
  assert.deepEqual(new Set(local.rows.keys()), new Set([accountLocalStorageKey(storageKey, 'grower-owner-a'), canonicalCropPlanFixtureKey(), activeAccountLocalStorageKey('imbewu_crop_plan_cutover_v2')]), 'one canonical book plus frozen migration evidence; no profile-specific ledger');
});

test('partial own assumptions reload with provided zero and explicit empty months while every existing plan field survives', async () => {
  const partial = profile();
  assert.deepEqual(normaliseGrowerPlanningProfile(partial), partial, 'the fixture itself must pass the real profile authority');
  const original = { ...legacyPlan(), growerPlanningProfiles: [partial] };
  const untouched = structuredClone(original);
  await initialiseCropPlanFixture();
  assert.equal(saveCropPlan(original), true);
  assert.deepEqual(loadCropPlan(), untouched);
  assert.deepEqual(original, untouched, 'saving cannot rewrite the supplied plan or source assumptions');
  assert.deepEqual(loadCropPlan().growerPlanningProfiles?.[0].inputs.plantsPerM2, provided(0, 'plants/m2'));
  assert.deepEqual(loadCropPlan().growerPlanningProfiles?.[0].inputs.yieldKgPerM2, provided(0, 'kg/m2/cycle'));
  assert.deepEqual(loadCropPlan().growerPlanningProfiles?.[0].inputs.turnaroundDays, provided(0, 'days'));
  assert.deepEqual(loadCropPlan().growerPlanningProfiles?.[0].inputs.allowedEntryMonths, provided([], 'utc-months'));
  assert.deepEqual(loadCropPlan().growerPlanningProfiles?.[0].inputs.establishment, missing);
  assert.deepEqual(new Set(local.rows.keys()), new Set([canonicalCropPlanFixtureKey(), activeAccountLocalStorageKey('imbewu_crop_plan_cutover_v2')]), 'fresh account uses only its canonical book and frozen cutover receipt');
  assert.equal(saveCropPlan({ ...loadCropPlan(), growerPlanningProfiles: [] }), true);
  assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [] });
});

test('two accounts and a signed-out guest each keep their own assumptions without inheriting legacy owner-unknown data', async () => {
  local.setItem(storageKey, JSON.stringify({ ...legacyPlan(), growerPlanningProfiles: [profile('unknown-owner')] }));
  assert.equal(loadCropPlan().growerPlanningProfiles, undefined);
  const owners = ['grower-owner-a', 'grower-owner-b', null] as const;
  for (const owner of owners) {
    switchAccount(owner);
    await initialiseCropPlanFixture();
    assert.equal(loadCropPlan().growerPlanningProfiles, undefined, 'a new owner cannot inherit another profile list');
    assert.equal(saveCropPlan({ ...legacyPlan(), growerPlanningProfiles: [profile(owner ?? 'guest-own')] }), true);
  }
  for (const owner of owners) {
    switchAccount(owner);
    assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [profile(owner ?? 'guest-own')] });
  }
  assert.equal(JSON.parse(local.getItem(storageKey)!).growerPlanningProfiles[0].profileId, 'unknown-owner');
  assert.equal([...local.rows.keys()].filter(key => key.startsWith('imbewu_crop_plan_v2')).length, owners.length, 'each owner has one canonical book');
  assert.equal([...local.rows.keys()].filter(key => key.startsWith('imbewu_crop_plan_cutover_v2')).length, owners.length, 'each canonical book retains its migration evidence');
  assert.equal([...local.rows.keys()].filter(key => key.startsWith(storageKey)).length, 1, 'only the untouched owner-unknown legacy row remains');
});

test('failed storage reports failure and leaves the previous complete plan and assumptions intact', async () => {
  const original = { ...legacyPlan(), growerPlanningProfiles: [profile('persisted')] };
  await initialiseCropPlanFixture();
  assert.equal(saveCropPlan(original), true);
  const oldBytes = local.getItem(canonicalCropPlanFixtureKey());
  local.failWrite = true;
  assert.equal(saveCropPlan({ ...original, growerPlanningProfiles: [profile('unsaved')], plantings: [] }), false);
  assert.equal(local.getItem(canonicalCropPlanFixtureKey()), oldBytes);
  assert.deepEqual(loadCropPlan(), original);
});

test('sample assumptions are temporary, preserve sample plan content and never overwrite the signed-in crop book', async () => {
  const original = { ...legacyPlan(), growerPlanningProfiles: [profile('real-account')] };
  await initialiseCropPlanFixture();
  assert.equal(saveCropPlan(original), true);
  const physicalBefore = [...local.rows.entries()];
  assert.equal(enterSampleMode(), true);
  assert.equal(loadCropPlan().growerPlanningProfiles, undefined);
  const sampleBefore = loadCropPlan();
  const sample = { ...sampleBefore, growerPlanningProfiles: [profile('sample-only')] };
  assert.equal(saveCropPlan(sample), true);
  assert.deepEqual(loadCropPlan(), sample);
  assert.deepEqual(withoutProfiles(loadCropPlan()), sampleBefore);
  assert.deepEqual([...local.rows.entries()], physicalBefore, 'sample save must not write any physical account row');
  exitSampleMode();
  assert.deepEqual(loadCropPlan(), original);
  assert.equal(enterSampleMode(), true);
  assert.equal(loadCropPlan().growerPlanningProfiles, undefined, 'a new sample session cannot revive the previous session’s inputs');
  exitSampleMode();
  assert.deepEqual(loadCropPlan(), original);
});

test('the sample save path rejects ambiguous or corrupt assumptions before they reach its temporary store', async () => {
  assert.equal(enterSampleMode(), true);
  const sampleBefore = loadCropPlan();
  const duplicate = profile('ambiguous-sample');
  const unique = profile('valid-sample');
  const invalid = { ...profile('bad-unit-sample'), inputs: { ...profile().inputs,
    yieldKgPerM2: { ...provided(0, 'kg/m2/cycle'), unit: 'kg/acre' } } };
  const raw = { ...sampleBefore, growerPlanningProfiles: [duplicate, { ...duplicate, version: 2 }, invalid, unique] };
  // A persistence boundary must retain evidence, not silently delete invalid candidates.
  assert.equal(saveCropPlan(raw as CropPlanState), false);
  assert.deepEqual(getSandboxCropPlan(), sampleBefore, 'rejecting lossy sample input preserves the actual temporary book');
  assert.deepEqual(loadCropPlan(), sampleBefore);
  assert.equal(local.rows.size, 0, 'temporary sample writes cannot create a physical profile ledger');
});

test('corrupt stored profile fields cannot become valid missing/default assumptions or erase unrelated plan content', async () => {
  await initialiseCropPlanFixture();
  const valid = profile('unique-valid');
  const bad = profile('corrupt');
  const corruptions: unknown[] = [
    { ...bad, version: 2 },
    { ...bad, inputs: { ...bad.inputs, plantsPerM2: { ...provided(0, 'plants/m2'), unit: 'plants/acre' } } },
    { ...bad, inputs: { ...bad.inputs, yieldKgPerM2: { ...provided(0, 'kg/m2/cycle'), provenance: { kind: 'verified', recordedAt } } } },
    { ...bad, inputs: { ...bad.inputs, turnaroundDays: { ...provided(0, 'days'), provenance: { kind: 'grower-record', recordedAt } } } },
    { ...bad, inputs: { ...bad.inputs, turnaroundDays: { state: 'missing', reason: 'not-known', value: 0 } } },
    { ...bad, inputs: { ...bad.inputs, nurseryDays: undefined } },
    { ...bad, scope: { ...bad.scope, siteId: 'site:0.00000,0.00000' } },
  ];
  for (const corruption of corruptions) {
    assert.equal(normaliseGrowerPlanningProfile(corruption), null, 'invalid fixture must reach the real rejection rule');
    const raw = { ...legacyPlan(), growerPlanningProfiles: [corruption, valid] };
    const bytes = JSON.stringify(raw);
    replaceCanonicalCropPlanFixtureRaw(bytes);
    assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [valid] });
    assert.equal(readCanonicalCropPlanFixtureRaw(), bytes, 'reading may project safely but cannot mutate saved records');
    // The old true-save assertion encoded destructive cleanup; keep its projection
    // check above, but require the writer to hold and retain every authored byte.
    assert.equal(saveCropPlan(raw as CropPlanState), false);
    assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
  }
  for (const value of [null, {}, 'not-a-profile-list']) {
    replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ ...legacyPlan(), growerPlanningProfiles: value }));
    assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [] });
  }
});

test('duplicate profile identities never choose a winner by array order, scope or whether one duplicate is corrupt', async () => {
  await initialiseCropPlanFixture();
  const original = profile('duplicate');
  const otherScope = { ...original, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' } };
  const corrupt = { ...original, version: 999 };
  const unique = profile('unambiguous');
  for (const duplicates of [[original, original], [original, otherScope], [otherScope, original], [original, corrupt], [corrupt, original]]) {
    const raw = { ...legacyPlan(), growerPlanningProfiles: [...duplicates, unique] };
    const bytes = JSON.stringify(raw);
    replaceCanonicalCropPlanFixtureRaw(bytes);
    assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [unique] });
    assert.equal(saveCropPlan(raw as CropPlanState), false, 'ambiguous source rows must survive rather than be silently discarded');
    assert.equal(readCanonicalCropPlanFixtureRaw(), bytes);
    assert.deepEqual(loadCropPlan(), { ...legacyPlan(), growerPlanningProfiles: [unique] });
  }
});


test('delayed-write tokens are stable for an empty book, account-bound, and unavailable for corrupt storage', async () => {
  await initialiseCropPlanFixture();
  const empty = cropPlanWriteToken();
  assert.equal(typeof empty, 'string');
  loadCropPlan(); loadCropPlan();
  assert.equal(cropPlanWriteToken(), empty, 'loading a missing book must not invent a changed stored revision');
  switchAccount('grower-owner-b');
  assert.notEqual(cropPlanWriteToken(), empty);
  await initialiseCropPlanFixture();
  const key = canonicalCropPlanFixtureKey();
  local.setItem(key, '{broken JSON');
  assert.equal(cropPlanWriteToken(), null);
  assert.equal(local.getItem(key), '{broken JSON', 'checking authority never rewrites corrupt data');
});


test('a write receipt identifies this write even when a synchronous observer stores a newer book', async () => {
  await initialiseCropPlanFixture();
  const first = legacyPlan();
  const newer = { ...legacyPlan(), updatedAt: 500, plantings: [] };
  const observe = () => replaceCanonicalCropPlanFixtureRaw(JSON.stringify(newer));
  browser.addEventListener(CROP_PLAN_CHANGED_EVENT, observe, { once: true });
  const receipt = saveCropPlanWithReceipt(first);
  assert.equal(receipt.saved, true);
  assert.equal(typeof receipt.token, 'string');
  assert.notEqual(receipt.token, cropPlanWriteToken(), 'a later write must not become the earlier writer’s base');
  assert.deepEqual(loadCropPlan(), newer);
  local.failWrite = true;
  assert.deepEqual(saveCropPlanWithReceipt(first), { saved: false, token: null });
  assert.deepEqual(loadCropPlan(), newer);
});
