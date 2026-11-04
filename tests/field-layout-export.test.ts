import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildFieldLayoutKml, fieldLayoutExportSourceKey, FIELD_LAYOUT_EXPORT_LIMITS,
  type FieldLayoutExportRequest, type FieldLayoutExportReady } from '../lib/field-layout-export.ts';
import { configureFieldBlock, fieldBlockExclusions, fieldBlockRectangleFootprint } from '../lib/bed-block.ts';
import { makeMercatorProjector, type DesignCanvasState } from '../lib/design-canvas.ts';

// Synthetic engineering fixtures, not farm locations, bed recommendations or
// an independent validation of a map provider's georeferencing accuracy.
function state(): DesignCanvasState {
  return { siteId: 'synthetic-private-site-id',
    frame: { centerLng: 0, centerLat: 0, zoom: 18, imgW: 200, imgH: 100, mPerPx: 0.5 },
    items: [{ id: 'private-bed-id', defId: 'veg_bed', fieldBlockId: 'private-field-id', label: 'Private grower label',
      x: 0.5, y: 0.5, wM: 2, hM: 8 }],
    zones: [{ id: 'private-field-id', zone: 2, feature: 'staple_garden', name: 'Private field name',
      points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]],
      fieldBlock: { mode: 'beds', bedLengthM: 8, bedWidthM: 2, pathWidthM: 1, angleDeg: 90 } }],
    lines: [{ id: 'private-path-id', fieldBlockId: 'private-field-id', kind: 'bedpath', name: 'Private path name',
      points: [[0.3, 0.3], [0.7, 0.3]], widthM: 1 }], step: 'planting', updatedAt: '2026-11-04T00:00:00.000Z', rev: 1 };
}
function request(rawState: DesignCanvasState = state(), overrides: Partial<FieldLayoutExportRequest> = {}): FieldLayoutExportRequest {
  return { rawState, effectiveFrame: { ...rawState.frame }, selection: { kind: 'all' }, sample: false, ...overrides };
}
function ready(input = request()): FieldLayoutExportReady {
  const result = buildFieldLayoutKml(input);
  assert.equal(result.status, 'ready', JSON.stringify(result));
  if (result.status !== 'ready') throw Error('Export held');
  return result;
}
function held(input: FieldLayoutExportRequest, reason?: string) {
  const result = buildFieldLayoutKml(input); assert.equal(result.status, 'held');
  if (result.status !== 'held') throw Error('Invalid source became an export');
  if (reason) assert.ok(result.reasons.includes(reason as never), JSON.stringify(result));
  assert.equal(fieldLayoutExportSourceKey(input), null);
}
type Parsed = { names: string[]; folders: number; polygons: number[][][]; lines: number[][][]; descriptions: string[] };
function parse(kml: string): Parsed {
  // Independent standard-library XML parser and explicit structural contract.
  // It does not reuse the exporter or require a transitive runtime XML package.
  const script = `import json,sys,xml.etree.ElementTree as E
n={'k':'http://www.opengis.net/kml/2.2'}
r=E.fromstring(sys.stdin.read())
assert r.tag=='{'+n['k']+'}kml'
assert len(r)==1 and r[0].tag=='{'+n['k']+'}Document'
d=r[0]
allowed={'kml','Document','name','description','Folder','Placemark','Polygon','altitudeMode','outerBoundaryIs','LinearRing','coordinates','LineString'}
for e in r.iter():
 assert e.tag.startswith('{'+n['k']+'}') and e.tag.split('}',1)[1] in allowed
 assert not e.attrib
for f in d.findall('k:Folder',n):
 assert all(e.tag in ('{'+n['k']+'}name','{'+n['k']+'}Placemark') for e in f)
for p in r.findall('.//k:Placemark',n):
 assert len(p.findall('k:Polygon',n))+len(p.findall('k:LineString',n))==1
for e in r.findall('.//k:Polygon',n)+r.findall('.//k:LineString',n):
 assert e.find('k:altitudeMode',n).text=='clampToGround'
def coords(e):
 return [[float(x) for x in v.split(',')] for v in e.text.split()]
polys=[coords(e) for e in r.findall('.//k:Polygon/k:outerBoundaryIs/k:LinearRing/k:coordinates',n)]
lines=[coords(e) for e in r.findall('.//k:LineString/k:coordinates',n)]
assert all(len(p)>=4 and p[0]==p[-1] for p in polys)
assert all(len(p)>=2 for p in lines)
assert all(len(p)==3 and p[2]==0 for line in polys+lines for p in line)
print(json.dumps({'names':[e.text or '' for e in r.findall('.//k:name',n)],'folders':len(d.findall('k:Folder',n)),'polygons':polys,'lines':lines,'descriptions':[e.text or '' for e in r.findall('.//k:description',n)]}))`;
  const parsed = spawnSync('python3', ['-c', script], { input: kml, encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(parsed.error, undefined, parsed.error?.message);
  assert.equal(parsed.status, 0, parsed.stderr);
  return JSON.parse(parsed.stdout);
}
function normalised(coords: number[][], raw = state()) {
  const f = raw.frame, project = makeMercatorProjector(f.centerLng, f.centerLat, f.zoom, f.imgW, f.imgH, 0, 0);
  return coords.map(point => { const value = project(point); return [value[0] / f.imgW, value[1] / f.imgH]; });
}
function near(actual: number, expected: number, reason: string) {
  assert.ok(Math.abs(actual - expected) < 1e-8, `${reason}: ${actual} vs ${expected}`);
}
function spans(points: number[][]) { return [Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])),
  Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))]; }

