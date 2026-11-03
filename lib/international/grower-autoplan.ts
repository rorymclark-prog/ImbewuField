import type { PlanBed } from '../crop-plan';
import {
  addGrowerUtcDays, assessGrowerPlanning, growerPlanningScopeKey, isGrowerRecordedAt, isGrowerUtcDate,
  normaliseGrowerInput, normaliseGrowerPlanningProfiles, normaliseGrowerPlanningScope,
  type GrowerInput, type GrowerPlanningAssessment, type GrowerPlanningProfile, type GrowerPlanningScope,
} from './grower-planning';

/** Software ceilings only; neither is an agronomic duration or a default input. */
export const GROWER_AUTOPLAN_MAX_HORIZON_DAYS = 3660;
export const GROWER_AUTOPLAN_MAX_ASSESSMENTS = 10_000;

export interface GrowerUtcWindow {
  readonly start: string;
  readonly endExclusive: string;
}
export type GrowerWindowInput = GrowerInput<GrowerUtcWindow, 'utc-date-window'>;

export interface GrowerAutoPlanBed {
  readonly bed: Readonly<PlanBed>;
  readonly scope: GrowerPlanningScope;
  readonly measuredAreaM2: GrowerInput<number, 'm2'>;
}
export interface GrowerBedAvailability {
  readonly bedId: string;
  readonly scope: GrowerPlanningScope;
  /** A grower asserts this interval is available; omission never means free. */
  readonly window: GrowerWindowInput;
}
export interface GrowerBedReservation extends GrowerBedAvailability {
  readonly id: string;
}
export interface GrowerAutoPlanDemand {
  readonly demandId: string;
  readonly profileId: string;
  readonly scope: GrowerPlanningScope;
  readonly totalKg: GrowerInput<number, 'kg-total'>;
  readonly harvestWindow: GrowerWindowInput;
}
export interface GrowerAutoPlanRequest {
  readonly requestedAt: string;
  readonly scope: GrowerPlanningScope;
  /** From the actual selected saved source; bed area alone cannot detect a moved polygon. */
  readonly geometryFingerprint: string;
  readonly profiles: readonly GrowerPlanningProfile[];
  readonly beds: readonly GrowerAutoPlanBed[];
  readonly planningStart: GrowerInput<string, 'utc-date'>;
  readonly planningEndExclusive: GrowerInput<string, 'utc-date'>;
  readonly availability: readonly GrowerBedAvailability[];
  readonly reserved: readonly GrowerBedReservation[];
  /** Priority order is intentional; do not sort these targets. */
  readonly demands: readonly GrowerAutoPlanDemand[];
  /** Explicit search budget, also charging input rows and skipped availability windows. */
  readonly maxAssessments: number;
}
export type GrowerAutoPlanSnapshot = GrowerAutoPlanRequest;
export type GrowerReadyAssessment = Extract<GrowerPlanningAssessment, { status: 'ready' }>;

