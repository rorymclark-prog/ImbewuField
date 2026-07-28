// Putting a module on the phone, and telling the truth about whether it is there.
//
// BROWSER-ONLY. The pack (which files, how many bytes) is computed in lib/offline-pack.ts, which is
// pure and tested; everything here touches Cache Storage and is therefore kept thin and separate.
//
// The cache name matches the one in app/sw.js/route.ts, which is where the service worker lives —
// it is generated per deploy so its body changes and browsers notice the update. That worker reads
// what this writes, and crucially SPARES this cache from the sweep that clears every other cache on
// deploy, so a download survives app updates. The constant is duplicated with this note rather than
// imported because the worker source is a template string, not a module.

import type { OfflinePack, PackEntry } from '@/lib/offline-pack';

export const COURSE_CACHE = 'imbewu-course-v1';

/** How many fetches at once. Four keeps a weak connection busy without collapsing it. */
const CONCURRENCY = 4;

export interface DownloadProgress {
  /** Files finished, successfully or not. */
  done: number;
  total: number;
  /** Bytes actually stored — advanced only on a real success, so the bar cannot outrun the truth. */
  bytes: number;
  totalBytes: number;
}

export interface DownloadResult {
  stored: number;
  /**
   * URLs that did not make it.
   *
   * A partial download is REPORTED, not rounded up to success. The farmer is offline at the
   * homestead when the gap shows, with no way to tell whether the app is broken or the download
   * was — so the moment to be honest is here, while they still have signal.
   */
  failed: string[];
  cancelled: boolean;
}

export function offlineSupported(): boolean {
  return typeof window !== 'undefined' && 'caches' in window;
}

/**
 * Fired whenever the cache changes, so every Download control on the page re-reads it.
 *
 * THE BUG THIS FIXES: the page shows one control for the whole course and one inside each module.
 * They each read the cache once, on mount. Downloading the whole course therefore left every module
 * still offering its own download — of files that were already on the phone — and a farmer who
 * trusted that button would have spent their airtime a second time for nothing.
 *
 * One shared cache means one shared truth; this is how the other controls hear about it.
 */
export const CACHE_CHANGED_EVENT = 'imbewu:offline-cache-changed';

function announceCacheChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CACHE_CHANGED_EVENT));
}

/**
 * What is already on the device for this pack.
 *
 * DERIVED FROM THE CACHE, never from a "downloaded" flag in localStorage. A flag survives the
 * browser evicting the files under storage pressure — which is exactly when it matters — and would
 * tell the farmer the module is theirs while the cache is empty.
 */
export async function packStatus(pack: OfflinePack): Promise<DownloadProgress> {
  const empty = { done: 0, total: pack.entries.length, bytes: 0, totalBytes: pack.bytes };
  if (!offlineSupported()) return empty;
  try {
    const cache = await caches.open(COURSE_CACHE);
    let done = 0;
    let bytes = 0;
    for (const e of pack.entries) {
      if (await cache.match(e.url, { ignoreSearch: true })) {
        done += 1;
        bytes += e.bytes;
      }
    }
    return { done, total: pack.entries.length, bytes, totalBytes: pack.bytes };
  } catch {
    return empty;
  }
}

export async function isPackComplete(pack: OfflinePack): Promise<boolean> {
  const s = await packStatus(pack);
  return s.total > 0 && s.done === s.total;
}

/**
 * Fetch and store every file in the pack, skipping what is already there.
 *
 * Resumable by construction: a download interrupted at 40% leaves those 40% cached, and pressing
 * Download again fetches only the rest. On a connection that drops, a restart-from-zero would make
 * the feature unusable for the people it is for.
 */
export async function downloadPack(
  pack: OfflinePack,
  onProgress?: (p: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<DownloadResult> {
  if (!offlineSupported()) return { stored: 0, failed: pack.entries.map((e) => e.url), cancelled: false };

  const cache = await caches.open(COURSE_CACHE);
  const failed: string[] = [];
  let stored = 0;
  let done = 0;
  let bytes = 0;

  const report = () => onProgress?.({ done, total: pack.entries.length, bytes, totalBytes: pack.bytes });

  // Count what is already present first, so a resumed download starts at its real position rather
  // than sliding from 0% back up over files it is not going to fetch.
  const todo: PackEntry[] = [];
  for (const entry of pack.entries) {
    if (await cache.match(entry.url, { ignoreSearch: true })) {
      done += 1;
      bytes += entry.bytes;
      stored += 1;
    } else {
      todo.push(entry);
    }
  }
  report();

  const queue = [...todo];
  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const entry = queue.shift();
      if (!entry) return;
      try {
        const res = await fetch(entry.url, { cache: 'reload', signal });
        // Only a real 200 goes in. Caching a 404 page under an asset URL would make the module
        // look complete and then render a broken image offline, with nothing left to retry from.
        if (res.ok) {
          await cache.put(entry.url, res.clone());
          stored += 1;
          bytes += entry.bytes;
        } else {
          failed.push(entry.url);
        }
      } catch {
        if (!signal?.aborted) failed.push(entry.url);
      }
      done += 1;
      report();
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, worker));
  announceCacheChange();
  return { stored, failed, cancelled: Boolean(signal?.aborted) };
}

/** Give the space back. Only this pack's files — other downloaded modules are left alone. */
export async function removePack(pack: OfflinePack): Promise<number> {
  if (!offlineSupported()) return 0;
  const cache = await caches.open(COURSE_CACHE);
  let removed = 0;
  for (const e of pack.entries) {
    if (await cache.delete(e.url, { ignoreSearch: true })) removed += 1;
  }
  announceCacheChange();
  return removed;
}

/**
 * How much room the phone will admit to having.
 *
 * navigator.storage.estimate() is advisory and coarse on purpose (privacy), so this is used to
 * warn, never to block: a phone that under-reports must not be told it cannot download.
 */
export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return null;
  }
}

/**
 * Ask the browser not to evict these files when the phone runs low.
 *
 * Without this, Cache Storage is "best effort" and Android will clear it under pressure — and the
 * farmer discovers that at the homestead, three weeks after the trip to town that paid for it.
 * Chrome grants this silently to installed PWAs; where it is refused the download still works,
 * it is simply not protected, so the caller warns rather than fails.
 */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
