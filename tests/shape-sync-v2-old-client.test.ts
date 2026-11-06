import './shape-sync-old-client-fixture.mjs';

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

// OLD-CLIENT READ-SIDE FENCING. A mixed fleet on one fake Firestore:
//   * OLD client  = the UNCHANGED v1 lib/user-sync.ts from OLD_CLIENT_TREE (a checkout of the frozen
//                   5c12307a source; the run script also points it at THIS tree's own v1 path to
//                   prove that path is byte-for-byte behaviour-identical).
//   * NEW client  = this tree's lib/user-sync.ts (shapeSync handlers + createShapeSyncTransport)
//                   driving lib/shape-sync/controller.ts exactly as components/Map.tsx wires it.
// The first block CHARACTERISES what an unmodified old device does — including the losses v2 can
// NOT prevent while the v1 island exists. Those tests pass because they assert the old behaviour.
// Not an emulator: one in-memory Map, no rules engine (deny is injected per document path).

const OLD_TREE = process.env.OLD_CLIENT_TREE;
const UID = 'farmer';
const ISLAND = `user_map_data/${UID}/data/shapes`;
const V2 = `user_map_data/${UID}/data/shapes_v2`;
const FARM = `imbewu_farm_shapes::imbewu-owner::uid:${UID}`;

type Doc = Record<string, unknown>;
const fs = {
  docs: new Map<string, Doc>(),
  deny: new Set<string>(),
  listeners: new Map<string, Set<(snap: unknown) => void>>(),
  clock: 1000,
  writes: [] as string[],
};
Object.assign(globalThis, { __imbewuOldClientFs: fs });
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const fakeFirestore = moduleUrl(`
const fs = globalThis.__imbewuOldClientFs;
const copy = (data) => { const { updatedAt, ...rest } = data; return { ...structuredClone(rest), ...(updatedAt !== undefined ? { updatedAt } : {}) }; };
const snap = (ref) => ({ exists: () => fs.docs.has(ref), data: () => (fs.docs.has(ref) ? copy(fs.docs.get(ref)) : undefined), metadata: { hasPendingWrites: false } });
const fire = (ref) => queueMicrotask(() => { for (const l of [...(fs.listeners.get(ref) ?? [])]) l(snap(ref)); });
const write = (ref, data) => {
  if (fs.deny.has(ref)) { const e = new Error('permission-denied: Missing or insufficient permissions.'); e.code = 'permission-denied'; throw e; }
  fs.writes.push('set ' + ref); fs.docs.set(ref, copy(data)); fire(ref);
};
const remove = (ref) => {
  if (fs.deny.has('delete ' + ref)) throw new Error('permission-denied');
  fs.writes.push('delete ' + ref); fs.docs.delete(ref); fire(ref);
};
export const doc = (_db, ...parts) => parts.join('/');
export const getDoc = async (ref) => snap(ref);
export const setDoc = async (ref, data) => write(ref, data);
export const runTransaction = async (_db, update) => {
  const ops = [];
  const out = await update({ get: async (ref) => snap(ref), set: (ref, data) => { ops.push(() => write(ref, data)); }, delete: (ref) => { ops.push(() => remove(ref)); } });
  for (const op of ops) op();
  return out;
};
export const onSnapshot = (ref, next) => {
  const set = fs.listeners.get(ref) ?? new Set(); fs.listeners.set(ref, set); set.add(next);
  queueMicrotask(() => { if (set.has(next)) next(snap(ref)); });
  return () => set.delete(next);
};
export const serverTimestamp = () => { const ms = ++fs.clock; return { toMillis: () => ms }; };
`);
const fakeInit = moduleUrl(`
export const getFirebase = () => ({ db: {}, auth: { currentUser: { uid: '${UID}' } } });
export const isBackendConfigured = () => true;
`);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const from = context.parentURL ?? '';
    const ours = from.includes('/lib/user-sync.ts') || from.includes('/lib/account-local-storage.ts');
    if (ours && specifier === 'firebase/firestore') return { url: fakeFirestore, shortCircuit: true };
    if (ours && specifier === './firebase/init') return { url: fakeInit, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});

