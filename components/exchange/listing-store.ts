/*
 * ═══ FARMER EXCHANGE — the farmer's OWN listings, stored on this device ══════
 *
 * A farmer posting on the exchange writes here and nowhere else. This is
 * account-scoped browser storage, exactly like lib/saved-places.ts and
 * lib/crop-plan.ts: `activeAccountLocalStorageKey()` namespaces the key per
 * signed-in uid, and in sample mode the root storage shim (lib/sample-mode.ts)
 * has already redirected `window.localStorage` to an in-memory store — so a
 * listing typed inside the sample farm is structurally incapable of reaching a
 * real browser profile or a real farmer's account. That is the whole reason to
 * go through `activeAccountLocalStorageKey()` rather than a bare key.
 *
 * ── WHY NOTHING HERE PUBLISHES ───────────────────────────────────────────────
 *
 * v1 does NOT write to Firestore. A listing saved here is visible to this
 * browser only, and the UI says so on every card it renders. Publishing would
 * mean writing `board_posts` through `createBoardPost()`
 * (lib/db/community-queries.ts) — `toBoardPostFields()` in lib/exchange.ts
 * already produces exactly the document shape for it — and that is deliberately
 * NOT wired, because all three of these are true today:
 *
 *   a. `app_config/community = { enabled: true }` does not exist in Firestore.
 *      The rules' `communityOn()` gates every community collection, no client
 *      can write that doc, and no seed script creates it — so every community
 *      read and write is denied server-side in every environment right now.
 *   b. `NEXT_PUBLIC_COMMUNITY_ENABLED` is unset, so `communityEnabled()`
 *      (lib/community/flag.ts) is false without the per-browser preview key.
 *   c. The deployed rules do not validate the structured fields a listing adds
 *      (`qty`, `price_zar`, `crop_key`, `coarse_lat/lon`) and do not pin
 *      `owner_name` on update the way they pin `owner_id` — so a published
 *      listing's displayed author is spoofable the moment an edit UI exists.
 *
 * Rules are not deployable from this checkout, so shipping a write path would
 * produce a demo that silently fails, or — worse — a board carrying unvalidated
 * cross-farmer data. Local-only, clearly labelled, is the honest v1.
 *
 * ── THE COORDINATE RULE, ENFORCED HERE ───────────────────────────────────────
 *
 * {@link saveLocalListing} is the single write boundary, and it re-coarsens
 * every coordinate through `coarsenCoords()` (~1.1 km, 2dp) no matter what the
 * caller passed. A farmer's saved site (lib/saved-places.ts) holds a precise
 * homestead coordinate; that precision may be used in-browser to compute "how
 * far away is this listing", but it must never be attached to a listing, which
 * is a farmer-facing object. Belt and braces at the boundary rather than trust
 * in every caller.
 *
 * Nothing in this module reads another farmer's anything. A listing is a copy
 * its author chose to publish — never a live read of someone else's ledger.
 */

'use client';

import { activeAccountLocalStorageKey } from '@/lib/account-local-storage';
import {
  coarsenCoords,
  LISTING_CATEGORIES,
  LISTING_UNITS,
  type Listing,
  type ListingCategory,
  type ListingPrice,
  type ListingStatus,
  type ListingUnit,
} from '@/lib/exchange';

const KEY = 'imbewu_exchange_listings_v1';

/** Fired after any local write so every mounted exchange view re-reads. */
export const LOCAL_LISTINGS_EVENT = 'imbewu-exchange-listings-changed';

/**
 * A hard ceiling on what one browser keeps. localStorage is a shared ~5 MB
 * budget across the whole app (site evidence photos already claim 4 MB of it),
 * so an unbounded list here could silently break saving somewhere else.
 */
const MAX_LOCAL_LISTINGS = 60;

const CATEGORY_VALUES = new Set<string>(LISTING_CATEGORIES);
const UNIT_VALUES = new Set<string>(LISTING_UNITS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isValidPrice(value: unknown): value is ListingPrice {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'free':
    case 'ask':
      return true;
    case 'swap':
      return typeof value.wants === 'string';
    case 'zar':
      return (
        typeof value.amount === 'number' &&
        Number.isFinite(value.amount) &&
        value.amount >= 0 &&
        typeof value.per === 'string' &&
        (value.per === 'lot' || UNIT_VALUES.has(value.per))
      );
    default:
      return false;
  }
}

