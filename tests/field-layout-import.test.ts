import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFieldLayoutImport, inspectFieldLayoutImport, FIELD_LAYOUT_IMPORT_LIMITS,
  type FieldLayoutImportInspection, type FieldLayoutImportRequest } from '../lib/field-layout-import.ts';
import { buildFieldLayoutKml, inspectFieldLayoutMapSource } from '../lib/field-layout-export.ts';
import { fieldBlockExclusions, fieldBlockRectangleFootprint } from '../lib/bed-block.ts';
import { makeMercatorUnprojector, type DesignCanvasState } from '../lib/design-canvas.ts';
import type { FieldLayoutKmlCandidate } from '../lib/field-layout-import.types.ts';

// All geometry and dimensions are synthetic engineering fixtures. No field
// location, agricultural spacing or recommended map accuracy is represented.
function state(): DesignCanvasState {
  return { siteId: 'synthetic-import-site',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 200, imgH: 100, mPerPx: 0.5 },
    items: [], zones: [], lines: [], step: 'planting', updatedAt: '2026-11-04T00:00:00.000Z' };
}
type Point = [number, number];
const square = (x = 0.2, y = 0.2, side = 0.2): Point[] => [[x, y], [x + side, y], [x + side, y + side], [x, y + side]];
function candidate(id = 'polygon-1', points = square(), frame: DesignCanvasState['frame'] = state().frame): FieldLayoutKmlCandidate {
  const unproject = makeMercatorUnprojector(frame.centerLng, frame.centerLat, frame.zoom, frame.imgW, frame.imgH);
  const ring = points.map(point => unproject(point));
  ring.push([...ring[0]]);
  return { id, name: 'External label suggestion', ring };
}
function request(rawState = state(), candidates = [candidate()]): FieldLayoutImportRequest {
  return { rawState, effectiveFrame: rawState.frame, parsed: { status: 'parsed', candidates, excludedPlacemarkCount: 0 } };
}
type Inspected = Extract<FieldLayoutImportInspection, { status: 'inspected' }>;
function inspected(input = request()): Inspected {
  const result = inspectFieldLayoutImport(input);
  assert.equal(result.status, 'inspected', JSON.stringify(result));
  if (result.status !== 'inspected') throw Error('Inspection held');
  return result;
}
function ready(input = request(), index = 0) {
  const result = inspected(input).candidates[index];
  assert.equal(result.status, 'ready', JSON.stringify(result));
  if (result.status !== 'ready') throw Error('Candidate held');
  return result;
}
function heldCandidate(input: FieldLayoutImportRequest, reason: string) {
  const result = inspected(input).candidates[0];
  assert.equal(result.status, 'held', JSON.stringify(result));
  if (result.status === 'held') assert.ok(result.reasons.includes(reason), JSON.stringify(result));
}
function append(input = request(), selections = [{ candidateId: 'polygon-1', zoneId: 'fresh-zone' }]) {
  return appendFieldLayoutImport({ ...input, selections, expectedSourceKey: inspected(input).sourceKey });
}
function near(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} versus ${expected}`); }

test('an empty satellite map can preview polygons while the same source still has nothing to export', () => {
  const raw = state(), before = structuredClone(raw);
  const source = inspectFieldLayoutMapSource({ rawState: raw, effectiveFrame: raw.frame });
  assert.equal(source.status, 'ready');
  assert.deepEqual(buildFieldLayoutKml({ rawState: raw, effectiveFrame: raw.frame, sample: false, selection: { kind: 'all' } }),
    { status: 'held', reasons: ['no-fields'] });
  const preview = ready(request(raw));
  for (let i = 0; i < square().length; i++) {
    near(preview.points[i][0], square()[i][0]); near(preview.points[i][1], square()[i][1]);
  }
  assert.deepEqual(raw, before);
  assert.equal(Object.isFrozen(raw), false);
});

test('explicit append keeps every old geometry object and metadata and adds no inferred bed layout', () => {
  const raw = state();
  raw.zones.push({ id: 'old-field', feature: 'staple_garden', zone: 3, points: square(0.7, 0.7, 0.1), name: 'Original field' });
  raw.items.push({ id: 'old-bed', defId: 'veg_bed', x: 0.75, y: 0.75, wM: 2, hM: 3, note: undefined });
  raw.lines.push({ id: 'old-line', kind: 'bedpath', points: [[0.7, 0.9], [0.8, 0.9]], widthM: 1 });
  const before = structuredClone(raw), input = request(raw), result = append(input);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  if (result.status !== 'ready') return;
  assert.equal(result.state.items, raw.items); assert.equal(result.state.lines, raw.lines);
  assert.equal(result.state.zones[0], raw.zones[0]); assert.equal(result.state.frame, raw.frame);
  assert.ok(Object.hasOwn(result.state.items[0], 'note'));
  assert.deepEqual(result.addedZoneIds, ['fresh-zone']);
  const imported = result.state.zones[1];
  assert.equal(imported.name, 'Imported field'); assert.equal(imported.feature, 'staple_garden');
  assert.equal(imported.status, 'proposed'); assert.equal(imported.id, 'fresh-zone');
  assert.equal('fieldBlock' in imported, false);
  assert.deepEqual(raw, before);
  const after = inspected(request(result.state));
  assert.equal(after.candidates[0].status, 'held', 'Importing the same polygon twice cannot silently create a second capacity area');
});

test('external labels remain suggestions until the explicit append selection supplies a name', () => {
  const input = request(), result = appendFieldLayoutImport({ ...input, expectedSourceKey: inspected(input).sourceKey,
    selections: [{ candidateId: 'polygon-1', zoneId: 'fresh-zone', name: 'Chosen field label' }] });
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.equal(result.state.zones[0].name, 'Chosen field label');
  assert.equal(inspected(input).candidates[0].name, 'External label suggestion');
});

test('selection starts empty and fresh zone identities cannot reuse any field, element or line identity', () => {
  const raw = state();
  raw.zones.push({ id: 'old-field', feature: 'staple_garden', zone: 3, points: square(0.7, 0.7, 0.1) });
  raw.items.push({ id: 'old-item', defId: 'veg_bed', x: 0.8, y: 0.8, wM: 2, hM: 3 });
  raw.lines.push({ id: 'old-line', kind: 'bedpath', points: [[0.7, 0.9], [0.8, 0.9]], widthM: 1 });
  const input = request(raw), sourceKey = inspected(input).sourceKey;
  for (const selections of [[], [{ candidateId: 'missing', zoneId: 'fresh' }],
    ...['old-field', 'old-item', 'old-line'].map(zoneId => [{ candidateId: 'polygon-1', zoneId }]),
    [{ candidateId: 'polygon-1', zoneId: 'fresh-a' }, { candidateId: 'polygon-1', zoneId: 'fresh-b' }]]) {
    assert.equal(appendFieldLayoutImport({ ...input, selections, expectedSourceKey: sourceKey }).status, 'held');
  }
});

test('nested parent and bed polygons stay visible as conflicting choices and only one may be selected', () => {
  const input = request(state(), [candidate('polygon-parent', square(0.1, 0.1, 0.7)), candidate('polygon-child', square(0.2, 0.2, 0.1))]);
  const result = inspected(input), first = ready(input), second = ready(input, 1);
  assert.deepEqual(first.conflictingCandidateIds, ['polygon-child']);
  assert.deepEqual(second.conflictingCandidateIds, ['polygon-parent']);
  for (const candidateId of ['polygon-parent', 'polygon-child']) {
    assert.equal(append(input, [{ candidateId, zoneId: 'explicit-choice' }]).status, 'ready');
  }
  for (const ids of [['polygon-parent', 'polygon-child'], ['polygon-child', 'polygon-parent']]) {
    const appended = appendFieldLayoutImport({ ...input, expectedSourceKey: result.sourceKey,
      selections: ids.map((candidateId, index) => ({ candidateId, zoneId: `fresh-${index}` })) });
    assert.deepEqual(appended, { status: 'held', reasons: ['selected-candidates-overlap'] });
  }
});

test('duplicate polygons never gain field type from labels, list order or imported IDs', () => {
  const parent = candidate('bed-looking-id');
  const duplicate = { ...parent, id: 'field-looking-id', name: 'Field 1' };
  for (const candidates of [[parent, duplicate], [duplicate, parent]]) {
    const result = inspected(request(state(), candidates));
    for (const row of result.candidates) {
      assert.equal(row.status, 'ready');
      if (row.status === 'ready') assert.equal(row.conflictingCandidateIds.length, 1);
    }
  }
  const duplicateIds = inspected(request(state(), [parent, { ...duplicate, id: parent.id }]));
  assert.ok(duplicateIds.candidates.every(row => row.status === 'held' && row.reasons.includes('ambiguous-candidate-id')));
});

test('separate selected polygons append together and an unselected conflicting candidate does not become saved ground', () => {
  const input = request(state(), [candidate('first', square(0.1, 0.1, 0.15)), candidate('second', square(0.7, 0.7, 0.1)),
    candidate('ignored-overlap', square(0.12, 0.12, 0.05))]);
  const result = append(input, [{ candidateId: 'first', zoneId: 'new-first' }, { candidateId: 'second', zoneId: 'new-second' }]);
  assert.equal(result.status, 'ready');
  if (result.status === 'ready') assert.deepEqual(result.state.zones.map(row => row.id), ['new-first', 'new-second']);
});

test('existing field ground and every actual placed exclusion hold an overlapping candidate', () => {
  for (const feature of ['staple_garden', 'house', 'patio', 'driveway'] as const) {
    const raw = state(); raw.zones.push({ id: 'existing-ground', zone: 3, feature, points: square() });
    heldCandidate(request(raw), 'existing-ground-overlap');
  }
  const raw = state(); raw.items.push({ id: 'placed-bed', defId: 'veg_bed', x: 0.3, y: 0.3, wM: 6, hM: 3, rot: 29 });
  assert.deepEqual(fieldBlockExclusions(raw, '', raw.frame)[0], fieldBlockRectangleFootprint(raw.items[0] as Required<typeof raw.items[0]>, raw.frame));
  heldCandidate(request(raw), 'existing-ground-overlap');
  ready(request(raw, [candidate('separate', square(0.7, 0.7, 0.1))]));
});

test('invalid or unknown source footprints cannot disappear from the overlap decision', () => {
  for (const item of [{ id: 'unknown', defId: 'not-a-real-definition', x: 0.8, y: 0.8 },
    { id: 'nonfinite', defId: 'veg_bed', x: Number.NaN, y: 0.8 },
    { id: 'negative-size', defId: 'veg_bed', x: 0.8, y: 0.8, wM: -1 }]) {
    const raw = state(); raw.items.push(item);
    assert.equal(inspectFieldLayoutImport(request(raw)).status, 'held');
  }
  const raw = state(); raw.zones.push({ id: 'broken-house', zone: 3, feature: 'house', points: [[0.8, 0.8], [0.9, 0.9]] });
  assert.equal(inspectFieldLayoutImport(request(raw)).status, 'held');
  const future = state();
  future.zones.push({ id: 'unknown-ground', zone: 3, feature: 'unknown-future-ground' as never, points: square(0.7, 0.7, 0.1) });
  assert.equal(inspectFieldLayoutImport(request(future)).status, 'held');
});

test('unclosed, repeated, degenerate and crossing rings remain visible but held', () => {
  const base = candidate();
  const malformed = [base.ring.slice(0, -1), [base.ring[0], base.ring[1], base.ring[0], base.ring[0]],
    [base.ring[0], base.ring[1], base.ring[1], base.ring[2], base.ring[0]],
    candidate('crossed', [[0.2, 0.2], [0.4, 0.4], [0.4, 0.2], [0.2, 0.4]]).ring,
    candidate('collinear', [[0.2, 0.2], [0.3, 0.2], [0.4, 0.2]]).ring];
  for (const geographic of malformed) {
    const result = inspected(request(state(), [{ ...base, ring: geographic }]));
    assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].status, 'held');
  }
});

test('geographic bounds, actual polar clamping and date-line ambiguity hold before low-level projection fallback', () => {
  for (const ring of [
    [[179, 0], [-179, 0], [-179, 1], [179, 0]],
    [[0, 89.99], [0.001, 89.99], [0.001, 89.98], [0, 89.99]],
    [[181, 0], [181, 1], [180, 1], [181, 0]],
    [[0, 0], [Number.POSITIVE_INFINITY, 0], [0, 1], [0, 0]],
  ]) {
    const result = inspectFieldLayoutImport(request(state(), [{ ...candidate(), ring: ring as Point[] }]));
    assert.ok(result.status === 'held' || result.candidates[0].status === 'held');
  }
  heldCandidate(request(state(), [candidate('outside', square(1.1, 0.2, 0.1))]), 'outside-canvas');
});

test('concave polygons retain vertices and physical area through the actual reference projector', () => {
  const points: Point[] = [[0.1, 0.1], [0.5, 0.1], [0.5, 0.3], [0.3, 0.3], [0.3, 0.5], [0.1, 0.5]];
  const actual = ready(request(state(), [candidate('concave', points)])).points;
  assert.equal(actual.length, points.length);
  actual.forEach((point, index) => { near(point[0], points[index][0]); near(point[1], points[index][1]); });
  const area = (ring: readonly (readonly number[])[]) => Math.abs(ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1];
  }, 0)) / 2;
  near(area(actual), area(points));
});

test('the source key detects every footprint, ground, label, line and saved calibration change before append', () => {
  const baseline = state();
  baseline.zones.push({ id: 'old-zone', zone: 3, feature: 'lawn', points: square(0.7, 0.7, 0.1), name: 'Saved label' });
  baseline.items.push({ id: 'old-bed', defId: 'veg_bed', x: 0.8, y: 0.8, wM: 2, hM: 3 });
  baseline.lines.push({ id: 'old-line', kind: 'bedpath', points: [[0.7, 0.9], [0.8, 0.9]], widthM: 1 });
  const sourceKey = inspected(request(baseline)).sourceKey;
  for (const mutate of [
    (raw: DesignCanvasState) => { raw.zones[0].name = 'Changed label'; },
    (raw: DesignCanvasState) => { raw.zones[0].points[0][0] += 0.01; },
    (raw: DesignCanvasState) => { raw.items[0].rot = 17; },
    (raw: DesignCanvasState) => { raw.items[0].wM = 7; },
    (raw: DesignCanvasState) => { raw.lines[0].widthM = 2; },
    (raw: DesignCanvasState) => { raw.scaleFactor = 1.1; },
    (raw: DesignCanvasState) => { raw.frame.mPerPx = 0.6; },
  ]) {
    const raw = structuredClone(baseline); mutate(raw);
    const result = appendFieldLayoutImport({ ...request(raw), expectedSourceKey: sourceKey,
      selections: [{ candidateId: 'polygon-1', zoneId: 'fresh' }] });
    assert.equal(result.status, 'held');
  }
  const clone = structuredClone(baseline); clone.updatedAt = '2026-11-04T00:01:00.000Z'; clone.rev = 10;
  assert.equal(inspected(request(clone)).sourceKey, sourceKey, 'Incidental revision metadata does not change geometric source identity');
});

test('photo, blank, polar and mismatched saved/current reference frames remain held', () => {
  for (const mode of ['photo', 'blank'] as const) {
    const raw = state();
    // A photo mode without a photo resolves to satellite in the existing base
    // authority. Exercise a genuinely active calibrated photo instead.
    raw.customBase = { url: 'synthetic-private-photo', mPerPx: 0.1, uploadedAt: '2026-11-04T00:00:00.000Z' };
    raw.baseMode = mode;
    assert.equal(inspectFieldLayoutImport(request(raw)).status, 'held');
  }
  const raw = state();
  assert.equal(inspectFieldLayoutImport({ ...request(raw), effectiveFrame: { ...raw.frame, mPerPx: 0.6 } }).status, 'held');
  raw.frame.centerLat = 89.99;
  assert.equal(inspectFieldLayoutImport(request(raw)).status, 'held');
});

test('source, frame, parsed candidate and selection accessors are held without executing getters', () => {
  let getters = 0;
  const input = request(), source = inspected(input).sourceKey;
  const accessor = { enumerable: true, get() { getters++; throw Error('Must not execute'); } };
  for (const key of ['rawState', 'effectiveFrame', 'parsed']) {
    const unsafe = { ...input }; Object.defineProperty(unsafe, key, accessor);
    assert.equal(inspectFieldLayoutImport(unsafe).status, 'held');
  }
  const parsed = { ...input.parsed, candidates: [{ ...candidate() }] };
  Object.defineProperty(parsed.candidates[0], 'ring', accessor);
  assert.equal(inspectFieldLayoutImport({ ...input, parsed }).status, 'held');
  const selection = { candidateId: 'polygon-1', zoneId: 'fresh' }; Object.defineProperty(selection, 'zoneId', accessor);
  assert.equal(appendFieldLayoutImport({ ...input, expectedSourceKey: source, selections: [selection] }).status, 'held');
  assert.equal(getters, 0);
});

test('a reentrant selection capture cannot append using an earlier footprint snapshot', () => {
  const raw = state(), input = request(raw), sourceKey = inspected(input).sourceKey;
  const selection = new Proxy({ candidateId: 'polygon-1', zoneId: 'fresh-zone' }, {
    ownKeys(target) {
      raw.zones = [{ id: 'new-house', zone: 3, feature: 'house', points: square() }];
      return Reflect.ownKeys(target);
    },
  });
  const result = appendFieldLayoutImport({ ...input, expectedSourceKey: sourceKey, selections: [selection] });
  assert.deepEqual(result, { status: 'held', reasons: ['source-changed'] });
  assert.deepEqual(raw.zones.map(zone => zone.id), ['new-house']);
});

test('candidate and polygon topology ceilings fail closed with explicit software limits', () => {
  const many = Array.from({ length: FIELD_LAYOUT_IMPORT_LIMITS.candidates + 1 }, (_, i) => candidate(`candidate-${i}`));
  assert.deepEqual(inspectFieldLayoutImport(request(state(), many)), { status: 'held', reasons: ['work-limit'] });
  const vertices: Point[] = Array.from({ length: FIELD_LAYOUT_IMPORT_LIMITS.ringPoints + 1 }, (_, i) => {
    const angle = i * 2 * Math.PI / (FIELD_LAYOUT_IMPORT_LIMITS.ringPoints + 1);
    return [0.5 + Math.cos(angle) * 0.1, 0.5 + Math.sin(angle) * 0.1];
  });
  assert.deepEqual(inspectFieldLayoutImport(request(state(), [candidate('too-many-points', vertices)])), { status: 'held', reasons: ['work-limit'] });
  const smaller = vertices.filter((_, index) => index % 8 === 0);
  const overlapping = Array.from({ length: 40 }, (_, index) => candidate(`overlap-${index}`, smaller));
  assert.deepEqual(inspectFieldLayoutImport(request(state(), overlapping)), { status: 'held', reasons: ['work-limit'] });
});
