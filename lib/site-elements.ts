import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getFirebase } from './firebase/init';
import { isSampleMode } from './sample-mode';
import { readTombstones, addTombstone } from './local-tombstones';
import { isDeleteStale, mergeItems } from './user-sync';
import { canonicalCoordinateSiteId } from './site-id';
import {
  accountLocalStorageKey,
  activeAccountLocalStorageKey,
  activeAccountUid,
} from './account-local-storage';

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
const ELEMENT_TYPE_VALUES = new Set<SiteElementType>(ELEMENT_TYPES);

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

const baseKeyFor = (siteId: string) => `imbewu_site_elements_${siteId}`;
const keyFor = (
  siteId: string,
  ownerUid?: string | null,
) => ownerUid === undefined
  ? activeAccountLocalStorageKey(baseKeyFor(siteId))
  : accountLocalStorageKey(baseKeyFor(siteId), ownerUid);
// Local deletion tombstones for this site's elements — see lib/local-tombstones.ts.
const deletedKeyFor = (
  siteId: string,
  ownerUid?: string | null,
) => ownerUid === undefined
  ? activeAccountLocalStorageKey(`${baseKeyFor(siteId)}_deleted`)
  : accountLocalStorageKey(`${baseKeyFor(siteId)}_deleted`, ownerUid);

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('imbewu-site-elements-changed'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isValidSiteElement(value: unknown): value is SiteElement {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && ELEMENT_TYPE_VALUES.has(value.type as SiteElementType)
    && typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
    && typeof value.lon === 'number' && Number.isFinite(value.lon) && value.lon >= -180 && value.lon <= 180
    && (value.label === undefined || typeof value.label === 'string')
    && (value.note === undefined || typeof value.note === 'string')
    && (value.litres === undefined
      || (typeof value.litres === 'number' && Number.isFinite(value.litres) && value.litres >= 0))
    && (value.species === undefined || typeof value.species === 'string')
    && (value.count === undefined
      || (typeof value.count === 'number' && Number.isFinite(value.count)
        && Number.isInteger(value.count) && value.count >= 1))
    && typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    && (value.updatedAt === undefined
      || (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0));
}

const elementId = (element: SiteElement) => element.id;
const elementTs = (element: SiteElement) => element.updatedAt ?? Date.parse(element.createdAt);

export function normaliseSiteElements(value: unknown): SiteElement[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SiteElement>();
  for (const candidate of value) {
    if (!isValidSiteElement(candidate)) continue;
    const current = byId.get(candidate.id);
    if (!current || elementTs(candidate) >= elementTs(current)) {
      byId.set(candidate.id, candidate);
    }
  }
  return [...byId.values()];
}

export function loadSiteElements(
  siteId: string,
  ownerUid?: string | null,
): SiteElement[] {
  const canonicalSiteId = canonicalCoordinateSiteId(siteId);
  if (typeof window === 'undefined' || !canonicalSiteId) return [];
  try {
    return normaliseSiteElements(
      JSON.parse(localStorage.getItem(keyFor(canonicalSiteId, ownerUid)) ?? '[]'),
    );
  } catch {
    return [];
  }
}

export function saveSiteElement(siteId: string, el: SiteElement): SiteElement | null {
  const canonicalSiteId = canonicalCoordinateSiteId(siteId);
  if (!canonicalSiteId || !isValidSiteElement(el)) return null;
  const ownerUid = activeAccountUid();
  const storageKey = activeAccountLocalStorageKey(baseKeyFor(canonicalSiteId));
  const stamped: SiteElement = { ...el, updatedAt: Date.now() };
  const updated = [
    stamped,
    ...loadSiteElements(canonicalSiteId).filter((e) => e.id !== stamped.id),
  ];
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    return null;
  }
  notify();
  if (ownerUid) upsertSiteElement(ownerUid, canonicalSiteId, stamped).catch(() => {});
  return stamped;
}

export function deleteSiteElement(siteId: string, id: string): boolean {
  const canonicalSiteId = canonicalCoordinateSiteId(siteId);
  if (!canonicalSiteId || !id) return false;
  const ownerUid = activeAccountUid();
  const storageKey = activeAccountLocalStorageKey(baseKeyFor(canonicalSiteId));
  const deletedStorageKey = activeAccountLocalStorageKey(`${baseKeyFor(canonicalSiteId)}_deleted`);
  const current = loadSiteElements(canonicalSiteId);
  if (!current.some((element) => element.id === id)) return false;
  const deletedAt = Date.now();
  const updated = current.filter((element) => element.id !== id);
  // The visible array write comes first: localStorage is synchronous, so the tombstone is still
  // installed before control returns, while a quota failure cannot mark a still-visible item.
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated));
  } catch {
    return false;
  }
  addTombstone(deletedStorageKey, id, deletedAt);
  notify();
  // Thread the SAME timestamp into removeSiteElement() as its `deletedAtMs` — see
  // removePlace()/isDeleteStale() in lib/user-sync.ts for why a fresh Date.now() sampled at
  // transaction-commit time would let a delayed delete kill a genuinely newer remote edit.
  if (ownerUid) removeSiteElement(ownerUid, canonicalSiteId, id, deletedAt).catch(() => {});
  return true;
}

// ── Firebase sync (mirrors upsertWaterPoint/removeWaterPoint in user-sync.ts) ──
// Per-item transactional writes so concurrent writers never clobber each other's full
// array. Offline → the transaction throws and is caught; the change still lives in
// localStorage. Stored at user_map_data/{uid}/data/site_elements/{siteId}, keyed by siteId
// (a farm can have many sites, each with its own placed elements).

type Tombstones = Record<string, number>; // id → deletedAt (ms)

