import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { readPowerTemperatureEvidence, type PowerTemperatureSnapshot } from '../power-temperature-evidence';
import type { PowerMonthlyTemperatureReceipt } from '../climate-temperature';
import { detachJsonData } from '../lossless-json';
import { canonicalCoordinateSiteId, coordinateSiteIdParts } from '../site-id';
import { locationDataCacheKey } from '../location-cache-key';
import { growerPlanningScopeKey, isGrowerUtcDate } from './grower-planning';
import type { ProvisionalEvidenceContext } from './provisional-crop-planning';
import type { PlanningSupport } from './planning-policy';

/** Independently worded numerical fact/method, not a redistribution licence for
 * the Ministry's document. The source explicitly compares this daily optimum
 * with project-area long-term monthly means (PDF41–42, printed19–20). */
export const TOMATO_MONTHLY_CRITERION = Object.freeze({
  id: 'et-moa-ssigl8-tomato-monthly-v1', cropKey: 'tomatoes', lowerC: 18, upperC: 25,
  source: 'Ethiopia Ministry of Agriculture, SSIGL 8: Irrigation Agronomy and Agricultural Development Plan',
  url: 'https://www.moa.gov.et/wp-content/uploads/2024/11/201811_SSIGL-8-Irrigation-Agronomy-and-Agricultural-Development-Plan-compressed-1.pdf',
  publishedMonth: '2018-11', accessedOn: '2026-11-13', locator: 'Section 4.4.2, printed 19–20 / PDF 41–42',
  originalSha256: '483a3443d6c63c1ba137f790890ea058337699574fa87141c8219c3db5f312f0',
  reuse: '© MOA 2018. Document licence not established. Reviewed limited factual extraction only: independently worded numerical criterion and comparison method with citation; no source prose, images, logos or document redistribution.',
  basis: 'Historical Ethiopian small-scale irrigation planning methodology, explicitly selected for transfer to this field-cropping context. Current local applicability, cultivar and whole-season suitability are unverified.',
  convention: 'Compare unrounded Celsius values with both reported endpoints included; these are not exact physiological failure thresholds.',
  limits: 'One month’s coarse historical air-temperature mean versus a reported optimum. Not a planting window, frost-safety test, whole-season assessment, nursery/soil threshold, crop-failure prediction, yield or water-demand estimate.',
});
export const POWER_TEMPERATURE_ATTRIBUTION = 'NASA Langley Research Center POWER Project, funded through NASA Earth Science Division; Climatology API. Model/grid values, not farm measurements. Service version and receipt date accompany the record. No endorsement.';
export const POWER_TEMPERATURE_REUSE = 'NASA public-information copying statement, subject to contrary markings; credit retained. https://www.nasa.gov/organizations/disclaimer/ ; https://power.larc.nasa.gov/docs/referencing/ . Publication/redistribution notification is requested; no notification has been sent by this app.';
type Point = { readonly latitude: number; readonly longitude: number };
export interface ProvisionalTemperatureEvidence {
  readonly version: 1;
  readonly scopeKey: string;
  readonly countryCode: string;
  readonly sitePoint: Point;
  readonly receipt: PowerMonthlyTemperatureReceipt;
  readonly snapshot: PowerTemperatureSnapshot;
}
export interface ProvisionalTemperatureInput {
  readonly version: 1;
  readonly criterion: typeof TOMATO_MONTHLY_CRITERION.id;
  readonly criterionSnapshot: typeof TOMATO_MONTHLY_CRITERION;
  readonly purpose: 'irrigated-field-cropping';
  readonly transfer: 'explicit-historical-methodology';
  readonly policyFingerprint: string;
  readonly evidence: ProvisionalTemperatureEvidence | null;
}
export interface ProvisionalTemperatureAssessment {
  readonly version: 1;
  readonly algorithm: 'selected-month-optimum-comparison-v1';
  readonly state: 'within-reported-optimum' | 'outside-reported-optimum' | 'unknown';
  readonly reason: string | null;
  readonly month: number | null;
  readonly valueC: number | null;
  readonly evidenceKey: string | null;
  readonly evidence: ProvisionalTemperatureEvidence | null;
  readonly criterion: typeof TOMATO_MONTHLY_CRITERION;
}
const hash = (value: string) => bytesToHex(sha256(new TextEncoder().encode(value)));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const pointSiteId = (point: Point) => Number.isFinite(point?.latitude) && Number.isFinite(point?.longitude)
  ? canonicalCoordinateSiteId(`site:${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`) : null;

export function browserTemperatureStorage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

