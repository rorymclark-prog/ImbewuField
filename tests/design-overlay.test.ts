import test from 'node:test';
import assert from 'node:assert/strict';

import type { DesignCanvasState, LineShape } from '../lib/design-canvas.ts';
import { buildDesignOverlay } from '../lib/design-overlay.ts';
import { GROUND_FEATURES, ZONE_COLORS } from '../lib/design-elements.ts';
import { WATER_ROUTE_STYLE, type WaterRouteKind } from '../lib/water-cartography.ts';

class MemoryStorage {
  rows = new Map<string, string>();
  getItem(key: string) { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(String(key), String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
}

function install(state?: unknown, siteId = 'site:test') {
  const local = new MemoryStorage();
  if (state !== undefined) {
    local.setItem(`imbewu_design_canvas_${siteId}`, JSON.stringify(state));
  }
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: local },
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  return local;
}

function canvas(overrides: Partial<DesignCanvasState> = {}): DesignCanvasState {
  return {
    siteId: 'site:test',
    frame: {
      centerLng: 31,
      centerLat: -29,
      zoom: 18,
      imgW: 960,
      imgH: 640,
      mPerPx: 0.4,
    },
    items: [],
    zones: [],
    lines: [],
    step: 'review',
    updatedAt: '2026-01-01T00:00:00.000Z',
    rev: 1,
    ...overrides,
  };
}

function allCoordinatesFinite(feature: GeoJSON.Feature): boolean {
  const coords = feature.geometry && 'coordinates' in feature.geometry
    ? feature.geometry.coordinates
    : [];
  const visit = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    return Array.isArray(value) && value.every(visit);
  };
  return visit(coords);
}

test('missing and genuinely empty designs do not expose a map toggle', () => {
  install();
  assert.equal(buildDesignOverlay('site:test'), null);
  install(canvas());
  assert.equal(buildDesignOverlay('site:test'), null);
});

test('valid zones, lines and items project to finite real-world geometry', () => {
  const state = canvas({
    zones: [{
      id: 'zone',
      zone: 2,
      points: [[0.1, 0.1], [0.8, 0.1], [0.5, 0.8]],
    }],
    lines: [{
      id: 'line',
      kind: 'swale',
      points: [[0.2, 0.2], [0.7, 0.7]],
    }],
    items: [{ id: 'tank', defId: 'jojo_2500', x: 0.5, y: 0.5 }],
  });
  install(state);
  const overlay = buildDesignOverlay('site:test');
  assert.ok(overlay);
  assert.equal(overlay.collection.features.length, 2);
  assert.equal(overlay.items.length, 1);
  assert.ok(overlay.collection.features.every(allCoordinatesFinite));
  assert.ok(Number.isFinite(overlay.items[0].lng));
  assert.ok(Number.isFinite(overlay.items[0].lat));
  assert.ok(Math.abs(overlay.items[0].lng - state.frame.centerLng) < 1e-9);
  assert.ok(Math.abs(overlay.items[0].lat - state.frame.centerLat) < 1e-9);

  const polygon = overlay.collection.features[0].geometry;
  assert.equal(polygon.type, 'Polygon');
  if (polygon.type === 'Polygon') {
    assert.deepEqual(polygon.coordinates[0][0], polygon.coordinates[0].at(-1));
  }
});

test('building an overlay never rewrites the saved design geometry', () => {
  const state = canvas({
    zones: [{
      id: 'zone',
      zone: 1,
      points: [[0.1, 0.1], [0.8, 0.1], [0.5, 0.8]],
    }],
  });
  const local = install(state);
  const before = local.getItem('imbewu_design_canvas_site:test');
  buildDesignOverlay('site:test');
  assert.equal(local.getItem('imbewu_design_canvas_site:test'), before);
});

test('every water route uses the shared cartographic color authority', () => {
  const kinds = Object.keys(WATER_ROUTE_STYLE) as WaterRouteKind[];
  install(canvas({
    lines: kinds.map((kind, index) => ({
      id: kind,
      kind,
      points: [[0.1, 0.1 + index * 0.1], [0.9, 0.1 + index * 0.1]],
    })),
  }));
  const overlay = buildDesignOverlay('site:test');
  assert.ok(overlay);
  for (const feature of overlay.collection.features) {
    const kind = feature.properties?.lineKind as WaterRouteKind;
    assert.equal(feature.properties?.stroke, WATER_ROUTE_STYLE[kind].color, kind);
  }
});

