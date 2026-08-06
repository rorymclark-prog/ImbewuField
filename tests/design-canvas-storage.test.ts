import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private readonly rows = new Map<string, string>();
  failWrites = 0;

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites > 0) {
      this.failWrites -= 1;
      throw new Error('storage unavailable');
    }
    this.rows.set(key, value);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
    this.failWrites = 0;
  }
}

const localStorage = new MemoryStorage();
const browser = new EventTarget() as EventTarget & { localStorage: MemoryStorage };
browser.localStorage = localStorage;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: browser,
});
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: localStorage,
});

const {
  applyRemoteCanvasState,
  CanvasSaveError,
  DESIGN_CANVAS_CHANGED_EVENT,
  loadCanvasState,
  normaliseCanvasState,
  saveCanvasNavigation,
  saveCanvasState,
} = await import('../lib/design-canvas.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
type DesignCanvasState = NonNullable<ReturnType<typeof loadCanvasState>>;

const SITE_ID = 'farm';
const KEY = `imbewu_design_canvas_${SITE_ID}`;

function state(overrides: Partial<DesignCanvasState> = {}): DesignCanvasState {
  return {
    siteId: SITE_ID,
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: [{ id: 'item', defId: 'veg_bed', x: 0.2, y: 0.3 }],
    zones: [{
      id: 'zone',
      zone: 1,
      points: [[0.1, 0.1], [0.5, 0.1], [0.5, 0.5]],
    }],
    lines: [{
      id: 'line',
      kind: 'pipe',
      points: [[0.2, 0.2], [0.8, 0.8]],
    }],
    step: 'water',
    updatedAt: '2026-07-29T00:00:00.000Z',
    rev: 4,
    ...overrides,
  };
}

test('local and cloud canvas paths reject the same malformed frame and geometry states', () => {
  localStorage.clear();
  const valid = state();
  const invalid: unknown[] = [
    null,
    [],
    { ...valid, siteId: 'another-site' },
    { ...valid, frame: { ...valid.frame, centerLat: 91 } },
    { ...valid, frame: { ...valid.frame, zoom: 25 } },
    { ...valid, frame: { ...valid.frame, mPerPx: 0 } },
    { ...valid, items: [{ ...valid.items[0], x: 1.1 }] },
    { ...valid, zones: [{ ...valid.zones[0], points: [[0, 0], [0.5, 0.5]] }] },
    { ...valid, zones: [{ ...valid.zones[0], points: [[0, 0], [0.5, 0], [2, 0.5]] }] },
    { ...valid, lines: [{ ...valid.lines[0], points: [[0.2, 0.2]] }] },
    { ...valid, step: 'finished' },
    { ...valid, updatedAt: 'not-a-date' },
    { ...valid, customBase: { url: 'photo', mPerPx: 0.2, uploadedAt: 'not-a-date' } },
    { ...valid, baseMode: 'blank' },
    { ...valid, baseMode: 'blank', blankMPerPx: 0 },
    { ...valid, localWind: { prevailingFrom: 'south', recordedAt: valid.updatedAt } },
    { ...valid, dailyWaterUseL: Number.POSITIVE_INFINITY },
  ];

  assert.deepEqual(normaliseCanvasState(valid, SITE_ID), valid);
  for (const value of invalid) {
    assert.equal(normaliseCanvasState(value, SITE_ID), null);
    localStorage.setItem(KEY, JSON.stringify(value));
    assert.equal(loadCanvasState(SITE_ID), null);
  }
});

test('blank base reloads with the inherited ground scale, never a fresh satellite estimate', () => {
  localStorage.clear();
  const blank = state({
    baseMode: 'blank',
    blankMPerPx: 0.137,
    useCustomBase: false,
    customBase: { url: 'https://example/drone.jpg', mPerPx: 0.137, uploadedAt: '2026-08-06T00:00:00.000Z' },
  });

  assert.ok(saveCanvasState(blank));
  const reloaded = loadCanvasState(SITE_ID);
  assert.equal(reloaded?.baseMode, 'blank');
  assert.equal(reloaded?.blankMPerPx, 0.137);
  assert.equal(reloaded?.customBase?.url, blank.customBase?.url);
});

test('legacy zone numbers repair on read without mutating the decoded source', () => {
  localStorage.clear();
  const legacy = {
    ...state(),
    zones: [{ ...state().zones[0], zone: '2' }],
  } as unknown as DesignCanvasState;
  const before = structuredClone(legacy);
  localStorage.setItem(KEY, JSON.stringify(legacy));

  const loaded = loadCanvasState(SITE_ID);

  assert.equal(loaded?.zones[0].zone, 2);
  assert.deepEqual(legacy, before);
});

test('one canvas site on a shared device stays isolated per farmer', () => {
  localStorage.clear();
  const guest = state({ rev: 1, step: 'base' });
  const farmerA = state({ rev: 2, step: 'water' });
  const farmerB = state({ rev: 3, step: 'planting' });

  localStorage.setItem(KEY, JSON.stringify(guest));
  localStorage.setItem(accountLocalStorageKey(KEY, 'farmer-a'), JSON.stringify(farmerA));
  localStorage.setItem(accountLocalStorageKey(KEY, 'farmer-b'), JSON.stringify(farmerB));

  assert.deepEqual(loadCanvasState(SITE_ID), guest);
  assert.deepEqual(loadCanvasState(SITE_ID, 'farmer-a'), farmerA);
  assert.deepEqual(loadCanvasState(SITE_ID, 'farmer-b'), farmerB);
  assert.equal(loadCanvasState(SITE_ID, 'new-farmer'), null);

  const newerA = state({ rev: 4, step: 'review' });
  applyRemoteCanvasState(newerA, 'farmer-a');
  assert.deepEqual(loadCanvasState(SITE_ID, 'farmer-a'), newerA);
  assert.deepEqual(loadCanvasState(SITE_ID, 'farmer-b'), farmerB);
  assert.deepEqual(loadCanvasState(SITE_ID), guest);
});

test('a real local save increments the caller revision, persists first, and never mutates geometry', () => {
  localStorage.clear();
  const source = state();
  const before = structuredClone(source);
  let observed: DesignCanvasState | null = null;
  const listener = () => {
    observed = loadCanvasState(SITE_ID);
  };
  browser.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);

  const saved = saveCanvasState(source);

  browser.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);
  assert.equal(saved.rev, (source.rev ?? 0) + 1);
  assert.ok(Number.isFinite(Date.parse(saved.updatedAt)));
  assert.deepEqual(observed, saved);
  assert.deepEqual(loadCanvasState(SITE_ID), saved);
  assert.deepEqual(source, before);
});

