import { resolveHarvestTargetDateWindow, sanitiseHarvestTargets } from '../crop-plan';
import { targetDemand } from '../harvest-targets';
import { detachJsonData } from '../lossless-json';
import {
  generateGrowerAutoPlan, GROWER_AUTOPLAN_MAX_ASSESSMENTS, type GrowerAutoPlanCycle,
  type GrowerAutoPlanDemand, type GrowerAutoPlanDemandResult, type GrowerAutoPlanProposal,
} from './grower-autoplan';
import type { GrowerWorkflowSource } from './grower-workflow-source';
import {
  addGrowerUtcDays, growerPlanningScopeKey, isGrowerRecordedAt, isGrowerUtcDate,
  normaliseGrowerPlanningProfile, normaliseGrowerPlanningScope,
} from './grower-planning';

export type GrowerHarvestDemand =
  | { readonly status: 'held'; readonly reasons: readonly string[] }
  | { readonly status: 'ready'; readonly demand: GrowerAutoPlanDemand;
      readonly buyerTotalKg: number; readonly grossCapacityRequiredKg: number;
      readonly days: number; readonly saleablePercent: number | null;
      readonly deliveryDistribution: 'not-established';
      readonly sourceVerification: 'not-verified' };

/** A weekly buyer target supplies an aggregate demand, never a picking curve.
 * Gross crop capacity needs the grower's explicit saleable share: omission must
 * not quietly promise that all estimated produce can be sold. */
export function growerDemandFromHarvestTarget(request: {
  target: unknown; profile: unknown; scope: unknown; recordedAt: unknown;
  /** Exact saved-design binding for canonical design-keyed buyer records. */
  source?: GrowerWorkflowSource | null;
}): GrowerHarvestDemand {
  const held = (...reasons: string[]): GrowerHarvestDemand => ({ status: 'held', reasons });
  const scope = normaliseGrowerPlanningScope(request.scope);
  const profile = normaliseGrowerPlanningProfile(request.profile);
  const target = sanitiseHarvestTargets([request.target])[0];
  if (!scope || scope.kind !== 'mapped-site') return held('mapped-site-required');
  if (!profile || !target || !isGrowerRecordedAt(request.recordedAt)) return held('invalid-source');
  const source = request.source;
  if (source && (source.status !== 'ready' || growerPlanningScopeKey(source.scope) !== growerPlanningScopeKey(scope)
    || !source.geometryFingerprint || !source.sourceKey || !source.resourceSiteId)) return held('source-scope-mismatch');
  const targetSiteId = source ? source.resourceSiteId : scope.siteId;
  if (target.siteId !== targetSiteId || growerPlanningScopeKey(profile.scope) !== growerPlanningScopeKey(scope)) {
    return held('scope-mismatch');
  }
  if (profile.cropKey !== target.cropKey) return held('crop-identity-mismatch');
  // Timing and produce-pack conversion use the same saved-target authorities.
  const aggregate = targetDemand(target);
  if (!aggregate || aggregate.demandKg === null) return held('unit-weight-missing');
  if (!Number.isFinite(aggregate.demandKg) || aggregate.demandKg < 0) return held('invalid-demand');
  if (aggregate.demandKg > 0 && target.marketablePercent === undefined) return held('saleable-share-missing');
  if (aggregate.demandKg > 0 && target.marketablePercent === 0) return held('zero-saleable-share');
  const gross = aggregate.demandKg === 0 ? 0 : aggregate.demandKg / (target.marketablePercent! / 100);
  if (!Number.isFinite(gross)) return held('capacity-range');
  const window = resolveHarvestTargetDateWindow(target);
  if (!window) return held('invalid-source');
  const provenance = { kind: 'grower-record' as const, recordedAt: request.recordedAt,
    reference: `Saved harvest target: ${target.id}; copied for this review, not its original entry time` };
  return {
    status: 'ready', buyerTotalKg: aggregate.demandKg, grossCapacityRequiredKg: gross,
    days: aggregate.days, saleablePercent: target.marketablePercent ?? null,
    deliveryDistribution: 'not-established', sourceVerification: 'not-verified',
    demand: { demandId: target.id, profileId: profile.profileId, scope,
      totalKg: { state: 'provided', value: gross, unit: 'kg-total', provenance },
      harvestWindow: { state: 'provided', unit: 'utc-date-window', provenance,
        value: { start: window.start, endExclusive: window.endExclusive } } },
  };
}

