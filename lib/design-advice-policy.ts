import type { ApiAuthResult } from './api-auth';
import { buildDemoDesignCanvasState } from './demo-farm';
import { canonicalCoordinateSiteId } from './site-id';
import { readOwnSavedPlaces, resolveReportCountryPolicy, type ReportPlacesReader } from './report-country-policy';
import { DESIGN_ADVICE_DEMO_SITE, buildDesignAdviceSummary, designAdviceSourceFingerprint, inspectDesignAdviceSource, isDesignAdviceStep } from './design-advice-source';

export type AdviceCanvasReader = (verifiedUid: string) => Promise<unknown>;
export interface DesignAdviceReaders { places?: ReportPlacesReader; canvas?: AdviceCanvasReader }
export type DesignAdviceDecision =
  | { allowed: true; mode: 'personal-site' | 'original-demo-reference'; siteId: string; sourceFingerprint: string;
      countryFingerprint: string; fingerprint: string; summary: ReturnType<typeof buildDesignAdviceSummary> }
  | { allowed: false; status: 400 | 409 | 422 | 503; code: string; error: string };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
async function readOwnCanvas(verifiedUid: string): Promise<unknown> {
  const { getApps, getApp, initializeApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore(getApps().length ? getApp() : initializeApp());
  const snapshot = await db.collection('user_map_data').doc(verifiedUid).collection('data').doc('design_canvas').get();
  return snapshot.exists ? snapshot.data()?.designCanvasJson : null;
}
const held = (status: 400 | 409 | 422 | 503, code: string, error: string): DesignAdviceDecision => ({ allowed: false, status, code, error });

/** Account-owned saved places are the existing country authority. A declaration
 * of sample mode buys only the original public reference, never analysis of a
 * caller's edited or personal geometry. Country confirmation is not agronomy review. */
export async function resolveDesignAdvicePolicy(
  req: Request, auth: Pick<ApiAuthResult, 'uid' | 'guest'>, body: unknown, readers: DesignAdviceReaders = {},
): Promise<DesignAdviceDecision> {
  if (!record(body) || !isDesignAdviceStep(body.currentStep)
    || !canonicalCoordinateSiteId(body.siteId)) return held(400, 'ADVICE_INVALID_SOURCE', 'Reopen the intended design before asking for advice.');
  const siteId = body.siteId as string, step = body.currentStep;
  if (body.mode === 'original-demo-reference') {
    if ((!auth.uid && auth.guest !== true) || siteId !== DESIGN_ADVICE_DEMO_SITE) {
      return held(422, 'ADVICE_REFERENCE_UNAVAILABLE', 'The original sample layout is unavailable for this request.');
    }
    const raw = buildDemoDesignCanvasState(), source = inspectDesignAdviceSource(raw, siteId);
    const sourceFingerprint = await designAdviceSourceFingerprint(raw, siteId);
    if (source.status !== 'ready' || !sourceFingerprint) return held(503, 'ADVICE_SOURCE_UNAVAILABLE', 'The original sample layout could not be checked.');
    const countryFingerprint = `original-demo-reference:${siteId}`;
    return { allowed: true, mode: 'original-demo-reference', siteId, sourceFingerprint, countryFingerprint,
      fingerprint: JSON.stringify(['original-demo-reference', siteId, sourceFingerprint, step]),
      summary: buildDesignAdviceSummary(source.geometry, step) };
  }
  if (body.mode !== 'personal-site' || !auth.uid || auth.uid.includes('/') || auth.uid.length > 128) {
    return held(422, 'ADVICE_COUNTRY_UNAVAILABLE', 'Save this site’s country details to your account before asking for local design advice.');
  }
  if (typeof body.sourceFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(body.sourceFingerprint)
    || typeof body.countryFingerprint !== 'string' || !body.countryFingerprint) {
    return held(400, 'ADVICE_INVALID_SOURCE', 'The current design and country details must be checked before asking for advice.');
  }
  // The selected coordinate ID is the saved-place identity. Boundary-centred
  // frames may legitimately be offset from that pin; inventing a distance cutoff
  // would reject existing measured layouts without providing geography proof.
  const coordinates = siteId.slice(5).split(',').map(Number);
  const country = await resolveReportCountryPolicy(req, auth, { lat: coordinates[0], lon: coordinates[1] }, null, readers.places ?? readOwnSavedPlaces);
  if (!country.allowed) return held(country.status, country.status === 503 ? 'ADVICE_COUNTRY_SOURCE_UNAVAILABLE' : 'ADVICE_COUNTRY_UNAVAILABLE',
    country.status === 503 ? 'Saved-site country details could not be checked. Try again after account updates reconnect.'
      : 'Local design advice is unavailable for this site’s country details. Review the saved site in the crop planner.');
  if (country.mode !== 'confirmed-south-african-site' || country.fingerprint !== body.countryFingerprint) {
    return held(409, 'ADVICE_CONTEXT_CHANGED', 'The saved-site country details changed. Review this site before asking again.');
  }
  let store: unknown;
  try {
    const json = await (readers.canvas ?? readOwnCanvas)(auth.uid);
    if (typeof json !== 'string') return held(422, 'ADVICE_SOURCE_NOT_SYNCED', 'Save this design to your account before asking for local advice.');
    store = JSON.parse(json);
  } catch { return held(503, 'ADVICE_SOURCE_UNAVAILABLE', 'The saved design could not be checked. Try again after account updates reconnect.'); }
  if (!record(store) || !Object.hasOwn(store, siteId)) return held(422, 'ADVICE_SOURCE_NOT_SYNCED', 'This design has not reached your account yet. Keep your drawing open and try again after it saves.');
  const raw = store[siteId], source = inspectDesignAdviceSource(raw, siteId);
  const sourceFingerprint = source.status === 'ready' ? await designAdviceSourceFingerprint(raw, siteId) : null;
  if (source.status !== 'ready' || !sourceFingerprint) return held(422, 'ADVICE_SOURCE_INVALID', 'The saved design could not be checked. Reopen the intended saved design.');
  if (sourceFingerprint !== body.sourceFingerprint) return held(409, 'ADVICE_SOURCE_CHANGED', 'This drawing and the saved account design differ. Wait for your latest changes to save before asking again.');
  return { allowed: true, mode: 'personal-site', siteId, sourceFingerprint, countryFingerprint: country.fingerprint,
    fingerprint: JSON.stringify([auth.uid, siteId, sourceFingerprint, country.fingerprint, step]),
    summary: buildDesignAdviceSummary(source.geometry, step) };
}
