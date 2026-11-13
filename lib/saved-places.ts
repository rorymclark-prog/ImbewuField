import { annualRainfallMm } from './climate-temperature';
import {
  upsertPlace, removePlace, mergePlaces, upsertPlaceContextResult, DEFINITIVE_CONTEXT_REJECTIONS,
  type PlaceContextOutcome,
} from './user-sync';
import { getFirebase } from './firebase/init';
import { isSampleMode, getSandboxPlaces, upsertSandboxPlace, deleteSandboxPlace } from './sample-mode';
import { addTombstone, readTombstones } from './local-tombstones';
import { accountLocalStorageKey, activeAccountLocalStorageKey, activeAccountUid } from './account-local-storage';
import {
  bindSiteContext, coordinateSiteIdForPlace, isContextBoundToPlace, normaliseSiteCountryContext, type SiteCountryContext,
} from './international/site-context';
import { placeRevision, sameSiteContext, withoutStaleSiteContext } from './international/place-context-merge';
import { canonicalCoordinateSiteId } from './site-id';

export type PlaceLabel = 'home' | 'field' | 'water' | 'other';

// The label sets the pin colour on the map.
export const PLACE_LABELS: { v: PlaceLabel; name: string; color: string }[] = [
  { v: 'home',  name: 'Home',  color: '#7A4408' },
  { v: 'field', name: 'Field', color: '#1F4D2B' },
  { v: 'water', name: 'Water', color: '#235E86' },
  { v: 'other', name: 'Other', color: '#5C5040' },
];
export const placeColor = (label?: PlaceLabel): string =>
  PLACE_LABELS.find((l) => l.v === label)?.color ?? '#C07A1E';

export interface SavedPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  biome: string;
  rainfall?: number;
  rainfallSource?: string;
  elevation: number;
  savedAt: string; // ISO date
  updatedAt?: number; // ms — last edit time, drives cross-device newest-wins merge
  label?: PlaceLabel;
  color?: string;  // custom hex — overrides label colour when set
  notes?: string;
  /** Explicit grower context; absent on legacy places and never inferred from language. */
  siteCountryContext?: SiteCountryContext;
}

export const resolveColor = (p: { label?: PlaceLabel; color?: string }): string =>
  p.color ?? placeColor(p.label);

const KEY = 'permamap_saved_places';
const DELETED_KEY = `${KEY}_deleted`; // local deletion tombstones — see lib/local-tombstones.ts

const PLACE_LABEL_VALUES = new Set<PlaceLabel>(PLACE_LABELS.map((label) => label.v));

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isValidSavedPlace(value: unknown): value is SavedPlace {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.name === 'string'
    && typeof value.lat === 'number' && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90
    && typeof value.lon === 'number' && Number.isFinite(value.lon) && value.lon >= -180 && value.lon <= 180
    && typeof value.biome === 'string'
    && (value.rainfall === undefined || (typeof value.rainfall === 'number' && Number.isFinite(value.rainfall)))
    && typeof value.elevation === 'number' && Number.isFinite(value.elevation)
    // Pre-sync local records used an empty timestamp. Keep them readable at timestamp zero;
    // network shares apply the stricter ISO requirement at their own trust boundary.
    && typeof value.savedAt === 'string'
    && (value.savedAt === '' || Number.isFinite(Date.parse(value.savedAt)))
    && (value.updatedAt === undefined
      || (typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) && value.updatedAt >= 0))
    && (value.label === undefined || PLACE_LABEL_VALUES.has(value.label as PlaceLabel))
    && (value.color === undefined || typeof value.color === 'string')
    && (value.notes === undefined || typeof value.notes === 'string');
}

function placeTimestamp(place: SavedPlace): number {
  const savedAt = Date.parse(place.savedAt);
  return place.updatedAt ?? (Number.isFinite(savedAt) ? savedAt : 0);
}