export interface GrowerAutoPlanCycle {
  /** Review-local ordinal, not a persistent crop-cycle ledger identity. */
  readonly cycleId: string;
  readonly demandId: string;
  readonly profileId: string;
  readonly cropKey: string;
  readonly bedId: string;
  readonly scope: GrowerPlanningScope;
  readonly requestFingerprint: string;
  readonly fingerprint: string;
  readonly assessment: GrowerReadyAssessment;
}
export interface GrowerAutoPlanDemandResult {
  readonly demandId: string;
  readonly profileId: string;
  readonly status: 'capacity-covered' | 'capacity-gap' | 'zero-demand' | 'held';
  readonly requestedKg: number | null;
  readonly estimatedAllocatedKg: number | null;
  readonly unmetKg: number | null;
  readonly excessEstimatedKg: number | null;
  readonly reasons: readonly string[];
}
interface ProposalBasis {
  readonly basis: 'grower-input-cycle-capacity';
  readonly sourceVerification: 'not-verified';
  readonly evaluationsUsed: number;
}
export type GrowerAutoPlanProposal = ProposalBasis & (
  | { readonly status: 'ready' | 'with-gaps'; readonly snapshot: GrowerAutoPlanSnapshot; readonly fingerprint: string;
      readonly cycles: readonly GrowerAutoPlanCycle[]; readonly demandResults: readonly GrowerAutoPlanDemandResult[]; readonly issues: readonly string[] }
  | { readonly status: 'invalid-inputs' | 'missing-inputs' | 'work-limit-exceeded'; readonly snapshot: GrowerAutoPlanSnapshot | null;
      readonly fingerprint: string | null; readonly cycles: readonly []; readonly demandResults: readonly GrowerAutoPlanDemandResult[]; readonly issues: readonly string[] }
);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function identity(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
}
const nonNegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function windowInput(value: unknown): GrowerWindowInput | null {
  const parsed = normaliseGrowerInput(value, 'utc-date-window', (row): row is GrowerUtcWindow => record(row)
    && isGrowerUtcDate(row.start) && isGrowerUtcDate(row.endExclusive) && row.start < row.endExclusive);
  // The shared generic parser validates provenance, but this nested value is ours to
  // detach. Freezing a caller's window would mutate its editor even without a write.
  return parsed?.state === 'provided' ? { ...parsed, value: { start: parsed.value.start, endExclusive: parsed.value.endExclusive } } : parsed;
}
function bedInput(value: unknown): GrowerAutoPlanBed | null {
  if (!record(value) || !record(value.bed)) return null;
  const row = value.bed;
  const scope = normaliseGrowerPlanningScope(value.scope);
  const measuredAreaM2 = normaliseGrowerInput(value.measuredAreaM2, 'm2', nonNegative);
  if (!scope || !measuredAreaM2 || !identity(row.id) || !identity(row.label) || !nonNegative(row.areaM2)
    || (row.minDimM !== undefined && !nonNegative(row.minDimM))
    || (row.kind !== undefined && row.kind !== 'bed' && row.kind !== 'plot')
    || (measuredAreaM2.state === 'provided' && measuredAreaM2.value !== row.areaM2)) return null;
  return { scope, bed: { id: row.id, label: row.label, areaM2: row.areaM2,
    ...(row.minDimM === undefined ? {} : { minDimM: row.minDimM as number }),
    ...(row.kind === undefined ? {} : { kind: row.kind as 'bed' | 'plot' }) }, measuredAreaM2 };
}
function availabilityInput(value: unknown): GrowerBedAvailability | null {
  if (!record(value) || !identity(value.bedId)) return null;
  const scope = normaliseGrowerPlanningScope(value.scope), window = windowInput(value.window);
  return scope && window ? { bedId: value.bedId, scope, window } : null;
}
function reservationInput(value: unknown): GrowerBedReservation | null {
  if (!record(value) || !identity(value.id)) return null;
  const parsed = availabilityInput(value);
  return parsed ? { id: value.id, ...parsed } : null;
}
function demandInput(value: unknown): GrowerAutoPlanDemand | null {
  if (!record(value) || !identity(value.demandId) || !identity(value.profileId)) return null;
  const scope = normaliseGrowerPlanningScope(value.scope);
  const totalKg = normaliseGrowerInput(value.totalKg, 'kg-total', nonNegative), harvestWindow = windowInput(value.harvestWindow);
  return scope && totalKg && harvestWindow ? { demandId: value.demandId, profileId: value.profileId, scope, totalKg, harvestWindow } : null;
}
const basis = { basis: 'grower-input-cycle-capacity' as const, sourceVerification: 'not-verified' as const };
class WorkLimit extends Error {}

/** Deterministic first-fit whole-bed cycles. This is total cycle capacity, never
 * weekly deliveries, local suitability or an assertion that an unlisted bed is free. */
