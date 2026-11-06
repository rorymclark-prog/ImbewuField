import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

// Same technique as tests/user-sync-account-isolation.test.ts: drive the REAL lib/user-sync.ts and
// replace only its Firestore transport + firebase init with an in-memory Map, so the wiring of
// shape sync v2 (subscribeUserMapData `shapeSync` + createShapeSyncTransport) is checked offline.

type StoredDoc = Record<string, unknown>;
const state = {
  docs: new Map<string, StoredDoc>(),
  writes: [] as string[],
  listeners: new Map<string, (snap: unknown) => void>(),
  currentUid: 'farmer' as string | null,
};
Object.assign(globalThis, { __imbewuShapeV2Wiring: state });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const fakeFirestore = moduleUrl(`
const state = globalThis.__imbewuShapeV2Wiring;
export const doc = (_db, ...parts) => parts.join('/');
const snapshot = (ref) => ({ exists: () => state.docs.has(ref), data: () => state.docs.get(ref), metadata: { hasPendingWrites: false } });
export const getDoc = async (ref) => snapshot(ref);
export const setDoc = async (ref, data) => { state.writes.push(ref); state.docs.set(ref, { ...data }); };
export const runTransaction = async (_db, update) => update({
  get: async (ref) => snapshot(ref),
  set: (ref, data) => { state.writes.push(ref); state.docs.set(ref, { ...data }); },
});
export const onSnapshot = (ref, next) => { state.listeners.set(ref, next); return () => state.listeners.delete(ref); };
export const serverTimestamp = () => 'SERVER_TIMESTAMP';
`);
const fakeInit = moduleUrl(`
export const getFirebase = () => ({ db: {}, auth: { currentUser: globalThis.__imbewuShapeV2Wiring.currentUid ? { uid: globalThis.__imbewuShapeV2Wiring.currentUid } : null } });
`);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromUserSync = context.parentURL?.includes('/lib/user-sync.ts') ?? false;
    if (fromUserSync && specifier === 'firebase/firestore') return { url: fakeFirestore, shortCircuit: true };
    if (fromUserSync && specifier === './firebase/init') return { url: fakeInit, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private rows = new Map<string, string>();
  get length() { return this.rows.size; }
  key(i: number) { return [...this.rows.keys()][i] ?? null; }
  getItem(k: string) { return this.rows.get(k) ?? null; }
  setItem(k: string, v: string) { this.rows.set(k, String(v)); }
  removeItem(k: string) { this.rows.delete(k); }
  clear() { this.rows.clear(); }
}
const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage, sessionStorage, dispatchEvent: () => true } });
if (typeof globalThis.CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } } });
}

