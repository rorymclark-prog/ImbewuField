/*
 * The farmer exchange's device-local listing store, and the exact data
 * composition the board screen performs.
 *
 * The board itself (components/exchange/ExchangeBoard.tsx) is TSX and cannot be
 * imported under `node --test`, which has no JSX transform. What IS testable is
 * everything that matters: the write boundary that coarsens coordinates, the
 * read-side validation, and the precise `searchListings` composition the board
 * feeds its card list from. Those are the parts where a bug is a privacy
 * incident or an empty screen rather than a cosmetic slip.
 */

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const harness: { configured: boolean; currentUid: string | null } = {
  configured: false,
  currentUid: null,
};

Object.assign(globalThis, { __imbewuExchangeHarness: harness });

// lib/account-local-storage.ts reaches for Firebase to namespace keys per
// account. The store under test only cares that the namespacing happens, so a
// two-line stand-in keeps the whole Firebase SDK out of the test process.
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuExchangeHarness;
export const getFirebase = () => ({
  auth: { currentUser: harness.currentUid ? { uid: harness.currentUid } : null },
});
export const isBackendConfigured = () => harness.configured;
`)}`;

const helperUrl = new URL('../lib/account-local-storage.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === helperUrl && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private rows = new Map<string, string>();
  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(key, String(value)); }
  removeItem(key: string): void { this.rows.delete(key); }
  clear(): void { this.rows.clear(); }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
const windowStub = {
  localStorage,
  sessionStorage,
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

Object.defineProperty(globalThis, 'window', { configurable: true, value: windowStub });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorage });

const {
  deleteLocalListing,
  isLocalListing,
  isValidListing,
  loadLocalListings,
  saveLocalListing,
  setLocalListingStatus,
} = await import('../components/exchange/listing-store.ts');

const {
  DEMO_LISTINGS,
  filterListings,
  listingCrop,
  listingCropOptions,
  searchListings,
} = await import('../lib/exchange.ts');

hooks.deregister();

/** The farmer's real homestead, to 6 decimal places — about 10 cm of precision. */
const PRECISE_HOMESTEAD = { lat: -27.726231, lon: 31.963044 };

function draft(over: Partial<Parameters<typeof saveLocalListing>[0]> = {}) {
  return {
    kind: 'offer' as const,
    category: 'produce' as const,
    cropKey: 'swiss-chard',
    title: 'Swiss chard — cutting weekly',
    description: 'About 12 kg a week.',
    qty: 12,
    unit: 'kg' as const,
    price: { type: 'zar' as const, amount: 6, per: 'kg' as const },
    farmerName: 'Nomsa',
    areaText: 'Mkhuze',
    lat: PRECISE_HOMESTEAD.lat,
    lon: PRECISE_HOMESTEAD.lon,
    availableMonth: 8,
    ...over,
  };
}

test('a posted listing never carries the farmer\'s precise homestead coordinate', () => {
  localStorage.clear();
  const [listing] = saveLocalListing(draft());

  // ~1.1 km, the same contract as jitterToNeighbourhood() at the Firestore
  // write. A listing is a farmer-facing object; a 6dp coordinate on one is a
  // stranger being handed directions to a house.
  assert.equal(listing.lat, -27.73);
  assert.equal(listing.lon, 31.96);
  assert.notEqual(listing.lat, PRECISE_HOMESTEAD.lat);
  assert.notEqual(listing.lon, PRECISE_HOMESTEAD.lon);

  // And the precise value is not smuggled through storage either.
  const stored = JSON.stringify(loadLocalListings());
  assert.ok(!stored.includes('27.726231'), 'precise latitude leaked into storage');
  assert.ok(!stored.includes('31.963044'), 'precise longitude leaked into storage');
});

test('a listing with no location is stored with no coordinates rather than a fallback', () => {
  localStorage.clear();
  const [listing] = saveLocalListing(draft({ lat: null, lon: null }));
  assert.equal(listing.lat, null);
  assert.equal(listing.lon, null);
});

test('a farmer\'s own listing is never flagged as sample data, and is always recognisable as theirs', () => {
  localStorage.clear();
  const [listing] = saveLocalListing(draft());
  assert.equal(listing.isDemo, false);
  assert.equal(listing.status, 'active');
  assert.equal(listing.source, 'manual');
  assert.ok(isLocalListing(listing));
  // Every sample row must be the other way round, or the "Sample" badge and the
  // "Yours" badge would land on the same cards.
  assert.ok(DEMO_LISTINGS.every((l) => l.isDemo && !isLocalListing(l)));
});

test('listings round-trip through storage, newest first', () => {
  localStorage.clear();
  saveLocalListing(draft({ title: 'First' }));
  saveLocalListing(draft({ title: 'Second' }));
  const loaded = loadLocalListings();
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].title, 'Second');
  assert.equal(loaded[1].title, 'First');
});

