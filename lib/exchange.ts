/*
 * ═══ FARMER EXCHANGE — types + pure logic ════════════════════════════════════
 *
 * Farmers finding each other and trading seed, seedlings, surplus produce,
 * tools and labour. This module is the structured layer over the trade board
 * that already exists in the app: `BoardPost` in lib/db/types.ts, with CRUD and
 * 1:1 messaging already built in lib/db/community-queries.ts and
 * app/community/**. A {@link Listing} is a `BoardPost` PLUS the fields the
 * existing board never had — crop key, quantity, unit, price, month, distance.
 * {@link toBoardPostFields} maps back, so persisting through the existing
 * `createBoardPost()` needs no new collection, no new index and no rules change.
 *
 * ── TWO SECURITY RULES THAT ARE NOT NEGOTIABLE ───────────────────────────────
 *
 * 1. A LISTING IS A COPY THE FARMER CHOSE TO PUBLISH — NEVER A LIVE READ OF
 *    ANOTHER FARMER'S LEDGER. Nothing in the exchange may query
 *    `production_logs`, `sales_logs`, `expense_logs` or `invoices` by another
 *    uid. Under the deployed rules such a read is either DENIED, or — worse —
 *    SUCCEEDS for a same-org peer and hands one farmer another farmer's income.
 *    Prefilling a listing from the poster's OWN surplus or seed BOQ is the
 *    intended flow; reading anyone else's is a breach.
 *
 * 2. COORDINATES ON A LISTING ARE COARSE, ALWAYS. `Listing.lat/lon` is rounded
 *    to ~1.1 km by {@link coarsenCoords} (the same contract as
 *    `jitterToNeighbourhood()` at the Firestore write). The precise homestead
 *    coordinate on `NetworkFarmer` / `GardenMember` is org-internal and must
 *    never reach this module. If you render portfolio pins and exchange pins on
 *    one map, keep them in separate layers fed by separate sources — mixing
 *    them de-anonymises farmers who opted into a coarse pin only.
 *
 * ── WHAT MUST BE TRUE BEFORE THIS RUNS ON LIVE DATA ──────────────────────────
 *
 *  a. `app_config/community = { enabled: true }` must exist in Firestore. The
 *     rules' `communityOn()` gates EVERY community collection and no client can
 *     write that doc — it is seeded by no script, so the whole community layer
 *     is denied server-side in every environment today. Owner/console only.
 *  b. `NEXT_PUBLIC_COMMUNITY_ENABLED=true` (or the per-browser preview key
 *     `localStorage['imbewufield_community_preview']='1'`) — see
 *     lib/community/flag.ts. Turning on (b) without (a) yields empty lists and
 *     an unexplained load error.
 *  c. The rules must VALIDATE the new fields on create/update (`qty is number
 *     && qty > 0`, `price_zar >= 0`, `crop_key is string`, coords numeric and
 *     inside SA bounds) and must pin `owner_name` the way they already pin
 *     `owner_id` — the current update rule leaves the displayed name spoofable
 *     the moment an edit-post UI exists.
 *  d. `board_posts` read stays `signedIn()`-only. Never public.
 *  Because none of (a)-(c) is deployable from this checkout, v1 runs on
 *  {@link DEMO_LISTINGS}, which touch no backend at all.
 *
 * OUT OF SCOPE for v1, and the UI should say so plainly: no payments, no
 * escrow, no delivery or logistics, no ratings or reputation, no reservation
 * or stock semantics beyond "mark as done", and no new messaging — the
 * existing 1:1 thread IS the contact mechanism.
 *
 * SCALE: every filter here is client-side over an already-loaded array. That is
 * correct at pilot scale and is a deliberate v1 choice, not an oversight — a
 * distance filter over an unbounded board is not a v2 answer. Say so rather
 * than letting anyone assume it scales.
 *
 * Pure module: no I/O, no localStorage, no Firestore, no React.
 */

import { CROPS, cropByKey } from './crop-catalog';
import type { BoardCategory, BoardKind } from './db/types';
import { coarsenCoords, formatDistanceKm, haversineKm, type LatLon } from './network';
import { DEMO_NETWORK } from './network-demo';

// The exchange and the portfolio must agree to the metre, so there is exactly
// one haversine. Re-exported here so UI code can import everything it needs
// for a "nearest first" board from '@/lib/exchange'.
export { haversineKm, formatDistanceKm, coarsenCoords };
export type { LatLon };