class Store {
  rows = new Map<string, string>();
  get length() { return this.rows.size; }
  key(i: number) { return [...this.rows.keys()][i] ?? null; }
  getItem(k: string) { return this.rows.get(k) ?? null; }
  setItem(k: string, v: string) { this.rows.set(k, String(v)); }
  removeItem(k: string) { this.rows.delete(k); }
  clear() { this.rows.clear(); }
  holds(marker: string) { return [...this.rows.values()].some((v) => v.includes(marker)); }
}
interface Browser { local: Store; session: Store }
const browser = (): Browser => ({ local: new Store(), session: new Store() });
/** user-sync reads the global localStorage; one "browser" is active at a time. */
function use(b: Browser) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: b.local });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: b.session });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: b.local, sessionStorage: b.session, dispatchEvent: () => true, addEventListener() {}, removeEventListener() {} } });
}
if (typeof globalThis.CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', { configurable: true, value: class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } } });
}
use(browser());

const errors: string[] = [];
const realError = console.error;
console.error = (...args: unknown[]) => { errors.push(args.map(String).join(' ')); };

type UserSync = typeof import('../lib/user-sync.ts');
const oldSync: UserSync | null = OLD_TREE ? await import(pathToFileURL(path.resolve(OLD_TREE, 'lib/user-sync.ts')).href) : null;
if (OLD_TREE) console.log(`# old client: ${path.resolve(OLD_TREE, 'lib/user-sync.ts')}`);
const newSync: UserSync = await import('../lib/user-sync.ts');
const { createShapeSyncController, shapeSyncKeys } = await import('../lib/shape-sync/controller.ts');
const { parseRemoteDoc } = await import('../lib/shape-sync/protocol.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

const settle = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };
const poly = (id: string, lon: number, props: Record<string, unknown> = {}) => ({
  type: 'Feature', id, properties: { featureType: 'site', ...props },
  geometry: { type: 'Polygon', coordinates: [[[lon, -29], [lon + 0.001, -29], [lon + 0.001, -28.999], [lon, -28.999], [lon, -29]]] },
});
const fc = (...features: unknown[]) => ({ type: 'FeatureCollection', features });
const localIds = (b: Browser) => {
  const raw = b.local.getItem(FARM);
  return raw ? (JSON.parse(raw).features as Array<{ id: unknown }>).map((f) => String(f.id)).sort() : null;
};
const v2Live = () => {
  const parsed = parseRemoteDoc(fs.docs.get(V2) ?? null);
  if (parsed.kind !== 'ok') return [];
  return Object.values(parsed.state.records).filter((r) => r.live).map((r) => r.id).sort();
};
function reset() { fs.docs.clear(); fs.deny.clear(); fs.listeners.clear(); fs.writes.length = 0; errors.length = 0; }
function seedIsland(shapesJson: unknown) { fs.docs.set(ISLAND, { shapesJson, updatedAt: { toMillis: () => ++fs.clock } }); }

/** Run the OLD client's subscribeUserMapData to the end of its reconcile. */
async function oldOpen(b: Browser): Promise<{ outcome: 'merged' | 'reconcile-error'; stop: () => void }> {
  if (!oldSync) throw new Error('OLD_CLIENT_TREE not set');
  use(b);
  const before = errors.length;
  let stop: () => void = () => {};
  const outcome = await new Promise<'merged' | 'reconcile-error'>((resolve) => {
    stop = oldSync.subscribeUserMapData(UID, { onMergeDone: () => resolve('merged') });
    const poll = setInterval(() => {
      if (errors.slice(before).some((e) => e.includes('reconcile error'))) { clearInterval(poll); resolve('reconcile-error'); }
    }, 1);
    setTimeout(() => clearInterval(poll), 500);
  });
  await settle();
  return { outcome, stop };
}

/** The NEW client as Map.tsx wires it (controller ↔ subscribeUserMapData.shapeSync ↔ transport). */
async function newOpen(b: Browser, opts: { drain?: boolean } = {}) {
  use(b);
  let k = 0;
  const controller = createShapeSyncController({
    keys: shapeSyncKeys((base) => accountLocalStorageKey(base, UID)), storage: b.local,
    transport: newSync.createShapeSyncTransport(UID), isCurrent: () => true, now: () => 1_700_000_000_000,
    randomId: () => `n${k++}`, schedule: () => () => {}, drainLegacyIsland: opts.drain ?? false,
  });
  controller.start();
  let ready!: () => void;
  const isReady = new Promise<void>((r) => { ready = r; });
  const stop = newSync.subscribeUserMapData(UID, {
    shapeSync: {
      onRemoteState: (raw) => controller.receiveRemote(raw),
      onLegacyIsland: (island) => { controller.ingestLegacyIsland(island.shapesJson, island.version); },
      onReady: () => ready(),
    },
  });
  await isReady;
  await controller.flush();
  await settle();
  return { controller, stop: () => { stop(); controller.dispose(); } };
}

