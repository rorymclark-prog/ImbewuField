import test from 'node:test';
import assert from 'node:assert/strict';

import { DEMO_LOCATION, DEMO_SITE_DATA, DEMO_WATER_DATA } from '../lib/demo-site.ts';
import type { LastSite } from '../lib/last-site.ts';

const KEY = 'imbewu_last_site';

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
