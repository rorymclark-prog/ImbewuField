// Local-side deletion tombstones — closes the deletion-resurrection window.
//
// Problem: deletePlace/deleteWaterPoint/deleteSiteElement remove an item from localStorage
// SYNCHRONOUSLY, then fire the remote tombstone transaction (removePlace/removeWaterPoint/
// removeSiteElement in lib/user-sync.ts / lib/site-elements.ts) ASYNC, fire-and-forget. Until
// that transaction commits, every mergeItems()/mergeElements() call site was passing
// localDel={} — so if a remote snapshot lands in that window (e.g. another device's concurrent
// upsert whose transaction read pre-tombstone remote state), the deleted item's stale remote
// copy wins the newest-updatedAt-wins merge and gets written straight back into localStorage,
// resurrecting it in the UI before the async remote tombstone has even landed.
//
// Fix: record the deletion locally, synchronously, in its own tiny localStorage map (id →
// deletedAt ms) so callers can pass it as the `localDel` argument to mergeItems/mergeElements
// immediately — no async round-trip required to close the window.
//
// Cleanup: entries expire by TTL on READ only — there is no explicit clear when the remote
// delete confirms, on purpose. TTL is the whole contract here, deliberately mirroring the
// server-side pruneTombstones() in lib/user-sync.ts (same default TTL). The maps stay tiny (a
// handful of recently-deleted ids at most) so never explicitly clearing them costs nothing.
//
// Semantics note (mirrors lib/user-sync.ts's mergeItems): the merge filter is
// `!(tomb && tomb > getTs(it))` — a tombstone only beats an item whose last edit is OLDER than
// the deletion. So if a farmer deletes a place and then deliberately re-adds it (a fresh save,
// which stamps a new `updatedAt` newer than the tombstone), the re-added item's timestamp beats
// the tombstone and it correctly survives the merge — deleting something is not a permanent ban
// on that id, it only wins against snapshots that predate the deletion.

export const LOCAL_TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days — matches lib/user-sync.ts's TOMB_TTL_MS

export type LocalTombstones = Record<string, number>; // id → deletedAt (ms)

function readRaw(storageKey: string): LocalTombstones {
  if (typeof window === 'undefined') return {};
  try {
    const v = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function writeRaw(storageKey: string, t: LocalTombstones): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(storageKey, JSON.stringify(t)); } catch {}
}

/**
 * Read the local tombstone map stored at `storageKey`, pruning entries older than `ttlMs`
 * (default: LOCAL_TOMBSTONE_TTL_MS, matching the server-side TTL). Safe to call every render —
 * pruning only happens on read, never mutates storage.
 */
export function readTombstones(storageKey: string, ttlMs: number = LOCAL_TOMBSTONE_TTL_MS): LocalTombstones {
  const now = Date.now();
  const raw = readRaw(storageKey);
  const out: LocalTombstones = {};
  for (const [id, ts] of Object.entries(raw)) {
    if (typeof ts === 'number' && now - ts < ttlMs) out[id] = ts;
  }
  return out;
}

/**
 * Record a local deletion tombstone for `id` at `storageKey`. Callers must call this
 * synchronously — before or at the same moment as the localStorage array rewrite that removes
 * the item — so the very next mergeItems()/mergeElements() call (including one triggered by a
 * remote snapshot arriving mid-delete) already sees the tombstone and can't resurrect the item.
 */
export function addTombstone(storageKey: string, id: string, atMs: number = Date.now()): void {
  const t = readRaw(storageKey); // unpruned on write — pruning is a read-time concern only
  t[id] = atMs;
  writeRaw(storageKey, t);
}