test('a corrupt stored row is dropped without taking the board down with it', () => {
  localStorage.clear();
  const [good] = saveLocalListing(draft({ title: 'Good row' }));
  const key = [...Array(localStorage.length).keys()]
    .map((i) => localStorage.key(i))
    .find((k): k is string => k !== null && k.startsWith('imbewu_exchange_listings_v1'));
  assert.ok(key, 'expected an account-namespaced storage key');

  localStorage.setItem(
    key,
    JSON.stringify([
      good,
      { id: 'broken', kind: 'sideways' },          // not a ListingKind
      { ...good, id: 'no-price', price: { type: 'bitcoin' } },
      { ...good, id: 'nan-qty', qty: 'lots' },
      null,
      'not even an object',
    ]),
  );

  const loaded = loadLocalListings();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, good.id);
  assert.equal(isValidListing({ id: 'broken', kind: 'sideways' }), false);
});

test('a listing can be marked done and deleted', () => {
  localStorage.clear();
  const [listing] = saveLocalListing(draft());
  assert.equal(setLocalListingStatus(listing.id, 'closed')[0].status, 'closed');
  // Closed listings leave the board by default — that is the "mark as done" UI.
  assert.equal(filterListings(loadLocalListings()).length, 0);
  assert.equal(filterListings(loadLocalListings(), { includeClosed: true }).length, 1);
  assert.equal(deleteLocalListing(listing.id).length, 0);
});

test('the board composition: a farmer\'s own listing sits alongside the sample board and sorts by distance', () => {
  localStorage.clear();
  saveLocalListing(draft({ title: 'My chard' }));

  // Exactly what ExchangeBoard renders from.
  const all = [...loadLocalListings(), ...DEMO_LISTINGS];
  const origin = { lat: -27.73, lon: 31.96 };

  const rows = searchListings(all, { sort: 'nearest', origin });
  assert.ok(rows.length > 10, 'expected a populated board');

  // Coarsening is what puts the farmer's own listing and the Mkhuze sample
  // farmer on the SAME point — both round to (-27.73, 31.96) — so they tie at
  // zero and `sortListings` breaks the tie by title. Assert the group, not a
  // winner: an exact-first assertion here would be asserting alphabetical
  // order and calling it distance.
  const nearest = rows.filter((r) => r.km === 0).map((r) => r.listing.title);
  assert.ok(nearest.includes('My chard'), 'the viewer\'s own listing should be at zero distance');
  assert.equal(rows[0].km, 0);
  const mine = rows.find((r) => r.listing.title === 'My chard');
  assert.ok(mine);
  assert.equal(mine.distanceLabel, '< 1 km');

  // Nearest-first really is ascending, and nothing sorts ahead of a known
  // distance on an unknown one.
  const known = rows.filter((r) => r.km !== null).map((r) => r.km as number);
  assert.deepEqual(known, [...known].sort((a, b) => a - b));
  const firstUnknown = rows.findIndex((r) => r.km === null);
  if (firstUnknown !== -1) {
    assert.ok(rows.slice(firstUnknown).every((r) => r.km === null));
  }
});

test('filtering by crop and by category returns real, nameable crops', () => {
  const board = filterListings(DEMO_LISTINGS);
  const options = listingCropOptions(board);
  assert.ok(options.length >= 6, 'expected the sample board to span several crops');

  // The crop chips must resolve against the catalog — a chip whose name cannot
  // be looked up means a listing was filed under a key that does not exist,
  // which is exactly how crop-based discovery silently stops working.
  for (const option of options) {
    const crop = listingCrop({ cropKey: option.cropKey });
    assert.ok(crop, `crop key ${option.cropKey} does not resolve in the catalog`);
    assert.equal(crop.name, option.name);
  }

  const chard = searchListings(DEMO_LISTINGS, { filter: { cropKeys: ['swiss-chard'] } });
  assert.ok(chard.length >= 2);
  assert.ok(chard.every((r) => r.listing.cropKey === 'swiss-chard'));

  const seedlings = searchListings(DEMO_LISTINGS, { filter: { categories: ['seedlings'] } });
  assert.ok(seedlings.length >= 1);
  assert.ok(seedlings.every((r) => r.listing.category === 'seedlings'));
});

test('a distance filter never hides a listing that simply has no coordinates', () => {
  localStorage.clear();
  saveLocalListing(draft({ title: 'No location given', lat: null, lon: null }));
  const all = [...loadLocalListings(), ...DEMO_LISTINGS];

  const near = searchListings(all, {
    filter: { within: { origin: { lat: -27.73, lon: 31.96 }, km: 5 } },
    origin: { lat: -27.73, lon: 31.96 },
  });

  const orphan = near.find((r) => r.listing.title === 'No location given');
  assert.ok(orphan, 'a listing without coordinates must not vanish from a distance filter');
  assert.equal(orphan.km, null);
  assert.equal(orphan.distanceLabel, 'Area unknown');
});
