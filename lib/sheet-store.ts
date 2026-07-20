// Design Studio — durable storage for rendered plan sheets.
//
// WHY THIS EXISTS. The Saved-maps gallery was plain React state (`useState([])`), created empty on
// every mount and never written anywhere. Closing the tab destroyed every sheet in it — including
// the AI ones, which cost real money to produce and take minutes to render. The only other copy was
// a localStorage cache holding exactly ONE render per style+layer key, aggressively evicted by
// pruneGlossyCache the moment the quota tightened. A farmer could pay for a full plan set, close
// the tab, and have nothing.
//
// IndexedDB rather than localStorage: a single 1536×1024 PNG data URL runs 1–3 MB, and localStorage
// caps at ~5 MB for the WHOLE origin — which the design state, the satellite cache and the glossy
// cache are already competing for. Two sheets would evict the farmer's actual design. IndexedDB's
// quota is a share of free disk, so a plan set fits comfortably.
//
// Every function degrades to a no-op rather than throwing: a browser with IndexedDB disabled (or
// private mode on some engines) must still be able to render and view sheets for the session. The
// gallery is a convenience layer over work that is never lost from the screen.

const DB_NAME = 'imbewu-sheets';
const DB_VERSION = 1;
const STORE = 'sheets';

export interface StoredSheet {
  id: string;
  siteId: string;
  label: string;
  /** PNG data URL, exactly as the renderer produced it. */
  image: string;
  /** ISO timestamp — newest last, so the gallery reads in render order. */
  at: string;
}

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        // Sheets are always read per site, never globally.
        store.createIndex('siteId', 'siteId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // A blocked upgrade (another tab holding an old version) must not hang the gallery forever.
    req.onblocked = () => resolve(null);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Every sheet saved for this site, oldest first. Returns [] on any failure — never throws. */
export async function loadSheets(siteId: string): Promise<StoredSheet[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = tx(db, 'readonly').index('siteId').getAll(siteId);
      req.onsuccess = () => {
        const rows = (req.result as StoredSheet[]) ?? [];
        rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    } finally {
      db.close();
    }
  });
}

/** Persist one sheet. Resolves false when storage was unavailable or full, so the caller can tell
 *  the farmer their sheet is session-only rather than silently implying it is safe. */
export async function saveSheet(sheet: StoredSheet): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const req = tx(db, 'readwrite').put(sheet);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false); // QuotaExceeded lands here
    } catch {
      resolve(false);
    } finally {
      db.close();
    }
  });
}

export async function deleteSheet(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    tx(db, 'readwrite').delete(id);
  } catch {
    /* nothing to do — the row stays, the UI already dropped it */
  } finally {
    db.close();
  }
}

/** Drop every sheet for one site (the gallery's "clear all"). Scoped to the site on purpose: a
 *  farmer clearing one design's maps must not lose another design's. */
export async function clearSheets(siteId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const store = tx(db, 'readwrite');
    const req = store.index('siteId').getAllKeys(siteId);
    req.onsuccess = () => {
      for (const key of req.result ?? []) store.delete(key as IDBValidKey);
    };
  } catch {
    /* best effort */
  } finally {
    db.close();
  }
}

/** Rough byte size of a data URL, for quota messaging. base64 carries 3 bytes per 4 chars. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.length - comma - 1;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64 * 3) / 4) - padding);
}
