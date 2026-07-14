'use client';

import { doc, getDoc, setDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import type { SavedPlace } from './saved-places';
import type { WaterPoint } from './water-points';

const FARM_KEY      = 'imbewu_farm_shapes';
const PLACES_KEY    = 'permamap_saved_places';
const WATER_KEY     = 'imbewu_water_points';
const SURVEY_PREFIX = 'imbewu_site_survey_'; // one localStorage key per site: imbewu_site_survey_<siteId> (legacy blobs are keyed by placeId instead)
const COLL          = 'user_map_data';
const TOMB_TTL_MS = 90 * 24 * 60 * 60 * 1000; // prune deletion tombstones after 90 days

function db() { return getFirebase()?.db ?? null; }

type ShapeFC = { type: string; features: { id?: string | number }[] };
type Tombstones = Record<string, number>; // id → deletedAt (ms)
type SurveyLike = { siteId?: string; placeId: string; updatedAt?: number; savedAt?: string };
type SurveyMap = Record<string, SurveyLike>;

const surveyTs = (s: SurveyLike) => s.updatedAt ?? (s.savedAt ? Date.parse(s.savedAt) || 0 : 0);

// Read every per-site survey out of localStorage into a {siteId: survey} map. Legacy blobs
// saved before the siteId field existed are keyed by placeId instead — fall back to that so
// they still round-trip until they get migrated (see lib/site-survey.ts migrateLegacySurvey).
function readLocalSurveys(): SurveyMap {
  const out: SurveyMap = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(SURVEY_PREFIX)) {
        try {
          const s = JSON.parse(localStorage.getItem(k) ?? 'null');
          const id = s?.siteId ?? s?.placeId;
          if (id) out[id] = s;
        } catch {}
      }
    }
  } catch {}
  return out;
}

function writeLocalSurveys(surveys: SurveyMap): void {
  for (const [pid, s] of Object.entries(surveys)) {
    try { localStorage.setItem(SURVEY_PREFIX + pid, JSON.stringify(s)); } catch {}
  }
}

// Union by placeId, newest survey wins.
function mergeSurveys(remote: SurveyMap, local: SurveyMap): SurveyMap {
  const out: SurveyMap = { ...remote };
  for (const [pid, s] of Object.entries(local)) {
    if (!out[pid] || surveyTs(s) >= surveyTs(out[pid])) out[pid] = s;
  }
  return out;
}

function notifySurveys() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-surveys-changed'));
}

// ── Design-studio sync (geometry-first studio state) ──────────────────────────
// The studio stores one blob under DESIGN_STUDIO_KEY: { [siteId]: DesignStudioState }.
// DesignStudioState carries geometry (nested coordinate arrays Firestore can't store), so we
// persist the blob as a JSON STRING and merge per-siteId by updatedAt (newest wins).
const DESIGN_STUDIO_KEY = 'imbewu_design_studio_v1';
type DesignStateLike = { siteId: string; updatedAt?: string };
type DesignStore = Record<string, DesignStateLike>;
const designTs = (s: DesignStateLike) => (s.updatedAt ? Date.parse(s.updatedAt) || 0 : 0);

