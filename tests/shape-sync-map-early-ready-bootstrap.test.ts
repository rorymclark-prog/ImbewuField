import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import type { Feature, FeatureCollection } from 'geojson';
import type { ShapeSyncController, ShapeSyncStatus } from '../lib/shape-sync/controller.ts';
import type { DrawShapeAdapter } from '../lib/shape-sync/draw-adapter.ts';
import { FakeDraw, MemoryStorage, ids, journalOps, moved, square } from './shape-sync-v2-fakes.ts';
import { MAP_PATH, SEAMS, bind } from './map-source-seams.ts';

// B1 — an ALREADY-READY Draw restored empty before the legacy-only bootstrap.
//
// What runs for real: the production subscribeUserMapData bootstrap and listeners, the shape-sync
// controller, the Draw adapter and the Firestore transport, plus these Map.tsx seams extracted
// verbatim (tests/map-source-seams.ts): the controller effect (its onView, onLegacyIsland and onReady
// handlers), the account-reset effect, readPaintCollection, restoreShapes, redrawShapesFromStorage,
// the end-native-edit and deferred-redraw effects, the adapter options, newSyncId and FARM_KEY.
// What is fake or modelled: the Firebase SDK and auth (in-memory, same style as
// shape-sync-production-bootstrap-loss.test.ts), Mapbox Draw (FakeDraw + getMode), browser storage,
// React (hooks replayed in Map's definition order: cleanups, then bodies) and ensureDraw/recompute
// (recompute is stats-only in Map; ensureDraw is "a Draw exists once the map exists"). Farmer
// gestures are replayed as the same adapter calls and state setters Map's handlers make. This is
// SOURCE-SEAM proof, not the integrated component in a browser.
//
// The first flush is never allowed to succeed immediately in the B1 cases: the v2 transaction read
// either hangs (unresolved) or fails as the SDK does offline (code 'unavailable').
// Red control: MAP_TSX=<baseline Map.tsx> or the baseline tree (see the package README).

