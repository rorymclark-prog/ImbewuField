import { resolveProvisionalCropPlan, type ProvisionalDraftRequest } from './provisional-crop-planning';
import { growerPlanningScopeKey, growerCountAreaBasisKey, normaliseGrowerMeasuredAreaInput,
  normaliseGrowerPlanningProfile, isGrowerRecordedAt, type GrowerPlanningProfile } from './grower-planning';
import type { GrowerWorkflowSource } from './grower-workflow-source';
import { detachJsonData } from '../lossless-json';

/** A historical review record, never a durable source-check capability. Original
 * request data lets the same resolver retain defaults, overrides and unknowns. */
export interface SavedProvisionalOrigin {
  readonly version: 1;
  readonly resolver: 'provisional-crop-v1';
  readonly profileId: string;
  readonly savedAt: string;
  readonly originalRequestJson: string;
  readonly previewFingerprint: string;
  readonly bedId: string;
  readonly bedLabel: string;
  readonly source: Readonly<Pick<GrowerWorkflowSource, 'kind' | 'sourceKey' | 'sourceRevision' | 'geometryFingerprint'>>;
}
export type ProvisionalProfileSaveResult = { readonly status: 'confirmed'; readonly profileId: string }
  | { readonly status: 'held' | 'failed' | 'superseded' };
const keys = ['version', 'resolver', 'profileId', 'savedAt', 'originalRequestJson', 'previewFingerprint', 'bedId', 'bedLabel', 'source'];
const sourceKeys = ['kind', 'sourceKey', 'sourceRevision', 'geometryFingerprint'];
const requestKeys = ['profileId', 'cropKey', 'context', 'recordedAt', 'asOf', 'candidates', 'overrides', 'measuredAreaM2', 'fieldEntryDate', 'knownPlantingRestriction', 'countBasis'];
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(v);
function own(value: unknown, expected: readonly string[]): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== expected.length
    || !expected.every(k => descriptors[k]?.enumerable && 'value' in descriptors[k])) return null;
  return Object.fromEntries(expected.map(k => [k, descriptors[k].value]));
}
function boundedJson(value: unknown, depth = 0, budget = { nodes: 0 }): boolean {
  if (++budget.nodes > 10000 || depth > 20) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 1000 && value.every(v => boundedJson(v, depth + 1, budget));
  return !!value && typeof value === 'object' && Object.keys(value).length <= 64
    && Object.values(value).every(v => boundedJson(v, depth + 1, budget));
}
function original(origin: SavedProvisionalOrigin): ProvisionalDraftRequest | null {
  const request = JSON.parse(origin.originalRequestJson);
  if (!boundedJson(request) || !request || typeof request !== 'object' || Array.isArray(request)
    || Object.keys(request).some(k => !requestKeys.includes(k)) || JSON.stringify(request) !== origin.originalRequestJson) return null;
  return request;
}
function savable(result: ReturnType<typeof resolveProvisionalCropPlan>, request: ProvisionalDraftRequest) {
  const area = normaliseGrowerMeasuredAreaInput(request.measuredAreaM2);
  return result.status === 'resolved' && area?.state === 'provided' && area.value > 0
    && !Object.values(result.fields).some(field => field.status === 'invalid-override')
    && Object.values(result.fields).every(field => field.sourceBindings.every(source =>
      typeof source.attribution === 'string' && typeof source.limitations === 'string'))
    && ![result.assessment.estimatedPlantCount, result.assessment.estimatedYieldKg, result.assessment.budgetedStations,
      ...Object.values(result.assessment.schedule)].some(output => output.status === 'invalid-inputs')
    && (!request.countBasis || !!result.profile.plantCountOrigin);
}

/** A present malformed receipt rejects the profile. Replaying uses no network,
 * store or current-date assumption, and its temporary profile has no receipt;
 * this avoids recursively treating a historical review as new authority. */