function readLocalDesign(): DesignStore {
  try { const v = JSON.parse(localStorage.getItem(DESIGN_STUDIO_KEY) ?? '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
}
function writeLocalDesign(store: DesignStore) {
  try { localStorage.setItem(DESIGN_STUDIO_KEY, JSON.stringify(store)); } catch {}
}
function parseDesign(json: unknown): DesignStore {
  if (typeof json !== 'string') return {};
  try { const v = JSON.parse(json); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  catch { return {}; }
}
function mergeDesign(remote: DesignStore, local: DesignStore): DesignStore {
  const out: DesignStore = { ...remote };
  for (const [sid, s] of Object.entries(local)) {
    if (!out[sid] || designTs(s) >= designTs(out[sid])) out[sid] = s;
  }
  return out;
}
function notifyDesign() {
  // The studio listens on MAP_STATE_EVENT to reload from localStorage.
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-map-state-changed'));
}

function readLocal<T>(key: string): T[] {
  try { const v = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}

// Shapes are stored in Firestore as a JSON string (GeoJSON has nested coordinate arrays
// that Firestore can't store natively). Parse defensively.
function parseShapes(shapesJson: unknown): ShapeFC | null {
  if (typeof shapesJson !== 'string') return null;
  try { const fc = JSON.parse(shapesJson); return fc?.features ? fc : null; }
  catch { return null; }
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
  if (!d) { handlers.onMergeDone?.(); return () => {}; }

  const shapesRef  = doc(d, COLL, uid, 'data', 'shapes');
  const placesRef  = doc(d, COLL, uid, 'data', 'places');
  const waterRef   = doc(d, COLL, uid, 'data', 'water');
  const surveysRef = doc(d, COLL, uid, 'data', 'surveys');
  const designRef  = doc(d, COLL, uid, 'data', 'design');

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
      // Stored as a JSON STRING because GeoJSON coordinates are nested arrays, which
      // Firestore can't store natively.
      // Rule: if the remote doc EXISTS (even with zero features — a deliberate delete-all),
      // remote is authoritative so the deletion stays deleted. Only bootstrap from local when
      // no remote doc has ever been written, which recovers a device's pre-sync drawing.
      {
        const sSnap = await getDoc(shapesRef);
        const hasRemoteDoc = sSnap.exists() && sSnap.data().shapesJson !== undefined;
        if (hasRemoteDoc) {
          const remoteFC = parseShapes(sSnap.data().shapesJson) ?? { type: 'FeatureCollection', features: [] };
          localStorage.setItem(FARM_KEY, JSON.stringify(remoteFC));
          handlers.onShapes?.();
        } else {
          let localFC: ShapeFC | null = null;
          try { const raw = localStorage.getItem(FARM_KEY); localFC = raw ? JSON.parse(raw) : null; } catch {}
          if (localFC?.features?.length) {
            await setDoc(shapesRef, { shapesJson: JSON.stringify(localFC), updatedAt: serverTimestamp() });
          }
          handlers.onShapes?.();
        }
      }

      // Site surveys: per-site survey objects collected in one doc keyed by siteId.
      await runTransaction(d, async (tx) => {
        const snap = await tx.get(surveysRef);
        const remote: SurveyMap = (snap.exists() ? snap.data().surveys : {}) ?? {};
        const merged = mergeSurveys(remote, readLocalSurveys());
        writeLocalSurveys(merged);
        tx.set(surveysRef, { surveys: merged, updatedAt: serverTimestamp() });
      });
      notifySurveys();

      // Design studio: one blob (per-site states) stored as a JSON string (nested geometry).
      await runTransaction(d, async (tx) => {
        const snap = await tx.get(designRef);
        const remote = parseDesign(snap.exists() ? snap.data().designJson : '{}');
        const merged = mergeDesign(remote, readLocalDesign());
        writeLocalDesign(merged);
        tx.set(designRef, { designJson: JSON.stringify(merged), updatedAt: serverTimestamp() });
      });
      notifyDesign();

    } catch (e) {
      console.error('[sync] reconcile error (likely offline) — keeping local data', e);
    }

    if (disposed) return;
    handlers.onMergeDone?.();

    // ── Phase 2: realtime listeners ──
    // MERGE remote into local (newest-wins + remote deletion tombstones) rather than blindly
    // overwriting, so a local create/edit that hasn't round-tripped yet isn't clobbered by an
    // unrelated remote change. Remote tombstones still propagate deletions.
    unsubs.push(onSnapshot(placesRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const { items } = mergeItems(snap.data().places ?? [], readLocal<SavedPlace>(PLACES_KEY), snap.data().deleted ?? {}, {}, placeId, placeTs, Date.now());
      localStorage.setItem(PLACES_KEY, JSON.stringify(items));
      handlers.onPlaces?.();
    }, (e) => console.error('[sync] places listener', e)));

    unsubs.push(onSnapshot(waterRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const { items } = mergeItems(snap.data().points ?? [], readLocal<WaterPoint>(WATER_KEY), snap.data().deleted ?? {}, {}, waterId, waterTs, Date.now());
      localStorage.setItem(WATER_KEY, JSON.stringify(items));
      handlers.onWater?.();
    }, (e) => console.error('[sync] water listener', e)));

    unsubs.push(onSnapshot(shapesRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const fc = parseShapes(snap.data().shapesJson);
      if (!fc) return;
      localStorage.setItem(FARM_KEY, JSON.stringify(fc));
      handlers.onShapes?.();
    }, (e) => console.error('[sync] shapes listener', e)));

    unsubs.push(onSnapshot(surveysRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const merged = mergeSurveys(snap.data().surveys ?? {}, readLocalSurveys());
      writeLocalSurveys(merged);
      notifySurveys();
    }, (e) => console.error('[sync] surveys listener', e)));

    unsubs.push(onSnapshot(designRef, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const merged = mergeDesign(parseDesign(snap.data().designJson), readLocalDesign());
      writeLocalDesign(merged);
      notifyDesign();
    }, (e) => console.error('[sync] design listener', e)));
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
      const tomb = deleted[place.id] ?? 0;
      const ts = place.updatedAt ?? 0;
      if (tomb > ts) {
        // A newer deletion outranks this edit — keep the item deleted, drop the upsert.
        tx.set(ref, { places: remote.filter((p) => p.id !== place.id), deleted, updatedAt: serverTimestamp() });
      } else {
        delete deleted[place.id]; // edit is newer (or no tombstone) → re-create, clear tombstone
        tx.set(ref, { places: [place, ...remote.filter((p) => p.id !== place.id)], deleted, updatedAt: serverTimestamp() });
      }
    });
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
  } catch (e) { console.error('[sync] removePlace', e); }
}

