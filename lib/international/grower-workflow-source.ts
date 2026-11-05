import { normaliseCanvasState } from '../design-canvas';
import { normaliseFacilitatorState } from '../facilitator-design';
import { BED_DEF_IDS, bedsFromDesignCanvas } from '../design-beds-bridge';
import { canonicalCoordinateSiteId } from '../site-id';
import { coordinateSiteIdForPlace } from './site-context';
import { workspacePlanningIdForDesign } from './workspace-context';
import { growerPlanningScopeKey, normaliseGrowerPlanningScope, type GrowerPlanningScope,
  type GrowerAreaArithmeticBasis } from './grower-planning';
import type { PlanBed } from '../crop-plan';

export type RawGrowerSourceReceipt =
  | { readonly status: 'ready'; readonly raw: unknown; readonly revision: string; readonly ownerUid: string | null; readonly sample: boolean }
  | { readonly status: 'held'; readonly reasons: readonly string[] };
export type GrowerWorkflowSourceKind = 'studio-canvas' | 'facilitator-local' | 'facilitator-cloud';
export interface GrowerWorkflowSourceRequest {
  readonly kind: GrowerWorkflowSourceKind;
  readonly sourceId: string;
  readonly raw: unknown;
  readonly sourceRevision: string;
}
export interface GrowerWorkflowMeasuredArea {
  readonly bedId: string;
  readonly areaM2: number;
  readonly basis: 'explicit-saved-dimensions' | 'calibrated-saved-polygon';
  readonly arithmeticBasis?: GrowerAreaArithmeticBasis;
}
export interface GrowerWorkflowHeldBed {
  readonly bedId: string;
  readonly reasons: readonly string[];
}
interface SourceDescription {
  readonly kind: GrowerWorkflowSourceKind;
  readonly sourceKey: string;
  readonly sourceId: string;
  /** Existing nursery/resource book namespace; distinct from grower scope. */
  readonly resourceSiteId: string;
  readonly scope: GrowerPlanningScope;
  readonly beds: readonly Readonly<PlanBed>[];
  readonly measuredAreas: readonly GrowerWorkflowMeasuredArea[];
  readonly heldBeds: readonly GrowerWorkflowHeldBed[];
  readonly freshness: 'device-saved-copy' | 'cloud-query-copy';
  readonly sourceVerification: 'not-verified';
}
export type GrowerWorkflowSource = SourceDescription & {
  readonly status: 'ready'; readonly geometryFingerprint: string; readonly sourceRevision: string;
};
export type GrowerWorkflowSourceHold = { readonly status: 'held'; readonly reasons: readonly string[] };
/** Private pre-hash material: never persist/log this intermediate representation. */
export type GrowerWorkflowSourceInspection = GrowerWorkflowSourceHold | (SourceDescription & {
  readonly status: 'inspected'; readonly geometryCanonical: string; readonly sourceRevision: string;
});

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function authoredRecord(value: unknown): value is Record<string, unknown> {
  if (!record(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.values(Object.getOwnPropertyDescriptors(value)).every(property => 'value' in property);
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && !/[\u0000-\u001f\u007f]/.test(value);
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
/** Canonical JSON detaches before any await and rejects damaged geometry instead
 * of allowing JSON to turn NaN, a getter or an array hole into plausible data. */
function canonical(value: unknown, parents = new Set<object>()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (finite(value)) return value;
  if (!value || typeof value !== 'object' || parents.has(value)) throw Error('invalid-source-geometry');
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw Error('invalid-source-geometry');
  parents.add(value);
  try {
    if (Array.isArray(value)) return Array.from({ length: value.length }, (_, index) => {
      const property = Object.getOwnPropertyDescriptor(value, String(index));
      if (!property || !('value' in property)) throw Error('invalid-source-geometry');
      return canonical(property.value, parents);
    });
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      const property = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in property)) throw Error('invalid-source-geometry');
      if (property.value !== undefined) result[key] = canonical(property.value, parents);
    }
    return result;
  } finally { parents.delete(value); }
}
function pick(value: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
function uniqueRawRows(groups: unknown[]): boolean {
  const ids = new Set<string>();
  return groups.every(group => Array.isArray(group) && group.every(row => {
    if (!record(row) || !identity(row.id) || ids.has(row.id)) return false;
    ids.add(row.id); return true;
  }));
}
function scopeForDesign(raw: Record<string, unknown>, designId: string): GrowerPlanningScope | null {
  if (raw.bgSite !== undefined) {
    if (!record(raw.bgSite) || !finite(raw.bgSite.lat) || !finite(raw.bgSite.lon) || typeof raw.bgSite.name !== 'string') return null;
    const siteId = coordinateSiteIdForPlace({ lat: raw.bgSite.lat, lon: raw.bgSite.lon });
    return siteId ? normaliseGrowerPlanningScope({ kind: 'mapped-site', siteId }) : null;
  }
  const workspaceId = workspacePlanningIdForDesign({ designId });
  return workspaceId ? normaliseGrowerPlanningScope({ kind: 'unmapped-workspace', workspaceId }) : null;
}

/** Validate the canonical resource namespace on a source produced by this authority.
 * This is namespace binding, not authentication of an arbitrary imported DTO. */
function resourceNamespace(kind: unknown, sourceId: string, scope: GrowerPlanningScope): string | null {
  if (kind === 'studio-canvas') {
    return canonicalCoordinateSiteId(sourceId) && scope.kind === 'mapped-site' && scope.siteId === sourceId ? sourceId : null;
  }
  if (kind === 'facilitator-local' || kind === 'facilitator-cloud') {
    const workspace = normaliseGrowerPlanningScope({ kind: 'unmapped-workspace', workspaceId: `design:${sourceId}` });
    if (!workspace || (scope.kind === 'unmapped-workspace' && growerPlanningScopeKey(scope) !== growerPlanningScopeKey(workspace))) return null;
    return kind === 'facilitator-cloud' ? `design:${sourceId}` : scope.kind === 'mapped-site' ? scope.siteId : 'design:local';
  }
  return null;
}
export function growerWorkflowResourceSiteId(value: unknown): string | null {
  if (!record(value) || value.status !== 'ready' || !identity(value.sourceId)
    || typeof value.geometryFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.geometryFingerprint)
    || typeof value.sourceRevision !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceRevision)) return null;
  const scope = normaliseGrowerPlanningScope(value.scope);
  if (!scope || value.sourceKey !== `${value.kind}:${value.sourceId}`) return null;
  const expected = resourceNamespace(value.kind, value.sourceId, scope);
  return value.resourceSiteId === expected ? expected : null;
}
function fieldBlocksValid(raw: Record<string, unknown>): boolean {
  const zones = raw.zones as Record<string, unknown>[];
  for (const zone of zones) {
    if (zone.fieldBlock === undefined) continue;
    const config = zone.fieldBlock;
    if (zone.feature !== 'staple_garden' || !record(config) || (config.mode !== 'beds' && config.mode !== 'open')
      || !positive(config.bedLengthM) || !positive(config.bedWidthM) || !finite(config.pathWidthM)
      || config.pathWidthM < 0 || !finite(config.angleDeg)) return false;
  }
  return [...raw.items as Record<string, unknown>[], ...raw.lines as Record<string, unknown>[]].every(row => {
    if (row.fieldBlockId === undefined) return true;
    return identity(row.fieldBlockId) && zones.some(zone => zone.id === row.fieldBlockId
      && record(zone.fieldBlock) && zone.fieldBlock.mode === 'beds');
  });
}

