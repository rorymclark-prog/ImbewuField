import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';

export type SiteElementType =
  | 'jojo_tank'
  | 'tap'
  | 'borehole'
  | 'pond_dam'
  | 'compost'
  | 'gate'
  | 'beehive'
  | 'nursery'
  | 'tree';

export interface SiteElement {
  id: string;
  type: SiteElementType;
  lat: number;
  lon: number;
  label?: string;    // optional custom label; falls back to the type's display name
  note?: string;      // e.g. "leaking, needs new tap" for a tank
  litres?: number;    // structured capacity, for type 'jojo_tank'
  species?: string;   // structured species, for type 'tree'
  count?: number;      // how many of this species at this pin, for type 'tree' — defaults to 1 when absent
  createdAt: string;  // ISO string
  updatedAt?: number; // ms — last edit time, drives cross-device newest-wins merge
}

// Element display metadata: icon emoji, display label, accent colour — per type.
export const ELEMENT_TYPES: SiteElementType[] = [
  'jojo_tank', 'tap', 'borehole', 'pond_dam', 'compost', 'gate', 'beehive', 'nursery', 'tree',
];

const ELEMENT_META: Record<SiteElementType, { icon: string; label: string; color: string }> = {
  jojo_tank: { icon: '🛢', label: 'JoJo / Water Tank',        color: '#2F7A4A' },
  tap:       { icon: '🚰', label: 'Tap Point',                 color: '#2B6FA6' },
  borehole:  { icon: '💧', label: 'Borehole',                  color: '#1F5C8A' },
  pond_dam:  { icon: '🌊', label: 'Pond / Dam',                color: '#1565A4' },
  compost:   { icon: '♻️', label: 'Compost / Mulch Basin',     color: '#8A5A2A' },
  gate:      { icon: '🚪', label: 'Gate',                      color: '#6B5B3E' },
  beehive:   { icon: '🐝', label: 'Beehive',                   color: '#C9A227' },
  nursery:   { icon: '🌱', label: 'Nursery',                   color: '#4A8F3C' },
  tree:      { icon: '🌳', label: 'Tree',                      color: '#2D6B3E' },
};

export function getElementMeta(type: SiteElementType): { icon: string; label: string; color: string } {
  return ELEMENT_META[type];
}

const keyFor = (siteId: string) => `imbewu_site_elements_${siteId}`;

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-site-elements-changed'));
}

function currentUid(): string | undefined {
  return getFirebase()?.auth?.currentUser?.uid;
}

export function loadSiteElements(siteId: string): SiteElement[] {
  if (typeof window === 'undefined') return [];
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(siteId)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveSiteElement(siteId: string, el: SiteElement): void {
  const stamped: SiteElement = { ...el, updatedAt: Date.now() };
  const updated = [stamped, ...loadSiteElements(siteId).filter((e) => e.id !== stamped.id)];
  localStorage.setItem(keyFor(siteId), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertSiteElement(uid, siteId, stamped).catch(() => {});
}

export function deleteSiteElement(siteId: string, id: string): void {
  const updated = loadSiteElements(siteId).filter((e) => e.id !== id);
  localStorage.setItem(keyFor(siteId), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) removeSiteElement(uid, siteId, id).catch(() => {});
}

// ── Firebase sync (mirrors upsertWaterPoint/removeWaterPoint in user-sync.ts) ──
// Per-item transactional writes so concurrent writers never clobber each other's full
// array. Offline → the transaction throws and is caught; the change still lives in
// localStorage. Stored at user_map_data/{uid}/data/site_elements/{siteId}, keyed by siteId
// (a farm can have many sites, each with its own placed elements).

type Tombstones = Record<string, number>; // id → deletedAt (ms)

function db() { return getFirebase()?.db ?? null; }

async function upsertSiteElement(uid: string, siteId: string, el: SiteElement): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: SiteElement[] = data.elements ?? [];
      const deleted: Tombstones = { ...(data.deleted ?? {}) };
      const tomb = deleted[el.id] ?? 0;
      const ts = el.updatedAt ?? 0;
      if (tomb > ts) {
        // A newer deletion outranks this edit — keep the item deleted, drop the upsert.
        tx.set(ref, { elements: remote.filter((e) => e.id !== el.id), deleted, updatedAt: serverTimestamp() });
      } else {
        delete deleted[el.id]; // edit is newer (or no tombstone) → re-create, clear tombstone
        tx.set(ref, { elements: [el, ...remote.filter((e) => e.id !== el.id)], deleted, updatedAt: serverTimestamp() });
      }
    });
  } catch (e) { console.error('[sync] upsertSiteElement', e); }
}