test('KML parses as namespaced folders and actual saved field, bed and path geometry with generic private names', () => {
  const raw = state(), before = JSON.stringify(raw), result = ready(request(raw)), parsed = parse(result.kml);
  assert.deepEqual(result.counts, { fields: 1, beds: 1, paths: 1 });
  assert.equal(parsed.folders, 1); assert.equal(parsed.polygons.length, 2); assert.equal(parsed.lines.length, 1);
  assert.deepEqual(parsed.names, ['Field layout', 'Field 1', 'Field 1', 'Field 1 / Bed 1', 'Field 1 / Path 1']);
  assert.match(result.disclosure, /contains the chosen map location/); assert.match(result.disclosure, /not surveyed/);
  for (const secret of ['synthetic-private-site-id', 'private-field-id', 'private-bed-id', 'private-path-id', 'Private grower label', 'Private field name', 'Private path name']) assert.equal(result.kml.includes(secret), false, secret);
  assert.equal(JSON.stringify(raw), before); assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.counts));
  assert.equal(result.mimeType, 'application/vnd.google-earth.kml+xml'); assert.equal(result.filename, 'field-layout.kml');
});

test('stored rot zero keeps the natural long axis and rotation on an asymmetric frame preserves physical dimensions', () => {
  for (const [rotation, width, height] of [[0, 0.02, 0.16], [90, 0.08, 0.04], [270, 0.08, 0.04]] as const) {
    const raw = state(); raw.items[0].rot = rotation;
    const shape = normalised(parse(ready(request(raw)).kml).polygons[1], raw), span = spans(shape);
    near(span[0], width, 'normalised horizontal footprint'); near(span[1], height, 'normalised vertical footprint');
  }
  const raw = state(); raw.items[0].rot = 31;
  const ring = normalised(parse(ready(request(raw)).kml).polygons[1], raw);
  const lengths = ring.slice(0, -1).map((point, i) => Math.hypot((ring[i + 1][0] - point[0]) * 100, (ring[i + 1][1] - point[1]) * 50)).sort((a, b) => a - b);
  for (let i = 0; i < lengths.length; i++) near(lengths[i], i < 2 ? 2 : 8, 'rotated ground edge');
});

test('shared footprint extraction preserves the actual exclusion authority and does not substitute generator bearings', () => {
  const raw = state(), frame = raw.frame, item = raw.items[0], before = JSON.stringify(raw);
  const footprint = fieldBlockRectangleFootprint({ x: item.x, y: item.y, wM: item.wM!, hM: item.hM!, rot: 17 }, frame);
  raw.items[0].rot = 17;
  const excluded = fieldBlockExclusions(raw, 'other-field', frame);
  assert.deepEqual(excluded[0], footprint);
  assert.equal(JSON.stringify({ ...raw, items: [{ ...raw.items[0], rot: undefined }] }), before);
});