type StoredDoc = Record<string, unknown>;
interface Snapshot { exists(): boolean; data(): StoredDoc | undefined; metadata: { fromCache: boolean; hasPendingWrites: boolean } }
interface Listener { ref: string; next: (snapshot: Snapshot) => void; active: boolean }
const state = {
  docs: new Map<string, StoredDoc>(), listeners: new Set<Listener>(), deliveries: [] as { listener: Listener; snapshot: Snapshot }[],
  clock: 1000, currentUid: null as string | null, reads: [] as string[], transactionReads: [] as string[],
  writes: [] as { ref: string; method: 'setDoc' | 'transaction' }[],
  /** How the shapes_v2 transaction read behaves: answer, hang until released, or fail offline. */
  v2: 'open' as 'open' | 'hang' | 'offline', v2Waiters: [] as (() => void)[],
  /** getDoc refs held until a test releases them (orders the bootstrap against farmer gestures). */
  held: new Map<string, { gate: Promise<void>; release: () => void }>(),
};
const globalKeys = ['window', 'localStorage', 'sessionStorage', '__imbewuMapEarlyReady'] as const;
const originals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { __imbewuMapEarlyReady: state });
const dataModule = (code: string) => ({ url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true });
const fakeFirestore = dataModule(`
  const s=globalThis.__imbewuMapEarlyReady;
  const copy=data=>{if(data===undefined)return undefined;const{updatedAt,...rest}=data;return{...structuredClone(rest),...(updatedAt===undefined?{}:{updatedAt})};};
  const snapshot=ref=>{const captured=copy(s.docs.get(ref));return{exists:()=>captured!==undefined,data:()=>copy(captured),metadata:{fromCache:false,hasPendingWrites:false}};};
  const enqueue=ref=>{for(const listener of s.listeners)if(listener.active&&listener.ref===ref)s.deliveries.push({listener,snapshot:snapshot(ref)});};
  export const doc=(_db,...parts)=>parts.join('/');
  export const getDoc=async ref=>{s.reads.push(ref);const hold=s.held.get(ref);if(hold)await hold.gate;return snapshot(ref);};
  export const serverTimestamp=()=>{const ms=++s.clock;return{toMillis:()=>ms};};
  export const setDoc=async(ref,value)=>{s.docs.set(ref,copy(value));s.writes.push({ref,method:'setDoc'});enqueue(ref);};
  export const runTransaction=async(_db,run)=>{
    const pending=[];
    const result=await run({get:async ref=>{
        s.transactionReads.push(ref);
        if(ref.endsWith('/data/shapes_v2')){
          if(s.v2==='hang')await new Promise(resolve=>s.v2Waiters.push(resolve));
          else if(s.v2==='offline')throw Object.assign(new Error('Failed to get document because the client is offline.'),{name:'FirebaseError',code:'unavailable'});
        }
        return snapshot(ref);},
      set:(ref,value)=>pending.push({ref,value:copy(value)}),delete:ref=>pending.push({ref,remove:true})});
    for(const change of pending){if(change.remove)s.docs.delete(change.ref);else s.docs.set(change.ref,change.value);s.writes.push({ref:change.ref,method:'transaction'});}
    for(const change of pending)enqueue(change.ref);
    return result;
  };
  export const onSnapshot=(ref,next)=>{const listener={ref,next,active:true};s.listeners.add(listener);
    return()=>{listener.active=false;s.listeners.delete(listener);};};
`);
const fakeInit = dataModule(`
  const s=globalThis.__imbewuMapEarlyReady;
  export const getFirebase=()=>({db:{},auth:{currentUser:s.currentUid?{uid:s.currentUid}:null}});
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
const { subscribeUserMapData, createShapeSyncTransport } = await import('../lib/user-sync.ts');
const { accountLocalStorageKey, activeAccountLocalStorageKey, activeAccountUid, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { isSampleMode } = await import('../lib/sample-mode.ts');
const { createShapeSyncController, shapeSyncKeys, shapeSyncNotice } = await import('../lib/shape-sync/controller.ts');
const { createDrawShapeAdapter } = await import('../lib/shape-sync/draw-adapter.ts');
const { parseRemoteDoc } = await import('../lib/shape-sync/protocol.ts');
hooks.deregister();
// Map imports getFirebase from '@/lib/firebase/init'; this is the same fake auth the bootstrap sees.
const getFirebase = () => ({ db: {}, auth: { currentUser: state.currentUid ? { uid: state.currentUid } : null } });

const UID = 'farmer', OTHER = 'farmer-b';
const v1Ref = (uid: string) => `user_map_data/${uid}/data/shapes`;
const v2Ref = (uid: string) => `user_map_data/${uid}/data/shapes_v2`;
const FARM_KEY = bind<string>(SEAMS.farmKey(), {});
const newSyncId = bind<() => string>(SEAMS.newSyncId(), {});

type SyncHandlers = Parameters<typeof subscribeUserMapData>[1];
interface Subscription { uid: string; handlers: SyncHandlers; calls: string[] }
interface Ref<T> { current: T }

class ModalDraw extends FakeDraw {
  mode = 'simple_select';
  sets: { ids: string[]; presentation: boolean }[] = [];
  private readonly presentation: () => boolean;
  constructor(presentation: () => boolean) { super(); this.presentation = presentation; }
  getMode(): string { return this.mode; }
  changeMode(mode: string): void { this.mode = mode; }
  set(fc: FeatureCollection): unknown { this.sets.push({ ids: ids(fc), presentation: this.presentation() }); return super.set(fc); }
}

/** Map's refs, the state that its shape effects depend on, and its hooks replayed in source order. */
class MapHarness {
  readonly shapeSyncRef: Ref<ShapeSyncController | null> = { current: null };
  readonly shapeAdapterRef: Ref<DrawShapeAdapter | null> = { current: null };
  readonly drawRef: Ref<ModalDraw | null> = { current: null };
  readonly restoredRef = { current: false };
  readonly tearingDownRef = { current: false };
  readonly applyingRemoteRef = { current: false };
  readonly pendingRemoteRedrawRef = { current: false };
  readonly reticleSessionRef: Ref<unknown> = { current: null };
  readonly propertyEditRef: Ref<unknown> = { current: null };
  readonly redrawRef: Ref<() => void> = { current: () => {} };
  user: { uid: string } | null;
  editingFeatureId: string | null = null;
  pinDraw: null | 'site' | 'water' = null;
  editPin: null | { id: string; type: 'site' | 'water' } = null;
  shapeConflicts: unknown[] = [];
  shapeSyncStatus: ShapeSyncStatus | null = null;
  mapReady: boolean;
  readonly draw: ModalDraw;
  readonly subscriptions: Subscription[] = [];
  readonly recordFailures: unknown[][] = [];
  recomputes = 0;
  private restoreShapes: (() => void) | null = null;
  private redraw: (() => void) | null = null;
  private redrawDeps: unknown[] | null = null;
  private effectDeps = { editing: undefined as unknown, redraw: null as unknown, uid: undefined as unknown };
  private controllerCleanup: (() => void) | null = null;
  private committing = false;
  private dirty = false;

  constructor(opts: { uid: string | null; mapReady: boolean }) {
    this.user = opts.uid ? { uid: opts.uid } : null;
    this.mapReady = opts.mapReady;
    this.draw = new ModalDraw(() => this.applyingRemoteRef.current);
    const failures = this.recordFailures;
    // Render-time `if (!shapeAdapterRef.current) shapeAdapterRef.current = createDrawShapeAdapter({…})`.
    this.shapeAdapterRef.current = createDrawShapeAdapter(bind(SEAMS.adapterOptions(), {
      shapeSyncRef: this.shapeSyncRef, drawRef: this.drawRef, applyingRemoteRef: this.applyingRemoteRef,
      tearingDownRef: this.tearingDownRef, newSyncId, console: { error: (...args: unknown[]) => failures.push(args) },
    }));
    this.render();
    this.commit();
  }

  // Modelled hooks (not extracted): Mapbox-specific creation and stats.
  readonly ensureDraw = (): ModalDraw | null => {
    if (!this.mapReady) return null;
    if (!this.drawRef.current) { this.tearingDownRef.current = false; this.drawRef.current = this.draw; }
    return this.drawRef.current;
  };
  readonly recompute = () => { if (this.drawRef.current) this.recomputes += 1; };
  private setter<K extends 'editingFeatureId' | 'pinDraw' | 'editPin' | 'shapeConflicts' | 'shapeSyncStatus'>(key: K) {
    return (value: this[K] | ((prev: this[K]) => this[K])) => {
      const next = typeof value === 'function' ? (value as (prev: this[K]) => this[K])(this[key]) : value;
      if (Object.is(next, this[key])) return; // React bails out of an identical update
      this[key] = next;
      if (this.committing) this.dirty = true; else { this.render(); this.commit(); }
    };
  }
  readonly setEditingFeatureId = this.setter('editingFeatureId');
  readonly setPinDraw = this.setter('pinDraw');
  readonly setEditPin = this.setter('editPin');
  readonly setShapeConflicts = this.setter('shapeConflicts');
  readonly setShapeSyncStatus = this.setter('shapeSyncStatus');

  private readPaintCollection() {
    return bind<() => FeatureCollection | null>(SEAMS.readPaintCollection(), {
      shapeSyncRef: this.shapeSyncRef, localStorage: globalThis.localStorage, activeAccountLocalStorageKey, FARM_KEY,
    });
  }
  /** One render: rebuild closures exactly where Map's useCallback deps would. */
  private render(): void {
    const readPaintCollection = this.readPaintCollection();
    this.restoreShapes ??= bind(SEAMS.restoreShapes(), { // deps [ensureDraw, recompute]: stable
      restoredRef: this.restoredRef, ensureDraw: this.ensureDraw, readPaintCollection,
      applyingRemoteRef: this.applyingRemoteRef, recompute: this.recompute,
    });
    const deps = [this.editingFeatureId, this.pinDraw, this.editPin];
    if (!this.redrawDeps || deps.some((d, i) => !Object.is(d, this.redrawDeps![i]))) {
      this.redraw = bind(SEAMS.redrawShapesFromStorage(), {
        ensureDraw: this.ensureDraw, editingFeatureId: this.editingFeatureId, pinDraw: this.pinDraw, editPin: this.editPin,
        pendingRemoteRedrawRef: this.pendingRemoteRedrawRef, readPaintCollection, applyingRemoteRef: this.applyingRemoteRef,
        restoredRef: this.restoredRef, recompute: this.recompute,
      });
      this.redrawDeps = deps;
    }
    this.redrawRef.current = this.redraw!; // `redrawRef.current = redrawShapesFromStorage;` runs every render
  }
  /** Effects in Map's definition order. All changed effects' cleanups run before any body. */
  private commit(): void {
    this.committing = true;
    try {
      const uid = this.user?.uid ?? null;
      const runEditing = !Object.is(this.effectDeps.editing, this.editingFeatureId) || this.effectDeps.editing === undefined;
      const runDeferred = this.effectDeps.redraw !== this.redraw;
      const runAccount = this.effectDeps.uid === undefined || !Object.is(this.effectDeps.uid, uid);
      if (runAccount && this.controllerCleanup) { const c = this.controllerCleanup; this.controllerCleanup = null; c(); }
      if (runEditing) bind<() => void>(SEAMS.endNativeEditEffect(), { editingFeatureId: this.editingFeatureId, shapeAdapterRef: this.shapeAdapterRef })();
      if (runDeferred) bind<() => void>(SEAMS.deferredRedrawEffect(), {
        editingFeatureId: this.editingFeatureId, pinDraw: this.pinDraw, editPin: this.editPin,
        pendingRemoteRedrawRef: this.pendingRemoteRedrawRef, redrawShapesFromStorage: this.redraw,
      })();
      if (runAccount) {
        this.controllerCleanup = bind<() => () => void>(SEAMS.controllerEffect(), {
          user: this.user, isSampleMode, shapeSyncKeys, accountLocalStorageKey, activeAccountLocalStorageKey, activeAccountUid,
          getFirebase, createShapeSyncController, window: globalThis.window, createShapeSyncTransport, newSyncId,
          redrawRef: this.redrawRef, setShapeConflicts: this.setShapeConflicts, setShapeSyncStatus: this.setShapeSyncStatus,
          shapeSyncRef: this.shapeSyncRef, subscribeUserMapData: this.subscribeSpy, CustomEvent,
          shapeAdapterRef: this.shapeAdapterRef, reticleSessionRef: this.reticleSessionRef, propertyEditRef: this.propertyEditRef,
        })();
        bind<() => void>(SEAMS.accountResetEffect(), {
          pendingRemoteRedrawRef: this.pendingRemoteRedrawRef, shapeAdapterRef: this.shapeAdapterRef,
          reticleSessionRef: this.reticleSessionRef, propertyEditRef: this.propertyEditRef,
          setEditingFeatureId: this.setEditingFeatureId, setPinDraw: this.setPinDraw, setEditPin: this.setEditPin,
          ensureDraw: this.ensureDraw, restoredRef: this.restoredRef, readPaintCollection: this.readPaintCollection(),
          applyingRemoteRef: this.applyingRemoteRef, recompute: this.recompute,
        })();
      }
      this.effectDeps = { editing: this.editingFeatureId, redraw: this.redraw, uid };
    } finally { this.committing = false; }
    if (this.dirty) { this.dirty = false; this.render(); this.commit(); }
  }
  /** Pass-through spy: Map's own handlers run unchanged; only their invocations are recorded. */
  private readonly subscribeSpy = (uid: string, handlers: SyncHandlers) => {
    const record: Subscription = { uid, handlers, calls: [] };
    this.subscriptions.push(record);
    const wrap = <A extends unknown[], R>(name: string, fn: ((...a: A) => R) | undefined) =>
      fn && ((...a: A) => { record.calls.push(name); return fn(...a); });
    const sync = handlers.shapeSync;
    return subscribeUserMapData(uid, { ...handlers, onPlaces: wrap('onPlaces', handlers.onPlaces), onWater: wrap('onWater', handlers.onWater),
      shapeSync: sync && { onRemoteState: wrap('onRemoteState', sync.onRemoteState)!, onLegacyIsland: wrap('onLegacyIsland', sync.onLegacyIsland)!,
        onReady: wrap('onReady', sync.onReady) } });
  };
  /** The restore poller's tick once mapRef.current.getMap() exists (Map ~1130–1142). */
  pollTick(): void { if (this.mapReady) this.restoreShapes!(); }
  switchAccount(uid: string | null): void {
    state.currentUid = uid; bindMountedAccountLocalStorageUid(uid);
    this.user = uid ? { uid } : null; this.render(); this.commit();
  }
  unmount(): void { this.controllerCleanup?.(); this.controllerCleanup = null; }
  get controller(): ShapeSyncController { assert.ok(this.shapeSyncRef.current, 'a controller must exist'); return this.shapeSyncRef.current; }
  get adapter(): DrawShapeAdapter { return this.shapeAdapterRef.current!; }
  sub(uid = UID): Subscription { const s = this.subscriptions.find((r) => r.uid === uid); assert.ok(s, `subscribeUserMapData(${uid}) must have been called`); return s; }
  // Farmer gestures: the same adapter calls / setters Map's handlers make (Map.tsx line refs are the PATCHED file).
  nativeDrawCreate(f: Feature): void { this.draw.add(f); this.adapter.recordDrawCreate([String(f.id)]); this.recompute(); }   // ~847–873
  startNativeEdit(id: string): void { this.draw.changeMode('direct_select'); this.adapter.beginNativeEdit(id); this.setEditingFeatureId(id); } // ~1419–1427
  nativeVertexDrag(f: Feature): void { this.draw.add(f); this.adapter.recordDrawUpdate([f]); this.recompute(); } // draw.update ~888–891
  exitNativeEdit(): void { this.draw.changeMode('simple_select'); this.setEditingFeatureId(null); } // draw.modechange ~918–920
  startReticle(type: 'site' | 'water'): void { this.setEditingFeatureId(null); this.setPinDraw(type); } // ~1236–1238
  finishReticle(f: Feature): string | null { const id = this.adapter.addNewShape(f, 'reticle-create'); this.setPinDraw(null); this.recompute(); return id; } // ~1348–1352
}

function storageWindow(local: MemoryStorage, session: MemoryStorage) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: local, sessionStorage: session, dispatchEvent: () => true, addEventListener() {}, removeEventListener() {},
  } });
}
function fresh(v2: typeof state.v2, uid: string | null = UID): { local: MemoryStorage; session: MemoryStorage } {
  state.docs.clear(); state.listeners.clear(); state.deliveries = []; state.writes = []; state.reads = []; state.transactionReads = [];
  state.clock = 1000; state.v2 = v2; state.v2Waiters = []; state.held.clear(); state.currentUid = uid;
  bindMountedAccountLocalStorageUid(uid);
  const local = new MemoryStorage(), session = new MemoryStorage();
  storageWindow(local, session);
  return { local, session };
}
function seedIsland(uid: string, features: Feature[], ms = 1000): void {
  state.docs.set(v1Ref(uid), { shapesJson: JSON.stringify({ type: 'FeatureCollection', features }), updatedAt: { toMillis: () => ms } });
}
function hold(ref: string): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  state.held.set(ref, { gate, release });
  return () => { state.held.delete(ref); release(); };
}
function releaseV2(): void { state.v2 = 'open'; for (const resolve of state.v2Waiters.splice(0)) resolve(); }
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (condition()) return; await new Promise((r) => setImmediate(r)); }
  assert.fail(`timed out waiting for: ${what}`);
}
function deliverAll(): void {
  const ready = state.deliveries.splice(0);
  for (const d of ready) if (d.listener.active) d.listener.next(d.snapshot);
}
function live(doc: StoredDoc | undefined): string[] {
  const parsed = parseRemoteDoc(doc);
  assert.equal(parsed.kind, 'ok');
  return parsed.kind === 'ok' ? Object.values(parsed.state.records).filter((r) => r.live).map((r) => r.id).sort() : [];
}
const ops = (local: MemoryStorage, uid = UID) => journalOps(local, uid).map((op) => [op.kind, op.source, op.shapeId]);
const BASE = square('base', 30, -29);
const EARLY_READY = 'early-ready Draw must show the legacy base the bootstrap ingested (baseline: ingest publishes \'local\', which onView skips)';

after(() => {
  bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
  }
});

test(`source fit: seams extracted from ${MAP_PATH.split('/').slice(-3).join('/')}`, () => {
  for (const [name, get] of Object.entries(SEAMS)) assert.ok(get().length > 0, name);
  assert.equal(FARM_KEY, 'imbewu_farm_shapes');
});

test('B1 early-ready Draw + UNRESOLVED first flush: the bootstrap’s legacy base is painted while the flush is still pending', async () => {
  const { local } = fresh('hang'); seedIsland(UID, [BASE]);
  const legacyBytes = state.docs.get(v1Ref(UID))!.shapesJson;
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    // Precondition that defines the early-ready case: Draw existed at mount and was restored EMPTY.
    assert.equal(h.restoredRef.current, true);
    assert.ok(h.draw.sets.length > 0 && h.draw.sets.every((s) => s.ids.length === 0 && s.presentation));
    assert.deepEqual(state.reads, [], 'restore happened before any bootstrap read');
    await until(() => h.sub().calls.includes('onReady') && state.v2Waiters.length > 0, 'first flush hung on the v2 read');

    assert.deepEqual(h.sub().calls.filter((c) => c !== 'onPlaces' && c !== 'onWater'), ['onRemoteState', 'onLegacyIsland', 'onReady']);
    assert.deepEqual(ids(h.controller.view()), ['base'], 'controller.view() holds the ingested base');
    assert.deepEqual(ops(local), [['legacy', 'legacy-island', 'base']]);
    assert.equal(h.controller.status().pending, 1);
    assert.equal(h.controller.status().flushing, true, 'the first flush is genuinely unresolved');
    assert.equal(state.docs.has(v2Ref(UID)), false, 'nothing committed');
    assert.deepEqual(ids(h.draw.getAll()), ['base'], EARLY_READY);
    assert.equal(h.draw.sets.at(-1)!.presentation, true, 'the repaint is marked as presentation for the adapter');
    assert.deepEqual(h.recordFailures, []);
    assert.deepEqual(shapeSyncNotice(h.shapeSyncStatus), { level: 'info', text: '1 change(s) syncing…', offerBackup: false });

    // The network answers later: the commit lands and the display stays correct.
    releaseV2();
    await until(() => state.docs.has(v2Ref(UID)) && !h.controller.status().flushing, 'commit after release');
    assert.deepEqual(live(state.docs.get(v2Ref(UID))), ['base']);
    assert.equal(h.controller.status().pending, 0);
    assert.deepEqual(ids(h.draw.getAll()), ['base']);
    assert.equal(state.docs.get(v1Ref(UID))!.shapesJson, legacyBytes, 'legacy island untouched (drainLegacyIsland: false)');
    assert.ok(!state.writes.some((w) => w.ref === v1Ref(UID)));
  } finally { h.unmount(); }
});

test('B1 early-ready Draw + OFFLINE first flush (transaction read fails "unavailable"): base painted, honest pending notice, nothing committed', async () => {
  const { local } = fresh('offline'); seedIsland(UID, [BASE]);
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => h.sub().calls.includes('onReady') && h.controller.status().lastError !== null, 'first flush failed offline');
    assert.match(h.controller.status().lastError!, /offline/);
    assert.deepEqual(ops(local), [['legacy', 'legacy-island', 'base']]);
    assert.equal(state.docs.has(v2Ref(UID)), false);
    assert.deepEqual(ids(h.draw.getAll()), ['base'], EARLY_READY);
    assert.deepEqual(shapeSyncNotice(h.shapeSyncStatus), { level: 'info', text: '1 change(s) waiting to sync (offline?).', offerBackup: false });
  } finally { h.unmount(); }
});

test('B1 supplementary: even a first flush that COMMITS does not repaint on its own (adopt of unchanged content publishes \'local\')', async () => {
  fresh('open'); seedIsland(UID, [BASE]);
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => state.docs.has(v2Ref(UID)) && !h.controller.status().flushing, 'first commit');
    assert.deepEqual(live(state.docs.get(v2Ref(UID))), ['base']);
    assert.deepEqual(ids(h.draw.getAll()), ['base'], EARLY_READY);
  } finally { h.unmount(); }
});

test('safety control (passes before and after): no local authoring echo, and no repaint when an island snapshot adds nothing new', async () => {
  const { local } = fresh('hang'); seedIsland(UID, [BASE]);
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => h.sub().calls.includes('onReady') && state.v2Waiters.length > 0, 'first flush hung');
    const paints = h.draw.sets.length;
    h.nativeDrawCreate(square('a', 30.01, -29));
    assert.deepEqual(ops(local), [['legacy', 'legacy-island', 'base'], ['create', 'draw-create', 'a']]);
    assert.deepEqual(ids(h.controller.view()), ['a', 'base']);
    assert.equal(h.draw.sets.length, paints, 'a local authoring change is never repainted (onView \'local\' stays skipped)');
    h.startReticle('site');
    const { id: _none, ...reticleShape } = square('unused', 30.04, -29);
    const rid = h.finishReticle(reticleShape as Feature);
    assert.ok(rid && rid.startsWith('shp-'));
    assert.equal(h.draw.sets.length, paints, 'a reticle-created shape is not repainted either (nothing was deferred)');
    // (Whether 'base' is on the Draw is the early-ready question above; this case only checks echoes.)
    assert.ok(['a', rid].every((id) => ids(h.draw.getAll()).includes(id)), 'the farmer’s own shapes stay on the Draw');
    assert.deepEqual(ids(h.controller.view()), ['a', 'base', rid].sort());
    // The realtime island listener re-delivers the SAME island (e.g. a metadata-only snapshot).
    assert.ok([...state.listeners].some((l) => l.ref === v1Ref(UID)), 'the production island listener is attached');
    state.docs.set(v1Ref(UID), { ...state.docs.get(v1Ref(UID))! });
    for (const l of state.listeners) if (l.ref === v1Ref(UID)) l.next({ exists: () => true, data: () => state.docs.get(v1Ref(UID)), metadata: { fromCache: false, hasPendingWrites: false } });
    assert.equal(h.sub().calls.filter((c) => c === 'onLegacyIsland').length, 2);
    assert.equal(h.draw.sets.length, paints, 'an ingest that adds no op does not repaint');
    assert.deepEqual(ops(local), [['legacy', 'legacy-island', 'base'], ['create', 'draw-create', 'a'], ['create', 'reticle-create', rid]]);
    assert.deepEqual(h.recordFailures, []);
  } finally { h.unmount(); }
});

test('B1 native vertex edit in progress when the island arrives: repaint deferred, then applied without losing the edit', async () => {
  const { local } = fresh('hang'); seedIsland(UID, [BASE]);
  const releaseIsland = hold(v1Ref(UID));
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => state.reads.includes(v1Ref(UID)), 'bootstrap waiting on the island read');
    const a = square('a', 30.01, -29);
    h.nativeDrawCreate(a);
    h.startNativeEdit('a');
    const paints = h.draw.sets.length;
    releaseIsland();
    await until(() => h.sub().calls.includes('onLegacyIsland'), 'island delivered mid-edit');
    assert.deepEqual(ids(h.controller.view()), ['a', 'base']);
    assert.equal(h.draw.sets.length, paints, 'no draw.set under an active direct_select edit');
    assert.deepEqual(ids(h.draw.getAll()), ['a'], 'the geometry being edited is untouched');
    h.nativeVertexDrag(moved(a, 0.0005));
    h.exitNativeEdit();
    assert.deepEqual(ops(local).map((o) => o.join(':')), ['create:draw-create:a', 'legacy:legacy-island:base', 'update:native-edit:a']);
    assert.deepEqual(ids(h.draw.getAll()), ['a', 'base'], 'the deferred repaint runs when the edit ends');
    assert.deepEqual(h.draw.get('a')!.geometry, moved(a, 0.0005).geometry, 'the farmer’s vertex drag survives the repaint');
    assert.equal(h.pendingRemoteRedrawRef.current, false);
  } finally { h.unmount(); }
});

test('B1 reticle drawing (pinDraw) in progress when the island arrives: repaint deferred until the reticle closes', async () => {
  fresh('hang'); seedIsland(UID, [BASE]);
  const releaseIsland = hold(v1Ref(UID));
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => state.reads.includes(v1Ref(UID)), 'bootstrap waiting on the island read');
    h.startReticle('site');
    h.draw.changeMode('static');
    const paints = h.draw.sets.length;
    releaseIsland();
    await until(() => h.sub().calls.includes('onLegacyIsland'), 'island delivered mid-reticle');
    assert.equal(h.draw.sets.length, paints, 'no draw.set while the reticle owns the map (mode is \'static\')');
    const { id: _none, ...reticleShape } = square('unused', 30.02, -29); // Map builds the reticle Feature without an id
    const id = h.finishReticle(reticleShape as Feature);
    assert.ok(id && id.startsWith('shp-'));
    h.draw.changeMode('simple_select');
    assert.deepEqual(ids(h.draw.getAll()), ['base', id].sort(), 'deferred repaint shows base beside the new reticle shape');
  } finally { h.unmount(); }
});

test('control (passes before and after): Draw NOT ready at mount — no early paint; the restore poller paints the base later', async () => {
  fresh('hang'); seedIsland(UID, [BASE]);
  const h = new MapHarness({ uid: UID, mapReady: false });
  try {
    await until(() => h.sub().calls.includes('onReady') && state.v2Waiters.length > 0, 'first flush hung');
    assert.equal(h.restoredRef.current, false);
    assert.equal(h.draw.sets.length, 0, 'nothing is painted before a Draw exists');
    assert.equal(h.pendingRemoteRedrawRef.current, false, 'no Draw is not an edit: nothing deferred');
    h.mapReady = true; h.pollTick();
    assert.deepEqual(ids(h.draw.getAll()), ['base']);
    assert.equal(h.restoredRef.current, true);
  } finally { h.unmount(); }
});

test('control (passes before and after): account switched before the island read — the old account’s late island never reaches the new Draw', async () => {
  const { local } = fresh('hang', UID); seedIsland(UID, [BASE]);
  const releaseIsland = hold(v1Ref(UID));
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    await until(() => state.reads.includes(v1Ref(UID)), 'A’s bootstrap waiting on the island read');
    const oldController = h.controller;
    const oldHandlers = h.sub(UID).handlers.shapeSync!;
    h.switchAccount(OTHER);
    assert.notEqual(h.controller, oldController);
    await until(() => h.sub(OTHER).calls.includes('onReady'), 'B bootstrap');
    const paints = h.draw.sets.length;
    releaseIsland();
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    assert.ok(!h.sub(UID).calls.includes('onLegacyIsland'), 'user-sync drops the disposed subscription’s read');
    // Adversarial: Map’s handler bound to the OLD controller is invoked anyway.
    const raw = state.docs.get(v1Ref(UID))!;
    oldHandlers.onLegacyIsland({ shapesJson: raw.shapesJson, version: 1000 });
    assert.equal(h.draw.sets.length, paints, 'no repaint for a stale controller');
    assert.deepEqual(ids(h.draw.getAll()), []);
    assert.deepEqual(ids(h.controller.view()), []);
    assert.deepEqual(ops(local, UID), [], 'nothing journaled for A after it was disposed');
    assert.deepEqual(ops(local, OTHER), [], 'nothing of A journaled into B');
  } finally { h.unmount(); }
});

test('control (passes before and after): sample mode never subscribes and paints only the sample namespace', async () => {
  const { local, session } = fresh('open', UID); seedIsland(UID, [BASE]);
  session.setItem('imbewu_sample_mode', '1');
  local.setItem(FARM_KEY, JSON.stringify({ type: 'FeatureCollection', features: [square('sample', 31, -28)] }));
  const h = new MapHarness({ uid: UID, mapReady: true });
  try {
    for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
    assert.equal(h.subscriptions.length, 0, 'no subscribeUserMapData while sampling');
    assert.deepEqual(state.reads, []); assert.deepEqual(state.transactionReads, []); assert.deepEqual(state.writes, []);
    assert.deepEqual(ids(h.draw.getAll()), ['sample']);
    assert.deepEqual(shapeSyncNotice(h.shapeSyncStatus), { level: 'info', text: 'Saved on this device only.', offerBackup: false });
  } finally { h.unmount(); session.removeItem('imbewu_sample_mode'); }
});

test('B1 live island update from a not-yet-updated client after a normal restore: the new legacy shape is painted', async () => {
  fresh('open'); seedIsland(UID, [BASE]);
  const h = new MapHarness({ uid: UID, mapReady: false });
  try {
    await until(() => state.docs.has(v2Ref(UID)) && !h.controller.status().flushing, 'bootstrap commit');
    h.mapReady = true; h.pollTick();
    assert.deepEqual(ids(h.draw.getAll()), ['base'], 'precondition: normal delayed restore (both builds)');
    deliverAll();
    // An old client blind-writes the v1 island with one more shape.
    state.docs.set(v1Ref(UID), { shapesJson: JSON.stringify({ type: 'FeatureCollection', features: [BASE, square('old', 30.03, -29)] }), updatedAt: { toMillis: () => 5000 } });
    for (const l of state.listeners) if (l.ref === v1Ref(UID)) l.next({ exists: () => true, data: () => state.docs.get(v1Ref(UID)), metadata: { fromCache: false, hasPendingWrites: false } });
    assert.deepEqual(ids(h.controller.view()), ['base', 'old']);
    assert.deepEqual(ids(h.draw.getAll()), ['base', 'old'], 'an island change from an old client is remote content and must be shown');
  } finally { h.unmount(); }
});
