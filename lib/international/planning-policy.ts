import { resolveSiteCountryContext, sitePlanningSupport, type SiteContextPlace, type SiteContextResolution } from './site-context';
import { resolveWorkspacePlanningReference } from './workspace-context';

export interface PlanningSupportInput {
  places: readonly SiteContextPlace[];
  siteId: string | null;
  workspaceId?: string | null;
  workspaceReferences?: unknown;
}

export interface PlanningSupport {
  allowCataloguePlanning: boolean;
  mode: 'south-african-site' | 'south-african-reference' | 'unavailable';
  reason: string;
  fingerprint: string;
  siteCountry: SiteContextResolution;
}

/** All visible planner, task and report consumers ask this same question. An
 * unmapped reference workspace can never override a mapped country's limits. */
export function resolvePlanningSupport(input: PlanningSupportInput): PlanningSupport {
  const siteCountry = resolveSiteCountryContext(input.places, input.siteId);
  const mapped = input.siteId !== null && input.siteId !== undefined;
  const reference = mapped ? null : resolveWorkspacePlanningReference(input.workspaceReferences, input.workspaceId ?? null);
  const siteAllowed = mapped && sitePlanningSupport(siteCountry).allowAutoPlanning;
  const allowCataloguePlanning = siteAllowed || !!reference;
  return {
    allowCataloguePlanning,
    mode: siteAllowed ? 'south-african-site' : reference ? 'south-african-reference' : 'unavailable',
    reason: siteAllowed ? 'Using the existing South African planning references. Country confirmation is not local agronomy approval.'
      : reference ? 'Using South African reference assumptions for this unmapped workspace. This is not locally reviewed guidance for another country.'
        : mapped ? 'This mapped site has no confirmed supported planning basis. Local crop guidance and inherited forecasts are unavailable.'
          : 'Choose an explicit planning reference for this unmapped workspace before using catalogue assumptions.',
    fingerprint: JSON.stringify([input.siteId, input.workspaceId ?? null, siteCountry.status, siteCountry.context, reference]),
    siteCountry,
  };
}
