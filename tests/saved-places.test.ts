import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory storage polyfill — see tests/local-tombstones.test.ts for why this is
// needed (lib/saved-places.ts reads/writes `localStorage`/`window.sessionStorage` directly,
// matching the codebase's browser-only style).
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
// isSampleMode() (lib/sample-mode.ts) reads window.sessionStorage — must exist too, or its
// try/catch swallows a ReferenceError and we can't be sure sample mode is really reporting off.
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = new FakeStorage();
// mergeIncomingPlaces() (below) calls this module's notify(), which does
// `window.dispatchEvent(new CustomEvent(...))` — plain globalThis isn't a real EventTarget, so
// stub a no-op. CustomEvent itself is a real Node global (no polyfill needed).
const events: string[] = [];
(globalThis as unknown as { dispatchEvent: unknown }).dispatchEvent = (event: Event) => {
  events.push(event.type);
  return true;
};

const {
  deletePlace,
  distanceMeters,
  findNearbyPlace,
  isValidSavedPlace,
  loadPlaces,
  mergeIncomingPlaces,
  normalisePlaces,
  savePlace,
  updatePlacePosition,
} = await import('../lib/saved-places.ts');
const { addTombstone, readTombstones } = await import('../lib/local-tombstones.ts');
type SavedPlace = Awaited<ReturnType<typeof findNearbyPlace>>;

const PLACES_KEY = 'permamap_saved_places';
const PLACES_DELETED_KEY = `${PLACES_KEY}_deleted`;

function place(id: string, lat: number, lon: number): NonNullable<SavedPlace> {
  return {
    id, name: id, lat, lon,
    biome: 'Grassland', rainfall: 700, elevation: 1200,
    savedAt: new Date(0).toISOString(),
  };
}

function seed(places: NonNullable<SavedPlace>[]): void {
  fakeLocalStorage.setItem(PLACES_KEY, JSON.stringify(places));
}

test('the local store filters malformed records and keeps one newest copy per id', () => {
  fakeLocalStorage.clear();
  const older = { ...place('same', -29.6, 30.4), name: 'old', updatedAt: 1000 };
  const newer = { ...place('same', -29.7, 30.5), name: 'new', updatedAt: 2000 };
  const malformed: unknown[] = [
    null,
    { ...place('', -29.6, 30.4), id: '' },
    place('bad-lat', 91, 30.4),
    place('bad-lon', -29.6, 181),
    { ...place('bad-date', -29.6, 30.4), savedAt: 'not-a-date' },
    { ...place('bad-update', -29.6, 30.4), updatedAt: Number.POSITIVE_INFINITY },
    { ...place('bad-label', -29.6, 30.4), label: 'shop' },
  ];
  fakeLocalStorage.setItem(PLACES_KEY, JSON.stringify([older, ...malformed, newer]));

  assert.deepEqual(loadPlaces(), [newer]);
  assert.deepEqual(normalisePlaces([older, newer]), [newer]);
  for (const value of malformed) assert.equal(isValidSavedPlace(value), false);
});

test('saving rejects malformed places before storage, notification or cloud sync', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const invalid = place('outside', 91, 30.4);

  assert.throws(() => savePlace(invalid), /Invalid saved place/);
  assert.equal(fakeLocalStorage.getItem(PLACES_KEY), null);
  assert.deepEqual(events, []);
});

test('deleting a missing id is a truthful no-op with no tombstone or change event', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const kept = place('kept', -29.6, 30.4);
  seed([kept]);

  assert.deepEqual(deletePlace('missing'), [kept]);
  assert.deepEqual(readTombstones(PLACES_DELETED_KEY), {});
  assert.deepEqual(events, []);
});

test('a failed visible deletion never leaves a tombstone that can delete the still-present place', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const existing = place('kept', -29.6, 30.4);
  seed([existing]);
  fakeLocalStorage.failKey = PLACES_KEY;

  assert.throws(() => deletePlace(existing.id), /storage unavailable/);
  fakeLocalStorage.failKey = null;
  assert.deepEqual(loadPlaces(), [existing]);
  assert.deepEqual(readTombstones(PLACES_DELETED_KEY), {});
  assert.deepEqual(events, []);
});

