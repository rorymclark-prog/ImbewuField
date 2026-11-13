import { normaliseProvisionalCycleContext, type ProvisionalCycleContext } from './provisional-profile';
import type { PlanBed, Planting } from '../crop-plan';
import { normaliseGrowerAutoPlanDemand, growerDemandWindowContainsAssessment,
  type GrowerAutoPlanCycle, type GrowerAutoPlanDemand, type GrowerReadyAssessment } from './grower-autoplan';
import { detachJsonData } from '../lossless-json';
import { readMassQuantityEntry, type MassQuantityEntry } from '../mass-units';
import {
  assessGrowerPlanning, growerPlanningScopeKey, isGrowerRecordedAt, normaliseGrowerPlanningScope,
  type GrowerPlanningScope, type GrowerPlanningSnapshot,
} from './grower-planning';
import { growerEnteredDemandId, type GrowerEnteredDemandPurpose } from './grower-entered-demand';

/** Why this cycle was accepted, as recorded at acceptance. It names a buyer
 * target only for a buyer demand; grower-entered intent never names a buyer,
 * sale, nutrition sufficiency or trial evidence. */
export type GrowerCycleOrigin =
  | { readonly kind: 'buyer-target'; readonly harvestTargetId: string }
  | { readonly kind: 'grower-entered'; readonly purpose: GrowerEnteredDemandPurpose; readonly entryId: string;
      /** Exact replayed request, not this cycle's allocated capacity or dates.
       * Older purpose-only attachments deliberately leave it absent. */
      readonly demandSnapshot?: GrowerAutoPlanDemand;
      /** Exact original text/unit; absent on older requests, never inferred. */
      readonly quantityEntry?: MassQuantityEntry };
/** Derived read view. `not-recorded` is an absent field on a cycle saved before
 * origins existed: it is unknown, never inferred as buyer, household or trial. */
export type GrowerCycleOriginView =
  | { readonly status: 'recorded'; readonly origin: GrowerCycleOrigin }
  | { readonly status: 'not-recorded' };
export type GrowerCycleDemandSnapshotView =
  | { readonly status: 'recorded'; readonly demand: GrowerAutoPlanDemand }
  | { readonly status: 'not-recorded' };
export type GrowerCycleQuantityEntryView =
  | { readonly status: 'recorded'; readonly entry: MassQuantityEntry }
  | { readonly status: 'not-recorded' };

/** Canonical row attachment, not a second crop-cycle book or a country approval. */
export interface GrowerCycleAttachment {
  readonly kind: 'grower-dated-cycle';
  readonly version: 1;
  readonly plantingId: string;
  readonly cycleId: string;
  readonly demandId: string;
  readonly bedId: string;
  readonly acceptedAt: string;
  readonly geometryFingerprint: string;
  readonly assessmentSnapshot: GrowerPlanningSnapshot;
  readonly assessmentFingerprint: string;
  /** Optional version-1 extension. Absent = legacy unknown origin. Present but
   * null, undefined, unreadable, unknown or inconsistent = the whole cycle holds. */
  readonly origin?: GrowerCycleOrigin;
}
export type GrowerCyclePlanting = Planting & { readonly growerCycle: GrowerCycleAttachment };
export interface GrowerCycleCreation {
  /** The coordinator supplies a persistent identity; engine ordinals are review-local. */
  readonly plantingId: string;
  readonly acceptedAt: string;
  readonly geometryFingerprint: string;
  /** Derived by the acceptance coordinator from its fresh replayed review only. */
  readonly origin?: GrowerCycleOrigin;
}
export interface GrowerCycleContext {
  readonly scope: GrowerPlanningScope | null;
  /** All beds in this current saved source, so duplicate identities cannot pick a winner. */
  readonly beds: readonly PlanBed[];
  readonly geometryFingerprint: string | null;
  readonly provisionalContext?: ProvisionalCycleContext | null;
}
export type PlantingBasisResolution =
  | { readonly kind: 'legacy' }
  | { readonly kind: 'held'; readonly reasons: readonly string[] }
  | { readonly kind: 'grower-dated-cycle'; readonly attachment: GrowerCycleAttachment;
      readonly assessment: GrowerReadyAssessment;
      readonly reservation: { readonly start: string; readonly endExclusive: string } };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
}
const geometry = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function reassess(value: unknown): GrowerReadyAssessment | null {
  if (!record(value)) return null;
  const extended = ['provisionalReview', 'countAreaBinding'].some(key => key in value);
  if (extended && ['provisionalReview', 'countAreaBinding'].some(key => key in value && !Object.hasOwn(value, key))) return null;
  const snapshot = extended ? detachJsonData(value) : value;
  if (!record(snapshot)) return null;
  const result = assessGrowerPlanning({ profile: snapshot.profile, scope: snapshot.scope,
    measuredAreaM2: snapshot.measuredAreaM2, fieldEntryDate: snapshot.fieldEntryDate,
    ...(Object.hasOwn(snapshot, 'countAreaBinding') ? { countAreaBinding: snapshot.countAreaBinding as GrowerPlanningSnapshot['countAreaBinding'] } : {}),
    ...(Object.hasOwn(snapshot, 'provisionalReview') ? { provisionalContext: record(snapshot.provisionalReview) ? snapshot.provisionalReview.context : null } : {}) });
  // A marked snapshot must reproduce every review field, including version and
  // resolver evidence. A present malformed extension never degrades to legacy.
  if (('provisionalReview' in snapshot || 'countAreaBinding' in snapshot) && result.snapshot
    && !sameJsonData(snapshot, result.snapshot)) return null;
  return result.status === 'ready' ? result : null;
}