function isNullableFiniteNumber(value: unknown): boolean {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

/**
 * Defensive read-side validation, in the same spirit as `isValidSavedPlace()`.
 * Anything malformed is dropped rather than crashing the board — a half-written
 * record from a quota failure or an older app version must not take the page
 * down, and a listing rendered from unvalidated JSON is how a stored-XSS-shaped
 * bug gets in.
 */
export function isValidListing(value: unknown): value is Listing {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' && value.id.trim().length > 0 &&
    (value.kind === 'offer' || value.kind === 'want') &&
    typeof value.category === 'string' && CATEGORY_VALUES.has(value.category) &&
    (value.cropKey === null || typeof value.cropKey === 'string') &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    isNullableFiniteNumber(value.qty) &&
    (value.unit === null || (typeof value.unit === 'string' && UNIT_VALUES.has(value.unit))) &&
    isValidPrice(value.price) &&
    typeof value.farmerId === 'string' &&
    typeof value.farmerName === 'string' &&
    typeof value.areaText === 'string' &&
    isNullableFiniteNumber(value.lat) &&
    isNullableFiniteNumber(value.lon) &&
    typeof value.postedAt === 'string' && Number.isFinite(Date.parse(value.postedAt)) &&
    (value.status === 'active' || value.status === 'closed') &&
    isNullableFiniteNumber(value.availableMonth) &&
    (value.photoUrl === null || typeof value.photoUrl === 'string') &&
    typeof value.source === 'string' &&
    typeof value.isDemo === 'boolean'
  );
}

function notify(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(LOCAL_LISTINGS_EVENT));
}

function readAll(): Listing[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(activeAccountLocalStorageKey(KEY));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidListing);
  } catch {
    return [];
  }
}

function writeAll(listings: Listing[]): Listing[] {
  const capped = listings.slice(0, MAX_LOCAL_LISTINGS);
  if (typeof window === 'undefined') return capped;
  try {
    window.localStorage.setItem(activeAccountLocalStorageKey(KEY), JSON.stringify(capped));
  } catch {
    // Quota exceeded or storage unavailable. Same posture as saveCropPlan():
    // the in-memory list the caller already holds stays correct for this
    // session rather than throwing out of a click handler.
  }
  notify();
  return capped;
}

/** Every listing this browser has posted, newest first. */
export function loadLocalListings(): Listing[] {
  return readAll().sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
}

export function newListingId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `local-listing-${Date.now().toString(36)}-${rand}`;
}

/**
 * What the post form hands over. Everything the store decides for itself —
 * id, timestamp, status, demo flag — is absent by construction.
 */
export interface LocalListingDraft {
  kind: Listing['kind'];
  category: ListingCategory;
  cropKey: string | null;
  title: string;
  description: string;
  qty: number | null;
  unit: ListingUnit | null;
  price: ListingPrice;
  farmerName: string;
  areaText: string;
  /** Precise or coarse — {@link saveLocalListing} coarsens it either way. */
  lat: number | null;
  lon: number | null;
  availableMonth: number | null;
}

/**
 * THE write boundary. Coarsens coordinates, stamps identity and time, and
 * pins `isDemo: false` so a farmer's own listing can never be mistaken for
 * sample data (or vice versa) anywhere downstream.
 */
export function saveLocalListing(draft: LocalListingDraft): Listing[] {
  const coords =
    draft.lat !== null && draft.lon !== null && Number.isFinite(draft.lat) && Number.isFinite(draft.lon)
      ? coarsenCoords(draft.lat, draft.lon)
      : null;

  const listing: Listing = {
    id: newListingId(),
    kind: draft.kind,
    category: draft.category,
    cropKey: draft.cropKey,
    title: draft.title.trim(),
    description: draft.description.trim(),
    qty: draft.qty,
    unit: draft.unit,
    price: draft.price,
    // No Firebase uid is required to post: v1 is device-local, so the author is
    // this device. A real published listing would carry the signed-in uid.
    farmerId: 'me',
    farmerName: draft.farmerName.trim() || 'You',
    areaText: draft.areaText.trim(),
    lat: coords ? coords.lat : null,
    lon: coords ? coords.lon : null,
    postedAt: new Date().toISOString(),
    status: 'active',
    availableMonth: draft.availableMonth,
    photoUrl: null,
    source: 'manual',
    isDemo: false,
  };

  return writeAll([listing, ...readAll()]);
}

/** Mark one of your own listings sold / filled. Keeps the record, hides it by default. */
export function setLocalListingStatus(id: string, status: ListingStatus): Listing[] {
  return writeAll(readAll().map((l) => (l.id === id ? { ...l, status } : l)));
}

export function deleteLocalListing(id: string): Listing[] {
  return writeAll(readAll().filter((l) => l.id !== id));
}

/** True for anything this browser posted — the cards that get manage controls. */
export function isLocalListing(listing: Listing): boolean {
  return !listing.isDemo && listing.farmerId === 'me';
}
