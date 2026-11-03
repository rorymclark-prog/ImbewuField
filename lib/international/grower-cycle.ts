import type { PlanBed, Planting } from '../crop-plan';
import type { GrowerAutoPlanCycle, GrowerReadyAssessment } from './grower-autoplan';
import {
  assessGrowerPlanning, growerPlanningScopeKey, isGrowerRecordedAt, normaliseGrowerPlanningScope,
  type GrowerPlanningScope, type GrowerPlanningSnapshot,
} from './grower-planning';

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
}
export type GrowerCyclePlanting = Planting & { readonly growerCycle: GrowerCycleAttachment };
export interface GrowerCycleCreation {
  /** The coordinator supplies a persistent identity; engine ordinals are review-local. */
  readonly plantingId: string;
  readonly acceptedAt: string;
  readonly geometryFingerprint: string;
}
export interface GrowerCycleContext {
  readonly scope: GrowerPlanningScope | null;
  /** All beds in this current saved source, so duplicate identities cannot pick a winner. */
  readonly beds: readonly PlanBed[];
  readonly geometryFingerprint: string | null;
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
function reassess(snapshot: unknown): GrowerReadyAssessment | null {
  if (!record(snapshot)) return null;
  const result = assessGrowerPlanning({ profile: snapshot.profile, scope: snapshot.scope,
    measuredAreaM2: snapshot.measuredAreaM2, fieldEntryDate: snapshot.fieldEntryDate });
  return result.status === 'ready' ? result : null;
}

/** Parse detached inputs and recompute through the one existing arithmetic authority. */
export function normaliseGrowerCycleAttachment(value: unknown): GrowerCycleAttachment | null {
  try {
    if (!record(value) || value.kind !== 'grower-dated-cycle' || value.version !== 1
      || !identity(value.plantingId) || value.plantingId.length > 200 || !identity(value.cycleId)
      || !identity(value.demandId) || !identity(value.bedId) || !isGrowerRecordedAt(value.acceptedAt)
      || !geometry(value.geometryFingerprint) || typeof value.assessmentFingerprint !== 'string') return null;
    const assessment = reassess(value.assessmentSnapshot);
    if (!assessment || assessment.fingerprint !== value.assessmentFingerprint) return null;
    return freeze({ kind: 'grower-dated-cycle', version: 1, plantingId: value.plantingId,
      cycleId: value.cycleId, demandId: value.demandId, bedId: value.bedId,
      acceptedAt: value.acceptedAt, geometryFingerprint: value.geometryFingerprint,
      assessmentSnapshot: assessment.snapshot, assessmentFingerprint: assessment.fingerprint });
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
    return typeof key === 'string' && !!property && 'value' in property && jsonSafe(property.value, parents, allowUndefined);
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
    const attachment = normaliseGrowerCycleAttachment({ kind: 'grower-dated-cycle', version: 1,
      plantingId: options.plantingId, acceptedAt: options.acceptedAt, geometryFingerprint: options.geometryFingerprint,
      cycleId: cycle.cycleId, demandId: cycle.demandId, bedId: cycle.bedId,
      assessmentSnapshot: assessment.snapshot, assessmentFingerprint: assessment.fingerprint });
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
    if (!context || !growerPlanningScopeKey(context.scope) || !geometry(context.geometryFingerprint)
      || !Array.isArray(context.beds)) return held('current-geometry-context-required');
    if (growerPlanningScopeKey(context.scope) !== growerPlanningScopeKey(assessment.snapshot.scope)) return held('scope-mismatch');
    if (context.geometryFingerprint !== attachment.geometryFingerprint) return held('geometry-mismatch');
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