test('outer rings are detached, closed and counterclockwise even when saved canvas rings have the opposite winding', () => {
  const raw = state(), before = JSON.stringify(raw);
  const first = parse(ready(request(raw)).kml).polygons[0];
  raw.zones[0].points.reverse();
  const second = parse(ready(request(raw)).kml).polygons[0];
  const area = (ring: number[][]) => ring.slice(1).reduce((sum, point, i) => sum + ring[i][0] * point[1] - point[0] * ring[i][1], 0);
  assert.ok(area(first) > 0); assert.ok(area(second) > 0);
  assert.deepEqual(first[0], first[first.length - 1]); assert.deepEqual(second[0], second[second.length - 1]);
  raw.zones[0].points.reverse(); assert.equal(JSON.stringify(raw), before);
});

test('concave fields retain their actual vertices and open mode exports no regenerated beds or paths', () => {
  const raw = state(); raw.items = []; raw.lines = []; raw.zones[0].fieldBlock!.mode = 'open';
  raw.zones[0].points = [[0.1, 0.1], [0.9, 0.1], [0.9, 0.4], [0.4, 0.4], [0.4, 0.9], [0.1, 0.9]];
  const before = JSON.stringify(raw), result = ready(request(raw)), parsed = parse(result.kml);
  assert.deepEqual(result.counts, { fields: 1, beds: 0, paths: 0 }); assert.equal(parsed.polygons[0].length, 7);
  assert.equal(parsed.lines.length, 0); assert.equal(JSON.stringify(raw), before);
});

test('a real materialized field layout exports only saved children and does not refill it from its configuration', () => {
  const raw = state(); raw.items = []; raw.lines = [];
  const materialized = configureFieldBlock(raw, raw.zones[0].id, 'Synthetic generated field', {
    mode: 'beds', bedLengthM: 8, bedWidthM: 2, pathWidthM: 1, angleDeg: 0,
  }, raw.frame);
  assert.ok(materialized.items.length > 1);
  materialized.items.pop();
  const before = JSON.stringify(materialized), result = ready(request(materialized));
  assert.equal(result.counts.beds, materialized.items.length); assert.equal(result.counts.paths, materialized.lines.length);
  assert.equal(JSON.stringify(materialized), before);
});

test('all and selected exports retain separate actual field blocks and never fall back when the selected field was deleted', () => {
  const raw = state(); raw.zones.push({ id: 'second-private-field-id', name: 'Second private label', zone: 2, feature: 'staple_garden',
    points: [[0.05, 0.05], [0.07, 0.05], [0.07, 0.07], [0.05, 0.07]] });
  const all = ready(request(raw)); assert.deepEqual(all.counts, { fields: 2, beds: 1, paths: 1 });
  const selection = { kind: 'selected', fieldId: 'second-private-field-id' } as const;
  const one = ready(request(raw, { selection })); assert.deepEqual(one.counts, { fields: 1, beds: 0, paths: 0 });
  assert.notEqual(one.sourceKey, all.sourceKey);
  raw.zones.pop(); held(request(raw, { selection }), 'selected-field-missing');
});

test('opt-in labels are XML escaped and disclosed while every sample object is marked DEMO', () => {
  const raw = state(); raw.zones[0].name = `Field <A> & "B"`; raw.items[0].label = 'Bed & <private>'; raw.lines[0].name = 'Path > one';
  const result = ready(request(raw, { includeLabels: true, sample: true })), parsed = parse(result.kml);
  assert.ok(parsed.names.every(name => name.startsWith('DEMO — ')));
  assert.ok(parsed.names.includes(`DEMO — Field <A> & "B"`)); assert.ok(parsed.names.includes('DEMO — Bed & <private>'));
  assert.match(result.kml, /Field &lt;A&gt; &amp; &quot;B&quot;/); assert.match(result.disclosure, /labels, which may contain personal information/);
  assert.equal(/NetworkLink|https?:\/\/(?!www.opengis.net)|<Icon|<href|<ExtendedData/.test(result.kml), false);
});

