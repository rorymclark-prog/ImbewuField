import { declaresSampleMode, type ApiAuthResult } from './api-auth';
import { DEMO_COORDS } from './demo-site';
import { resolvePlanningSupport } from './international/planning-policy';
import type { SiteContextPlace } from './international/site-context';
import { canonicalCoordinateSiteId } from './site-id';

export type ReportPlacesReader = (verifiedUid: string) => Promise<unknown>;
export type ReportCountryDecision =
  | { allowed: true; mode: 'confirmed-south-african-site' | 'demo-south-african-reference'; siteId: string; fingerprint: string }
  | { allowed: false; status: 422 | 503; code: 'REPORT_SITE_MISMATCH' | 'REPORT_COUNTRY_UNAVAILABLE' | 'REPORT_COUNTRY_SOURCE_UNAVAILABLE'; error: string };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function requestSiteId(location: unknown): string | null {
  if (!record(location) || typeof location.lat !== 'number' || !Number.isFinite(location.lat)
    || typeof location.lon !== 'number' || !Number.isFinite(location.lon)) return null;
  return canonicalCoordinateSiteId(`site:${location.lat.toFixed(5)},${location.lon.toFixed(5)}`);
}

/** Only this verified caller's existing saved-site document is read. No client
 * owner ID, country flag, workspace exception or review claim selects a path. */
async function readOwnSavedPlaces(verifiedUid: string): Promise<unknown> {
  const { getApps, getApp, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(getApps().length ? getApp() : initializeApp());
  const snapshot = await db.collection('user_map_data').doc(verifiedUid).collection('data').doc('places').get();
  return snapshot.exists ? snapshot.data()?.places ?? [] : [];
}

/** Unsupported reports stop before allowance/model setup or external geocoding.
 * Normalisation must not erase a conflicting raw snapshot identity first. */
export async function resolveReportCountryPolicy(
  req: Request, auth: Pick<ApiAuthResult, 'uid' | 'guest'>, location: unknown, rawFacts: unknown,
  readPlaces: ReportPlacesReader = readOwnSavedPlaces,
): Promise<ReportCountryDecision> {
  const siteId = requestSiteId(location);
  const rawCrop = record(rawFacts) && record(rawFacts.crop) ? rawFacts.crop : null;
  const snapshot = rawCrop?.snapshot;
  if (!siteId || (snapshot !== undefined && snapshot !== null
    && (!record(snapshot) || canonicalCoordinateSiteId(snapshot.siteId) !== siteId))) {
    return { allowed: false, status: 422, code: 'REPORT_SITE_MISMATCH',
      error: 'The report location and saved crop-plan site do not match. Reopen the intended saved site.' };
  }

  // This is the already admitted, fixed public demo, not a country-selection
  // bypass for arbitrary farms. The route replaces all model inputs with its
  // server-owned curated profile and labels the returned document accordingly.
  const demoSite = canonicalCoordinateSiteId(`site:${DEMO_COORDS.lat.toFixed(5)},${DEMO_COORDS.lon.toFixed(5)}`);
  if (!auth.uid && auth.guest === true && declaresSampleMode(req) && siteId === demoSite) {
    return { allowed: true, mode: 'demo-south-african-reference', siteId, fingerprint: `demo-south-african-reference:${siteId}` };
  }
  if (!auth.uid || auth.uid.includes('/') || auth.uid.length > 128) {
    return { allowed: false, status: 422, code: 'REPORT_COUNTRY_UNAVAILABLE',
      error: 'A supported saved-site country context is required before generating local farming advice.' };
  }

  let places: unknown;
  try { places = await readPlaces(auth.uid); } catch {
    return { allowed: false, status: 503, code: 'REPORT_COUNTRY_SOURCE_UNAVAILABLE',
      error: 'Saved-site country details could not be checked. No report was generated; try again after account updates reconnect.' };
  }
  if (!Array.isArray(places)) {
    return { allowed: false, status: 503, code: 'REPORT_COUNTRY_SOURCE_UNAVAILABLE',
      error: 'Saved-site country details are unavailable. No report was generated.' };
  }
  const safePlaces = places.filter((place): place is SiteContextPlace => record(place)
    && typeof place.id === 'string' && typeof place.lat === 'number' && typeof place.lon === 'number');
  const support = resolvePlanningSupport({ places: safePlaces, siteId });
  if (!support.allowCataloguePlanning || support.mode !== 'south-african-site') {
    return { allowed: false, status: 422, code: 'REPORT_COUNTRY_UNAVAILABLE',
      error: 'Local farming reports are not yet available for this site’s country or saved-site context. Review its country details and account save status in the crop planner.' };
  }
  return { allowed: true, mode: 'confirmed-south-african-site', siteId, fingerprint: support.fingerprint };
}
