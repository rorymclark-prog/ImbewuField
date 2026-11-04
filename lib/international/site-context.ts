import { canonicalCoordinateSiteId } from '../site-id';

/**
 * The exact saved-place identity a confirmation describes: place id, the revision it was
 * confirmed against, and the place's creation stamp. A copy of the context on any row that differs
 * in ANY of these (a whole-place edit, a move, a deliberate re-add, a legacy row with another
 * savedAt) describes a place the grower has not confirmed, so it is never approved.
 * Absent on the transient context a form creates; the saved-place store binds it per alias.
 */
export interface SiteContextBase {
  placeId: string;
  revision: number;
  savedAt: string;
}

/** A grower's site description is not a dated local-agronomy or legal review. */
export interface SiteCountryContext {
  version: 1;
  siteId: string;
  countryCode: string;
  jurisdictionReference: string | null;
  agriculturalRegionReference: string | null;
  provenance: 'grower-confirmed';
  confirmedAt: string;
  base?: SiteContextBase;
}

export interface SiteContextPlace {
  id: string;
  lat: number;
  lon: number;
  updatedAt?: number;
  savedAt?: string;
  siteCountryContext?: unknown;
}

/** Place revision as the saved-place store reads it: edit time, else the legacy save time. */
export function placeRevision(place: Pick<SiteContextPlace, 'updatedAt' | 'savedAt'>): number {
  const savedAt = typeof place.savedAt === 'string' ? Date.parse(place.savedAt) : Number.NaN;
  const value = place.updatedAt ?? (Number.isFinite(savedAt) ? savedAt : 0);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

/** The base a context written against `place` right now must carry; null if it cannot be bound. */
export function siteContextBase(place: Pick<SiteContextPlace, 'id' | 'updatedAt' | 'savedAt'>): SiteContextBase | null {
  if (typeof place.id !== 'string' || !place.id || typeof place.savedAt !== 'string') return null;
  return { placeId: place.id, revision: placeRevision(place), savedAt: place.savedAt };
}

/** Bind a transient context to one saved place. Never guesses: null when the place has no identity. */
export function bindSiteContext(context: SiteCountryContext, place: Pick<SiteContextPlace, 'id' | 'updatedAt' | 'savedAt'>): SiteCountryContext | null {
  const base = siteContextBase(place);
  return base ? { ...context, base } : null;
}

/** True only when the context's stored base is exactly this place's identity and its coordinates. */
export function isContextBoundToPlace(context: SiteCountryContext, place: SiteContextPlace): boolean {
  const base = context.base;
  const current = siteContextBase(place);
  return !!base && !!current && context.siteId === coordinateSiteIdForPlace(place)
    && base.placeId === current.placeId && base.revision === current.revision && base.savedAt === current.savedAt;
}

export type SiteContextResolution = {
  siteId: string | null;
  status: 'confirmed' | 'unknown' | 'conflict' | 'missing-site';
  context: SiteCountryContext | null;
  placeIds: string[];
};

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function reference(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length <= 160 && !/[\u0000-\u001f\u007f]/.test(trimmed) ? trimmed || null : undefined;
}

/** Strip unsupported flags rather than letting saved or imported metadata approve itself. */
export function normaliseSiteCountryContext(value: unknown): SiteCountryContext | null {
  if (!record(value) || value.version !== 1 || value.provenance !== 'grower-confirmed'
    || !canonicalCoordinateSiteId(value.siteId)
    || typeof value.countryCode !== 'string' || !/^[A-Z]{2}$/.test(value.countryCode)
    || typeof value.confirmedAt !== 'string') return null;
  const instant = Date.parse(value.confirmedAt);
  if (!Number.isFinite(instant) || new Date(instant).toISOString() !== value.confirmedAt) return null;
  const jurisdictionReference = reference(value.jurisdictionReference);
  const agriculturalRegionReference = reference(value.agriculturalRegionReference);
  if (jurisdictionReference === undefined || agriculturalRegionReference === undefined) return null;
  let base: SiteContextBase | undefined;
  if (value.base !== undefined) {
    const raw = value.base;
    // A damaged binding must not degrade into "unbound but usable".
    if (!record(raw) || typeof raw.placeId !== 'string' || !raw.placeId || typeof raw.savedAt !== 'string'
      || typeof raw.revision !== 'number' || !Number.isFinite(raw.revision) || raw.revision < 0) return null;
    base = { placeId: raw.placeId, revision: raw.revision, savedAt: raw.savedAt };
  }
  return { version: 1, siteId: value.siteId as string, countryCode: value.countryCode, jurisdictionReference, agriculturalRegionReference,
    provenance: 'grower-confirmed', confirmedAt: value.confirmedAt, ...(base ? { base } : {}) };
}

export function createSiteCountryContext(input: {
  siteId: string;
  countryCode: string;
  jurisdictionReference?: string | null;
  agriculturalRegionReference?: string | null;
  confirmed: boolean;
}, confirmedAt = new Date().toISOString()): SiteCountryContext | null {
  if (input.confirmed !== true) return null;
  return normaliseSiteCountryContext({ ...input, countryCode: input.countryCode.trim().toUpperCase(),
    version: 1, provenance: 'grower-confirmed', confirmedAt });
}

export function coordinateSiteIdForPlace(place: Pick<SiteContextPlace, 'lat' | 'lon'>): string | null {
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)
    || place.lat < -90 || place.lat > 90 || place.lon < -180 || place.lon > 180) return null;
  return canonicalCoordinateSiteId(`site:${place.lat.toFixed(5)},${place.lon.toFixed(5)}`);
}

