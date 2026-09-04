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

import {
  ACCOUNT_LOCAL_STORAGE_OWNER_SEPARATOR,
  accountLocalStorageKey,
  activeAccountLocalStorageKey,
} from './account-local-storage';
import type { SheetUnderlay } from './sheet-underlay';

const DB_NAME = 'imbewu-sheets';
const DB_VERSION = 1;
const STORE = 'sheets';
const SAMPLE_MODE_FLAG = 'imbewu_sample_mode';
const SAMPLE_OWNER = 'sample';

export type SheetResultKind = 'exact' | 'hybrid' | 'ai-polished' | 'ai-illustrated' | 'legacy';
export type SheetProvider = 'exact' | 'openai' | 'gemini' | 'unknown';
export type SheetValidationStatus = 'needs-review' | 'unscored' | 'verified';

export interface StoredSheet {
  id: string;
  siteId: string;
  label: string;
  /** PNG data URL, exactly as the renderer produced it. */
  image: string;
  /** Small JPEG for gallery grid display, generated best-effort after the save that matters (see
   *  makeGalleryThumbnail in DesignGlossy.tsx). Absent on sheets saved before this existed or when
   *  generation failed; callers fall back to `image` for those rather than force-migrating them. */
  thumb?: string;
  /** ISO timestamp — newest last, so the gallery reads in render order. */
  at: string;
  /** Which generation of the plan set produced this sheet. Bumping the render rules changes what a
   *  sheet CONTAINS, and the gallery is durable — so without this a farmer ends up holding two
   *  sheets both called "04 — Water Plan", from different eras, indistinguishable and both
   *  downloadable. Absent on anything saved before versioning existed, which is itself the signal
   *  that it is old. */
  planVersion?: string;
  /** The visual renderer recipe. Unlike planVersion, this can change without orphaning a paid
   *  sheet; the gallery keeps the old bitmap and marks it as needing a new render. */
  renderRecipe?: string;
  /** Durable provenance. Labels are presentation copy and must never be used to infer whether a
   * paid model actually produced the saved pixels. Older rows omit these fields and read as legacy. */
  resultKind?: SheetResultKind;
  provider?: SheetProvider;
  /** The requested composition policy, not evidence that generated features were verified. */
  geometryLock?: boolean;
  showcase?: boolean;
  jobId?: string;
  attemptId?: string;
  designRevision?: string;
  /** A difference score or geometryLock flag must never automatically promote this to verified. */
  validationStatus?: SheetValidationStatus;
  /** Original worker output location, retained separately from the final composed bitmap. */
  rawOutputPath?: string;
  /** The base actually baked into this immutable bitmap. The picker may since have changed. */
  underlay?: SheetUnderlay;
}

const RESULT_KINDS = new Set<SheetResultKind>([
  'exact',
  'hybrid',
  'ai-polished',
  'ai-illustrated',
  'legacy',
]);
const PROVIDERS = new Set<SheetProvider>(['exact', 'openai', 'gemini', 'unknown']);
const UNDERLAYS = new Set<SheetUnderlay>(['photo', 'satellite', 'plain']);
const VALIDATION_STATUSES = new Set<SheetValidationStatus>(['needs-review', 'unscored', 'verified']);
const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,([A-Za-z0-9+/]*={0,2})$/i;

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function boundedProvenanceString(value: unknown, maxLength: number): value is string {
  return nonEmptyString(value) && value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function isImageDataUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = IMAGE_DATA_URL.exec(value);
  if (!match) return false;
  const payload = match[1];
  return payload.length > 0 && payload.length % 4 === 0;
}

/** IndexedDB is durable but untyped. Validate every row at both boundaries so an interrupted old
 * write, manual browser edit, or future incompatible build cannot masquerade as a saved render. */