function normaliseTombstones(value: unknown): Tombstones {
  if (!isRecord(value)) return {};
  const clean: Tombstones = {};
  for (const [id, timestamp] of Object.entries(value)) {
    if (id && typeof timestamp === 'number' && Number.isFinite(timestamp) && timestamp >= 0) {
      clean[id] = timestamp;
    }
  }
  return clean;
}

// SAMPLE-MODE GATE (safety layer 2, lib/sample-mode.ts): null here = "signed out" to every
// caller in this module, so site-element cloud sync is structurally off while sampling —
// local writes already land in the sandboxed localStorage shim.
function db() { return isSampleMode() ? null : (getFirebase()?.db ?? null); }

async function upsertSiteElement(uid: string, siteId: string, el: SiteElement): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote = normaliseSiteElements(data.elements);
      const deleted = normaliseTombstones(data.deleted);
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

// `deletedAtMs` is the ORIGINAL local delete timestamp (from deleteSiteElement() above) — see
// removePlace()/isDeleteStale() in lib/user-sync.ts for why this can't be Date.now() sampled
// fresh inside the transaction (a delayed/retried transaction would judge staleness against a
// clock that has drifted forward from the farmer's actual delete tap).
async function removeSiteElement(uid: string, siteId: string, id: string, deletedAtMs: number = Date.now()): Promise<void> {
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${siteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote = normaliseSiteElements(data.elements);
      const remoteItem = remote.find((e) => e.id === id);
      if (isDeleteStale(remoteItem ? elementTs(remoteItem) : undefined, deletedAtMs)) {
        return; // remote item was edited (elsewhere) after this device's delete — newest-wins, no-op
      }
      const deleted: Tombstones = { ...normaliseTombstones(data.deleted), [id]: deletedAtMs };
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

// Union by id (newest updatedAt wins), then drop ids whose deletion tombstone is newer than the
// surviving item's last edit. `localDel` comes from readTombstones(deletedKeyFor(siteId)) at the
// call sites below — deleteSiteElement() records a local tombstone synchronously (see
// lib/local-tombstones.ts) so a remote snapshot that lands before the async removeSiteElement()
// transaction commits can't resurrect an item this device just deleted. A deliberate re-add
// after deletion still survives: its fresh updatedAt outranks the tombstone (see the filter
// below and lib/local-tombstones.ts's semantics note).
export function mergeSiteElements(
  remote: unknown, local: unknown,
  remoteDel: Tombstones, localDel: Tombstones,
  now: number = Date.now(),
): { items: SiteElement[]; deleted: Tombstones } {
  return mergeItems(
    normaliseSiteElements(remote),
    normaliseSiteElements(local),
    normaliseTombstones(remoteDel),
    normaliseTombstones(localDel),
    elementId,
    elementTs,
    now,
  );
}

// One-shot reconcile for a single site — call on mount / site change (while signed in).
// Merges local↔remote (newest wins, tombstone-aware), writes the union to both localStorage
// and Firestore, and fires the same 'imbewu-site-elements-changed' event the rest of this
// module already uses so existing listeners (Map.tsx, GeometryDesignStudio.tsx) pick it up
// with no further changes on their end. No-ops when signed out or offline.
export async function reconcileSiteElements(uid: string, siteId: string): Promise<void> {
  const canonicalSiteId = canonicalCoordinateSiteId(siteId);
  if (!uid || !canonicalSiteId) return;
  const d = db(); if (!d) return;
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${canonicalSiteId}`);
  try {
    await runTransaction(d, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const remote = normaliseSiteElements(data.elements);
      const remoteDel: Tombstones = data.deleted ?? {};
      const { items, deleted } = mergeSiteElements(
        remote,
        loadSiteElements(canonicalSiteId, uid),
        remoteDel,
        readTombstones(deletedKeyFor(canonicalSiteId, uid)),
      );
      localStorage.setItem(keyFor(canonicalSiteId, uid), JSON.stringify(items));
      tx.set(ref, { elements: items, deleted, updatedAt: serverTimestamp() });
    });
    // A direct A → B switch does not necessarily tear down an already-queued callback
    // immediately. The completed reconcile may keep A's cache warm, but it must never make
    // B's open UI refresh as though A's rows belonged to the active account.
    if (activeAccountUid() === uid) notify();
  } catch (e) { console.error('[sync] reconcileSiteElements', e); }
}

// Realtime listener — call once per (uid, siteId) while the map/studio is open. A push from
// another device lands here, merges into localStorage (never blindly overwrites, so an
// unsynced local edit in flight isn't clobbered), and notifies. Returns an unsubscribe
// function (no-op when signed out).
export function subscribeSiteElementsLive(uid: string, siteId: string): () => void {
  const canonicalSiteId = canonicalCoordinateSiteId(siteId);
  if (!uid || !canonicalSiteId) return () => {};
  const d = db(); if (!d) return () => {};
  const ref = doc(d, 'user_map_data', uid, 'data', `site_elements_${canonicalSiteId}`);
  return onSnapshot(
    ref,
    (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const data = snap.data();
      const remote = normaliseSiteElements(data.elements);
      const remoteDel: Tombstones = data.deleted ?? {};
      const { items } = mergeSiteElements(
        remote,
        loadSiteElements(canonicalSiteId, uid),
        remoteDel,
        readTombstones(deletedKeyFor(canonicalSiteId, uid)),
      );
      try {
        localStorage.setItem(keyFor(canonicalSiteId, uid), JSON.stringify(items));
        if (activeAccountUid() === uid) notify();
      } catch (e) {
        console.error('[sync] site-elements local write', e);
      }
    },
    (e) => console.error('[sync] site-elements listener', e),
  );
}