export async function upsertSurvey(uid: string, survey: SurveyLike): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'surveys');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const surveys: SurveyMap = (snap.exists() ? snap.data().surveys : {}) ?? {};
      surveys[survey.siteId ?? survey.placeId] = survey;
      tx.set(ref, { surveys, updatedAt: serverTimestamp() });
    });
  } catch (e) { console.error('[sync] upsertSurvey', e); }
}

// Push the whole design-studio blob (a JSON string of {siteId: state}) and merge per-site
// with whatever is in the cloud. Resolves uid itself so the map-sync shim can call it plainly.
export async function upsertDesignStudio(rawJson: string): Promise<void> {
  const d = db(); if (!d) return;
  const uid = getFirebase()?.auth?.currentUser?.uid;
  if (!uid) return;
  const ref = doc(d, COLL, uid, 'data', 'design');
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const remote = parseDesign(snap.exists() ? snap.data().designJson : '{}');
      const merged = mergeDesign(remote, parseDesign(rawJson));
      tx.set(ref, { designJson: JSON.stringify(merged), updatedAt: serverTimestamp() });
    });
  } catch (e) { console.error('[sync] upsertDesignStudio', e); }
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
      const tomb = deleted[pt.id] ?? 0;
      const ts = waterTs(pt);
      if (tomb > ts) {
        // A newer deletion outranks this edit — keep the item deleted, drop the upsert.
        tx.set(ref, { points: remote.filter((p) => p.id !== pt.id), deleted, updatedAt: serverTimestamp() });
      } else {
        delete deleted[pt.id]; // edit is newer (or no tombstone) → re-create, clear tombstone
        tx.set(ref, { points: [pt, ...remote.filter((p) => p.id !== pt.id)], deleted, updatedAt: serverTimestamp() });
      }
    });
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
  } catch (e) { console.error('[sync] removeWaterPoint', e); }
}

// Shapes: this browser's draw collection is the source of truth. Plain full-collection
// write (offline-friendly, fire-and-forget). Stored as a JSON string — GeoJSON coordinates
// are nested arrays, which Firestore rejects as a native value. The realtime listener keeps
// every open browser's localStorage current, so a push here already includes other devices'.
export async function pushShapes(uid: string, fc: ShapeFC): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, COLL, uid, 'data', 'shapes');
  try {
    await setDoc(ref, { shapesJson: JSON.stringify(fc), updatedAt: serverTimestamp() });
  } catch (e) { console.error('[sync] pushShapes', e); }
}