function normaliseStoredSheet(value: unknown): StoredSheet | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    !nonEmptyString(row.id)
    || !nonEmptyString(row.siteId)
    || !nonEmptyString(row.label)
    || !isImageDataUrl(row.image)
    || !nonEmptyString(row.at)
    || !Number.isFinite(Date.parse(row.at))
  ) return null;
  if (row.thumb !== undefined && !isImageDataUrl(row.thumb)) return null;
  if (row.planVersion !== undefined && !nonEmptyString(row.planVersion)) return null;
  if (row.renderRecipe !== undefined && !nonEmptyString(row.renderRecipe)) return null;
  if (row.resultKind !== undefined && (
    typeof row.resultKind !== 'string'
    || !RESULT_KINDS.has(row.resultKind as SheetResultKind)
  )) return null;
  if (row.provider !== undefined && (
    typeof row.provider !== 'string'
    || !PROVIDERS.has(row.provider as SheetProvider)
  )) return null;
  if (row.geometryLock !== undefined && typeof row.geometryLock !== 'boolean') return null;
  if (row.showcase !== undefined && typeof row.showcase !== 'boolean') return null;
  if (row.jobId !== undefined && !boundedProvenanceString(row.jobId, 256)) return null;
  if (row.attemptId !== undefined && !boundedProvenanceString(row.attemptId, 256)) return null;
  if (row.designRevision !== undefined && !boundedProvenanceString(row.designRevision, 256)) return null;
  if (row.rawOutputPath !== undefined && !boundedProvenanceString(row.rawOutputPath, 2048)) return null;
  if (row.validationStatus !== undefined && (
    typeof row.validationStatus !== 'string'
    || !VALIDATION_STATUSES.has(row.validationStatus as SheetValidationStatus)
  )) return null;
  if (row.underlay !== undefined && (
    typeof row.underlay !== 'string'
    || !UNDERLAYS.has(row.underlay as SheetUnderlay)
  )) return null;

  return {
    id: row.id,
    siteId: row.siteId,
    label: row.label,
    image: row.image,
    at: row.at,
    ...(row.thumb === undefined ? {} : { thumb: row.thumb }),
    ...(row.planVersion === undefined ? {} : { planVersion: row.planVersion }),
    ...(row.renderRecipe === undefined ? {} : { renderRecipe: row.renderRecipe }),
    ...(row.resultKind === undefined ? {} : { resultKind: row.resultKind as SheetResultKind }),
    ...(row.provider === undefined ? {} : { provider: row.provider as SheetProvider }),
    ...(row.geometryLock === undefined ? {} : { geometryLock: row.geometryLock }),
    ...(row.showcase === undefined ? {} : { showcase: row.showcase }),
    ...(row.jobId === undefined ? {} : { jobId: row.jobId }),
    ...(row.attemptId === undefined ? {} : { attemptId: row.attemptId }),
    ...(row.designRevision === undefined ? {} : { designRevision: row.designRevision }),
    ...(row.validationStatus === undefined ? {} : { validationStatus: row.validationStatus as SheetValidationStatus }),
    ...(row.rawOutputPath === undefined ? {} : { rawOutputPath: row.rawOutputPath }),
    ...(row.underlay === undefined ? {} : { underlay: row.underlay as SheetUnderlay }),
  };
}

type PersistedStoredSheet = StoredSheet & {
  logicalId: string;
  logicalSiteId: string;
};

const ownedKey = (
  logicalKey: string,
  ownerUid?: string | null,
) => {
  if (ownerUid !== undefined) return accountLocalStorageKey(logicalKey, ownerUid);
  // Sample mode's safety shim intercepts localStorage only. IndexedDB remains the
  // browser's real durable database, so bare sheet IDs would expose or overwrite a
  // farmer's pre-isolation sheets while viewing the demo. Give implicit sample calls
  // their own non-uid namespace; explicit owners used by sync/tests still win.
  try {
    if (
      typeof window !== 'undefined'
      && window.sessionStorage.getItem(SAMPLE_MODE_FLAG) === '1'
    ) {
      return `${logicalKey}${ACCOUNT_LOCAL_STORAGE_OWNER_SEPARATOR}${SAMPLE_OWNER}`;
    }
  } catch {
    // If sessionStorage is unavailable, sample mode cannot have been entered safely.
  }
  return activeAccountLocalStorageKey(logicalKey);
};

function persistedSheet(
  sheet: StoredSheet,
  ownerUid?: string | null,
): PersistedStoredSheet {
  return {
    ...sheet,
    id: ownedKey(sheet.id, ownerUid),
    siteId: ownedKey(sheet.siteId, ownerUid),
    logicalId: sheet.id,
    logicalSiteId: sheet.siteId,
  };
}

