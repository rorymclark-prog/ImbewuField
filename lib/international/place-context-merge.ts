import {
  coordinateSiteIdForPlace, isContextBoundToPlace, normaliseSiteCountryContext, placeRevision,
  type SiteCountryContext,
} from './site-context';

export { placeRevision };

/**
 * The ONE rule for how a grower's site country description merges between saved-place rows.
 *
 * Why this exists: confirming a country used to stamp the whole place with a fresh `updatedAt`.
 * Every later merge (offline reconcile, live snapshot, shared import, transaction) then treated
 * that metadata edit as a deliberate re-add and chose it over a deletion tombstone made on another
 * device, or over a newer remote move / notes edit. A country description is not a request to
 * recreate or overwrite a site, so it never carries a place revision of its own.
 *
 * Each stored context instead carries the exact base it describes (place id, revision, savedAt —
 * see SiteContextBase). The rule, applied only AFTER the existing place-revision/tombstone
 * authority (mergeItems) has chosen which rows survive:
 *   1. a context attaches to a surviving row only if its base is EXACTLY that row's identity
 *      (so a copy carried into a whole-place edit, a move, a re-add or a different legacy row is
 *      dropped — including the surviving row's own copied context);
 *   2. it must still match that row's canonical coordinate site;
 *   3. among several valid contexts for one surviving row, the later `confirmedAt` wins and an
 *      exact tie is broken by the description text, so two devices always converge.
 * It can neither recreate a deleted row nor change a timestamp nor clear a tombstone. Because
 * binding uses savedAt as well as the revision, legacy rows without `updatedAt` are told apart by
 * their creation stamp rather than all comparing as revision zero.
 */
export interface ContextBearingPlace {
  id: string;
  lat: number;
  lon: number;
  updatedAt?: number;
  savedAt?: string;
  siteCountryContext?: unknown;
}

/** The place's own context, or null if it is malformed, unbound or bound to a different place. */
export function boundSiteContext(place: ContextBearingPlace): SiteCountryContext | null {
  const context = normaliseSiteCountryContext(place.siteCountryContext);
  return context && isContextBoundToPlace(context, place) ? context : null;
}

const description = (c: SiteCountryContext) =>
  `${c.countryCode}\u0000${c.jurisdictionReference ?? ''}\u0000${c.agriculturalRegionReference ?? ''}`;

/** Same confirmation (time, description and base). */
export function sameSiteContext(a: SiteCountryContext, b: SiteCountryContext): boolean {
  return a.confirmedAt === b.confirmedAt && description(a) === description(b)
    && JSON.stringify(a.base) === JSON.stringify(b.base);
}

/** Positive when `a` wins. Total order, so the outcome never depends on argument order. */
export function compareSiteContexts(a: SiteCountryContext, b: SiteCountryContext): number {
  if (a.confirmedAt !== b.confirmedAt) return a.confirmedAt > b.confirmedAt ? 1 : -1;
  const da = description(a); const db = description(b);
  return da === db ? 0 : da > db ? 1 : -1;
}

export function pickSiteContext(a: SiteCountryContext | null, b: SiteCountryContext | null): SiteCountryContext | null {
  if (!a || !b) return a ?? b;
  return compareSiteContexts(a, b) >= 0 ? a : b;
}

/** Drop a context that does not describe this exact place. Geometry is never touched. */
export function withoutStaleSiteContext<T extends ContextBearingPlace>(place: T): T {
  if (place.siteCountryContext === undefined || boundSiteContext(place)) return place;
  const { siteCountryContext: _stale, ...rest } = place;
  return rest as T;
}

/**
 * Re-attach the winning context to each SURVIVING place. `survivors` must already have been
 * chosen by the place-revision/tombstone authority; `sources` are every row that fed that choice.
 */
export function mergePlaceContexts<T extends ContextBearingPlace>(
  survivors: readonly T[],
  sources: ReadonlyArray<readonly T[]>,
): T[] {
  return survivors.map(item => {
    const own = boundSiteContext(item);
    let best = own;
    for (const source of sources) {
      for (const row of source) {
        if (row.id !== item.id) continue;
        const candidate = normaliseSiteCountryContext(row.siteCountryContext);
        // Validate against the SURVIVOR, not the row that carried it.
        if (candidate && isContextBoundToPlace(candidate, item)) best = pickSiteContext(best, candidate);
      }
    }
    if (!best) return withoutStaleSiteContext(item);
    if (own && sameSiteContext(own, best)
      && JSON.stringify(item.siteCountryContext) === JSON.stringify(own)) return item;
    return { ...item, siteCountryContext: best };
  });
}