export function normaliseSavedProvisionalOrigin(value: unknown, profile: GrowerPlanningProfile): SavedProvisionalOrigin | null {
  try {
    const row = own(value, keys), source = row && own(row.source, sourceKeys);
    if (!row || !source || row.version !== 1 || row.resolver !== 'provisional-crop-v1'
      || row.profileId !== profile.profileId || row.profileId === 'provisional-preview'
      || !text(row.bedId) || !text(row.bedLabel) || !isGrowerRecordedAt(row.savedAt)
      || typeof row.originalRequestJson !== 'string' || row.originalRequestJson.length > 262144
      || typeof row.previewFingerprint !== 'string' || row.previewFingerprint.length > 262144
      || !['studio-canvas', 'facilitator-cloud', 'facilitator-local'].includes(source.kind)
      || !text(source.sourceKey) || ![source.sourceRevision, source.geometryFingerprint].every(v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v))) return null;
    const origin = { ...row, source: Object.freeze(source) } as unknown as SavedProvisionalOrigin;
    const request = original(origin); if (!request || request.profileId === profile.profileId
      || request.asOf !== row.savedAt.slice(0, 10) || request.recordedAt?.slice(0, 10) !== request.asOf
      || request.recordedAt > row.savedAt || (request.countBasis && request.countBasis.bedId !== row.bedId)) return null;
    const preview = resolveProvisionalCropPlan(request);
    if (!savable(preview, request) || preview.fingerprint !== origin.previewFingerprint) return null;
    const rebound = resolveProvisionalCropPlan({ ...request, profileId: profile.profileId });
    if (rebound.status !== 'resolved' || JSON.stringify(rebound.profile) !== JSON.stringify(profile)) return null;
    return Object.freeze(origin);
  } catch { return null; }
}

/** Recompute identity-bound origins with a new ID; never copy a spacing receipt
 * under a different owner or replace it with its rounded density. */
export function createSavedProvisionalProfile(request: ProvisionalDraftRequest, profileId: string, savedAt: string,
  source: GrowerWorkflowSource, bedId: string, bedLabel: string): GrowerPlanningProfile | null {
  try {
    if (source.status !== 'ready' || !text(profileId) || profileId === request.profileId || profileId === 'provisional-preview'
      || growerPlanningScopeKey(source.scope) !== growerPlanningScopeKey(request.context.scope)) return null;
    const areas = source.measuredAreas.filter(row => row.bedId === bedId), beds = source.beds.filter(row => row.id === bedId);
    const area = normaliseGrowerMeasuredAreaInput(request.measuredAreaM2);
    if (!area || areas.length !== 1 || beds.length !== 1 || beds[0].label !== bedLabel || beds[0].areaM2 !== areas[0].areaM2
      || growerCountAreaBasisKey(area) !== growerCountAreaBasisKey({ state: 'provided', value: areas[0].areaM2, unit: 'm2',
        provenance: { kind: 'grower-record', recordedAt: request.recordedAt, reference: bedId },
        ...(areas[0].arithmeticBasis ? { arithmeticBasis: areas[0].arithmeticBasis } : {}) })) return null;
    const detached = detachJsonData(request, { allowUndefinedObjectFields: true }) as ProvisionalDraftRequest;
    const preview = resolveProvisionalCropPlan(detached);
    if (!savable(preview, detached)) return null;
    const rebound = resolveProvisionalCropPlan({ ...detached, profileId });
    if (rebound.status !== 'resolved') return null;
    return normaliseGrowerPlanningProfile({ ...rebound.profile, provisionalOrigin: {
      version: 1, resolver: 'provisional-crop-v1', profileId, savedAt,
      originalRequestJson: JSON.stringify(detached), previewFingerprint: preview.fingerprint,
      bedId, bedLabel, source: { kind: source.kind, sourceKey: source.sourceKey,
        sourceRevision: source.sourceRevision, geometryFingerprint: source.geometryFingerprint },
    } });
  } catch { return null; }
}

/** Historical evidence only. The caller must separately decide current actor
 * visibility and must not use this record to approve a new sowing. */
export function readSavedProvisionalProfile(value: unknown) {
  const profile = normaliseGrowerPlanningProfile(value);
  if (!profile?.provisionalOrigin) return null;
  const request = original(profile.provisionalOrigin)!;
  const result = resolveProvisionalCropPlan(request);
  return result.status === 'resolved' ? { profile, request, result, origin: profile.provisionalOrigin } : null;
}