function sameDescription(a: SiteCountryContext, b: SiteCountryContext): boolean {
  return a.countryCode === b.countryCode && a.jurisdictionReference === b.jurisdictionReference
    && a.agriculturalRegionReference === b.agriculturalRegionReference;
}

/** Multiple saved-place aliases can address the same map. Choosing the first one would
 * make a conflicting country depend on array order, so every alias must agree. */
export function resolveSiteCountryContext(places: readonly SiteContextPlace[], siteId: unknown): SiteContextResolution {
  const canonical = canonicalCoordinateSiteId(siteId);
  const aliases = canonical ? places.filter(place => coordinateSiteIdForPlace(place) === canonical) : [];
  const base = { siteId: canonical, placeIds: aliases.map(place => place.id) };
  if (!aliases.length) return { ...base, status: 'missing-site', context: null };
  const contexts = aliases.map(place => {
    // Missing or mismatched binding is never approval: an unbound context is unknown.
    const context = normaliseSiteCountryContext(place.siteCountryContext);
    return context && isContextBoundToPlace(context, place) ? context : null;
  });
  const confirmed = contexts.filter((value): value is SiteCountryContext => value !== null);
  if (!confirmed.length) return { ...base, status: 'unknown', context: null };
  if (confirmed.length !== aliases.length || confirmed.some(value => !sameDescription(value, confirmed[0]))) {
    return { ...base, status: 'conflict', context: null };
  }
  const context = [...confirmed].sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt))[0];
  return { ...base, status: 'confirmed', context };
}

export function sitePlanningSupport(resolution: SiteContextResolution) {
  const allowAutoPlanning = resolution.status === 'confirmed'
    && normaliseSiteCountryContext(resolution.context)?.countryCode === 'ZA'
    && resolution.context?.siteId === resolution.siteId;
  return {
    allowAutoPlanning,
    status: allowAutoPlanning ? 'existing-south-african-planner' as const
      : resolution.status === 'confirmed' ? 'international-reference-only' as const : 'country-needs-confirmation' as const,
    // A self-declared country cannot satisfy the separate source-bound region review.
    localAgronomyApproved: false as const,
    southAfricanFallbackAllowed: allowAutoPlanning,
  };
}