test('ground features and effort zones keep distinct kinds and palette authorities', () => {
  install(canvas({
    zones: [
      {
        id: 'house',
        zone: 0,
        feature: 'house',
        points: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]],
      },
      {
        id: 'zone',
        zone: 3,
        points: [[0.5, 0.5], [0.8, 0.5], [0.7, 0.8]],
      },
    ],
  }));
  const overlay = buildDesignOverlay('site:test');
  assert.ok(overlay);
  const [ground, zone] = overlay.collection.features;
  assert.equal(ground.properties?.kind, 'ground');
  assert.equal(ground.properties?.fill, GROUND_FEATURES.house.color);
  assert.equal(zone.properties?.kind, 'zone');
  assert.equal(zone.properties?.fill, ZONE_COLORS[3]);
});

test('invalid and degenerate shapes are quarantined instead of poisoning GeoJSON', () => {
  const invalidLines: LineShape[] = [
    { id: 'empty', kind: 'swale', points: [] },
    { id: 'same', kind: 'pipe', points: [[0.2, 0.2], [0.2, 0.2]] },
    { id: 'nan', kind: 'drip', points: [[0, 0], [Number.NaN, 1]] },
    { id: 'outside', kind: 'fence', points: [[0, 0], [2, 1]] },
  ];
  install(canvas({
    lines: invalidLines,
    zones: [{
      id: 'bad-zone',
      zone: 1,
      points: [[0, 0], [1, 0], [Infinity, 1]],
    }],
    items: [{ id: 'bad-item', defId: 'jojo_2500', x: Number.NaN, y: 0.5 }],
  }));
  assert.equal(buildDesignOverlay('site:test'), null);
});

test('zero-area and self-crossing rings never become GeoJSON polygons', () => {
  const star: Array<[number, number]> = [
    [0.5, 0.05],
    [0.76, 0.85],
    [0.08, 0.35],
    [0.92, 0.35],
    [0.24, 0.85],
  ];
  install(canvas({
    zones: [
      {
        id: 'collinear',
        zone: 1,
        points: [[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]],
      },
      {
        id: 'crossing',
        zone: 2,
        points: star,
      },
    ],
  }));
  assert.equal(buildDesignOverlay('site:test'), null);
});

test('valid concave and explicitly closed rings remain renderable', () => {
  const concave: Array<[number, number]> = [
    [0.1, 0.1],
    [0.8, 0.1],
    [0.4, 0.4],
    [0.8, 0.8],
    [0.1, 0.8],
  ];
  const closed = [...concave, concave[0]];
  for (const points of [concave, closed]) {
    install(canvas({
      zones: [{ id: 'concave', zone: 2, points }],
    }));
    const overlay = buildDesignOverlay('site:test');
    assert.ok(overlay);
    assert.equal(overlay.collection.features.length, 1);
    assert.equal(overlay.collection.features[0].geometry.type, 'Polygon');
  }
});

test('malformed collection fields and frames degrade to no overlay', () => {
  for (const patch of [
    { centerLng: Infinity },
    { centerLat: 91 },
    { zoom: -1 },
    { zoom: 31 },
    { imgW: 0 },
    { imgH: Number.NaN },
  ]) {
    const state = canvas({
      frame: { ...canvas().frame, ...patch },
      items: [{ id: 'tank', defId: 'jojo_2500', x: 0.5, y: 0.5 }],
    });
    install(state);
    assert.equal(buildDesignOverlay('site:test'), null);
  }

  install({
    ...canvas(),
    zones: { not: 'an array' },
    lines: 'bad',
    items: null,
  });
  assert.equal(buildDesignOverlay('site:test'), null);
});

test('unknown features fall back to zones, and duplicate marker ids appear once', () => {
  install({
    ...canvas(),
    zones: [{
      id: 'future',
      zone: 2,
      feature: 'future_kind',
      points: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]],
    }],
    items: [
      { id: 'same', defId: 'jojo_2500', x: 0.4, y: 0.4, label: '   ' },
      { id: 'same', defId: 'tap_point', x: 0.6, y: 0.6 },
      { id: 'unknown', defId: 'missing', x: 0.5, y: 0.5 },
    ],
  });
  const overlay = buildDesignOverlay('site:test');
  assert.ok(overlay);
  assert.equal(overlay.collection.features[0].properties?.kind, 'zone');
  assert.equal(overlay.items.length, 1);
  assert.notEqual(overlay.items[0].label.trim(), '');
});
