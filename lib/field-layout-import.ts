import polygonClipping from 'polygon-clipping';
import { lngLatToWorld, projectorForFrame, type DesignCanvasState, type ZoneShape } from './design-canvas';
import { fieldBlockExclusions } from './bed-block';
import { ELEMENTS_BY_ID, GROUND_FEATURES } from './design-elements';
import { inspectFieldLayoutData, inspectFieldLayoutMapSource, inspectFieldLayoutRing,
  type FieldLayoutExportFrame, type FieldLayoutTopologyBudget } from './field-layout-export';
import { isXml10CharacterText } from './xml-character-text';
import type { FieldLayoutKmlParsed } from './field-layout-import.types';

type Point = [number, number];
type Row = Record<string, unknown>;
export interface FieldLayoutImportRequest {
  readonly rawState: unknown;
  readonly effectiveFrame: FieldLayoutExportFrame;
  readonly parsed: FieldLayoutKmlParsed;
}
export type FieldLayoutImportCandidate = {
  readonly id: string;
  readonly name: string;
  readonly status: 'ready';
  readonly points: readonly (readonly [number, number])[];
  /** Overlap is disclosed without guessing which polygon represents a field. */
  readonly conflictingCandidateIds: readonly string[];
} | {
  readonly id: string;
  readonly name: string;
  readonly status: 'held';
  readonly reasons: readonly string[];
};
export type FieldLayoutImportInspection = {
  readonly status: 'inspected';
  readonly sourceKey: string;
  readonly candidates: readonly FieldLayoutImportCandidate[];
  readonly excludedPlacemarkCount: number;
} | { readonly status: 'held'; readonly reasons: readonly string[] };
export interface FieldLayoutImportSelection {
  readonly candidateId: string;
  readonly zoneId: string;
  /** External names are suggestions. Only an explicitly supplied label is used. */
  readonly name?: string;
}
export interface FieldLayoutImportAppendRequest extends FieldLayoutImportRequest {
  readonly expectedSourceKey: string;
  readonly selections: readonly FieldLayoutImportSelection[];
}
export type FieldLayoutImportAppendResult = {
  readonly status: 'ready';
  readonly state: DesignCanvasState;
  readonly addedZoneIds: readonly string[];
} | { readonly status: 'held'; readonly reasons: readonly string[] };

