import { cropByKey } from '../crop-catalog';
import { knownVegetativePropagationUnit } from '../crop-plan';
import { detachJsonData } from '../lossless-json';
import { reviewSeedPurchaseCounts, type SeedPurchaseCountsReview } from '../seed-purchase-counts';
import { GROWER_AUTOPLAN_MAX_ASSESSMENTS, type GrowerUtcWindow } from './grower-autoplan';
import { isGrowerNurseryForecastCurrent, projectGrowerNurseryPreparation,
  type GrowerNurseryRequest, type GrowerNurseryResult } from './grower-nursery';
import type { GrowerCycleContext } from './grower-cycle';
import { projectGrowerCycles } from './grower-cycle-projection';

export interface GrowerSeedSourcingGroupInput {
  readonly id: string;
  readonly label?: string;
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
  readonly identification: {
    readonly enteredLabel: string | null;
    readonly labelStatus: 'provided' | 'not-recorded' | 'invalid';
    readonly cropNames: readonly string[];
    readonly cropIdentityCount: number | null;
    readonly cropStatus: 'complete' | 'incomplete' | 'unavailable';
    readonly description: string;
  };
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
function enteredLabel(row: Record<string, unknown> | null): Pick<GrowerSeedSourcingGroupReview['identification'], 'enteredLabel' | 'labelStatus'> {
  if (!row || !Object.hasOwn(row, 'label') || row.label === undefined) return { enteredLabel: null, labelStatus: 'not-recorded' };
  return typeof row.label === 'string'
    ? { enteredLabel: row.label, labelStatus: row.label.trim() ? 'provided' : 'not-recorded' }
    : { enteredLabel: null, labelStatus: 'invalid' };
}
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
  const allowed = ['id', 'label', 'batchIds', 'interchangeabilityConfirmed', 'allocatedToPlanSeeds', 'seedsPerPack'];
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

    const batchCropKeys = new Map<string, string>();
    for (const prepGroup of preparation.groups) {
      for (const member of prepGroup.members) {
        batchCropKeys.set(member.batchId, prepGroup.cropKey);
      }
    }

