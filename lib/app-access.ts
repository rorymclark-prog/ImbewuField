/** Training access is separate from the user-changeable Simple / All tools display setting. */
export const ACCESS_FEATURES = ['planning', 'field_records', 'money_records', 'design', 'community'] as const;
export type AccessFeature = (typeof ACCESS_FEATURES)[number];
export type AccessTier = 'study' | 'pilot' | 'full';

export interface AppAccess {
  tier: AccessTier;
  features: AccessFeature[];
  org_id: string;
  updated_by: string;
  updated_at: string;
}

/** A missing uncached grant while offline is unknown, so show the safe study baseline. */
export const OFFLINE_STUDY_ACCESS: AppAccess = Object.freeze({
  tier: 'study', features: [], org_id: '', updated_by: '', updated_at: '',
});

const ROUTES: Readonly<Record<string, AccessFeature>> = {
  '/facilitator/crops': 'planning', '/cropplan': 'planning', '/plan': 'planning', '/calendar': 'planning',
  '/farmer': 'design', '/design': 'design', '/reports': 'design', '/atlas': 'design', '/vision': 'design', '/surveys': 'design',
  '/journal': 'field_records',
  '/records': 'money_records', '/finances': 'money_records', '/invoice': 'money_records', '/prices': 'money_records',
  '/community': 'community', '/exchange': 'community',
};

/** No grant means existing accounts keep their existing tools. Study is always available. */
export function hasTrainingFeature(access: AppAccess | null, feature: AccessFeature): boolean {
  return access === null || access.tier === 'full' || (access.tier === 'pilot' && access.features.includes(feature));
}

export function canOpenTrainingRoute(access: AppAccess | null, path: string): boolean {
  const route = path.split('?')[0].split('#')[0];
  const feature = Object.entries(ROUTES).find(([prefix]) => route === prefix || route.startsWith(`${prefix}/`))?.[1];
  return feature ? hasTrainingFeature(access, feature) : true;
}

export function isAccessFeature(value: string): value is AccessFeature {
  return ACCESS_FEATURES.includes(value as AccessFeature);
}
