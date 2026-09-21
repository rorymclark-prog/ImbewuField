import worked from './course-design-worked.json' with { type: 'json' };

export const DESIGN_WORKED = worked;
export type WorkedPack = typeof worked;
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

export function workedProblems(pack: WorkedPack = DESIGN_WORKED): string[] {
  const problems: string[] = [];
  const rectangles = [...pack.existing, ...pack.concepts.flatMap(concept => concept.geometry), pack.proposal].filter(isRect);
  for (const feature of rectangles as RectFeature[]) {
    if (![feature.x, feature.y, feature.width, feature.height].every(Number.isFinite) || feature.width <= 0 || feature.height <= 0) problems.push(`${feature.id} has invalid model dimensions.`);
    else if (rectLeavesTeachingFrame(feature, pack.frame)) problems.push(`${feature.id} leaves the fictional teaching frame.`);
  }
  const existing = pack.existing.find(feature => feature.id === 'E-PLOT-A');
  const alternative = pack.concepts.find(concept => concept.id === 'B')?.geometry[0];
  if (!existing || !alternative || workedArea(existing) !== workedArea(alternative)) problems.push('The two concepts must use the same supplied growing-area basis.');
  if (pack.proposal.status !== 'deferred after W-CARE') problems.push('The later care statement must defer the connected compost proposal.');
  if (!pack.sourceCards.some(card => card.id === pack.revision.source)) problems.push('The revision needs a named source card.');
  const route = pack.existing.find(feature => feature.id === 'E-ROUTE');
  if (route && isRect(route) && alternative && isRect(alternative) && rectsOverlap(route, alternative)) problems.push('Concept B cannot be presented as keeping the supplied route clear.');
  const featureIds = new Set([...pack.existing, ...pack.concepts.flatMap(concept => concept.geometry), pack.proposal].map(feature => feature.id));
  for (const row of pack.dependencies) {
    if (row.featureIds.some(id => !featureIds.has(id))) problems.push(`${row.item} references a missing feature.`);
    if (row.R1.costStatus !== 'unknown' || row.R2.costStatus !== 'unknown') problems.push(`${row.item} must not turn a missing cost into a price.`);
  }
  const compost = pack.dependencies.find(row => row.featureIds.includes(pack.proposal.id));
  if (!compost || !/deferred/i.test(compost.R2.phase) || !/deferred/i.test(compost.R2.careStatus) || compost.R2.quantity !== 'Not scheduled for purchase or construction') problems.push('The compost revision must update work, purchasing and care together.');
  return problems;
}

export function workedEdgeGap(pack: WorkedPack = DESIGN_WORKED) {
  const route = pack.existing.find(feature => feature.id === 'E-ROUTE');
  const alternative = pack.concepts.find(concept => concept.id === 'B')?.geometry[0];
  if (!route || !isRect(route) || !alternative) throw new Error('The edge check needs both supplied rectangles.');
  const routeRight = route.x + route.width;
  return { routeRight, alternativeLeft: alternative.x, gap: alternative.x - routeRight };
}

export function workedHandoverText() {
  const pack = DESIGN_WORKED;
  return [
    `${pack.caseId} — ${pack.title} — ${pack.currentRevision}`,
    pack.notice,
    `Units: ${pack.coordinateSystem.unit}. ${pack.coordinateSystem.axis}.`,
    `Teaching frame: ${pack.frame.width} × ${pack.frame.height} m. Not a land-rights record or fixed physical print scale.`,
    'Keep the downloaded diagrams alongside this record. This is the guided example, not your personal learning folder.',
    'SOURCE CARDS', ...pack.sourceCards.map(card => `${card.id} — ${card.kind}\n${card.title}: ${card.text}`),
    'MODEL GEOMETRY — all coordinates supplied fictional inputs',
    ...[...pack.existing, ...pack.concepts.flatMap(concept => concept.geometry), pack.proposal].map(feature => `${feature.id} — ${feature.label}: x=${feature.x}, y=${feature.y}${isRect(feature) ? `, width=${feature.width}, height=${feature.height} m` : ' m (reference point)'}.`),
    'FAIR COMPARISON', ...pack.comparison.map(row => `${row.criterion} (${row.source})\nA: ${row.A}\nB: ${row.B}\nUnknown: ${row.limit}`),
    'PROVISIONAL CHOICE', pack.decision.provisional, pack.decision.rejected, pack.reconsider,
    'CONNECTED WORK, COST AND CARE', ...pack.dependencies.map(row => `${row.item} (${row.featureIds.join(', ')})\nBefore work: ${row.before}\nR1: ${row.R1.phase}; ${row.R1.quantity}; cost ${row.R1.costStatus}; ${row.R1.careStatus}.\nR2: ${row.R2.phase}; ${row.R2.quantity}; cost ${row.R2.costStatus}; ${row.R2.careStatus}.\nCost detail: ${row.cost}\nNext discussion: ${row.owner}`),
    'REVISION', `${pack.revision.from} → ${pack.revision.to}; ${pack.revision.source}`, pack.revision.change, pack.revision.reason, pack.revision.nextOwner,
    'OBSERVATION PLAN — no outcomes supplied', ...pack.observationPlan.map(row => `${row.goal} (${row.featureIds.join(', ')}): ${row.task}\nWhen: ${row.trigger}\nReview: ${row.review}`),
    'Facilitator, practitioner, learner and language review are still required. This preview awards no assessed progress.',
  ].join('\n\n') + '\n';
}