    const assigned = new Set<string>();
    const groups = candidates.map((row): GrowerSeedSourcingGroupReview => {
      const label = enteredLabel(row.raw);
      const labelStatus = label.labelStatus;

      const knownCropKeys = new Set<string>();
      const safeCropNames = new Set<string>();
      let anyUnresolvedCrop = false;

      for (const id of row.batchIds) {
        const ref = references.get(id);
        const cropKey = batchCropKeys.get(id);
        if (ref?.status === 'ready' && cropKey) {
          knownCropKeys.add(cropKey);
          const def = cropByKey(cropKey);
          if (def && typeof def.name === 'string' && def.name.trim() !== '') {
            safeCropNames.add(def.name);
          } else {
            anyUnresolvedCrop = true;
          }
        } else {
          anyUnresolvedCrop = true;
        }
      }

      const cropNames = [...safeCropNames].sort((a, b) => a.localeCompare(b));
      let cropStatus: 'complete' | 'incomplete' | 'unavailable' = 'unavailable';
      let cropIdentityCount: number | null = null;

      if (row.batchIds.length > 0) {
        if (!anyUnresolvedCrop && cropNames.length > 0) {
          cropStatus = 'complete';
          cropIdentityCount = knownCropKeys.size;
        } else if (cropNames.length > 0) {
          cropStatus = 'incomplete';
          cropIdentityCount = null;
        } else {
          cropStatus = 'unavailable';
          cropIdentityCount = null;
        }
      }

      const descParts: string[] = [];
      if (labelStatus === 'not-recorded') {
        descParts.push('Supply group label not recorded.');
      } else if (labelStatus === 'invalid') {
        descParts.push('Supply group label is invalid.');
      }

      if (cropStatus === 'unavailable') {
        descParts.push('Crop identification unavailable for selected batches.');
      } else if (cropStatus === 'incomplete') {
        descParts.push('Crop identification incomplete; some selected batch references need review.');
      }

      if (knownCropKeys.size > 1) {
        descParts.push('Multiple crop identities selected for this seed supply group.');
      }

      descParts.push('Crop names and grower confirmation do not verify interchangeable varieties or seed lots.');
      const description = descParts.join(' ');

      const identification = {
        enteredLabel: label.enteredLabel,
        labelStatus,
        cropNames,
        cropIdentityCount,
        cropStatus,
        description,
      };

      for (const id of row.batchIds) {
        if (!batches.has(id)) row.issues.push('batch-not-in-current-review');
        else if (references.get(id)?.status !== 'ready') row.issues.push('batch-reference-held');
      }
      const held = (): GrowerSeedSourcingGroupReview => ({ index: row.index, id: row.id, batchIds: [...row.batchIds], status: 'held',
        knownRequiredSeedsSubtotal: null, requiredSeeds: null, counts: null, issues: unique(row.issues), identification });
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
        counts: overflow ? null : counts, issues: unique(row.issues), identification };
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

export interface GrowerFieldSeedRequirementInput {
  readonly plantingId: string;
  readonly materialDeclaration: 'botanical-seed' | 'vegetative' | null;
  readonly grossRequiredSeeds: number | null;
  readonly grossRequirementConfirmed: boolean;
}
export interface GrowerFieldSeedSourcingGroupInput {
  readonly id: string;
  readonly label?: string;
  readonly plantingIds: readonly string[];
  readonly interchangeabilityConfirmed: boolean;
  readonly allocatedToPlanSeeds: number | null;
  readonly seedsPerPack?: number | null;
}
export interface GrowerFieldSeedSourcingInput {
  readonly rows: unknown;
  readonly cycleContext: GrowerCycleContext | null;
  readonly requirements: unknown;
  readonly groups: unknown;
}
export interface GrowerFieldSeedCycleOption {
  /** Internal selection handle only; never a public worksheet field. */
  readonly plantingId: string;
  readonly cropName: string;
  readonly plannedFieldEntryDate: string | null;
  readonly knownMaterialUnit: string | null;
  /** Eligible for an explicit declaration, never automatic botanical approval. */
  readonly status: 'eligible' | 'held';
  readonly reasons: readonly string[];
}
export interface GrowerFieldSeedSourcingGroupReview extends Omit<GrowerSeedSourcingGroupReview, 'batchIds'> {
  /** Internal association handles; the exporter uses public counts only. */
  readonly plantingIds: readonly string[];
  readonly selectedCycleCount: number;
  /** Public worksheet numbers of the represented cycles this group selects, in
   * ascending order. Null when membership is held (malformed, duplicated group
   * identity, repeated or overlapping selections): no arbitrary winner is shown. */
  readonly cycleNumbers: readonly number[] | null;
  readonly cycleRelation: 'related' | 'related-with-unrepresented-selections' | 'membership-held';
}
/** First matching reason, in this order; `issues` keeps every reason. Only
 * `entered-count` is a usable planning count, and `0` there is a confirmed zero. */
export type GrowerFieldSeedCycleRequirementStatus =
  | 'known-vegetative-material' | 'cycle-held' | 'not-recorded' | 'duplicate-requirement' | 'requirement-invalid'
  | 'vegetative-declared' | 'material-not-confirmed' | 'count-invalid' | 'count-not-confirmed' | 'unknown' | 'entered-count';
/** Detached public presentation of one represented accepted non-nursery cycle.
 * `cycleNumber` is its position in this returned review only: never a saved
 * identity, canonical reference or stable key across source changes. */
export interface GrowerFieldSeedCycleBreakdownRow {
  readonly cycleNumber: number;
  /** Canonical catalogue name; no variety, lot or other joined reference. */
  readonly cropName: string | null;
  /** The existing planned field-entry date, never an observed sowing event. */
  readonly plannedFieldEntryDate: string | null;
  readonly requirementStatus: GrowerFieldSeedCycleRequirementStatus;
  /** `entered` only for one well-formed entry with a whole count. Any status other
   * than `entered-count` leaves that number a declaration, never a counted need. */
  readonly enteredGrossState: 'entered' | 'unknown' | 'not-recorded' | 'invalid' | 'ambiguous';
  readonly enteredGrossRequiredSeeds: number | null;
  /** True only when this entry is part of its group's known required-seed subtotal. */
  readonly countedInGroupSubtotal: boolean;
  /** Public supply-group number, only when exactly one group with unambiguous membership selects it. */
  readonly supplyGroupNumber: number | null;
  readonly groupRelation: 'related' | 'not-selected' | 'membership-held';
  readonly issues: readonly string[];
}
export interface GrowerFieldSeedSourcingReview {
  readonly status: 'available' | 'partial' | 'unavailable';
  readonly basis: 'grower-field-seed-sourcing-estimates';
  readonly requirementBasis: 'entered-gross-whole-seed-count';
  readonly sourceVerification: 'not-verified';
  readonly coverage: 'represented-accepted-non-nursery-cycles-only';
  readonly wholeFarmCoverage: 'not-assessed';
  readonly cycles: readonly GrowerFieldSeedCycleOption[];
  /** One public row per entry of `cycles`, in the same order, without internal handles. */
  readonly cycleBreakdown: readonly GrowerFieldSeedCycleBreakdownRow[];
  readonly representedCycleCount: number;
  readonly assignedCycleCount: number;
  readonly unassignedPlantingIds: readonly string[];
  readonly heldSourceRowCount: number;
  readonly legacySourceRowCount: number;
  readonly excludedNurseryCycleCount: number;
  readonly sourceIssues: readonly string[];
  readonly groups: readonly GrowerFieldSeedSourcingGroupReview[];
  readonly issues: readonly string[];
  readonly guidance: string;
}

const fieldGuidance = 'Planning only: represented accepted cycles without a nursery phase. No nursery phase does not establish botanical direct sowing. Botanical seed and the gross whole-seed requirement must be explicitly supplied and confirmed by the grower; known vegetative material cannot be counted as seeds. Gross counts already include whatever allowances the grower entered; none are inferred or added. Final plant positions, density, area and harvest estimates are not seed requirements. Group membership and interchangeability are grower assertions, not verified varieties or seed lots. Allocations are entered for this plan, not observed stock or protection against allocating a physical seed pool elsewhere. Unknown requirements are not zero. Nursery cycles, held or legacy rows and omitted or whole-farm seed demand need separate review. Cycle numbers are positions in this review only, not saved identities; planned field-entry dates are plans, not observed sowing or stock events. No weight, rate, price, purchase, inventory change or actor/source permission is inferred.';
function fieldUnavailable(issue: string): GrowerFieldSeedSourcingReview {
  return freeze({ status: 'unavailable', basis: 'grower-field-seed-sourcing-estimates', requirementBasis: 'entered-gross-whole-seed-count',
    sourceVerification: 'not-verified', coverage: 'represented-accepted-non-nursery-cycles-only', wholeFarmCoverage: 'not-assessed',
    cycles: [], cycleBreakdown: [], representedCycleCount: 0, assignedCycleCount: 0, unassignedPlantingIds: [], heldSourceRowCount: 0,
    legacySourceRowCount: 0, excludedNurseryCycleCount: 0, sourceIssues: [issue], groups: [], issues: [issue], guidance: fieldGuidance });
}
interface FieldGroupCandidate {
  index: number; id: string | null; plantingIds: string[]; raw: Record<string, unknown> | null; issues: string[];
}
/** Any of these makes a group's selections unfit for a public cycle-number relation. */
const membershipIssues = new Set(['group-input-invalid', 'group-id-duplicate', 'cycle-membership-duplicate', 'cycle-membership-overlap']);
function fieldGroupCandidate(raw: unknown, index: number): FieldGroupCandidate {
  const row = object(raw) ? raw : null, id = row && identity(row.id) ? row.id : null;
  // Even a malformed group keeps its readable memberships in the overlap audit.
  const plantingIds = row && Array.isArray(row.plantingIds) ? row.plantingIds.filter(identity) : [];
  const issues: string[] = [], allowed = ['id', 'label', 'plantingIds', 'interchangeabilityConfirmed', 'allocatedToPlanSeeds', 'seedsPerPack'];
  if (!row || !id || Object.keys(row).some(key => !allowed.includes(key)) || !Array.isArray(row.plantingIds)
    || !row.plantingIds.length || row.plantingIds.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS
    || row.plantingIds.length !== plantingIds.length || !Object.hasOwn(row, 'allocatedToPlanSeeds')) issues.push('group-input-invalid');
  if (row?.interchangeabilityConfirmed !== true) issues.push('interchangeability-not-confirmed');
  if (new Set(plantingIds).size !== plantingIds.length) issues.push('cycle-membership-duplicate');
  return { index, id, plantingIds, raw: row, issues };
}
interface FieldRequirement {
  plantingId: string | null;
  grossRequiredSeeds: number | null;
  issues: string[];
}
function fieldRequirement(raw: unknown): FieldRequirement {
  const row = object(raw) ? raw : null;
  const plantingId = row && identity(row.plantingId) ? row.plantingId : null;
  const issues: string[] = [], allowed = ['plantingId', 'materialDeclaration', 'grossRequiredSeeds', 'grossRequirementConfirmed'];
  if (!row || !plantingId || Object.keys(row).some(key => !allowed.includes(key))
    || allowed.some(key => !Object.hasOwn(row, key))) issues.push('field-requirement-invalid');
  if (row?.materialDeclaration === 'vegetative') issues.push('vegetative-material-not-seeds');
  else if (row?.materialDeclaration !== 'botanical-seed') issues.push('botanical-material-not-confirmed');
  if (row?.grossRequirementConfirmed !== true) issues.push('gross-requirement-not-confirmed');
  const gross = row?.grossRequiredSeeds;
  if (gross !== null && (typeof gross !== 'number' || !Number.isSafeInteger(gross) || gross < 0)) issues.push('gross-seed-count-invalid');
  return { plantingId, grossRequiredSeeds: typeof gross === 'number' && Number.isSafeInteger(gross) && gross >= 0 ? gross : null, issues };
}

/** Pure replay and arithmetic, not live source permission. The real saved-source
 * owner must recheck its original book/source/actor binding before publication. */
export function reviewGrowerFieldSeedSourcing(input: GrowerFieldSeedSourcingInput): GrowerFieldSeedSourcingReview {
  try {
    // Probe descriptors but keep original marker presence for the canonical reader.
    detachJsonData(input, { allowUndefinedObjectFields: true });
    if (!object(input) || !Array.isArray(input.rows) || input.rows.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS
      || !object(input.cycleContext) || !Array.isArray(input.requirements) || !Array.isArray(input.groups)
      || input.requirements.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS || input.groups.length > GROWER_AUTOPLAN_MAX_ASSESSMENTS) {
      return fieldUnavailable('field-seed-source-unavailable');
    }
    const projection = projectGrowerCycles(input.rows, input.cycleContext);
    const own = projection.ownCycles.filter(cycle => cycle.nurseryDemand === null);
    const cycles = own.map((cycle): GrowerFieldSeedCycleOption => {
      const crop = cropByKey(cycle.cropKey), knownMaterialUnit = knownVegetativePropagationUnit(cycle.cropKey);
      const entries = cycle.plannedEvents.filter(event => event.kind === 'field-entry');
      const reasons: string[] = [];
      if (!crop || !crop.name.trim()) reasons.push('crop-identification-unavailable');
      if (knownMaterialUnit !== null) reasons.push('known-vegetative-material-not-seeds');
      if (entries.length !== 1) reasons.push('field-entry-date-unavailable');
      return { plantingId: cycle.plantingId, cropName: crop?.name ?? '', plannedFieldEntryDate: entries.length === 1 ? entries[0].date : null,
        knownMaterialUnit, status: reasons.length ? 'held' : 'eligible', reasons };
    });
    const byCycle = new Map(own.map(cycle => [cycle.plantingId, cycle]));
    const options = new Map(cycles.map(cycle => [cycle.plantingId, cycle]));
    const sourceIssues = unique(projection.heldRows.flatMap(row => row.reasons));
    if (projection.heldRows.length) sourceIssues.push('source-has-held-rows');
    if (projection.legacyRows.length) sourceIssues.push('legacy-source-rows-not-assessed');
    const excludedNurseryCycleCount = projection.ownCycles.length - own.length;
    if (excludedNurseryCycleCount) sourceIssues.push('nursery-cycles-excluded');
    const requirements = input.requirements.map(fieldRequirement), requirementsByCycle = new Map<string, FieldRequirement[]>();
    const requirementIssues: string[] = [];
    for (const requirement of requirements) {
      if (requirement.plantingId) requirementsByCycle.set(requirement.plantingId, [...(requirementsByCycle.get(requirement.plantingId) ?? []), requirement]);
      if (requirement.issues.length) requirementIssues.push('field-requirements-need-review');
      if (!requirement.plantingId || !options.has(requirement.plantingId)) requirementIssues.push('requirement-cycle-not-in-current-review');
    }
    for (const entries of requirementsByCycle.values()) if (entries.length > 1) {
      requirementIssues.push('field-requirement-duplicate');
      for (const entry of entries) entry.issues.push('field-requirement-duplicate');
    }
    const candidates = input.groups.map(fieldGroupCandidate), groupIds = new Map<string, FieldGroupCandidate[]>(), memberships = new Map<string, FieldGroupCandidate[]>();
    for (const row of candidates) {
      if (row.id) groupIds.set(row.id, [...(groupIds.get(row.id) ?? []), row]);
      for (const id of new Set(row.plantingIds)) memberships.set(id, [...(memberships.get(id) ?? []), row]);
    }
    for (const entries of groupIds.values()) if (entries.length > 1) for (const row of entries) row.issues.push('group-id-duplicate');
    for (const entries of memberships.values()) if (entries.length > 1) for (const row of entries) row.issues.push('cycle-membership-overlap');
    // Public numbering is presentation only: the position in the current replay.
    const cycleNumbers = new Map(cycles.map((cycle, index) => [cycle.plantingId, index + 1]));
    // Decided before quantity holds: a malformed group keeps its readable overlap
    // audit above, but neither it nor any group it overlaps is related to a number.
    const membershipHeld = new Set(candidates.filter(row => row.issues.some(issue => membershipIssues.has(issue))));
    const relation = (row: FieldGroupCandidate): Pick<GrowerFieldSeedSourcingGroupReview, 'cycleNumbers' | 'cycleRelation'> => {
      if (membershipHeld.has(row)) return { cycleNumbers: null, cycleRelation: 'membership-held' };
      const numbers = row.plantingIds.flatMap(id => cycleNumbers.has(id) ? [cycleNumbers.get(id)!] : []).sort((a, b) => a - b);
      return { cycleNumbers: numbers, cycleRelation: numbers.length === row.plantingIds.length ? 'related' : 'related-with-unrepresented-selections' };
    };
    const assigned = new Set<string>();
    const groups = candidates.map((row): GrowerFieldSeedSourcingGroupReview => {
      const label = enteredLabel(row.raw), cropKeys = new Set<string>(), cropNames = new Set<string>();
      let missingCrop = false;
      for (const id of row.plantingIds) {
        const option = options.get(id), cycle = byCycle.get(id);
        if (option?.cropName && cycle) { cropNames.add(option.cropName); cropKeys.add(cycle.cropKey); }
        else missingCrop = true;
        if (!option) row.issues.push('cycle-not-in-current-review');
        else row.issues.push(...option.reasons);
        const matches = requirementsByCycle.get(id);
        if (!matches?.length) row.issues.push('field-requirement-not-recorded');
        else for (const requirement of matches) row.issues.push(...requirement.issues);
      }
      const cropStatus = cropNames.size ? missingCrop ? 'incomplete' : 'complete' : 'unavailable';
      const description = [
        ...(label.labelStatus === 'not-recorded' ? ['Supply group label not recorded.'] : label.labelStatus === 'invalid' ? ['Supply group label is invalid.'] : []),
        ...(cropStatus === 'unavailable' ? ['Crop identification unavailable for selected cycles.']
          : cropStatus === 'incomplete' ? ['Crop identification incomplete; some selected cycles need review.'] : []),
        ...(cropKeys.size > 1 ? ['Multiple crop identities selected for this seed supply group.'] : []),
        'Gross whole-seed requirements are entered grower estimates, not inferred from final plant positions.',
        'Crop names and grower confirmation do not verify interchangeable varieties or seed lots.',
      ].join(' ');
      const identification: GrowerSeedSourcingGroupReview['identification'] = { ...label, cropNames: [...cropNames].sort((a, b) => a.localeCompare(b)),
        cropIdentityCount: cropStatus === 'complete' ? cropKeys.size : null, cropStatus, description };
      const selectedCycleCount = new Set(row.plantingIds.filter(id => options.has(id))).size, related = relation(row);
      const held = (): GrowerFieldSeedSourcingGroupReview => ({ index: row.index, id: row.id, plantingIds: [...row.plantingIds], selectedCycleCount,
        ...related, status: 'held', knownRequiredSeedsSubtotal: null, requiredSeeds: null, counts: null, issues: unique(row.issues), identification });
      if (row.issues.length) return held();
      let sum = BigInt(0), known = 0, unknown = false;
      for (const id of row.plantingIds) {
        const gross = requirementsByCycle.get(id)![0].grossRequiredSeeds;
        if (gross === null) unknown = true;
        else { sum += BigInt(gross); known++; }
      }
      const overflow = sum > BigInt(Number.MAX_SAFE_INTEGER), requiredSeeds = overflow || unknown ? null : Number(sum);
      const counts = reviewSeedPurchaseCounts(requiredSeeds, row.raw!.allocatedToPlanSeeds, row.raw!.seedsPerPack);
      if (counts.status === 'invalid') { row.issues.push('allocation-or-pack-count-invalid'); return held(); }
      if (overflow) row.issues.push('seed-requirement-overflow');
      if (unknown) row.issues.push('seed-requirement-unknown');
      if (counts.status === 'unknown' && (row.raw!.allocatedToPlanSeeds == null || row.raw!.seedsPerPack == null)) row.issues.push('allocation-or-pack-count-unknown');
      if (counts.status === 'overflow') row.issues.push('pack-count-product-overflow');
      for (const id of row.plantingIds) assigned.add(id);
      return { index: row.index, id: row.id, plantingIds: [...row.plantingIds], selectedCycleCount, ...related,
        status: overflow || counts.status === 'overflow' ? 'overflow' : counts.status,
        knownRequiredSeedsSubtotal: overflow || known === 0 ? null : Number(sum), requiredSeeds, counts: overflow ? null : counts,
        issues: unique(row.issues), identification };
    });
    const unassignedPlantingIds = cycles.map(cycle => cycle.plantingId).filter(id => !assigned.has(id));
    // Built only from this replay, the parsed entries and the finished groups. A
    // counted entry is part of exactly one non-held group's known subtotal.
    const counted = new Set(groups.flatMap(group => group.status === 'held' || group.knownRequiredSeedsSubtotal === null ? []
      : group.plantingIds.filter(id => requirementsByCycle.get(id)?.length === 1 && requirementsByCycle.get(id)![0].grossRequiredSeeds !== null)));
    const cycleBreakdown = cycles.map((cycle, index): GrowerFieldSeedCycleBreakdownRow => {
      const entries = requirementsByCycle.get(cycle.plantingId) ?? [], entry = entries.length === 1 ? entries[0] : null;
      const entryIssues = unique(entries.flatMap(row => row.issues)), has = (issue: string) => entryIssues.includes(issue);
      const requirementStatus: GrowerFieldSeedCycleRequirementStatus = cycle.knownMaterialUnit !== null ? 'known-vegetative-material'
        : cycle.status === 'held' ? 'cycle-held' : !entries.length ? 'not-recorded' : !entry ? 'duplicate-requirement'
        : has('field-requirement-invalid') ? 'requirement-invalid' : has('vegetative-material-not-seeds') ? 'vegetative-declared'
        : has('botanical-material-not-confirmed') ? 'material-not-confirmed' : has('gross-seed-count-invalid') ? 'count-invalid'
        : has('gross-requirement-not-confirmed') ? 'count-not-confirmed' : entry.grossRequiredSeeds === null ? 'unknown' : 'entered-count';
      // Duplicates show no entered number at all; a malformed entry is never read as a declaration.
      const enteredGrossState: GrowerFieldSeedCycleBreakdownRow['enteredGrossState'] = !entries.length ? 'not-recorded' : !entry ? 'ambiguous'
        : has('field-requirement-invalid') || has('gross-seed-count-invalid') ? 'invalid' : entry.grossRequiredSeeds === null ? 'unknown' : 'entered';
      const selecting = memberships.get(cycle.plantingId) ?? [];
      const groupRelation = !selecting.length ? 'not-selected' : selecting.length === 1 && !membershipHeld.has(selecting[0]) ? 'related' : 'membership-held';
      return { cycleNumber: index + 1, cropName: cycle.cropName || null, plannedFieldEntryDate: cycle.plannedFieldEntryDate, requirementStatus,
        enteredGrossState, enteredGrossRequiredSeeds: enteredGrossState === 'entered' ? entry!.grossRequiredSeeds : null,
        countedInGroupSubtotal: counted.has(cycle.plantingId), supplyGroupNumber: groupRelation === 'related' ? selecting[0].index + 1 : null,
        groupRelation, issues: unique([...cycle.reasons, ...(entries.length ? entryIssues : ['field-requirement-not-recorded'])]) };
    });
    const issues = [...sourceIssues, ...requirementIssues];
    if (unassignedPlantingIds.length) issues.push('represented-cycles-unassigned');
    if (!cycles.length) issues.push('no-represented-non-nursery-cycles');
    if (groups.some(group => group.status === 'held')) issues.push('sourcing-groups-held');
    if (groups.some(group => group.status === 'unknown' || group.status === 'overflow')) issues.push('sourcing-counts-incomplete');
    return freeze({ status: issues.length ? 'partial' : 'available', basis: 'grower-field-seed-sourcing-estimates',
      requirementBasis: 'entered-gross-whole-seed-count', sourceVerification: 'not-verified',
      coverage: 'represented-accepted-non-nursery-cycles-only', wholeFarmCoverage: 'not-assessed', cycles, cycleBreakdown,
      representedCycleCount: cycles.length, assignedCycleCount: assigned.size, unassignedPlantingIds,
      heldSourceRowCount: projection.heldRows.length, legacySourceRowCount: projection.legacyRows.length, excludedNurseryCycleCount,
      sourceIssues, groups, issues: unique(issues), guidance: fieldGuidance });
  } catch { return fieldUnavailable('field-seed-input-unreadable'); }
}