export function normaliseProvisionalTemperatureEvidence(value: unknown,
  context: Pick<ProvisionalEvidenceContext, 'scope' | 'countryCode'>): ProvisionalTemperatureEvidence | null {
  try {
    const row = detachJsonData(value);
    if (!record(row) || Object.keys(row).sort().join(',') !== 'countryCode,receipt,scopeKey,sitePoint,snapshot,version'
      || row.version !== 1 || context.scope.kind !== 'mapped-site' || !context.countryCode
      || row.countryCode !== context.countryCode || row.scopeKey !== growerPlanningScopeKey(context.scope)
      || !record(row.sitePoint) || Object.keys(row.sitePoint).sort().join(',') !== 'latitude,longitude'
      || typeof row.sitePoint.latitude !== 'number' || typeof row.sitePoint.longitude !== 'number'
      || pointSiteId(row.sitePoint as unknown as Point) !== context.scope.siteId) return null;
    const sitePoint = { latitude: row.sitePoint.latitude, longitude: row.sitePoint.longitude };
    const decoded = readPowerTemperatureEvidence(row.receipt, row.snapshot, sitePoint);
    return decoded ? Object.freeze({ version: 1, scopeKey: row.scopeKey as string, countryCode: context.countryCode,
      sitePoint: Object.freeze(sitePoint), ...decoded }) : null;
  } catch { return null; }
}

export function provisionalTemperatureEvidenceKey(evidence: ProvisionalTemperatureEvidence): string {
  return hash(JSON.stringify(evidence));
}

/** No SA classifier or fallback values enter this cache read. The actual cache
 * bytes remain a freshness token for retained save/export callbacks. */
export function captureProvisionalTemperatureCache(storage: Pick<Storage, 'getItem'> | null,
  point: Point | null, context: Pick<ProvisionalEvidenceContext, 'scope' | 'countryCode'>) {
  let raw: string | null = null;
  const key = point && pointSiteId(point) ? locationDataCacheKey(point.latitude, point.longitude) : null;
  try { raw = key && storage ? storage.getItem(key) : null; } catch { /* unavailable stays unknown */ }
  const current = () => {
    try { return !key || !storage ? raw === null : storage.getItem(key) === raw; } catch { return false; }
  };
  let evidence: ProvisionalTemperatureEvidence | null = null;
  try {
    const data = raw && raw.length <= 1048576 ? JSON.parse(raw) : null;
    if (record(data) && record(data.climate) && point && data.lat === Number(point.latitude.toFixed(6)) && data.lon === Number(point.longitude.toFixed(6))) {
      evidence = normaliseProvisionalTemperatureEvidence({ version: 1, scopeKey: growerPlanningScopeKey(context.scope),
        countryCode: context.countryCode, sitePoint: { latitude: data.lat, longitude: data.lon }, receipt: data.climate.monthlyTempReference,
        snapshot: data.climate.monthlyTempSnapshot }, context);
    }
  } catch { /* malformed/legacy cache is not converted into source evidence */ }
  return { evidence, isCurrent: current };
}

/** Live workflow conditions bind the current retained source, independently of
 * the geometry source. Historical cycle snapshots retain their original key. */
export function currentTemperatureEvidenceKey(support: PlanningSupport): string | null {
  if (typeof window === 'undefined' || support.siteCountry.status !== 'confirmed' || !support.siteCountry.context) return null;
  try {
    const site = support.siteCountry.context, point = coordinateSiteIdParts(site.siteId);
    if (!point) return null;
    const raw = localStorage.getItem(locationDataCacheKey(point.lat, point.lon));
    const data = raw && raw.length <= 1048576 ? JSON.parse(raw) : null;
    if (!record(data) || !record(data.climate) || typeof data.lat !== 'number' || typeof data.lon !== 'number') return null;
    const evidence = normaliseProvisionalTemperatureEvidence({ version: 1, scopeKey: `mapped-site:${site.siteId}`,
      countryCode: site.countryCode, sitePoint: { latitude: data.lat, longitude: data.lon },
      receipt: data.climate.monthlyTempReference, snapshot: data.climate.monthlyTempSnapshot },
    { scope: { kind: 'mapped-site', siteId: site.siteId }, countryCode: site.countryCode });
    return evidence ? provisionalTemperatureEvidenceKey(evidence) : null;
  } catch { return null; }
}

