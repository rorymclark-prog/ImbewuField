'use client';

// Compatibility shim for the geometry-first design studio (ported from Codex's branch).
// Codex's full lib/map-sync.ts was a parallel cloud-sync layer; this app already syncs via
// lib/user-sync.ts, so we expose ONLY the three symbols GeometryDesignStudio + design-studio
// need, backed by this app's storage + sync. Avoids running two competing sync engines.

import type { FeatureCollection } from 'geojson';
import { upsertDesignStudio } from '@/lib/user-sync';

export const MAP_STATE_EVENT = 'imbewu-map-state-changed';

const SHAPES_KEY = 'imbewu_farm_shapes';
const DESIGN_STUDIO_KEY = 'imbewu_design_studio_v1';

function isFeatureCollection(v: unknown): v is FeatureCollection {
  return !!v && typeof v === 'object' && (v as { type?: string }).type === 'FeatureCollection'
    && Array.isArray((v as { features?: unknown }).features);
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
    return isFeatureCollection(raw) ? raw : null;
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