export function normalisePlaces(value: unknown): SavedPlace[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedPlace>();
  for (const candidate of value) {
    if (!isValidSavedPlace(candidate)) continue;
    const { siteCountryContext: rawContext, ...rest } = candidate;
    const siteCountryContext = normaliseSiteCountryContext(rawContext);
    // Corrupt optional metadata must not make the farmer's original place disappear.
    const safeCandidate = rawContext === undefined ? candidate
      : { ...rest, ...(siteCountryContext ? { siteCountryContext } : {}) };
    const current = byId.get(candidate.id);
    if (!current || placeTimestamp(candidate) >= placeTimestamp(current)) {
      byId.set(candidate.id, safeCandidate);
    }
  }
  return [...byId.values()];
}

export type SiteContextSaveResult =
  | { status: 'local-saved'; places: SavedPlace[] }
  | { status: 'missing-site' | 'invalid-context' | 'storage-unavailable' };

/** Later cloud outcome of one saved place's context-only update (see user-sync.ts's
 *  PlaceContextOutcome). Reported separately because a local save is not a cloud acknowledgement.
 *  `localConfirmation` says what happened to the local confirmation: 'rolled-back' after a
 *  DEFINITIVE rejection (the cloud row is a different place), 'replaced' when the cloud already
 *  held a later confirmation of the same base and that authoritative one was adopted locally, and
 *  'kept' for offline/pending outcomes, which leave an unacknowledged local description. */
export type SiteContextCloudReport = {
  placeId: string;
  outcome: PlaceContextOutcome;
  localConfirmation: 'kept' | 'rolled-back' | 'replaced';
};

// Remove or replace exactly the confirmation this operation wrote, and only while it is still
// current: same mounted account, same row identity (id, revision, savedAt) and the very same
// confirmation. A newer confirmation, a whole-place edit or another account is left alone. The
// RAW stored array is edited row-by-row so every other row — including ones the readable
// projection would drop — is written back untouched.
function swapLocalContext(uid: string, confirmed: SiteCountryContext, replacement: SiteCountryContext | null): boolean {
  const base = confirmed.base;
  if (!base || activeAccountUid() !== uid) return false;
  try {
    const storageKey = accountLocalStorageKey(KEY, uid);
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(raw)) return false;
    let changed = false;
    const next = raw.map((row: unknown) => {
      if (!isRecord(row) || row.id !== base.placeId) return row;
      const current = normaliseSiteCountryContext(row.siteCountryContext);
      if (!current || !sameSiteContext(current, confirmed)
        || placeRevision(row as unknown as SavedPlace) !== base.revision || row.savedAt !== base.savedAt) return row;
      const { siteCountryContext: _superseded, ...rest } = row;
      if (replacement && !isContextBoundToPlace(replacement, row as unknown as SavedPlace)) return row;
      changed = true;
      return replacement ? { ...rest, siteCountryContext: replacement } : rest;
    });
    if (!changed) return false;
    localStorage.setItem(storageKey, JSON.stringify(next));
    notify();
    return true;
  } catch {
    return false;
  }
}

// Deletion markers decide whether a site still exists, so an unreadable marker map must stop a
// metadata write rather than read as "nothing was deleted" (local-tombstones' own reader fails open
// by design for its merge callers).
function readTombstonesStrict(storageKey: string): Record<string, number> | null {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed)) return null;
  for (const value of Object.values(parsed)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  }
  return readTombstones(storageKey);
}

/** Read the current account's places at the moment of confirmation. Never accept an
 * old place object from the editor: it could recreate a deletion or overwrite a move.
 *
 * Context is a metadata edit: it keeps each place's `updatedAt`, so it can never outrank a
 * deletion or a newer move/notes edit made elsewhere, and the cloud copy is changed only by the
 * context-only transaction (never by a whole-place upsert). Each alias is bound independently to
 * its own (id, revision, savedAt) — the form's transient context is never stored unbound. It is
 * not a cleanup or migration: the raw stored array is updated row-by-row, so unrelated rows
 * (even malformed ones the readable projection hides) survive byte-for-byte in meaning, and a
 * stored value that is not an array is refused rather than rewritten.
 * `onCloudReport`, when given, receives each place's later cloud outcome — 'applied'/'unchanged'
 * are the only acknowledgements, 'unavailable' etc. are pending, a definitive rejection rolls
 * back the still-current local confirmation and a superseded one adopts the cloud's later winner.
 * Reports are dropped unless the mounted owner AND the Firebase user still equal the captured one. */
