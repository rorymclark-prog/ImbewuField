import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

type StoredDoc = Record<string, unknown>;
type FakeFirestoreState = {
  docs: Map<string, StoredDoc>;
  currentUid: string | null;
};

const fakeState: FakeFirestoreState = {
  docs: new Map(),
  currentUid: 'farmer-b',
};

Object.assign(globalThis, {
  __imbewuAccountIsolationFirestore: fakeState,
});

const moduleUrl = (source: string) =>
  `data:text/javascript,${encodeURIComponent(source)}`;

const fakeFirestoreModule = moduleUrl(`
const state = globalThis.__imbewuAccountIsolationFirestore;

export const doc = (_db, ...parts) => parts.join('/');

const snapshot = (ref) => ({
  exists: () => state.docs.has(ref),
  data: () => state.docs.get(ref),
  metadata: { hasPendingWrites: false },
});

export const getDoc = async (ref) => snapshot(ref);

export const setDoc = async (ref, data) => {
  state.docs.set(ref, structuredClone(data));
};

export const runTransaction = async (_db, update) => update({
  get: async (ref) => snapshot(ref),
  set: (ref, data) => {
    state.docs.set(ref, structuredClone(data));
  },
});

export const onSnapshot = () => () => {};
export const serverTimestamp = () => 'SERVER_TIMESTAMP';
`);

const fakeFirebaseInitModule = moduleUrl(`
export const getFirebase = () => ({
  db: {},
  auth: {
    currentUser: globalThis.__imbewuAccountIsolationFirestore.currentUid
      ? { uid: globalThis.__imbewuAccountIsolationFirestore.currentUid }
      : null,
  },
});
`);

// This test drives the real reconciliation code. Only its network transport is replaced:
// Firestore reads/writes land in the Map above, making the account-switch sequence deterministic
// and runnable in the normal offline npm test suite.
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const fromUserSync = context.parentURL?.includes('/lib/user-sync.ts') ?? false;
    if (fromUserSync && specifier === 'firebase/firestore') {
      return { url: fakeFirestoreModule, shortCircuit: true };
    }
    if (fromUserSync && specifier === './firebase/init') {
      return { url: fakeFirebaseInitModule, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  private rows = new Map<string, string>();

  get length(): number {
    return this.rows.size;
  }

  key(index: number): string | null {
    return [...this.rows.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.rows.set(key, String(value));
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: sessionStorage,
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage,
    sessionStorage,
    dispatchEvent: () => true,
  },
});
if (typeof globalThis.CustomEvent === 'undefined') {
  Object.defineProperty(globalThis, 'CustomEvent', {
    configurable: true,
    value: class<T = unknown> extends Event {
      detail: T | undefined;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type);
        this.detail = init?.detail;
      }
    },
  });
}

