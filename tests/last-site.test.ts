import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

import { DEMO_LOCATION, DEMO_SITE_DATA, DEMO_WATER_DATA } from '../lib/demo-site.ts';
import type { LastSite } from '../lib/last-site.ts';

const KEY = 'imbewu_last_site';

const accountHarness: { currentUid: string | null } = { currentUid: null };
Object.assign(globalThis, { __imbewuLastSiteAccountHarness: accountHarness });
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuLastSiteAccountHarness;
export const getFirebase = () => ({
  auth: { currentUser: harness.currentUid ? { uid: harness.currentUid } : null },
});
export const isBackendConfigured = () => Boolean(harness.currentUid);
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/lib/account-local-storage.ts')
        && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  readonly rows = new Map<string, string>();
  throwOnRead = false;
  throwOnWrite = false;
  getItem(key: string): string | null {
    if (this.throwOnRead) throw new Error('storage denied');
    return this.rows.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.throwOnWrite) throw new Error('quota exceeded');
    this.rows.set(key, value);
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage },
});
const { getLastSite, setLastSite } = await import('../lib/last-site.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

function validSite(): LastSite {
  return {
    locationData: structuredClone(DEMO_LOCATION),
    siteData: structuredClone(DEMO_SITE_DATA),
    waterData: structuredClone(DEMO_WATER_DATA),
  };
}

function seed(value: unknown): void {
  storage.rows.set(KEY, JSON.stringify(value));
}

test('a complete last site round-trips without sharing mutable references', () => {
  storage.rows.clear();
  const input = validSite();
  assert.equal(setLastSite(input), true);
  const loaded = getLastSite();

  assert.deepEqual(loaded, input);
  assert.notEqual(loaded, input);
  assert.notEqual(loaded?.locationData, input.locationData);
});

test('truthy JSON and partial old records cannot masquerade as LastSite', () => {
  const invalid: unknown[] = [
    42,
    [],
    {},
    { locationData: null },
    { locationData: {} },
    { locationData: { ...structuredClone(DEMO_LOCATION), lat: null } },
    { locationData: { ...structuredClone(DEMO_LOCATION), lon: 181 } },
    {
      locationData: {
        ...structuredClone(DEMO_LOCATION),
        rainfall: { ...DEMO_LOCATION.rainfall, monthly: [1, 2, 3] },
      },
    },
    {
      locationData: {
        ...structuredClone(DEMO_LOCATION),
        biome: { ...DEMO_LOCATION.biome, name: null },
      },
    },
  ];

  for (const value of invalid) {
    seed(value);
    assert.equal(getLastSite(), null, `accepted ${JSON.stringify(value).slice(0, 100)}`);
  }
});

test('a valid location survives stale optional area and water summaries', () => {
  seed({
    locationData: DEMO_LOCATION,
    siteData: { areaHa: 'large' },
    waterData: { estVolumeKL: Number.POSITIVE_INFINITY },
  });

  const loaded = getLastSite();
  assert.deepEqual(loaded?.locationData, DEMO_LOCATION);
  assert.equal(loaded?.siteData, null);
  assert.equal(loaded?.waterData, null);
});

test('non-finite required measurements are rejected before reaching dashboard or chat', () => {
  const invalidNumbers = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
  for (const value of invalidNumbers) {
    const site = validSite();
    site.locationData.climate.meanTemp = value;
    assert.equal(setLastSite(site), false);
  }
});

test('an invalid save cannot overwrite the last known-good site', () => {
  storage.rows.clear();
  const good = validSite();
  assert.equal(setLastSite(good), true);
  const before = storage.rows.get(KEY);

  assert.equal(setLastSite({} as LastSite), false);
  assert.equal(storage.rows.get(KEY), before);
  assert.deepEqual(getLastSite(), good);
});

test('unavailable browser storage fails safely in both directions', () => {
  storage.rows.clear();
  storage.throwOnWrite = true;
  assert.equal(setLastSite(validSite()), false);
  storage.throwOnWrite = false;

  storage.throwOnRead = true;
  assert.equal(getLastSite(), null);
  storage.throwOnRead = false;
});

test("one shared device never exposes farmer A's last site to farmer B", () => {
  storage.rows.clear();
  const legacy = validSite();
  legacy.locationData.biome.name = 'Unknown legacy owner';
  seed(legacy);

  accountHarness.currentUid = 'farmer-a';
  const farmerA = validSite();
  farmerA.locationData.biome.name = 'Farmer A only';
  assert.equal(setLastSite(farmerA), true);

  accountHarness.currentUid = 'farmer-b';
  assert.equal(getLastSite(), null);
  const farmerB = validSite();
  farmerB.locationData.biome.name = 'Farmer B only';
  assert.equal(setLastSite(farmerB), true);

  accountHarness.currentUid = 'farmer-a';
  assert.equal(getLastSite()?.locationData.biome.name, 'Farmer A only');
  assert.ok(storage.rows.get(accountLocalStorageKey(KEY, 'farmer-a')));
  assert.ok(storage.rows.get(accountLocalStorageKey(KEY, 'farmer-b')));
  assert.ok(storage.rows.get(KEY), 'unowned legacy last-site data remains quarantined');
  accountHarness.currentUid = null;
});