test('moving validates coordinates and reports only a real persisted movement', () => {
  fakeLocalStorage.clear();
  events.length = 0;
  const existing = place('farm', -29.6, 30.4);
  seed([existing]);

  assert.throws(() => updatePlacePosition(existing.id, 91, 30.4), /Invalid place position/);
  assert.deepEqual(updatePlacePosition('missing', -29.7, 30.5), [existing]);
  assert.deepEqual(updatePlacePosition(existing.id, existing.lat, existing.lon), [existing]);
  assert.deepEqual(events, []);

  const moved = updatePlacePosition(existing.id, -29.7, 30.5);
  assert.equal(moved[0]!.lat, -29.7);
  assert.equal(moved[0]!.lon, 30.5);
  assert.equal(typeof moved[0]!.updatedAt, 'number');
  assert.deepEqual(loadPlaces(), moved);
  assert.deepEqual(events, ['permamap-places-changed']);
});

test('findNearbyPlace returns the place when within the radius', () => {
  fakeLocalStorage.clear();
  seed([place('p1', -29.6, 30.4)]);
  // ~44m east at this latitude, well inside the default 60m radius.
  const found = findNearbyPlace(-29.6, 30.4 + 0.0005, 60);
  assert.ok(found);
  assert.equal(found!.id, 'p1');
});

test('findNearbyPlace returns null when nothing is within the radius', () => {
  fakeLocalStorage.clear();
  seed([place('p1', -29.6, 30.4)]);
  const found = findNearbyPlace(-29.7, 30.5, 60); // ~13km away — nowhere close
  assert.equal(found, null);
});

test('findNearbyPlace on an empty saved-places list returns null', () => {
  fakeLocalStorage.clear();
  seed([]);
  assert.equal(findNearbyPlace(-29.6, 30.4, 60), null);
});

test('findNearbyPlace boundary: a candidate at EXACTLY radiusM metres is included (inclusive <=)', () => {
  fakeLocalStorage.clear();
  seed([place('p1', 0, 0)]);
  const lat2 = 0.0006; // small offset near the equator
  const exactDist = distanceMeters(0, 0, lat2, 0); // ground truth distance from the same formula
  const found = findNearbyPlace(lat2, 0, exactDist);
  assert.ok(found);
  assert.equal(found!.id, 'p1');
});

test('findNearbyPlace boundary: a candidate 1m beyond radiusM is excluded', () => {
  fakeLocalStorage.clear();
  seed([place('p1', 0, 0)]);
  const lat2 = 0.0006;
  const exactDist = distanceMeters(0, 0, lat2, 0);
  const found = findNearbyPlace(lat2, 0, exactDist - 1);
  assert.equal(found, null);
});

test('findNearbyPlace with multiple candidates in range returns the NEAREST one', () => {
  fakeLocalStorage.clear();
  seed([
    place('far', 0, 0.0004),  // further away, still in range
    place('near', 0, 0.0001), // closest
    place('mid', 0, 0.0002),
  ]);
  const found = findNearbyPlace(0, 0, 60);
  assert.ok(found);
  assert.equal(found!.id, 'near');
});

test('findNearbyPlace ignores candidates outside the radius even when they are the nearest of the excluded set', () => {
  fakeLocalStorage.clear();
  seed([
    place('too_far', 0, 0.01), // ~1.1km — outside default 60m radius
  ]);
  assert.equal(findNearbyPlace(0, 0, 60), null);
});

test('distanceMeters(a, a) is zero', () => {
  assert.equal(distanceMeters(-29.6, 30.4, -29.6, 30.4), 0);
});

