import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import type { FeatureCollection } from 'geojson';
import type { ShapeSyncController } from '../lib/shape-sync/controller.ts';
import { FakeDraw, MemoryStorage, ids, journalOps, square } from './shape-sync-v2-fakes.ts';

// Production bootstrap/adapter/controller/transport run below. Only Firebase
// SDK/auth and Draw/browser storage are fake. This serial stale-listener case
// does not prove SDK contention, real browser events, persistence or rules.
type StoredDoc = Record<string, unknown>;
type Role = 'A' | 'B';
interface Snapshot {
  exists(): boolean;
  data(): StoredDoc | undefined;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
}
interface Listener { role: Role; ref: string; next: (snapshot: Snapshot) => void; active: boolean }
interface Delivery { listener: Listener; snapshot: Snapshot }
const state = { docs: new Map<string, StoredDoc>(), listeners: new Set<Listener>(), deliveries: [] as Delivery[],
  activeRole: 'A' as Role, clock: 1000, writes: [] as { role: Role; ref: string; method: 'setDoc' | 'transaction' }[],
  transactionReads: [] as { role: Role; ref: string }[] };
const globalKeys = ['window', 'localStorage', 'sessionStorage', '__imbewuProductionBootstrapLoss'] as const;
const originals = new Map(globalKeys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __imbewuProductionBootstrapLoss: state });
const dataModule = (code: string) => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
const fakeFirestore = dataModule(`
  const s=globalThis.__imbewuProductionBootstrapLoss;
  const copy=data=>{if(data===undefined)return undefined;const{updatedAt,...rest}=data;return{...structuredClone(rest),...(updatedAt===undefined?{}:{updatedAt})};};
  const snapshot=ref=>{const captured=copy(s.docs.get(ref));return{exists:()=>captured!==undefined,data:()=>copy(captured),metadata:{fromCache:false,hasPendingWrites:false}};};
  const enqueue=ref=>{for(const listener of s.listeners)if(listener.active&&listener.ref===ref)s.deliveries.push({listener,snapshot:snapshot(ref)});};
  export const doc=(_db,...parts)=>parts.join('/');
  export const getDoc=async ref=>snapshot(ref);
  export const serverTimestamp=()=>{const ms=++s.clock;return{toMillis:()=>ms};};
  export const setDoc=async(ref,value)=>{s.docs.set(ref,copy(value));s.writes.push({role:s.activeRole,ref,method:'setDoc'});enqueue(ref);};
  export const runTransaction=async(_db,run)=>{
    const role=s.activeRole,pending=[];
    const result=await run({get:async ref=>{s.transactionReads.push({role,ref});return snapshot(ref);},
      set:(ref,value)=>pending.push({ref,value:copy(value)}),delete:ref=>pending.push({ref,remove:true})});
    for(const change of pending){if(change.remove)s.docs.delete(change.ref);else s.docs.set(change.ref,change.value);s.writes.push({role,ref:change.ref,method:'transaction'});}
    for(const change of pending)enqueue(change.ref);
    return result;
  };
  // Bootstrap getDoc supplies initial state; this double queues subsequent
  // committed snapshots only, not SDK cache/initial-listener event mechanics.
  export const onSnapshot=(ref,next)=>{const listener={role:s.activeRole,ref,next,active:true};s.listeners.add(listener);
    return()=>{listener.active=false;s.listeners.delete(listener);};};
`);
const fakeInit = dataModule(`
  export const getFirebase=()=>({db:{},auth:{currentUser:{uid:'farmer'}}});
  export const isBackendConfigured=()=>true;
`);
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL?.includes('/lib/user-sync.ts')) {
    if (specifier === 'firebase/firestore') return fakeFirestore;
    if (specifier === './firebase/init') return fakeInit;
  }
  if (context.parentURL?.includes('/lib/account-local-storage.ts') && specifier === './firebase/init') return fakeInit;
  return nextResolve(specifier, context);
} });
const { subscribeUserMapData, createShapeSyncTransport, pushShapes } = await import('../lib/user-sync.ts');
const { accountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { createShapeSyncController, shapeSyncKeys } = await import('../lib/shape-sync/controller.ts');
const { createDrawShapeAdapter } = await import('../lib/shape-sync/draw-adapter.ts');
const { parseRemoteDoc } = await import('../lib/shape-sync/protocol.ts');
hooks.deregister();

const UID = 'farmer', V1 = `user_map_data/${UID}/data/shapes`, V2 = `user_map_data/${UID}/data/shapes_v2`;
const farmKey = accountLocalStorageKey('imbewu_farm_shapes', UID);
interface Client { role: Role; local: MemoryStorage; session: MemoryStorage; draw: FakeDraw }
function client(role: Role): Client { return { role, local: new MemoryStorage(), session: new MemoryStorage(), draw: new FakeDraw() }; }
function use(c: Client) {
  state.activeRole = c.role;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: c.local });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: c.session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: c.local, sessionStorage: c.session, dispatchEvent: () => true,
    addEventListener() {}, removeEventListener() {},
  } });
}
function reset() {
  state.docs.clear(); state.listeners.clear(); state.deliveries = []; state.writes = []; state.transactionReads = [];
  state.clock = 1000; bindMountedAccountLocalStorageUid(UID);
}
function live(doc: StoredDoc | undefined): string[] {
  const parsed = parseRemoteDoc(doc);
  assert.equal(parsed.kind, 'ok');
  return parsed.kind === 'ok' ? Object.values(parsed.state.records).filter(record => record.live).map(record => record.id).sort() : [];
}
function seedLegacyBase() {
  state.docs.set(V1, { shapesJson: JSON.stringify({ type: 'FeatureCollection', features: [square('base', 30, -29)] }),
    updatedAt: { toMillis: () => 1000 } });
}
function deliver(c: Client) {
  use(c);
  const ready = state.deliveries.filter(delivery => delivery.listener.role === c.role);
  state.deliveries = state.deliveries.filter(delivery => delivery.listener.role !== c.role);
  for (const delivery of ready) if (delivery.listener.active) delivery.listener.next(delivery.snapshot);
}
async function openWithDelayedDraw(c: Client) {
  use(c); let serial = 0, presentation = false, drawReady = false;
  let controller!: ShapeSyncController;
  controller = createShapeSyncController({
    keys: shapeSyncKeys(base => accountLocalStorageKey(base, UID)), storage: c.local,
    transport: createShapeSyncTransport(UID), isCurrent: () => true,
    now: () => 1_700_000_000_000, randomId: () => `${c.role}-${++serial}`,
    schedule: () => () => {}, drainLegacyIsland: false,
    onView: reason => {
      if (reason === 'local' || !drawReady) return;
      presentation = true;
      try { c.draw.set(controller.view()); } finally { presentation = false; }
    },
  });
  const failures: string[] = [];
  const adapter = createDrawShapeAdapter({ getController: () => controller, getDraw: () => drawReady ? c.draw : null,
    isPresentation: () => presentation, newShapeId: () => `reticle-${c.role}-${++serial}`,
    onRecordFailure: (result, context) => { failures.push(`${context}:${result.ok ? 'unexpected-ok' : result.reason}`); } });
  controller.start();
  let ready!: () => void, fail!: (error: unknown) => void;
  const bootstrapped = new Promise<void>((resolve, reject) => { ready = resolve; fail = reject; });
  const stop = subscribeUserMapData(UID, { shapeSync: {
    onRemoteState: raw => controller.receiveRemote(raw),
    onLegacyIsland: island => { controller.ingestLegacyIsland(island.shapesJson, island.version); },
    // Same readiness seam as Map: bootstrap reads precede the first flush.
    onReady: () => { void controller.flush().then(() => ready(), fail); },
  } });
  try {
    await bootstrapped;
    // Delayed Draw-readiness fixture: Map's account-reset effect leaves
    // restoredRef false when ensureDraw() is unavailable (~1093), then its
    // separate restoreShapes() poller paints readPaintCollection() (~960/1125).
    // onView alone is insufficient: legacy ingest can publish a local change.
    // This does not cover an already-ready Draw restored empty before ingest.
    drawReady = true; presentation = true;
    try { c.draw.set(controller.view()); } finally { presentation = false; }
  }
  catch (error) { stop(); controller.dispose(); throw error; }
  return { client: c, controller, adapter, failures, stop: () => { stop(); controller.dispose(); adapter.reset(); } };
}

