import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import type { Feature, FeatureCollection, Polygon } from 'geojson';
import {
  designSiteIdFromLocation,
  emptyDesignStudioState,
  formatDesignArea,
  generateGeometryDesignPlan,
  mergeFarmShapesIntoDesignState,
  type DesignLayer,
  type DesignLayerType,
  type DesignStudioState,
} from '@/lib/design-studio';
import {
  WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  roofHarvestLitres,
} from '@/lib/roof-runoff';
import type { LocationData } from '@/lib/types';

function polygonFeature(
  id: string,
  size: number,
  properties: Record<string, unknown>,
): Feature<Polygon> {
  return {
    type: 'Feature',
    id,
    properties,
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [0, 0],
        [size, 0],
        [size, size],
        [0, size],
        [0, 0],
      ]],
    },
  };
}

function layer(
  id: string,
  layerType: DesignLayerType,
  areaM2: number,
  approved = true,
  locked = false,
): DesignLayer {
  return {
    id,
    featureId: id,
    siteId: 'site:test',
    name: id,
    layerType,
    featureType: 'site',
    geometryType: 'Polygon',
    geometry: polygonFeature(id, 0.001, { featureType: 'site' }).geometry,
    areaM2,
    areaLabel: formatDesignArea(areaM2),
    source: 'manual_map',
    confidenceScore: 1,
    approved,
    locked,
    color: '#000000',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function location(overrides: Record<string, unknown> = {}): LocationData {
  return {
    lat: -27,
    lon: 31,
    rainfall: { annual: 1_000, pattern: 'summer' },
    elevation: { slopeDeg: 3, elevation: 500 },
    climate: { minTemp: 5 },
    soil: {},
    biome: { name: 'Savanna' },
    ...overrides,
  } as unknown as LocationData;
}

function allPlanText(plan: ReturnType<typeof generateGeometryDesignPlan>): string {
  return JSON.stringify(plan);
}

test('area labels stay honest for missing, metre-scale and hectare-scale geometry', () => {
  for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatDesignArea(invalid), 'area unknown');
  }
  assert.match(formatDesignArea(123), /m2$/);
  assert.match(formatDesignArea(20_000), /ha$/);
});

test('site ids are stable for real coordinates and reject unusable coordinate keys', () => {
  assert.equal(
    designSiteIdFromLocation(location({ lat: -27.123456, lon: 31.987654 })),
    designSiteIdFromLocation(location({ lat: -27.123456, lon: 31.987654 })),
  );
  assert.notEqual(
    designSiteIdFromLocation(location({ lat: -27.123456, lon: 31.987654 })),
    designSiteIdFromLocation(location({ lat: -27.123466, lon: 31.987654 })),
  );

  for (const [lat, lon] of [
    [Number.NaN, 31],
    [-27, Number.POSITIVE_INFINITY],
    [91, 31],
    [-27, -181],
  ]) {
    assert.equal(designSiteIdFromLocation(location({ lat, lon })), 'site:unselected');
  }
});

test('shape classification respects explicit meaning before the largest-land boundary rule', () => {
  const shapes: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      polygonFeature('boundary', 0.02, { featureType: 'site', name: 'Whole farm' }),
      polygonFeature('roof', 0.004, { featureType: 'site', name: 'Main house' }),
      polygonFeature('beds', 0.003, { featureType: 'site', name: 'Kitchen garden' }),
      polygonFeature('access', 0.002, { featureType: 'site', name: 'Entrance track' }),
      polygonFeature('swale', 0.001, { featureType: 'water', category: 'Swale' }),
      polygonFeature('dam', 0.001, { featureType: 'water', category: 'Dam / pond' }),
    ],
  };

  const merged = mergeFarmShapesIntoDesignState(shapes, emptyDesignStudioState('site:test'), 'site:test');
  const types = Object.fromEntries(merged.layers.map((entry) => [entry.featureId, entry.layerType]));

  assert.deepEqual(types, {
    boundary: 'property_boundary',
    roof: 'roof',
    beds: 'cultivation',
    access: 'access',
    swale: 'unknown',
    dam: 'water_body',
  });
});