const skip = oldSync ? false : 'OLD_CLIENT_TREE not set (point it at a checkout of the frozen 5c12307a source)';

// ── A. Characterisation of the unchanged old client ─────────────────────────────────────────

test('A1 island exists → an old device\'s OFFLINE addition is overwritten on its next reopen (v1 loss v2 cannot prevent while the island exists)', { skip }, async () => {
  reset();
  seedIsland(JSON.stringify(fc(poly('a', 30))));
  const old = browser();
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('z-offline', 31, { name: 'OLD-OFFLINE-Z' }))));
  const { outcome, stop } = await oldOpen(old);
  stop();
  assert.equal(outcome, 'merged');
  assert.deepEqual(localIds(old), ['a'], 'v1 reconcile: remote authoritative, local overwritten before any push');
  assert.equal(old.local.holds('OLD-OFFLINE-Z'), false, 'gone from the old device — protecting shapes_v2 does not change this');
});

test('A2 island shapesJson:null → reconcile WIPES the old cache to an empty collection; the live listener ignores null', { skip }, async () => {
  reset();
  seedIsland(null);
  const old = browser();
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('z', 31))));
  const { stop } = await oldOpen(old);
  assert.deepEqual(localIds(old), [], 'null is "exists, zero features" to v1 reconcile');
  old.local.setItem(FARM, JSON.stringify(fc(poly('z', 31))));
  seedIsland(null);
  for (const l of fs.listeners.get(ISLAND) ?? []) l({ exists: () => true, data: () => ({ shapesJson: null }), metadata: { hasPendingWrites: false } });
  await settle();
  stop();
  assert.deepEqual(localIds(old), ['z'], 'listener: parseShapes(null) → ignored');
});

test('A3 island ABSENT and writes allowed → the old device bootstraps (re-creates) the island from its cache', { skip }, async () => {
  reset();
  const old = browser();
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('z-offline', 31))));
  const { outcome, stop } = await oldOpen(old);
  stop();
  assert.equal(outcome, 'merged');
  assert.ok(fs.writes.includes(`set ${ISLAND}`));
  assert.deepEqual(localIds(old), ['a', 'z-offline'], 'local kept');
});

test('A4 island ABSENT and island writes DENIED → old reconcile throws, its cache is KEPT, and that device stops syncing everything after places/water', { skip }, async () => {
  reset();
  fs.deny.add(ISLAND);
  const old = browser();
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('z-offline', 31, { name: 'OLD-OFFLINE-Z' }))));
  const { outcome, stop } = await oldOpen(old);
  stop();
  assert.equal(outcome, 'reconcile-error');
  assert.ok(old.local.holds('OLD-OFFLINE-Z'), 'the offline addition survives on the old device');
  assert.equal([...fs.listeners.values()].reduce((n, s) => n + s.size, 0), 0, 'no live listener of ANY kind was attached');
  assert.ok(!fs.writes.some((w) => w.includes('/surveys') || w.includes('/design')), 'surveys/design reconcile never ran (sync-paused, not lossy)');
});

test('A5 an open old device whose island is deleted keeps its cache (listener ignores !exists); its later pushShapes is denied, cache kept', { skip }, async () => {
  reset();
  seedIsland(JSON.stringify(fc(poly('a', 30))));
  const old = browser();
  const { stop } = await oldOpen(old);
  fs.docs.delete(ISLAND);
  fs.deny.add(ISLAND);
  for (const l of fs.listeners.get(ISLAND) ?? []) l({ exists: () => false, data: () => undefined, metadata: { hasPendingWrites: false } });
  await settle();
  assert.deepEqual(localIds(old), ['a']);
  // v1 Map.tsx recompute: localStorage.setItem(FARM, draw.getAll()) then pushShapes(uid, fc).
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('drawn-later', 32))));
  await oldSync!.pushShapes(UID, fc(poly('a', 30), poly('drawn-later', 32)) as never);
  stop();
  assert.equal(fs.docs.has(ISLAND), false, 'denied');
  assert.ok(errors.some((e) => e.includes('[sync] pushShapes')));
  assert.deepEqual(localIds(old), ['a', 'drawn-later'], 'kept locally until that device is updated');
});

