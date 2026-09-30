import test from 'node:test';
import assert from 'node:assert/strict';

// In-memory storage, as in tests/saved-places.test.ts: the module reads window.localStorage.
class FakeStorage {
  #map = new Map<string, string>();
  getItem(k: string): string | null { return this.#map.has(k) ? this.#map.get(k)! : null; }
  setItem(k: string, v: string): void { this.#map.set(k, v); }
  removeItem(k: string): void { this.#map.delete(k); }
  clear(): void { this.#map.clear(); }
  keys(): string[] { return [...this.#map.keys()]; }
}

(globalThis as unknown as { window: unknown }).window = globalThis;
const store = new FakeStorage();
(globalThis as unknown as { localStorage: unknown }).localStorage = store;
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = new FakeStorage();

const { loadCropMix, saveCropMix, clearCropMix } = await import('../lib/crop-mix-preference.ts');
const { GROUP_PRIORITY } = await import('../lib/crop-groups.ts');

const SITE = 'site:-29.60000,30.40000';
const OTHER = 'site:-25.70000,28.20000';

test('crop mix: nothing saved means the page uses the recommended mix', () => {
  store.clear();
  assert.equal(loadCropMix(SITE, 'family'), null);
});

test('crop mix: a saved mix comes back for the same map and goal only', () => {
  store.clear();
  const noHerbs = GROUP_PRIORITY.filter((g) => g !== 'herb' && g !== 'less_common');
  saveCropMix(SITE, 'family', { groups: noHerbs, cropKeys: ['cabbage', 'pumpkin'] });
  assert.deepEqual(loadCropMix(SITE, 'family'), { groups: noHerbs, cropKeys: ['cabbage', 'pumpkin'] });
  assert.equal(loadCropMix(SITE, 'commercial'), null, 'a family mix leaked into the commercial goal');
  assert.equal(loadCropMix(OTHER, 'family'), null, 'a mix saved on one map showed on another');

  saveCropMix(SITE, 'commercial', { groups: ['leafy_green'], cropKeys: [] });
  assert.deepEqual(loadCropMix(SITE, 'family')?.groups, noHerbs, 'saving one goal overwrote the other');
});

test('crop mix: an empty commercial mix is a real saved choice, not "nothing saved"', () => {
  store.clear();
  saveCropMix(SITE, 'commercial', { groups: [], cropKeys: [] });
  assert.deepEqual(loadCropMix(SITE, 'commercial'), { groups: [], cropKeys: [] });
});

test('crop mix: reset forgets only that goal', () => {
  store.clear();
  saveCropMix(SITE, 'family', { groups: ['legume'], cropKeys: [] });
  saveCropMix(SITE, 'hybrid', { groups: ['root_tuber'], cropKeys: [] });
  clearCropMix(SITE, 'family');
  assert.equal(loadCropMix(SITE, 'family'), null);
  assert.deepEqual(loadCropMix(SITE, 'hybrid')?.groups, ['root_tuber']);
});

test('crop mix: unknown groups and crops in storage are dropped, never passed to the planner', () => {
  store.clear();
  saveCropMix(SITE, 'family', { groups: ['legume'], cropKeys: [] });
  const key = store.keys()[0];
  const raw = JSON.parse(store.getItem(key)!);
  raw[SITE].family = { groups: ['legume', 'mystery', 'legume'], cropKeys: ['cabbage', 'unobtainium'], offered: GROUP_PRIORITY };
  store.setItem(key, JSON.stringify(raw));
  assert.deepEqual(loadCropMix(SITE, 'family'), { groups: ['legume'], cropKeys: ['cabbage'] });

  store.setItem(key, '{not json');
  assert.equal(loadCropMix(SITE, 'family'), null);
});

test('crop mix: a tile the app adds after the save comes on for family, stays off for commercial', () => {
  store.clear();
  saveCropMix(SITE, 'family', { groups: ['legume'], cropKeys: [] });
  saveCropMix(SITE, 'commercial', { groups: ['legume'], cropKeys: [] });
  const key = store.keys()[0];
  const raw = JSON.parse(store.getItem(key)!);
  // As if saved before 'squash_melon' existed.
  const older = GROUP_PRIORITY.filter((g) => g !== 'squash_melon');
  raw[SITE].family.offered = older;
  raw[SITE].commercial.offered = older;
  store.setItem(key, JSON.stringify(raw));
  assert.deepEqual(loadCropMix(SITE, 'family')?.groups, ['legume', 'squash_melon']);
  assert.deepEqual(loadCropMix(SITE, 'commercial')?.groups, ['legume']);
  // A tile that existed and was switched off stays off.
  assert.ok(!loadCropMix(SITE, 'family')?.groups.includes('herb'));
});
