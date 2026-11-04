import type { CropPlanState } from '../crop-plan';
import { generateGrowerAutoPlan, GROWER_AUTOPLAN_MAX_ASSESSMENTS, type GrowerAutoPlanRequest, type GrowerAutoPlanProposal } from './grower-autoplan';
import { growerDemandFromHarvestTarget } from './grower-harvest-demand';
import { createGrowerCyclePlanting, type GrowerCyclePlanting, isProvenForeignGrowerCycle, resolvePlantingBasis } from './grower-cycle';
import { projectGrowerCycles, type ProjectedGrowerCycle } from './grower-cycle-projection';
import { growerPlanningScopeKey, isGrowerRecordedAt, isGrowerUtcDate, normaliseGrowerPlanningProfiles, normaliseGrowerPlanningScope,
  normaliseGrowerMeasuredAreaInput, type GrowerMeasuredAreaInput,
  type GrowerInput, type GrowerInputProvenance, type GrowerPlanningScope } from './grower-planning';
import { growerWorkflowResourceSiteId, type GrowerWorkflowSource } from './grower-workflow-source';

export interface GrowerWorkflowDraft {
  readonly planningStart: string;
  readonly planningEndExclusive: string;
  readonly maxAssessments: string;
  /** User priority, never an inferred first matching profile. */
  readonly targetProfiles: readonly { readonly targetId: string; readonly profileId: string }[];
  readonly available: readonly { readonly bedId: string; readonly start: string; readonly endExclusive: string; readonly confirmed: boolean }[];
  readonly assumptionsConfirmed: boolean;
}
export interface GrowerWorkflowTargetMetadata {
  readonly targetId: string;
  readonly profileId: string;
  readonly buyerTotalKg: number;
  readonly grossCapacityRequiredKg: number;
  readonly days: number;
  readonly saleablePercent: number | null;
  readonly deliveryDistribution: 'not-established';
  readonly sourceVerification: 'not-verified';
}
export interface GrowerWorkflowBlockedBed {
  readonly bedId: string;
  readonly reasons: readonly string[];
}
interface WorkflowDiagnostics {
  readonly issues: readonly string[];
  readonly blockedBeds: readonly GrowerWorkflowBlockedBed[];
  readonly targetMetadata: readonly GrowerWorkflowTargetMetadata[];
  readonly existingOwnCycles: readonly ProjectedGrowerCycle[];
}
export type GrowerWorkflowReview = WorkflowDiagnostics & (
  | { readonly status: 'held' }
  | { readonly status: 'review'; readonly recordedAt: string; readonly request: GrowerAutoPlanRequest; readonly proposal: GrowerAutoPlanProposal }
);
export interface AssembleGrowerWorkflowReviewInput {
  readonly scope: GrowerPlanningScope | null;
  readonly source: GrowerWorkflowSource | null;
  /** The entire current canonical book, not a prefiltered selected-bed list. */
  readonly book: CropPlanState;
  readonly draft: GrowerWorkflowDraft;
  /** Captured once by the controller; reuse unchanged for every recheck. */
  readonly recordedAt: string;
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !/[\u0000-\u001f\u007f]/.test(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function counts(rows: readonly unknown[], key: string): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) if (record(row) && typeof row[key] === 'string') {
    const id = row[key] as string; result.set(id, (result.get(id) ?? 0) + 1);
  }
  return result;
}
function supplied<T, U extends string>(value: T, unit: U, provenance: GrowerInputProvenance): GrowerInput<T, U> {
  return { state: 'provided', value, unit, provenance };
}

/** Read-only proposal assembly. A source DTO is a verified saved-design copy,
 * not a field measurement, live-account receipt, country approval or permission
 * to append a cycle. The controller owns fresh reads and late-response guards. */