export function updateSiteCountryContext(
  siteId: string, value: unknown, onCloudReport?: (report: SiteContextCloudReport) => void,
): SiteContextSaveResult {
  const canonical = canonicalCoordinateSiteId(siteId);
  const context = normaliseSiteCountryContext(value);
  if (!canonical || !context || context.siteId !== canonical) return { status: 'invalid-context' };
  if (typeof window === 'undefined') return { status: 'storage-unavailable' };
  try {
    const sample = isSampleMode();
    const raw: unknown = sample ? null : JSON.parse(localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? '[]');
    if (!sample && !Array.isArray(raw)) return { status: 'storage-unavailable' };
    const current = sample ? normalisePlaces(getSandboxPlaces()) : normalisePlaces(raw);
    const tombstones = sample ? {} : readTombstonesStrict(activeAccountLocalStorageKey(DELETED_KEY));
    if (!tombstones) return { status: 'storage-unavailable' };
    const aliases = current.filter(place => coordinateSiteIdForPlace(place) === canonical);
    if (!aliases.length || aliases.some(place => tombstones[place.id]
      && tombstones[place.id] > placeTimestamp(place))) return { status: 'missing-site' };
    const bound = new Map<string, SiteCountryContext>();
    for (const place of aliases) {
      const own = bindSiteContext(context, place);
      if (!own) return { status: 'storage-unavailable' };
      bound.set(place.id, own);
    }
    let updated: SavedPlace[];
    if (sample) {
      updated = current.map(place => bound.has(place.id)
        ? { ...place, siteCountryContext: bound.get(place.id) } : place);
      for (const place of updated) if (bound.has(place.id)) upsertSandboxPlace(place);
    } else {
      // Only the row whose identity the confirmation was bound to is touched; every other raw
      // row (other sites, stale duplicates of the same id, malformed rows) is kept as stored.
      const next = (raw as unknown[]).map(row => {
        if (!isValidSavedPlace(row)) return row;
        const own = bound.get(row.id);
        return own && own.base?.revision === placeRevision(row) && own.base.savedAt === row.savedAt
          ? { ...row, siteCountryContext: own } : row;
      });
      localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(next));
      updated = normalisePlaces(next);
    }
    notify();
    // Use the same mounted owner as the local namespace during an auth transition.
    // Existing sync owns transport, conflict handling and retry; this is not a cloud ack.
    const uid = sample ? null : activeAccountUid();
    if (uid) {
      for (const [placeId, confirmed] of bound) {
        upsertPlaceContextResult(uid, confirmed)
          .then(({ outcome, authoritative }) => {
            // A late result for a previous account must neither mutate nor report into the new
            // one. Both guards matter: a transition where only the mounted owner or only the
            // Firebase user has moved is not this operation's account any more.
            if (outcome === 'account-changed' || activeAccountUid() !== uid || currentUid() !== uid) return;
            let localConfirmation: SiteContextCloudReport['localConfirmation'] = 'kept';
            if (DEFINITIVE_CONTEXT_REJECTIONS.includes(outcome) && swapLocalContext(uid, confirmed, null)) {
              localConfirmation = 'rolled-back';
            } else if (outcome === 'superseded' && authoritative && swapLocalContext(uid, confirmed, authoritative)) {
              localConfirmation = 'replaced';
            }
            onCloudReport?.({ placeId, outcome, localConfirmation });
          })
          .catch(() => {});
      }
    }
    return { status: 'local-saved', places: updated };
  } catch {
    return { status: 'storage-unavailable' };
  }
}

export function loadPlaces(): SavedPlace[] {
  if (isSampleMode()) return normalisePlaces(getSandboxPlaces());
  if (typeof window === 'undefined') return [];
  try {
    return normalisePlaces(JSON.parse(localStorage.getItem(activeAccountLocalStorageKey(KEY)) ?? '[]'));
  } catch {
    return [];
  }
}

