import { designBaseMode, activeBaseMPerPx, makeMercatorUnprojector, lngLatToWorld,
  MIN_SCALE_FACTOR, MAX_SCALE_FACTOR, type CanvasFrame, type DesignCanvasState } from './design-canvas';
import { fieldBlockRectangleFootprint, MIN_BED_DIM_M, MAX_BED_DIM_M, MAX_PATH_M } from './bed-block';
import { ELEMENTS_BY_ID } from './design-elements';

export type FieldLayoutExportFrame = Pick<CanvasFrame, 'centerLng' | 'centerLat' | 'zoom' | 'imgW' | 'imgH' | 'mPerPx'>;
export interface FieldLayoutExportRequest {
  readonly rawState: unknown;
  /** Already-effective parent frame. This function never reapplies scaleFactor. */
  readonly effectiveFrame: FieldLayoutExportFrame;
  readonly selection: { readonly kind: 'all' } | { readonly kind: 'selected'; readonly fieldId: string };
  readonly includeLabels?: boolean;
  readonly sample: boolean;
}
export type FieldLayoutExportReason = 'unsafe-source' | 'work-limit' | 'invalid-reference-frame'
  | 'calibration-frame-mismatch' | 'unsupported-base' | 'no-fields' | 'selected-field-missing'
  | 'ambiguous-identities' | 'invalid-field' | 'invalid-field-markers' | 'invalid-bed'
  | 'invalid-path' | 'invalid-coordinate' | 'antimeridian-unsupported' | 'mercator-latitude-clamped';
export type FieldLayoutExportHold = { readonly status: 'held'; readonly reasons: readonly FieldLayoutExportReason[] };
export interface FieldLayoutExportReady {
  readonly status: 'ready';
  readonly filename: 'field-layout.kml';
  readonly mimeType: 'application/vnd.google-earth.kml+xml';
  readonly kml: string;
  /** Private comparison material. Never write this into the exported file. */
  readonly sourceKey: string;
  readonly counts: Readonly<{ fields: number; beds: number; paths: number }>;
  readonly disclosure: string;
}

/** Software work ceilings only, not farm sizes, recommended beds or map accuracy. */
export const FIELD_LAYOUT_EXPORT_LIMITS = Object.freeze({ rows: 10_000, points: 50_000, ringPoints: 512,
  topologyComparisons: 1_000_000, sourceNodes: 200_000, sourceCharacters: 8_000_000 });
const KML_NAMESPACE = 'http://www.opengis.net/kml/2.2';
const frameKeys = ['centerLng', 'centerLat', 'zoom', 'imgW', 'imgH', 'mPerPx'] as const;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const identity = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 2000 && !/[\u0000-\u001f\u007f]/.test(value);
const xmlText = (value: unknown): value is string => typeof value === 'string' && value.length <= 2000
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(value);
type Point = [number, number];
type Row = Record<string, unknown>;
type Field = { row: Row; points: Point[]; beds: Row[]; paths: Row[] };
type Model = { fields: Field[]; frame: FieldLayoutExportFrame; sourceKey: string; includeLabels: boolean; sample: boolean };
class ExportHold extends Error {
  readonly reason: FieldLayoutExportReason;
  constructor(reason: FieldLayoutExportReason) { super(reason); this.reason = reason; }
}
const fail = (reason: FieldLayoutExportReason): never => { throw new ExportHold(reason); };

