'use client';

import { doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import type { SavedPlace } from './saved-places';
import type { WaterPoint } from './water-points';

const FARM_KEY    = 'imbewu_farm_shapes';
const PLACES_KEY  = 'permamap_saved_places';
const WATER_KEY   = 'imbewu_water_points';
const COLL        = 'user_map_data';
const TOMB_TTL_MS = 90 * 24 * 60 * 60 * 1000; // prune deletion tombstones after 90 days

function db() { return getFirebase()?.db ?? null; }

type ShapeFC = { type: string; features: { id?: string | number }[] };
type Tombstones = Record<string, number>; // id → deletedAt (ms)

function readLocal<T>(key: string): T[] {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) ?? []) : []; }
  catch { return []; }
}

function pruneTombstones(t: Tombstones, now: number): Tombstones {
  const out: Tombstones = {};
  for (const [id, ts] of Object.entries(t)) if (now - ts < TOMB_TTL_MS) out[id] = ts;
  return out;
}

function mergeTombstones(a: Tombstones, b: Tombstones): Tombstones {
  const out: Tombstones = { ...a };
  for (const [id, ts] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, ts);
  return out;
}

// Generic CRDT-ish merge: union by id, newest updatedAt wins, drop ids whose deletion
// tombstone is newer than the surviving item's last update. Returns merged items + tombstones.
function mergeItems<T>(
  remote: T[], local: T[],
  remoteDel: Tombstones, localDel: Tombstones,
  getId: (x: T) => string, getTs: (x: T) => number,
  now: number,
): { items: T[]; deleted: Tombstones } {
  const deleted = pruneTombstones(mergeTombstones(remoteDel, localDel), now);
  const byId = new Map<string, T>();
  for (const it of [...remote, ...local]) {
    const id = getId(it);
    const cur = byId.get(id);
    if (!cur || getTs(it) >= getTs(cur)) byId.set(id, it);
  }
  const items = [...byId.values()].filter((it) => {
    const tomb = deleted[getId(it)];
    return !(tomb && tomb > getTs(it)); // deleted after its last edit → stays deleted
  });
  return { items, deleted };
}

const placeId = (p: SavedPlace) => p.id;
const placeTs = (p: SavedPlace) => p.updatedAt ?? 0;
const waterId = (p: WaterPoint) => p.id;
const waterTs = (p: WaterPoint) => p.updatedAt ?? (p.createdAt ? Date.parse(p.createdAt) || 0 : 0);

export interface SyncHandlers {
  onPlaces?: () => void;
  onWater?: () => void;
  onShapes?: () => void;
  onMergeDone?: () => void; // fired once after the initial local↔remote reconciliation
}

// Subscribe to live cross-device sync for the signed-in user.
//
//   Phase 1 — RECONCILE (one transaction per doc): atomically read remote, merge with
//     localStorage (newest-wins + deletion tombstones), write the union back. Atomic so a
//     concurrent local save/draw can't be clobbered, and tombstone-aware so deletions stay
//     deleted instead of being resurrected by a stale device.
//   Phase 2 — LIVE (onSnapshot): a write in ANY browser pushes here in realtime → we update
//     localStorage + notify handlers (no reload). Local-write echoes are skipped.
//
// Returns an unsubscribe function.
export function subscribeUserMapData(uid: string, handlers: SyncHandlers): () => void {
  const d = db();
  console.log('[sync] subscribe uid=', uid, 'db=', !!d);
  if (!d) { handlers.onMergeDone?.(); return () => {}; }

  const shapesRef = doc(d, COLL, uid, 'data', 'shapes');
  const placesRef = doc(d, COLL, uid, 'data', 'places');
  const waterRef  = doc(d, COLL, uid, 'data', 'water');

  const unsubs: Array<() => void> = [];
  let disposed = false;

  (async () => {
    const now = Date.now();
    // ── Phase 1: atomic reconcile ──
    try {
      // Places
      await runTransaction(d, async (tx) => {
        const snap = await tx.get(placesRef);
        const data = snap.exists() ? snap.data() : {};
        const remote: SavedPlace[] = data.places ?? [];
        const remoteDel: Tombstones = data.deleted ?? {};
        const { items, deleted } = mergeItems(remote, readLocal<SavedPlace>(PLACES_KEY), remoteDel, {}, placeId, placeTs, now);
        localStorage.setItem(PLACES_KEY, JSON.stringify(items));
        tx.set(placesRef, { places: items, deleted, updatedAt: serverTimestamp() });
      });
      handlers.onPlaces?.();

      // Water
      await runTransaction(d, async (tx) => {
        const snap = await tx.get(waterRef);
        const data = snap.exists() ? snap.data() : {};
        const remote: WaterPoint[] = data.points ?? [];
        const remoteDel: Tombstones = data.deleted ?? {};
        const { items, deleted } = mergeItems(remote, readLocal<WaterPoint>(WATER_KEY), remoteDel, {}, waterId, waterTs, now);
        localStorage.setItem(WATER_KEY, JSON.stringify(items));
        tx.set(waterRef, { points: items, deleted, updatedAt: serverTimestamp() });
      });
      handlers.onWater?.();

      // Shapes: the drawn collection is edited as a whole (and the reticle editor
      // delete+re-adds features with fresh ids), so per-feature union would duplicate.
      // Rule: if remote exists and is non-empty, remote wins (so deletions are durable);
      // otherwise bootstrap remote from local (recovers a device's existing drawing).
      {
        const sSnap = await getDoc(shapesRef);
        const remoteFC: ShapeFC | null = sSnap.exists() ? (sSnap.data().shapes ?? null) : null;
        if (remoteFC?.features?.length) {
          localStorage.setItem(FARM_KEY, JSON.stringify(remoteFC));
          handlers.onShapes?.();
        } else {
          let localFC: ShapeFC | null = null;
          try { const raw = localStorage.getItem(FARM_KEY); localFC = raw ? JSON.parse(raw) : null; } catch {}
          if (localFC?.features?.length) {
            await setDoc(shapesRef, { shapes: localFC, updatedAt: serverTimestamp() });
          }
          handlers.onShapes?.();
        }
      }

      console.log('[sync] reconcile done');
    } catch (e) {
      console.error('[sync] reconcile error (likely offline) — keeping local data', e);
    }

    if (disposed) return;
    handlers.onMergeDone?.();

    // ── Phase 2: realtime listeners ──
    unsubs.push(onSnapshot(placesRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      localStorage.setItem(PLACES_KEY, JSON.stringify(snap.data().places ?? []));
      handlers.onPlaces?.();
      console.log('[sync] realtime places');
    }, (e) => console.error('[sync] places listener', e)));

    unsubs.push(onSnapshot(waterRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      localStorage.setItem(WATER_KEY, JSON.stringify(snap.data().points ?? []));
      handlers.onWater?.();
      console.log('[sync] realtime water');
    }, (e) => console.error('[sync] water listener', e)));

    unsubs.push(onSnapshot(shapesRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const shapes = snap.data().shapes;
      if (!shapes) return;
      localStorage.setItem(FARM_KEY, JSON.stringify(shapes));
      handlers.onShapes?.();
      console.log('[sync] realtime shapes');
    }, (e) => console.error('[sync] shapes listener', e)));
  })();

  return () => { disposed = true; unsubs.forEach((u) => u()); };
}