const { subscribeUserMapData } = await import('../lib/user-sync.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

const pathFor = (uid: string, kind: 'places' | 'water' | 'shapes' | 'design') =>
  `user_map_data/${uid}/data/${kind}`;

function objectField(doc: StoredDoc | undefined, field: string): Record<string, unknown> {
  const value = doc?.[field];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function arrayField(doc: StoredDoc | undefined, field: string): unknown[] {
  return Array.isArray(doc?.[field]) ? doc[field] as unknown[] : [];
}

function shapeFeatures(doc: StoredDoc | undefined): unknown[] {
  if (typeof doc?.shapesJson !== 'string') return [];
  try {
    const parsed = JSON.parse(doc.shapesJson);
    return Array.isArray(parsed?.features) ? parsed.features : [];
  } catch {
    return [];
  }
}

function designStore(doc: StoredDoc | undefined): Record<string, unknown> {
  if (typeof doc?.designJson !== 'string') return {};
  try {
    const parsed = JSON.parse(doc.designJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

type LocalFarmerFixture = {
  place: Record<string, unknown>;
  placeTombstoneId: string;
  placeTombstoneAt: number;
  water: Record<string, unknown>;
  waterTombstoneId: string;
  waterTombstoneAt: number;
  shape: Record<string, unknown>;
  siteId: string;
  design: Record<string, unknown>;
  sentinel: string;
};

function seedScopedFarmerLocal(
  uid: string,
  label: string,
  now: number,
): LocalFarmerFixture {
  const sentinel = `${label.toUpperCase()}_ONLY_SENTINEL`;
  const place = {
    id: `${label}-place`,
    name: `${sentinel} place`,
    lat: -33.9,
    lon: 18.4,
    biome: `${label}-biome`,
    rainfall: 500,
    elevation: 100,
    savedAt: '2026-07-29T00:00:00.000Z',
    updatedAt: now - 2_000,
  };
  const placeTombstoneId = `${label}-deleted-place`;
  const placeTombstoneAt = now - 1_000;
  const water = {
    id: `${label}-water`,
    name: `${sentinel} water`,
    category: 'Tank',
    lat: -33.9,
    lon: 18.4,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: now - 2_000,
  };
  const waterTombstoneId = `${label}-deleted-water`;
  const waterTombstoneAt = now - 1_000;
  const shape = {
    type: 'Feature',
    id: `${label}-shape`,
    properties: { featureType: 'site', name: `${sentinel} shape` },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [18.4, -33.9],
        [18.401, -33.9],
        [18.401, -33.901],
        [18.4, -33.9],
      ]],
    },
  };
  const siteId = `site:${label}`;
  const design = {
    siteId,
    layers: [],
    generatedPlan: null,
    title: `${sentinel} design`,
    updatedAt: '2026-07-29T00:00:00.000Z',
  };

  localStorage.setItem(
    accountLocalStorageKey('permamap_saved_places', uid),
    JSON.stringify([place]),
  );
  localStorage.setItem(
    accountLocalStorageKey('permamap_saved_places_deleted', uid),
    JSON.stringify({ [placeTombstoneId]: placeTombstoneAt }),
  );
  localStorage.setItem(
    accountLocalStorageKey('imbewu_water_points', uid),
    JSON.stringify([water]),
  );
  localStorage.setItem(
    accountLocalStorageKey('imbewu_water_points_deleted', uid),
    JSON.stringify({ [waterTombstoneId]: waterTombstoneAt }),
  );
  localStorage.setItem(
    accountLocalStorageKey('imbewu_farm_shapes', uid),
    JSON.stringify({ type: 'FeatureCollection', features: [shape] }),
  );
  localStorage.setItem(
    accountLocalStorageKey('imbewu_design_studio_v1', uid),
    JSON.stringify({ [siteId]: design }),
  );

  return {
    place,
    placeTombstoneId,
    placeTombstoneAt,
    water,
    waterTombstoneId,
    waterTombstoneAt,
    shape,
    siteId,
    design,
    sentinel,
  };
}

function reconciledFarmer(uid: string) {
  return {
    places: arrayField(fakeState.docs.get(pathFor(uid, 'places')), 'places'),
    placeTombstones: objectField(fakeState.docs.get(pathFor(uid, 'places')), 'deleted'),
    waterPoints: arrayField(fakeState.docs.get(pathFor(uid, 'water')), 'points'),
    waterTombstones: objectField(fakeState.docs.get(pathFor(uid, 'water')), 'deleted'),
    shapeFeatures: shapeFeatures(fakeState.docs.get(pathFor(uid, 'shapes'))),
    designBySite: designStore(fakeState.docs.get(pathFor(uid, 'design'))),
  };
}

async function reconcile(uid: string): Promise<() => void> {
  let finish!: () => void;
  let fail!: (error: Error) => void;
  const merged = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const timeout = setTimeout(
    () => fail(new Error(`subscribeUserMapData did not finish reconciliation for ${uid}`)),
    2_000,
  );
  const unsubscribe = subscribeUserMapData(uid, {
    onMergeDone: finish,
  });
  try {
    await merged;
    return unsubscribe;
  } finally {
    clearTimeout(timeout);
  }
}

function assertOnlyOwnScopedData(
  uid: string,
  own: LocalFarmerFixture,
  foreign: LocalFarmerFixture,
): void {
  const actual = reconciledFarmer(uid);
  assert.deepEqual(actual, {
    places: [own.place],
    placeTombstones: { [own.placeTombstoneId]: own.placeTombstoneAt },
    waterPoints: [own.water],
    waterTombstones: { [own.waterTombstoneId]: own.waterTombstoneAt },
    shapeFeatures: [own.shape],
    designBySite: { [own.siteId]: own.design },
  });
  assert.equal(
    JSON.stringify(actual).includes(foreign.sentinel),
    false,
    `${foreign.sentinel} reached ${uid}'s Firestore documents`,
  );
  assert.equal(
    Object.hasOwn(actual.placeTombstones, foreign.placeTombstoneId),
    false,
    `${foreign.placeTombstoneId} reached ${uid}'s place tombstones`,
  );
  assert.equal(
    Object.hasOwn(actual.waterTombstones, foreign.waterTombstoneId),
    false,
    `${foreign.waterTombstoneId} reached ${uid}'s water tombstones`,
  );
}

test("opening farmer B's map cannot reconcile farmer A's bare local cache into B's Firestore documents", async () => {
  localStorage.clear();
  sessionStorage.clear();
  fakeState.docs.clear();
  fakeState.currentUid = 'farmer-b';

  const now = Date.now();
  const foreignPlace = {
    id: 'foreign-place',
    name: 'FOREIGN PLACE FROM FARMER A',
    lat: -33.9,
    lon: 18.4,
    biome: 'foreign-biome',
    rainfall: 500,
    elevation: 100,
    savedAt: '2026-07-29T00:00:00.000Z',
    updatedAt: now - 2_000,
  };
  const foreignWater = {
    id: 'foreign-water',
    name: 'FOREIGN WATER FROM FARMER A',
    category: 'Tank',
    lat: -33.9,
    lon: 18.4,
    createdAt: '2026-07-29T00:00:00.000Z',
    updatedAt: now - 2_000,
  };
  const foreignShapes = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'foreign-shape',
      properties: { featureType: 'site', name: 'FOREIGN SHAPE FROM FARMER A' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [18.4, -33.9],
          [18.401, -33.9],
          [18.401, -33.901],
          [18.4, -33.9],
        ]],
      },
    }],
  };
  const foreignSiteId = 'site:-33.90000,18.40000';
  const foreignDesign = {
    [foreignSiteId]: {
      siteId: foreignSiteId,
      layers: [],
      generatedPlan: null,
      updatedAt: '2026-07-29T00:00:00.000Z',
    },
  };

  // These are exactly the six values left behind by farmer A on today's app: four bare
  // local-first caches plus the two deletion maps consumed by the same reconcile transactions.
  // There is deliberately no owner marker: that is both the current production state and the
  // dangerous first run after any marker-based isolation fix ships.
  localStorage.setItem('permamap_saved_places', JSON.stringify([foreignPlace]));
  localStorage.setItem('permamap_saved_places_deleted', JSON.stringify({
    'foreign-deleted-place': now - 1_000,
  }));
  localStorage.setItem('imbewu_water_points', JSON.stringify([foreignWater]));
  localStorage.setItem('imbewu_water_points_deleted', JSON.stringify({
    'foreign-deleted-water': now - 1_000,
  }));
  localStorage.setItem('imbewu_farm_shapes', JSON.stringify(foreignShapes));
  localStorage.setItem('imbewu_design_studio_v1', JSON.stringify(foreignDesign));

  let finish!: () => void;
  let fail!: (error: Error) => void;
  const merged = new Promise<void>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const timeout = setTimeout(
    () => fail(new Error('subscribeUserMapData did not finish its initial reconciliation')),
    2_000,
  );
  const unsubscribe = subscribeUserMapData('farmer-b', {
    onMergeDone: finish,
  });

  await merged;
  clearTimeout(timeout);
  unsubscribe();

  const actual = {
    places: arrayField(fakeState.docs.get(pathFor('farmer-b', 'places')), 'places'),
    placeTombstones: objectField(fakeState.docs.get(pathFor('farmer-b', 'places')), 'deleted'),
    waterPoints: arrayField(fakeState.docs.get(pathFor('farmer-b', 'water')), 'points'),
    waterTombstones: objectField(fakeState.docs.get(pathFor('farmer-b', 'water')), 'deleted'),
    shapeFeatures: shapeFeatures(fakeState.docs.get(pathFor('farmer-b', 'shapes'))),
    designBySite: designStore(fakeState.docs.get(pathFor('farmer-b', 'design'))),
  };

  assert.deepEqual(actual, {
    places: [],
    placeTombstones: {},
    waterPoints: [],
    waterTombstones: {},
    shapeFeatures: [],
    designBySite: {},
  });
});

