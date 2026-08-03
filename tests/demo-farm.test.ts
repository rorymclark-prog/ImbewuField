import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEMO_SITE,
  buildDemoBoundaryFC,
  buildDemoCropPlan,
  buildDemoDesignCanvasState,
  buildDemoFacilitatorState,
  buildDemoFinance,
  buildDemoSavedPlace,
  buildDemoStorageSeeds,
  buildDemoWaterPoints,
} from '../lib/demo-farm.ts';
import { bedsFromDesignCanvas } from '../lib/design-beds-bridge.ts';
import { cropByKey } from '../lib/crop-catalog.ts';
import { ELEMENTS_BY_ID } from '../lib/design-elements.ts';
import { groundRegister } from '../lib/glossy-filters.ts';
import { polygonCropRows, staplePlotGlyphs, staplePlotOrdinalById, type CropGlyph } from '../lib/crop-row-cartography.ts';

function assertUnique(values: string[], label: string): void {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function assertFinitePoint(point: number[], label: string): void {
  assert.equal(point.length, 2, `${label} must be a coordinate pair`);
  assert.ok(point.every(Number.isFinite), `${label} must be finite`);
}

test('editable facilitator state cannot move the canonical demo site', () => {
  const original = { ...DEMO_SITE };
  const first = buildDemoFacilitatorState();
  const editableSite = first.bgSite;
  assert.ok(editableSite);
  assert.notEqual(editableSite, DEMO_SITE);

  editableSite.lat = 0;
  editableSite.lon = 0;

  assert.deepEqual(DEMO_SITE, original);
  assert.deepEqual(buildDemoFacilitatorState().bgSite, original);
  assert.equal(Reflect.set(DEMO_SITE, 'lat', 0), false);
  assert.deepEqual(DEMO_SITE, original);
});

test('the crop plan only references real, matching beds and catalog crops', () => {
  const facilitator = buildDemoFacilitatorState();
  const canvas = buildDemoDesignCanvasState();
  const plan = buildDemoCropPlan();
  const facilitatorBeds = new Map(
    facilitator.items
      .filter((item) => item.type === 'bed' || item.type === 'hugel')
      .map((item) => [item.id, item.wM * item.hM]),
  );
  const canvasBeds = new Map(bedsFromDesignCanvas(canvas).map((bed) => [bed.id, bed.areaM2]));

  assert.ok(facilitatorBeds.size > 0);
  assert.deepEqual(canvasBeds, facilitatorBeds);
  assertUnique(plan.plantings.map((planting) => planting.id), 'planting IDs');
  for (const planting of plan.plantings) {
    assert.ok(facilitatorBeds.has(planting.bedId), `${planting.id} references a missing bed`);
    assert.ok(cropByKey(planting.cropKey), `${planting.id} references a missing crop`);
    assert.ok(Number.isInteger(planting.sowMonth) && planting.sowMonth >= 1 && planting.sowMonth <= 12);
    assert.ok(planting.areaFraction === undefined || (
      Number.isFinite(planting.areaFraction)
      && planting.areaFraction > 0
      && planting.areaFraction <= 1
    ));
  }
});

test('the authored canvas is finite, normalized and resolvable by the real catalog', () => {
  const state = buildDemoDesignCanvasState();
  assert.ok(Number.isFinite(state.frame.mPerPx) && state.frame.mPerPx > 0);
  assert.ok(Number.isFinite(state.frame.imgW) && state.frame.imgW > 0);
  assert.ok(Number.isFinite(state.frame.imgH) && state.frame.imgH > 0);
  assertUnique(
    [...state.items, ...state.zones, ...state.lines].map((shape) => shape.id),
    'canvas geometry IDs',
  );

  for (const item of state.items) {
    assert.ok(ELEMENTS_BY_ID[item.defId], `${item.id} uses an unknown design element`);
    assert.ok(Number.isFinite(item.x) && item.x >= 0 && item.x <= 1);
    assert.ok(Number.isFinite(item.y) && item.y >= 0 && item.y <= 1);
  }
  for (const shape of [...state.zones, ...state.lines]) {
    assert.ok(shape.points.length >= 2);
    for (const point of shape.points) {
      assertFinitePoint(point, shape.id);
      assert.ok(point[0] >= 0 && point[0] <= 1);
      assert.ok(point[1] >= 0 && point[1] <= 1);
    }
  }
});

test('the full demo farm renders four one-crop staple blocks on sheets 06 and 08', () => {
  // This is deliberately the complete demo fixture, not four convenient synthetic squares. The
  // real failure was that the sample farm had no separate staple zones for the common renderer to
  // paint, so unit coverage of crop glyphs passed while both plan sheets showed one merged field.
  const state = buildDemoDesignCanvasState();
  const plots = state.zones.filter((zone) => zone.feature === 'staple_garden');
  assert.equal(plots.length, 4, 'the demo needs four traced blocks, not one merged staple polygon');

  for (const sheet of ['planting', 'all'] as const) {
    assert.ok(
      plots.every((plot) => groundRegister(plot.feature!, sheet) === 'content'),
      `${sheet === 'planting' ? 'sheet 06' : 'sheet 08'} must pass every staple block to the shared ground painter`,
    );
  }

  const ordinals = staplePlotOrdinalById(state.zones);
  const drawn: CropGlyph[] = plots.map((plot) => {
    const ring = plot.points.map(([x, y]) => [x * 1200, y * 900] as [number, number]);
    const layout = polygonCropRows(ring, staplePlotGlyphs(ordinals.get(plot.id) ?? -1), plot.id, 12);
    const crops = new Set(layout.plants.map((plant) => plant.glyph));
    assert.ok(crops.size > 0, `${plot.id} has enough real fixture area to read as rows`);
    assert.equal(crops.size, 1, `${plot.id} must remain one crop block, never an intercropped texture`);
    return [...crops][0];
  });
  assert.deepEqual(drawn, ['grain', 'legume', 'vine', 'generic']);
  assert.equal(new Set(drawn).size, 4, 'four demo blocks must remain visually distinct');
});

test('map boundary, saved place, water points and canvas all identify one site', () => {
  const place = buildDemoSavedPlace();
  const canvas = buildDemoDesignCanvasState();
  const boundary = buildDemoBoundaryFC();
  const water = buildDemoWaterPoints();

  assert.deepEqual({ lat: place.lat, lon: place.lon, name: place.name }, DEMO_SITE);
  assert.equal(canvas.frame.centerLat, DEMO_SITE.lat);
  assert.equal(canvas.frame.centerLng, DEMO_SITE.lon);
  assertUnique(boundary.features.map((feature) => String(feature.id)), 'map feature IDs');
  assertUnique(water.map((point) => point.id), 'water point IDs');

  for (const feature of boundary.features) {
    assert.equal(feature.properties?.siteId, canvas.siteId);
    assert.equal(feature.geometry.type, 'Polygon');
    if (feature.geometry.type !== 'Polygon') continue;
    for (const ring of feature.geometry.coordinates) {
      assert.ok(ring.length >= 4);
      assert.deepEqual(ring[0], ring.at(-1), `${String(feature.id)} must be closed`);
      ring.forEach((point) => assertFinitePoint(point, String(feature.id)));
    }
  }
  for (const point of water) {
    assert.ok(Number.isFinite(point.lat) && Number.isFinite(point.lon));
    assert.ok(Math.abs(point.lat - DEMO_SITE.lat) < 0.01);
    assert.ok(Math.abs(point.lon - DEMO_SITE.lon) < 0.01);
  }
});

test('storage seeds use the same live contracts as their typed builders', () => {
  const seeds = buildDemoStorageSeeds();
  const canvas = buildDemoDesignCanvasState();
  const canvasKey = `imbewu_design_canvas_${canvas.siteId}`;
  const seededPlace = JSON.parse(seeds.permamap_saved_places);
  const seededWater = JSON.parse(seeds.imbewu_water_points);
  const seededBoundary = JSON.parse(seeds.imbewu_farm_shapes);
  const seededCanvas = JSON.parse(seeds[canvasKey]);

  assert.ok(Object.hasOwn(seeds, canvasKey));
  assert.deepEqual(
    seededPlace.map((place: { id: string; lat: number; lon: number }) => (
      { id: place.id, lat: place.lat, lon: place.lon }
    )),
    [buildDemoSavedPlace()].map((place) => ({ id: place.id, lat: place.lat, lon: place.lon })),
  );
  assert.deepEqual(
    seededWater.map((point: { id: string; lat: number; lon: number }) => (
      { id: point.id, lat: point.lat, lon: point.lon }
    )),
    buildDemoWaterPoints().map((point) => ({ id: point.id, lat: point.lat, lon: point.lon })),
  );
  assert.deepEqual(
    seededBoundary.features.map((feature: { id: string }) => feature.id),
    buildDemoBoundaryFC().features.map((feature) => feature.id),
  );
  assert.equal(seededCanvas.siteId, canvas.siteId);
  assert.deepEqual(
    seededCanvas.items.map((item: { id: string }) => item.id),
    canvas.items.map((item) => item.id),
  );
});

test('sample finance rows are finite, uniquely identified and invoices add up', () => {
  const finance = buildDemoFinance();
  for (const [label, rows] of [
    ['sales', finance.sales],
    ['expenses', finance.expenses],
    ['production', finance.production],
    ['invoices', finance.invoices],
  ] as const) {
    assert.ok(rows.length > 0, `${label} should exercise the populated view`);
    assertUnique(rows.map((row) => row.id), `${label} IDs`);
  }
  for (const sale of finance.sales) {
    assert.ok(Number.isFinite(sale.kg) && sale.kg >= 0);
    assert.ok(Number.isFinite(sale.amount) && sale.amount >= 0);
  }
  for (const expense of finance.expenses) {
    assert.ok(Number.isFinite(expense.amount) && expense.amount >= 0);
  }
  for (const production of finance.production) {
    assert.ok(Number.isFinite(production.kg) && production.kg >= 0);
  }
  for (const invoice of finance.invoices) {
    const calculated = invoice.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    assert.equal(invoice.total, calculated, `${invoice.id} total must equal its line items`);
  }
});