function detachedData(value: unknown): unknown {
  const parents = new Set<object>(); let nodes = 0, characters = 0;
  const copy = (input: unknown): unknown => {
    if (++nodes > FIELD_LAYOUT_EXPORT_LIMITS.sourceNodes) return fail('work-limit');
    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      characters += input.length;
      if (characters > FIELD_LAYOUT_EXPORT_LIMITS.sourceCharacters) return fail('work-limit');
      return input;
    }
    if (finite(input)) return input;
    if (!input || typeof input !== 'object' || parents.has(input)) return fail('unsafe-source');
    const prototype = Object.getPrototypeOf(input);
    if (!Array.isArray(input) && prototype !== Object.prototype && prototype !== null) return fail('unsafe-source');
    parents.add(input);
    try {
      if (Array.isArray(input)) {
        if (input.length > FIELD_LAYOUT_EXPORT_LIMITS.sourceNodes) return fail('work-limit');
        const keys = Reflect.ownKeys(input);
        if (keys.length !== input.length + 1 || keys.some(key => key !== 'length'
          && (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= input.length))) return fail('unsafe-source');
        return Array.from({ length: input.length }, (_, index) => {
          const property = Object.getOwnPropertyDescriptor(input, String(index));
          if (!property || !property.enumerable || !('value' in property)) return fail('unsafe-source');
          return copy(property.value);
        });
      }
      const output: Row = Object.create(null);
      for (const key of Reflect.ownKeys(input)) {
        const property = Object.getOwnPropertyDescriptor(input, key)!;
        if (typeof key !== 'string' || !property.enumerable || !('value' in property)) return fail('unsafe-source');
        // Ordinary optional object fields follow their existing JSON semantics;
        // holes, unsafe descriptors and undefined array entries never do.
        if (property.value !== undefined) output[key] = copy(property.value);
      }
      return output;
    } finally { parents.delete(input); }
  };
  return copy(value);
}