after(() => {
  bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test('adverse original-writer control: stale full-collection writes make the unchanged three-shape assertion fail', async () => {
  reset(); seedLegacyBase();
  const A = client('A'), B = client('B');
  A.draw.add(square('base', 30, -29)); B.draw.add(square('base', 30, -29));
  A.draw.add(square('a', 30.01, -29)); use(A);
  // The retained deprecated pushShapes body is the original blind writer.
  // This control is not a claim to run an entire historical browser bundle.
  await pushShapes(UID, A.draw.getAll());
  B.draw.add(square('b', 30.02, -29)); use(B);
  await pushShapes(UID, B.draw.getAll());
  const final = ids(JSON.parse(state.docs.get(V1)!.shapesJson as string) as FeatureCollection);
  assert.deepEqual(final, ['b', 'base'], 'The missing shape must be A’s undelivered addition, not a setup failure');
  assert.throws(() => assert.deepEqual(final, ['a', 'b', 'base']), { code: 'ERR_ASSERTION' });
  assert.deepEqual(state.writes.map(write => write.method), ['setDoc', 'setDoc']);
});

test('delayed Draw readiness: production bootstrap, typed adapter and transport keep both additions when B’s listener is stale', async () => {
  reset(); seedLegacyBase();
  const legacyBytes = state.docs.get(V1)!.shapesJson;
  const A = await openWithDelayedDraw(client('A'));
  let B: Awaited<ReturnType<typeof openWithDelayedDraw>> | null = null;
  try {
    B = await openWithDelayedDraw(client('B'));
    deliver(A.client); deliver(B.client);
    assert.deepEqual(ids(A.controller.view()), ['base']); assert.deepEqual(ids(B.controller.view()), ['base']);
    assert.deepEqual(ids(A.client.draw.getAll()), ['base']); assert.deepEqual(ids(B.client.draw.getAll()), ['base']);
    assert.ok(state.listeners.size > 0, 'Actual bootstrap must have installed realtime callbacks');
    assert.ok([...state.listeners].some(listener => listener.role === 'B' && listener.ref === V2));

    use(A.client); A.client.draw.add(square('a', 30.01, -29)); A.adapter.recordDrawCreate(['a']);
    assert.deepEqual(journalOps(A.client.local).map(op => [op.kind, op.source, op.shapeId]), [['create', 'draw-create', 'a']]);
    assert.equal((await A.controller.flush()).kind, 'committed');
    assert.deepEqual(live(state.docs.get(V2)), ['a', 'base']);
    assert.ok(state.deliveries.some(delivery => delivery.listener.role === 'B' && delivery.listener.ref === V2
      && live(delivery.snapshot.data()).includes('a')), 'A’s committed snapshot must really be queued for B');
    assert.deepEqual(ids(B.controller.view()), ['base'], 'B has not received A’s listener update');
    assert.deepEqual(ids(B.client.draw.getAll()), ['base']);

    use(B.client); B.client.draw.add(square('b', 30.02, -29)); B.adapter.recordDrawCreate(['b']);
    assert.deepEqual(ids(B.client.draw.getAll()), ['b', 'base'], 'B authors from its genuinely stale display');
    assert.deepEqual(journalOps(B.client.local).map(op => [op.kind, op.source, op.shapeId]), [['create', 'draw-create', 'b']]);
    assert.equal((await B.controller.flush()).kind, 'committed');
    assert.ok(state.transactionReads.some(read => read.role === 'B' && read.ref === V2));
    const final = live(state.docs.get(V2));
    assert.deepEqual(final, ['a', 'b', 'base']);
    assert.deepEqual(A.failures, []); assert.deepEqual(B.failures, []);
    assert.equal(A.controller.status().pending, 0); assert.equal(B.controller.status().pending, 0);
    assert.equal(state.docs.get(V1)!.shapesJson, legacyBytes, 'v2 bootstrap/edits leave the legacy island untouched');
    assert.ok(!state.writes.some(write => write.ref === V1));
    assert.ok(state.writes.filter(write => write.ref === V2).every(write => write.method === 'transaction'));

    deliver(B.client); deliver(A.client);
    assert.deepEqual(ids(A.controller.view()), ['a', 'b', 'base']);
    assert.deepEqual(ids(B.controller.view()), ['a', 'b', 'base']);
    assert.deepEqual(ids(B.client.draw.getAll()), ['a', 'b', 'base']);
    assert.deepEqual(ids(JSON.parse(B.client.local.getItem(farmKey)!)), ['a', 'b', 'base']);
  } finally {
    A.stop(); B?.stop(); state.deliveries = []; state.listeners.clear();
  }
});
