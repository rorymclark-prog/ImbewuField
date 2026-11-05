import { pointInRing, type DesignCanvasState, type WizardStep } from './design-canvas';
import { ELEMENTS_BY_ID, GROUND_FEATURES } from './design-elements';
import { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource } from './international/grower-workflow-source';
import { DEMO_SITE } from './demo-farm';
import { ringAreaM2 } from './water-system';

export const DESIGN_ADVICE_DEMO_SITE = `site:${DEMO_SITE.lat.toFixed(5)},${DEMO_SITE.lon.toFixed(5)}`;

const STEPS: Record<WizardStep, true> = {
  base: true, sector: true, water: true, earthworks: true, zones: true,
  planting: true, structures: true, review: true, glossy: true,
};
export function isDesignAdviceStep(value: unknown): value is WizardStep {
  return typeof value === 'string' && Object.hasOwn(STEPS, value);
}

export type AdviceGeometry = Pick<DesignCanvasState, 'siteId' | 'frame' | 'items' | 'zones' | 'lines'>;
export type AdviceSource =
  | { status: 'ready'; canonical: string; geometry: AdviceGeometry }
  | { status: 'held' };

/** Reuse the authored-geometry authority before any legacy normaliser can repair
 * duplicates or erase corrupt measures. Navigation and save timestamps are not
 * semantic edits; the current view step travels separately from this digest. */
export function inspectDesignAdviceSource(raw: unknown, siteId: string): AdviceSource {
  const inspection = inspectGrowerWorkflowSource({
    kind: 'studio-canvas', sourceId: siteId, raw, sourceRevision: 'design-advice',
  });
  if (inspection.status !== 'inspected') return { status: 'held' };
  return { status: 'ready', canonical: inspection.geometryCanonical,
    geometry: JSON.parse(inspection.geometryCanonical).geometry as AdviceGeometry };
}

export async function designAdviceSourceFingerprint(raw: unknown, siteId: string): Promise<string | null> {
  const inspection = inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId, raw, sourceRevision: 'design-advice' });
  const result = await fingerprintGrowerWorkflowSource(inspection);
  return result.status === 'ready' ? result.geometryFingerprint : null;
}

function compassEighth(dx: number, dy: number): string {
  if (Math.abs(dx) < 0.03 && Math.abs(dy) < 0.03) return 'centre';
  const angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((angle % 360) + 360) % 360 / 45) % 8];
}

/** Existing traced fabric stays context, never an instruction to replace it.
 * Server and client describe the same detached source without changing a metre. */
export function buildDesignAdviceSummary(state: AdviceGeometry, currentStep: WizardStep) {
  const effortZones = state.zones.filter(zone => !zone.feature);
  const items = state.items.map(item => ({
    name: ELEMENTS_BY_ID[item.defId]?.name ?? item.defId,
    zone: effortZones.find(zone => zone.points.length >= 3 && pointInRing([item.x, item.y], zone.points))?.zone ?? null,
    approxPos: compassEighth(item.x - 0.5, item.y - 0.5),
  }));
  const zones = effortZones.map(zone => ({ zone: zone.zone, areaApprox: Math.round(ringAreaM2(zone.points, state.frame)) }));
  const groundFeatures = state.zones.filter(zone => zone.feature && zone.feature !== 'boundary' && zone.points.length >= 3)
    .map(zone => ({ kind: GROUND_FEATURES[zone.feature!]?.label ?? zone.feature, areaApprox: Math.round(ringAreaM2(zone.points, state.frame)) }));
  const lines = state.lines.reduce<Record<string, number>>((counts, line) => {
    counts[line.kind] = (counts[line.kind] ?? 0) + 1; return counts;
  }, {});
  return { currentStep, items, zones, groundFeatures, lines,
    counts: { items: state.items.length, zones: state.zones.length, lines: state.lines.length, groundFeatures: groundFeatures.length } };
}