/* ────────────────────────────────────────────────────────────────────────────
 * Listing shape
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * `'offer'` = I have this. `'want'` = I am looking for this. Maps onto the
 * existing `BoardKind` (`have` | `want` | `free`); "free" is expressed here as
 * an offer whose price is `{ type: 'free' }`, so giving something away and
 * selling it are the same shape with one field different.
 */
export type ListingKind = 'offer' | 'want';

/**
 * Extends the shipped `BoardCategory` (seed | seedlings | produce | tools |
 * other) with `'labour'` — work-share, which the owner's brief asks for and the
 * existing board has no home for. {@link toBoardCategory} folds it back to
 * `'other'` when persisting through the current schema.
 */
export type ListingCategory = 'seed' | 'seedlings' | 'produce' | 'tools' | 'labour' | 'other';

export const LISTING_CATEGORIES: ListingCategory[] = [
  'seed',
  'seedlings',
  'produce',
  'tools',
  'labour',
  'other',
];

/**
 * Quantity units. The propagation units (`seeds`/`seedlings`/`slips`/`seed
 * potatoes`) are exactly the vocabulary `SeedBoqRow.unit` already uses in
 * lib/crop-plan.ts, so a want-listing seeded from a farmer's own seed bill of
 * quantities carries its unit across unchanged.
 */
export type ListingUnit =
  | 'kg'
  | 'g'
  | 'seeds'
  | 'seedlings'
  | 'slips'
  | 'seed potatoes'
  | 'bunches'
  | 'punnets'
  | 'each'
  | 'bags'
  | 'days';

export const LISTING_UNITS: ListingUnit[] = [
  'kg',
  'g',
  'seeds',
  'seedlings',
  'slips',
  'seed potatoes',
  'bunches',
  'punnets',
  'each',
  'bags',
  'days',
];

/** What the price is quoted against. `'lot'` = one price for the whole quantity. */
export type PriceBasis = ListingUnit | 'lot';

export type ListingPrice =
  | { type: 'zar'; amount: number; per: PriceBasis }
  /** Barter. `wants` is free text ("swap for pumpkin seed"). */
  | { type: 'swap'; wants: string }
  /** Giving it away, or asking for a donation. */
  | { type: 'free' }
  /** Deliberately unpriced — "make me an offer". */
  | { type: 'ask' };

export type ListingStatus = 'active' | 'closed';

/**
 * Where a listing came from. `'harvest_surplus'` and `'seed_boq'` are the two
 * prefill flows: the app already computes a farmer's unaccounted surplus
 * (lib/harvest-reconciliation.ts) and their dated seed shopping list
 * (lib/crop-export-schedule.ts), so a listing can be offered pre-filled and
 * merely confirmed rather than retyped.
 */
export type ListingSource = 'manual' | 'seed_boq' | 'harvest_surplus' | 'demo';

export interface Listing {
  id: string;
  kind: ListingKind;
  category: ListingCategory;
  /**
   * A key from `CROPS` in lib/crop-catalog.ts, or null for tools, labour and
   * anything off-catalog. NEVER GUESS THIS. `matchCropKey()` in
   * lib/harvest-reconciliation.ts deliberately returns null when a free-text
   * name matches several crops ("beans" hits green, dry and broad beans);
   * filing a listing under the wrong crop corrupts crop-based discovery, so a
   * null here is correct and the farmer picks.
   */
  cropKey: string | null;
  title: string;
  description: string;
  qty: number | null;
  unit: ListingUnit | null;
  price: ListingPrice;

  /** The posting farmer's id — `Profile.id` / Firebase Auth uid in real data. */
  farmerId: string;
  /** Denormalised at post time, exactly as `BoardPost.owner_name` is. Goes stale on rename. */
  farmerName: string;
  /** Freeform town/district. Never an address. */
  areaText: string;
  /** COARSE ONLY (~1.1 km). See rule 2 in the banner. Null = area unknown. */
  lat: number | null;
  lon: number | null;

  /** ISO timestamp. */
  postedAt: string;
  status: ListingStatus;
  /** 1-12, when the goods are ready (offer) or needed by (want). Null if any time. */
  availableMonth: number | null;
  photoUrl: string | null;
  source: ListingSource;
  /** True for everything in {@link DEMO_LISTINGS}. Render a sample badge. */
  isDemo: boolean;
}

