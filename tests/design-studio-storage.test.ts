import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private readonly rows = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('storage unavailable');
    this.rows.set(key, value);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }

  clear(): void {
    this.rows.clear();
    this.failWrites = false;
  }
}

const localStorage = new MemoryStorage();
const browser = new EventTarget() as EventTarget & { localStorage: MemoryStorage };
browser.localStorage = localStorage;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: browser,
});

const {
  DESIGN_STUDIO_KEY,
  loadDesignStudioState,
  normaliseDesignStudioState,
  saveDesignStudioState,
} = await import('../lib/design-studio.ts');
const { MAP_STATE_EVENT } = await import('../lib/map-sync.ts');
type DesignStudioState = ReturnType<typeof loadDesignStudioState>;
type DesignLayer = DesignStudioState['layers'][number];

const SITE_ID = 'site:-29.00000,31.00000';

function layer(id: string, overrides: Partial<DesignLayer> = {}): DesignLayer {
  return {
    id,
    featureId: `feature-${id}`,
    siteId: SITE_ID,
    name: id,
    layerType: 'cultivation',
    featureType: 'site',
    geometryType: 'Polygon',
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [31, -29],
        [31.001, -29],
        [31.001, -29.001],
        [31, -29],
      ]],
    },
    areaM2: 100,
    areaLabel: '100 m2',
    source: 'manual_map',
    confidenceScore: 1,
    approved: true,
    locked: true,
    color: '#8CEB6A',
    updatedAt: '2026-07-29T00:00:00.000Z',
    ...overrides,
  };
}

function state(overrides: Partial<DesignStudioState> = {}): DesignStudioState {
  const layers = overrides.layers ?? [layer('bed')];
  return {
    siteId: SITE_ID,
    layers,
    generatedPlan: {
      id: 'plan',
      generatedAt: '2026-07-29T00:00:00.000Z',
      siteId: SITE_ID,
      summary: 'Plan',
      lockedLayerIds: layers.map((row) => row.id),
      sectorMap: [{ title: 'Sector', body: 'Body', layerIds: layers.map((row) => row.id) }],
      zoneMap: [],
      waterMap: [],
      opportunityMap: [],
      exportNotes: ['Keep north up'],
    },
    updatedAt: '2026-07-29T00:00:00.000Z',
    ...overrides,
  };
}

test('normalisation returns a deep presentation copy and never mutates saved geometry', () => {
  const source = state();
  const before = structuredClone(source);
  const first = normaliseDesignStudioState(source, SITE_ID);
  const second = normaliseDesignStudioState(source, SITE_ID);

  assert.deepEqual(first, source);
  assert.deepEqual(second, source);
  assert.notEqual(first, source);
  assert.notEqual(first?.layers[0].geometry, source.layers[0].geometry);
  assert.notEqual(first, second);

  first!.layers.length = 0;
  assert.deepEqual(source, before);
  assert.equal(second!.layers.length, 1);
});

test('bad layers are quarantined without hiding valid geometry, and stale plans are dropped', () => {
  const valid = layer('valid');
  const bad = layer('bad', {
    geometry: { type: 'Point', coordinates: [181, -29] },
    geometryType: 'Point',
  });
  const source = state({
    layers: [valid, bad, { ...valid }],
    generatedPlan: {
      ...state({ layers: [valid] }).generatedPlan!,
      lockedLayerIds: [valid.id, bad.id],
    },
  });

  const clean = normaliseDesignStudioState(source, SITE_ID);

  assert.deepEqual(clean?.layers, [valid]);
  assert.equal(clean?.generatedPlan, null);
  assert.equal(source.layers.length, 3);
});

test('malformed state identity, timestamps and all-corrupt geometry fail closed', () => {
  const valid = state();
  const invalid: unknown[] = [
    null,
    [],
    { ...valid, siteId: 'another-site' },
    { ...valid, layers: null },
    { ...valid, updatedAt: 'not-a-date' },
    { ...valid, layers: [layer('bad', { areaM2: Number.POSITIVE_INFINITY })] },
    { ...valid, layers: [layer('bad', { geometryType: 'Point' })] },
  ];

  for (const value of invalid) {
    assert.equal(normaliseDesignStudioState(value, SITE_ID), null);
  }
});

test('local loads validate each site slot and bind the requested site', () => {
  localStorage.clear();
  const valid = state();
  localStorage.setItem(DESIGN_STUDIO_KEY, JSON.stringify({
    [SITE_ID]: valid,
    'site:-30.00000,30.00000': { ...valid, siteId: SITE_ID },
  }));

  assert.deepEqual(loadDesignStudioState(SITE_ID), valid);
  const missing = loadDesignStudioState('site:-30.00000,30.00000');
  assert.equal(missing.siteId, 'site:-30.00000,30.00000');
  assert.deepEqual(missing.layers, []);
  assert.equal(missing.generatedPlan, null);
});

test('saving stamps and announces only a successfully persisted validated copy', () => {
  localStorage.clear();
  let changes = 0;
  const listener = () => { changes += 1; };
  browser.addEventListener(MAP_STATE_EVENT, listener);
  const source = state();
  const before = structuredClone(source);

  const saved = saveDesignStudioState(source);

  assert.ok(Date.parse(saved.updatedAt) >= Date.parse(source.updatedAt));
  assert.deepEqual(loadDesignStudioState(SITE_ID), saved);
  assert.deepEqual(source, before);
  assert.equal(changes, 1);

  localStorage.failWrites = true;
  assert.throws(() => saveDesignStudioState(source), /storage unavailable/);
  assert.equal(changes, 1);
  browser.removeEventListener(MAP_STATE_EVENT, listener);
});

test('invalid generated-plan structure cannot reach plan cards or report code', () => {
  localStorage.clear();
  const source = state({
    generatedPlan: {
      ...state().generatedPlan!,
      sectorMap: null as unknown as NonNullable<DesignStudioState['generatedPlan']>['sectorMap'],
    },
  });

  const saved = saveDesignStudioState(source, { notify: false });

  assert.deepEqual(saved.layers, source.layers);
  assert.equal(saved.generatedPlan, null);
  assert.deepEqual(loadDesignStudioState(SITE_ID), saved);
});