/** Seven days is a reporting period only; not an agronomic duration or delivery frequency. */
export const GROWER_BUYER_PICKING_PERIOD_DAYS = 7;
/** Software operation bound sharing the canonical autoplan evaluation ceiling. */
export const GROWER_BUYER_PICKING_MAX_OPERATIONS = GROWER_AUTOPLAN_MAX_ASSESSMENTS;

export interface GrowerBuyerPickingOverlap {
  readonly cycleId: string;
  readonly bedId: string;
  readonly start: string;
  readonly endExclusive: string;
}

export interface GrowerBuyerPickingPeriod {
  readonly start: string;
  readonly endExclusive: string;
  readonly status: 'no-proposed-picking-window' | 'picking-window-present' | 'not-fully-within-plan';
  readonly overlaps: readonly GrowerBuyerPickingOverlap[];
}

export interface GrowerBuyerPickingTarget {
  readonly targetId: string;
  readonly profileId: string;
  readonly window: {
    readonly start: string;
    readonly endExclusive: string;
  };
  readonly zeroDemand: boolean;
  readonly periods: readonly GrowerBuyerPickingPeriod[];
}

export type GrowerBuyerPickingReview =
  | {
      readonly status: 'held';
      readonly reasons: readonly string[];
      readonly basis: 'proposed-picking-window-overlap';
      readonly deliveryDistribution: 'not-established';
      readonly sourceVerification: 'not-verified';
    }
  | {
      readonly status: 'ready';
      readonly buyers: readonly GrowerBuyerPickingTarget[];
      readonly periodDays: 7;
      readonly basis: 'proposed-picking-window-overlap';
      readonly deliveryDistribution: 'not-established';
      readonly sourceVerification: 'not-verified';
    };

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function heldReview(reasons: readonly string[]): GrowerBuyerPickingReview {
  return Object.freeze({
    status: 'held',
    reasons: Object.freeze([...reasons]),
    basis: 'proposed-picking-window-overlap',
    deliveryDistribution: 'not-established',
    sourceVerification: 'not-verified',
  });
}

class ReportWorkLimit extends Error {}

/** Read-only 7-day buyer picking-window period review projector. Replays the
 * canonical auto-plan engine once to verify proposal identity and dates without
 * weekly yield allocation, acceptance changes or solver assertions. */