function frameFrom(value: unknown): FieldLayoutExportFrame {
  if (!record(value) || !frameKeys.every(key => finite(value[key]))) return fail('invalid-reference-frame');
  const frame = Object.fromEntries(frameKeys.map(key => [key, value[key]])) as unknown as FieldLayoutExportFrame;
  if (frame.centerLng < -180 || frame.centerLng > 180 || frame.centerLat <= -90 || frame.centerLat >= 90
    || frame.zoom < 0 || frame.zoom > 24 || !positive(frame.imgW) || !positive(frame.imgH) || !positive(frame.mPerPx)
    || !positive(frame.imgW * frame.mPerPx) || !positive(frame.imgH * frame.mPerPx)) return fail('invalid-reference-frame');
  // The existing projector clamps at its polar edges. Compare against that
  // authority's own boundary outputs rather than inventing a latitude constant.
  const y = lngLatToWorld(frame.centerLng, frame.centerLat, frame.zoom)[1];
  const north = lngLatToWorld(frame.centerLng, 90, frame.zoom)[1], south = lngLatToWorld(frame.centerLng, -90, frame.zoom)[1];
  if (!finite(y) || y <= north || y >= south) return fail('mercator-latitude-clamped');
  return frame;
}
function samePoint(a: Point, b: Point): boolean { return a[0] === b[0] && a[1] === b[1]; }
function cross(a: Point, b: Point, c: Point): number { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
function onSegment(a: Point, b: Point, p: Point): boolean {
  return cross(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
    && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);
}
function intersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const ca = cross(a, b, c), da = cross(a, b, d), ac = cross(c, d, a), bc = cross(c, d, b);
  return (ca === 0 && onSegment(a, b, c)) || (da === 0 && onSegment(a, b, d))
    || (ac === 0 && onSegment(c, d, a)) || (bc === 0 && onSegment(c, d, b))
    || (((ca > 0 && da < 0) || (ca < 0 && da > 0)) && ((ac > 0 && bc < 0) || (ac < 0 && bc > 0)));
}
function signedArea(points: readonly Point[]): number {
  const first = points[0]; let twice = 0;
  for (let i = 1; i + 1 < points.length; i++) twice += cross(first, points[i], points[i + 1]);
  return twice / 2;
}
function pointsFrom(value: unknown, ring: boolean, budget: { points: number; comparisons: number }): Point[] {
  if (!Array.isArray(value) || value.length < (ring ? 3 : 2)) return fail(ring ? 'invalid-field' : 'invalid-path');
  budget.points += value.length;
  if (budget.points > FIELD_LAYOUT_EXPORT_LIMITS.points || ring && value.length > FIELD_LAYOUT_EXPORT_LIMITS.ringPoints) return fail('work-limit');
  const points = value.map(point => {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(finite) || point.some(value => value < 0 || value > 1)) return fail('invalid-coordinate');
    return [point[0], point[1]] as Point;
  });
  if (ring && samePoint(points[0], points[points.length - 1])) points.pop();
  if (points.length < (ring ? 3 : 2) || points.some((point, index) => index > 0 && samePoint(point, points[index - 1]))) return fail(ring ? 'invalid-field' : 'invalid-path');
  if (!ring) return points;
  if (new Set(points.map(point => JSON.stringify(point))).size !== points.length || !finite(signedArea(points)) || signedArea(points) === 0) return fail('invalid-field');
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    if (j === i + 1 || i === 0 && j === points.length - 1) continue;
    if (++budget.comparisons > FIELD_LAYOUT_EXPORT_LIMITS.topologyComparisons) return fail('work-limit');
    if (intersect(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return fail('invalid-field');
  }
  return points;
}
function labelValid(row: Row, key: string): void {
  if (row[key] !== undefined && !xmlText(row[key])) fail('unsafe-source');
}
function inspect(request: FieldLayoutExportRequest): Model {
  // The live frame may also contain large image bytes. They are neither a
  // projection input nor export evidence; capture only its six defined fields.
  const own = (value: unknown, key: string, optional = false): unknown => {
    if (!record(value)) return fail('unsafe-source');
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property && optional) return undefined;
    if (!property || !property.enumerable || !('value' in property)) return fail('unsafe-source');
    return property.value;
  };
  const actualFrame = own(request, 'effectiveFrame');
  const copied = detachedData({ rawState: own(request, 'rawState'),
    effectiveFrame: Object.fromEntries(frameKeys.map(key => [key, own(actualFrame, key)])),
    selection: own(request, 'selection'), includeLabels: own(request, 'includeLabels', true), sample: own(request, 'sample') });
  if (!record(copied) || typeof copied.sample !== 'boolean' || copied.includeLabels !== undefined && typeof copied.includeLabels !== 'boolean'
    || !record(copied.rawState) || !record(copied.selection)) return fail('unsafe-source');
  const state = copied.rawState, selection = copied.selection;
  if (selection.kind !== 'all' && selection.kind !== 'selected' || selection.kind === 'selected' && !identity(selection.fieldId)) return fail('selected-field-missing');
  if (!identity(state.siteId) || !Array.isArray(state.items) || !Array.isArray(state.zones) || !Array.isArray(state.lines)) return fail('unsafe-source');
  const frame = frameFrom(copied.effectiveFrame), saved = frameFrom(state.frame);
  // Saved frames can already contain the physical correction. Require the
  // captured effective frame to agree; never guess its history and multiply again.
  if (frameKeys.some(key => frame[key] !== saved[key])) return fail('calibration-frame-mismatch');
  if (state.scaleFactor !== undefined && (!finite(state.scaleFactor) || state.scaleFactor < MIN_SCALE_FACTOR || state.scaleFactor > MAX_SCALE_FACTOR)) return fail('invalid-reference-frame');
  if (state.baseMode !== undefined && !['satellite', 'photo', 'blank'].includes(state.baseMode as string)
    || state.useCustomBase !== undefined && typeof state.useCustomBase !== 'boolean') return fail('unsupported-base');
  const mode = designBaseMode(state as unknown as DesignCanvasState);
  if (mode !== 'satellite' || activeBaseMPerPx(state as unknown as DesignCanvasState, frame.mPerPx) !== frame.mPerPx) return fail('unsupported-base');
  const rows = [...state.zones, ...state.items, ...state.lines];
  if (rows.length > FIELD_LAYOUT_EXPORT_LIMITS.rows) return fail('work-limit');
  const ids = new Set<string>();
  for (const row of rows) {
    if (!record(row) || !identity(row.id)) return fail('unsafe-source');
    if (ids.has(row.id)) return fail('ambiguous-identities');
    ids.add(row.id);
  }
  const budget = { points: 0, comparisons: 0 };
  const fields: Field[] = [];
  for (const zone of state.zones as Row[]) {
    if (zone.fieldBlock !== undefined && zone.feature !== 'staple_garden') return fail('invalid-field-markers');
    if (zone.feature !== 'staple_garden') continue;
    labelValid(zone, 'name');
    const points = pointsFrom(zone.points, true, budget);
    if (zone.fieldBlock !== undefined) {
      const config = zone.fieldBlock;
      if (!record(config) || !['beds', 'open'].includes(config.mode as string)
        || !positive(config.bedLengthM) || config.bedLengthM < MIN_BED_DIM_M || config.bedLengthM > MAX_BED_DIM_M
        || !positive(config.bedWidthM) || config.bedWidthM < MIN_BED_DIM_M || config.bedWidthM > MAX_BED_DIM_M
        || !finite(config.pathWidthM) || config.pathWidthM < 0 || config.pathWidthM > MAX_PATH_M || !finite(config.angleDeg)) return fail('invalid-field-markers');
    }
    fields.push({ row: zone, points, beds: [], paths: [] });
  }
  for (const item of state.items as Row[]) {
    if (!Object.hasOwn(item, 'fieldBlockId')) continue;
    const field = fields.find(field => field.row.id === item.fieldBlockId);
    if (!field || !record(field.row.fieldBlock) || field.row.fieldBlock.mode !== 'beds') return fail('invalid-field-markers');
    const def = typeof item.defId === 'string' ? ELEMENTS_BY_ID[item.defId] : null;
    if (!def || def.shape !== 'rect' || !['veg_bed', 'raised_bed'].includes(item.defId as string)
      || !finite(item.x) || !finite(item.y) || item.x < 0 || item.x > 1 || item.y < 0 || item.y > 1
      || !positive(item.wM) || !positive(item.hM) || item.rot !== undefined && !finite(item.rot)) return fail('invalid-bed');
    labelValid(item, 'label'); field.beds.push(item);
  }
  for (const line of state.lines as Row[]) {
    if (!Object.hasOwn(line, 'fieldBlockId')) continue;
    const field = fields.find(field => field.row.id === line.fieldBlockId);
    if (!field || !record(field.row.fieldBlock) || field.row.fieldBlock.mode !== 'beds') return fail('invalid-field-markers');
    if (line.kind !== 'bedpath' || !positive(line.widthM) || line.widthM > MAX_PATH_M) return fail('invalid-path');
    labelValid(line, 'name'); pointsFrom(line.points, false, budget); field.paths.push(line);
  }
  if (!fields.length) return fail('no-fields');
  const chosen = selection.kind === 'all' ? fields : fields.filter(field => field.row.id === selection.fieldId);
  if (!chosen.length) return fail('selected-field-missing');
  for (const field of chosen) if (record(field.row.fieldBlock) && field.row.fieldBlock.mode === 'beds' && !field.beds.length) return fail('invalid-field-markers');
  const source = { version: 1, siteId: state.siteId, selection, includeLabels: copied.includeLabels === true, sample: copied.sample,
    savedFrame: saved, effectiveFrame: frame, baseMode: mode, scaleFactor: state.scaleFactor,
    base: { useCustomBase: state.useCustomBase, blankMPerPx: state.blankMPerPx,
      customBase: record(state.customBase) ? { mPerPx: state.customBase.mPerPx, scale: state.customBase.scale,
        dx: state.customBase.dx, dy: state.customBase.dy, rotationDeg: state.customBase.rotationDeg } : state.customBase },
    fields: chosen.map(field => ({ field: field.row, beds: field.beds, paths: field.paths })) };
  const ordered = (_key: string, value: unknown) => record(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]])) : value;
  return { fields: chosen, frame, sourceKey: JSON.stringify(source, ordered), includeLabels: copied.includeLabels === true, sample: copied.sample };
}