async function removeSiteElement(uid: string, siteId: string, id: string): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: SiteElement[] = data.elements ?? [];
      const deleted: Tombstones = { ...(data.deleted ?? {}), [id]: Date.now() };
      tx.set(ref, { elements: remote.filter((e) => e.id !== id), deleted, updatedAt: serverTimestamp() });
    });
  } catch (e) { console.error('[sync] removeSiteElement', e); }
}

// ── Pull-back sync (fixes: placed elements not appearing on a second device) ──
// upsert/removeSiteElement above only ever PUSH — there was no reconcile-on-mount and no
// realtime listener, so a device that never wrote a given element locally had no path to
// ever learn about it. These two functions mirror the working water-points pattern in
// user-sync.ts (subscribeUserMapData's Phase 1 reconcile + Phase 2 onSnapshot, both built
// on the same union-by-id/newest-updatedAt-wins/tombstone-aware merge). Call site (wiring):
// Map.tsx, alongside its existing subscribeUserMapData effect, keyed by siteIdForElements.

const elementId = (e: SiteElement) => e.id;
const elementTs = (e: SiteElement) => e.updatedAt ?? (e.createdAt ? Date.parse(e.createdAt) || 0 : 0);

// Union by id (newest updatedAt wins), then drop ids whose deletion tombstone is newer than
// the surviving item's last edit. Local deletions aren't tracked as tombstones on this device
// (deleteSiteElement just drops the row from localStorage — the tombstone lives server-side,
// written by removeSiteElement), so localDel is always {} in practice; kept as a parameter for
// symmetry with the remote side.
function mergeElements(
  remote: SiteElement[], local: SiteElement[],
  remoteDel: Tombstones, localDel: Tombstones,
): { items: SiteElement[]; deleted: Tombstones } {
  const deleted: Tombstones = { ...remoteDel };
  for (const [id, ts] of Object.entries(localDel)) deleted[id] = Math.max(deleted[id] ?? 0, ts);
  const byId = new Map<string, SiteElement>();
  for (const it of [...remote, ...local]) {
    const cur = byId.get(elementId(it));
    if (!cur || elementTs(it) >= elementTs(cur)) byId.set(elementId(it), it);
  }
  const items = [...byId.values()].filter((it) => {
    const tomb = deleted[elementId(it)];
    return !(tomb && tomb > elementTs(it));
  });
  return { items, deleted };
}

// One-shot reconcile for a single site — call on mount / site change (while signed in).
// Merges local↔remote (newest wins, tombstone-aware), writes the union to both localStorage
// and Firestore, and fires the same 'imbewu-site-elements-changed' event the rest of this
// module already uses so existing listeners (Map.tsx, GeometryDesignStudio.tsx) pick it up
// with no further changes on their end. No-ops when signed out or offline.
export async function reconcileSiteElements(uid: string, siteId: string): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote: SiteElement[] = data.elements ?? [];
      const remoteDel: Tombstones = data.deleted ?? {};
      const { items, deleted } = mergeElements(remote, loadSiteElements(siteId), remoteDel, {});
      localStorage.setItem(keyFor(siteId), JSON.stringify(items));
      tx.set(ref, { elements: items, deleted, updatedAt: serverTimestamp() });
    });
    notify();
  } catch (e) { console.error('[sync] reconcileSiteElements', e); }
}

// Realtime listener — call once per (uid, siteId) while the map/studio is open. A push from
// another device lands here, merges into localStorage (never blindly overwrites, so an
// unsynced local edit in flight isn't clobbered), and notifies. Returns an unsubscribe
// function (no-op when signed out).
export function subscribeSiteElementsLive(uid: string, siteId: string): () => void {
  const d = db(); if (!d) return () => {};
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const data = snap.data();
      const remote: SiteElement[] = data.elements ?? [];
      const remoteDel: Tombstones = data.deleted ?? {};
      const { items } = mergeElements(remote, loadSiteElements(siteId), remoteDel, {});
      localStorage.setItem(keyFor(siteId), JSON.stringify(items));
      notify();
    },
    (e) => console.error('[sync] site-elements listener', e),
  );
}