// ── mergeIncomingPlaces — the ?share= import merge-path fix ─────────────────────────────────
//
// components/Map.tsx's ?share=<code> import used to do a raw full-array
// localStorage.setItem('permamap_saved_places', ...) overwrite, bypassing loadPlaces()/
// mergeItems()/local tombstones entirely — a shared-site import could silently clobber places
// this device had added locally, or resurrect a place it had just deleted. mergeIncomingPlaces()
// routes the same import through the app's normal union-by-id/newest-updatedAt-wins/
// tombstone-aware merge path (lib/user-sync.ts's mergeItems) instead.

test('mergeIncomingPlaces: a shared place absent locally still arrives (the import\'s actual purpose is preserved)', () => {
  fakeLocalStorage.clear();
  seed([]);
  const shared = place('shared1', -29.6, 30.4);
  const items = mergeIncomingPlaces([shared]);
  assert.deepEqual(items, [shared]);
  assert.deepEqual(JSON.parse(fakeLocalStorage.getItem(PLACES_KEY)!), [shared]);
});

test('shared imports cannot inject malformed or duplicate place records into local storage', () => {
  fakeLocalStorage.clear();
  const local = place('local', -29.6, 30.4);
  seed([local]);
  const older = { ...place('shared', -29.7, 30.5), name: 'old', updatedAt: 1000 };
  const newer = { ...place('shared', -29.8, 30.6), name: 'new', updatedAt: 2000 };
  const invalid = place('outside', 91, 30.4);

  const items = mergeIncomingPlaces([older, invalid, newer]);

  assert.deepEqual(items, [newer, local]);
  assert.deepEqual(JSON.parse(fakeLocalStorage.getItem(PLACES_KEY)!), items);
});

test('mergeIncomingPlaces does NOT clobber a locally-added place absent from the shared batch (union, not overwrite)', () => {
  fakeLocalStorage.clear();
  const local = place('local_only', -29.7, 30.5);
  seed([local]);
  const shared = place('shared1', -29.6, 30.4);
  const items = mergeIncomingPlaces([shared]);
  const ids = items.map((p) => p!.id).sort();
  assert.deepEqual(ids, ['local_only', 'shared1']);
});

test('mergeIncomingPlaces: newest-wins when the same id exists both locally and in the shared batch', () => {
  fakeLocalStorage.clear();
  const localNewer = { ...place('p1', -29.6, 30.4), updatedAt: 9000 };
  seed([localNewer]);
  const sharedOlder = { ...place('p1', -29.61, 30.41), updatedAt: 1000 }; // stale copy in the share
  const items = mergeIncomingPlaces([sharedOlder]);
  assert.equal(items.length, 1);
  assert.equal(items[0]!.updatedAt, 9000);
  assert.equal(items[0]!.lat, -29.6); // the newer LOCAL copy's data wins, not the shared one's
});

test('mergeIncomingPlaces respects a local deletion tombstone — a shared import cannot resurrect a place this device just deleted', () => {
  fakeLocalStorage.clear();
  seed([]); // already removed locally
  const now = Date.now();
  // Realistic recent-past timestamps: readTombstones() prunes anything older than the 90-day
  // TTL relative to the REAL current time, so a tiny epoch-relative value (e.g. `5000`) would be
  // pruned away as "90 days old" before the merge even runs — use `now`-relative deltas instead.
  addTombstone(PLACES_DELETED_KEY, 'deleted1', now - 5000);
  const staleSharedCopy = { ...place('deleted1', -29.6, 30.4), updatedAt: now - 9000 }; // predates the tombstone
  const items = mergeIncomingPlaces([staleSharedCopy]);
  assert.deepEqual(items, []); // stays deleted — the shared copy does not resurrect it
});

test('mergeIncomingPlaces: a shared place edited AFTER this device\'s local tombstone still arrives (deliberate re-add semantics, mirrors mergeItems)', () => {
  fakeLocalStorage.clear();
  seed([]);
  const now = Date.now();
  addTombstone(PLACES_DELETED_KEY, 'p1', now - 5000);
  const sharedNewer = { ...place('p1', -29.6, 30.4), updatedAt: now - 1000 }; // postdates the tombstone
  const items = mergeIncomingPlaces([sharedNewer]);
  assert.deepEqual(items, [sharedNewer]);
});
