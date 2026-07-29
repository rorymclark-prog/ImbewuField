import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory storage polyfill — see tests/local-tombstones.test.ts for why this is
// needed (lib/water-points.ts reads/writes `localStorage` directly, matching the codebase's
// browser-only style).
class FakeStorage {
  #map = new Map<string, string>();
  failKey: string | null = null;
  getItem(k: string): string | null { return this.#map.has(k) ? this.#map.get(k)! : null; }
  setItem(k: string, v: string): void {
    if (k === this.failKey) throw new Error('storage unavailable');
    this.#map.set(k, v);
  }
  removeItem(k: string): void { this.#map.delete(k); }
  clear(): void { this.#map.clear(); this.failKey = null; }
}

(globalThis as unknown as { window: unknown }).window = globalThis;
const fakeLocalStorage = new FakeStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = fakeLocalStorage;
// mergeIncomingWaterPoints() calls this module's notify(), which does
// `window.dispatchEvent(new CustomEvent(...))` — plain globalThis isn't a real EventTarget, so
// stub a no-op. CustomEvent itself is a real Node global (no polyfill needed).
const events: string[] = [];
(globalThis as unknown as { dispatchEvent: unknown }).dispatchEvent = (event: Event) => {
  events.push(event.type);
  return true;
};

const {
  deleteWaterPoint,
  isValidWaterPoint,
  loadWaterPoints,
  mergeIncomingWaterPoints,
  normaliseWaterPoints,
  saveWaterPoint,
} = await import('../lib/water-points.ts');
const { addTombstone, readTombstones } = await import('../lib/local-tombstones.ts');

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

test('the local store filters malformed records and keeps one newest copy per id', () => {
  fakeLocalStorage.clear();
  const older = pt('same', { name: 'old', updatedAt: 1000 });
  const newer = pt('same', { name: 'new', updatedAt: 2000 });
  const malformed: unknown[] = [
    null,
    { ...pt(''), id: '' },
    { ...pt('bad-category'), category: 'River' },
    { ...pt('bad-lat'), lat: 91 },
    { ...pt('bad-lon'), lon: 181 },
    { ...pt('bad-date'), createdAt: 'not-a-date' },
    { ...pt('bad-update'), updatedAt: Number.POSITIVE_INFINITY },
  ];
  fakeLocalStorage.setItem(KEY, JSON.stringify([older, ...malformed, newer]));

  assert.deepEqual(loadWaterPoints(), [newer]);
  assert.deepEqual(normaliseWaterPoints([older, newer]), [newer]);
  for (const value of malformed) assert.equal(isValidWaterPoint(value), false);
});

test('saving rejects invalid coordinates before storage, notification or cloud sync', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const invalid = pt('outside', { lat: 91 });

  assert.throws(() => saveWaterPoint(invalid), /Invalid water point/);
  assert.equal(fakeLocalStorage.getItem(KEY), null);
  assert.deepEqual(events, []);
});

test('deleting a missing id is a truthful no-op with no tombstone or change event', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  seed([pt('kept')]);

  assert.deepEqual(deleteWaterPoint('missing'), [pt('kept')]);
  assert.deepEqual(readTombstones(DELETED_KEY), {});
  assert.deepEqual(events, []);
});

test('a failed visible deletion never leaves a tombstone that can delete the still-present point', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const existing = pt('kept');
  seed([existing]);
  fakeLocalStorage.failKey = KEY;

  assert.throws(() => deleteWaterPoint(existing.id), /storage unavailable/);
  fakeLocalStorage.failKey = null;
  assert.deepEqual(loadWaterPoints(), [existing]);
  assert.deepEqual(readTombstones(DELETED_KEY), {});
  assert.deepEqual(events, []);
});

test('a successful deletion persists the array and tombstone before announcing the change', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  seed([pt('delete-me'), pt('keep-me')]);

  const result = deleteWaterPoint('delete-me');

  assert.deepEqual(result, [pt('keep-me')]);
  assert.deepEqual(loadWaterPoints(), [pt('keep-me')]);
  assert.equal(typeof readTombstones(DELETED_KEY)['delete-me'], 'number');
  assert.deepEqual(events, ['imbewu-water-points-changed']);
});

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

test('shared imports cannot inject malformed or duplicate water records into local storage', () => {
  fakeLocalStorage.clear();
  seed([pt('local')]);
  const older = pt('shared', { name: 'old', updatedAt: 1000 });
  const newer = pt('shared', { name: 'new', updatedAt: 2000 });
  const invalid = pt('outside', { lon: 181 });

  const items = mergeIncomingWaterPoints([older, invalid, newer]);

  assert.deepEqual(items, [newer, pt('local')]);
  assert.deepEqual(JSON.parse(fakeLocalStorage.getItem(KEY)!), items);
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