export function generateGrowerAutoPlan(value: unknown): GrowerAutoPlanProposal {
  let snapshot: GrowerAutoPlanSnapshot | null = null, fingerprint: string | null = null, used = 0;
  const held = (status: 'invalid-inputs' | 'missing-inputs' | 'work-limit-exceeded', issues: readonly string[]): GrowerAutoPlanProposal => freeze({
    ...basis, status, snapshot, fingerprint, evaluationsUsed: used, cycles: [], issues,
    demandResults: snapshot?.demands.map(demand => ({ demandId: demand.demandId, profileId: demand.profileId, status: 'held' as const,
      requestedKg: demand.totalKg.state === 'provided' ? demand.totalKg.value : null,
      estimatedAllocatedKg: null, unmetKg: null, excessEstimatedKg: null, reasons: issues })) ?? [],
  });
  if (!record(value)) return held('invalid-inputs', ['request']);
  const lists = ['profiles', 'beds', 'availability', 'reserved', 'demands'] as const;
  if (lists.some(key => !Array.isArray(value[key]))) return held('invalid-inputs', ['request-lists']);
  const budget = value.maxAssessments;
  if (!Number.isSafeInteger(budget) || typeof budget !== 'number' || budget < 1 || budget > GROWER_AUTOPLAN_MAX_ASSESSMENTS) {
    return held('invalid-inputs', ['maxAssessments']);
  }
  const rowCount = lists.reduce((sum, key) => sum + (value[key] as unknown[]).length, 0);
  if (rowCount > budget) return held('work-limit-exceeded', ['input-row-limit']);
  used = rowCount;
  const spend = () => { if (used >= budget) throw new WorkLimit(); used++; };
  const scope = normaliseGrowerPlanningScope(value.scope);
  const profiles = normaliseGrowerPlanningProfiles(value.profiles).sort((a, b) => compare(a.profileId, b.profileId));
  const beds = (value.beds as unknown[]).map(bedInput);
  const availability = (value.availability as unknown[]).map(availabilityInput);
  const reserved = (value.reserved as unknown[]).map(reservationInput);
  const demands = (value.demands as unknown[]).map(demandInput);
  const planningStart = normaliseGrowerInput(value.planningStart, 'utc-date', isGrowerUtcDate);
  const planningEndExclusive = normaliseGrowerInput(value.planningEndExclusive, 'utc-date', isGrowerUtcDate);
  const invalid = [!scope && 'scope', profiles.length !== (value.profiles as unknown[]).length && 'profiles',
    beds.some(row => !row) && 'beds', availability.some(row => !row) && 'availability', reserved.some(row => !row) && 'reserved',
    demands.some(row => !row) && 'demands', !planningStart && 'planningStart', !planningEndExclusive && 'planningEndExclusive',
    !isGrowerRecordedAt(value.requestedAt) && 'requestedAt',
    (typeof value.geometryFingerprint !== 'string' || !value.geometryFingerprint) && 'geometryFingerprint'].filter(Boolean) as string[];
  if (invalid.length || !scope || !planningStart || !planningEndExclusive) return held('invalid-inputs', invalid);
  const knownBeds = beds as GrowerAutoPlanBed[], knownAvailability = availability as GrowerBedAvailability[];
  const knownReserved = reserved as GrowerBedReservation[], knownDemands = demands as GrowerAutoPlanDemand[];
  const duplicate = (ids: string[]) => new Set(ids).size !== ids.length;
  if (duplicate(knownBeds.map(row => row.bed.id)) || duplicate(knownReserved.map(row => row.id)) || duplicate(knownDemands.map(row => row.demandId))) {
    return held('invalid-inputs', ['ambiguous-identities']);
  }
  const scopeKey = growerPlanningScopeKey(scope);
  const sameScope = (row: { scope: GrowerPlanningScope }) => growerPlanningScopeKey(row.scope) === scopeKey;
  const bedIds = new Set(knownBeds.map(row => row.bed.id));
  const profileById = new Map(profiles.map(profile => [profile.profileId, profile]));
  if (![...knownBeds, ...knownAvailability, ...knownReserved, ...knownDemands].every(sameScope)
    || [...knownAvailability, ...knownReserved].some(row => !bedIds.has(row.bedId))
    || knownDemands.some(row => !profileById.has(row.profileId) || !sameScope(profileById.get(row.profileId)!))) {
    return held('invalid-inputs', ['scope-or-source-identity']);
  }
  const canonicalRows = <T>(rows: T[]) => rows.sort((a, b) => compare(JSON.stringify(a), JSON.stringify(b)));
  snapshot = freeze({ requestedAt: value.requestedAt as string, scope, geometryFingerprint: value.geometryFingerprint as string,
    profiles, beds: knownBeds.sort((a, b) => compare(a.bed.id, b.bed.id)), planningStart, planningEndExclusive,
    availability: canonicalRows(knownAvailability), reserved: canonicalRows(knownReserved), demands: knownDemands, maxAssessments: budget });
  fingerprint = JSON.stringify(snapshot);
  const missing: string[] = [];
  if (planningStart.state === 'missing') missing.push('planningStart');
  if (planningEndExclusive.state === 'missing') missing.push('planningEndExclusive');
  for (const row of knownAvailability) if (row.window.state === 'missing') missing.push(`availability:${row.bedId}`);
  for (const row of knownReserved) if (row.window.state === 'missing') missing.push(`reserved:${row.id}`);
  for (const demand of knownDemands) {
    if (demand.totalKg.state === 'missing') missing.push(`demand:${demand.demandId}:totalKg`);
    // A known zero target needs no invented timings or date window to mean no cycles.
    if (demand.totalKg.state === 'provided' && demand.totalKg.value > 0 && demand.harvestWindow.state === 'missing') missing.push(`demand:${demand.demandId}:harvestWindow`);
  }
  if (missing.length || planningStart.state !== 'provided' || planningEndExclusive.state !== 'provided') return held('missing-inputs', missing);
  const start = planningStart.value, end = planningEndExclusive.value;
  if (start >= end) return held('invalid-inputs', ['planning-horizon']);
  if ((Date.parse(end) - Date.parse(start)) / 86_400_000 > GROWER_AUTOPLAN_MAX_HORIZON_DAYS) return held('work-limit-exceeded', ['horizon-limit']);
  const positive = knownDemands.filter(row => row.totalKg.state === 'provided' && row.totalKg.value > 0);
  if (positive.length && !knownBeds.length) return held('missing-inputs', ['measured-beds']);
  const generatedDate = (date: string): GrowerInput<string, 'utc-date'> => ({ state: 'provided', value: date, unit: 'utc-date',
    provenance: { kind: 'grower-estimate', recordedAt: snapshot!.requestedAt,
      note: 'Automatically selected from this request’s grower inputs; not an observed entry.' } });
  const assess = (profile: GrowerPlanningProfile, bed: GrowerAutoPlanBed, date: string) => {
    spend();
    return assessGrowerPlanning({ profile, scope, measuredAreaM2: bed.measuredAreaM2, fieldEntryDate: generatedDate(date) });
  };
  try {
    const checked = new Set<string>();
    for (const demand of positive) {
      for (const bed of knownBeds) {
        const id = JSON.stringify([demand.profileId, bed.bed.id]);
        if (checked.has(id)) continue;
        checked.add(id);
        const result = assess(profileById.get(demand.profileId)!, bed, start);
        if (result.status === 'missing-inputs') missing.push(...result.issues.map(issue => `${demand.profileId}:${bed.bed.id}:${issue}`));
        else if (result.status === 'invalid-inputs' || result.status === 'scope-mismatch') return held('invalid-inputs', result.issues);
      }
    }
    if (missing.length) return held('missing-inputs', missing);
    type Occupied = { bedId: string; start: string; endExclusive: string };
    const occupied: Occupied[] = knownReserved.map(row => ({ bedId: row.bedId,
      start: row.window.state === 'provided' ? row.window.value.start : '', endExclusive: row.window.state === 'provided' ? row.window.value.endExclusive : '' }));
    const cycles: GrowerAutoPlanCycle[] = [], demandResults: GrowerAutoPlanDemandResult[] = [];
    function findCandidate(demand: GrowerAutoPlanDemand, bed: GrowerAutoPlanBed, reasons: Set<string>, notBefore = start): GrowerReadyAssessment | null {
      const profile = profileById.get(demand.profileId)!;
      const monthInput = profile.inputs.allowedEntryMonths;
      if (monthInput.state !== 'provided' || !monthInput.value.length) { reasons.add('own-entry-month-window'); return null; }
      const windows = knownAvailability.filter(row => row.bedId === bed.bed.id && row.window.state === 'provided')
        .map(row => (row.window as Extract<GrowerWindowInput, { state: 'provided' }>).value)
        .sort((a, b) => compare(a.start, b.start) || compare(a.endExclusive, b.endExclusive));
      if (!windows.length) reasons.add('no-asserted-availability');
      const target = (demand.harvestWindow as Extract<GrowerWindowInput, { state: 'provided' }>).value;
      for (const window of windows) {
        spend();
        let cursor: string | null = [window.start, start, notBefore].sort(compare).at(-1)!;
        const finish = window.endExclusive < end ? window.endExclusive : end;
        while (cursor && cursor < finish) {
          // Leap over disallowed calendar months without inventing a sowing window.
          if (!monthInput.value.includes(Number(cursor.slice(5, 7)))) {
            const nextMonth = addGrowerUtcDays(`${cursor.slice(0, 7)}-01`, 32);
            cursor = nextMonth ? `${nextMonth.slice(0, 7)}-01` : null;
            continue;
          }
          const result = assess(profile, bed, cursor);
          if (result.status !== 'ready') { reasons.add(result.status); return null; }
          if (result.capacity.estimatedYieldKg === 0 || result.capacity.estimatedPlantCount === 0) {
            reasons.add('zero-estimated-cycle-capacity'); return null;
          }
          const dates = result.schedule;
          if (dates.nurseryStartDate && dates.nurseryStartDate < start) {
            reasons.add('nursery-before-planning-start');
            cursor = addGrowerUtcDays(cursor, (Date.parse(start) - Date.parse(dates.nurseryStartDate)) / 86_400_000);
            continue;
          }
          if (dates.firstHarvestDate < target.start) {
            cursor = addGrowerUtcDays(cursor, (Date.parse(target.start) - Date.parse(dates.firstHarvestDate)) / 86_400_000);
            continue;
          }
          if (dates.harvestEndExclusiveDate > target.endExclusive) { reasons.add('harvest-window'); break; }
          if (dates.nextFieldEntryDate > finish) { reasons.add('availability-or-horizon'); break; }
          const overlaps = occupied.filter(row => row.bedId === bed.bed.id && cursor! < row.endExclusive && dates.nextFieldEntryDate > row.start);
          if (overlaps.length) {
            reasons.add('reserved-interval'); cursor = overlaps.map(row => row.endExclusive).sort(compare).at(-1)!; continue;
          }
          return result;
        }
      }
      reasons.add('no-fitting-available-cycle');
      return null;
    }
    for (const demand of knownDemands) {
      const requestedKg = (demand.totalKg as Extract<GrowerAutoPlanDemand['totalKg'], { state: 'provided' }>).value;
      if (requestedKg === 0) {
        demandResults.push({ demandId: demand.demandId, profileId: demand.profileId, status: 'zero-demand', requestedKg,
          estimatedAllocatedKg: 0, unmetKg: 0, excessEstimatedKg: 0, reasons: [] }); continue;
      }
      const reasons = new Set<string>();
      const candidates = new Map<string, GrowerReadyAssessment>();
      for (const bed of knownBeds) { const candidate = findCandidate(demand, bed, reasons); if (candidate) candidates.set(bed.bed.id, candidate); }
      let estimatedAllocatedKg = 0;
      while (estimatedAllocatedKg < requestedKg && candidates.size) {
        const [bedId, assessment] = [...candidates].sort((a, b) => compare(a[1].schedule.fieldEntryDate, b[1].schedule.fieldEntryDate) || compare(a[0], b[0]))[0];
        const total = estimatedAllocatedKg + assessment.capacity.estimatedYieldKg;
        if (!Number.isFinite(total) || total === estimatedAllocatedKg) return held('invalid-inputs', ['capacity-sum-range']);
        estimatedAllocatedKg = total;
        cycles.push({ cycleId: `grower-cycle:${cycles.length + 1}`, demandId: demand.demandId, profileId: demand.profileId,
          cropKey: assessment.snapshot.profile.cropKey, bedId, scope, requestFingerprint: fingerprint!,
          fingerprint: JSON.stringify([fingerprint, demand.demandId, bedId, assessment.fingerprint]), assessment });
        occupied.push({ bedId, start: assessment.schedule.fieldEntryDate, endExclusive: assessment.schedule.nextFieldEntryDate });
        candidates.delete(bedId);
        if (estimatedAllocatedKg < requestedKg) {
          const next = findCandidate(demand, knownBeds.find(row => row.bed.id === bedId)!, reasons, assessment.schedule.nextFieldEntryDate);
          if (next) candidates.set(bedId, next);
        }
      }
      const unmetKg = Math.max(0, requestedKg - estimatedAllocatedKg);
      demandResults.push({ demandId: demand.demandId, profileId: demand.profileId, status: unmetKg > 0 ? 'capacity-gap' : 'capacity-covered',
        requestedKg, estimatedAllocatedKg, unmetKg, excessEstimatedKg: Math.max(0, estimatedAllocatedKg - requestedKg),
        reasons: unmetKg > 0 ? [...new Set([...reasons, 'insufficient-cycle-capacity'])].sort(compare) : [] });
    }
    return freeze({ ...basis, status: demandResults.some(row => row.status === 'capacity-gap') ? 'with-gaps' : 'ready',
      evaluationsUsed: used, snapshot, fingerprint: fingerprint!, cycles, demandResults, issues: [] });
  } catch (error) {
    if (error instanceof WorkLimit) return held('work-limit-exceeded', ['search-budget']);
    throw error;
  }
}

export function isGrowerAutoPlanCurrent(proposal: GrowerAutoPlanProposal, request: unknown): boolean {
  if (proposal.status !== 'ready' && proposal.status !== 'with-gaps') return false;
  const fresh = generateGrowerAutoPlan(request);
  return (fresh.status === 'ready' || fresh.status === 'with-gaps') && proposal.fingerprint === fresh.fingerprint;
}