/** A listing plus its distance from wherever the viewer is standing. */
export interface ListingWithDistance {
  listing: Listing;
  /** Null when the listing has no coordinates, or the viewer has no location. */
  km: number | null;
  /** "< 1 km" / "38 km" / "Area unknown". */
  distanceLabel: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Mapping to the shipped board schema
 * ──────────────────────────────────────────────────────────────────────────*/

/** `offer` + free price → the existing `'free'` kind; otherwise `have` / `want`. */
export function toBoardKind(listing: Pick<Listing, 'kind' | 'price'>): BoardKind {
  if (listing.kind === 'want') return 'want';
  return listing.price.type === 'free' ? 'free' : 'have';
}

/** `'labour'` has no slot in the shipped `BoardCategory`; it folds to `'other'`. */
export function toBoardCategory(category: ListingCategory): BoardCategory {
  return category === 'labour' ? 'other' : category;
}

/**
 * The extra fields a `board_posts` document needs to carry a structured
 * listing. Additive and all optional, so every post written by the current UI
 * keeps rendering unchanged. NOTE the coords: they are re-coarsened here even
 * though `Listing` is already coarse — belt and braces at the write boundary,
 * because this is the last function before the data leaves the account.
 */
export function toBoardPostFields(listing: Listing): Record<string, unknown> {
  const coords =
    listing.lat !== null && listing.lon !== null ? coarsenCoords(listing.lat, listing.lon) : null;
  return {
    category: toBoardCategory(listing.category),
    kind: toBoardKind(listing),
    description: listing.description,
    area_text: listing.areaText,
    coarse_lat: coords ? coords.lat : null,
    coarse_lon: coords ? coords.lon : null,
    crop_key: listing.cropKey,
    qty: listing.qty,
    qty_unit: listing.unit,
    price_zar: listing.price.type === 'zar' ? listing.price.amount : null,
    price_basis: listing.price.type === 'zar' ? listing.price.per : listing.price.type,
    available_month: listing.availableMonth,
    source: listing.source === 'demo' ? 'manual' : listing.source,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Labels
 * ──────────────────────────────────────────────────────────────────────────*/

function zar(n: number): string {
  return `R${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

// A price is quoted per ONE of something, so the basis reads in the singular:
// "R350/day", not "R350/days". Only the units that actually change.
const PRICE_BASIS_SINGULAR: Partial<Record<PriceBasis, string>> = {
  days: 'day',
  bags: 'bag',
  bunches: 'bunch',
  punnets: 'punnet',
  seedlings: 'seedling',
  seeds: 'seed',
  slips: 'slip',
  'seed potatoes': 'seed potato',
};

/** "R6/kg" · "R350/day" · "R240 for the lot" · "Swap — …" · "Free" · "Make an offer". */
export function priceLabel(listing: Pick<Listing, 'price'>): string {
  const p = listing.price;
  switch (p.type) {
    case 'free': return 'Free';
    case 'ask': return 'Make an offer';
    case 'swap': return `Swap — ${p.wants}`;
    case 'zar':
      return p.per === 'lot'
        ? `${zar(p.amount)} for the lot`
        : `${zar(p.amount)}/${PRICE_BASIS_SINGULAR[p.per] ?? p.per}`;
  }
}

/** "12 kg" · "340 seedlings" · "" when unquantified. */
export function quantityLabel(listing: Pick<Listing, 'qty' | 'unit'>): string {
  if (listing.qty === null || listing.unit === null) return '';
  const qty = listing.qty % 1 === 0 ? String(listing.qty) : listing.qty.toFixed(1);
  return `${qty} ${listing.unit}`;
}

/**
 * Comparable unit price in Rand, for sorting. `'lot'` prices are divided by the
 * quantity so a lot and a per-kg price sort against each other sensibly.
 * Returns null for swap / free / ask — those sort last, never as "cheapest".
 */
export function listingUnitPriceZar(listing: Pick<Listing, 'price' | 'qty'>): number | null {
  const p = listing.price;
  if (p.type !== 'zar' || !Number.isFinite(p.amount)) return null;
  if (p.per !== 'lot') return p.amount;
  if (listing.qty === null || listing.qty <= 0) return p.amount;
  return p.amount / listing.qty;
}

/** The crop's display name + icon, or null for tools/labour/off-catalog listings. */
export function listingCrop(listing: Pick<Listing, 'cropKey'>): { name: string; icon: string } | null {
  if (listing.cropKey === null) return null;
  const def = cropByKey(listing.cropKey);
  return def ? { name: def.name, icon: def.icon } : null;
}

/** Every catalog crop actually represented on a board — the filter chips. */
export function listingCropOptions(
  listings: Listing[],
): Array<{ cropKey: string; name: string; icon: string; count: number }> {
  const counts = new Map<string, number>();
  for (const l of listings) {
    if (l.cropKey === null) continue;
    counts.set(l.cropKey, (counts.get(l.cropKey) ?? 0) + 1);
  }
  return CROPS.filter((c) => counts.has(c.key))
    .map((c) => ({ cropKey: c.key, name: c.name, icon: c.icon, count: counts.get(c.key) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ────────────────────────────────────────────────────────────────────────────
 * Distance
 * ──────────────────────────────────────────────────────────────────────────*/

/** Distance from `origin` to a listing, or null when either side has no coordinates. */
export function listingDistanceKm(listing: Listing, origin: LatLon | null): number | null {
  if (!origin || listing.lat === null || listing.lon === null) return null;
  return haversineKm(origin, { lat: listing.lat, lon: listing.lon });
}

export function withDistance(listing: Listing, origin: LatLon | null): ListingWithDistance {
  const km = listingDistanceKm(listing, origin);
  return {
    listing,
    km,
    distanceLabel: km === null ? 'Area unknown' : formatDistanceKm(km),
  };
}

/** Coarse proximity buckets for grouping a board — 0-10 / 10-25 / 25-50 / 50+ km. */
export type DistanceBucket = 'here' | 'near' | 'district' | 'far' | 'unknown';

export function distanceBucket(km: number | null): DistanceBucket {
  if (km === null || !Number.isFinite(km)) return 'unknown';
  if (km <= 10) return 'here';
  if (km <= 25) return 'near';
  if (km <= 50) return 'district';
  return 'far';
}

export const DISTANCE_BUCKET_LABELS: Record<DistanceBucket, string> = {
  here: 'Within 10 km',
  near: '10 – 25 km',
  district: '25 – 50 km',
  far: 'Over 50 km',
  unknown: 'Area unknown',
};

/* ────────────────────────────────────────────────────────────────────────────
 * Filter + sort
 * ──────────────────────────────────────────────────────────────────────────*/

export interface ListingFilter {
  kind?: ListingKind;
  categories?: ListingCategory[];
  cropKeys?: string[];
  /** Case-insensitive match on title, description, crop name, area, farmer name. */
  query?: string;
  /** Keep only listings within `km` of `origin`. Listings WITHOUT coordinates are kept. */
  within?: { origin: LatLon; km: number };
  /** 1-12. Keeps listings available within ±1 month, plus any with no month set. */
  month?: number;
  /** Keep only listings with a cash price at or below this, per unit. */
  maxUnitPriceZar?: number;
  /** Default false — closed listings are hidden. */
  includeClosed?: boolean;
  farmerId?: string;
}

function monthWithinOne(month: number, target: number): boolean {
  const diff = Math.abs(((month - target + 18) % 12) - 6);
  return diff <= 1;
}

function haystack(l: Listing): string {
  const crop = listingCrop(l);
  return [l.title, l.description, l.areaText, l.farmerName, crop ? crop.name : '', l.cropKey ?? '']
    .join(' ')
    .toLowerCase();
}

/**
 * Pure filter. Returns a new array.
 *
 * Two deliberate behaviours worth knowing before you "fix" them:
 *  • A listing with NO coordinates is never removed by a distance filter — it
 *    is bucketed as "area unknown" and sorted last. Every post the shipped
 *    board has ever written lacks coordinates (the UI never passed them), so
 *    hiding them would empty the board on day one.
 *  • A listing with NO month is never removed by a month filter, for the same
 *    reason: absence of data is not evidence of unavailability.
 */
export function filterListings(listings: Listing[], filter: ListingFilter = {}): Listing[] {
  const q = filter.query ? filter.query.trim().toLowerCase() : '';
  return listings.filter((l) => {
    if (filter.includeClosed !== true && l.status !== 'active') return false;
    if (filter.kind && l.kind !== filter.kind) return false;
    if (filter.farmerId && l.farmerId !== filter.farmerId) return false;
    if (filter.categories && filter.categories.length > 0 && !filter.categories.includes(l.category)) {
      return false;
    }
    if (filter.cropKeys && filter.cropKeys.length > 0) {
      if (l.cropKey === null || !filter.cropKeys.includes(l.cropKey)) return false;
    }
    if (q.length > 0 && !haystack(l).includes(q)) return false;
    if (filter.within) {
      const km = listingDistanceKm(l, filter.within.origin);
      if (km !== null && km > filter.within.km) return false;
    }
    if (filter.month !== undefined && l.availableMonth !== null) {
      if (!monthWithinOne(l.availableMonth, filter.month)) return false;
    }
    if (filter.maxUnitPriceZar !== undefined) {
      const unit = listingUnitPriceZar(l);
      if (unit !== null && unit > filter.maxUnitPriceZar) return false;
    }
    return true;
  });
}

export type ListingSort = 'newest' | 'nearest' | 'price_low' | 'price_high' | 'crop' | 'quantity';

/**
 * Pure sort. Returns a new array. Listings with no comparable value (no
 * coordinates, no cash price, no crop) always sort LAST regardless of
 * direction — they must never top a "cheapest" or "nearest" list, and must
 * never silently disappear either.
 */
export function sortListings(
  listings: Listing[],
  sort: ListingSort = 'newest',
  origin: LatLon | null = null,
): Listing[] {
  const value = (l: Listing): number | null => {
    switch (sort) {
      case 'newest': return Date.parse(l.postedAt) || null;
      case 'nearest': return listingDistanceKm(l, origin);
      case 'price_low':
      case 'price_high': return listingUnitPriceZar(l);
      case 'quantity': return l.qty;
      case 'crop': return null;
      default: return null;
    }
  };
  const descending = sort === 'newest' || sort === 'price_high' || sort === 'quantity';

  return [...listings].sort((a, b) => {
    if (sort === 'crop') {
      const an = listingCrop(a)?.name ?? '~';
      const bn = listingCrop(b)?.name ?? '~';
      return an.localeCompare(bn) || a.title.localeCompare(b.title);
    }
    const av = value(a);
    const bv = value(b);
    if (av === null && bv === null) return a.title.localeCompare(b.title);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av === bv) return a.title.localeCompare(b.title);
    return descending ? bv - av : av - bv;
  });
}

/** Filter + sort + attach distances, in one call — what a board screen actually needs. */
export function searchListings(
  listings: Listing[],
  options: { filter?: ListingFilter; sort?: ListingSort; origin?: LatLon | null } = {},
): ListingWithDistance[] {
  const origin = options.origin ?? null;
  const filtered = filterListings(listings, options.filter);
  const sorted = sortListings(filtered, options.sort ?? 'newest', origin);
  return sorted.map((l) => withDistance(l, origin));
}

/**
 * "3 farmers near you have this." Given a WANT, find the active OFFERS that
 * could satisfy it: same crop key when the want names one, otherwise the same
 * category. Never matches a farmer to their own listing.
 */
export function matchOffersForWant(
  want: Pick<Listing, 'id' | 'cropKey' | 'category' | 'farmerId' | 'lat' | 'lon'>,
  listings: Listing[],
  options: { maxKm?: number } = {},
): ListingWithDistance[] {
  const origin: LatLon | null =
    want.lat !== null && want.lon !== null ? { lat: want.lat, lon: want.lon } : null;
  const maxKm = options.maxKm ?? 50;

  const candidates = listings.filter((l) => {
    if (l.id === want.id) return false;
    if (l.kind !== 'offer' || l.status !== 'active') return false;
    if (l.farmerId === want.farmerId) return false;
    if (want.cropKey !== null) return l.cropKey === want.cropKey;
    return l.category === want.category;
  });

  return candidates
    .map((l) => withDistance(l, origin))
    // Unknown-distance offers are kept: they may well be next door.
    .filter((row) => row.km === null || row.km <= maxKm)
    .sort((a, b) => {
      if (a.km === null && b.km === null) return 0;
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km;
    });
}

export interface ExchangeSummary {
  total: number;
  offers: number;
  wants: number;
  byCategory: Record<ListingCategory, number>;
  cropCount: number;
  farmerCount: number;
}

/** Counts for a board header — "24 listings · 9 farmers · 11 crops". */
export function summariseExchange(listings: Listing[]): ExchangeSummary {
  const byCategory = LISTING_CATEGORIES.reduce(
    (acc, c) => ({ ...acc, [c]: 0 }),
    {} as Record<ListingCategory, number>,
  );
  for (const l of listings) byCategory[l.category] += 1;
  return {
    total: listings.length,
    offers: listings.filter((l) => l.kind === 'offer').length,
    wants: listings.filter((l) => l.kind === 'want').length,
    byCategory,
    cropCount: new Set(listings.map((l) => l.cropKey).filter((k): k is string => k !== null)).size,
    farmerCount: new Set(listings.map((l) => l.farmerId)).size,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * DEMO LISTINGS — invented, on real coordinates, referencing DEMO_NETWORK
 * ──────────────────────────────────────────────────────────────────────────*/

interface ListingSeed {
  id: string;
  farmerId: string;
  kind: ListingKind;
  category: ListingCategory;
  cropKey: string | null;
  title: string;
  description: string;
  qty: number | null;
  unit: ListingUnit | null;
  price: ListingPrice;
  availableMonth: number | null;
  daysAgo: number;
  status?: ListingStatus;
  source?: ListingSource;
}

/**
 * Hand-authored so each one reads like something a farmer would actually type.
 * `farmerId` must resolve against {@link DEMO_NETWORK}; tests/network.test.ts
 * fails the build if any does not.
 */
const DEMO_LISTING_SEEDS: ListingSeed[] = [
  {
    id: 'demo-listing-chard-ubhejane',
    farmerId: 'demo-farmer-ubhejane',
    kind: 'offer',
    category: 'produce',
    cropKey: 'swiss-chard',
    title: 'Swiss chard — cutting weekly',
    description: 'Cutting about 12 kg a week off the crèche beds. Bring your own bags.',
    qty: 12,
    unit: 'kg',
    price: { type: 'zar', amount: 6, per: 'kg' },
    availableMonth: 8,
    daysAgo: 3,
    source: 'harvest_surplus',
  },
  {
    id: 'demo-listing-amadumbe-ubhejane',
    farmerId: 'demo-farmer-ubhejane',
    kind: 'offer',
    category: 'seed',
    cropKey: 'amadumbe',
    title: 'Amadumbe planting corms',
    description: 'Corms off last season, kept dry in the shed. Good local variety.',
    qty: 20,
    unit: 'kg',
    price: { type: 'zar', amount: 28, per: 'kg' },
    availableMonth: 9,
    daysAgo: 11,
  },
  {
    id: 'demo-listing-tomato-seedlings-mduku',
    farmerId: 'demo-farmer-mduku',
    kind: 'offer',
    category: 'seedlings',
    cropKey: 'tomatoes',
    title: 'Tomato seedlings ready end of the month',
    description: 'Roma type, hardened off in the tunnel. Trays of 50.',
    qty: 400,
    unit: 'seedlings',
    price: { type: 'zar', amount: 1.6, per: 'each' },
    availableMonth: 9,
    daysAgo: 6,
  },
  {
    id: 'demo-listing-butternut-mduku',
    farmerId: 'demo-farmer-mduku',
    kind: 'offer',
    category: 'produce',
    cropKey: 'butternut',
    title: 'Butternut — bulk, cured',
    description: 'About 180 kg cured and stored. Happy to split into 20 kg bags.',
    qty: 180,
    unit: 'kg',
    price: { type: 'zar', amount: 1300, per: 'lot' },
    availableMonth: 8,
    daysAgo: 9,
    source: 'harvest_surplus',
  },
  {
    id: 'demo-listing-want-beanseed-nongoma',
    farmerId: 'demo-farmer-nongoma',
    kind: 'want',
    category: 'seed',
    cropKey: 'dry-beans',
    title: 'Looking for 2 kg sugar bean seed',
    description: 'Planting after the first good rains. Can collect from Nongoma or Ulundi.',
    qty: 2,
    unit: 'kg',
    price: { type: 'zar', amount: 60, per: 'kg' },
    availableMonth: 10,
    daysAgo: 4,
    source: 'seed_boq',
  },
  {
    id: 'demo-listing-cabbage-mahlabathini',
    farmerId: 'demo-farmer-mahlabathini',
    kind: 'offer',
    category: 'produce',
    cropKey: 'cabbage',
    title: 'Cabbage heads — youth garden',
    description: 'Cutting 90 heads over the next two weeks. Priced to move.',
    qty: 90,
    unit: 'each',
    price: { type: 'zar', amount: 8, per: 'each' },
    availableMonth: 8,
    daysAgo: 2,
  },
  {
    id: 'demo-listing-want-seedlings-mahlabathini',
    farmerId: 'demo-farmer-mahlabathini',
    kind: 'want',
    category: 'seedlings',
    cropKey: 'tomatoes',
    title: 'Want 340 tomato seedlings by September',
    description: 'From our crop plan for the September beds. Will fetch with the bakkie.',
    qty: 340,
    unit: 'seedlings',
    price: { type: 'ask' },
    availableMonth: 9,
    daysAgo: 5,
    source: 'seed_boq',
  },
  {
    id: 'demo-listing-groundnut-pongola',
    farmerId: 'demo-farmer-pongola',
    kind: 'offer',
    category: 'seed',
    cropKey: 'groundnuts',
    title: 'Groundnut seed — swap',
    description: 'Have shelled groundnut seed. Would rather swap than sell.',
    qty: 6,
    unit: 'kg',
    price: { type: 'swap', wants: 'maize seed or pumpkin seed' },
    availableMonth: 10,
    daysAgo: 34,
  },
  {
    id: 'demo-listing-chard-mtubatuba',
    farmerId: 'demo-farmer-mtubatuba',
    kind: 'offer',
    category: 'produce',
    cropKey: 'swiss-chard',
    title: 'Spinach bunches at the station',
    description: 'Bunches ready most mornings. Collect at the station plot.',
    qty: 60,
    unit: 'bunches',
    price: { type: 'zar', amount: 7, per: 'each' },
    availableMonth: 8,
    daysAgo: 1,
  },
  {
    id: 'demo-listing-sweetpotato-slips-mtubatuba',
    farmerId: 'demo-farmer-mtubatuba',
    kind: 'offer',
    category: 'seedlings',
    cropKey: 'sweet-potato',
    title: 'Sweet potato slips',
    description: 'Orange-flesh slips off the mother bed. Cut fresh on the day.',
    qty: 500,
    unit: 'slips',
    price: { type: 'zar', amount: 0.9, per: 'each' },
    availableMonth: 10,
    daysAgo: 8,
  },
  {
    id: 'demo-listing-onion-hlabisa',
    farmerId: 'demo-farmer-hlabisa',
    kind: 'offer',
    category: 'produce',
    cropKey: 'onions',
    title: 'Onions — clinic garden surplus',
    description: 'Cured and netted. More than the clinic kitchen can use.',
    qty: 45,
    unit: 'kg',
    price: { type: 'zar', amount: 11, per: 'kg' },
    availableMonth: 8,
    daysAgo: 13,
    source: 'harvest_surplus',
  },
  {
    id: 'demo-listing-want-compost-nquthu',
    farmerId: 'demo-farmer-nquthu',
    kind: 'want',
    category: 'other',
    cropKey: null,
    title: 'Want kraal manure — a bakkie load',
    description: 'Building new beds on the ridge. Will pay for a load delivered.',
    qty: null,
    unit: null,
    price: { type: 'zar', amount: 450, per: 'lot' },
    availableMonth: null,
    daysAgo: 7,
  },
  {
    id: 'demo-listing-potato-vryheid',
    farmerId: 'demo-farmer-vryheid',
    kind: 'offer',
    category: 'produce',
    cropKey: 'potato',
    title: 'Seed potatoes and eating potatoes',
    description: 'Two grades: certified seed potatoes and table potatoes in 10 kg bags.',
    qty: 320,
    unit: 'kg',
    price: { type: 'zar', amount: 9.5, per: 'kg' },
    availableMonth: 9,
    daysAgo: 5,
  },
  {
    id: 'demo-listing-plough-vryheid',
    farmerId: 'demo-farmer-vryheid',
    kind: 'offer',
    category: 'tools',
    cropKey: null,
    title: 'Two-row planter for hire',
    description: 'Tractor-drawn planter, hire by the day. You supply diesel.',
    qty: null,
    unit: null,
    price: { type: 'zar', amount: 350, per: 'days' },
    availableMonth: null,
    daysAgo: 21,
  },
  {
    id: 'demo-listing-want-maizeseed-msinga',
    farmerId: 'demo-farmer-msinga',
    kind: 'want',
    category: 'seed',
    cropKey: 'maize',
    title: 'Want open-pollinated maize seed',
    description: 'Dryland plot, need something that copes with a late start.',
    qty: 5,
    unit: 'kg',
    price: { type: 'ask' },
    availableMonth: 11,
    daysAgo: 16,
    source: 'seed_boq',
  },
  {
    id: 'demo-listing-carrots-greytown',
    farmerId: 'demo-farmer-greytown',
    kind: 'offer',
    category: 'produce',
    cropKey: 'carrots',
    title: 'Carrots — church garden',
    description: 'Pulling twice a week. Washed, in 5 kg bags.',
    qty: 70,
    unit: 'kg',
    price: { type: 'zar', amount: 8.5, per: 'kg' },
    availableMonth: 8,
    daysAgo: 4,
  },
  {
    id: 'demo-listing-labour-greytown',
    farmerId: 'demo-farmer-greytown',
    kind: 'want',
    category: 'labour',
    cropKey: null,
    title: 'Work-share for bed prep, two days',
    description: 'Four of us needed for two days. We return the favour at your place.',
    qty: 2,
    unit: 'days',
    price: { type: 'swap', wants: 'the same two days back at your plot' },
    availableMonth: 9,
    daysAgo: 6,
  },
  {
    id: 'demo-listing-kale-eshowe',
    farmerId: 'demo-farmer-eshowe',
    kind: 'offer',
    category: 'produce',
    cropKey: 'kale',
    title: 'Kale — small quantity, first cut',
    description: 'First cut off new beds. Only a few kilos a week for now.',
    qty: 4,
    unit: 'kg',
    price: { type: 'zar', amount: 15, per: 'kg' },
    availableMonth: 8,
    daysAgo: 2,
  },
  {
    id: 'demo-listing-want-chardseed-melmoth',
    farmerId: 'demo-farmer-melmoth',
    kind: 'want',
    category: 'seed',
    cropKey: 'swiss-chard',
    title: 'Want spinach seed — starting out',
    description: 'Just started the roadside beds. A packet or two would get me going.',
    qty: 200,
    unit: 'seeds',
    price: { type: 'free' },
    availableMonth: 9,
    daysAgo: 3,
  },
  {
    id: 'demo-listing-oats-bergville',
    farmerId: 'demo-farmer-bergville',
    kind: 'offer',
    category: 'seed',
    cropKey: 'oats',
    title: 'Oats cover-crop seed, spare',
    description: 'Over-ordered for the winter cover. Giving the rest away.',
    qty: 12,
    unit: 'kg',
    price: { type: 'free' },
    availableMonth: 4,
    daysAgo: 27,
    status: 'closed',
  },
  {
    id: 'demo-listing-beetroot-ixopo',
    farmerId: 'demo-farmer-ixopo',
    kind: 'offer',
    category: 'produce',
    cropKey: 'beetroot',
    title: 'Beetroot — mission garden',
    description: 'Small first harvest. Bunches with leaves on.',
    qty: 18,
    unit: 'kg',
    price: { type: 'zar', amount: 12, per: 'kg' },
    availableMonth: 9,
    daysAgo: 5,
  },
  {
    id: 'demo-listing-want-shadecloth-ixopo',
    farmerId: 'demo-farmer-ixopo',
    kind: 'want',
    category: 'tools',
    cropKey: null,
    title: 'Want shade cloth offcuts',
    description: 'Anything over 2 m wide. Building a seedling tunnel.',
    qty: null,
    unit: null,
    price: { type: 'ask' },
    availableMonth: null,
    daysAgo: 12,
  },
];

/** Number of hand-authored seeds — the integrity test asserts none were dropped. */
export const DEMO_LISTING_SEED_COUNT = DEMO_LISTING_SEEDS.length;

function buildDemoListings(now: Date): Listing[] {
  const byId = new Map(DEMO_NETWORK.records.map((r) => [r.farmer.id, r]));

  return DEMO_LISTING_SEEDS.flatMap((seed) => {
    const record = byId.get(seed.farmerId);
    // Unresolvable farmer id = a typo. Drop it rather than shipping a listing
    // attributed to nobody; tests/network.test.ts turns that into a failure.
    if (!record) return [];
    const { farmer } = record;
    // COARSE, always — a listing carries a neighbourhood, never a homestead.
    const coarse = coarsenCoords(farmer.lat, farmer.lon);
    return [
      {
        id: seed.id,
        kind: seed.kind,
        category: seed.category,
        cropKey: seed.cropKey,
        title: seed.title,
        description: seed.description,
        qty: seed.qty,
        unit: seed.unit,
        price: seed.price,
        farmerId: farmer.id,
        farmerName: farmer.name,
        areaText: farmer.district,
        lat: coarse.lat,
        lon: coarse.lon,
        postedAt: new Date(now.getTime() - seed.daysAgo * 86400000).toISOString(),
        status: seed.status ?? 'active',
        availableMonth: seed.availableMonth,
        photoUrl: null,
        source: seed.source ?? 'demo',
        isDemo: true,
      } satisfies Listing,
    ];
  });
}

/** Build the demo board relative to a given "now". Pass a fixed date in tests. */
export function buildDemoExchange(now: Date = new Date()): {
  readonly isDemo: true;
  readonly notice: string;
  readonly listings: Listing[];
} {
  return {
    isDemo: true,
    notice:
      'Sample trade board — invented listings from the sample farmer network. Nothing here is for real sale.',
    listings: buildDemoListings(now),
  };
}

/** THE single entry point to the demo trade board. */
export const DEMO_EXCHANGE = buildDemoExchange();

/** Convenience alias for the listings array inside {@link DEMO_EXCHANGE}. */
export const DEMO_LISTINGS: Listing[] = DEMO_EXCHANGE.listings;
