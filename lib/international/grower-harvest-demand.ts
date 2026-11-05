import { sanitiseHarvestTargets } from '../crop-plan';
import { targetDemand } from '../harvest-targets';
import type { GrowerAutoPlanDemand } from './grower-autoplan';
import type { GrowerWorkflowSource } from './grower-workflow-source';
import {
  growerPlanningScopeKey, isGrowerRecordedAt, normaliseGrowerPlanningProfile,
  normaliseGrowerPlanningScope,
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
  // Keep the existing month/day-count and produce-pack conversion authority.
  const aggregate = targetDemand(target);
  if (!aggregate || aggregate.demandKg === null) return held('unit-weight-missing');
  if (!Number.isFinite(aggregate.demandKg) || aggregate.demandKg < 0) return held('invalid-demand');
  if (aggregate.demandKg > 0 && target.marketablePercent === undefined) return held('saleable-share-missing');
  if (aggregate.demandKg > 0 && target.marketablePercent === 0) return held('zero-saleable-share');
  const gross = aggregate.demandKg === 0 ? 0 : aggregate.demandKg / (target.marketablePercent! / 100);
  if (!Number.isFinite(gross)) return held('capacity-range');
  const end = new Date(`${target.endMonth}-01T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const provenance = { kind: 'grower-record' as const, recordedAt: request.recordedAt,
    reference: `Saved harvest target: ${target.id}; copied for this review, not its original entry time` };
  return {
    status: 'ready', buyerTotalKg: aggregate.demandKg, grossCapacityRequiredKg: gross,
    days: aggregate.days, saleablePercent: target.marketablePercent ?? null,
    deliveryDistribution: 'not-established', sourceVerification: 'not-verified',
    demand: { demandId: target.id, profileId: profile.profileId, scope,
      totalKg: { state: 'provided', value: gross, unit: 'kg-total', provenance },
      harvestWindow: { state: 'provided', unit: 'utc-date-window', provenance,
        value: { start: `${target.startMonth}-01`, endExclusive: end.toISOString().slice(0, 10) } } },
  };
}
