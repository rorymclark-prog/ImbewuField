import { initialiseCropPlanFixture, releaseCropPlanFixture, readCanonicalCropPlanFixtureRaw, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { CROPS } from '../lib/crop-catalog.ts';
import { createWorkspacePlanningReference } from '../lib/international/workspace-context.ts';

const account = { backend: true, uid: 'workspace-a' as string | null };
Object.assign(globalThis, { __workspaceAccountBoundary: account });
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './firebase/init' && context.parentURL?.endsWith('/lib/account-local-storage.ts')) return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent(`
const state=globalThis.__workspaceAccountBoundary;
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
  setItem(key: string, value: string) { if (this.failWrite) throw Error('quota'); this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); this.failWrite = false; }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const browser = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
Object.assign(globalThis, { window: browser, localStorage: local, sessionStorage: session });
const { loadCropPlan, saveCropPlan } = await import('../lib/crop-plan.ts');
const { bindMountedAccountLocalStorageUid, activeAccountLocalStorageKey, accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
const { enterSampleMode, exitSampleMode } = await import('../lib/sample-mode.ts');
hooks.deregister();

const key = 'imbewu_crop_plan_v2';
const reference = createWorkspacePlanningReference('design:local', true, '2026-11-02T12:00:00.000Z')!;
const fixture = (): import('../lib/crop-plan.ts').CropPlanState => ({
  version: 1, plantings: [{ id: 'existing-sowing', bedId: 'own-bed', cropKey: CROPS[0].key, sowMonth: 3 }],
  workspaceReferences: [reference], rainPattern: 'winter', updatedAt: 123,
  nursery: { version: 1, spaces: [{ id: 'bench', siteId: 'design:local', name: 'Own bench', usableM2: 2 }],
    containers: [{ id: 'tray', siteId: 'design:local', name: 'Own container', cells: 20, owned: 0 }],
    profiles: [{ id: 'recipe', siteId: 'design:local', cropKey: CROPS.find(crop => crop.transplant)!.key,
      model: 'measured-tray', containerId: 'tray', usableStartsPerTray: 10, nurseryWeeks: 2 }] },
  harvestTargets: [{ id: 'target', siteId: 'design:local', cropKey: CROPS[0].key, startMonth: '2026-11', endMonth: '2026-12', weeklyKg: 1 }],
  productionRecords: [{ id: 'record', siteId: 'design:local', sourceIconKey: `crop:${CROPS[0].key}`, label: 'Fictional observed production',
    date: { year: 2026, month: 11 }, quantity: 0, unit: 'kg', status: 'actual', pricePerUnit: 0, provenance: 'fictional-example' }],
  preservedProducts: [{ id: 'stock', siteId: 'design:local', sourceIconKey: `crop:${CROPS[0].key}`, label: 'Fictional stock observation',
    method: 'stored', dates: [{ year: 2026, month: 11 }], quantities: [{ year: 2026, month: 11, kg: 0 }],
    provenance: 'fictional-example', note: 'An arithmetic fixture, not a storage-life recommendation.' }],
  planNotes: [{ kind: 'basis', text: 'Keep this saved explanation.' }], planNotesAt: Date.UTC(2026, 10, 1),
});

test.beforeEach(async () => {
  releaseCropPlanFixture();
  exitSampleMode(); local.clear(); session.clear(); account.backend = true; account.uid = 'workspace-a';
  bindMountedAccountLocalStorageUid('workspace-a');
  await initialiseCropPlanFixture();
});
test.after(() => { exitSampleMode(); bindMountedAccountLocalStorageUid(null); Reflect.deleteProperty(globalThis, '__workspaceAccountBoundary'); });

test('reference selection reloads inside the existing plan without losing sowings, nursery settings, records or notes',async()=>{
  const original = fixture();
  assert.equal(saveCropPlan(original), true);
  assert.deepEqual(loadCropPlan(), original);
  assert.equal(local.length, 2, 'one canonical book and its immutable cutover evidence replace the old single-row contract; no separate reference ledger');
  assert.ok(local.rows.has(accountLocalStorageKey(key, 'workspace-a')));
  const next = { ...loadCropPlan(), workspaceReferences: [] };
  assert.equal(saveCropPlan(next), true);
  assert.deepEqual(loadCropPlan(), next);
  assert.deepEqual(next.plantings, original.plantings);
  assert.deepEqual(next.nursery, original.nursery);
});

test('legacy, invalid and coordinate-bound reference data stay unacknowledged while the rest of the saved plan survives',async()=>{
  const { workspaceReferences: _unused, ...legacy } = fixture();
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(legacy));
  assert.deepEqual(loadCropPlan(), legacy);
  const invalid = { ...legacy, workspaceReferences: [{ ...reference, workspaceId: 'site:0.00000,0.00000', localAgronomyApproved: true }] };
  replaceCanonicalCropPlanFixtureRaw(JSON.stringify(invalid));
  assert.deepEqual(loadCropPlan(), { ...legacy, workspaceReferences: [] });
  // Display filtering cannot authorize erasing the invalid authored reference.
  const before = readCanonicalCropPlanFixtureRaw();
  assert.equal(saveCropPlan(invalid as import('../lib/crop-plan.ts').CropPlanState), false);
  assert.equal(readCanonicalCropPlanFixtureRaw(), before);
});

test('account changes and the signed-out guest cannot inherit another account’s reference choice',async()=>{
  assert.equal(saveCropPlan(fixture()), true);
  const accountA = local.getItem(activeAccountLocalStorageKey(key));
  account.uid = 'workspace-b'; bindMountedAccountLocalStorageUid('workspace-b');
  await initialiseCropPlanFixture();
  assert.equal(loadCropPlan().workspaceReferences, undefined);
  const bReference = createWorkspacePlanningReference('virtual-bed', true, '2026-11-03T12:00:00.000Z')!;
  assert.equal(saveCropPlan({ ...fixture(), workspaceReferences: [bReference] }), true);
  account.uid = null; bindMountedAccountLocalStorageUid(null);
  await initialiseCropPlanFixture();
  assert.equal(loadCropPlan().workspaceReferences, undefined);
  assert.equal(saveCropPlan({ ...fixture(), workspaceReferences: [] }), true);
  account.uid = 'workspace-a'; bindMountedAccountLocalStorageUid('workspace-a');
  await initialiseCropPlanFixture();
  assert.equal(local.getItem(activeAccountLocalStorageKey(key)), accountA);
  assert.deepEqual(loadCropPlan().workspaceReferences, [reference]);
});

test('a failed device write leaves the previous plan and acknowledgement intact',async()=>{
  assert.equal(saveCropPlan(fixture()), true);
  const before = local.getItem(activeAccountLocalStorageKey(key));
  local.failWrite = true;
  assert.equal(saveCropPlan({ ...fixture(), workspaceReferences: [] }), false);
  assert.equal(local.getItem(activeAccountLocalStorageKey(key)), before);
  assert.deepEqual(loadCropPlan().workspaceReferences, [reference]);
});

test('sample reference choices stay in the sample sandbox and cannot overwrite real account data',async()=>{
  assert.equal(saveCropPlan(fixture()), true);
  const realRaw = local.getItem(activeAccountLocalStorageKey(key));
  assert.equal(enterSampleMode(), true);
  assert.equal(loadCropPlan().workspaceReferences, undefined);
  const sample = { ...loadCropPlan(), workspaceReferences: [createWorkspacePlanningReference('virtual-bed', true)!] };
  assert.equal(saveCropPlan(sample), true);
  assert.equal(loadCropPlan().workspaceReferences?.[0].workspaceId, 'virtual-bed');
  exitSampleMode();
  assert.equal(local.getItem(activeAccountLocalStorageKey(key)), realRaw);
  assert.deepEqual(loadCropPlan().workspaceReferences, [reference]);
});