test('invalid and quota-failed saves never announce a design that was not persisted', () => {
  localStorage.clear();
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);

  assert.throws(
    () => saveCanvasState({ ...state(), frame: { ...state().frame, mPerPx: 0 } }),
    CanvasSaveError,
  );
  localStorage.failWrites = 2;
  assert.throws(() => saveCanvasState(state()), CanvasSaveError);

  browser.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);
  assert.equal(changes, 0);
  assert.equal(loadCanvasState(SITE_ID), null);
});

test('remote and navigation writes preserve timestamps and revisions verbatim', () => {
  localStorage.clear();
  const remote = state({ rev: 12, updatedAt: '2026-01-01T00:00:00.000Z', step: 'review' });
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);

  applyRemoteCanvasState(remote);
  assert.deepEqual(loadCanvasState(SITE_ID), remote);
  saveCanvasNavigation({ ...remote, step: 'glossy' });
  assert.deepEqual(loadCanvasState(SITE_ID), { ...remote, step: 'glossy' });

  applyRemoteCanvasState({ ...remote, lines: [{ ...remote.lines[0], points: [] }] });
  browser.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, listener);
  assert.equal(changes, 2);
  assert.deepEqual(loadCanvasState(SITE_ID), { ...remote, step: 'glossy' });
});

test('normaliseCanvasState preserves species metadata properties on items', () => {
  const withSpecies = state({
    items: [
      {
        id: 'tree1',
        defId: 'shade_tree',
        x: 0.5,
        y: 0.5,
        speciesId: 'fever_tree',
        speciesBotanical: 'Acacia xanthophloea',
        speciesCrownForm: 'dome-shaped',
        speciesHeightM: 15,
        speciesWidthM: 10
      },
    ],
  });
  const loaded = normaliseCanvasState(JSON.parse(JSON.stringify(withSpecies)), SITE_ID);
  const item = loaded!.items[0];
  assert.equal(item.speciesId, 'fever_tree');
  assert.equal(item.speciesBotanical, 'Acacia xanthophloea');
  assert.equal(item.speciesCrownForm, 'dome-shaped');
  assert.equal(item.speciesHeightM, 15);
  assert.equal(item.speciesWidthM, 10);
});