/** Private source comparison only. A key is neither live authorization nor a
 * substitute for the caller's fresh raw receipt/actor/sample delivery checks. */
export function fieldLayoutExportSourceKey(request: FieldLayoutExportRequest): string | null {
  const result = buildFieldLayoutKml(request);
  return result.status === 'ready' ? result.sourceKey : null;
}
function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
const coordinateText = (points: readonly Point[]) => points.map(point => `${point[0]},${point[1]},0`).join(' ');

/** A local file only. Map-reference positions do not certify survey accuracy,
 * crop suitability, a saved-plan write, or acceptance by any particular client. */
export function buildFieldLayoutKml(request: FieldLayoutExportRequest): FieldLayoutExportReady | FieldLayoutExportHold {
  try {
    const model = inspect(request), frame = model.frame;
    const unproject = makeMercatorUnprojector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH);
    const north = lngLatToWorld(frame.centerLng, 90, frame.zoom)[1], south = lngLatToWorld(frame.centerLng, -90, frame.zoom)[1];
    const project = (point: Point): Point => {
      const result = unproject(point);
      if (!result.every(finite) || result[1] <= -90 || result[1] >= 90) return fail('invalid-coordinate');
      if (result[0] < -180 || result[0] > 180) return fail('antimeridian-unsupported');
      const y = lngLatToWorld(result[0], result[1], frame.zoom)[1];
      if (y <= north || y >= south) return fail('mercator-latitude-clamped');
      return result;
    };
    const projected = (points: readonly Point[]) => {
      const result = points.map(project);
      if (Math.max(...result.map(point => point[0])) - Math.min(...result.map(point => point[0])) > 180) return fail('antimeridian-unsupported');
      return result;
    };
    const ring = (points: readonly Point[]): Point[] => {
      const result = projected(points);
      const area = signedArea(result);
      if (!finite(area) || area === 0) return fail('invalid-coordinate');
      if (area < 0) result.reverse();
      result.push([...result[0]]); return result;
    };
    const name = (generic: string, label?: unknown) => escapeXml(`${model.sample ? 'DEMO — ' : ''}${model.includeLabels && typeof label === 'string' && label.trim() ? label : generic}`);
    const polygon = (title: string, points: readonly Point[]) => `<Placemark><name>${title}</name><Polygon><altitudeMode>clampToGround</altitudeMode><outerBoundaryIs><LinearRing><coordinates>${coordinateText(ring(points))}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
    let beds = 0, paths = 0;
    const folders = model.fields.map((field, fieldIndex) => {
      const generic = `Field ${fieldIndex + 1}`, title = name(generic, field.row.name);
      const children = [polygon(title, field.points)];
      for (const [bedIndex, bed] of field.beds.entries()) {
        const points = fieldBlockRectangleFootprint({ x: bed.x as number, y: bed.y as number,
          wM: bed.wM as number, hM: bed.hM as number, rot: bed.rot as number | undefined }, frame);
        if (!points.every(point => point.every(finite))) return fail('invalid-bed');
        children.push(polygon(name(`${generic} / Bed ${bedIndex + 1}`, bed.label), points)); beds++;
      }
      for (const [pathIndex, path] of field.paths.entries()) {
        const points = projected(path.points as Point[]);
        children.push(`<Placemark><name>${name(`${generic} / Path ${pathIndex + 1}`, path.name)}</name><description>Saved path centreline; stored width ${path.widthM} m. This line is not a width corridor.</description><LineString><altitudeMode>clampToGround</altitudeMode><coordinates>${coordinateText(points)}</coordinates></LineString></Placemark>`); paths++;
      }
      return `<Folder><name>${title}</name>${children.join('')}</Folder>`;
    });
    const disclosure = `${model.sample ? 'DEMO sample. ' : ''}This file contains the chosen map location${model.includeLabels ? ' and included field, bed or path labels, which may contain personal information' : '; user-authored labels are omitted'}. Coordinates are map-reference estimates, not surveyed boundaries. Bed shapes and path centrelines come from saved layout geometry; no beds are regenerated.`;
    const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="${KML_NAMESPACE}"><Document><name>${name('Field layout')}</name><description>${escapeXml(disclosure)}</description>${folders.join('')}</Document></kml>\n`;
    return Object.freeze({ status: 'ready', filename: 'field-layout.kml', mimeType: 'application/vnd.google-earth.kml+xml',
      kml, sourceKey: model.sourceKey, counts: Object.freeze({ fields: model.fields.length, beds, paths }), disclosure });
  } catch (error) {
    const reason: FieldLayoutExportReason = error instanceof ExportHold ? error.reason : 'unsafe-source';
    return Object.freeze({ status: 'held', reasons: Object.freeze([reason]) });
  }
}
