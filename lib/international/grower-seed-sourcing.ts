import { detachJsonData } from '../lossless-json';
import { reviewSeedPurchaseCounts, type SeedPurchaseCountsReview } from '../seed-purchase-counts';
import { GROWER_AUTOPLAN_MAX_ASSESSMENTS, type GrowerUtcWindow } from './grower-autoplan';
import { isGrowerNurseryForecastCurrent, projectGrowerNurseryPreparation,
  type GrowerNurseryRequest, type GrowerNurseryResult } from './grower-nursery';

export interface GrowerSeedSourcingGroupInput {
  readonly id: string;
  readonly batchIds: readonly string[];
  readonly interchangeabilityConfirmed: boolean;
  /** Entered allocation to this planning review, not observed physical stock. */
  readonly allocatedToPlanSeeds: number | null;
  readonly seedsPerPack?: number | null;
}
export interface GrowerSeedSourcingInput {
  readonly result: unknown;
  /** Caller-provided replay inputs, never proof of live actor/source freshness. */
  readonly currentRequest: unknown;
  readonly groups: unknown;
}
export interface GrowerSeedSourcingGroupReview {
  readonly index: number;
  /** Internal membership handles; a later public export must not include them. */
  readonly id: string | null;
  readonly batchIds: readonly string[];
  readonly status: 'complete' | 'unknown' | 'held' | 'overflow';
  readonly knownRequiredSeedsSubtotal: number | null;
  readonly requiredSeeds: number | null;
  readonly counts: SeedPurchaseCountsReview | null;
  readonly issues: readonly string[];
}
export interface GrowerSeedSourcingReview {
  readonly status: 'available' | 'partial' | 'unavailable';
  readonly basis: 'grower-seed-sourcing-estimates';
  readonly sourceVerification: 'not-verified';
  readonly nurseryReviewStatus: GrowerNurseryResult['status'] | 'unavailable';
  readonly coverage: 'represented-saved-transplant-batches-only';
  readonly wholeFarmCoverage: 'not-assessed';
  readonly horizon: GrowerUtcWindow | null;
  readonly representedBatchCount: number;
  readonly assignedBatchCount: number;
  readonly unassignedBatchIds: readonly string[];
  readonly sourceIssues: readonly string[];
  readonly groups: readonly GrowerSeedSourcingGroupReview[];
  readonly issues: readonly string[];
  readonly guidance: string;
}

const guidance = 'Planning only: represented accepted transplant raising batches, not direct sowings or unresolved, omitted or whole-farm seed demand. Gross seeds come from the canonical nursery calculation; no loss allowance is added again. Group membership and interchangeability are explicit grower assertions, not verified varieties or seed-lot identity. Allocations are entered for this plan, not observed stock or protection against allocating a physical seed pool elsewhere. Unknown quantities are not zero. No package weight, price, purchase, inventory change or actor/source permission is inferred.';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
const unique = (values: readonly string[]) => [...new Set(values)];
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function unavailable(issue: string): GrowerSeedSourcingReview {
  return freeze({ status: 'unavailable', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified',
    nurseryReviewStatus: 'unavailable', coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed',
    horizon: null, representedBatchCount: 0, assignedBatchCount: 0, unassignedBatchIds: [], sourceIssues: [], groups: [], issues: [issue], guidance });
}
interface Candidate {
  index: number; id: string | null; batchIds: string[]; raw: Record<string, unknown> | null; issues: string[];
}
function candidate(raw: unknown, index: number): Candidate {
  const row = object(raw) ? raw : null, id = row && identity(row.id) ? row.id : null;
  // Read every safe candidate membership before rejecting a malformed group:
  // another group must not win an overlap merely because this one appears later.
  const batchIds = row && Array.isArray(row.batchIds) ? row.batchIds.filter(identity) : [];
  const issues: string[] = [];
  const allowed = ['id', 'batchIds', 'interchangeabilityConfirmed', 'allocatedToPlanSeeds', 'seedsPerPack'];
  if (!row || !id || Object.keys(row).some(key => !allowed.includes(key))
    || !Array.isArray(row.batchIds) || !row.batchIds.length || row.batchIds.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS
    || batchIds.length !== row.batchIds.length || !Object.hasOwn(row, 'allocatedToPlanSeeds')) issues.push('group-input-invalid');
  if (row?.interchangeabilityConfirmed !== true) issues.push('interchangeability-not-confirmed');
  if (new Set(batchIds).size !== batchIds.length) issues.push('batch-membership-duplicate');
  return { index, id, batchIds, raw: row, issues };
}

/** A detached planning projection, not a ledger, current-source reader, write
 * receipt or purchasing action. The caller must retain its real source lease. */
