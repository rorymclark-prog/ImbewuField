import test from 'node:test';
import assert from 'node:assert/strict';

import { projectorForFrame } from '../lib/design-canvas.ts';
import {
  designStateToGeoJSON,
  frameIsGeoRegistered,
  type DesignMapFrame,
  type DesignMapState,
} from '../lib/design-map-layer.ts';
import { ELEMENTS_BY_ID, GROUND_FEATURES, ZONE_COLORS, ZONE_DEFS } from '../lib/design-elements.ts';
import { WATER_ROUTE_STYLE } from '../lib/water-cartography.ts';

// The converter is PURE — these tests deliberately install no window/localStorage. If an
// import or a call ever needs one, that is a regression against the Phase 3 contract.

const FRAME: DesignMapFrame = {
  centerLng: 31,
  centerLat: -29,
  zoom: 18,
  imgW: 960,
  imgH: 640,
  mPerPx: 0.4,
};

function state(overrides: Partial<DesignMapState> = {}): DesignMapState {
  return { items: [], zones: [], lines: [], ...overrides };
}

const EMPTY = { type: 'FeatureCollection', features: [] };

test('empty design state yields an empty collection', () => {
  assert.deepEqual(designStateToGeoJSON(state(), FRAME), EMPTY);
  assert.deepEqual(designStateToGeoJSON(null, FRAME), EMPTY);
  assert.deepEqual(designStateToGeoJSON(undefined, FRAME), EMPTY);
});

test('real-world coordinates round-trip through the canvas within 1e-6 degrees', () => {
  // Start from KNOWN lng/lat, project into the frame with the Studio's own projector, and
  // demand the converter hands the same earth coordinates back.
  const project = projectorForFrame(FRAME);
  const ringLngLat: Array<[number, number]> = [
    [30.9995, -28.9996],
    [31.0006, -28.9996],
    [31.0003, -29.0005],
  ];
  const lineLngLat: Array<[number, number]> = [
    [30.9996, -29.0004],
    [31.0005, -28.9997],
  ];
  const itemLngLat: [number, number] = [31.0002, -29.0002];

  const norm = (p: [number, number]) => project(p);
  for (const p of [...ringLngLat, ...lineLngLat, itemLngLat].map(norm)) {
    assert.ok(p[0] >= 0 && p[0] <= 1 && p[1] >= 0 && p[1] <= 1, 'fixture point left the frame');
  }

  const [ix, iy] = norm(itemLngLat);
  const collection = designStateToGeoJSON(state({
    zones: [{ id: 'z', zone: 2, points: ringLngLat.map(norm) }],
    lines: [{ id: 'l', kind: 'swale', points: lineLngLat.map(norm) }],
    items: [{ id: 'i', defId: 'jojo_2500', x: ix, y: iy }],
  }), FRAME);

  assert.equal(collection.features.length, 3);
  const [polygon, line, point] = collection.features;

  assert.equal(polygon.geometry.type, 'Polygon');
  if (polygon.geometry.type === 'Polygon') {
    const ring = polygon.geometry.coordinates[0];
    // Explicitly closed: first === last, then one entry per input vertex.
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.equal(ring.length, ringLngLat.length + 1);
    ringLngLat.forEach((expected, i) => {
      assert.ok(Math.abs(ring[i][0] - expected[0]) < 1e-6, `ring[${i}] lng drifted`);
      assert.ok(Math.abs(ring[i][1] - expected[1]) < 1e-6, `ring[${i}] lat drifted`);
    });
  }

  assert.equal(line.geometry.type, 'LineString');
  if (line.geometry.type === 'LineString') {
    lineLngLat.forEach((expected, i) => {
      const got = line.geometry.type === 'LineString' ? line.geometry.coordinates[i] : [];
      assert.ok(Math.abs(got[0] - expected[0]) < 1e-6, `line[${i}] lng drifted`);
      assert.ok(Math.abs(got[1] - expected[1]) < 1e-6, `line[${i}] lat drifted`);
    });
  }

  assert.equal(point.geometry.type, 'Point');
  if (point.geometry.type === 'Point') {
    assert.ok(Math.abs(point.geometry.coordinates[0] - itemLngLat[0]) < 1e-6);
    assert.ok(Math.abs(point.geometry.coordinates[1] - itemLngLat[1]) < 1e-6);
  }
});