test('forbidden XML noncharacters hold field, bed and path labels while valid Unicode and emoji remain readable', () => {
  const apply: Array<(raw: DesignCanvasState, value: string) => void> = [
    (raw, value) => { raw.zones[0].name = value; },
    (raw, value) => { raw.items[0].label = value; },
    (raw, value) => { raw.lines[0].name = value; },
  ];
  for (const setLabel of apply) {
    const valid = state(); setLabel(valid, 'Valid Unicode 🌱 𐍈 café');
    const result = ready(request(valid, { includeLabels: true }));
    assert.ok(parse(result.kml).names.includes('Valid Unicode 🌱 𐍈 café'));
    for (const forbidden of ['\ufffe', '\uffff']) {
      const invalid = state(); setLabel(invalid, `Invalid${forbidden}label`);
      held(request(invalid, { includeLabels: true }), 'unsafe-source');
      // The independent parser must actually detect the malformed output the
      // old admission regexp would have let through, not merely count labels.
      const brokenXml = result.kml.replace('Valid Unicode 🌱 𐍈 café', `Invalid${forbidden}label`);
      assert.throws(() => parse(brokenXml), /ParseError|invalid token|not well-formed/);
    }
  }
});

test('private source identity includes labels and path points or widths even when generic names are exported', () => {
  const baseline = ready().sourceKey;
  const mutations = [
    (raw: DesignCanvasState) => { raw.items[0].label = 'Different child label'; },
    (raw: DesignCanvasState) => { raw.lines[0].name = 'Different path name'; },
    (raw: DesignCanvasState) => { raw.lines[0].points[0][0] += 0.01; },
    (raw: DesignCanvasState) => { raw.lines[0].widthM = 2; },
    (raw: DesignCanvasState) => { raw.zones[0].name = 'Different field name'; },
  ];
  for (const change of mutations) { const raw = state(); change(raw); assert.notEqual(ready(request(raw)).sourceKey, baseline); }
  assert.notEqual(ready(request(state(), { includeLabels: true })).sourceKey, baseline);
  assert.notEqual(ready(request(state(), { sample: true })).sourceKey, baseline);
});

test('a valid already-effective scale correction is used once and mismatched calibration is held without inference', () => {
  const raw = state(); raw.scaleFactor = 2; raw.frame.mPerPx = 1;
  const ring = normalised(parse(ready(request(raw)).kml).polygons[1], raw), span = spans(ring);
  near(span[0], 0.01, 'two-metre width in the already-corrected 200-metre frame');
  near(span[1], 0.08, 'eight-metre length in the already-corrected 100-metre frame');
  held(request(raw, { effectiveFrame: { ...raw.frame, mPerPx: 0.5 } }), 'calibration-frame-mismatch');
  const corrupt = state(); corrupt.scaleFactor = 0; held(request(corrupt), 'invalid-reference-frame');
});

test('active photo and blank grounds hold, but a retained inactive photo does not replace satellite georeferencing', () => {
  const raw = state(); raw.customBase = { url: 'private-photo-url', mPerPx: 0.1, uploadedAt: '2026-11-04T00:00:00.000Z' };
  raw.baseMode = 'satellite'; raw.useCustomBase = true;
  assert.equal(ready(request(raw)).kml.includes('private-photo-url'), false);
  raw.baseMode = 'photo'; held(request(raw), 'unsupported-base');
  raw.baseMode = 'blank'; raw.blankMPerPx = 0.1; held(request(raw), 'unsupported-base');
});

