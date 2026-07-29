'use client';

// Compatibility shim for the geometry-first design studio (ported from Codex's branch).
// Codex's full lib/map-sync.ts was a parallel cloud-sync layer; this app already syncs via
// lib/user-sync.ts, so we expose ONLY the three symbols GeometryDesignStudio + design-studio
// need, backed by this app's storage + sync. Avoids running two competing sync engines.

import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { upsertDesignStudio } from '@/lib/user-sync';

export const MAP_STATE_EVENT = 'imbewu-map-state-changed';

const SHAPES_KEY = 'imbewu_farm_shapes';
const DESIGN_STUDIO_KEY = 'imbewu_design_studio_v1';

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

function isFeature(value: unknown): value is Feature {
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

function emit(name: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(name));
}

// Read the drawn parcels/water the user traced on the map — the LOCKED geometry the studio
// treats as law. Returns null if nothing is drawn or storage is unavailable.
export function readLocalFarmShapes(): FeatureCollection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(SHAPES_KEY) ?? 'null');
    return normaliseFarmShapeCollection(raw);
  } catch {
    return null;
  }
}

// Called after a syncable localStorage key changes. Notifies in-page listeners and, for the
// design-studio blob, pushes it to Firestore so the studio syncs across the user's devices.
export function markLocalStorageKeyUpdated(key: string): void {
  if (typeof window === 'undefined') return;
  if (key === DESIGN_STUDIO_KEY) {
    try {
      const raw = window.localStorage.getItem(DESIGN_STUDIO_KEY);
      if (raw) upsertDesignStudio(raw).catch(() => {});
    } catch { /* ignore */ }
  }
  emit(MAP_STATE_EVENT);
}
