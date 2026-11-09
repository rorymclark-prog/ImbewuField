import { initialiseCropPlanFixture, releaseCropPlanFixture, replaceCanonicalCropPlanFixtureRaw } from './crop-plan-storage-fixture.ts';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import type { GrowerWorkflowSourceKind } from '../lib/international/grower-workflow-source.ts';

class Storage {
  rows = new Map<string, string>(); writes = 0; fail = false; onRead: ((key: string) => void) | null = null;
  get length() { return this.rows.size; }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string) { if (this.fail) throw Error('synthetic unavailable storage'); this.onRead?.(key); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.writes++; this.rows.set(key, String(value)); }
  removeItem(key: string) { this.writes++; this.rows.delete(key); }
  clear() { this.rows.clear(); this.writes = 0; this.fail = false; this.onRead = null; }
}
export const local = new Storage(), session = new Storage();
export const events = Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session });
export const probe = { actor: 'owner-a' as string | null, configured: true, queries: 0, initThrows: false, initCalls: 0,
  cloud: async (): Promise<unknown[]> => [], auth: new Set<(user: { uid: string } | null) => void>() };
const original = new Map(['window', 'localStorage', 'sessionStorage', 'Storage', 'crypto', '__growerOperationsFixture', 'IS_REACT_ACT_ENVIRONMENT']
  .map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const nativeCrypto = globalThis.crypto;
Object.assign(globalThis, { window: events, localStorage: local, sessionStorage: session, Storage,
  __growerOperationsFixture: probe, IS_REACT_ACT_ENVIRONMENT: true });
const data = (source: string) => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(source) });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.endsWith('/firebase/init')) return data(`export const isBackendConfigured=()=>globalThis.__growerOperationsFixture.configured;
    export const getFirebase=()=>{const p=globalThis.__growerOperationsFixture;p.initCalls++;if(p.initThrows)throw Error('synthetic Firebase initialization failure');
      return p.configured?{auth:{get currentUser(){const id=p.actor;return id?{uid:id}:null;}}}:null;};`);
  if (context.parentURL?.endsWith('/lib/international/grower-operations-source.ts') && specifier === '../db/queries') return data(`
    export async function myDesigns(){const p=globalThis.__growerOperationsFixture;p.queries++;return p.cloud();}`);
  // The eager operations hook loads field-journal and its preference authority
  // before leaf suites install hooks. Both observers need this same fake Auth
  // service; the real SDK cannot subscribe to a currentUser-only fixture object.
  if (specifier === 'firebase/auth' && (context.parentURL?.endsWith('/components/crops/useGrowerOperations.ts')
    || context.parentURL?.endsWith('/lib/length-unit-preference.ts'))) return data(`
    export function onAuthStateChanged(_auth,callback){const p=globalThis.__growerOperationsFixture;p.auth.add(callback);return()=>p.auth.delete(callback);}`);
  return next(specifier, context);
} });
export const crop = await import('../lib/crop-plan.ts');
export const account = await import('../lib/account-local-storage.ts');
export const samples = await import('../lib/sample-mode.ts');
export const core = await import('../lib/international/grower-operations-source.ts');
export const { useGrowerOperations } = await import('../components/crops/useGrowerOperations.ts');
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } = await import('../lib/international/grower-workflow-source.ts');
const { generateGrowerAutoPlan } = await import('../lib/international/grower-autoplan.ts');
const { createGrowerCyclePlanting } = await import('../lib/international/grower-cycle.ts');
const { CROPS } = await import('../lib/crop-catalog.ts');
export const siteId = 'site:0.00000,0.00000', stamp = '2026-11-04T12:00:00.000Z';
export const bookKey = () => account.activeAccountLocalStorageKey('imbewu_crop_plan_v2');
export const studioKey = () => account.activeAccountLocalStorageKey(`imbewu_design_canvas_${siteId}`);
export const localKey = () => account.activeAccountLocalStorageKey('imbewu_facilitator_design_v1');
export function studio() {
  return { siteId, frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
    items: [{ id: 'bed-a', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4, rot: 0 }], zones: [], lines: [], step: 'planting', updatedAt: stamp, rev: 1 };
}
export function facilitator(mapped = false) {
  return { version: 1, geomVersion: 2, designId: 'owned-design', pxPerM: 10, savedAt: 1, activeLayer: 'planting', hiddenLayers: [],
    items: [{ id: 'bed-a', type: 'bed', x: 10, y: 10, xM: 1, yM: 1, wM: 2, hM: 4, rotation: 0 }], lines: [], sectors: [],
    ...(mapped ? { bgSite: { lat: 0, lon: 0, name: 'Synthetic site' } } : {}) };
}
export const cloud = (mapped = false) => ({ id: 'owned-design', owner_id: 'owner-a', data: facilitator(mapped) });
export async function ownRow(raw: unknown = studio(), kind: GrowerWorkflowSourceKind = 'studio-canvas', sourceId = siteId, plantingId = 'own-row') {
  const source = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({ kind, sourceId, raw, sourceRevision: JSON.stringify(raw) }));
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('fixture source held');
  const own = <T, U extends string>(value: T, unit: U) => ({ state: 'provided' as const, value, unit, provenance: { kind: 'grower-estimate' as const, recordedAt: stamp } });
  const profile = { version: 1 as const, profileId: 'own-estimate', cropKey: CROPS[0].key, scope: source.scope, inputs: {
    plantsPerM2: own(1, 'plants/m2'), yieldKgPerM2: own(2, 'kg/m2/cycle'), establishment: own('direct' as const, 'method'),
    nurseryDays: { state: 'missing' as const, reason: 'not-applicable' as const }, fieldEntryToFirstHarvestDays: own(2, 'days'), pickingDays: own(2, 'days'),
    fieldOccupancyDays: own(4, 'days'), turnaroundDays: own(1, 'days'), allowedEntryMonths: own([12], 'utc-months') } };
  const proposal = generateGrowerAutoPlan({ requestedAt: stamp, scope: source.scope, geometryFingerprint: source.geometryFingerprint,
    profiles: [profile], beds: source.beds.map(bed => ({ bed, scope: source.scope, measuredAreaM2: own(bed.areaM2, 'm2') })),
    planningStart: own('2028-12-01', 'utc-date'), planningEndExclusive: own('2029-01-01', 'utc-date'),
    availability: source.beds.map(bed => ({ bedId: bed.id, scope: source.scope, window: own({ start: '2028-12-01', endExclusive: '2029-01-01' }, 'utc-date-window') })),
    reserved: [], demands: [{ demandId: 'own-demand', profileId: profile.profileId, scope: source.scope, totalKg: own(1, 'kg-total'),
      harvestWindow: own({ start: '2028-12-10', endExclusive: '2028-12-12' }, 'utc-date-window') }], maxAssessments: 1000 });
  assert.equal(proposal.status, 'ready');
  const row = createGrowerCyclePlanting(proposal.cycles[0], { plantingId, acceptedAt: stamp, geometryFingerprint: source.geometryFingerprint });
  assert.ok(row); return { row, source };
}
export function store(rows: unknown[]) { replaceCanonicalCropPlanFixtureRaw(JSON.stringify({ version: 1, plantings: rows, updatedAt: 1, notes: 'Preserve raw book metadata' })); }
export async function reset() {
  releaseCropPlanFixture();
  probe.initThrows = false;
  samples.exitSampleMode(); local.clear(); session.clear(); account.bindMountedAccountLocalStorageUid('owner-a');
  probe.actor = 'owner-a'; probe.configured = true; probe.queries = 0; probe.initCalls = 0; probe.cloud = async () => [];
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: nativeCrypto });
  await initialiseCropPlanFixture();
}
export function cleanup() {
  releaseCropPlanFixture();
  probe.initThrows = false;
  samples.exitSampleMode(); hooks.deregister(); account.bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of original) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
}
export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
export function pauseHashes() {
  const gate = deferred<void>(), started = deferred<void>();
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { subtle: { async digest(algorithm: AlgorithmIdentifier, bytes: BufferSource) {
    started.resolve(); await gate.promise; return nativeCrypto.subtle.digest(algorithm, bytes);
  } } } });
  return { started: started.promise, resume() { gate.resolve(); } };
}
