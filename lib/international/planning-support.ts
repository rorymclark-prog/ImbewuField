import { loadPlaces } from '../saved-places';
import { loadCropPlan } from '../crop-plan';
import { resolvePlanningSupport, type PlanningSupport } from './planning-policy';
export { resolvePlanningSupport } from './planning-policy';
export type { PlanningSupport, PlanningSupportInput } from './planning-policy';

/** Re-read the current account store when an export or queued action runs. A
 * captured report or proposal cannot approve itself after site details change. */
export function currentPlanningSupport(siteId: string | null, workspaceId: string | null = null): PlanningSupport {
  return resolvePlanningSupport({ places: loadPlaces(), siteId, workspaceId,
    workspaceReferences: loadCropPlan().workspaceReferences });
}