test('map-reference projection preserves known centre order at different latitudes without claiming survey proof', () => {
  for (const [lng, lat] of [[0, 0], [-70, 45], [140, -60]] as const) {
    const raw = state(); raw.frame.centerLng = lng; raw.frame.centerLat = lat;
    raw.zones[0].points = [[0.5, 0.5], [0.7, 0.5], [0.5, 0.7]];
    const polygon = parse(ready(request(raw)).kml).polygons[0];
    assert.ok(polygon.some(point => Math.abs(point[0] - lng) < 1e-10 && Math.abs(point[1] - lat) < 1e-10));
    const coordinates = normalised(polygon, raw);
    assert.ok(coordinates.some(point => Math.abs(point[0] - 0.7) < 1e-8 && Math.abs(point[1] - 0.5) < 1e-8));
  }
});

test('antimeridian crossing is an explicit held first-slice limit, never a wrapped huge polygon or omitted feature', () => {
  const raw = state(); raw.frame.centerLng = 179.9999; raw.frame.zoom = 10;
  held(request(raw), 'antimeridian-unsupported');
});

test('invalid polar or nonfinite frame inputs hold instead of borrowing a plausible projection', () => {
  for (const centerLat of [90, -90, NaN, Infinity]) { const raw = state(); raw.frame.centerLat = centerLat; held(request(raw)); }
  for (const centerLat of [89.9, -89.9]) { const raw = state(); raw.frame.centerLat = centerLat; held(request(raw), 'mercator-latitude-clamped'); }
  const raw = state(); raw.frame.imgW = 0; held(request(raw), 'invalid-reference-frame');
});

test('raw duplicate, missing, orphaned or contradictory field markers cannot be normalized into an export', () => {
  const mutations = [
    (raw: DesignCanvasState) => { raw.items.push({ ...raw.items[0] }); },
    (raw: DesignCanvasState) => { raw.lines[0].id = raw.items[0].id; },
    (raw: DesignCanvasState) => { raw.items[0].fieldBlockId = 'deleted-field'; },
    (raw: DesignCanvasState) => { raw.zones[0].fieldBlock!.mode = 'open'; },
    (raw: DesignCanvasState) => { raw.items[0].wM = undefined; },
    (raw: DesignCanvasState) => { raw.items[0].defId = 'keyhole_bed'; },
    (raw: DesignCanvasState) => { raw.lines[0].kind = 'swale'; },
    (raw: DesignCanvasState) => { raw.lines[0].widthM = undefined; },
    (raw: DesignCanvasState) => { raw.zones[0].feature = 'cleared'; },
    (raw: DesignCanvasState) => { raw.items = []; raw.lines = []; },
  ];
  for (const change of mutations) { const raw = state(); change(raw); held(request(raw)); }
});

test('self-crossing or degenerate rings and unsafe graph descriptors are rejected without executing getters or mutating source', () => {
  const raw = state(); raw.zones[0].points = [[0.1, 0.1], [0.9, 0.9], [0.9, 0.1], [0.1, 0.9]]; held(request(raw), 'invalid-field');
  const flat = state(); flat.zones[0].points = [[0.1, 0.1], [0.2, 0.1], [0.3, 0.1]]; held(request(flat), 'invalid-field');
  let calls = 0; const getter = state();
  Object.defineProperty(getter.items[0], 'x', { enumerable: true, get() { calls++; return 0.5; } });
  held(request(getter), 'unsafe-source'); assert.equal(calls, 0);
  const sparse = state(); sparse.zones[0].points = new Array(4); held(request(sparse), 'unsafe-source');
  const original = state(), before = JSON.stringify(original); const result = ready(request(original));
  original.items[0].wM = 20; assert.equal(result.kml.includes(before), false); assert.equal(result.sourceKey === ready(request(original)).sourceKey, false);
});

test('software work bounds hold oversized sources rather than partially exporting them', () => {
  const raw = state(); raw.zones[0].points = Array.from({ length: FIELD_LAYOUT_EXPORT_LIMITS.ringPoints + 1 }, (_, index) => [index / 1000, 0.5]);
  held(request(raw), 'work-limit');
  const massive = state(); massive.items = Array.from({ length: FIELD_LAYOUT_EXPORT_LIMITS.rows + 1 }, (_, index) => ({ id: `synthetic-${index}`, defId: 'veg_bed', x: 0.5, y: 0.5 }));
  held(request(massive), 'work-limit');
});