export function reviewGrowerSeedSourcing(input: GrowerSeedSourcingInput): GrowerSeedSourcingReview {
  try {
    // Use detachment as a descriptor-safety probe, not as a replacement source.
    // Canonical nursery readers must still see original undefined marker presence;
    // harmless optional DTO fields may follow ordinary JSON omission.
    detachJsonData(input, { allowUndefinedObjectFields: true });
    if (!object(input) || !object(input.result) || !object(input.currentRequest)
      || !object(input.currentRequest.source) || input.currentRequest.source.kind !== 'saved-cycles'
      || input.result.sourceStatus !== 'saved-planned' || !Array.isArray(input.groups)
      || input.groups.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) return unavailable('saved-nursery-source-unavailable');
    const result = input.result as unknown as GrowerNurseryResult;
    if (!isGrowerNurseryForecastCurrent(result, input.currentRequest as unknown as GrowerNurseryRequest)) {
      return unavailable('nursery-replay-mismatch');
    }
    const preparation = projectGrowerNurseryPreparation(result);
    if (preparation.status !== 'available' || preparation.sourceStatus !== 'saved-planned') return unavailable('nursery-preparation-unavailable');
    const batches = new Map(result.batches.map(batch => [batch.id, batch]));
    const references = new Map(preparation.groups.flatMap(group => group.members.map(member => [member.batchId, member.reference] as const)));
    const candidates = input.groups.map(candidate), groupIds = new Map<string, Candidate[]>(), memberships = new Map<string, Candidate[]>();
    for (const row of candidates) {
      if (row.id) groupIds.set(row.id, [...(groupIds.get(row.id) ?? []), row]);
      for (const id of new Set(row.batchIds)) memberships.set(id, [...(memberships.get(id) ?? []), row]);
    }
    for (const entries of groupIds.values()) if (entries.length > 1) for (const row of entries) row.issues.push('group-id-duplicate');
    for (const entries of memberships.values()) if (entries.length > 1) for (const row of entries) row.issues.push('batch-membership-overlap');

    const assigned = new Set<string>();
    const groups = candidates.map((row): GrowerSeedSourcingGroupReview => {
      for (const id of row.batchIds) {
        if (!batches.has(id)) row.issues.push('batch-not-in-current-review');
        else if (references.get(id)?.status !== 'ready') row.issues.push('batch-reference-held');
      }
      const held = (): GrowerSeedSourcingGroupReview => ({ index: row.index, id: row.id, batchIds: [...row.batchIds], status: 'held',
        knownRequiredSeedsSubtotal: null, requiredSeeds: null, counts: null, issues: unique(row.issues) });
      if (row.issues.length) return held();
      let sum = BigInt(0), known = 0, unknown = false;
      for (const id of row.batchIds) {
        const seeds = batches.get(id)!.seeds;
        if (seeds === null) unknown = true;
        else { sum += BigInt(seeds); ++known; }
      }
      const overflow = sum > BigInt(Number.MAX_SAFE_INTEGER);
      const requiredSeeds = overflow || unknown ? null : Number(sum);
      const counts = reviewSeedPurchaseCounts(requiredSeeds, row.raw!.allocatedToPlanSeeds, row.raw!.seedsPerPack);
      if (counts.status === 'invalid') { row.issues.push('allocation-or-pack-count-invalid'); return held(); }
      if (overflow) row.issues.push('seed-requirement-overflow');
      if (unknown) row.issues.push('seed-requirement-unknown');
      if (counts.status === 'unknown' && (row.raw!.allocatedToPlanSeeds == null || row.raw!.seedsPerPack == null)) {
        row.issues.push('allocation-or-pack-count-unknown');
      }
      if (counts.status === 'overflow') row.issues.push('pack-count-product-overflow');
      // Assignment is a disjoint planning association even when its quantity is
      // unknown. Held groups never acquire that association.
      for (const id of row.batchIds) assigned.add(id);
      return { index: row.index, id: row.id, batchIds: [...row.batchIds],
        status: overflow || counts.status === 'overflow' ? 'overflow' : counts.status,
        knownRequiredSeedsSubtotal: overflow || known === 0 ? null : Number(sum), requiredSeeds,
        counts: overflow ? null : counts, issues: unique(row.issues) };
    });
    const unassignedBatchIds = result.batches.map(batch => batch.id).filter(id => !assigned.has(id));
    const issues = [...preparation.issues];
    if (unassignedBatchIds.length) issues.push('represented-batches-unassigned');
    if (!batches.size) issues.push('no-represented-transplant-batches');
    if (groups.some(group => group.status === 'held')) issues.push('sourcing-groups-held');
    if (groups.some(group => group.status === 'unknown' || group.status === 'overflow')) issues.push('sourcing-counts-incomplete');
    const incomplete = preparation.projectionIncomplete || unassignedBatchIds.length > 0 || !batches.size
      || groups.some(group => group.status !== 'complete');
    return freeze({ status: incomplete ? 'partial' : 'available', basis: 'grower-seed-sourcing-estimates', sourceVerification: 'not-verified',
      nurseryReviewStatus: result.status, coverage: 'represented-saved-transplant-batches-only', wholeFarmCoverage: 'not-assessed',
      horizon: preparation.horizon ? { ...preparation.horizon } : null, representedBatchCount: batches.size, assignedBatchCount: assigned.size,
      unassignedBatchIds, sourceIssues: [...preparation.issues], groups, issues: unique(issues), guidance });
  } catch { return unavailable('seed-sourcing-input-unreadable'); }
}