export function assembleGrowerWorkflowReview(input: AssembleGrowerWorkflowReviewInput): GrowerWorkflowReview {
  const blocked = new Map<string, Set<string>>();
  const targetMetadata: GrowerWorkflowTargetMetadata[] = [];
  let existingOwnCycles: readonly ProjectedGrowerCycle[] = [];
  const blockedBeds = () => [...blocked].map(([bedId, reasons]) => ({ bedId, reasons: [...reasons] }));
  const hold = (...issues: string[]): GrowerWorkflowReview => freeze({ status: 'held', issues: [...new Set(issues)],
    blockedBeds: blockedBeds(), targetMetadata: [...targetMetadata], existingOwnCycles });
  const block = (bedId: string, reasons: readonly string[]) => {
    const values = blocked.get(bedId) ?? new Set<string>();
    reasons.forEach(reason => values.add(reason)); blocked.set(bedId, values);
  };
  try {
    const scope = normaliseGrowerPlanningScope(input.scope), source = input.source, draft = input.draft, book = input.book;
    if (!scope || scope.kind !== 'mapped-site') return hold('mapped-site-required');
    if (!isGrowerRecordedAt(input.recordedAt)) return hold('review-time-invalid');
    if (!source || source.status !== 'ready') return hold('source-unavailable');
    if (growerPlanningScopeKey(source.scope) !== growerPlanningScopeKey(scope)) return hold('source-scope-mismatch');
    if (!growerWorkflowResourceSiteId(source)) return hold('source-resource-mismatch');
    if (![source.sourceKey, source.sourceId, source.resourceSiteId, source.sourceRevision, source.geometryFingerprint].every(identity)
      || source.sourceVerification !== 'not-verified' || !Array.isArray(source.beds)
      || !Array.isArray(source.measuredAreas) || !Array.isArray(source.heldBeds)) return hold('source-invalid');
    const bedIds = new Set(source.beds.map(bed => bed.id));
    const areaIds = new Set(source.measuredAreas.map(area => area.bedId));
    if (!source.beds.length || bedIds.size !== source.beds.length || areaIds.size !== source.measuredAreas.length
      || source.measuredAreas.length !== source.beds.length || !source.beds.every(bed => identity(bed.id) && identity(bed.label)
        && Number.isFinite(bed.areaM2) && bed.areaM2 > 0 && source.measuredAreas.some(area => area.bedId === bed.id
          && area.areaM2 === bed.areaM2 && ['explicit-saved-dimensions', 'calibrated-saved-polygon'].includes(area.basis)))) return hold('source-measures-invalid');
    const measuredInputs = new Map<string, GrowerMeasuredAreaInput>();
    for (const bed of source.beds) {
      const area = source.measuredAreas.find(row => row.bedId === bed.id)!;
      const marker = Object.getOwnPropertyDescriptor(area, 'arithmeticBasis');
      if (marker && !('value' in marker) || !marker && 'arithmeticBasis' in area) return hold('source-measures-invalid');
      // Preserve marker presence: null/undefined/false must not silently borrow
      // canonical-only capacity after the exact saved factors were damaged.
      const measured = normaliseGrowerMeasuredAreaInput({ ...supplied(bed.areaM2, 'm2', {
        kind: 'grower-record', recordedAt: input.recordedAt,
        reference: 'Saved design area copied for this review; explicit saved dimensions or calibrated polygon, not independently verified field area.' }),
        ...(marker ? { arithmeticBasis: marker.value } : {}) });
      if (!measured) return hold('source-measures-invalid');
      measuredInputs.set(bed.id, measured);
    }
    for (const bed of source.heldBeds) {
      if (!identity(bed.bedId) || bedIds.has(bed.bedId)) return hold('source-bed-ambiguity');
      block(bed.bedId, ['source-bed-held']);
    }
    const allSourceBedIds = new Set([...bedIds, ...blocked.keys()]);
    if (!book || book.version !== 1 || !Array.isArray(book.plantings)) return hold('crop-book-unavailable');
    if (book.plantings.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return hold('book-work-limit');
    // Inspect the entire book first. Filtering a foreign/corrupt duplicate first
    // would let array order choose which canonical planting identity wins.
    if ([...counts(book.plantings, 'id').values()].some(count => count > 1)) return hold('ambiguous-planting-identities');
    const projection = projectGrowerCycles(Array.from(book.plantings), { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint });
    existingOwnCycles = projection.ownCycles;
    for (const legacy of projection.legacyRows) if (allSourceBedIds.has(legacy.row.bedId)) block(legacy.row.bedId, ['legacy-occupancy-unresolved']);
    for (const held of projection.heldRows) {
      const row = held.row;
      if (record(row) && identity(row.bedId) && allSourceBedIds.has(row.bedId)) { block(row.bedId, held.reasons); continue; }
      if (isProvenForeignGrowerCycle(row, scope, allSourceBedIds)) continue;
      return hold('unresolved-row-association');
    }
    if (!draft || draft.assumptionsConfirmed !== true) return hold('assumptions-confirmation-required');
    if (!isGrowerUtcDate(draft.planningStart) || !isGrowerUtcDate(draft.planningEndExclusive)
      || draft.planningStart >= draft.planningEndExclusive) return hold('planning-horizon-invalid');
    if (typeof draft.maxAssessments !== 'string' || !/^\d+$/.test(draft.maxAssessments.trim())) return hold('work-budget-required');
    const maxAssessments = Number(draft.maxAssessments.trim());
    if (!Number.isSafeInteger(maxAssessments) || maxAssessments < 1 || maxAssessments > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return hold('work-budget-invalid');
    if (!Array.isArray(draft.targetProfiles) || !draft.targetProfiles.length) return hold('selected-target-required');
    if (!Array.isArray(draft.available)) return hold('availability-invalid');
    const targetRows: readonly unknown[] = book.harvestTargets ?? [];
    const rawProfiles: readonly unknown[] = book.growerPlanningProfiles ?? [];
    if (!Array.isArray(targetRows) || !Array.isArray(rawProfiles)) return hold('target-profile-source-invalid');
    const targetCounts = counts(targetRows, 'id'), profileCounts = counts(rawProfiles, 'profileId');
    const profiles = normaliseGrowerPlanningProfiles(rawProfiles), selectedProfiles = new Map<string, typeof profiles[number]>();
    const selectedTargets = new Set<string>();
    const demands: GrowerAutoPlanRequest['demands'][number][] = [];
    for (const selection of draft.targetProfiles) {
      if (!selection || !identity(selection.targetId)) return hold('selected-target-required');
      if (!identity(selection.profileId)) return hold('selected-profile-required');
      if (selectedTargets.has(selection.targetId) || targetCounts.get(selection.targetId) !== 1) return hold('selected-target-ambiguous');
      selectedTargets.add(selection.targetId);
      if (profileCounts.get(selection.profileId) !== 1) return hold('selected-profile-ambiguous');
      const profile = profiles.find(profile => profile.profileId === selection.profileId);
      if (!profile) return hold('selected-profile-invalid');
      const target = targetRows.find(row => record(row) && row.id === selection.targetId);
      if (!record(target) || target.siteId !== source.resourceSiteId) return hold('target-scope-mismatch');
      const converted = growerDemandFromHarvestTarget({ target, profile, scope, source, recordedAt: input.recordedAt });
      if (converted.status === 'held') return hold(...converted.reasons.map(reason => `target-${reason}`));
      demands.push(converted.demand); selectedProfiles.set(profile.profileId, profile);
      targetMetadata.push({ targetId: selection.targetId, profileId: selection.profileId,
        buyerTotalKg: converted.buyerTotalKg, grossCapacityRequiredKg: converted.grossCapacityRequiredKg,
        days: converted.days, saleablePercent: converted.saleablePercent,
        deliveryDistribution: converted.deliveryDistribution, sourceVerification: converted.sourceVerification });
    }
    const estimate: GrowerInputProvenance = { kind: 'grower-estimate', recordedAt: input.recordedAt,
      note: 'Grower-entered dated availability or horizon for this review; not an observed land-use record.' };
    const availability: GrowerAutoPlanRequest['availability'][number][] = [];
    const selectedAvailabilityBeds = new Set<string>();
    for (const available of draft.available) {
      if (!available || typeof available.confirmed !== 'boolean') return hold('availability-invalid');
      if (!available.confirmed) continue;
      if (!identity(available.bedId) || !bedIds.has(available.bedId)) return hold('availability-bed-unavailable');
      if (selectedAvailabilityBeds.has(available.bedId)) return hold('availability-bed-ambiguous');
      selectedAvailabilityBeds.add(available.bedId);
      if (blocked.has(available.bedId)) return hold('availability-bed-blocked');
      if (!isGrowerUtcDate(available.start) || !isGrowerUtcDate(available.endExclusive) || available.start >= available.endExclusive) return hold('availability-window-invalid');
      availability.push({ bedId: available.bedId, scope, window: supplied({ start: available.start, endExclusive: available.endExclusive }, 'utc-date-window', estimate) });
    }
    const request: GrowerAutoPlanRequest = {
      requestedAt: input.recordedAt, scope, geometryFingerprint: source.geometryFingerprint, profiles: [...selectedProfiles.values()],
      beds: source.beds.map(bed => ({ bed: { ...bed }, scope, measuredAreaM2: measuredInputs.get(bed.id)! })),
      planningStart: supplied(draft.planningStart, 'utc-date', estimate), planningEndExclusive: supplied(draft.planningEndExclusive, 'utc-date', estimate),
      availability, reserved: existingOwnCycles.map(cycle => ({ id: cycle.plantingId, bedId: cycle.bedId, scope,
        window: supplied({ ...cycle.reservation }, 'utc-date-window', { kind: 'grower-record', recordedAt: input.recordedAt,
          reference: 'Current canonical own-cycle reservation copied for this review; not observed land use.' }) })),
      demands, maxAssessments,
    };
    const proposal = generateGrowerAutoPlan(request);
    return freeze({ status: 'review', recordedAt: input.recordedAt, request, proposal,
      issues: [...proposal.issues], blockedBeds: blockedBeds(), targetMetadata, existingOwnCycles });
  } catch { return hold('unreadable-workflow-input'); }
}


export interface PrepareGrowerWorkflowAcceptanceInput {
  readonly review: Extract<GrowerWorkflowReview, { status: 'review' }>;
  /** The controller must retrieve this binding from its private review identity. */
  readonly binding: { readonly source: GrowerWorkflowSource; readonly draft: GrowerWorkflowDraft; readonly recordedAt: string };
  readonly scope: GrowerPlanningScope | null;
  readonly source: GrowerWorkflowSource | null;
  readonly book: CropPlanState;
  readonly acceptedAt: string;
  /** Full proposal only: engine ordinals identify mappings, never persistent rows. */
  readonly plantingIds: readonly { readonly cycleId: string; readonly plantingId: string }[];
}
export type GrowerWorkflowAcceptancePreparation =
  | { readonly status: 'held'; readonly reasons: readonly string[] }
  | { readonly status: 'prepared'; readonly book: CropPlanState; readonly rows: readonly GrowerCyclePlanting[] };

// Acceptance must not turn a corrupt held nursery record into an empty/default
// record through JSON serialization, or evaluate accessors while copying a book.
function acceptanceJsonData(value: unknown, parents = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object' || parents.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  parents.add(value);
  const keys = Reflect.ownKeys(value);
  const safe = (!Array.isArray(value) || (keys.length === value.length + 1
    && keys.every(key => key === 'length' || (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length)))) && keys.every(key => {
    if (Array.isArray(value) && key === 'length') return true;
    const property = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && !!property && property.enumerable && 'value' in property
      && acceptanceJsonData(property.value, parents);
  });
  parents.delete(value);
  return safe;
}
function acceptanceEqual(left: unknown, right: unknown): boolean {
  // Object spelling order carries no meaning; array order is target priority and
  // must remain exact. Both sides have already passed the lossless-data gate.
  const ordered = (_key: string, value: unknown) => record(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value;
  return JSON.stringify(left, ordered) === JSON.stringify(right, ordered);
}

/** Prepare detached canonical rows without acquiring any save permission. The
 * controller still owns private review identity, actual account/sample checks,
 * raw source/book receipts after awaits, and a final check before its real write. */
export function prepareGrowerWorkflowAcceptance(input: PrepareGrowerWorkflowAcceptanceInput): GrowerWorkflowAcceptancePreparation {
  const held = (...reasons: string[]): GrowerWorkflowAcceptancePreparation => freeze({ status: 'held', reasons: [...new Set(reasons)] });
  try {
    if (!acceptanceJsonData(input)) return held('unsafe-acceptance-input');
    const detached = structuredClone(input), { review, binding, source, scope, book, acceptedAt, plantingIds } = detached;
    if (!review || review.status !== 'review' || !binding || review.recordedAt !== binding.recordedAt
      || !isGrowerRecordedAt(binding.recordedAt)) return held('review-binding-mismatch');
    if (!isGrowerRecordedAt(acceptedAt) || acceptedAt < binding.recordedAt) return held('acceptance-time-invalid');
    if (!scope || !normaliseGrowerPlanningScope(scope) || !binding.source || binding.source.status !== 'ready'
      || growerPlanningScopeKey(scope) !== growerPlanningScopeKey(binding.source.scope)) return held('acceptance-scope-mismatch');
    if (!source || source.status !== 'ready') return held('source-unavailable');
    if (!acceptanceEqual(source, binding.source)) return held('source-changed');
    if (!book || book.version !== 1 || !Array.isArray(book.plantings)
      || typeof book.updatedAt !== 'number' || !Number.isFinite(book.updatedAt)) return held('crop-book-invalid');
    if (book.plantings.some(row => !record(row) || !identity(row.id))) return held('planting-identity-invalid');
    if ([...counts(book.plantings, 'id').values()].some(count => count > 1)) return held('ambiguous-planting-identities');
    const proposal = review.proposal;
    if (!proposal || proposal.status !== 'ready' || proposal.issues.length
      || !proposal.demandResults.length || proposal.demandResults.some(result => !['capacity-covered', 'zero-demand'].includes(result.status)
        || result.unmetKg !== 0)) return held('proposal-not-complete');
    if (!proposal.cycles.length) return held('no-proposed-cycles');
    const current = assembleGrowerWorkflowReview({ scope, source, book, draft: binding.draft, recordedAt: binding.recordedAt });
    // Ordinals repeat between proposals. Replay evidence needs the same actual
    // dated assessment and bed/demand/scope/geometry, not just "grower-cycle:1".
    const replay = book.plantings.some(row => {
      const basis = resolvePlantingBasis(row, { scope, beds: source.beds, geometryFingerprint: source.geometryFingerprint });
      return basis.kind === 'grower-dated-cycle' && proposal.cycles.some(cycle =>
        basis.attachment.cycleId === cycle.cycleId && basis.attachment.demandId === cycle.demandId
        && basis.attachment.bedId === cycle.bedId && basis.attachment.assessmentFingerprint === cycle.assessment.fingerprint);
    });
    if (replay) return held('proposal-already-recorded');
    if (current.status !== 'review') return held('review-no-longer-current', ...current.issues);
    if (!acceptanceEqual(current, review)) return held('review-no-longer-current');
    if (!Array.isArray(plantingIds) || plantingIds.length !== proposal.cycles.length
      || new Set(plantingIds.map(row => row.cycleId)).size !== proposal.cycles.length
      || plantingIds.some(row => !proposal.cycles.some(cycle => cycle.cycleId === row.cycleId))) return held('planting-id-mapping-incomplete');
    const knownIds = new Set(book.plantings.map(row => row.id));
    for (const row of plantingIds) {
      if (!identity(row.plantingId) || row.plantingId.length > 200 || row.plantingId !== row.plantingId.trim()) return held('planting-id-invalid');
      if (knownIds.has(row.plantingId)) return held('planting-id-duplicate');
      knownIds.add(row.plantingId);
    }
    const rows: GrowerCyclePlanting[] = [];
    for (const cycle of proposal.cycles) {
      const row = createGrowerCyclePlanting(cycle, { plantingId: plantingIds.find(row => row.cycleId === cycle.cycleId)!.plantingId,
        acceptedAt, geometryFingerprint: source.geometryFingerprint });
      if (!row) return held('cycle-creation-held');
      rows.push({ ...row, harvestTargetId: cycle.demandId });
    }
    return freeze({ status: 'prepared', rows, book: { ...book, plantings: [...book.plantings, ...rows], updatedAt: Date.parse(acceptedAt) } });
  } catch { return held('unreadable-acceptance-input'); }
}