/** Inspect exact authored source data; existing legacy normalizers may not choose
 * a winning duplicate, discard corruption or supply missing measures for this use. */
export function inspectGrowerWorkflowSource(request: GrowerWorkflowSourceRequest): GrowerWorkflowSourceInspection {
  const held = (...reasons: string[]): GrowerWorkflowSourceHold => freeze({ status: 'held', reasons });
  try {
    if (!authoredRecord(request) || !identity(request.sourceRevision) || !identity(request.sourceId)) return held('invalid-source-identity');
    if (!['studio-canvas', 'facilitator-local', 'facilitator-cloud'].includes(request.kind)) return held('invalid-source-kind');
    const heldBeds: GrowerWorkflowHeldBed[] = [], measuredAreas: GrowerWorkflowMeasuredArea[] = [];
    let sourceId = request.sourceId, scope: GrowerPlanningScope | null, geometry: object, beds: PlanBed[];
    const rawInput = request.raw;
    // Storage JSON cannot contain getters or inherited rows. Reject these before
    // separate validation/hash reads could observe different geometry values.
    if (!authoredRecord(rawInput)) return held('invalid-source-geometry');
    if (request.kind === 'studio-canvas') {
      if (!canonicalCoordinateSiteId(sourceId) || !record(rawInput) || rawInput.siteId !== sourceId) return held('source-id-mismatch');
      if (!uniqueRawRows([rawInput.items, rawInput.zones, rawInput.lines])) return held('ambiguous-or-invalid-raw-geometry');
      // This projection is also the detached, JSON-safe input to legacy validation.
      const geometryFields = pick(rawInput, ['siteId', 'frame', 'items', 'zones', 'lines', 'baseMode', 'blankMPerPx', 'useCustomBase', 'scaleFactor']);
      if (record(geometryFields.frame)) geometryFields.frame = pick(geometryFields.frame, ['centerLng', 'centerLat', 'zoom', 'imgW', 'imgH', 'mPerPx']);
      if (rawInput.customBase !== undefined && rawInput.customBase !== null) {
        if (!record(rawInput.customBase)) return held('invalid-photo-calibration');
        geometryFields.customBase = pick(rawInput.customBase, ['mPerPx', 'dx', 'dy', 'rotationDeg', 'scale']);
        if (!positive(rawInput.customBase.mPerPx) || ['dx', 'dy', 'rotationDeg'].some(key => rawInput.customBase !== null
          && record(rawInput.customBase) && rawInput.customBase[key] !== undefined && !finite(rawInput.customBase[key]))
          || (rawInput.customBase.scale !== undefined && !positive(rawInput.customBase.scale))) return held('invalid-photo-calibration');
      }
      const detached = canonical(geometryFields) as Record<string, unknown>;
      if (!fieldBlocksValid(detached)) return held('invalid-field-block');
      // Navigation is irrelevant to geometry, but existing validation still checks its
      // real stored shape. Never fabricate a frame, dimension, scale or saved stamp.
      const state = normaliseCanvasState(rawInput, sourceId);
      if (!state) return held('invalid-source-geometry');
      scope = normaliseGrowerPlanningScope({ kind: 'mapped-site', siteId: sourceId });
      const eligible = state.items.filter(item => {
        if (!(BED_DEF_IDS as readonly string[]).includes(item.defId)) return true;
        if (item.wM === undefined || item.hM === undefined) {
          heldBeds.push({ bedId: item.id, reasons: ['explicit-saved-dimensions-required'] }); return false;
        }
        return true;
      });
      // The shared bridge still owns footprint/calibration. Presentation rounding
      // must not become an input to whole-plant capacity arithmetic.
      const measuredBeds = bedsFromDesignCanvas({ ...state, items: eligible }, { areaRounding: 'none' });
      beds = measuredBeds;
      for (const bed of measuredBeds) measuredAreas.push({ bedId: bed.id, areaM2: bed.areaM2,
        basis: state.zones.some(zone => zone.id === bed.id) ? 'calibrated-saved-polygon' : 'explicit-saved-dimensions',
        ...(bed.savedRectangleM ? { arithmeticBasis: { kind: 'saved-rectangle-metres-v1' as const,
          widthM: bed.savedRectangleM[0], heightM: bed.savedRectangleM[1] } } : {}) });
      for (const zone of state.zones) if (zone.feature === 'staple_garden' && zone.fieldBlock?.mode !== 'beds' && !beds.some(bed => bed.id === zone.id)) {
        heldBeds.push({ bedId: zone.id, reasons: ['nonpositive-or-degenerate-allocation'] });
      }
      geometry = detached;
    } else {
      if (!record(rawInput)) return held('invalid-source-geometry');
      let data = rawInput;
      if (request.kind === 'facilitator-cloud') {
        if (rawInput.id !== sourceId || !identity(rawInput.owner_id) || !authoredRecord(rawInput.data)) return held('source-id-mismatch');
        data = rawInput.data;
        if (data.designId !== undefined && data.designId !== sourceId) return held('source-design-id-mismatch');
      } else {
        if (sourceId !== 'local') return held('source-id-mismatch');
        if (data.designId !== undefined && !identity(data.designId)) return held('invalid-source-identity');
        sourceId = typeof data.designId === 'string' ? data.designId : 'local';
      }
      if (!normaliseGrowerPlanningScope({ kind: 'unmapped-workspace', workspaceId: `design:${sourceId}` })) return held('invalid-source-identity');
      if (!uniqueRawRows([data.items, data.lines, data.sectors])) return held('ambiguous-or-invalid-raw-geometry');
      if (!positive(data.pxPerM) || (data.geomVersion !== undefined && data.geomVersion !== 2)
        || (data.bgRect !== undefined && (!record(data.bgRect) || ![data.bgRect.x, data.bgRect.y].every(finite)
          || !positive(data.bgRect.w) || !positive(data.bgRect.h)))) return held('invalid-source-calibration');
      scope = scopeForDesign(data, sourceId);
      if (!scope) return held('invalid-source-scope');
      const detached = canonical(pick(data, ['version', 'geomVersion', 'designId', 'items', 'lines', 'sectors', 'pxPerM', 'bgRect', 'bgSite'])) as Record<string, unknown>;
      for (const row of [...detached.items as Record<string, unknown>[], ...detached.sectors as Record<string, unknown>[]]) {
        if ((row.xM !== undefined || row.yM !== undefined) && (!finite(row.xM) || !finite(row.yM))) return held('invalid-source-geometry');
      }
      for (const line of detached.lines as Record<string, unknown>[]) {
        if (line.closed !== undefined && typeof line.closed !== 'boolean') return held('invalid-source-geometry');
        for (const points of [line.points, line.pointsM]) {
          if (points !== undefined && (!Array.isArray(points) || (points.length > 0 && (points.length < 4 || points.length % 2 !== 0 || !points.every(finite))))) {
            return held('invalid-source-geometry');
          }
        }
      }
      const unknownSize = new Set<string>();
      for (const item of detached.items as Record<string, unknown>[]) {
        if (item.type !== 'bed' && item.type !== 'hugel') continue;
        if (![item.x, item.y, item.rotation].every(finite)
          || (item.wM !== undefined && !positive(item.wM)) || (item.hM !== undefined && !positive(item.hM))) return held('invalid-source-geometry');
        if (item.wM === undefined || item.hM === undefined) {
          unknownSize.add(item.id as string); heldBeds.push({ bedId: item.id as string, reasons: ['explicit-saved-dimensions-required'] });
        }
      }
      const eligibleItems = (detached.items as Record<string, unknown>[]).filter(item => !unknownSize.has(item.id as string));
      const state = normaliseFacilitatorState({ ...data, ...detached, items: eligibleItems });
      if (!state || state.items.length !== eligibleItems.length || state.lines.length !== (data.lines as unknown[]).length
        || state.sectors.length !== (data.sectors as unknown[]).length) return held('invalid-source-geometry');
      beds = state.items.filter(item => item.type === 'bed' || item.type === 'hugel').map((item, index) => ({
        id: item.id, label: item.label || `Bed ${index + 1}`, areaM2: item.wM * item.hM, minDimM: Math.min(item.wM, item.hM),
      }));
      for (const bed of beds) {
        const item = state.items.find(item => item.id === bed.id)!;
        measuredAreas.push({ bedId: bed.id, areaM2: bed.areaM2, basis: 'explicit-saved-dimensions',
          arithmeticBasis: { kind: 'saved-rectangle-metres-v1', widthM: item.wM, heightM: item.hM } });
      }
      geometry = detached;
    }
    if (!scope) return held('invalid-source-scope');
    const invalidArea = beds.filter(bed => !positive(bed.areaM2) || !positive(bed.minDimM));
    for (const bed of invalidArea) heldBeds.push({ bedId: bed.id, reasons: ['nonpositive-or-unrepresentable-allocation'] });
    const excluded = new Set(invalidArea.map(bed => bed.id));
    beds = beds.filter(bed => !excluded.has(bed.id));
    const sourceKey = `${request.kind}:${sourceId}`;
    const resourceSiteId = resourceNamespace(request.kind, sourceId, scope);
    if (!resourceSiteId) return held('invalid-resource-namespace');
    return freeze({ status: 'inspected', kind: request.kind, sourceKey, sourceId, scope, beds,
      resourceSiteId,
      measuredAreas: measuredAreas.filter(row => !excluded.has(row.bedId)), heldBeds,
      freshness: request.kind === 'facilitator-cloud' ? 'cloud-query-copy' : 'device-saved-copy',
      sourceVerification: 'not-verified', sourceRevision: request.sourceRevision,
      geometryCanonical: JSON.stringify(canonical({ version: 2, sourceKey, geometry, beds, measuredAreas })) });
  } catch { return held('invalid-source-geometry'); }
}

/** No storage/network access. Caller must still recheck captured account, sample
 * and source receipt after this await; a digest is not a freshness credential. */
export async function fingerprintGrowerWorkflowSource(inspection: GrowerWorkflowSourceInspection): Promise<GrowerWorkflowSource | GrowerWorkflowSourceHold> {
  if (inspection.status === 'held') return inspection;
  try {
    const { geometryCanonical, sourceRevision, status: _status, ...description } = inspection;
    const bytes = new TextEncoder().encode(geometryCanonical), revisionBytes = new TextEncoder().encode(sourceRevision);
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return freeze({ status: 'held', reasons: ['secure-source-fingerprint-unavailable'] });
    const digest = async (input: Uint8Array<ArrayBuffer>) => Array.from(new Uint8Array(await subtle.digest('SHA-256', input)),
      value => value.toString(16).padStart(2, '0')).join('');
    const [geometryFingerprint, revision] = await Promise.all([digest(bytes), digest(revisionBytes)]);
    return freeze({ ...description, status: 'ready', geometryFingerprint, sourceRevision: revision });
  } catch { return freeze({ status: 'held', reasons: ['secure-source-fingerprint-unavailable'] }); }
}