const ORIGIN_KEYS = { 'buyer-target': ['harvestTargetId', 'kind'], 'grower-entered': ['entryId', 'kind', 'purpose'] } as const;
function sameJsonData(left: unknown, right: unknown): boolean {
  // Key spelling order is not evidence, while array order and every supplied
  // property are. A normalizer must not silently trim a recorded request.
  const ordered = (_key: string, value: unknown) => record(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value;
  return JSON.stringify(left, ordered) === JSON.stringify(right, ordered);
}

function enteredDemandSnapshot(value: unknown, demandId: string): GrowerAutoPlanDemand | null {
  try {
    const detached = detachJsonData(value);
    const demand = normaliseGrowerAutoPlanDemand(detached);
    if (!demand || demand.demandId !== demandId || !sameJsonData(detached, demand)
      || demand.totalKg.state !== 'provided' || demand.totalKg.value <= 0
      || demand.harvestWindow.state !== 'provided'
      || demand.totalKg.provenance.kind !== 'grower-estimate'
      || demand.harvestWindow.provenance.kind !== 'grower-estimate') return null;
    return demand;
  } catch { return null; }
}
/** Strict parse of one recorded origin against the cycle's own demand identity.
 * Existing buyer IDs are arbitrary strings. The explicit origin kind and exact
 * identity match distinguish them; reserving a prefix would reject saved buyers. */
export function normaliseGrowerCycleOrigin(value: unknown, demandId: unknown): GrowerCycleOrigin | null {
  try {
    if (!record(value) || !identity(demandId)) return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (!keys.every(key => typeof key === 'string' && descriptors[key].enumerable && 'value' in descriptors[key])) return null;
    const kind: unknown = descriptors.kind?.value;
    if (kind !== 'buyer-target' && kind !== 'grower-entered') return null;
    const snapshotField = descriptors.demandSnapshot;
    if (!snapshotField && 'demandSnapshot' in value) return null;
    const quantityField = descriptors.quantityEntry;
    if (!quantityField && 'quantityEntry' in value) return null;
    const expectedKeys = [...ORIGIN_KEYS[kind],
      ...(kind === 'grower-entered' && snapshotField ? ['demandSnapshot'] : []),
      ...(kind === 'grower-entered' && quantityField ? ['quantityEntry'] : [])].sort();
    if (JSON.stringify([...keys].sort()) !== JSON.stringify(expectedKeys)) return null;
    if (kind === 'buyer-target') {
      const harvestTargetId = descriptors.harvestTargetId.value;
      return identity(harvestTargetId) && harvestTargetId === demandId
        ? { kind, harvestTargetId } : null;
    }
    const purpose = descriptors.purpose.value, entryId = descriptors.entryId.value;
    if ((purpose !== 'household' && purpose !== 'trial') || !identity(entryId) || entryId.length > 120
      || entryId !== entryId.trim() || growerEnteredDemandId(entryId) !== demandId) return null;
    const demandSnapshot = snapshotField ? enteredDemandSnapshot(snapshotField.value, demandId) : null;
    if (snapshotField && !demandSnapshot) return null;
    const quantity = quantityField ? readMassQuantityEntry(quantityField.value) : null;
    if (quantityField && (!demandSnapshot || demandSnapshot.totalKg.state !== 'provided'
      || quantity?.status !== 'provided' || quantity.kilograms !== demandSnapshot.totalKg.value)) return null;
    return { kind, purpose, entryId, ...(demandSnapshot ? { demandSnapshot } : {}),
      ...(quantity?.status === 'provided' ? { quantityEntry: quantity.entry } : {}) };
  } catch { return null; }
}
export function growerCycleOriginView(attachment: Pick<GrowerCycleAttachment, 'origin'>): GrowerCycleOriginView {
  const view: GrowerCycleOriginView = attachment.origin
    ? { status: 'recorded', origin: detachJsonData(attachment.origin) as GrowerCycleOrigin } : { status: 'not-recorded' };
  return freeze(view);
}
/** Missing historical request input is not reconstructed from planned output. */
export function growerCycleDemandSnapshotView(attachment: Pick<GrowerCycleAttachment, 'origin'>): GrowerCycleDemandSnapshotView {
  const origin = attachment.origin;
  const view: GrowerCycleDemandSnapshotView = origin?.kind === 'grower-entered' && origin.demandSnapshot
    ? { status: 'recorded', demand: detachJsonData(origin.demandSnapshot) as GrowerAutoPlanDemand }
    : { status: 'not-recorded' };
  return freeze(view);
}

/** Call after resolving the attachment; an absent historical unit is unknown. */
export function growerCycleQuantityEntryView(attachment: Pick<GrowerCycleAttachment, 'origin'>): GrowerCycleQuantityEntryView {
  const origin = attachment.origin;
  return freeze(origin?.kind === 'grower-entered' && origin.quantityEntry
    ? { status: 'recorded', entry: detachJsonData(origin.quantityEntry) as MassQuantityEntry }
    : { status: 'not-recorded' });
}

/** Parse detached inputs and recompute through the one existing arithmetic authority. */
export function normaliseGrowerCycleAttachment(value: unknown): GrowerCycleAttachment | null {
  try {
    if (!record(value) || value.kind !== 'grower-dated-cycle' || value.version !== 1
      || !identity(value.plantingId) || value.plantingId.length > 200 || !identity(value.cycleId)
      || !identity(value.demandId) || !identity(value.bedId) || !isGrowerRecordedAt(value.acceptedAt)
      || !geometry(value.geometryFingerprint) || typeof value.assessmentFingerprint !== 'string') return null;
    // Presence, not truthiness: an own or inherited null/undefined/accessor origin
    // is held evidence, never a silent fallback to an unknown legacy origin.
    const originField = Object.getOwnPropertyDescriptor(value, 'origin');
    let origin: GrowerCycleOrigin | null = null;
    if (originField || 'origin' in value) {
      if (!originField || !originField.enumerable || !('value' in originField)) return null;
      origin = normaliseGrowerCycleOrigin(originField.value, value.demandId);
      if (!origin) return null;
    }
    const assessment = reassess(value.assessmentSnapshot);
    if (!assessment || assessment.fingerprint !== value.assessmentFingerprint) return null;
    if (assessment.snapshot.countAreaBinding && assessment.snapshot.countAreaBinding.bedId !== value.bedId) return null;
    const adoption = assessment.snapshot.provisionalReview;
    if (adoption && (assessment.snapshot.countAreaBinding?.bedId !== value.bedId
      || adoption.context.source.geometryFingerprint !== value.geometryFingerprint
      || value.acceptedAt < adoption.context.reviewedAt || value.acceptedAt.slice(0, 10) !== adoption.context.asOf)) return null;
    if (origin?.kind === 'grower-entered' && origin.demandSnapshot) {
      const demand = origin.demandSnapshot;
      if (demand.profileId !== assessment.snapshot.profile.profileId
        || growerPlanningScopeKey(demand.scope) !== growerPlanningScopeKey(assessment.snapshot.scope)
        || demand.harvestWindow.state !== 'provided'
        || !growerDemandWindowContainsAssessment(demand.harvestWindow.value, assessment)) return null;
    }
    return freeze({ kind: 'grower-dated-cycle', version: 1, plantingId: value.plantingId,
      cycleId: value.cycleId, demandId: value.demandId, bedId: value.bedId,
      acceptedAt: value.acceptedAt, geometryFingerprint: value.geometryFingerprint,
      assessmentSnapshot: assessment.snapshot, assessmentFingerprint: assessment.fingerprint,
      ...(origin ? { origin } : {}) });
  } catch { return null; }
}

/** Presence matters even for null/undefined: malformed own data must not borrow catalogue advice. */
export function hasGrowerCycleMarker(value: unknown): boolean {
  try { return !!value && typeof value === 'object' && 'growerCycle' in value; }
  catch { return true; }
}
function jsonSafe(value: unknown, parents = new Set<object>(), allowUndefined = false): boolean {
  if (value === undefined) return allowUndefined;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object' || parents.has(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  parents.add(value);
  const safe = Reflect.ownKeys(value).every(key => {
    if (Array.isArray(value) && key === 'length') return true;
    const property = Object.getOwnPropertyDescriptor(value, key);
    // A present origin must not disappear when a report or saved-row copy uses
    // JSON. Non-enumerable fields are held evidence, just like accessors.
    return typeof key === 'string' && !!property?.enumerable && 'value' in property && jsonSafe(property.value, parents, allowUndefined);
  });
  parents.delete(value);
  return safe;
}

/** Spread this result into any canonical or report row copy BEFORE JSON storage.
 * JSON normally deletes undefined/function/symbol properties; a durable invalid
 * marker keeps that failure held instead of resurrecting the legacy path. */
export function preserveGrowerCycleMarker(source: unknown): { readonly growerCycle?: unknown } {
  if (!hasGrowerCycleMarker(source)) return {};
  try {
    const value = (source as Record<string, unknown>).growerCycle;
    if (jsonSafe(value)) return { growerCycle: JSON.parse(JSON.stringify(value)) };
  } catch { /* Unserialisable evidence still needs a durable held identity. */ }
  return { growerCycle: { kind: 'invalid-grower-cycle', version: 1, reason: 'marker-not-json-safe' } };
}

function compatibility(assessment: GrowerReadyAssessment) {
  const date = assessment.schedule.nurseryStartDate ?? assessment.schedule.fieldEntryDate;
  return { sowMonth: Number(date.slice(5, 7)), once: date.slice(0, 7) };
}
function sameFields(expected: object, claimed: unknown): boolean {
  return record(claimed) && Object.entries(expected).every(([key, value]) => claimed[key] === value);
}

/** Build one proposed canonical row. This function does not write or enable acceptance. */
export function createGrowerCyclePlanting(cycle: GrowerAutoPlanCycle, options: GrowerCycleCreation): GrowerCyclePlanting | null {
  try {
    if (!record(cycle) || !record(cycle.assessment) || cycle.assessment.status !== 'ready'
      || !identity(cycle.cycleId) || !identity(cycle.demandId) || !identity(cycle.bedId)) return null;
    const assessment = reassess(cycle.assessment.snapshot);
    if (!assessment || cycle.assessment.fingerprint !== assessment.fingerprint
      || !sameFields(assessment.capacity, cycle.assessment.capacity)
      || !sameFields(assessment.schedule, cycle.assessment.schedule)
      || cycle.cropKey !== assessment.snapshot.profile.cropKey || cycle.profileId !== assessment.snapshot.profile.profileId
      || growerPlanningScopeKey(cycle.scope) !== growerPlanningScopeKey(assessment.snapshot.scope)) return null;
    // An explicitly supplied origin (even null) is validated; only absence means "not recorded".
    const originField = Object.getOwnPropertyDescriptor(options, 'origin');
    if ((originField || 'origin' in options) && (!originField || !originField.enumerable || !('value' in originField))) return null;
    const attachment = normaliseGrowerCycleAttachment({ kind: 'grower-dated-cycle', version: 1,
      plantingId: options.plantingId, acceptedAt: options.acceptedAt, geometryFingerprint: options.geometryFingerprint,
      cycleId: cycle.cycleId, demandId: cycle.demandId, bedId: cycle.bedId,
      assessmentSnapshot: assessment.snapshot, assessmentFingerprint: assessment.fingerprint,
      ...(originField && originField.value !== undefined ? { origin: originField.value } : originField ? { origin: null } : {}) });
    if (!attachment) return null;
    return freeze({ id: attachment.plantingId, bedId: cycle.bedId, cropKey: cycle.cropKey,
      ...compatibility(assessment), areaFraction: 1, growerCycle: attachment });
  } catch { return null; }
}

/** Only an absent marker is legacy; that result supplies no country approval.
 * Own operational use additionally requires current saved-source identity and
 * geometry. Archived rows remain readable while this derived-use gate holds. */
export function resolvePlantingBasis(value: unknown, context?: GrowerCycleContext | null): PlantingBasisResolution {
  const held = (...reasons: string[]): PlantingBasisResolution => freeze({ kind: 'held', reasons });
  try {
    if (!record(value)) return held('invalid-row');
    if (!hasGrowerCycleMarker(value)) return freeze({ kind: 'legacy' });
    const attachment = normaliseGrowerCycleAttachment(value.growerCycle);
    if (!attachment) return held('invalid-grower-cycle');
    const assessment = reassess(attachment.assessmentSnapshot)!;
    const projected = compatibility(assessment);
    if (value.id !== attachment.plantingId || value.bedId !== attachment.bedId
      || value.cropKey !== assessment.snapshot.profile.cropKey || value.areaFraction !== 1
      || value.sowMonth !== projected.sowMonth || value.once !== projected.once) return held('row-identity');
    if (['existing', 'inNursery', 'confirmedOnceSowing', 'finishedOnceSowing', 'awaitingSowingConfirmation']
      .some(key => value[key] !== undefined)) return held('legacy-lifecycle-flags');
    // A recorded origin governs the row's buyer link: a grower-entered cycle
    // carries none, and a buyer cycle may only name its own target. A buyer link
    // may be absent (target later unlinked); legacy unknown origins are unchanged.
    if (attachment.origin && value.harvestTargetId !== undefined && (attachment.origin.kind !== 'buyer-target'
      || value.harvestTargetId !== attachment.origin.harvestTargetId)) return held('origin-row-mismatch');
    if (!context || !growerPlanningScopeKey(context.scope) || !geometry(context.geometryFingerprint)
      || !Array.isArray(context.beds)) return held('current-geometry-context-required');
    if (growerPlanningScopeKey(context.scope) !== growerPlanningScopeKey(assessment.snapshot.scope)) return held('scope-mismatch');
    if (context.geometryFingerprint !== attachment.geometryFingerprint) return held('geometry-mismatch');
    const adoption = assessment.snapshot.provisionalReview;
    if (adoption) {
      const current = normaliseProvisionalCycleContext(context.provisionalContext);
      if (!current) return held('current-provisional-context-required');
      if (current.knownPlantingRestriction === true || current.countryCode !== adoption.context.countryCode
        || current.agriculturalRegionReference !== adoption.context.agriculturalRegionReference
        || current.policyFingerprint !== adoption.context.policyFingerprint
        || current.knownPlantingRestriction !== adoption.context.knownPlantingRestriction
        || current.sourceFreshness !== adoption.context.sourceFreshness
        || !sameJsonData(current.source, adoption.context.source)) return held('current-provisional-context-mismatch');
    }
    const matches = context.beds.filter(bed => bed && bed.id === attachment.bedId);
    if (matches.length !== 1) return held('missing-or-ambiguous-bed');
    if (!Number.isFinite(matches[0].areaM2) || matches[0].areaM2 < 0
      || matches[0].areaM2 !== assessment.capacity.measuredAreaM2) return held('measured-area-mismatch');
    return freeze({ kind: 'grower-dated-cycle', attachment, assessment,
      reservation: { start: assessment.schedule.fieldEntryDate, endExclusive: assessment.schedule.nextFieldEntryDate } });
  } catch { return held('invalid-grower-cycle'); }
}


/** A foreign claim is not an exemption. Only intact detached row identity and
 * explicit other scope, disjoint from every eligible/held current bed, prove it.
 * Optional in-memory row fields may be undefined; getters are never evaluated. */
export function isProvenForeignGrowerCycle(row: unknown, currentScope: GrowerPlanningScope | null, currentBedIds: ReadonlySet<string>): boolean {
  try {
    if (!jsonSafe(currentScope, new Set(), true)) return false;
    const scope = normaliseGrowerPlanningScope(currentScope);
    if (!scope || !record(row) || !jsonSafe(row, new Set(), true) || !hasGrowerCycleMarker(row)) return false;
    const structural = resolvePlantingBasis(row);
    if (structural.kind !== 'held' || structural.reasons.length !== 1 || structural.reasons[0] !== 'current-geometry-context-required') return false;
    const attachment = normaliseGrowerCycleAttachment(preserveGrowerCycleMarker(row).growerCycle);
    return !!attachment && growerPlanningScopeKey(attachment.assessmentSnapshot.scope) !== growerPlanningScopeKey(scope)
      && !currentBedIds.has(attachment.bedId);
  } catch { return false; }
}
