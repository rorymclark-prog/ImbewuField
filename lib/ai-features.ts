export const AI_FEATURES = {
  chat: 'Lima chat and advice', receipts: 'Receipt scanning', reports: 'Report writing',
  notes: 'Visit-note cleanup', photos: 'Photo and plant analysis', designs: 'AI designs and images',
} as const;
export type AiFeature = keyof typeof AI_FEATURES;
export const AI_DISABLED_HEADER = 'x-imbewu-ai-disabled';
/** Some non-AI records routes share the auth guard; they must stay usable with AI off. */
export function aiFeatureForRoute(route: string): AiFeature | null {
  if (route === '/api/read-slip') return 'receipts';
  if (route === '/api/visit-notes') return 'notes';
  if (route === '/api/generate-report') return 'reports';
  if (['/api/chat','/api/life-guide','/api/ai-insights','/api/design-advice','/api/area-profile'].includes(route)) return 'chat';
  if (['/api/tree-id','/api/analyse-photos','/api/lima-vision','/api/design-detect'].includes(route)) return 'photos';
  if (['/api/auto-design','/api/design','/api/design-review','/api/ai-render','/api/image-producer','/api/suggest-zones-ai'].includes(route)) return 'designs';
  return null;
}
export function aiFeatureDisabled(route: string, disabled: string, env: Record<string,string|undefined>): boolean {
  const feature = aiFeatureForRoute(route);
  if (!feature) return false;
  return env.PAID_AI_ENABLED === 'false' || env[`AI_${feature.toUpperCase()}_ENABLED`] === 'false'
    || disabled.split(',').some(s => s.trim() === 'all' || s.trim() === feature);
}
