import assert from 'node:assert/strict';
import test from 'node:test';
import type { Feature } from 'geojson';

// NEGATIVE CONTROLS for the second pass. Deliberately self-contained (own storage + transport
// fakes) and limited to the controller API both packages share, so this exact file can be run
// against the FIRST package (where each test is expected to FAIL — the loss is real there) and
// against the second package (where each must PASS). Every assertion is "the farmer's unique
// intent/geometry is still recoverable from this browser's storage", never a count heuristic.

import { createShapeSyncController, shapeSyncKeys } from '../lib/shape-sync/controller.ts';

class SharedStorage {
  rows = new Map<string, string>();
  failPrefixes: string[] = [];
  get length() { return this.rows.size; }
  key(i: number) { return [...this.rows.keys()][i] ?? null; }
  getItem(k: string) { return this.rows.get(k) ?? null; }
  setItem(k: string, v: string) {
    if (this.failPrefixes.some((p) => k.startsWith(p))) throw new Error('QuotaExceededError');
    this.rows.set(k, String(v));
  }
  removeItem(k: string) { this.rows.delete(k); }
  /** Does ANY stored value still contain this marker? (sole-copy survival, implementation-agnostic) */
  holds(marker: string) { return [...this.rows.values()].some((v) => v.includes(marker)); }
}

const UID = 'farmer';
const suffix = `::imbewu-owner::uid:${UID}`;
const FARM = `imbewu_farm_shapes${suffix}`;
const offline = { transact: async () => { throw new Error('unavailable: offline'); } };

class Server {
  doc: unknown = null;
  version = 0;
  transport() {
    return {
      transact: async <R>(step: (current: unknown) => { write: unknown; result: R }): Promise<R> => {
        for (let attempt = 0; attempt < 5; attempt++) {
          const v = this.version;
          const out = step(this.doc ? structuredClone(this.doc) : null);
          if (v !== this.version) continue;
          if (out.write) { this.doc = structuredClone(out.write); this.version++; }
          return out.result;
        }
        throw new Error('contention');
      },
    };
  }
}

let n = 0;
function controller(storage: SharedStorage, transport: unknown, name: string) {
  const c = createShapeSyncController({
    keys: shapeSyncKeys((base) => `${base}${suffix}`),
    storage, transport: transport as never,
    isCurrent: () => true, now: () => 1_700_000_000_000, randomId: () => `${name}${n++}`,
    schedule: () => () => {},
  } as never);
  c.start();
  return c;
}
const poly = (id: string, lon: number, props: Record<string, unknown> = {}): Feature => ({
  type: 'Feature', id, properties: { featureType: 'site', ...props },
  geometry: { type: 'Polygon', coordinates: [[[lon, -29], [lon + 0.001, -29], [lon + 0.001, -28.999], [lon, -29]]] },
} as Feature);
const viewIds = (c: { view(): { features: Array<{ id?: unknown }> } }) => c.view().features.map((f) => String(f.id)).sort();

test('NC1 two offline tabs of the same account: neither queued intent vanishes across restart', () => {
  const storage = new SharedStorage();
  const tabA = controller(storage, offline, 'A');
  const tabB = controller(storage, offline, 'B');
  assert.ok(tabA.create(poly('shape-from-tab-A', 30), 'reticle-create').ok);
  assert.ok(tabB.create(poly('shape-from-tab-B', 31), 'reticle-create').ok);
  tabA.dispose();
  tabB.dispose();
  const reopened = controller(storage, offline, 'C');
  assert.deepEqual(viewIds(reopened), ['shape-from-tab-A', 'shape-from-tab-B']);
});

test('NC2 an old-version tab writes the v1 cache after v2 started: its offline addition is not overwritten', () => {
  const storage = new SharedStorage();
  const v2tab = controller(storage, offline, 'V');
  v2tab.create(poly('x', 30), 'reticle-create');
  // An old (v1) tab in the same profile persists its draw store: v2's x plus its own offline z.
  storage.setItem(FARM, JSON.stringify({ type: 'FeatureCollection', features: [poly('x', 30), poly('old-tab-offline-z', 32, { name: 'OLD-TAB-ONLY' })] }));
  v2tab.create(poly('y', 31), 'reticle-create'); // v2 rewrites its derived cache
  v2tab.dispose();
  const reopened = controller(storage, offline, 'R');
  assert.ok(viewIds(reopened).includes('old-tab-offline-z'), 'the old tab\'s only copy must not be clobbered');
});

test('NC3 backup + quarantine writes fail while the cache write succeeds: the sole raw v1 copy is not destroyed', () => {
  const storage = new SharedStorage();
  storage.setItem(FARM, JSON.stringify({ type: 'FeatureCollection', features: [
    poly('valid', 30),
    { type: 'Feature', id: 'broken', properties: { note: 'RAW-ONLY-MARKER' }, geometry: { type: 'Polygon', coordinates: [[[0, 0]]] } },
  ] }));
  storage.failPrefixes = ['imbewu_farm_shapes_v1_backup', 'imbewu_shape_quarantine_v2'];
  const c = controller(storage, offline, 'M');
  c.create(poly('later', 31), 'reticle-create');
  c.dispose();
  storage.failPrefixes = [];
  controller(storage, offline, 'M2').dispose();
  assert.ok(storage.holds('RAW-ONLY-MARKER'), 'the unparseable feature existed only in the raw v1 cache');
});

test('NC4 more than 200 quarantined v1 features: none is trimmed away', () => {
  const storage = new SharedStorage();
  const broken = Array.from({ length: 250 }, (_, i) => ({ type: 'Feature', id: `b${i}`, properties: { marker: `QMARK-${i}-END` }, geometry: null }));
  storage.setItem(FARM, JSON.stringify({ type: 'FeatureCollection', features: [poly('valid', 30), ...broken] }));
  storage.failPrefixes = ['imbewu_farm_shapes_v1_backup'];
  const c = controller(storage, offline, 'Q');
  c.create(poly('later', 31), 'reticle-create');
  c.dispose();
  const missing = broken.filter((_, i) => !storage.holds(`QMARK-${i}-END`)).length;
  assert.equal(missing, 0, `${missing} quarantined raw features were trimmed`);
});

test('NC5 more than 20 conflicting same-shape edits: the 22nd branch is retained (blocked, not dropped) across reload', async () => {
  const server = new Server();
  const origin = controller(new SharedStorage(), server.transport(), 'D0');
  origin.create(poly('s', 30, { name: 'start' }), 'reticle-create');
  await origin.flush();
  const storages: SharedStorage[] = [];
  for (let i = 1; i <= 22; i++) {
    const storage = new SharedStorage();
    storages.push(storage);
    const d = controller(storage, server.transport(), `D${i}`);
    d.receiveRemote(server.doc);
    const basis = d.captureBasis('s');
    assert.ok(basis);
    basis.baseRev = 1; // every device edits from the SAME base (rev 1): 21 genuinely concurrent renames
    d.update(basis, poly('s', 30, { name: `CONFLICT-NAME-${i}-END` }), 'rename');
    await d.flush();
    d.dispose();
  }
  const last = storages[21];
  const reopened = controller(last, server.transport(), 'D22b');
  assert.ok(reopened.exportRecovery().includes('CONFLICT-NAME-22-END') || last.holds('CONFLICT-NAME-22-END'),
    'the 22nd device\'s edit is the only copy of that intent');
});