test('a frame without geo-registration yields an empty collection', () => {
  const populated: Partial<DesignMapState> = {
    zones: [{ id: 'z', zone: 1, points: [[0.1, 0.1], [0.8, 0.1], [0.5, 0.8]] }],
  };
  const photoBase = { url: 'https://example.test/p.jpg', mPerPx: 0.2, uploadedAt: '2026-01-01T00:00:00.000Z' };

  // Non-satellite grounds: geometry is anchored to the photo/paper, not the earth.
  assert.deepEqual(
    designStateToGeoJSON(state({ ...populated, baseMode: 'photo', customBase: photoBase }), FRAME),
    EMPTY,
  );
  assert.deepEqual(
    designStateToGeoJSON(state({ ...populated, baseMode: 'blank' }), FRAME),
    EMPTY,
  );
  // Legacy two-state flag rows must resolve the same way baseMode 'photo' does.
  assert.deepEqual(
    designStateToGeoJSON(state({ ...populated, useCustomBase: true, customBase: photoBase }), FRAME),
    EMPTY,
  );

  // Corrupt/incomplete frames: every field the unprojector consumes is guarded.
  for (const patch of [
    { centerLng: Number.NaN },
    { centerLng: 181 },
    { centerLat: -91 },
    { zoom: Number.POSITIVE_INFINITY },
    { zoom: -1 },
    { imgW: 0 },
    { imgH: Number.NaN },
  ]) {
    const frame = { ...FRAME, ...patch };
    assert.equal(frameIsGeoRegistered(state(), frame), false);
    assert.deepEqual(designStateToGeoJSON(state(populated), frame), EMPTY);
  }
  assert.deepEqual(designStateToGeoJSON(state(populated), null), EMPTY);
  assert.deepEqual(designStateToGeoJSON(state(populated), undefined), EMPTY);

  // The satellite ground with a sound frame IS registered.
  assert.equal(frameIsGeoRegistered(state(), FRAME), true);
});

test('features carry the properties the map styles by', () => {
  const collection = designStateToGeoJSON(state({
    zones: [
      { id: 'zone', zone: 3, points: [[0.5, 0.5], [0.8, 0.5], [0.7, 0.8]] },
      { id: 'house', zone: 0, feature: 'house', name: '  Main house ', points: [[0.1, 0.1], [0.3, 0.1], [0.2, 0.3]] },
    ],
    lines: [{ id: 'l', kind: 'greywater', points: [[0.2, 0.2], [0.7, 0.7]] }],
    items: [{ id: 'i', defId: 'jojo_2500', x: 0.5, y: 0.5, label: '' }],
  }), FRAME);

  assert.equal(collection.features.length, 4);
  const [zone, house, line, item] = collection.features;

  assert.equal(zone.properties?.kind, 'zone');
  assert.equal(zone.properties?.zone, 3);
  assert.equal(zone.properties?.label, ZONE_DEFS[3].label);
  assert.equal(zone.properties?.color, ZONE_COLORS[3]);
  assert.equal(zone.properties?.fill, ZONE_COLORS[3]);
  assert.equal(typeof zone.properties?.stroke, 'string');

  assert.equal(house.properties?.kind, 'ground');
  assert.equal(house.properties?.feature, 'house');
  assert.equal(house.properties?.label, 'Main house'); // farmer's name wins over the default
  assert.equal(house.properties?.color, GROUND_FEATURES.house.color);

  assert.equal(line.properties?.kind, 'line');
  assert.equal(line.properties?.lineKind, 'greywater');
  assert.equal(line.properties?.color, WATER_ROUTE_STYLE.greywater.color);
  assert.equal(line.properties?.stroke, WATER_ROUTE_STYLE.greywater.color);
  assert.equal(line.properties?.dashed, true);
  assert.ok(Number.isFinite(line.properties?.width));

  const def = ELEMENTS_BY_ID.jojo_2500;
  assert.equal(item.properties?.kind, 'item');
  assert.equal(item.properties?.id, 'i');
  assert.equal(item.properties?.name, def.name); // blank label falls back to the catalog name
  assert.equal(item.properties?.category, def.category);
  assert.equal(item.properties?.icon, def.icon);
  assert.equal(item.properties?.color, def.color);
});

test('conversion is deterministic and never mutates its inputs', () => {
  const input = state({
    zones: [{ id: 'z', zone: 2, points: [[0.1, 0.1], [0.8, 0.1], [0.5, 0.8]] }],
    lines: [{ id: 'l', kind: 'fence', points: [[0.2, 0.2], [0.7, 0.7]] }],
    items: [{ id: 'i', defId: 'jojo_2500', x: 0.5, y: 0.5 }],
  });
  const snapshot = JSON.stringify(input);
  const first = designStateToGeoJSON(input, FRAME);
  const second = designStateToGeoJSON(input, FRAME);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), snapshot);
});

test('invalid shapes are skipped without poisoning the valid ones', () => {
  const collection = designStateToGeoJSON(state({
    zones: [
      { id: 'collinear', zone: 1, points: [[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]] },
      { id: 'good', zone: 2, points: [[0.1, 0.1], [0.8, 0.1], [0.5, 0.8]] },
    ],
    lines: [
      { id: 'degenerate', kind: 'pipe', points: [[0.2, 0.2], [0.2, 0.2]] },
      { id: 'nan', kind: 'drip', points: [[0, 0], [Number.NaN, 1]] },
    ],
    items: [
      { id: 'dup', defId: 'jojo_2500', x: 0.4, y: 0.4 },
      { id: 'dup', defId: 'jojo_2500', x: 0.6, y: 0.6 },
      { id: 'unknown-def', defId: 'no_such_element', x: 0.5, y: 0.5 },
      { id: 'outside', defId: 'jojo_2500', x: 1.5, y: 0.5 },
    ],
  }), FRAME);

  assert.equal(collection.features.length, 2);
  assert.equal(collection.features[0].properties?.kind, 'zone');
  assert.equal(collection.features[0].properties?.zone, 2);
  assert.equal(collection.features[1].properties?.kind, 'item');
  assert.equal(collection.features[1].properties?.id, 'dup');
});
