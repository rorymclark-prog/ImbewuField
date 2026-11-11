import { MAX_TOUR_STOPS, type UpdateTourStop } from './release-notes-types';

export const UPDATE_GUIDE_KEY = 'imbewu-update-guide-v1';
export const OPEN_UPDATE_GUIDE_EVENT = 'imbewu-open-update-guide';

export interface UpdateGuideState {
  sha: string | null;
  stops: UpdateTourStop[];
  phase: 'offer' | 'tour';
  index: number;
}

/** A route from the new build is only useful if it stays inside this app. */
export function cleanUpdateTour(value: unknown): UpdateTourStop[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TOUR_STOPS).filter((stop): stop is UpdateTourStop =>
    !!stop && typeof stop === 'object'
    && typeof stop.title === 'string' && stop.title.trim().length > 0
    && typeof stop.where === 'string' && stop.where.trim().length > 0
    && typeof stop.detail === 'string' && stop.detail.trim().length > 0
    && typeof stop.href === 'string'
    // These guide steps open existing panels. Admit their exact destinations,
    // without opening the stored guide to arbitrary query strings or redirects.
    && (stop.href === '/farmer?panel=Ask' || stop.href === '/records?tab=sold'
      || /^\/[a-zA-Z0-9/_-]*(?:#[a-zA-Z0-9_-]+)?$/.exec(stop.href)?.[0] === stop.href)
    && !stop.href.includes('//'),
  );
}

/** Ask and Sold share a page with other panels; pathname alone is not arrival. */
export function isUpdateGuideDestination(pathname: string, search: string, href: string): boolean {
  const destination = href.split('#')[0];
  return destination.includes('?')
    ? pathname + (search ? '?' + search : '') === destination
    : pathname === destination;
}

export function readUpdateGuide(raw: string | null, loadedSha: string | null): UpdateGuideState | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const guide = value as Record<string, unknown>;
    const sha = typeof guide.sha === 'string' ? guide.sha : null;
    // A stale HTML response must not announce the new pages as though they have arrived.
    if (sha && sha !== loadedSha) return null;
    const stops = cleanUpdateTour(guide.stops);
    if (!stops.length) return null;
    const phase = guide.phase === 'tour' ? 'tour' : 'offer';
    const index = Number.isInteger(guide.index) && Number(guide.index) >= 0
      && Number(guide.index) < stops.length ? Number(guide.index) : 0;
    return { sha, stops, phase, index };
  } catch {
    return null;
  }
}
