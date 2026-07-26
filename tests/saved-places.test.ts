import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory storage polyfill — see tests/local-tombstones.test.ts for why this is
// needed (lib/saved-places.ts reads/writes `localStorage`/`window.sessionStorage` directly,
// matching the codebase's browser-only style).
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
// isSampleMode() (lib/sample-mode.ts) reads window.sessionStorage — must exist too, or its
// try/catch swallows a ReferenceError and we can't be sure sample mode is really reporting off.
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = new FakeStorage();

const { findNearbyPlace, distanceMeters } = await import('../lib/saved-places.ts');
type SavedPlace = Awaited<ReturnType<typeof findNearbyPlace>>;

const PLACES_KEY = 'permamap_saved_places';

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
