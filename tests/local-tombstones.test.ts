import test from 'node:test';
import assert from 'node:assert/strict';

// Minimal in-memory localStorage polyfill — Node's own `localStorage` global is only wired up
// behind an experimental flag (see tests/register-alias.mjs), and every other module under test
// here reads/writes `localStorage` directly (matching the codebase's browser-only style, see
// lib/saved-places.ts / lib/local-tombstones.ts), so it has to exist as a real global before
// those modules are imported.
class FakeStorage {
  #map = new Map<string, string>();
  getItem(k: string): string | null { return this.#map.has(k) ? this.#map.get(k)! : null; }
  setItem(k: string, v: string): void { this.#map.set(k, v); }
  removeItem(k: string): void { this.#map.delete(k); }
  clear(): void { this.#map.clear(); }
}

(globalThis as unknown as { window: unknown }).window = globalThis;
const fakeStorage = new FakeStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = fakeStorage;

const { readTombstones, addTombstone, LOCAL_TOMBSTONE_TTL_MS } = await import('../lib/local-tombstones.ts');

test('addTombstone then readTombstones round-trips the deletedAt timestamp', () => {
  fakeStorage.clear();
  const atMs = Date.now() - 1000; // recent, well within the TTL
  addTombstone('places_deleted', 'abc', atMs);
  const t = readTombstones('places_deleted');
  assert.equal(t['abc'], atMs);
});

test('readTombstones on a missing key returns {}', () => {
  fakeStorage.clear();
  assert.deepEqual(readTombstones('never_written_deleted'), {});
});

test('readTombstones defensively parses corrupt JSON as {} (matches rest of codebase\'s style)', () => {
  fakeStorage.clear();
  fakeStorage.setItem('corrupt_deleted', 'not json{{{');
  assert.deepEqual(readTombstones('corrupt_deleted'), {});
});

test('readTombstones defensively treats a non-object JSON value (e.g. an array) as {}', () => {
  fakeStorage.clear();
  fakeStorage.setItem('array_deleted', '[1,2,3]');
  assert.deepEqual(readTombstones('array_deleted'), {});
});

test('readTombstones prunes entries older than the TTL, keeps fresh ones', () => {
  fakeStorage.clear();
  const now = Date.now();
  addTombstone('mixed_deleted', 'stale', now - LOCAL_TOMBSTONE_TTL_MS - 1000); // just past TTL
  addTombstone('mixed_deleted', 'fresh', now - 1000); // well within TTL
  const t = readTombstones('mixed_deleted');
  assert.equal(t['stale'], undefined);
  assert.equal(t['fresh'], now - 1000);
});

test('readTombstones honours a custom ttlMs override', () => {
  fakeStorage.clear();
  const now = Date.now();
  addTombstone('short_ttl_deleted', 'x', now - 5000);
  assert.deepEqual(readTombstones('short_ttl_deleted', 1000), {}); // 5s old, 1s TTL → pruned
  assert.equal(readTombstones('short_ttl_deleted', 60000)['x'], now - 5000); // 60s TTL → kept
});

test('two different storage keys do not leak tombstones into each other', () => {
  fakeStorage.clear();
  const t1 = Date.now() - 1000;
  const t2 = Date.now() - 2000;
  addTombstone('places_deleted', 'p1', t1);
  addTombstone('water_deleted', 'w1', t2);
  assert.deepEqual(readTombstones('places_deleted'), { p1: t1 });
  assert.deepEqual(readTombstones('water_deleted'), { w1: t2 });
});
