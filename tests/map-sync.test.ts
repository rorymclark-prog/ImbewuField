import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDemoBoundaryFC } from '../lib/demo-farm.ts';

class MemoryStorage {
  private readonly rows = new Map<string, string>();

  getItem(key: string): string | null {
    return this.rows.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.rows.set(key, value);
  }

  removeItem(key: string): void {
    this.rows.delete(key);
  }
}

const localStorage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage,
    dispatchEvent: () => true,
  },
});

const {
  isValidFarmShapeCollection,
  normaliseFarmShapeCollection,
  readLocalFarmShapes,
} = await import('../lib/map-sync.ts');

const SHAPES_KEY = 'imbewu_farm_shapes';

test('the checked-in farm geometry survives the storage boundary as an independent copy', () => {
  const source = buildDemoBoundaryFC();
  localStorage.setItem(SHAPES_KEY, JSON.stringify(source));

  const first = readLocalFarmShapes();
  const second = readLocalFarmShapes();

  assert.deepEqual(first, source);
  assert.deepEqual(second, source);
  assert.notEqual(first, source);
  assert.notEqual(first, second);

  first!.features.length = 0;
  assert.equal(source.features.length > 0, true);
  assert.equal(second!.features.length, source.features.length);
});

test('stored farm shapes must be usable GeoJSON, not merely an object with a features array', () => {
  const validPoint = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      id: 'tap',
      properties: { featureType: 'water' },
      geometry: { type: 'Point', coordinates: [30, -29] },
    }],
  };
  const invalidCollections: unknown[] = [
    null,
    [],
    { features: [] },
    { type: 'FeatureCollection', features: {} },
    { type: 'FeatureCollection', features: [null] },
    { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] },
    { ...validPoint, features: [{ ...validPoint.features[0], geometry: { type: 'Point', coordinates: [181, -29] } }] },
    { ...validPoint, features: [{ ...validPoint.features[0], geometry: { type: 'Point', coordinates: [30, 91] } }] },
    { ...validPoint, features: [{ ...validPoint.features[0], geometry: { type: 'Point', coordinates: [30, Number.NaN] } }] },
    { ...validPoint, features: [{ ...validPoint.features[0], geometry: { type: 'LineString', coordinates: [[30, -29]] } }] },
    {
      ...validPoint,
      features: [{
        ...validPoint.features[0],
        geometry: {
          type: 'Polygon',
          coordinates: [[[30, -29], [30.1, -29], [30.1, -29.1], [30, -29.1]]],
        },
      }],
    },
    { ...validPoint, features: [{ ...validPoint.features[0], properties: [] }] },
    { ...validPoint, features: [{ ...validPoint.features[0], id: Number.POSITIVE_INFINITY }] },
    { ...validPoint, features: [{ ...validPoint.features[0], geometry: { type: 'Circle', coordinates: [30, -29] } }] },
  ];

  assert.equal(isValidFarmShapeCollection(validPoint), true);
  for (const value of invalidCollections) {
    assert.equal(isValidFarmShapeCollection(value), false, JSON.stringify(value));
    localStorage.setItem(SHAPES_KEY, JSON.stringify(value));
    assert.equal(readLocalFarmShapes(), null);
  }
});

test('polygon rings close and every nested geometry is checked before it becomes locked geometry', () => {
  const collection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: null,
      geometry: {
        type: 'GeometryCollection',
        geometries: [
          { type: 'LineString', coordinates: [[30, -29], [30.1, -29.1]] },
          {
            type: 'MultiPolygon',
            coordinates: [[[
              [30, -29],
              [30.1, -29],
              [30.1, -29.1],
              [30, -29],
            ]]],
          },
        ],
      },
    }],
  };

  assert.equal(isValidFarmShapeCollection(collection), true);
  const corrupt = structuredClone(collection);
  const nestedCoordinates = corrupt.features[0].geometry.geometries[1].coordinates as number[][][][];
  nestedCoordinates[0][0][2][0] = Number.POSITIVE_INFINITY;
  assert.equal(isValidFarmShapeCollection(corrupt), false);
});

test('one broken trace is discarded without hiding the farmer’s other valid shapes', () => {
  const valid = buildDemoBoundaryFC();
  const corrupt = {
    type: 'Feature' as const,
    properties: { featureType: 'site' },
    geometry: {
      type: 'Polygon' as const,
      coordinates: [[[31, -29], [31, -29], [31, -29]]],
    },
  };
  const mixed = {
    type: 'FeatureCollection' as const,
    features: [corrupt, ...valid.features],
  };

  const normalised = normaliseFarmShapeCollection(mixed);
  assert.deepEqual(normalised, valid);
  assert.equal(mixed.features.length, valid.features.length + 1);
});

test('missing, malformed and inaccessible storage fail closed without throwing', () => {
  localStorage.removeItem(SHAPES_KEY);
  assert.equal(readLocalFarmShapes(), null);

  localStorage.setItem(SHAPES_KEY, '{broken');
  assert.equal(readLocalFarmShapes(), null);

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => {
          throw new Error('storage unavailable');
        },
      },
    },
  });
  assert.equal(readLocalFarmShapes(), null);
});
