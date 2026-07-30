import test from 'node:test';
import assert from 'node:assert/strict';

import { LOCAL_TOMBSTONE_TTL_MS } from '../lib/local-tombstones.ts';

class MemoryStorage {
  private readonly rows = new Map<string, string>();
  failKey: string | null = null;

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (key === this.failKey) throw new Error('storage unavailable');
    this.rows.set(key, value);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
    this.failKey = null;
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const events: string[] = [];
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: globalThis,
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
});
Object.defineProperty(globalThis, 'dispatchEvent', {
  configurable: true,
  value: (event: Event) => {
    events.push(event.type);
    return true;
  },
});

const {
  deleteSiteElement,
  isValidSiteElement,
  loadSiteElements,
  mergeSiteElements,
  normaliseSiteElements,
  saveSiteElement,
} = await import('../lib/site-elements.ts');
const { canonicalCoordinateSiteId } = await import('../lib/site-id.ts');
const { readTombstones } = await import('../lib/local-tombstones.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');

type SiteElement = ReturnType<typeof loadSiteElements>[number];

const SITE_ID = 'site:-29.00000,31.00000';
const OTHER_SITE_ID = 'site:-30.00000,30.00000';
const keyFor = (siteId: string) => `imbewu_site_elements_${siteId}`;
const deletedKeyFor = (siteId: string) => `${keyFor(siteId)}_deleted`;