// ── Per-item transactional writes (used by saved-places & water-points) ──
// Each upsert/remove reads the remote doc inside a transaction and applies ONLY its own
// delta, so concurrent writers never clobber each other's full array. Offline → the
// transaction throws and is caught; the change still lives in localStorage and is merged
// up by the next reconcile. Removes write a tombstone so the deletion is durable.

export async function upsertPlace(uid: string, place: SavedPlace): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'places');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: SavedPlace[] = data.places ?? [];
      const deleted: Tombstones = { ...(data.deleted ?? {}) };
      delete deleted[place.id]; // re-created → clear any tombstone
      tx.set(ref, { places: [place, ...remote.filter((p) => p.id !== place.id)], deleted, updatedAt: serverTimestamp() });
    });
    console.log('[sync] upsertPlace OK');
  } catch (e) { console.error('[sync] upsertPlace', e); }
}

export async function removePlace(uid: string, id: string): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'places');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: SavedPlace[] = data.places ?? [];
      const deleted: Tombstones = pruneTombstones({ ...(data.deleted ?? {}), [id]: Date.now() }, Date.now());
      tx.set(ref, { places: remote.filter((p) => p.id !== id), deleted, updatedAt: serverTimestamp() });
    });
    console.log('[sync] removePlace OK');
  } catch (e) { console.error('[sync] removePlace', e); }
}

export async function upsertWaterPoint(uid: string, pt: WaterPoint): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'water');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: WaterPoint[] = data.points ?? [];
      const deleted: Tombstones = { ...(data.deleted ?? {}) };
      delete deleted[pt.id];
      tx.set(ref, { points: [pt, ...remote.filter((p) => p.id !== pt.id)], deleted, updatedAt: serverTimestamp() });
    });
    console.log('[sync] upsertWaterPoint OK');
  } catch (e) { console.error('[sync] upsertWaterPoint', e); }
}

export async function removeWaterPoint(uid: string, id: string): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'water');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: WaterPoint[] = data.points ?? [];
      const deleted: Tombstones = pruneTombstones({ ...(data.deleted ?? {}), [id]: Date.now() }, Date.now());
      tx.set(ref, { points: remote.filter((p) => p.id !== id), deleted, updatedAt: serverTimestamp() });
    });
    console.log('[sync] removeWaterPoint OK');
  } catch (e) { console.error('[sync] removeWaterPoint', e); }
}

// Shapes: this browser's draw collection is the source of truth. Plain full-collection
// write (offline-friendly, fire-and-forget). The realtime listener keeps every open
// browser's localStorage current, so a push here already includes other devices' features.
export async function pushShapes(uid: string, fc: ShapeFC): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'shapes');
  try {
    await setDoc(ref, { shapes: fc, updatedAt: serverTimestamp() });
    console.log('[sync] pushShapes OK features=', fc.features?.length);
  } catch (e) { console.error('[sync] pushShapes', e); }
}