export function projectGrowerBuyerPickingPeriods(value: unknown): GrowerBuyerPickingReview {
  let detached: unknown;
  try {
    detached = detachJsonData(value);
  } catch {
    return heldReview(['invalid-review']);
  }
  if (!record(detached)) return heldReview(['invalid-review']);

  if (detached.status !== 'review') {
    if (detached.status === 'held' && Array.isArray(detached.issues) && detached.issues.length) {
      const stringIssues = detached.issues.filter((i): i is string => typeof i === 'string');
      return heldReview(stringIssues.length ? stringIssues : ['invalid-review']);
    }
    return heldReview(['invalid-review']);
  }

  if (typeof detached.recordedAt !== 'string' || !isGrowerRecordedAt(detached.recordedAt)
    || !record(detached.request) || detached.recordedAt !== detached.request.requestedAt
    || !record(detached.proposal) || !Array.isArray(detached.targetMetadata)) {
    return heldReview(['invalid-review']);
  }

  if (detached.enteredDemandMetadata !== undefined && !Array.isArray(detached.enteredDemandMetadata)) {
    return heldReview(['invalid-review']);
  }

  const suppliedProposal = detached.proposal;
  if (suppliedProposal.status !== 'ready' && suppliedProposal.status !== 'with-gaps') {
    const issues = Array.isArray(suppliedProposal.issues) && suppliedProposal.issues.length
      ? suppliedProposal.issues.filter((i): i is string => typeof i === 'string')
      : ['invalid-review'];
    return heldReview(issues.length ? issues : ['invalid-review']);
  }

  let freshProposal: GrowerAutoPlanProposal;
  try {
    freshProposal = generateGrowerAutoPlan(detached.request);
  } catch {
    return heldReview(['invalid-review']);
  }

  if (freshProposal.status !== 'ready' && freshProposal.status !== 'with-gaps') {
    const issues = Array.isArray(freshProposal.issues) && freshProposal.issues.length
      ? freshProposal.issues.filter((i): i is string => typeof i === 'string')
      : ['invalid-review'];
    return heldReview(issues.length ? issues : ['invalid-review']);
  }

  if (JSON.stringify(freshProposal) !== JSON.stringify(suppliedProposal)) {
    return heldReview(['stale-review']);
  }

  const snapshot = freshProposal.snapshot;
  if (!snapshot || snapshot.planningStart.state !== 'provided' || snapshot.planningEndExclusive.state !== 'provided') {
    return heldReview(['invalid-review']);
  }
  const planStart = snapshot.planningStart.value;
  const planEnd = snapshot.planningEndExclusive.value;

  const targetMetadata = detached.targetMetadata;
  const enteredMetadata = Array.isArray(detached.enteredDemandMetadata) ? detached.enteredDemandMetadata : [];

  let operationsUsed = targetMetadata.length + enteredMetadata.length;
  if (operationsUsed > GROWER_BUYER_PICKING_MAX_OPERATIONS) {
    return heldReview(['report-work-limit']);
  }
  const spend = () => {
    if (operationsUsed >= GROWER_BUYER_PICKING_MAX_OPERATIONS) throw new ReportWorkLimit();
    operationsUsed++;
  };

  const seenTargetIds = new Set<string>();
  for (const tm of targetMetadata) {
    if (!record(tm) || typeof tm.targetId !== 'string' || !tm.targetId.trim()) {
      return heldReview(['target-demand-mismatch']);
    }
    if (seenTargetIds.has(tm.targetId)) {
      return heldReview(['target-demand-mismatch']);
    }
    seenTargetIds.add(tm.targetId);
  }

  for (const edm of enteredMetadata) {
    if (!record(edm) || typeof edm.demandId !== 'string') {
      return heldReview(['target-demand-mismatch']);
    }
    if (seenTargetIds.has(edm.demandId)) {
      return heldReview(['target-demand-mismatch']);
    }
  }

  try {
    const demandsById = new Map<string, GrowerAutoPlanDemand[]>();
    for (const demand of snapshot.demands) {
      spend();
      const list = demandsById.get(demand.demandId);
      if (list) {
        list.push(demand);
      } else {
        demandsById.set(demand.demandId, [demand]);
      }
    }

    const resultsById = new Map<string, GrowerAutoPlanDemandResult[]>();
    for (const result of freshProposal.demandResults) {
      spend();
      const list = resultsById.get(result.demandId);
      if (list) {
        list.push(result);
      } else {
        resultsById.set(result.demandId, [result]);
      }
    }

    const cyclesByKey = new Map<string, GrowerAutoPlanCycle[]>();
    for (const cycle of freshProposal.cycles) {
      spend();
      const key = JSON.stringify([cycle.demandId, cycle.profileId]);
      const list = cyclesByKey.get(key);
      if (list) {
        list.push(cycle);
      } else {
        cyclesByKey.set(key, [cycle]);
      }
    }

    const buyers: GrowerBuyerPickingTarget[] = [];
    for (const targetRow of targetMetadata) {
      if (!record(targetRow)
        || typeof targetRow.targetId !== 'string' || !targetRow.targetId.trim()
        || typeof targetRow.profileId !== 'string' || !targetRow.profileId.trim()
        || typeof targetRow.buyerTotalKg !== 'number' || !Number.isFinite(targetRow.buyerTotalKg) || targetRow.buyerTotalKg < 0
        || typeof targetRow.grossCapacityRequiredKg !== 'number' || !Number.isFinite(targetRow.grossCapacityRequiredKg) || targetRow.grossCapacityRequiredKg < 0
        || typeof targetRow.days !== 'number' || !Number.isSafeInteger(targetRow.days) || targetRow.days <= 0) {
        return heldReview(['target-demand-mismatch']);
      }

      const validSaleablePercent = targetRow.saleablePercent === null
        || (typeof targetRow.saleablePercent === 'number'
            && Number.isFinite(targetRow.saleablePercent)
            && targetRow.saleablePercent >= 0
            && targetRow.saleablePercent <= 100);
      if (!validSaleablePercent
        || targetRow.deliveryDistribution !== 'not-established'
        || targetRow.sourceVerification !== 'not-verified') {
        return heldReview(['target-demand-mismatch']);
      }

      const matchingDemands = demandsById.get(targetRow.targetId);
      if (!matchingDemands || matchingDemands.length !== 1) return heldReview(['target-demand-mismatch']);
      const canonicalDemand = matchingDemands[0];
      if (canonicalDemand.profileId !== targetRow.profileId) return heldReview(['target-demand-mismatch']);

      const matchingResults = resultsById.get(targetRow.targetId);
      if (!matchingResults || matchingResults.length !== 1) return heldReview(['target-demand-mismatch']);
      const demandResult = matchingResults[0];
      if (demandResult.profileId !== targetRow.profileId) return heldReview(['target-demand-mismatch']);

      if (canonicalDemand.totalKg.state !== 'provided' || canonicalDemand.totalKg.value !== targetRow.grossCapacityRequiredKg) {
        return heldReview(['target-demand-mismatch']);
      }

      if (canonicalDemand.harvestWindow.state !== 'provided') {
        return heldReview(['target-demand-mismatch']);
      }
      const windowVal = canonicalDemand.harvestWindow.value;
      if (!record(windowVal) || !isGrowerUtcDate(windowVal.start) || !isGrowerUtcDate(windowVal.endExclusive) || windowVal.start >= windowVal.endExclusive) {
        return heldReview(['target-demand-mismatch']);
      }

      if (addGrowerUtcDays(windowVal.start, targetRow.days) !== windowVal.endExclusive) {
        return heldReview(['target-demand-mismatch']);
      }

      if (canonicalDemand.totalKg.value === 0) {
        buyers.push(Object.freeze({
          targetId: targetRow.targetId,
          profileId: targetRow.profileId,
          window: Object.freeze({
            start: windowVal.start,
            endExclusive: windowVal.endExclusive,
          }),
          zeroDemand: true,
          periods: Object.freeze([]),
        }));
        continue;
      }

      const targetPeriods: GrowerBuyerPickingPeriod[] = [];
      let periodStart: string = windowVal.start;
      let remainingDays = targetRow.days;
      const cycleKey = JSON.stringify([targetRow.targetId, targetRow.profileId]);
      const matchingCycles = cyclesByKey.get(cycleKey) ?? [];

      while (remainingDays > 0) {
        spend();
        const stepDays = Math.min(GROWER_BUYER_PICKING_PERIOD_DAYS, remainingDays);
        const periodEndExclusive = stepDays === remainingDays
          ? windowVal.endExclusive
          : addGrowerUtcDays(periodStart, stepDays);

        if (!periodEndExclusive || periodStart >= periodEndExclusive) {
          return heldReview(['target-demand-mismatch']);
        }

        const overlaps: GrowerBuyerPickingOverlap[] = [];
        for (const cycle of matchingCycles) {
          spend();
          const cycleStart = cycle.assessment.schedule.firstHarvestDate;
          const cycleEndExclusive = cycle.assessment.schedule.harvestEndExclusiveDate;
          const overlapStart = periodStart > cycleStart ? periodStart : cycleStart;
          const overlapEndExclusive = periodEndExclusive < cycleEndExclusive ? periodEndExclusive : cycleEndExclusive;
          if (overlapStart < overlapEndExclusive) {
            overlaps.push(Object.freeze({
              cycleId: cycle.cycleId,
              bedId: cycle.bedId,
              start: overlapStart,
              endExclusive: overlapEndExclusive,
            }));
          }
        }

        const whollyWithinPlan = periodStart >= planStart && periodEndExclusive <= planEnd;
        const status: GrowerBuyerPickingPeriod['status'] = !whollyWithinPlan
          ? 'not-fully-within-plan'
          : overlaps.length > 0
            ? 'picking-window-present'
            : 'no-proposed-picking-window';

        targetPeriods.push(Object.freeze({
          start: periodStart,
          endExclusive: periodEndExclusive,
          status,
          overlaps: Object.freeze(overlaps),
        }));

        periodStart = periodEndExclusive;
        remainingDays -= stepDays;
      }

      buyers.push(Object.freeze({
        targetId: targetRow.targetId,
        profileId: targetRow.profileId,
        window: Object.freeze({
          start: windowVal.start,
          endExclusive: windowVal.endExclusive,
        }),
        zeroDemand: false,
        periods: Object.freeze(targetPeriods),
      }));
    }

    return Object.freeze({
      status: 'ready',
      buyers: Object.freeze(buyers),
      periodDays: 7,
      basis: 'proposed-picking-window-overlap',
      deliveryDistribution: 'not-established',
      sourceVerification: 'not-verified',
    });
  } catch (error) {
    if (error instanceof ReportWorkLimit) {
      return heldReview(['report-work-limit']);
    }
    throw error;
  }
}
