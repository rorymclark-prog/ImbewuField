import assert from 'node:assert/strict';
import test from 'node:test';
import type { FeatureCollection, Polygon } from 'geojson';
import { fieldBlockRectangleFootprint } from '../lib/bed-block.ts';
import { computeCanvasFrame, normaliseCanvasState, projectorForFrame, type PlacedItem, type ZoneShape } from '../lib/design-canvas.ts';
import { designSiteIdFromLocation, mergeFarmShapesIntoDesignState } from '../lib/design-studio.ts';
import { fingerprintGrowerWorkflowSource, inspectGrowerWorkflowSource } from '../lib/international/grower-workflow-source.ts';
import {
  buildRivierUitsigStorageSeeds, RIVIER_UITSIG_BANKS, RIVIER_UITSIG_BEDS,
  RIVIER_UITSIG_FIELDS, RIVIER_UITSIG_SITE, RIVIER_UITSIG_SITE_ID,
} from '../lib/rivier-uitsig-layout.ts';

const seeds = buildRivierUitsigStorageSeeds();
const raw = JSON.parse(seeds[`imbewu_design_canvas_${RIVIER_UITSIG_SITE_ID}`]);
const canvas = normaliseCanvasState(raw, RIVIER_UITSIG_SITE_ID);
assert.ok(canvas);

test('the four approximate fields produce the same blank frame at readback', () => {
  assert.equal(designSiteIdFromLocation(RIVIER_UITSIG_SITE), RIVIER_UITSIG_SITE_ID);
  const shapes: FeatureCollection<Polygon> = JSON.parse(seeds.imbewu_farm_shapes);
  assert.equal(shapes.features.length, 4);
  assert.deepEqual(RIVIER_UITSIG_FIELDS.map(field => [field.id, field.approximateAreaHa]),
    [['F01', 1.04], ['F02', 1.36], ['F03', 1.242], ['V01', 0.846]]);
  const merged = mergeFarmShapesIntoDesignState(shapes, {
    siteId: RIVIER_UITSIG_SITE_ID, layers: [], generatedPlan: null, updatedAt: canvas.updatedAt,
  }, RIVIER_UITSIG_SITE_ID);
  assert.ok(merged.layers.every(layer => layer.layerType === 'cultivation'));
  assert.deepEqual(computeCanvasFrame(merged.layers, RIVIER_UITSIG_SITE.lat, RIVIER_UITSIG_SITE.lon).frame, canvas.frame);
  assert.equal(canvas.baseMode, 'blank');
  assert.equal(canvas.blankMPerPx, canvas.frame.mPerPx);
  assert.ok(Math.abs(canvas.frame.centerLat - 0.5) < 0.01 && Math.abs(canvas.frame.centerLng - 0.5) < 0.01);
  assert.ok(!canvas.customBase);
});

test('only the sixteen attached bed rectangles enter the checked capacity', async () => {
  for (const bank of canvas.zones) {
    assert.equal(bank.fieldBlock?.mode, 'beds');
    assert.equal(canvas.items.filter(item => item.fieldBlockId === bank.id).length, 8);
  }
  const checked = await fingerprintGrowerWorkflowSource(inspectGrowerWorkflowSource({
    kind: 'studio-canvas', sourceId: RIVIER_UITSIG_SITE_ID, sourceRevision: 'rivier-layout-fixture', raw,
  }));
  assert.equal(checked.status, 'ready');
  if (checked.status !== 'ready') return;
  assert.equal(checked.heldBeds.length, 0);
  assert.deepEqual(checked.beds.map(bed => bed.id), RIVIER_UITSIG_BEDS.map(bed => bed.id));
  assert.ok(checked.measuredAreas.every(bed => bed.basis === 'explicit-saved-dimensions'));
  assert.ok(Math.abs(checked.beds.reduce((sum, bed) => sum + bed.areaM2, 0) - 460.8) < 1e-9);
});

test('projected outlines and native footprint corners preserve the source scale and orientation', () => {
  const shapes: FeatureCollection<Polygon> = JSON.parse(seeds.imbewu_farm_shapes);
  const origin = RIVIER_UITSIG_FIELDS[0].outlineM[0];
  const coordinate = shapes.features[0].geometry.coordinates[0][0];
  const project = projectorForFrame(canvas.frame);
  const [anchorX, anchorY] = project(coordinate);
  const widthM = canvas.frame.imgW * canvas.frame.mPerPx;
  const heightM = canvas.frame.imgH * canvas.frame.mPerPx;
  const metres = ([x, y]: readonly number[]) => [origin[0] + (x - anchorX) * widthM, origin[1] - (y - anchorY) * heightM];
  const assertNear = (actual: readonly number[], expected: readonly number[], label: string) => {
    assert.ok(Math.hypot(actual[0] - expected[0], actual[1] - expected[1]) < 0.025, label);
  };

  for (const [index, field] of RIVIER_UITSIG_FIELDS.entries()) {
    const mapped = shapes.features[index].geometry.coordinates[0];
    assert.equal(mapped.length, field.outlineM.length);
    mapped.forEach((coordinate, vertex) => assertNear(metres(project(coordinate)), field.outlineM[vertex], field.id));
  }
  for (const [index, bank] of RIVIER_UITSIG_BANKS.entries()) {
    const points: ZoneShape['points'] = canvas.zones[index].points;
    assert.equal(points.length + 1, bank.outlineM.length);
    points.forEach((point, vertex) => assertNear(metres(point), bank.outlineM[vertex], bank.id));
  }
  for (const [index, bed] of RIVIER_UITSIG_BEDS.entries()) {
    const item: PlacedItem = canvas.items[index];
    assert.equal(item.wM, 1.2);
    assert.equal(item.hM, 24);
    assert.ok(item.wM && item.hM);
    const footprint = fieldBlockRectangleFootprint({ ...item, wM: item.wM, hM: item.hM }, canvas.frame).map(metres);
    for (const corner of bed.outlineM.slice(0, -1)) {
      assert.ok(footprint.some(([x, y]) => Math.hypot(x - corner[0], y - corner[1]) < 0.025), bed.label);
    }
  }
});