function notify() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('permamap-places-changed'));
}

function currentUid(): string | undefined {
  return getFirebase()?.auth?.currentUser?.uid;
}

/** Ephemeral caller proof, never persisted. The general store must not import
 * client context observers: read-only consumers also load this module. */
export interface SavedPlaceWriteGuard { isCurrent: () => boolean }
export function savePlace(place: SavedPlace): SavedPlace[];
export function savePlace(place: SavedPlace, guard: SavedPlaceWriteGuard | null): SavedPlace[] | null;
export function savePlace(place: SavedPlace, guard?: SavedPlaceWriteGuard | null): SavedPlace[] | null {
  const guarded = arguments.length > 1;
  const isCurrent = () => {
    if (!guarded) return true;
    try { return guard?.isCurrent() === true; } catch { return false; }
  };
  if (!isCurrent()) return null;
  // Keep the cloud destination bound to the action that chose this site. An
  // own-change listener can switch account after the local write but before sync.
  const owner = guarded ? currentUid() : undefined;
  if (!isValidSavedPlace(place)) throw new Error('Invalid saved place');
  // A whole-place save is a deliberate edit that mints a NEW revision. A country confirmation is
  // bound to the exact revision it described, so a copy carried in from the old row (including a
  // deliberate re-add of the same id) is dropped and the grower must confirm the place again.
  const stamped: SavedPlace = withoutStaleSiteContext({ ...place, updatedAt: Date.now() });
  if (!isCurrent()) return null;
  if (isSampleMode()) {
    if (!isCurrent()) return null;
    const updated = upsertSandboxPlace(stamped);
    if (!isCurrent()) return null;
    notify();
    return isCurrent() ? updated : null;
  }
  const places = loadPlaces().filter(p => p.id !== stamped.id);
  const updated = [stamped, ...places];
  const key = activeAccountLocalStorageKey(KEY), raw = JSON.stringify(updated);
  if (!isCurrent()) return null;
  localStorage.setItem(key, raw);
  if (!isCurrent()) return null;
  notify();
  if (!isCurrent()) return null;
  const uid = guarded ? owner : currentUid();
  if (uid) upsertPlace(uid, stamped).catch(() => {});
  return isCurrent() ? updated : null;
}

export function deletePlace(id: string): SavedPlace[] {
  if (isSampleMode()) {
    const current = normalisePlaces(getSandboxPlaces());
    if (!id || !current.some((place) => place.id === id)) return current;
    const updated = deleteSandboxPlace(id);
    notify();
    return updated;
  }
  const current = loadPlaces();
  if (!id || !current.some((place) => place.id === id)) return current;
  const deletedAt = Date.now();
  const updated = current.filter(p => p.id !== id);
  // localStorage writes are synchronous: persist the visible deletion before its tombstone so
  // a quota/security failure cannot leave a deletion marker for a place still present locally.
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  addTombstone(activeAccountLocalStorageKey(DELETED_KEY), id, deletedAt);
  notify();
  const uid = currentUid();
  // Thread the SAME timestamp into removePlace() as its `deletedAtMs` — not a fresh Date.now()
  // sampled whenever that async transaction eventually commits — so a delayed delete on a slow
  // connection can't retroactively kill a genuinely newer edit from another device. See
  // removePlace()/isDeleteStale() in lib/user-sync.ts.
  if (uid) removePlace(uid, id, deletedAt).catch(() => {});
  return updated;
}

/**
 * Merge an externally-sourced batch of places — currently only the `?share=<code>` site import
 * in components/Map.tsx — into localStorage through the SAME union-by-id/newest-updatedAt-wins/
 * tombstone-aware path every other write in this app goes through (lib/user-sync.ts's
 * mergeItems()), instead of a raw full-array `localStorage.setItem` overwrite.
 *
 * Why this matters: the raw overwrite bypassed loadPlaces()/mergeItems()/tombstones entirely, so
 * importing a shared site could silently clobber places this device had added locally since its
 * last sync, or resurrect a place this device had just deleted (its local tombstone — see
 * lib/local-tombstones.ts — was never consulted). This still delivers the shared places: any
 * incoming place absent locally, or newer (by updatedAt) than what's stored locally, wins the
 * merge exactly as it would from any other sync path — only a place this device deliberately
 * tombstoned in a way that outranks the incoming copy is excluded.
 *
 * A shared site carries no deletion tombstones of its own (see lib/site-share.ts's
 * SharedSiteData — no `deleted` field), so `remoteDel` is always {}.
 */
