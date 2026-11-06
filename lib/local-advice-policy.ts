import { createHash } from 'node:crypto';
import type { ApiAuthResult } from './api-auth';
import { readOwnSavedPlaces, resolveReportCountryPolicy, type ReportPlacesReader } from './report-country-policy';
import { canonicalCoordinateSiteId } from './site-id';
import { LOCAL_ADVICE_CODES, type LocalAdviceCode, type LocalAdviceDecision, type LocalAdvicePolicyInput } from './local-advice-types';

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function held(status: 400 | 409 | 422 | 503, code: LocalAdviceCode, error: string): LocalAdviceDecision {
  return { allowed: false, status, code, error };
}

function fingerprint(parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/** Reuse the account-owned report country authority without admitting its distinct
 * Ezakheni reference. Public sample chat and fixed reference routes keep their own
 * supported paths; a guest declaration grants no local advice about uploaded inputs. */
export async function resolveLocalAdvicePolicy(
  req: Request,
  auth: Pick<ApiAuthResult, 'uid' | 'guest'>,
  input: LocalAdvicePolicyInput,
  readPlaces: ReportPlacesReader = readOwnSavedPlaces,
): Promise<LocalAdviceDecision> {
  const context = input.adviceContext;
  if (!record(context) || (context.mode !== 'general-help' && context.mode !== 'personal-site')) {
    return held(400, LOCAL_ADVICE_CODES.invalidContext, 'Choose general app help or reopen the intended saved site before asking for local advice.');
  }

  if (context.mode === 'general-help') {
    if (Object.keys(context).some(key => key !== 'mode')) {
      return held(400, LOCAL_ADVICE_CODES.invalidContext, 'General app help cannot include saved-site approval or other advice context.');
    }
    if (input.hasSiteInputs !== false || (input.location !== undefined && input.location !== null)) {
      return held(422, LOCAL_ADVICE_CODES.personalContextNotAllowed, 'General app help cannot assess a farm, photo, drawing or personal records. Reopen a supported saved site for local advice.');
    }
    // This binds the guard's existing admission, not a fresh account/token check.
    return { allowed: true, mode: 'general-help',
      fingerprint: fingerprint(['local-advice-v1', 'general-help', auth.uid, auth.guest === true]) };
  }

  if (Object.keys(context).some(key => !['mode', 'siteId', 'countryFingerprint'].includes(key))
    || !canonicalCoordinateSiteId(context.siteId)
    || typeof context.countryFingerprint !== 'string' || !context.countryFingerprint
    || context.countryFingerprint.trim() !== context.countryFingerprint
    || /[\u0000-\u001f\u007f]/.test(context.countryFingerprint)) {
    return held(400, LOCAL_ADVICE_CODES.invalidContext, 'The saved-site identity and country details must be checked before asking for local advice.');
  }
  const location = input.location;
  if (!record(location) || typeof location.lat !== 'number' || !Number.isFinite(location.lat)
    || typeof location.lon !== 'number' || !Number.isFinite(location.lon)
    || canonicalCoordinateSiteId(`site:${location.lat.toFixed(5)},${location.lon.toFixed(5)}`) !== context.siteId) {
    return held(422, LOCAL_ADVICE_CODES.siteMismatch, 'The advice location and intended saved site do not match. Reopen the intended saved site.');
  }
  if (!auth.uid) {
    return held(422, LOCAL_ADVICE_CODES.countryUnavailable, 'Local advice needs supported country details saved to your own signed-in account. General app help is still available.');
  }

  // Only the verified uid reaches the existing reader. Organisation membership,
  // client owner fields and a sample header cannot select another account's farm.
  const country = await resolveReportCountryPolicy(req, { uid: auth.uid }, location, null, readPlaces);
  if (!country.allowed) {
    if (country.status === 503) {
      return held(503, LOCAL_ADVICE_CODES.countrySourceUnavailable, 'Saved-site country details could not be checked. Try again after account updates reconnect; general app help is still available.');
    }
    return held(422, LOCAL_ADVICE_CODES.countryUnavailable, 'Local advice is unavailable for this saved site’s country details. Review the site in the crop planner; general app help is still available.');
  }
  if (country.mode !== 'confirmed-south-african-site' || country.fingerprint !== context.countryFingerprint) {
    return held(409, LOCAL_ADVICE_CODES.contextChanged, 'The saved-site country details changed. Review the intended saved site before asking again.');
  }
  return { allowed: true, mode: 'personal-site', siteId: country.siteId, countryFingerprint: country.fingerprint,
    fingerprint: fingerprint(['local-advice-v1', 'personal-site', auth.uid, country.siteId,
      location.lat, location.lon, country.fingerprint]) };
}

/** Callers re-run the actual reader before allowance, model start and delivery.
 * Comparing decisions cannot recheck storage or revoke previously delivered text. */
export function localAdviceDecisionCurrent(original: LocalAdviceDecision, fresh: LocalAdviceDecision): boolean {
  return original.allowed && fresh.allowed && original.mode === fresh.mode && original.fingerprint === fresh.fingerprint;
}