export function assessProvisionalTemperature(input: unknown, context: ProvisionalEvidenceContext,
  cropKey: string, fieldEntryDate: string | null, recordedAt: string, asOf: string): ProvisionalTemperatureAssessment {
  const month = fieldEntryDate && isGrowerUtcDate(fieldEntryDate) ? Number(fieldEntryDate.slice(5, 7)) : null;
  const base = { version: 1 as const, algorithm: 'selected-month-optimum-comparison-v1' as const,
    month, valueC: null, evidenceKey: null, evidence: null, criterion: TOMATO_MONTHLY_CRITERION };
  const unknown = (reason: string): ProvisionalTemperatureAssessment => Object.freeze({ ...base, state: 'unknown', reason });
  try {
    const row = detachJsonData(input);
    if (!record(row) || Object.keys(row).sort().join(',') !== 'criterion,criterionSnapshot,evidence,policyFingerprint,purpose,transfer,version'
      || row.version !== 1 || row.criterion !== TOMATO_MONTHLY_CRITERION.id || row.purpose !== 'irrigated-field-cropping'
      || JSON.stringify(row.criterionSnapshot) !== JSON.stringify(TOMATO_MONTHLY_CRITERION)
      || row.transfer !== 'explicit-historical-methodology' || typeof row.policyFingerprint !== 'string'
      || !row.policyFingerprint.length || row.policyFingerprint.length > 262144) return unknown('comparison-declaration-invalid');
    if (cropKey !== 'tomatoes') return unknown('criterion-not-for-this-crop');
    if (context.waterRegime !== 'irrigated') return unknown('irrigated-field-context-required');
    const evidence = normaliseProvisionalTemperatureEvidence(row.evidence, context);
    if (!evidence) return unknown('source-climate-evidence-unavailable-or-mismatched');
    const retained = { ...base, evidence, evidenceKey: provisionalTemperatureEvidenceKey(evidence) };
    if (evidence.receipt.receivedAt > recordedAt || evidence.receipt.period.end > asOf.slice(0, 7))
      return Object.freeze({ ...retained, state: 'unknown', reason: 'climate-period-or-receipt-is-in-the-future' });
    if (asOf < TOMATO_MONTHLY_CRITERION.accessedOn) return Object.freeze({ ...retained, state: 'unknown', reason: 'criterion-not-reviewed-at-this-date' });
    if (!month) return Object.freeze({ ...retained, state: 'unknown', reason: 'field-entry-month-not-entered' });
    const valueC = evidence.receipt.monthlyC[month - 1];
    if (valueC === null) return Object.freeze({ ...retained, state: 'unknown', reason: 'target-month-temperature-missing' });
    return Object.freeze({ ...retained, valueC,
      state: valueC >= TOMATO_MONTHLY_CRITERION.lowerC && valueC <= TOMATO_MONTHLY_CRITERION.upperC
        ? 'within-reported-optimum' : 'outside-reported-optimum', reason: null });
  } catch { return unknown('comparison-declaration-invalid'); }
}

/** Common human lines keep the live screen, saved readback and file in agreement.
 * The raw response and private policy/account handles never enter the document. */
export function provisionalTemperatureLines(value: ProvisionalTemperatureAssessment): readonly string[] {
  const { criterion, evidence } = value;
  return [
    `Temperature comparison: ${value.state}. ${value.reason ?? ''}`.trim(),
    `Selected UTC month: ${value.month ?? 'Unknown'}; modelled monthly mean: ${value.valueC === null ? 'Unknown' : `${value.valueC} °C`}; reported optimum: ${criterion.lowerC}–${criterion.upperC} °C.`,
    criterion.convention, criterion.basis, criterion.limits,
    `Crop criterion: ${criterion.source}; ${criterion.locator}; published ${criterion.publishedMonth} (day unknown); accessed ${criterion.accessedOn}; review due unknown. ${criterion.url} . Original SHA256 ${criterion.originalSha256}.`,
    criterion.reuse,
    ...(evidence ? [
      `Climate: T2M climatological monthly-mean air temperature at 2 metres, Celsius; period ${evidence.receipt.period.start} to ${evidence.receipt.period.end}; API ${evidence.receipt.apiVersion ?? 'Unknown'}; datasets ${evidence.receipt.sources.join(', ') || 'Unknown'}; time standard ${evidence.receipt.timeStandard ?? 'Unknown'}.`,
      `Client received/read at ${evidence.receipt.receivedAt}; this is not a provider refresh time. Requested/returned API point ${evidence.receipt.requestedPoint.latitude}, ${evidence.receipt.requestedPoint.longitude}; native grid footprint not retained. Country ${evidence.countryCode} is grower-declared, not inferred by this model.`,
      `Retained response JSON SHA256 ${evidence.snapshot.responseJsonSha256}; checksum verifies retained-record consistency, not provider authenticity or farming accuracy. ${evidence.snapshot.endpoint}`,
      POWER_TEMPERATURE_ATTRIBUTION, POWER_TEMPERATURE_REUSE,
    ] : ['No qualified site climate record is available. Legacy display substitutes are not used.']),
  ];
}
