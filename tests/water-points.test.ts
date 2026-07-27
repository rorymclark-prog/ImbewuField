import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory storage polyfill — see tests/local-tombstones.test.ts for why this is
// needed (lib/water-points.ts reads/writes `localStorage` directly, matching the codebase's
// browser-only style).
class FakeStorage {
  #map = new Map<string, string>();
  getItem(k: string): string | null { return this.#map.has(k) ? this.#map.get(k)! : null; }
  setItem(k: string, v: string): void { this.#map.set(k, v); }
  removeItem(k: string): void { this.#map.delete(k); }
  clear(): void { this.#map.clear(); }
}

(globalThis as unknown as { window: unknown }).window = globalThis;
const fakeLocalStorage = new FakeStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = fakeLocalStorage;
// mergeIncomingWaterPoints() calls this module's notify(), which does
// `window.dispatchEvent(new CustomEvent(...))` — plain globalThis isn't a real EventTarget, so
// stub a no-op. CustomEvent itself is a real Node global (no polyfill needed).
(globalThis as unknown as { dispatchEvent: unknown }).dispatchEvent = () => true;

const { loadWaterPoints, mergeIncomingWaterPoints } = await import('../lib/water-points.ts');
const { addTombstone } = await import('../lib/local-tombstones.ts');

type WaterPoint = ReturnType<typeof loadWaterPoints>[number];

const KEY = 'imbewu_water_points';
const DELETED_KEY = `${KEY}_deleted`;

function pt(id: string, overrides: Partial<WaterPoint> = {}): WaterPoint {
  return {
    id,
    name: id,
    category: 'Dam',
    lat: -29.6,
    lon: 30.4,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function seed(points: WaterPoint[]): void {
  fakeLocalStorage.setItem(KEY, JSON.stringify(points));
}

// mergeIncomingWaterPoints — the water-point mirror of lib/saved-places.ts's mergeIncomingPlaces
// (see its tests for the full rationale). Both are the Gap 2 fix for components/Map.tsx's
// ?share=<code> import, which used to do a raw full-array localStorage overwrite for water
// points too.

test('mergeIncomingWaterPoints: a shared water point absent locally still arrives', () => {
  fakeLocalStorage.clear();
  seed([]);
  const shared = pt('shared1');
  const items = mergeIncomingWaterPoints([shared]);
  assert.deepEqual(items, [shared]);
  assert.deepEqual(JSON.parse(fakeLocalStorage.getItem(KEY)!), [shared]);
});

test('mergeIncomingWaterPoints does NOT clobber a locally-added water point absent from the shared batch (union, not overwrite)', () => {
  fakeLocalStorage.clear();
  const local = pt('local_only');
  seed([local]);
  const shared = pt('shared1');
  const items = mergeIncomingWaterPoints([shared]);
  const ids = items.map((p) => p.id).sort();
  assert.deepEqual(ids, ['local_only', 'shared1']);
});

test('mergeIncomingWaterPoints: newest-wins (by updatedAt) when the same id exists both locally and in the shared batch', () => {
  fakeLocalStorage.clear();
  const localNewer = pt('p1', { lat: -29.6, updatedAt: 9000 });
  seed([localNewer]);
  const sharedOlder = pt('p1', { lat: -29.61, updatedAt: 1000 }); // stale copy in the share
  const items = mergeIncomingWaterPoints([sharedOlder]);
  assert.equal(items.length, 1);
  assert.equal(items[0].updatedAt, 9000);
  assert.equal(items[0].lat, -29.6); // the newer LOCAL copy's data wins
});

test('mergeIncomingWaterPoints falls back to createdAt when updatedAt is absent (matches lib/user-sync.ts waterTs semantics)', () => {
  fakeLocalStorage.clear();
  seed([]);
  const shared = pt('p1', { createdAt: new Date(5000).toISOString() }); // no updatedAt
  const items = mergeIncomingWaterPoints([shared]);
  assert.deepEqual(items, [shared]);
});

test('mergeIncomingWaterPoints respects a local deletion tombstone — a shared import cannot resurrect a water point this device just deleted', () => {
  fakeLocalStorage.clear();
  seed([]); // already removed locally
  const now = Date.now();
  // Realistic recent-past timestamps: readTombstones() prunes anything older than the 90-day
  // TTL relative to the REAL current time, so tiny epoch-relative values would be pruned away
  // as "90 days old" before the merge even runs.
  addTombstone(DELETED_KEY, 'deleted1', now - 5000);
  const staleSharedCopy = pt('deleted1', { updatedAt: now - 9000 }); // predates the tombstone
  const items = mergeIncomingWaterPoints([staleSharedCopy]);
  assert.deepEqual(items, []); // stays deleted — the shared copy does not resurrect it
});

test('mergeIncomingWaterPoints: a shared water point edited AFTER this device\'s local tombstone still arrives (deliberate re-add semantics)', () => {
  fakeLocalStorage.clear();
  seed([]);
  const now = Date.now();
  addTombstone(DELETED_KEY, 'p1', now - 5000);
  const sharedNewer = pt('p1', { updatedAt: now - 1000 }); // postdates the tombstone
  const items = mergeIncomingWaterPoints([sharedNewer]);
  assert.deepEqual(items, [sharedNewer]);
});