export function mergeIncomingPlaces(incoming: SavedPlace[]): SavedPlace[] {
  if (isSampleMode()) return getSandboxPlaces(); // sample mode never accepts external data (safety layer)
  const safeIncoming = normalisePlaces(incoming);
  if (typeof window === 'undefined') return safeIncoming;
  const local = loadPlaces();
  const localDel = readTombstones(activeAccountLocalStorageKey(DELETED_KEY));
  const { items } = mergePlaces(
    safeIncoming,
    local,
    {},
    localDel,
    Date.now(),
    placeTimestamp,
  );
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(items));
  notify();
  return items;
}

export function updatePlacePosition(id: string, lat: number, lon: number): SavedPlace[] {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90
      || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('Invalid place position');
  }
  if (isSampleMode()) {
    const current = normalisePlaces(getSandboxPlaces());
    const existing = current.find(p => p.id === id);
    if (!existing || (existing.lat === lat && existing.lon === lon)) return current;
    const updated = upsertSandboxPlace(withoutStaleSiteContext({ ...existing, lat, lon, updatedAt: Date.now() }));
    notify();
    return updated;
  }
  const current = loadPlaces();
  const existing = current.find((place) => place.id === id);
  if (!existing || (existing.lat === lat && existing.lon === lon)) return current;
  // Moving the pin mints a new revision at new coordinates: the old confirmation described a
  // different place, so it is dropped here (the resolver would ignore it anyway) and cannot
  // re-bind if the pin is later moved back.
  const moved: SavedPlace = withoutStaleSiteContext({ ...existing, lat, lon, updatedAt: Date.now() });
  const updated = current.map(p => {
    if (p.id !== id) return p;
    return moved;
  });
  localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(updated));
  notify();
  const uid = currentUid();
  if (uid) upsertPlace(uid, moved).catch(() => {});
  return updated;
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two lat/lon points, in metres. Pure, no dependency added —
 * no other geo/haversine helper existed in lib/ to reuse (checked). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Find the nearest already-saved place within `radiusM` metres of (lat, lon) — used by the
 * save flow (components/SavedPlaces.tsx handleSave) to warn before minting a second SavedPlace
 * row for the same real-world farm (two saves of the same site fork downstream coordinate-keyed
 * data, e.g. designSiteIdFromLocation's 5dp-rounded site id). Pure — reads via loadPlaces() —
 * so it's trivially unit-testable and does no merging/deciding on its own; callers decide what
 * to do with the match.
 */
export function findNearbyPlace(lat: number, lon: number, radiusM = 60): SavedPlace | null {
  let best: SavedPlace | null = null;
  let bestDist = Infinity;
  for (const p of loadPlaces()) {
    const d = distanceMeters(lat, lon, p.lat, p.lon);
    if (d <= radiusM && d < bestDist) {
      best = p;
      bestDist = d;
    }
  }
  return best;
}

/**
 * THE save-time duplicate-site guard — the ONE authority every SavedPlace-creation entry point
 * must call before minting a new id (components/SavedPlaces.tsx handleSave, components/
 * DataPanel.tsx quickSavePlace, components/Map.tsx confirmSavePlace). A review caught the guard
 * wired into only one of the three save buttons; per this repo's recurring drift pattern, the
 * check + wording live here once rather than being pasted per call site.
 *
 * Returns the existing nearby place the farmer chose to UPDATE (callers must reuse its id — that
 * is the entire point, so coordinate-keyed downstream data doesn't fork onto a second id), or
 * null to proceed with a brand-new save (no nearby place, farmer declined, or SSR).
 *
 * The question is asked through the injected `ask` (components/AppConfirm.tsx useAppConfirm),
 * never window.confirm: embedded webviews suppress native dialogs and auto-return false, which
 * silently answered "make a duplicate" — the exact outcome this guard exists to prevent. The
 * message and both button labels still live HERE, once, so the three call sites can't drift.
 */
export interface NearbyUpdateAsk {
  (opts: {
    title?: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
  }): Promise<boolean>;
}

export async function promptNearbyUpdate(
  lat: number,
  lon: number,
  ask: NearbyUpdateAsk,
): Promise<SavedPlace | null> {
  if (typeof window === 'undefined') return null;
  const nearby = findNearbyPlace(lat, lon);
  if (!nearby) return null;
  const distM = Math.round(distanceMeters(lat, lon, nearby.lat, nearby.lon));
  const update = await ask({
    title: 'Update saved place?',
    message: `You already saved "${nearby.name}" about ${distM} m from here. Update that place instead of creating a second one?`,
    confirmLabel: `Update "${nearby.name}"`,
    cancelLabel: 'Save as new place',
  });
  return update ? nearby : null;
}

const MAIN_KEY = 'imbewu_main_site_id';

export function getMainSiteId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(activeAccountLocalStorageKey(MAIN_KEY));
}