const { subscribeUserMapData, createShapeSyncTransport } = await import('../lib/user-sync.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
const { createShapeSyncController, shapeSyncKeys } = await import('../lib/shape-sync/controller.ts');
hooks.deregister();

const V1 = 'user_map_data/farmer/data/shapes';
const V2 = 'user_map_data/farmer/data/shapes_v2';
const island = (ids: string[]) => JSON.stringify({ type: 'FeatureCollection', features: ids.map((id, i) => ({
  type: 'Feature', id, properties: { featureType: 'site' },
  geometry: { type: 'Polygon', coordinates: [[[30 + i, -29], [30.001 + i, -29], [30.001 + i, -28.999], [30 + i, -29]]] },
})) });

async function untilReady(handlers: Parameters<typeof subscribeUserMapData>[1]): Promise<() => void> {
  let done!: () => void;
  const ready = new Promise<void>((r) => { done = r; });
  const stop = subscribeUserMapData('farmer', { ...handlers, shapeSync: handlers.shapeSync && { ...handlers.shapeSync, onReady: () => { handlers.shapeSync?.onReady?.(); done(); } } });
  await ready;
  return stop;
}

test('with shapeSync, subscribeUserMapData only READS the v1 document and never overwrites the local v1 cache', async () => {
  state.docs.clear(); state.writes.length = 0; localStorage.clear();
  state.docs.set(V1, { shapesJson: island(['old1', 'old2']), updatedAt: { toMillis: () => 1_700_000_123_000 } });
  const localV1 = accountLocalStorageKey('imbewu_farm_shapes', 'farmer');
  localStorage.setItem(localV1, island(['unpushed-local']));
  const seen: { remote: unknown[]; islands: Array<{ shapesJson: unknown; version: number }>; shapesCalls: number } = { remote: [], islands: [], shapesCalls: 0 };
  const stop = await untilReady({
    onShapes: () => { seen.shapesCalls += 1; },
    shapeSync: { onRemoteState: (raw) => seen.remote.push(raw), onLegacyIsland: (i) => seen.islands.push(i) },
  });
  assert.deepEqual(seen.remote, [null], 'v2 doc absent');
  assert.equal(seen.islands.length, 1);
  assert.equal(seen.islands[0].version, 1_700_000_123_000, 'island ordered by the server commit time');
  assert.equal(seen.shapesCalls, 0, 'the v1 shape path did not run');
  assert.ok(!state.writes.includes(V1), 'v2 never writes the v1 island');
  assert.equal(localStorage.getItem(localV1), island(['unpushed-local']), 'v1 replaced this with the remote copy');
  // Live: island and v2 listeners are attached and deliver to the handlers, read-only.
  state.listeners.get(V1)?.({ exists: () => true, data: () => ({ shapesJson: island(['old1']), updatedAt: { toMillis: () => 1_700_000_999_000 } }), metadata: { hasPendingWrites: false } });
  assert.equal(seen.islands.at(-1)?.version, 1_700_000_999_000);
  assert.ok(state.listeners.has(V2));
  stop();
});

test('createShapeSyncTransport + a real controller: v1 cache and island merge into shapes_v2; nothing is written to the island', async () => {
  state.docs.clear(); state.writes.length = 0; localStorage.clear(); state.currentUid = 'farmer';
  state.docs.set(V1, { shapesJson: island(['old1', 'old2']), updatedAt: { toMillis: () => 1_700_000_123_000 } });
  localStorage.setItem(accountLocalStorageKey('imbewu_farm_shapes', 'farmer'), island(['old1', 'unpushed-local']));
  let n = 0;
  const controller = createShapeSyncController({
    keys: shapeSyncKeys((base) => accountLocalStorageKey(base, 'farmer')),
    storage: localStorage, transport: createShapeSyncTransport('farmer'),
    isCurrent: () => state.currentUid === 'farmer', now: () => 1_700_001_000_000, randomId: () => `t${n++}`,
    schedule: () => () => {},
  });
  controller.start();
  const stop = await untilReady({ shapeSync: {
    onRemoteState: (raw) => controller.receiveRemote(raw),
    onLegacyIsland: (i) => { controller.ingestLegacyIsland(i.shapesJson, i.version); },
  } });
  const report = await controller.flush();
  assert.equal(report.kind, 'committed');
  assert.ok(state.writes.includes(V2), 'shapes committed to the v2 document');
  assert.ok(!state.writes.includes(V1), 'and never to the v1 island (places/water/surveys/design reconcile as before)');
  const doc = state.docs.get(V2) as { protocol: number; stateJson: string; updatedAt: unknown };
  assert.equal(doc.protocol, 2);
  assert.equal(doc.updatedAt, 'SERVER_TIMESTAMP');
  const live = Object.values(JSON.parse(doc.stateJson).records as Record<string, { id: string; live: boolean }>).filter((r) => r.live).map((r) => r.id).sort();
  assert.deepEqual(live, ['old1', 'old2', 'unpushed-local'], 'the reconnect-overwrite loss path is closed');
  // After an account switch the transport refuses before touching Firestore.
  state.currentUid = 'someone-else';
  await assert.rejects(createShapeSyncTransport('farmer').transact(() => ({ write: null, result: 1 })), /account changed/);
  stop();
});