// ── B. New client against the same documents ────────────────────────────────────────────────

test('B1 updating the old browser (A4 state) to v2: the held offline addition is absorbed from the raw cache and reaches shapes_v2', { skip }, async () => {
  reset();
  fs.deny.add(ISLAND);
  const b = browser();
  b.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('z-offline', 31, { name: 'OLD-OFFLINE-Z' }))));
  (await oldOpen(b)).stop();
  const { controller, stop } = await newOpen(b);
  stop();
  assert.deepEqual(v2Live(), ['a', 'z-offline']);
  assert.ok(JSON.parse(b.local.getItem(FARM) as string).imbewuShapeSyncView, 'raw cache replaced only after absorb + backup');
  const parsed = parseRemoteDoc(fs.docs.get(V2) ?? null);
  assert.equal(parsed.kind === 'ok' && parsed.state.records['z-offline'].content?.p.name, 'OLD-OFFLINE-Z', 'with its properties');
  assert.equal(controller.status().pending, 0);
});

test('B2 old device re-creates the island (A3) after v2 deleted a shape: v2 re-ingests additively and does NOT resurrect the deletion', { skip }, async () => {
  reset();
  seedIsland(JSON.stringify(fc(poly('a', 30), poly('b', 31))));
  const n = browser();
  const first = await newOpen(n);
  assert.deepEqual(v2Live(), ['a', 'b']);
  first.controller.remove(['b'], 'delete');
  await first.controller.flush();
  first.stop();
  assert.deepEqual(v2Live(), ['a']);
  // An old device whose cache still has a and b, plus an offline c, rewrites the island.
  const old = browser();
  old.local.setItem(FARM, JSON.stringify(fc(poly('a', 30), poly('b', 31), poly('c-offline', 32))));
  fs.docs.delete(ISLAND);
  (await oldOpen(old)).stop();
  const again = await newOpen(n);
  again.stop();
  assert.deepEqual(v2Live(), ['a', 'c-offline'], 'b stays deleted (same content already ingested); c arrives');
});

test('B3 drain ON via the real transport: a readable island is ingested and deleted in the same transaction; old devices then hit A4/A5', { skip: false }, async () => {
  reset();
  seedIsland(JSON.stringify(fc(poly('a', 30), poly('b', 31))));
  const { stop } = await newOpen(browser(), { drain: true });
  stop();
  assert.deepEqual(v2Live(), ['a', 'b']);
  assert.equal(fs.docs.has(ISLAND), false);
  const tx = fs.writes.filter((w) => w === `set ${V2}` || w === `delete ${ISLAND}`);
  assert.deepEqual(tx.slice(-2), [`set ${V2}`, `delete ${ISLAND}`], 'one transaction: v2 write + island delete');
});

test('B4 drain ON never deletes an island holding an unreadable feature, and the new client never writes shapesJson anywhere', { skip: false }, async () => {
  reset();
  seedIsland(JSON.stringify(fc(poly('a', 30), { type: 'Feature', id: 'bad', properties: { note: 'ONLY-COPY' }, geometry: null })));
  const { stop } = await newOpen(browser(), { drain: true });
  stop();
  assert.ok(fs.docs.has(ISLAND));
  assert.ok(!fs.writes.some((w) => w === `set ${ISLAND}`), 'v2 never writes the island (in particular never shapesJson:null — see A2)');
});

test('B5 (pass 3) the real transport writes EXACTLY the fields protocol.shapeDocBytes() counts, so the byte budget models what is sent', { skip: false }, async () => {
  reset();
  const { controller, stop } = await newOpen(browser());
  controller.create(poly('sized', 30) as never, 'reticle-create');
  await controller.flush();
  stop();
  const stored = fs.docs.get(V2);
  assert.ok(stored);
  assert.deepEqual(Object.keys(stored).sort(), ['minor', 'protocol', 'seq', 'stateJson', 'storeId', 'updatedAt']);
  const { shapeDocBytes, SHAPE_DOC_BYTE_BUDGET } = await import('../lib/shape-sync/protocol.ts');
  assert.ok(shapeDocBytes(stored as never) <= SHAPE_DOC_BYTE_BUDGET);
});

test.after(() => { console.error = realError; });