export function setMainSiteId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(activeAccountLocalStorageKey(MAIN_KEY), id);
  notify(); // reuse the same 'permamap-places-changed' event listeners already subscribe to
}

/**
 * Scope a list of drawn features (land parcels, water areas) to the place the farmer
 * currently has open.
 *
 * The map panel used to list EVERY feature on the account no matter which place was
 * selected, so opening Ubhejane Crèche showed Carl and Sandys Place's six parcels.
 * Each row was already chip-labelled with the owning place's name, which is exactly
 * why it survived so long: the data and the labelling were right, only the filtering
 * was missing, so the panel looked informative rather than wrong.
 *
 * Features carrying no placeId are deliberately kept in EVERY view. They pre-date the
 * place↔feature link, or were drawn with no place open, so no place can claim them —
 * and hiding them would make a farmer's own traced land look deleted. Showing an
 * orphan once too often is recoverable; appearing to lose it is not.
 */
export function featuresForPlace<T extends { placeId?: string }>(
  features: T[],
  activePlaceId: string | null | undefined,
): T[] {
  if (!activePlaceId) return features;
  return features.filter((f) => !f.placeId || f.placeId === activePlaceId);
}

// Pure resolver (takes the already-loaded list) so callers can reuse a single
// loadPlaces() read and so this stays trivially testable.
export function resolveMainSite(places: SavedPlace[]): SavedPlace | null {
  if (places.length === 0) return null;
  if (places.length === 1) return places[0]; // sole site is auto-main, no prompt
  const mainId = getMainSiteId();
  if (mainId) {
    const found = places.find((p) => p.id === mainId);
    if (found) return found;
  }
  // No main set, or the previously-pinned place was deleted — fall back to the
  // most-recently-touched place. Array order isn't reliable: savePlace() prepends
  // new saves but updatePlacePosition() edits in place without reordering.
  return places.reduce((newest, p) => {
    const pTime = p.updatedAt ?? Date.parse(p.savedAt);
    const newestTime = newest.updatedAt ?? Date.parse(newest.savedAt);
    return pTime > newestTime ? p : newest;
  }, places[0]);
}


/** A refresh must not replace a saved/entered value with an outage placeholder. Legacy values
 * stay readable with their original provenance; this does not retrospectively certify them. */
export function savedRainfallFields(rain: { annual?: unknown; rainfallSource?: string } | null | undefined, existing?: Pick<SavedPlace, 'rainfall' | 'rainfallSource'> | null): Pick<SavedPlace, 'rainfall' | 'rainfallSource'> {
  if (existing && typeof existing.rainfall === 'number' && Number.isFinite(existing.rainfall)) {
    return { rainfall: existing.rainfall, ...(existing.rainfallSource ? { rainfallSource: existing.rainfallSource } : {}) };
  }
  const value = annualRainfallMm(rain);
  return value === null ? {} : { rainfall: value, rainfallSource: rain!.rainfallSource };
}