test('a merge preserves farmer decisions, never mutates prior state, and invalidates stale plans', () => {
  const existing = layer('roof', 'tree_belt', 10, true, true);
  existing.name = 'Farmer renamed this';
  existing.notes = 'keep';
  const previous: DesignStudioState = {
    siteId: 'site:test',
    layers: [existing],
    generatedPlan: { lockedLayerIds: ['missing-layer'] } as DesignStudioState['generatedPlan'],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const before = structuredClone(previous);
  const shapes: FeatureCollection = {
    type: 'FeatureCollection',
    features: [polygonFeature('roof', 0.004, { featureType: 'site', name: 'Main house' })],
  };

  const merged = mergeFarmShapesIntoDesignState(shapes, previous, 'site:test');

  assert.equal(merged.layers[0].name, 'Farmer renamed this');
  assert.equal(merged.layers[0].layerType, 'tree_belt');
  assert.equal(merged.layers[0].approved, true);
  assert.equal(merged.layers[0].locked, true);
  assert.equal(merged.layers[0].notes, 'keep');
  assert.equal(merged.generatedPlan, null, 'a plan kept references to geometry that no longer exists');
  assert.deepEqual(previous, before);
});

test('site-tagged shapes from another farm cannot erase this farm’s reviewed layers', () => {
  const previous: DesignStudioState = {
    siteId: 'site:a',
    layers: [layer('reviewed', 'cultivation', 50)],
    generatedPlan: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const shapes: FeatureCollection = {
    type: 'FeatureCollection',
    features: [polygonFeature('other', 0.01, { featureType: 'site', siteId: 'site:b' })],
  };

  const merged = mergeFarmShapesIntoDesignState(shapes, previous, 'site:a');
  assert.deepEqual(merged.layers, previous.layers);
});

test('plan water harvest derives from the shared runoff authority', () => {
  const roofAreaM2 = 125;
  const rainfallMm = 820;
  const state: DesignStudioState = {
    siteId: 'site:test',
    layers: [layer('boundary', 'property_boundary', 5_000), layer('roof', 'roof', roofAreaM2)],
    generatedPlan: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const plan = generateGeometryDesignPlan(
    state,
    location({ rainfall: { annual: rainfallMm, pattern: 'summer' } }),
  );
  const expected = Math.round(roofHarvestLitres(
    roofAreaM2,
    rainfallMm,
    WATER_SHEET_ROOF_RUNOFF_COEFFICIENT,
  ));

  assert.equal(plan.waterCalc?.roofHarvestAnnualLitres, expected);
  assert.match(
    allPlanText(plan),
    new RegExp(`× ${Math.round(WATER_SHEET_ROOF_RUNOFF_COEFFICIENT * 100)}%`),
    'the explanation drifted from the coefficient used in the calculation',
  );
});

test('generated sections reference approved geometry only and preserve the saved design', () => {
  const state: DesignStudioState = {
    siteId: 'site:test',
    layers: [
      layer('boundary', 'property_boundary', 5_000, true, true),
      layer('roof', 'roof', 100, true),
      layer('draft-water', 'water_body', 200, false),
    ],
    generatedPlan: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const before = structuredClone(state);
  const plan = generateGeometryDesignPlan(state, location());
  const referenced = [
    ...plan.sectorMap,
    ...plan.zoneMap,
    ...plan.waterMap,
    ...plan.opportunityMap,
  ].flatMap((section) => section.layerIds);

  assert.deepEqual(plan.lockedLayerIds, ['boundary']);
  assert.ok(referenced.includes('boundary'));
  assert.ok(referenced.includes('roof'));
  assert.ok(!referenced.includes('draft-water'));
  assert.deepEqual(state, before);
});

test('damaged numeric evidence never becomes farmer-facing NaN or Infinity', () => {
  const state: DesignStudioState = {
    siteId: 'site:test',
    layers: [
      layer('boundary', 'property_boundary', Number.POSITIVE_INFINITY),
      layer('roof', 'roof', Number.NaN),
      layer('beds', 'cultivation', Number.NEGATIVE_INFINITY),
    ],
    generatedPlan: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const plan = generateGeometryDesignPlan(state, location({
    rainfall: { annual: Number.NaN, pattern: 'summer' },
    elevation: {
      slopeDeg: Number.POSITIVE_INFINITY,
      elevation: Number.NEGATIVE_INFINITY,
      aspectLabel: 'North',
    },
    climate: { minTemp: Number.NaN },
  }));
  const rendered = allPlanText(plan);

  assert.doesNotMatch(rendered, /NaN|Infinity/);
  assert.equal(plan.waterCalc?.roofHarvestAnnualLitres, null);
  assert.equal(plan.waterCalc?.rainfallMmUsed, null);
  assert.equal(plan.waterCalc?.roofAreaM2Used, 0);
  assert.equal(plan.waterCalc?.cultivationAreaM2, 0);
});

test('the species picker opens towards the space that exists, not always upwards', () => {
  // Rory, with the list clipped off the top of the screen over the step tabs: "this is stuck at
  // the top". The panel only ever opened UPWARDS from the button — right for a phone's bottom
  // sheet, wrong the moment the palette is a side column whose button sits near the top, where
  // "upwards" means off-screen. It was also uncapped, so it could not shrink to fit either.
  const src = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');
  const at = src.indexOf('const [speciesAnchor');
  assert.ok(at > 0, 'the species anchor moved — re-pin this, do not delete it');
  const measure = src.slice(at, src.indexOf('measure();', at));
  assert.ok(measure.includes('spaceAbove') && measure.includes('spaceBelow'),
    'the picker no longer measures the room on each side');
  assert.ok(/openDown/.test(measure), 'the open direction is fixed again instead of chosen');
  assert.ok(/maxHeight:/.test(measure),
    'the panel is no longer capped to the side it opens into — it can run off the screen again');
  // And the panel must actually USE the chosen side, not just compute it.
  const panel = src.slice(src.indexOf('speciesPickerOpen && speciesAnchor'));
  assert.ok(/speciesAnchor\.openDown[\s\S]{0,120}top: speciesAnchor\.downTop/.test(panel),
    'the panel ignores the downward placement it just computed');
  assert.ok(/maxHeight: speciesAnchor\.maxHeight/.test(panel),
    'the panel ignores its computed cap and is back on a fixed 45dvh');
});
