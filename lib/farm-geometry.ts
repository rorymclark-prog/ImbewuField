// Pure, dependency-free GeoJSON validation for farm shapes.
//
// MOVED VERBATIM from lib/map-sync.ts (base 5c12307a, lines 17-94) so that the shape-sync v2
// protocol (lib/shape-sync/protocol.ts) and lib/map-sync.ts share ONE validator instead of two
// copies that could drift. lib/map-sync.ts re-exports the three public functions unchanged, so
// every existing importer (GeometryDesignStudio, tests/map-sync.test.ts) keeps working.
// This module must stay import-free (types only) so it can run in node:test without aliases.

import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value)
    && value.length >= 2
    && value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
    && value[0] >= -180
    && value[0] <= 180
    && value[1] >= -90
    && value[1] <= 90;
}

function samePosition(left: Position, right: Position): boolean {
  return left.length === right.length && left.every((coordinate, index) => coordinate === right[index]);
}

function isLine(value: unknown, minimumLength = 2): value is Position[] {
  return Array.isArray(value)
    && value.length >= minimumLength
    && value.every(isPosition);
}

function isRing(value: unknown): value is Position[] {
  return isLine(value, 4) && samePosition(value[0], value[value.length - 1]);
}

export function isValidFarmGeometry(value: unknown): value is Geometry {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'Point':
      return isPosition(value.coordinates);
    case 'MultiPoint':
      return Array.isArray(value.coordinates) && value.coordinates.every(isPosition);
    case 'LineString':
      return isLine(value.coordinates);
    case 'MultiLineString':
      return Array.isArray(value.coordinates) && value.coordinates.every((line) => isLine(line));
    case 'Polygon':
      return Array.isArray(value.coordinates) && value.coordinates.length > 0
        && value.coordinates.every(isRing);
    case 'MultiPolygon':
      return Array.isArray(value.coordinates) && value.coordinates.every(
        (polygon) => Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
      );
    case 'GeometryCollection':
      return Array.isArray(value.geometries) && value.geometries.every(isValidFarmGeometry);
    default:
      return false;
  }
}

export function isFeature(value: unknown): value is Feature {
  if (!isRecord(value) || value.type !== 'Feature' || !isValidFarmGeometry(value.geometry)) return false;
  if (value.properties !== null && value.properties !== undefined && !isRecord(value.properties)) return false;
  return value.id === undefined
    || typeof value.id === 'string'
    || (typeof value.id === 'number' && Number.isFinite(value.id));
}

export function isValidFarmShapeCollection(value: unknown): value is FeatureCollection {
  return isRecord(value)
    && value.type === 'FeatureCollection'
    && Array.isArray(value.features)
    && value.features.every(isFeature);
}

export function normaliseFarmShapeCollection(value: unknown): FeatureCollection | null {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) {
    return null;
  }
  const features = value.features.filter(isFeature);
  // One corrupt trace must not hide the farmer's other valid shapes. An all-corrupt,
  // non-empty collection still fails closed rather than masquerading as a deliberate clear-all.
  if (value.features.length > 0 && features.length === 0) return null;
  return { type: 'FeatureCollection', features };
}