test('a direct farmer A to farmer B switch reconciles only B scoped data into B Firestore', async () => {
  localStorage.clear();
  sessionStorage.clear();
  fakeState.docs.clear();
  const now = Date.now();
  const farmerA = seedScopedFarmerLocal('farmer-a', 'farmer-a', now);
  const farmerB = seedScopedFarmerLocal('farmer-b', 'farmer-b', now);

  fakeState.currentUid = 'farmer-a';
  const stopA = await reconcile('farmer-a');

  // A remains subscribed while auth changes directly to B. This is the shared-device route
  // permitted by /login; it must not require an intervening sign-out cleanup to be safe.
  fakeState.currentUid = 'farmer-b';
  const stopB = await reconcile('farmer-b');

  assertOnlyOwnScopedData('farmer-b', farmerB, farmerA);
  stopB();
  stopA();
});

test('farmer A to signed-out to farmer B keeps A scoped data out while B data still reconciles', async () => {
  localStorage.clear();
  sessionStorage.clear();
  fakeState.docs.clear();
  const now = Date.now();
  const farmerA = seedScopedFarmerLocal('farmer-a', 'farmer-a', now);
  const farmerB = seedScopedFarmerLocal('farmer-b', 'farmer-b', now);

  fakeState.currentUid = 'farmer-a';
  const stopA = await reconcile('farmer-a');

  // Represent the auth callback's real null identity before B signs in. Account separation
  // must not depend on whether the browser sees this state or takes the direct-switch route.
  fakeState.currentUid = null;
  stopA();
  fakeState.currentUid = 'farmer-b';
  const stopB = await reconcile('farmer-b');

  assertOnlyOwnScopedData('farmer-b', farmerB, farmerA);
  stopB();
});