function element(id: string, overrides: Partial<SiteElement> = {}): SiteElement {
  return {
    id,
    type: 'tap',
    lat: -29,
    lon: 31,
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

test('only canonical in-range coordinate site ids can own element storage', () => {
  const invalid = [
    '',
    'site:unselected',
    'site:-29,31',
    'site:-29.0000,31.00000',
    'site:-029.00000,031.00000',
    'site:-0.00000,31.00000',
    'site:91.00000,31.00000',
    'site:-29.00000,181.00000',
    'site:-29.00000,31.00000/other',
  ];

  assert.equal(canonicalCoordinateSiteId(SITE_ID), SITE_ID);
  for (const siteId of invalid) {
    assert.equal(canonicalCoordinateSiteId(siteId), null);
    assert.deepEqual(loadSiteElements(siteId), []);
    assert.equal(saveSiteElement(siteId, element('tap')), null);
    assert.equal(deleteSiteElement(siteId, 'tap'), false);
  }
});

test('the local store filters malformed records and keeps one newest copy per id', () => {
  localStorage.clear();
  const older = element('same', { label: 'old', updatedAt: 1000 });
  const newer = element('same', { label: 'new', updatedAt: 2000 });
  const malformed: unknown[] = [
    null,
    element('', { id: '' }),
    element('bad-type', { type: 'river' as SiteElement['type'] }),
    element('bad-lat', { lat: 91 }),
    element('bad-lon', { lon: 181 }),
    element('bad-date', { createdAt: 'not-a-date' }),
    element('bad-count', { type: 'tree', count: 1.5 }),
    element('bad-update', { updatedAt: Number.POSITIVE_INFINITY }),
  ];
  localStorage.setItem(keyFor(SITE_ID), JSON.stringify([older, ...malformed, newer]));

  assert.deepEqual(loadSiteElements(SITE_ID), [newer]);
  assert.deepEqual(normaliseSiteElements([older, newer]), [newer]);
  for (const value of malformed) assert.equal(isValidSiteElement(value), false);
});

test('saving is site-scoped and announces only a successful persisted write', () => {
  localStorage.clear();
  events.length = 0;
  const source = element('tap');

  const saved = saveSiteElement(SITE_ID, source);
  assert.ok(saved);
  assert.equal(typeof saved!.updatedAt, 'number');
  assert.deepEqual(loadSiteElements(SITE_ID), [saved]);
  assert.deepEqual(loadSiteElements(OTHER_SITE_ID), []);
  assert.deepEqual(events, ['imbewu-site-elements-changed']);

  events.length = 0;
  assert.equal(saveSiteElement(SITE_ID, element('outside', { lat: 91 })), null);
  assert.deepEqual(events, []);

  localStorage.failKey = keyFor(SITE_ID);
  assert.equal(saveSiteElement(SITE_ID, element('blocked')), null);
  assert.deepEqual(events, []);
});

test('one site on a shared device keeps each farmer and the signed-out cache separate', () => {
  localStorage.clear();
  const legacyGuest = element('guest', { updatedAt: 1_000 });
  const farmerA = element('farmer-a', { updatedAt: 2_000 });
  const farmerB = element('farmer-b', { updatedAt: 3_000 });

  localStorage.setItem(keyFor(SITE_ID), JSON.stringify([legacyGuest]));
  localStorage.setItem(
    accountLocalStorageKey(keyFor(SITE_ID), 'farmer-a'),
    JSON.stringify([farmerA]),
  );
  localStorage.setItem(
    accountLocalStorageKey(keyFor(SITE_ID), 'farmer-b'),
    JSON.stringify([farmerB]),
  );

  assert.deepEqual(loadSiteElements(SITE_ID), [legacyGuest]);
  assert.deepEqual(loadSiteElements(SITE_ID, 'farmer-a'), [farmerA]);
  assert.deepEqual(loadSiteElements(SITE_ID, 'farmer-b'), [farmerB]);
  assert.deepEqual(loadSiteElements(SITE_ID, 'new-farmer'), []);
});

test('missing and failed deletes create no tombstone or false change event', () => {
  localStorage.clear();
  events.length = 0;
  const saved = saveSiteElement(SITE_ID, element('kept'))!;
  events.length = 0;

  assert.equal(deleteSiteElement(SITE_ID, 'missing'), false);
  assert.deepEqual(readTombstones(deletedKeyFor(SITE_ID)), {});
  assert.deepEqual(events, []);

  localStorage.failKey = keyFor(SITE_ID);
  assert.equal(deleteSiteElement(SITE_ID, saved.id), false);
  localStorage.failKey = null;
  assert.deepEqual(loadSiteElements(SITE_ID), [saved]);
  assert.deepEqual(readTombstones(deletedKeyFor(SITE_ID)), {});
  assert.deepEqual(events, []);
});

test('a successful delete persists both array and tombstone before announcing it', () => {
  localStorage.clear();
  events.length = 0;
  saveSiteElement(SITE_ID, element('delete-me'));
  saveSiteElement(SITE_ID, element('keep-me'));
  events.length = 0;

  assert.equal(deleteSiteElement(SITE_ID, 'delete-me'), true);
  assert.deepEqual(loadSiteElements(SITE_ID).map((row) => row.id), ['keep-me']);
  assert.equal(typeof readTombstones(deletedKeyFor(SITE_ID))['delete-me'], 'number');
  assert.deepEqual(events, ['imbewu-site-elements-changed']);
});

test('cross-device merging uses the shared newest-wins and tombstone rules', () => {
  const now = LOCAL_TOMBSTONE_TTL_MS * 2;
  const remote = [
    element('shared', { label: 'remote old', updatedAt: now - 9000 }),
    element('remote-deleted', { updatedAt: now - 6000 }),
    element('outside', { lat: 91, updatedAt: now - 1000 }),
  ];
  const local = [
    element('shared', { label: 'local new', updatedAt: now - 7000 }),
    element('local-only', { updatedAt: now - 4000 }),
  ];
  const before = structuredClone({ remote, local });

  const merged = mergeSiteElements(
    remote,
    local,
    {
      shared: now - 8000,
      expired: now - LOCAL_TOMBSTONE_TTL_MS,
      invalid: Number.POSITIVE_INFINITY,
    },
    { 'remote-deleted': now - 5000 },
    now,
  );

  assert.deepEqual(merged.items, [
    element('shared', { label: 'local new', updatedAt: now - 7000 }),
    element('local-only', { updatedAt: now - 4000 }),
  ]);
  assert.deepEqual(merged.deleted, {
    shared: now - 8000,
    'remote-deleted': now - 5000,
  });
  assert.deepEqual({ remote, local }, before);
});