function logicalSheet(value: unknown, expectedSiteId: string): StoredSheet | null {
  const physical = normaliseStoredSheet(value);
  if (!physical || typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  // Rows written before account isolation have no logical fields. They remain
  // available only when the physical query itself is bare (local-only builds);
  // sample, signed-in and configured-guest queries use suffixed site ids and
  // therefore never silently claim those ownerless legacy rows.
  const logicalId = row.logicalId === undefined ? physical.id : row.logicalId;
  const logicalSiteId = row.logicalSiteId === undefined ? physical.siteId : row.logicalSiteId;
  if (!nonEmptyString(logicalId) || logicalSiteId !== expectedSiteId) return null;
  return {
    ...physical,
    id: logicalId,
    siteId: expectedSiteId,
  };
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
    let settled = false;
    const finish = (db: IDBDatabase | null) => {
      // A blocked request can later succeed after we have already degraded to
      // session-only. Close that late handle instead of leaking it.
      if (settled) {
        db?.close();
        return;
      }
      settled = true;
      resolve(db);
    };
    req.onupgradeneeded = () => {
      try {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          // Sheets are always read per site, never globally.
          store.createIndex('siteId', 'siteId', { unique: false });
        }
      } catch {
        finish(null);
      }
    };
    req.onsuccess = () => finish(req.result);
    req.onerror = () => finish(null);
    // A blocked upgrade (another tab holding an old version) must not hang the gallery forever.
    req.onblocked = () => finish(null);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

/** Every sheet saved for this site, oldest first. Returns [] on any failure — never throws. */
export async function loadSheets(
  siteId: string,
  ownerUid?: string | null,
): Promise<StoredSheet[]> {
  if (!nonEmptyString(siteId)) return [];
  const physicalSiteId = ownedKey(siteId, ownerUid);
  const db = await openDb();
  if (!db) return [];
  try {
    return await new Promise((resolve) => {
      try {
        const req = tx(db, 'readonly').index('siteId').getAll(physicalSiteId);
        req.onsuccess = () => {
          const rows = ((req.result as unknown[]) ?? [])
            .map((row) => logicalSheet(row, siteId))
            .filter((row): row is StoredSheet => row !== null);
          rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
          resolve(rows);
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } finally {
    db.close();
  }
}

/** Persist one sheet. Resolves false when storage was unavailable or full, so the caller can tell
 *  the farmer their sheet is session-only rather than silently implying it is safe. */
/** A gallery row WITHOUT its image — everything the grid needs and nothing it must not hold.
 *
 *  THE MEMORY CONTRACT, and the second half of the crash fix that #84 started. loadSheets()
 *  returns every row's full `image` data URL, so merely OPENING the glossy section pulled every
 *  saved sheet into the JS heap as strings — 30 sheets at 1-3 MB each is 60-90 MB held in React
 *  state before a single pixel is drawn. On an in-app iOS webview (the tightest memory ceiling
 *  the app runs under, and the one Rory's crash screenshot came from) that baseline is most of
 *  the budget; expanding one sheet then tips it over. The grid shows thumbnails; it has no
 *  business holding the print-resolution originals. */
export type StoredSheetMeta = Omit<StoredSheet, 'image'>;

/** Load every sheet for a site WITHOUT retaining the image payloads. Pair with loadSheetImage.
 *
 * This must NOT be implemented as `loadSheets(...).map(({ image, ...meta }) => meta)`. IndexedDB's
 * `getAll()` structured-clones every full-resolution bitmap into the JS heap before that map gets
 * a chance to discard it. Ubhejane had 120 saved maps: opening Preview therefore materialised the
 * entire print gallery at once on an iPhone, then the exact-sheet compositor arrived on top of it
 * and Safari killed the tab. A cursor still validates the complete durable row, but exposes only
 * one row to JavaScript at a time; after its small metadata copy is made, that row's image can be
 * collected before the next one arrives. */
export async function loadSheetMetas(
  siteId: string,
  ownerUid?: string | null,
): Promise<StoredSheetMeta[]> {
  if (!nonEmptyString(siteId)) return [];
  const physicalSiteId = ownedKey(siteId, ownerUid);
  const db = await openDb();
  if (!db) return [];
  try {
    return await new Promise((resolve) => {
      const rows: StoredSheetMeta[] = [];
      try {
        const req = tx(db, 'readonly').index('siteId').openCursor(physicalSiteId);
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
            resolve(rows);
            return;
          }
          const logical = logicalSheet(cursor.value, siteId);
          if (logical) {
            const { image: _image, ...meta } = logical;
            rows.push(meta);
          }
          cursor.continue();
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } finally {
    db.close();
  }
}

/** Fetch ONE sheet's full image, on demand — when the farmer opens it, not when the grid mounts.
 *  Returns null when the row is gone or unreadable; callers show the thumbnail rather than throw. */
export async function loadSheetImage(
  id: string,
  ownerUid?: string | null,
): Promise<string | null> {
  if (!nonEmptyString(id)) return null;
  const physicalId = ownedKey(id, ownerUid);
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise((resolve) => {
      try {
        const req = tx(db, 'readonly').get(physicalId);
        req.onsuccess = () => {
          const row = req.result as { image?: unknown } | undefined;
          resolve(typeof row?.image === 'string' && row.image ? row.image : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } finally {
    db.close();
  }
}

/** Patch ONE field onto a stored row without the caller holding the rest of it.
 *
 *  The thumbnail backfill used to do `saveSheet({ ...row, thumb })`, which was fine while the
 *  caller held full rows — but a caller that only holds metas would silently WRITE a row with no
 *  image, destroying the saved sheet while adding its thumbnail. Read-modify-write inside one
 *  place, so that mistake cannot be made at a call site. */
export async function patchSheetThumb(
  id: string,
  thumb: string,
  ownerUid?: string | null,
): Promise<boolean> {
  if (!nonEmptyString(id) || !nonEmptyString(thumb)) return false;
  const physicalId = ownedKey(id, ownerUid);
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        const store = transaction.objectStore(STORE);
        const req = store.get(physicalId);
        req.onsuccess = () => {
          const row = req.result as Record<string, unknown> | undefined;
          if (!row || typeof row.image !== 'string') { resolve(false); return; }
          store.put({ ...row, thumb });
        };
        req.onerror = () => resolve(false);
        transaction.oncomplete = () => resolve(true);
        transaction.onabort = () => resolve(false);
        transaction.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}

export async function saveSheet(
  sheet: StoredSheet,
  ownerUid?: string | null,
): Promise<boolean> {
  const row = normaliseStoredSheet(sheet);
  if (!row) return false;
  const physicalRow = persistedSheet(row, ownerUid);
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise((resolve) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).put(physicalRow);
        transaction.oncomplete = () => resolve(true);
        transaction.onabort = () => resolve(false);
        transaction.onerror = () => resolve(false); // QuotaExceeded lands here
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}

export async function deleteSheet(
  id: string,
  ownerUid?: string | null,
): Promise<boolean> {
  if (!nonEmptyString(id)) return false;
  const physicalId = ownedKey(id, ownerUid);
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise<boolean>((resolve) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        transaction.objectStore(STORE).delete(physicalId);
        transaction.oncomplete = () => resolve(true);
        transaction.onabort = () => resolve(false);
        transaction.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}

/** Drop every sheet for one site (the gallery's "clear all"). Scoped to the site on purpose: a
 *  farmer clearing one design's maps must not lose another design's. */
export async function clearSheets(
  siteId: string,
  ownerUid?: string | null,
): Promise<boolean> {
  if (!nonEmptyString(siteId)) return false;
  const physicalSiteId = ownedKey(siteId, ownerUid);
  const db = await openDb();
  if (!db) return false;
  try {
    return await new Promise<boolean>((resolve) => {
      try {
        const transaction = db.transaction(STORE, 'readwrite');
        const store = transaction.objectStore(STORE);
        const req = store.index('siteId').getAllKeys(physicalSiteId);
        req.onsuccess = () => {
          for (const key of req.result ?? []) store.delete(key as IDBValidKey);
        };
        req.onerror = () => resolve(false);
        transaction.oncomplete = () => resolve(true);
        transaction.onabort = () => resolve(false);
        transaction.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } finally {
    db.close();
  }
}

/** Rough byte size of a data URL, for quota messaging. base64 carries 3 bytes per 4 chars. */
export function dataUrlBytes(dataUrl: string): number {
  const match = IMAGE_DATA_URL.exec(dataUrl);
  if (!match || match[1].length === 0 || match[1].length % 4 !== 0) return 0;
  const payload = match[1];
  const b64 = payload.length;
  const padding = dataUrl.endsWith('==') ? 2 : dataUrl.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((b64 * 3) / 4) - padding);
}