/** Engineering work ceilings only. They establish no field size or map accuracy. */
export const FIELD_LAYOUT_IMPORT_LIMITS = Object.freeze({ candidates: 200, ringPoints: 512,
  points: 20_000, topologyWork: 1_000_000 });
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
const label = (value: unknown): value is string => typeof value === 'string' && value.length <= 2000 && isXml10CharacterText(value);
const held = (...reasons: string[]) => ({ status: 'held' as const, reasons: Object.freeze(reasons) });
class ImportHold extends Error {}
function reject(reason: string): never { throw new ImportHold(reason); }
function own(value: unknown, key: string, optional = false): unknown {
  if (!record(value)) return reject('unsafe-source');
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property && optional) return undefined;
  if (!property || !property.enumerable || !('value' in property)) return reject('unsafe-source');
  return property.value;
}
function samePoint(a: readonly number[], b: readonly number[]): boolean { return a[0] === b[0] && a[1] === b[1]; }
function twiceArea(points: readonly (readonly number[])[]): number {
  const origin = points[0]; let sum = 0;
  for (let i = 1; i + 1 < points.length; i++) {
    sum += (points[i][0] - origin[0]) * (points[i + 1][1] - origin[1])
      - (points[i + 1][0] - origin[0]) * (points[i][1] - origin[1]);
  }
  return sum;
}
function bounds(points: readonly Point[]) {
  return { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
    minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
}
interface Budget { topology: FieldLayoutTopologyBudget; work: number }
function overlap(a: Point[], b: Point[], budget: Budget): boolean {
  const x = bounds(a), y = bounds(b);
  if (x.maxX <= y.minX || y.maxX <= x.minX || x.maxY <= y.minY || y.maxY <= x.minY) return false;
  budget.work += a.length * b.length;
  if (budget.work + budget.topology.comparisons > FIELD_LAYOUT_IMPORT_LIMITS.topologyWork) return reject('work-limit');
  return polygonClipping.intersection([a], [b]).some(polygon => polygon.some(ring => Math.abs(twiceArea(ring)) > 0));
}
function ring(value: unknown, budget: Budget): Point[] {
  const inspected = inspectFieldLayoutRing(value, budget.topology);
  if (inspected.status !== 'ready') return reject(inspected.reasons[0]);
  if (budget.topology.points > FIELD_LAYOUT_IMPORT_LIMITS.points
    || budget.work + budget.topology.comparisons > FIELD_LAYOUT_IMPORT_LIMITS.topologyWork) return reject('work-limit');
  return inspected.points;
}

function sourceBlockers(state: DesignCanvasState, frame: FieldLayoutExportFrame, budget: Budget): Point[][] {
  const fields: Point[][] = [];
  for (const zone of state.zones) {
    if (zone.feature !== undefined && !Object.hasOwn(GROUND_FEATURES, zone.feature)) return reject('invalid-existing-footprint');
    // Validate every source ring, including exclusions, before feeding clipping.
    // A damaged house outline must never become an apparently empty obstacle.
    const points = ring(zone.points, budget);
    if (zone.feature === 'staple_garden') fields.push(points);
  }
  for (const item of state.items) {
    const definition = ELEMENTS_BY_ID[item.defId];
    const width = item.wM ?? definition?.wM, height = item.hM ?? definition?.hM;
    if (!definition || !finite(item.x) || !finite(item.y) || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1
      || !finite(width) || width <= 0 || !finite(height) || height <= 0 || item.rot !== undefined && !finite(item.rot)) {
      return reject('invalid-existing-footprint');
    }
  }
  // The empty parent ID cannot match a valid saved ID. This asks the existing
  // exclusion authority to retain every bed, building and other placed element.
  const exclusions = fieldBlockExclusions(state, '', frame);
  for (const exclusion of exclusions) {
    if (exclusion.length < 3 || exclusion.some(point => point.length !== 2 || !point.every(finite))
      || twiceArea(exclusion) === 0) return reject('invalid-existing-footprint');
    budget.topology.points += exclusion.length;
    if (budget.topology.points > FIELD_LAYOUT_IMPORT_LIMITS.points) return reject('work-limit');
  }
  return [...fields, ...exclusions];
}

function parsedSnapshot(value: unknown): FieldLayoutKmlParsed {
  const captured = inspectFieldLayoutData(value);
  if (captured.status !== 'ready') return reject(captured.reasons[0]);
  const parsed = captured.value;
  if (!record(parsed) || parsed.status !== 'parsed' || !Array.isArray(parsed.candidates)
    || !Number.isSafeInteger(parsed.excludedPlacemarkCount) || (parsed.excludedPlacemarkCount as number) < 0
    || Object.keys(parsed).some(key => !['status', 'candidates', 'excludedPlacemarkCount'].includes(key))) return reject('invalid-candidates');
  if (parsed.candidates.length > FIELD_LAYOUT_IMPORT_LIMITS.candidates) return reject('work-limit');
  for (const candidate of parsed.candidates) {
    if (!record(candidate) || !identity(candidate.id) || !label(candidate.name) || !Array.isArray(candidate.ring)
      || Object.keys(candidate).some(key => !['id', 'name', 'ring'].includes(key))) return reject('invalid-candidates');
  }
  return parsed as unknown as FieldLayoutKmlParsed;
}

function projectRing(value: readonly (readonly number[])[], frame: FieldLayoutExportFrame, budget: Budget): Point[] {
  if (value.length > FIELD_LAYOUT_IMPORT_LIMITS.ringPoints) return reject('work-limit');
  if (value.length < 4 || value.some(point => !Array.isArray(point) || point.length !== 2 || !point.every(finite))) return reject('invalid-polygon');
  if (!samePoint(value[0], value[value.length - 1])) return reject('unclosed-polygon');
  if (value.some(([longitude, latitude]) => longitude < -180 || longitude > 180 || latitude <= -90 || latitude >= 90)) return reject('invalid-coordinate');
  if (Math.max(...value.map(point => point[0])) - Math.min(...value.map(point => point[0])) > 180) return reject('antimeridian-unsupported');
  const north = lngLatToWorld(frame.centerLng, 90, frame.zoom)[1];
  const south = lngLatToWorld(frame.centerLng, -90, frame.zoom)[1];
  for (const [longitude, latitude] of value) {
    const y = lngLatToWorld(longitude, latitude, frame.zoom)[1];
    if (!finite(y) || y <= north || y >= south) return reject('mercator-latitude-clamped');
  }
  const project = projectorForFrame(frame);
  const points = value.map(point => project([point[0], point[1]]));
  if (points.some(point => point.some(value => !finite(value) || value < 0 || value > 1))) return reject('outside-canvas');
  return ring(points, budget);
}

/** Candidate names, IDs and list order never decide field/bed meaning. The
 * inspection is detached geometry evidence for an explicit selection only. */
export function inspectFieldLayoutImport(request: FieldLayoutImportRequest): FieldLayoutImportInspection {
  try {
    const source = inspectFieldLayoutMapSource(request);
    if (source.status !== 'ready') return source;
    const parsed = parsedSnapshot(own(request, 'parsed'));
    const budget: Budget = { topology: { points: 0, comparisons: 0 }, work: 0 };
    const blockers = sourceBlockers(source.state, source.frame, budget);
    const counts = new Map<string, number>();
    for (const candidate of parsed.candidates) counts.set(candidate.id, (counts.get(candidate.id) ?? 0) + 1);
    const results: Array<{ id: string; name: string; points: Point[]; conflicts: string[] } | Extract<FieldLayoutImportCandidate, { status: 'held' }>> = [];
    for (const candidate of parsed.candidates) {
      try {
        if (counts.get(candidate.id) !== 1) return reject('ambiguous-candidate-id');
        const points = projectRing(candidate.ring, source.frame, budget);
        if (blockers.some(blocker => overlap(points, blocker, budget))) return reject('existing-ground-overlap');
        results.push({ id: candidate.id, name: candidate.name, points, conflicts: [] });
      } catch (error) {
        const reason = error instanceof ImportHold ? error.message : 'invalid-polygon';
        if (reason === 'work-limit') return held(reason);
        results.push({ id: candidate.id, name: candidate.name, ...held(reason) });
      }
    }
    for (let i = 0; i < results.length; i++) for (let j = i + 1; j < results.length; j++) {
      const a = results[i], b = results[j];
      if ('points' in a && 'points' in b && overlap(a.points, b.points, budget)) {
        a.conflicts.push(b.id); b.conflicts.push(a.id);
      }
    }
    const candidates: FieldLayoutImportCandidate[] = results.map(candidate => 'points' in candidate
      ? Object.freeze({ id: candidate.id, name: candidate.name, status: 'ready' as const,
        points: Object.freeze(candidate.points.map(point => Object.freeze(point))),
        conflictingCandidateIds: Object.freeze(candidate.conflicts) }) : Object.freeze(candidate));
    return Object.freeze({ status: 'inspected', sourceKey: source.sourceKey, candidates: Object.freeze(candidates),
      excludedPlacemarkCount: parsed.excludedPlacemarkCount });
  } catch (error) {
    return held(error instanceof ImportHold ? error.message : 'unsafe-source');
  }
}

/** A pure append is separate from the parent's current actor/source/allocation
 * authority. Reinspect raw geometry rather than trusting a mutable preview. */
export function appendFieldLayoutImport(request: FieldLayoutImportAppendRequest): FieldLayoutImportAppendResult {
  try {
    const inspection = inspectFieldLayoutImport(request);
    if (inspection.status !== 'inspected') return inspection;
    if (own(request, 'expectedSourceKey') !== inspection.sourceKey) return held('source-changed');
    const snapshot = inspectFieldLayoutData(own(request, 'selections'));
    if (snapshot.status !== 'ready') return snapshot;
    const selections = snapshot.value;
    if (!Array.isArray(selections) || selections.length === 0) return held('selection-required');
    if (selections.length > FIELD_LAYOUT_IMPORT_LIMITS.candidates) return held('work-limit');
    const original = own(request, 'rawState') as DesignCanvasState;
    const usedIds = new Set([...original.items, ...original.zones, ...original.lines].map(row => row.id));
    const selectedIds = new Set<string>();
    const zones: ZoneShape[] = [];
    for (const selection of selections) {
      if (!record(selection) || !identity(selection.candidateId) || !identity(selection.zoneId)
        || selection.name !== undefined && !label(selection.name)
        || Object.keys(selection).some(key => !['candidateId', 'zoneId', 'name'].includes(key))) return held('invalid-selection');
      if (usedIds.has(selection.zoneId) || selectedIds.has(selection.candidateId)) return held('ambiguous-selection');
      const candidate = inspection.candidates.find(row => row.id === selection.candidateId);
      if (!candidate || candidate.status !== 'ready') return held('candidate-unavailable');
      if (candidate.conflictingCandidateIds.some(id => selectedIds.has(id))) return held('selected-candidates-overlap');
      usedIds.add(selection.zoneId); selectedIds.add(selection.candidateId);
      zones.push({ id: selection.zoneId, zone: 3, feature: 'staple_garden', status: 'proposed',
        name: typeof selection.name === 'string' && selection.name.trim() ? selection.name.trim() : 'Imported field',
        points: candidate.points.map(point => [point[0], point[1]]) });
    }
    const finalSource = inspectFieldLayoutMapSource({ rawState: original,
      effectiveFrame: own(request, 'effectiveFrame') as FieldLayoutExportFrame });
    if (finalSource.status !== 'ready' || finalSource.sourceKey !== inspection.sourceKey) return held('source-changed');
    return { status: 'ready', state: { ...original, zones: [...original.zones, ...zones] },
      addedZoneIds: Object.freeze(zones.map(zone => zone.id)) };
  } catch (error) {
    return held(error instanceof ImportHold ? error.message : 'unsafe-source');
  }
}
