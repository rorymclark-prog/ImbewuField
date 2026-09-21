import worked from './course-design-worked.json' with { type: 'json' };

export const DESIGN_WORKED = worked;
export type WorkedFeature = typeof worked.existing[number] | typeof worked.proposal | typeof worked.concepts[number]['geometry'][number];
type RectFeature = { id: string; type: string; x: number; y: number; width: number; height: number };

function isRect(feature: unknown): feature is RectFeature {
  return Boolean(feature && typeof feature === 'object' && 'type' in feature && 'width' in feature && 'height' in feature && (feature as { type?: unknown }).type === 'rect' && typeof (feature as { width?: unknown }).width === 'number' && typeof (feature as { height?: unknown }).height === 'number');
}

export function workedArea(feature: WorkedFeature) {
  return isRect(feature) ? feature.width * feature.height : null;
}

export function rectsOverlap(first: RectFeature, second: RectFeature) {
  return first.x < second.x + second.width && first.x + first.width > second.x
    && first.y < second.y + second.height && first.y + first.height > second.y;
}

/** Model-geometry guard only: it deliberately does not assert real-world suitability. */
export function rectLeavesTeachingFrame(feature: RectFeature, frame = DESIGN_WORKED.frame) {
  return feature.x < 0 || feature.y < 0 || feature.x + feature.width > frame.width || feature.y + feature.height > frame.height;
}

/** Existing evidence never changes when a proposal or a later revision changes. */
export function existingFeatureIds() {
  return DESIGN_WORKED.existing.map(feature => feature.id);
}

export function workedProblems(): string[] {
  const problems: string[] = [];
  const rectangles = [...DESIGN_WORKED.existing, ...DESIGN_WORKED.concepts.flatMap(concept => concept.geometry), DESIGN_WORKED.proposal].filter(isRect);
  for (const feature of rectangles as RectFeature[]) {
    if (rectLeavesTeachingFrame(feature)) problems.push(`${feature.id} leaves the fictional teaching frame.`);
  }
  const existing = DESIGN_WORKED.existing.find(feature => feature.id === 'E-PLOT-A');
  const alternative = DESIGN_WORKED.concepts.find(concept => concept.id === 'B')?.geometry[0];
  if (!existing || !alternative || workedArea(existing) !== workedArea(alternative)) problems.push('The two concepts must use the same supplied growing-area basis.');
  if (DESIGN_WORKED.proposal.status !== 'deferred after W-CARE') problems.push('The later care statement must defer the connected compost proposal.');
  if (!DESIGN_WORKED.sourceCards.some(card => card.id === DESIGN_WORKED.revision.source)) problems.push('The revision needs a named source card.');
  const route = DESIGN_WORKED.existing.find(feature => feature.id === 'E-ROUTE');
  if (route && isRect(route) && alternative && isRect(alternative) && rectsOverlap(route, alternative)) problems.push('Concept B cannot be presented as keeping the supplied route clear.');
  return problems;
}
